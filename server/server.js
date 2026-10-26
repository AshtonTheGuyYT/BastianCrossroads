/* Bastion Crossroads server
 * Hosts the website, the status page (/status) and the live chat API.
 *
 * Run locally:   npm install && npm start            → http://localhost:8787
 * Deploy free:   see DEPLOY.md (Render + Neon Postgres + Backblaze B2)
 *
 * Settings come from environment variables (all optional):
 *   DATABASE_URL          Postgres connection string. Without it, data goes to server/data/db.json.
 *   S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *                         S3-compatible bucket for files. Without it, files go to server/data/files.
 *   ALLOWED_ORIGINS       Extra sites/apps allowed to connect, comma separated (or * for any).
 *   REGISTRATION_CODE     If set, people need this code to create an account (private server).
 *   TOKEN_SECRET          Long random string used to sign file links. Set one so links survive restarts.
 *   MAX_FILE_BYTES        Per-file limit (default 1 GB).
 *   STORAGE_LIMIT_BYTES   Total file storage cap (default 9.5 GB with a bucket, so you stay inside B2's free 10 GB).
 *   UPLOAD_DAILY_BYTES    Per-person upload allowance per 24 hours (default 3 GB).
 *   SESSION_DAYS          How long a sign-in lasts without use (default 30).
 *   METERED_DOMAIN, METERED_API_KEY
 *                         Free call relay from metered.ca (e.g. yourapp.metered.live + its API key).
 *                         Without it, calls still work on most home Wi-Fi but can fail on mobile data.
 *   PORT                  Port to listen on (Render sets this).
 */
'use strict';
/* ---- Tidy up settings pasted into the hosting dashboard ----
 * Copying from Notepad or a web page often drags along a label ("DATABASE_URL="), quotes,
 * spaces, invisible characters or an "https://" that the editor added. Remove those first.
 */
(function cleanSettings() {
  const KEYS = ['DATABASE_URL', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'REGISTRATION_CODE', 'ALLOWED_ORIGINS', 'PUBLIC_URL'];
  for (const k of KEYS) {
    let v = process.env[k]; if (v === undefined) continue;
    v = v.replace(/[​-‍﻿ ]/g, ' ').trim();                 // invisible characters
    v = v.replace(new RegExp('^' + k + '\\s*[=:]\\s*', 'i'), '');             // pasted label
    if (k === 'DATABASE_URL') v = v.replace(/^psql\s+/i, '');                  // copied from Neon's psql tab
    v = v.replace(/^["'`]+|["'`;]+$/g, '').trim();                              // quotes
    if (k === 'DATABASE_URL') {
      v = v.replace(/^https?:\/\/(?=postgres)/i, '');                           // editor-added https://
      v = v.replace(/^postgres(ql)?:\/*/i, 'postgresql://');                    // missing or extra slashes
      if (v && !/^postgresql:\/\//i.test(v) && /@[^/]+\//.test(v)) v = 'postgresql://' + v; // scheme left off entirely
      v = v.replace(/([?&])sslmode=(require|prefer|verify-ca)\b/i, '$1sslmode=verify-full'); // strictest SSL, silences pg warning
      v = v.replace(/\s+/g, '');                                                // line breaks from copying
    }
    if (k === 'S3_ENDPOINT' && v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
    if (v !== process.env[k]) console.log(`[setup] Tidied up the ${k} setting.`);
    if (v) process.env[k] = v; else delete process.env[k];
  }
  const db = process.env.DATABASE_URL;
  if (db) {
    let host = null; try { host = new URL(db).hostname; } catch {}
    if (!/^postgresql:\/\//i.test(db) || !host) {
      // Describe the problem without ever printing the password
      const shape = db.replace(/:[^:@/]*@/, ':*****@').replace(/(\/\/[^:@/]+):[^@]*@/, '$1:*****@').slice(0, 60);
      console.error(`[fatal] DATABASE_URL does not look like a database address. It should look like:\n        postgresql://neondb_owner:*****@ep-something.neon.tech/neondb?sslmode=require\n        Yours starts like this (password hidden): ${shape}`);
      process.exit(1);
    }
  }
})();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const sec = require('./security');
const { createStore, convoKey } = require('./store');
const { createFiles } = require('./files');

const VERSION = '3.0.1';
const ENV = process.env;
const GB = 1024 ** 3;
const PORT = +ENV.PORT || 8787;
const ON_RENDER = !!ENV.RENDER;
const TRUST_PROXY = ENV.TRUST_PROXY ? ENV.TRUST_PROXY === 'true' : ON_RENDER;
const WWW = path.resolve(__dirname, '..', 'www');
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.resolve(ENV.DATA_DIR || path.join(__dirname, 'data'));
const MAX_FILE = Math.floor(+ENV.MAX_FILE_BYTES || GB);
const STORAGE_LIMIT = Math.floor(+ENV.STORAGE_LIMIT_BYTES || (ENV.S3_BUCKET ? 9.5 * GB : 5 * GB));
const DAILY_UPLOAD = Math.floor(+ENV.UPLOAD_DAILY_BYTES || 3 * GB);
const INVITE = ENV.REGISTRATION_CODE || '';
const SESSION_MS = (+ENV.SESSION_DAYS || 30) * 864e5;
const SECRET = ENV.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const HISTORY_SENT = 300;          // newest messages per conversation sent on connect
const MAX_SOCKETS = 2000;          // whole server
const MAX_SOCKETS_PER_IP = 30;
const MAX_SOCKETS_PER_USER = 8;
const MAX_SESSIONS_PER_USER = 20;
const PUBLIC_URL = (ENV.PUBLIC_URL || ENV.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const ORIGINS_RAW = (ENV.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const ANY_ORIGIN = ORIGINS_RAW.includes('*');
// Native app shells use these origins (Capacitor on Android/iOS, Electron/Tauri-style localhost)
const ORIGINS = new Set([...ORIGINS_RAW, PUBLIC_URL, 'capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost', 'tauri://localhost', 'app://localhost'].filter(o => o && o !== '*'));
if (!ENV.TOKEN_SECRET) console.warn('[warn] TOKEN_SECRET is not set. A random one is used, so file links stop working after each restart.');

const store = createStore(DATA);
const files = createFiles(ENV, DATA, SECRET);
const limiter = new sec.Limiter();
let db;
const startedAt = Date.now();

/* =========================================================
   Helpers
   ========================================================= */
const byName = n => Object.values(db.users).find(u => u.username === n);
const sockets = new Map();   // userId -> Set<ws>
const ipConns = new Map();   // ip -> count
const fileRefs = new Map();  // fileId -> Set<convoKey>
const online = uid => (sockets.get(uid)?.size || 0) > 0;
/** What `viewer` may see of user `u`. Online status is only shared with people `u` has accepted. */
const accepted = (owner, other) => (db.contacts[owner] || []).includes(other);
function pub(u, viewer) {
  const shareStatus = !viewer || accepted(u.id, viewer);
  const status = !shareStatus || !online(u.id) || u.status === 'invisible' ? 'offline' : (u.status || 'online');
  return { acceptedYou: viewer ? accepted(u.id, viewer) : undefined, id: u.id, username: u.username, displayName: u.displayName, bio: u.bio || '', pronouns: u.pronouns || '', avatar: u.avatar || null, banner: u.banner || null, bannerColor: u.bannerColor || '#3A4658', accent: u.accent || '#E9B44C', status, customStatus: u.customStatus || '', createdAt: u.createdAt };
}
const self = u => ({ ...pub(u), status: u.status || 'online' });
function sendTo(uid, obj) { const s = sockets.get(uid); if (!s) return; const d = JSON.stringify(obj); for (const ws of s) if (ws.readyState === 1 && ws.authed) ws.send(d); }
function watchers(uid) {
  const out = new Set();
  for (const [owner, list] of Object.entries(db.contacts)) if (list.includes(uid)) out.add(owner);
  for (const k of Object.keys(db.convos)) { const [a, b] = k.split(':'); if (a === uid) out.add(b); if (b === uid) out.add(a); }
  out.delete(uid); return out;
}
function broadcastUser(u) { for (const w of watchers(u.id)) if (online(w)) sendTo(w, { t: 'user', user: pub(u, w) }); sendTo(u.id, { t: 'user', user: self(u) }); }
function addContact(owner, other) { const l = (db.contacts[owner] ||= []); if (l.includes(other)) return false; l.unshift(other); if (l.length > 1000) l.length = 1000; store.setContacts(owner, l); return true; }
const readTimers = new Map();
function saveReadsSoon(uid) { if (readTimers.has(uid)) return; readTimers.set(uid, setTimeout(() => { readTimers.delete(uid); store.setReads(uid, db.reads[uid]); }, 1500)); }
function flushReads() { for (const [uid, t] of readTimers) { clearTimeout(t); store.setReads(uid, db.reads[uid]); } readTimers.clear(); }
const blocked = (owner, other) => (db.blocks[owner] || []).includes(other);
function indexFiles(m) { for (const a of m.attachments || []) { if (!fileRefs.has(a.id)) fileRefs.set(a.id, new Set()); fileRefs.get(a.id).add(convoKey(m.from, m.to)); } }
function withFiles(m) { return { ...m, attachments: (m.attachments || []).map(a => { const f = db.files[a.id]; return f ? { id: a.id, name: f.name, size: f.size, type: f.type, w: a.w || null, h: a.h || null } : { id: a.id, name: 'Missing file', size: 0, type: '', w: null, h: null }; }) }; }
function storageUsed() { let n = 0; for (const f of Object.values(db.files)) n += f.size || 0; return n; }
function uploadedToday(uid) { const since = Date.now() - 864e5; let n = 0; for (const f of Object.values(db.files)) if (f.owner === uid && f.createdAt > since) n += f.size || 0; return n; }
function removeFile(id) { if (!db.files[id]) return; delete db.files[id]; fileRefs.delete(id); store.deleteFile(id); files.remove(id); }
/* ---------------- calls (signalling only; audio/video flows directly between the two people) ---------------- */
const calls = new Map();     // callId -> call
const userCall = new Map();  // userId -> callId
const RING_MS = 40e3;
const callsConfigured = () => ({ relay: !!(ENV.METERED_DOMAIN && ENV.METERED_API_KEY) || !!ENV.TURN_URLS });
let iceCache = { at: 0, servers: null };
async function iceServers() {
  const stun = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (ENV.TURN_URLS) return [...stun, { urls: ENV.TURN_URLS.split(',').map(x => x.trim()), username: ENV.TURN_USERNAME || '', credential: ENV.TURN_CREDENTIAL || '' }];
  if (!(ENV.METERED_DOMAIN && ENV.METERED_API_KEY)) return stun;
  if (iceCache.servers && Date.now() - iceCache.at < 10 * 60e3) return iceCache.servers;
  try {
    const dom = ENV.METERED_DOMAIN.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(`https://${dom}/api/v1/turn/credentials?apiKey=${encodeURIComponent(ENV.METERED_API_KEY)}`, { signal: c.signal }); clearTimeout(t);
    const list = await r.json();
    if (!r.ok || !Array.isArray(list)) throw new Error('bad response ' + r.status);
    iceCache = { at: Date.now(), servers: [...stun, ...list] };
    return iceCache.servers;
  } catch (e) { console.warn('[calls] Could not get relay servers from Metered:', e.message); return stun; }
}
function endCall(call, reason) {
  if (!call || call.over) return; call.over = true;
  clearTimeout(call.timer); calls.delete(call.id);
  if (userCall.get(call.a) === call.id) userCall.delete(call.a);
  if (userCall.get(call.b) === call.id) userCall.delete(call.b);
  const out = { t: 'call:ended', callId: call.id, reason };
  sendTo(call.a, out); sendTo(call.b, out);
  // Leave a small record in the conversation
  const dur = call.answeredAt ? Math.round((Date.now() - call.answeredAt) / 1000) : 0;
  const status = call.answeredAt ? 'ended' : (reason === 'declined' ? 'declined' : 'missed');
  const m = { id: sec.randomId(10), from: call.a, to: call.b, text: '', ts: Date.now(), reactions: {}, attachments: [], replyTo: null, call: { kind: call.kind, status, duration: dur } };
  (db.convos[convoKey(call.a, call.b)] ||= []).push(m); store.saveMessage(m);
  sendTo(call.a, { t: 'msg', msg: withFiles(m) }); sendTo(call.b, { t: 'msg', msg: withFiles(m) });
}
const fmtGB = b => b >= GB ? (b / GB).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1048576)) + ' MB';

/* ---------------- sessions ---------------- */
function createSession(uid) {
  const token = sec.newToken(), h = sec.tokenHash(token), now = Date.now();
  db.sessions[h] = { userId: uid, createdAt: now, expiresAt: now + SESSION_MS, lastSeen: now };
  store.saveSession(h, db.sessions[h]);
  const mine = Object.entries(db.sessions).filter(([, s]) => s.userId === uid).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
  while (mine.length > MAX_SESSIONS_PER_USER) { const [oh] = mine.shift(); delete db.sessions[oh]; store.deleteSession(oh); }
  return token;
}
function sessionFor(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const h = sec.tokenHash(token), s = db.sessions[h];
  if (!s) return null;
  if (s.expiresAt < Date.now() || !db.users[s.userId]) { delete db.sessions[h]; store.deleteSession(h); return null; }
  const now = Date.now();
  if (now - s.lastSeen > 3600e3) { s.lastSeen = now; s.expiresAt = now + SESSION_MS; store.saveSession(h, s); } // sliding expiry
  return { hash: h, user: db.users[s.userId] };
}

/* =========================================================
   HTTP
   ========================================================= */
function originAllowed(req) {
  const o = req.headers.origin;
  if (!o || o === 'null') return !o; // no Origin = native app / server-to-server; literal "null" = sandboxed page, refuse
  if (ANY_ORIGIN || ORIGINS.has(o)) return true;
  try {
    const u = new URL(o);
    if (u.host === req.headers.host) return true;                                              // the site this server hosts
    if (!ON_RENDER && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true; // testing on your own computer
    return false;
  } catch { return false; }
}
function cors(req, res) {
  const o = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (o && originAllowed(req)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
function json(res, code, obj, extra = {}) { if (res.headersSent) return; res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }); res.end(JSON.stringify(obj)); }
function tooMany(res, s, msg) { json(res, 429, { error: msg || `Too many requests. Try again in ${sec.wait(s)}.` }, { 'retry-after': String(s) }); }
function readJSON(req, limit = 16 * 1024) {
  return new Promise((ok, bad) => {
    if (!/application\/json/i.test(req.headers['content-type'] || '')) return bad(new Error('Send JSON.'));
    let size = 0; const chunks = [];
    let over = false;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { if (!over) { over = true; bad(Object.assign(new Error('Request too large.'), { code: 413 })); } if (size > 4 * limit) req.destroy(); return; } // keep draining a little so the error can be answered, then hang up
      chunks.push(c);
    });
    req.on('end', () => { if (over) return; try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; ok(v); } catch { bad(new Error('Invalid request.')); } });
    req.on('error', bad);
  });
}
const bearer = req => { const m = /^Bearer (\S+)$/.exec(req.headers.authorization || ''); return m ? m[1] : null; };

// The app's one inline <script> is allowed by its exact hash, so injected scripts cannot run.
let APP_CSP = null;
function appCsp() {
  if (APP_CSP) return APP_CSP;
  const DEV = ON_RENDER ? '' : ' http://localhost:* http://127.0.0.1:*';
  let hashes = '';
  try {
    const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) hashes += ` 'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`;
  } catch {}
  APP_CSP = `default-src 'self'; script-src 'self'${hashes}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:${DEV}; media-src 'self' blob: https:${DEV}; connect-src 'self' https: wss:${ON_RENDER ? '' : ' ws:' + DEV}; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'`;
  return APP_CSP;
}
const STATUS_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'";
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

function serveStatic(req, res, root, rel, csp) {
  let p;
  try { p = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(rel))); } catch { res.writeHead(400); return res.end(); }
  if (!p.startsWith(root + path.sep) && p !== root) { res.writeHead(403); return res.end(); }
  if (path.basename(p).startsWith('.')) { res.writeHead(404); return res.end(); }
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(p);
    const h = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': st.size, 'cache-control': ext === '.html' || p.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600' };
    if (ext === '.html' && csp) h['content-security-policy'] = csp;
    res.writeHead(200, h);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(p).pipe(res);
  });
}

async function handleApi(req, res, url, ip) {
  const p = url.pathname;
  const g = limiter.hit('api:' + ip, 300, 60e3); if (!g.ok) return tooMany(res, g.retryAfter);

  if (p === '/api/ping' && req.method === 'GET') return json(res, 200, { app: 'bastion-crossroads', version: VERSION, inviteRequired: !!INVITE, maxFile: MAX_FILE, files: files.kind, calls: callsConfigured() });

  if (p === '/api/status' && req.method === 'GET') {
    let msgs = 0; for (const l of Object.values(db.convos)) msgs += l.length;
    return json(res, 200, { app: 'bastion-crossroads', status: 'online', version: VERSION, startedAt, uptimeSec: Math.round((Date.now() - startedAt) / 1000), people: Object.keys(db.users).length, onlineNow: sockets.size, connections: wss.clients.size, messages: msgs, conversations: Object.keys(db.convos).length, storage: { used: storageUsed(), limit: STORAGE_LIMIT, kind: files.kind, permanent: files.persistent }, database: { kind: store.kind, permanent: store.persistent }, registration: INVITE ? 'invite code' : 'open', maxFile: MAX_FILE, calls: callsConfigured(), activeCalls: calls.size, host: ON_RENDER ? 'Render' : 'self-hosted' });
  }

  if (req.method === 'POST' && p === '/api/register') {
    const a = limiter.hit('reg:' + ip, 5, 3600e3); if (!a.ok) return tooMany(res, a.retryAfter, `Too many new accounts from your network. Try again in ${sec.wait(a.retryAfter)}.`);
    const b = limiter.hit('reg:all', 60, 3600e3); if (!b.ok) return tooMany(res, b.retryAfter, 'Sign-ups are paused for a moment because of unusual activity. Try again later.');
    let body; try { body = await readJSON(req); } catch (e) { return json(res, e.code || 400, { error: e.message }, e.code === 413 ? { connection: 'close' } : {}); }
    if (INVITE && !sec.safeEqual(String(body.invite || ''), INVITE)) return json(res, 403, { error: 'That invite code is not right. Ask the server owner for the current code.' });
    const username = String(body.username || '').toLowerCase().trim();
    const up = sec.usernameProblem(username); if (up) return json(res, 400, { error: up });
    const pp = sec.passwordProblem(body.password, username); if (pp) return json(res, 400, { error: pp });
    if (byName(username)) return json(res, 409, { error: `@${username} is already taken. Try another username.` });
    const pass = await sec.hashPassword(body.password);
    if (byName(username)) return json(res, 409, { error: `@${username} is already taken. Try another username.` });
    const u = { id: 'u_' + sec.randomId(8), username, displayName: sec.str(body.displayName, 32).trim() || username, pass, bio: '', pronouns: '', avatar: null, banner: null, bannerColor: '#3A4658', accent: '#E9B44C', status: 'online', customStatus: '', createdAt: Date.now() };
    db.users[u.id] = u; await store.saveUser(u);
    return json(res, 200, { token: createSession(u.id), me: self(u) });
  }

  if (req.method === 'POST' && p === '/api/login') {
    let body; try { body = await readJSON(req); } catch (e) { return json(res, e.code || 400, { error: e.message }, e.code === 413 ? { connection: 'close' } : {}); }
    const username = String(body.username || '').toLowerCase().trim().slice(0, 30);
    const lockU = limiter.blocked('fail:u:' + username, 8), lockI = limiter.blocked('fail:ip:' + ip, 30);
    if (lockU || lockI) return tooMany(res, Math.max(lockU, lockI), `Too many sign-in attempts. Try again in ${sec.wait(Math.max(lockU, lockI))}.`);
    const u = byName(username);
    const ok = await sec.verifyPassword(String(body.password || '').slice(0, 128), u?.pass);
    if (!u || !ok) {
      limiter.hit('fail:u:' + username, 8, 15 * 60e3); limiter.hit('fail:ip:' + ip, 30, 15 * 60e3);
      return json(res, 401, { error: 'That username and password do not match.' });
    }
    limiter.clear('fail:u:' + username);
    return json(res, 200, { token: createSession(u.id), me: self(u) });
  }

  if (req.method === 'POST' && p === '/api/logout') {
    const s = sessionFor(bearer(req));
    if (s) { delete db.sessions[s.hash]; store.deleteSession(s.hash); for (const ws of sockets.get(s.user.id) || []) if (ws.sessionHash === s.hash) ws.close(4001, 'signed out'); }
    return json(res, 200, { ok: true });
  }

  // Upload target for local storage only (bucket uploads go straight to the bucket)
  const up = /^\/api\/upload\/([a-f0-9]{32})$/.exec(p);
  if (up && req.method === 'PUT' && files.kind === 'local') {
    const meta = db.files[up[1]];
    if (!meta || meta.status !== 'pending' || !files.checkSig('put', meta.id, url.searchParams.get('exp'), url.searchParams.get('sig'))) { req.resume(); return json(res, 403, { error: 'This upload link is not valid. Try attaching the file again.' }); }
    if (+req.headers['content-length'] > meta.size) { req.resume(); return json(res, 413, { error: 'The file is larger than you said it was.' }); }
    meta.status = 'uploading';
    try { await files.receive(req, meta); meta.status = 'pending'; return json(res, 200, { ok: true }); }
    catch (e) { meta.status = 'pending'; return json(res, e.code || 500, { error: e.message }); }
  }
  json(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const ip = sec.clientIp(req, TRUST_PROXY);
  const url = new URL(req.url, 'http://x');
  const isHttps = req.headers['x-forwarded-proto'] === 'https';
  sec.securityHeaders(res, { hsts: isHttps });
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!db) return json(res, 503, { error: 'The server is starting. Try again in a few seconds.' }, { 'retry-after': '5' });
  try {
    const p = url.pathname;
    if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
    if (p.startsWith('/api/')) {
      if (req.headers.origin && !originAllowed(req)) return json(res, 403, { error: 'This site is not allowed to use this server.' });
      return await handleApi(req, res, url, ip);
    }
    if (p.startsWith('/files/') && files.kind === 'local') {
      const id = p.slice(7), meta = db.files[id];
      if (!/^[a-f0-9]{32}$/.test(id) || !meta || meta.status !== 'ready' || !files.checkSig('get', id, url.searchParams.get('exp'), url.searchParams.get('sig'))) return json(res, 403, { error: 'This file link has expired or is not valid.' });
      return files.serve(req, res, meta);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const s = limiter.hit('static:' + ip, 600, 60e3); if (!s.ok) return tooMany(res, s.retryAfter);
    if (p === '/status' || p === '/status/') return serveStatic(req, res, PUBLIC, 'status.html', STATUS_CSP);
    if (p === '/status.js' || p === '/status.css') return serveStatic(req, res, PUBLIC, p.slice(1));
    if (!fs.existsSync(path.join(WWW, 'index.html'))) { res.writeHead(302, { location: '/status' }); return res.end(); }
    return serveStatic(req, res, WWW, p.endsWith('/') ? p + 'index.html' : p, appCsp());
  } catch (e) { console.error('[http]', e.message); json(res, 500, { error: 'Server error' }); }
});
server.headersTimeout = 20e3;               // slow-header (slowloris) protection
server.requestTimeout = files.kind === 'local' ? 0 : 60e3;
server.timeout = 120e3;                     // idle sockets
server.keepAliveTimeout = 65e3;
server.maxHeadersCount = 60;
server.maxConnections = 4000;

/* =========================================================
   WebSocket (live chat)
   ========================================================= */
const wss = new WebSocketServer({ noServer: true, maxPayload: 6 * 1024 * 1024, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  const reject = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
  let url; try { url = new URL(req.url, 'http://x'); } catch { return reject(400, 'Bad Request'); }
  if (url.pathname !== '/ws' || !db) return reject(404, 'Not Found');
  if (!originAllowed(req)) return reject(403, 'Forbidden');
  const ip = sec.clientIp(req, TRUST_PROXY);
  if ((ipConns.get(ip) || 0) >= MAX_SOCKETS_PER_IP || wss.clients.size >= MAX_SOCKETS) return reject(429, 'Too Many Requests');
  const r = limiter.hit('wsconn:' + ip, 60, 60e3); if (!r.ok) return reject(429, 'Too Many Requests');
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, ip));
});

wss.on('connection', (ws, req, ip) => {
  ws.ip = ip; ipConns.set(ip, (ipConns.get(ip) || 0) + 1);
  ws.isAlive = true; ws.on('pong', () => ws.isAlive = true);
  ws.flood = new sec.Bucket(20, 60); ws.sendB = new sec.Bucket(5, 15); ws.misc = new sec.Bucket(3, 10); ws.readB = new sec.Bucket(4, 30); ws.signal = new sec.Bucket(60, 300); ws.strikes = 0;
  // The token arrives in the first message, never in the URL (URLs end up in logs).
  const authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), 10e3);
  ws.on('message', async (raw, isBinary) => {
    if (isBinary) return ws.close(1003, 'text only');
    let d; try { d = JSON.parse(raw); } catch { if (++ws.strikes > 20) ws.close(1008, 'bad data'); return; }
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    if (!ws.authed) {
      if (d.t !== 'auth') return ws.close(4001, 'auth required');
      clearTimeout(authTimer);
      const s = sessionFor(d.token);
      if (!s) return ws.close(4001, 'unauthorized');
      return onAuthed(ws, s);
    }
    if (d.t !== 'call:signal' && !ws.flood.take()) { if (++ws.strikes > 200) return ws.close(1008, 'flooding'); if (d.rid) reply(ws, d.rid, false, 'You are going too fast. Wait a moment and try again.'); return; }
    const me = db.users[ws.userId]; if (!me) return ws.close(4001, 'account removed');
    try { await handle(ws, me, d); } catch (e) { console.error('[ws]', d.t, e.message); if (d.rid) reply(ws, d.rid, false, 'Server error. Try again.'); }
  });
  ws.on('close', () => {
    clearTimeout(authTimer);
    const n = (ipConns.get(ip) || 1) - 1; n ? ipConns.set(ip, n) : ipConns.delete(ip);
    if (!ws.userId) return;
    for (const call of calls.values()) {
      // hanging up if the socket in the call goes away (or the callee's last socket while ringing)
      if (call.aSock === ws || call.bSock === ws) endCall(call, 'ended');
      else if (!call.bSock && call.b === ws.userId && (sockets.get(ws.userId)?.size || 0) <= 1) endCall(call, 'missed');
    }
    const s = sockets.get(ws.userId); s?.delete(ws);
    if (s && !s.size) { sockets.delete(ws.userId); const u = db.users[ws.userId]; if (u) broadcastUser(u); }
  });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, 30e3).unref();

function onAuthed(ws, s) {
  const me = s.user;
  ws.authed = true; ws.userId = me.id; ws.sessionHash = s.hash;
  const wasOnline = online(me.id);
  if (!sockets.has(me.id)) sockets.set(me.id, new Set());
  const set = sockets.get(me.id); set.add(ws);
  if (set.size > MAX_SOCKETS_PER_USER) { const oldest = set.values().next().value; oldest.close(4002, 'too many connections'); }
  const contacts = db.contacts[me.id] || [], people = new Set(contacts), convos = {};
  for (const [k, list] of Object.entries(db.convos)) {
    const [a, b] = k.split(':'); if (a !== me.id && b !== me.id) continue;
    const peer = a === me.id ? b : a; people.add(peer);
    convos[peer] = list.slice(-HISTORY_SENT).map(withFiles);
  }
  ws.send(JSON.stringify({ t: 'hello', me: self(me), contacts, blocked: db.blocks[me.id] || [], users: [...people].filter(i => db.users[i]).map(i => pub(db.users[i], me.id)), convos, declined: db.declined[me.id] || {}, reads: db.reads[me.id] || {}, limits: { maxFile: MAX_FILE }, calls: callsConfigured() }));
  if (!wasOnline) broadcastUser(me);
}
const reply = (ws, rid, ok, data) => ws.readyState === 1 && rid && ws.send(JSON.stringify({ t: 'res', rid, ok, ...(ok ? { data } : { error: data }) }));
function findMsg(me, peer, mid) {
  if (typeof peer !== 'string' || typeof mid !== 'string') return {};
  const list = db.convos[convoKey(me.id, peer)]; if (!list) return {};
  const i = list.findIndex(m => m.id === mid); return { list, i, m: list[i] };
}
function deliver(m, type = 'msg', extra = {}) { const out = { t: type, msg: withFiles(m), ...extra }; sendTo(m.from, out); sendTo(m.to, out); }
const EMOJI_RE = /^[^\s<>"'`\\a-zA-Z0-9]{1,16}$/u;
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

async function handle(ws, me, d) {
  const ok = data => reply(ws, d.rid, true, data), no = msg => reply(ws, d.rid, false, msg);
  switch (d.t) {
    case 'profile': {
      if (!ws.misc.take()) return no('You are changing your profile too quickly. Wait a moment.');
      const p = d.profile && typeof d.profile === 'object' ? d.profile : {};
      if (!sec.isProfileImage(p.avatar, 1024 * 1024)) return no('Profile pictures must be PNG, JPG, WebP or GIF images under 1 MB.');
      if (!sec.isProfileImage(p.banner, 2 * 1024 * 1024)) return no('Banners must be PNG, JPG, WebP or GIF images under 2 MB.');
      Object.assign(me, {
        displayName: sec.str(p.displayName, 32).trim() || me.displayName, bio: sec.str(p.bio, 190, { multiline: true }), pronouns: sec.str(p.pronouns, 24), customStatus: sec.str(p.customStatus, 60),
        avatar: p.avatar ?? null, banner: p.banner ?? null, bannerColor: sec.isColor(p.bannerColor) ? p.bannerColor : me.bannerColor, accent: sec.isColor(p.accent) ? p.accent : me.accent,
        status: ['online', 'idle', 'dnd', 'invisible'].includes(p.status) ? p.status : me.status
      });
      store.saveUser(me); broadcastUser(me); return ok(self(me));
    }
    case 'search': {
      if (!ws.misc.take()) return ok([]);
      const q = sec.str(d.q, 40).toLowerCase().replace(/^@/, '').trim();
      let list = Object.values(db.users).filter(u => u.id !== me.id && !blocked(u.id, me.id) && (!q || u.username.includes(q) || u.displayName.toLowerCase().includes(q)));
      list.sort((a, b) => (b.username.startsWith(q) - a.username.startsWith(q)) || b.createdAt - a.createdAt);
      return ok(list.slice(0, 20).map(u => pub(u, me.id)));
    }
    case 'add': {
      const name = sec.str(d.username, 30).toLowerCase().replace(/^@/, '').trim();
      const u = byName(name);
      if (!u || blocked(u.id, me.id)) return no(`No one with the username @${name} was found. Check the spelling and try again.`);
      if (u.id === me.id) return no('That is you. Add someone else by their username.');
      addContact(me.id, u.id); return ok(pub(u, me.id));
    }
    case 'remove': { db.contacts[me.id] = (db.contacts[me.id] || []).filter(x => x !== d.id); store.setContacts(me.id, db.contacts[me.id]); return ok(true); }
    case 'block': case 'unblock': {
      if (typeof d.id !== 'string' || !db.users[d.id] || d.id === me.id) return no('That person could not be found.');
      const l = (db.blocks[me.id] ||= []);
      if (d.t === 'block' && !l.includes(d.id)) l.push(d.id);
      if (d.t === 'unblock') db.blocks[me.id] = l.filter(x => x !== d.id);
      store.setBlocks(me.id, db.blocks[me.id]); return ok(db.blocks[me.id]);
    }
    case 'send': {
      if (!ws.sendB.take()) return no('You are sending messages too fast. Wait a moment.');
      const hr = limiter.hit('msg:' + me.id, 1200, 3600e3); if (!hr.ok) return no(`You have hit the hourly message limit. Try again in ${sec.wait(hr.retryAfter)}.`);
      const to = typeof d.to === 'string' && db.users[d.to];
      if (!to || to.id === me.id) return no('That person could not be found.');
      if (blocked(to.id, me.id) || blocked(me.id, to.id)) return no(blocked(me.id, to.id) ? 'You blocked this person. Unblock them to send messages.' : 'You cannot message this person.');
      const text = sec.str(d.text, 4000, { multiline: true });
      const atts = Array.isArray(d.attachments) ? d.attachments.slice(0, 10) : [];
      for (const a of atts) { const f = a && typeof a.id === 'string' && db.files[a.id]; if (!f || f.owner !== me.id || f.status !== 'ready') return no('One of the files did not finish uploading. Attach it again.'); }
      if (!text.trim() && !atts.length) return no('Messages cannot be empty.');
      const key = convoKey(me.id, to.id);
      if (!accepted(to.id, me.id)) {
        // Message request: limit how much a stranger can send before being accepted
        const since = (db.declined[to.id] || {})[me.id] || 0;
        const pending = (db.convos[key] || []).filter(x => x.from === me.id && x.ts > since).length;
        if (pending >= 5) return no(`Wait for @${to.username} to accept your message request before sending more.`);
      }
      const replyTo = typeof d.replyTo === 'string' && (db.convos[key] || []).some(m => m.id === d.replyTo) ? d.replyTo : null;
      const m = { id: sec.randomId(10), from: me.id, to: to.id, text, ts: Date.now(), reactions: {}, attachments: atts.map(a => ({ id: a.id, w: Number.isInteger(a.w) && a.w > 0 && a.w < 1e5 ? a.w : null, h: Number.isInteger(a.h) && a.h > 0 && a.h < 1e5 ? a.h : null })), replyTo };
      (db.convos[key] ||= []).push(m); indexFiles(m);
      store.saveMessage(m);
      // The sender adds the recipient. The recipient only adds the sender by accepting the message request.
      addContact(me.id, to.id);
      sendTo(to.id, { t: 'msg', msg: withFiles(m), user: pub(me, to.id) });
      sendTo(me.id, { t: 'msg', msg: withFiles(m), user: pub(to, me.id) });
      return ok({ id: m.id });
    }
    case 'edit': {
      if (!ws.sendB.take()) return no('You are editing too fast. Wait a moment.');
      const { m } = findMsg(me, d.peer, d.id); if (!m || m.from !== me.id) return no('You can only edit your own messages.');
      const text = sec.str(d.text, 4000, { multiline: true }); if (!text.trim() && !m.attachments.length) return no('Messages cannot be empty.');
      m.text = text; m.editedAt = Date.now(); store.saveMessage(m); deliver(m, 'msgUpdate'); return ok(true);
    }
    case 'delete': {
      const { list, i, m } = findMsg(me, d.peer, d.id); if (!m || m.from !== me.id) return no('You can only delete your own messages.');
      list.splice(i, 1); store.deleteMessage(m.id);
      for (const a of m.attachments || []) removeFile(a.id);
      const out = { t: 'msgDelete', id: m.id, from: m.from, to: m.to }; sendTo(m.from, out); sendTo(m.to, out); return ok(true);
    }
    case 'react': {
      if (!ws.sendB.take()) return no('You are reacting too fast. Wait a moment.');
      const emoji = typeof d.emoji === 'string' ? d.emoji : '';
      if (!(EMOJI_RE.test(emoji) && HAS_EMOJI.test(emoji)) && !/^:[a-z0-9_]{2,32}:$/.test(emoji)) return no('Reactions must be an emoji.');
      const { m } = findMsg(me, d.peer, d.id); if (!m) return no('That message no longer exists.');
      const arr = m.reactions[emoji] || [];
      if (!arr.length && Object.keys(m.reactions).length >= 20) return no('That message already has the most reactions it can hold.');
      const i = arr.indexOf(me.id); i >= 0 ? arr.splice(i, 1) : arr.push(me.id);
      if (arr.length) m.reactions[emoji] = arr; else delete m.reactions[emoji];
      store.saveMessage(m); deliver(m, 'msgUpdate'); return ok(true);
    }
    case 'typing': { if (typeof d.to === 'string' && db.users[d.to] && d.to !== me.id && accepted(d.to, me.id) && !blocked(d.to, me.id) && ws.misc.take()) sendTo(d.to, { t: 'typing', from: me.id }); return; }
    case 'accept': {
      const u = typeof d.id === 'string' && db.users[d.id]; if (!u || u.id === me.id) return no('That person could not be found.');
      addContact(me.id, u.id);
      if (db.declined[me.id]?.[u.id]) { delete db.declined[me.id][u.id]; store.setDeclined(me.id, db.declined[me.id]); }
      sendTo(u.id, { t: 'user', user: pub(me, u.id) }); // they can now see you online
      return ok(pub(u, me.id));
    }
    case 'read': {
      // Read markers are kept on the server so every device agrees on what you've already seen
      if (!ws.readB.take()) return;
      const marks = d.marks && typeof d.marks === 'object' && !Array.isArray(d.marks) ? d.marks : {};
      const mine = (db.reads[me.id] ||= {}), changed = {};
      for (const [peer, raw] of Object.entries(marks).slice(0, 200)) {
        const ts = Math.min(Math.floor(Number(raw)), Date.now());
        if (!Number.isFinite(ts) || ts <= 0 || !db.users[peer] || peer === me.id || !db.convos[convoKey(me.id, peer)]) continue;
        if (ts > (mine[peer] || 0)) { mine[peer] = ts; changed[peer] = ts; }
      }
      if (Object.keys(changed).length) {
        saveReadsSoon(me.id);
        for (const o of sockets.get(me.id) || []) if (o !== ws && o.readyState === 1 && o.authed) o.send(JSON.stringify({ t: 'read', marks: changed }));
      }
      return ok(true);
    }
    case 'decline': {
      const u = typeof d.id === 'string' && db.users[d.id]; if (!u) return no('That person could not be found.');
      (db.declined[me.id] ||= {})[u.id] = Date.now(); store.setDeclined(me.id, db.declined[me.id]);
      return ok(db.declined[me.id]);
    }
    case 'uploadStart': {
      if (!ws.misc.take()) return no('You are starting uploads too quickly. Wait a moment.');
      const size = d.size;
      if (!Number.isSafeInteger(size) || size < 0) return no('That file size is not valid.');
      if (size > MAX_FILE) return no(`Files can be up to ${fmtGB(MAX_FILE)} each.`);
      const pending = Object.values(db.files).filter(f => f.owner === me.id && f.status !== 'ready').length;
      if (pending >= 12) return no('You have too many uploads in progress. Wait for them to finish.');
      if (uploadedToday(me.id) + size > DAILY_UPLOAD) return no(`You have reached your upload allowance of ${fmtGB(DAILY_UPLOAD)} per day. Try again tomorrow.`);
      if (storageUsed() + size > STORAGE_LIMIT) return no('The server is out of file space right now. Ask the server owner to free some up.');
      const meta = { id: sec.randomId(16), owner: me.id, name: sec.safeFileName(d.name), size, type: sec.safeMime(d.type), status: 'pending', createdAt: Date.now() };
      db.files[meta.id] = meta; store.saveFile(meta);
      const target = await files.uploadTarget(meta);
      return ok({ id: meta.id, ...target });
    }
    case 'uploadDone': {
      const meta = typeof d.id === 'string' && db.files[d.id];
      if (!meta || meta.owner !== me.id) return no('That upload could not be found.');
      if (meta.status === 'ready') return ok({ id: meta.id });
      const actual = await files.size(meta.id);
      if (actual === null) return no('The upload did not finish. Try attaching the file again.');
      if (actual !== meta.size) { removeFile(meta.id); return no('The uploaded file did not match. Try attaching it again.'); }
      meta.status = 'ready'; store.saveFile(meta); return ok({ id: meta.id });
    }
    case 'fileUrls': {
      const ids = Array.isArray(d.ids) ? d.ids.filter(x => typeof x === 'string').slice(0, 100) : [];
      const out = {};
      for (const id of ids) {
        const meta = db.files[id]; if (!meta || meta.status !== 'ready') continue;
        // Only people in a conversation the file was sent in (or the uploader) can open it
        const refs = fileRefs.get(id);
        const allowed = meta.owner === me.id || (refs && [...refs].some(k => k.split(':').includes(me.id)));
        if (allowed) out[id] = await files.downloadUrl(meta);
      }
      return ok(out);
    }
    case 'logoutAll': {
      for (const [h, s] of Object.entries(db.sessions)) if (s.userId === me.id && h !== ws.sessionHash) delete db.sessions[h];
      store.deleteSessions(me.id, ws.sessionHash);
      for (const o of sockets.get(me.id) || []) if (o !== ws && o.sessionHash !== ws.sessionHash) o.close(4001, 'signed out');
      return ok(true);
    }
    case 'ice': { if (!ws.misc.take()) return no('Slow down a moment.'); return ok(await iceServers()); }
    case 'call:start': {
      const to = typeof d.to === 'string' && db.users[d.to];
      const kind = d.kind === 'video' ? 'video' : 'audio';
      if (!to || to.id === me.id) return no('That person could not be found.');
      if (!accepted(to.id, me.id) || !accepted(me.id, to.id)) return no('You can call people once you have both accepted each other.');
      if (blocked(to.id, me.id) || blocked(me.id, to.id)) return no('You cannot call this person.');
      const r = limiter.hit('call:' + me.id, 15, 10 * 60e3); if (!r.ok) return no(`You are starting calls too often. Try again in ${sec.wait(r.retryAfter)}.`);
      if (userCall.has(me.id)) return no('You are already in a call.');
      if (!online(to.id)) return no(`@${to.username} is not online right now. Calls only ring while the app is open.`);
      if (userCall.has(to.id)) return no(`@${to.username} is on another call.`);
      const call = { id: sec.randomId(12), a: me.id, b: to.id, kind, aSock: ws, bSock: null, startedAt: Date.now() };
      call.timer = setTimeout(() => endCall(call, 'missed'), RING_MS);
      calls.set(call.id, call); userCall.set(me.id, call.id); userCall.set(to.id, call.id);
      sendTo(to.id, { t: 'call:incoming', callId: call.id, from: me.id, kind, user: pub(me, to.id) });
      return ok({ callId: call.id });
    }
    case 'call:accept': {
      const call = calls.get(d.callId);
      if (!call || call.b !== me.id || call.bSock) return no('That call has already ended.');
      clearTimeout(call.timer); call.bSock = ws; call.answeredAt = Date.now();
      if (call.aSock.readyState === 1) call.aSock.send(JSON.stringify({ t: 'call:accepted', callId: call.id }));
      for (const o of sockets.get(me.id) || []) if (o !== ws && o.readyState === 1) o.send(JSON.stringify({ t: 'call:taken', callId: call.id })); // stop ringing elsewhere
      return ok(true);
    }
    case 'call:decline': { const call = calls.get(d.callId); if (call && call.b === me.id && !call.bSock) endCall(call, 'declined'); return ok(true); }
    case 'call:end': { const call = calls.get(d.callId); if (call && (call.a === me.id || call.b === me.id)) endCall(call, 'ended'); return ok(true); }
    case 'call:signal': {
      if (!ws.signal.take()) return;
      const call = calls.get(d.callId); if (!call) return;
      const data = d.data; if (!data || typeof data !== 'object' || JSON.stringify(data).length > 64 * 1024) return;
      const target = ws === call.aSock ? call.bSock : ws === call.bSock ? call.aSock : null;
      if (target && target.readyState === 1) target.send(JSON.stringify({ t: 'call:signal', callId: call.id, data }));
      return;
    }
    default: return no('Unknown request.');
  }
}

/* ---------------- housekeeping ---------------- */
function sweep() {
  const now = Date.now();
  for (const f of Object.values(db.files)) {
    if (f.status !== 'ready' && now - f.createdAt > 3 * 3600e3) removeFile(f.id);           // abandoned uploads
    else if (f.status === 'ready' && !fileRefs.has(f.id) && now - f.createdAt > 864e5) removeFile(f.id); // uploaded but never sent
  }
  for (const [h, s] of Object.entries(db.sessions)) if (s.expiresAt < now) { delete db.sessions[h]; store.deleteSession(h); }
}

/* ---------------- start ---------------- */
(async () => {
  try { db = await store.load(); }
  catch (e) { console.error('[fatal] Could not open the database:', e.message); process.exit(1); }
  for (const list of Object.values(db.convos)) for (const m of list) indexFiles(m);
  for (const f of Object.values(db.files)) if (f.status === 'uploading') f.status = 'pending';
  const corsOrigins = ANY_ORIGIN ? ['*'] : [...ORIGINS].filter(o => /^https?:/.test(o));
  if (files.kind === 's3') await files.setupCors(corsOrigins.length ? corsOrigins : ['*']);
  setInterval(sweep, 15 * 60e3).unref(); sweep();
  server.listen(PORT, () => {
    console.log(`Bastion Crossroads ${VERSION} running on port ${PORT}`);
    console.log(`  database: ${store.kind}${store.persistent ? '' : '  (NOT permanent here: set DATABASE_URL)'}`);
    console.log(`  files:    ${files.kind}${files.persistent ? '' : '  (NOT permanent here: set S3_BUCKET)'}`);
    console.log(`  sign-ups: ${INVITE ? 'invite code required' : 'open to anyone'}`);
  });
})();
async function shutdown() { console.log('Shutting down…'); server.close(); for (const ws of wss.clients) ws.close(1012, 'restarting'); flushReads(); await store.flush(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
process.on('unhandledRejection', e => console.error('[unhandled]', e?.message || e));
