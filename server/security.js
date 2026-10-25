/* Bastion Crossroads: security helpers
 * Password hashing, rate limiting, input cleaning, HTTP security headers, client IP.
 */
'use strict';
const crypto = require('crypto');

/* ---------------- passwords ----------------
 * scrypt (memory-hard), per-user random salt, constant-time compare.
 * Stored as: scrypt$N$r$p$saltHex$hashHex
 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };
function scrypt(pw, salt, o = SCRYPT) {
  return new Promise((res, rej) => crypto.scrypt(pw.normalize('NFKC'), salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: o.maxmem }, (e, k) => e ? rej(e) : res(k)));
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const k = await scrypt(pw, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${k.toString('hex')}`;
}
const DUMMY = 'scrypt$16384$8$1$' + '00'.repeat(16) + '$' + '00'.repeat(64);
/** Always does the same work whether or not the account exists (no user enumeration by timing). */
async function verifyPassword(pw, stored) {
  const [alg, N, r, p, saltHex, hashHex] = String(stored || DUMMY).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = await scrypt(pw, Buffer.from(saltHex, 'hex'), { N: +N, r: +r, p: +p, keylen: want.length, maxmem: SCRYPT.maxmem });
  return stored !== undefined && stored !== null && got.length === want.length && crypto.timingSafeEqual(got, want);
}
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', 'iloveyou', 'abc12345', 'letmein1', 'welcome1', 'admin123', 'football', 'baseball', 'sunshine', 'princess', 'dragon12', 'monkey12', 'trustno1', 'passw0rd', '11111111', '00000000', '87654321', 'superman', 'starwars', 'whatever', 'computer', 'michael1', 'charlie1', 'bastion1', 'crossroads', 'bastioncrossroads']);
function passwordProblem(pw, username) {
  if (typeof pw !== 'string') return 'Enter a password.';
  if (pw.length < 8) return 'Passwords need at least 8 characters.';
  if (pw.length > 128) return 'Passwords can be at most 128 characters.';
  const low = pw.toLowerCase();
  if (COMMON.has(low)) return 'That password is too common. Pick something harder to guess.';
  if (username && low.includes(username.toLowerCase())) return 'Your password cannot contain your username.';
  if (/^(.)\1+$/.test(pw)) return 'That password is too easy to guess.';
  return null;
}

/* ---------------- tokens ----------------
 * Clients hold a random 256-bit token. The server only stores its SHA-256,
 * so a leaked database cannot be used to sign in.
 */
const newToken = () => crypto.randomBytes(32).toString('base64url');
const tokenHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const randomId = (n = 12) => crypto.randomBytes(n).toString('hex');

/* ---------------- rate limiting ---------------- */
class Limiter {
  constructor() { this.m = new Map(); setInterval(() => { const now = Date.now(); for (const [k, e] of this.m) if (e.reset <= now) this.m.delete(k); }, 60e3).unref(); }
  /** Count one hit in a fixed window. Returns { ok, retryAfter (seconds) }. */
  hit(key, limit, windowMs) {
    const now = Date.now(); let e = this.m.get(key);
    if (!e || e.reset <= now) { e = { n: 0, reset: now + windowMs }; this.m.set(key, e); }
    e.n++;
    return { ok: e.n <= limit, retryAfter: Math.max(1, Math.ceil((e.reset - now) / 1000)) };
  }
  blocked(key, limit) { const e = this.m.get(key); return e && e.reset > Date.now() && e.n >= limit ? Math.ceil((e.reset - Date.now()) / 1000) : 0; }
  clear(key) { this.m.delete(key); }
  get size() { return this.m.size; }
}
/** Token bucket for per-connection flood control. */
class Bucket {
  constructor(rate, burst) { this.rate = rate; this.burst = burst; this.t = burst; this.last = Date.now(); }
  take(n = 1) { const now = Date.now(); this.t = Math.min(this.burst, this.t + (now - this.last) / 1000 * this.rate); this.last = now; if (this.t >= n) { this.t -= n; return true; } return false; }
}
const wait = s => s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`;

/* ---------------- input cleaning ---------------- */
// Strip control characters (keeps newline and tab), bidi overrides and zero-width tricks used for spoofing.
const BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
function str(v, max, { multiline = false } = {}) {
  if (typeof v !== 'string') return '';
  let s = v.replace(BAD, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  return s.slice(0, max);
}
const isColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
function isProfileImage(v, maxBytes) { return v === null || v === undefined || (typeof v === 'string' && v.length <= maxBytes * 1.37 && IMG_RE.test(v)); }
const USERNAME_RE = /^[a-z0-9_.]{2,24}$/;
const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'help', 'mod', 'moderator', 'staff', 'official', 'bastion', 'crossroads', 'bastioncrossroads', 'security', 'everyone', 'here', 'null', 'undefined', 'api', 'status', 'server', 'owner', 'team']);
function usernameProblem(u) {
  if (!USERNAME_RE.test(u)) return 'Usernames need 2–24 lowercase letters, numbers, dots or underscores.';
  if (/^\.|\.$|\.\./.test(u)) return 'Usernames cannot start or end with a dot, or have two dots in a row.';
  if (RESERVED.has(u)) return `@${u} is reserved. Pick another username.`;
  return null;
}
// File types that could run code if a browser opened them inline. These are always served as downloads.
const RISKY_TYPE = /html|xhtml|svg|xml|javascript|ecmascript|x-sh|x-msdownload|x-msdos|java-archive|vnd\.microsoft\.portable|x-executable|wasm|pdf/i;
const RISKY_EXT = /\.(html?|xhtml|svg|xml|js|mjs|exe|msi|bat|cmd|com|scr|ps1|vbs|jar|apk|sh|wasm|hta|lnk|pdf)$/i;
function safeFileName(n) {
  let s = String(n || 'file').replace(/[\\/]/g, '_').replace(BAD, '').replace(/[\r\n"]/g, '').trim();
  if (!s || s === '.' || s === '..') s = 'file';
  return s.slice(0, 180);
}
function safeMime(t) { t = String(t || '').toLowerCase().trim(); return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,100}$/.test(t) ? t : 'application/octet-stream'; }

/* ---------------- HTTP ---------------- */
function securityHeaders(res, { csp, hsts } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (csp) res.setHeader('Content-Security-Policy', csp);
}
/** The visitor's IP. Behind Render's proxy the real address is in forwarding headers. */
function clientIp(req, trustProxy) {
  if (trustProxy) {
    const cf = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'];
    if (typeof cf === 'string' && cf.length < 64) return cf.trim();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') { const first = xff.split(',')[0].trim(); if (first && first.length < 64) return first; }
  }
  return req.socket.remoteAddress || 'unknown';
}
function hmac(secret, data) { return crypto.createHmac('sha256', secret).update(data).digest('base64url'); }
function safeEqual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

module.exports = { hashPassword, verifyPassword, passwordProblem, newToken, tokenHash, randomId, Limiter, Bucket, wait, str, isColor, isProfileImage, usernameProblem, USERNAME_RE, RISKY_TYPE, RISKY_EXT, safeFileName, safeMime, securityHeaders, clientIp, hmac, safeEqual };
