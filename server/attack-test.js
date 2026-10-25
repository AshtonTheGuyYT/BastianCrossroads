/* Bastion Crossroads: security self-test.
 * Attacks a running server the way a bad actor would and checks each attack is refused.
 * Usage:  node server/attack-test.js http://localhost:8787
 * Only run this against a server you own. It creates throwaway accounts.
 */
'use strict';
const WebSocket = require('ws');
const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/+$/, '');
const WSURL = BASE.replace(/^http/, 'ws') + '/ws';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '  (' + extra + ')' : ''}`); };
const rnd = () => Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function post(path, body, headers = {}) { const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }); let j = {}; try { j = await r.json(); } catch {} return { status: r.status, j }; }
// Each test account gets its own fake IP so per-network sign-up limits don't interfere (server trusts the header in this test only)
async function account(prefix) { const u = prefix + rnd(); const r = await post('/api/register', { username: u, password: 'Very-Long-Pass-' + rnd() }, { 'x-forwarded-for': '10.9.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) }); return { ...r.j, username: u }; }
function connect(token, opts = {}) {
  return new Promise(res => {
    const ws = new WebSocket(WSURL, opts); const st = { ws, msgs: [], closed: null, rid: 0, wait: new Map() };
    ws.on('message', d => { const m = JSON.parse(d); st.msgs.push(m); if (m.t === 'res' && st.wait.has(m.rid)) { st.wait.get(m.rid)(m); st.wait.delete(m.rid); } if (m.t === 'hello') res(st); });
    ws.on('open', () => token !== undefined && ws.send(JSON.stringify({ t: 'auth', token })));
    ws.on('close', c => { st.closed = c; res(st); });
    ws.on('unexpected-response', (q, r) => { st.closed = r.statusCode; res(st); });
    ws.on('error', () => {});
    st.rpc = (t, data = {}) => new Promise(r => { const rid = ++st.rid; st.wait.set(rid, r); ws.send(JSON.stringify({ ...data, t, rid })); setTimeout(() => r({ ok: false, error: 'timeout' }), 8000); });
  });
}

(async () => {
  console.log('Attacking', BASE, '\n');
  // --- accounts & passwords
  let r = await post('/api/register', { username: 'weak' + rnd(), password: 'password1' }, { 'x-forwarded-for': '10.1.1.1' });
  check('common password refused', r.status === 400, r.j.error);
  r = await post('/api/register', { username: 'admin', password: 'Very-Long-Pass-1' }, { 'x-forwarded-for': '10.1.1.2' });
  check('reserved username "admin" refused', r.status === 400);
  r = await post('/api/register', { username: "x' OR 1=1--", password: 'Very-Long-Pass-1' }, { 'x-forwarded-for': '10.1.1.3' });
  check('SQL-injection username refused', r.status === 400);
  r = await post('/api/login', { username: "alice' OR '1'='1", password: "' OR '1'='1" });
  check('SQL injection login fails', r.status === 401 || r.status === 429);
  r = await post('/api/register', '{"username": "big", "password": "' + 'A'.repeat(200000) + '"}', { 'x-forwarded-for': '10.1.1.4' }).catch(() => ({ status: 'reset' }));
  check('oversized request body refused', r.status === 413 || r.status === 400, String(r.status));
  r = await post('/api/register', 'not json{{', { 'x-forwarded-for': '10.1.1.5' });
  check('malformed JSON refused', r.status === 400);

  // --- brute force
  const victim = await account('vic');
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await post('/api/login', { username: victim.username, password: 'guess' + i }, { 'x-forwarded-for': '10.2.0.' + i })).status);
  check('password guessing locked after 8 tries (even from different IPs)', codes.slice(0, 8).every(c => c === 401) && codes.slice(8).every(c => c === 429), codes.join(','));
  r = await post('/api/login', { username: 'nobody' + rnd(), password: 'whatever-123' });
  check('unknown user gets the same answer as wrong password', r.status === 401 && /do not match/.test(r.j.error));

  // --- sign-up spam
  const regCodes = [];
  for (let i = 0; i < 7; i++) regCodes.push((await post('/api/register', { username: 'spam' + rnd(), password: 'Very-Long-Pass-' + rnd() }, { 'x-forwarded-for': '10.3.3.3' })).status);
  check('mass sign-ups from one network blocked after 5', regCodes.slice(0, 5).every(c => c === 200) && regCodes.slice(5).every(c => c === 429), regCodes.join(','));

  // --- WebSocket authentication
  let s = await connect('not-a-real-token-1234567890');
  check('fake token rejected', s.closed === 4001);
  s = await connect(undefined); // never authenticates
  const t0 = Date.now(); while (!s.closed && Date.now() - t0 < 12000) await sleep(200);
  check('silent connection dropped after 10 s', s.closed === 4001);
  s = await connect(victim.token, { headers: { Origin: 'https://evil.example' } });
  check('connection from a foreign website refused', s.closed === 403);
  s = await new Promise(res => { const ws = new WebSocket(WSURL); ws.on('open', () => ws.send(JSON.stringify({ t: 'send', to: 'x', text: 'hi' }))); ws.on('close', c => res(c)); ws.on('error', () => {}); });
  check('commands before signing in are refused', s === 4001);

  // --- authorization between users
  const a = await account('ann'), b = await account('ben'), c = await account('cal');
  const A = await connect(a.token), B = await connect(b.token), C = await connect(c.token);
  check('three test users connected', !A.closed && !B.closed && !C.closed);
  const bId = B.msgs.find(m => m.t === 'hello').me.id, aId = A.msgs.find(m => m.t === 'hello').me.id;
  r = await A.rpc('send', { to: bId, text: 'private note for ben' }); await sleep(300);
  const msg = B.msgs.find(m => m.t === 'msg'); check('normal message delivered', !!msg);
  check('third person never receives it', !C.msgs.some(m => m.t === 'msg'));
  r = await C.rpc('edit', { peer: aId, id: msg.msg.id, text: 'hacked' }); check("cannot edit someone else's message", !r.ok);
  r = await B.rpc('delete', { peer: aId, id: msg.msg.id }); check("cannot delete someone else's message", !r.ok);
  r = await C.rpc('react', { peer: aId, id: msg.msg.id, emoji: '👍' }); check('cannot react in a conversation you are not in', !r.ok);
  r = await A.rpc('react', { peer: bId, id: msg.msg.id, emoji: '<script>' }); check('non-emoji reaction refused', !r.ok);
  r = await A.rpc('profile', { profile: { displayName: 'X', avatar: 'javascript:alert(1)' } }); check('script disguised as profile picture refused', !r.ok);
  r = await A.rpc('profile', { profile: { displayName: 'X', avatar: 'data:image/svg+xml;base64,PHN2Zz4=' } }); check('SVG profile picture refused', !r.ok);
  r = await A.rpc('profile', { profile: { displayName: 'Ann‮gnp.exe', bio: 'x'.repeat(5000) } });
  check('spoofing characters stripped and long bio trimmed', r.ok && !r.data.displayName.includes('‮') && r.data.bio.length <= 190);
  r = await A.rpc('send', { to: aId, text: 'self' }); check('cannot message yourself', !r.ok);
  r = await A.rpc('send', { to: bId, text: '' }); check('empty message refused', !r.ok);
  r = await A.rpc('send', { to: bId, text: 'x'.repeat(10000) }); await sleep(200);
  check('huge message trimmed to 4000 characters', r.ok && B.msgs.filter(m => m.t === 'msg').pop().msg.text.length === 4000);

  // --- files
  r = await A.rpc('uploadStart', { name: 'huge.iso', size: 1024 ** 3 + 1, type: 'application/octet-stream' }); check('file over 1 GB refused', !r.ok);
  r = await A.rpc('uploadStart', { name: 'neg', size: -5 }); check('negative file size refused', !r.ok);
  r = await A.rpc('uploadStart', { name: 'note.txt', size: 5, type: 'text/plain' });
  const up = r.data;
  check('upload link issued', r.ok && !!up?.url);
  const putUrl = /^https?:/.test(up.url) ? up.url : BASE + up.url;
  let pr = await fetch(putUrl, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'this is way more than five bytes' }).catch(() => ({ status: 0 }));
  const done1 = await A.rpc('uploadDone', { id: up.id });
  check('uploading more than declared is refused', pr.status >= 400 || !done1.ok, `bucket said ${pr.status}`);
  r = await A.rpc('uploadStart', { name: 'note.txt', size: 5, type: 'text/plain' });
  pr = await fetch(/^https?:/.test(r.data.url) ? r.data.url : BASE + r.data.url, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'hello' });
  const done2 = await A.rpc('uploadDone', { id: r.data.id });
  check('honest upload accepted', pr.status < 300 && done2.ok);
  const fid = r.data.id;
  r = await C.rpc('send', { to: bId, text: 'stolen', attachments: [{ id: fid }] }); check("cannot send someone else's uploaded file", !r.ok);
  await A.rpc('send', { to: bId, text: 'file', attachments: [{ id: fid }] }); await sleep(200);
  r = await B.rpc('fileUrls', { ids: [fid] }); check('recipient can open the file', !!r.data?.[fid]);
  r = await C.rpc('fileUrls', { ids: [fid] }); check('outsider cannot get a link to the file', r.ok && !r.data[fid]);
  const link = (await B.rpc('fileUrls', { ids: [fid] })).data[fid];
  const tampered = link.replace(/(Signature=|sig=)([A-Za-z0-9_-]{6})/, (m0, k, v) => k + (v[0] === 'a' ? 'b' : 'a') + v.slice(1));
  pr = await fetch(/^https?:/.test(tampered) ? tampered : BASE + tampered); check('tampered file link refused', pr.status === 403 || pr.status === 400, String(pr.status));

  // --- flooding
  const F = await connect(a.token); let refused = 0;
  const floods = []; for (let i = 0; i < 120; i++) floods.push(F.rpc('send', { to: bId, text: 'spam ' + i }).then(x => { if (!x.ok) refused++; }));
  await Promise.all(floods);
  check('message flood throttled', refused > 90, `${refused}/120 refused`);
  const pong = await fetch(BASE + '/api/ping'); check('server still healthy after the flood', pong.ok);
  s = await connect(a.token); check('a calm user can still connect', !s.closed);

  // --- HTTP surface
  for (const p of ['/..%2fserver%2fserver.js', '/%2e%2e/server/server.js', '/.env', '/../package.json', '/server/data/db.json']) { const x = await fetch(BASE + p); check(`path trick refused: ${p}`, x.status === 403 || x.status === 404 || x.status === 400, String(x.status)); }
  const h = await fetch(BASE + '/'); const hd = k => h.headers.get(k) || '';
  check('page has script lock (CSP)', /script-src 'self' 'sha256-/.test(hd('content-security-policy')));
  check('page cannot be framed (clickjacking)', hd('x-frame-options') === 'DENY' && /frame-ancestors 'none'/.test(hd('content-security-policy')));
  check('MIME sniffing disabled', hd('x-content-type-options') === 'nosniff');
  const ev = await fetch(BASE + '/api/ping', { headers: { origin: 'https://evil.example' } });
  check('foreign websites cannot call the API', ev.status === 403 && !ev.headers.get('access-control-allow-origin'));
  const st = await (await fetch(BASE + '/api/status')).json();
  check('status page exposes no names or secrets', !JSON.stringify(st).match(/username|token|pass|secret|@/i));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
