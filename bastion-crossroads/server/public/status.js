'use strict';
const $ = id => document.getElementById(id);
const n = v => Number(v).toLocaleString();
function size(b) { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return (i ? b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i]; }
function dur(s) { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; }
function row(k, v, good) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; if (good !== undefined) { const t = document.createElement('span'); t.className = 'tag ' + (good ? 'good' : 'bad'); t.textContent = good ? 'Permanent' : 'Wiped on restart'; dd.append(t); } return [dt, dd]; }
async function check() {
  const b = $('banner');
  try {
    const r = await fetch('/api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const s = await r.json();
    const permanent = s.database.permanent && s.storage.permanent;
    b.dataset.state = permanent ? 'ok' : 'warn';
    $('headline').textContent = permanent ? 'Online and working' : 'Online, but data is not permanent';
    $('detail').textContent = permanent ? 'Messages, accounts and files are being saved.' : 'This server forgets everything when it restarts. Connect a database and file bucket (see DEPLOY.md).';
    $('uptime').textContent = dur(s.uptimeSec); $('online').textContent = n(s.onlineNow); $('people').textContent = n(s.people); $('messages').textContent = n(s.messages);
    const pct = s.storage.limit ? Math.min(100, s.storage.used / s.storage.limit * 100) : 0;
    $('barFill').style.width = pct.toFixed(1) + '%';
    $('bar').setAttribute('aria-valuenow', pct.toFixed(0)); $('bar').setAttribute('aria-valuemin', '0'); $('bar').setAttribute('aria-valuemax', '100');
    $('storageText').textContent = `${size(s.storage.used)} used of ${size(s.storage.limit)}. Files can be up to ${size(s.maxFile)} each.`;
    const dl = $('setup'); dl.replaceChildren(
      ...row('Accounts and messages', s.database.kind === 'postgres' ? 'PostgreSQL database' : 'File on the server', s.database.permanent),
      ...row('Files', s.storage.kind === 's3' ? 'Cloud bucket' : 'Server disk', s.storage.permanent),
      ...row('New accounts', s.registration === 'open' ? 'Anyone can sign up' : 'Invite code required'),
      ...row('Calls', s.calls?.relay ? 'Relay connected (works on every network)' : 'Direct only (add a relay, see DEPLOY.md)'),
      ...row('Hosted on', s.host), ...row('Version', s.version));
  } catch {
    b.dataset.state = 'down';
    $('headline').textContent = 'Not responding';
    $('detail').textContent = 'The server may be waking up (free servers sleep when idle). This page checks again automatically.';
  }
  $('checked').textContent = 'Checked ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
check(); setInterval(check, 15000);
