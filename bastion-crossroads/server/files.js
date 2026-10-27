/* Bastion Crossroads: file storage
 *   - S3Files    : any S3-compatible bucket (Backblaze B2, Cloudflare R2, AWS S3, MinIO). Used when S3_BUCKET is set.
 *                  The app uploads straight to the bucket with a one-time signed link, so 1 GB files never
 *                  pass through (or crash) the free server, and downloads use short-lived signed links.
 *   - LocalFiles : a folder on the server's disk, behind signed, expiring links. NOT permanent on Render's free plan.
 * The bucket stays private. Nobody can list it or read a file without a fresh link from the server,
 * and the server only hands links to people in the conversation the file was sent in.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { hmac, safeEqual, RISKY_TYPE, RISKY_EXT } = require('./security');

const UPLOAD_LINK_SECONDS = 2 * 60 * 60;   // time allowed to finish an upload
const DOWNLOAD_LINK_SECONDS = 6 * 60 * 60; // how long a download link works
const disposition = (meta, forceDownload) => `${forceDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(meta.name)}`;
const mustDownload = meta => RISKY_TYPE.test(meta.type) || RISKY_EXT.test(meta.name);

class LocalFiles {
  constructor(dir, secret) { this.kind = 'local'; this.persistent = !process.env.RENDER; this.dir = dir; this.secret = secret; fs.mkdirSync(dir, { recursive: true }); }
  _sig(op, id, exp) { return hmac(this.secret, `${op}:${id}:${exp}`); }
  async uploadTarget(meta) {
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_LINK_SECONDS;
    return { url: `/api/upload/${meta.id}?exp=${exp}&sig=${this._sig('put', meta.id, exp)}`, method: 'PUT', headers: { 'content-type': meta.type } };
  }
  checkSig(op, id, exp, sig) { return /^\d+$/.test(exp) && +exp > Date.now() / 1000 && typeof sig === 'string' && safeEqual(sig, this._sig(op, id, exp)); }
  /** Streams the upload to disk, refusing a single byte past the size the uploader declared. */
  receive(req, meta) {
    return new Promise((ok, bad) => {
      const dest = path.join(this.dir, meta.id), tmp = dest + '.part';
      const out = fs.createWriteStream(tmp, { mode: 0o600 }); let size = 0, done = false;
      const fail = (code, msg) => { if (done) return; done = true; out.destroy(); fs.unlink(tmp, () => {}); req.unpipe?.(out); req.resume(); bad(Object.assign(new Error(msg), { code })); };
      req.on('data', c => { size += c.length; if (size > meta.size) fail(413, 'The file is larger than you said it was.'); });
      req.on('aborted', () => fail(400, 'The upload was interrupted.'));
      out.on('error', () => fail(500, 'The file could not be stored.'));
      out.on('finish', () => {
        if (done) return;
        if (size !== meta.size) return fail(400, 'The upload was incomplete. Try again.');
        fs.rename(tmp, dest, e => { done = true; e ? bad(Object.assign(new Error('The file could not be stored.'), { code: 500 })) : ok(size); });
      });
      req.pipe(out);
    });
  }
  async size(id) { try { return fs.statSync(path.join(this.dir, id)).size; } catch { return null; } }
  async downloadUrl(meta) { const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_SECONDS; return `/files/${meta.id}?exp=${exp}&sig=${this._sig('get', meta.id, exp)}`; }
  serve(req, res, meta) {
    const p = path.join(this.dir, meta.id);
    fs.stat(p, (err, st) => {
      if (err) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"File not found"}'); }
      const dl = mustDownload(meta);
      const headers = { 'content-type': dl ? 'application/octet-stream' : meta.type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600', 'content-disposition': disposition(meta, dl), 'content-security-policy': "default-src 'none'; sandbox", 'x-content-type-options': 'nosniff' };
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        let start, end;
        if (m[1]) { start = +m[1]; end = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1; } else { start = Math.max(0, st.size - +m[2]); end = st.size - 1; }
        if (start > end || start >= st.size) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
        return fs.createReadStream(p, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'content-length': st.size });
      fs.createReadStream(p).pipe(res);
    });
  }
  async remove(id) { fs.unlink(path.join(this.dir, id), () => {}); fs.unlink(path.join(this.dir, id + '.part'), () => {}); }
  async setupCors() { return true; }
}

class S3Files {
  constructor(env) {
    const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    this.cmd = { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, PutBucketCorsCommand }; this.sign = getSignedUrl;
    this.kind = 's3'; this.persistent = true; this.bucket = env.S3_BUCKET; this.prefix = 'bc/';
    this.client = new S3Client({
      region: env.S3_REGION || 'auto', endpoint: env.S3_ENDPOINT || undefined, forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED'
    });
  }
  key(id) { return this.prefix + id; }
  async uploadTarget(meta) {
    // Size and type are part of the signature: the bucket rejects anything bigger or different.
    const c = new this.cmd.PutObjectCommand({ Bucket: this.bucket, Key: this.key(meta.id), ContentLength: meta.size, ContentType: meta.type });
    const url = await this.sign(this.client, c, { expiresIn: UPLOAD_LINK_SECONDS, signableHeaders: new Set(['content-length', 'content-type']) });
    return { url, method: 'PUT', headers: { 'content-type': meta.type } };
  }
  async size(id) { try { const r = await this.client.send(new this.cmd.HeadObjectCommand({ Bucket: this.bucket, Key: this.key(id) })); return r.ContentLength ?? null; } catch { return null; } }
  async downloadUrl(meta) {
    const dl = mustDownload(meta);
    const c = new this.cmd.GetObjectCommand({ Bucket: this.bucket, Key: this.key(meta.id), ResponseContentDisposition: disposition(meta, dl), ResponseContentType: dl ? 'application/octet-stream' : meta.type });
    return this.sign(this.client, c, { expiresIn: DOWNLOAD_LINK_SECONDS });
  }
  async remove(id) { try { await this.client.send(new this.cmd.DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(id) })); } catch (e) { console.error('[files] delete failed:', e.message); } }
  /** Lets browsers and the app upload straight to the bucket, from your allowed origins only. */
  async setupCors(origins) {
    try {
      await this.client.send(new this.cmd.PutBucketCorsCommand({ Bucket: this.bucket, CORSConfiguration: { CORSRules: [{ AllowedOrigins: origins.length ? origins : ['*'], AllowedMethods: ['PUT', 'GET', 'HEAD'], AllowedHeaders: ['content-type', 'content-length'], ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range'], MaxAgeSeconds: 3600 }] } }));
      return true;
    } catch (e) { console.warn('[files] Could not set bucket CORS automatically (' + e.message + '). Set it in your bucket settings; see DEPLOY.md.'); return false; }
  }
}

function createFiles(env, dataDir, secret) {
  if (env.S3_BUCKET) {
    for (const k of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) if (!env[k]) throw new Error(`S3_BUCKET is set but ${k} is missing.`);
    return new S3Files(env);
  }
  return new LocalFiles(path.join(dataDir, 'files'), secret);
}
module.exports = { createFiles };
