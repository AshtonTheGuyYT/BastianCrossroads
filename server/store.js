/* Bastion Crossroads: data storage
 * Data is kept in memory for speed and written through to permanent storage:
 *   - PgStore   : any PostgreSQL database (Neon, Supabase, Render, your own). Used when DATABASE_URL is set.
 *   - JsonStore : a JSON file on disk. Fine on your own computer; NOT permanent on Render's free plan.
 * All SQL uses parameters ($1, $2...), never string building, so input cannot inject SQL.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MSG_KEEP_PER_CONVO = 5000; // older messages stay in the database; the in-memory window holds the newest

function emptyDb() { return { users: {}, sessions: {}, contacts: {}, blocks: {}, declined: {}, reads: {}, convos: {}, files: {} }; }
const convoKey = (a, b) => [a, b].sort().join(':');

class JsonStore {
  constructor(dir) { this.kind = 'file'; this.persistent = !process.env.RENDER; this.file = path.join(dir, 'db.json'); fs.mkdirSync(dir, { recursive: true }); }
  async load() {
    let db = emptyDb();
    try { db = { ...db, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch {}
    this.db = db; return db;
  }
  _save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      const tmp = this.file + '.tmp';
      fs.writeFile(tmp, JSON.stringify(this.db), { mode: 0o600 }, e => e ? console.error('[store] save failed:', e.message) : fs.rename(tmp, this.file, () => {}));
    }, 250);
  }
  saveUser() { this._save(); } saveSession() { this._save(); } deleteSession() { this._save(); } deleteSessions() { this._save(); }
  setContacts() { this._save(); } setBlocks() { this._save(); } setDeclined() { this._save(); } setReads() { this._save(); } saveMessage() { this._save(); } deleteMessage() { this._save(); }
  saveFile() { this._save(); } deleteFile() { this._save(); }
  async flush() { clearTimeout(this.t); fs.writeFileSync(this.file, JSON.stringify(this.db), { mode: 0o600 }); }
}

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    this.kind = 'postgres'; this.persistent = true;
    this.pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000, ssl: local ? false : { rejectUnauthorized: true }, statement_timeout: 20000 });
    this.pool.on('error', e => console.error('[db] idle client error:', e.message));
    this.q = Promise.resolve();
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, data JSONB NOT NULL, pass TEXT NOT NULL, created_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, last_seen BIGINT NOT NULL, ip TEXT);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS contacts (owner TEXT NOT NULL, list JSONB NOT NULL, PRIMARY KEY (owner));
      CREATE TABLE IF NOT EXISTS blocks (owner TEXT NOT NULL, list JSONB NOT NULL, PRIMARY KEY (owner));
      CREATE TABLE IF NOT EXISTS declined (owner TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (owner));
      CREATE TABLE IF NOT EXISTS reads (owner TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (owner));
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, convo TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, body TEXT NOT NULL, ts BIGINT NOT NULL, edited_at BIGINT, reply_to TEXT, reactions JSONB NOT NULL DEFAULT '{}', attachments JSONB NOT NULL DEFAULT '[]');
      CREATE INDEX IF NOT EXISTS messages_convo_ts ON messages(convo, ts);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB;
      CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data JSONB NOT NULL, created_at BIGINT NOT NULL);
    `);
  }
  async load() {
    await this.init();
    const db = emptyDb();
    for (const r of (await this.pool.query('SELECT id, username, data, pass, created_at FROM users')).rows) db.users[r.id] = { ...r.data, id: r.id, username: r.username, pass: r.pass, createdAt: +r.created_at };
    await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
    for (const r of (await this.pool.query('SELECT * FROM sessions')).rows) db.sessions[r.token_hash] = { userId: r.user_id, createdAt: +r.created_at, expiresAt: +r.expires_at, lastSeen: +r.last_seen };
    for (const r of (await this.pool.query('SELECT owner, list FROM contacts')).rows) db.contacts[r.owner] = r.list;
    for (const r of (await this.pool.query('SELECT owner, list FROM blocks')).rows) db.blocks[r.owner] = r.list;
    for (const r of (await this.pool.query('SELECT owner, data FROM declined')).rows) db.declined[r.owner] = r.data;
    for (const r of (await this.pool.query('SELECT owner, data FROM reads')).rows) db.reads[r.owner] = r.data;
    const msgs = await this.pool.query(`SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY convo ORDER BY ts DESC) rn FROM messages) x WHERE rn <= $1 ORDER BY ts ASC`, [MSG_KEEP_PER_CONVO]);
    for (const r of msgs.rows) (db.convos[r.convo] ||= []).push({ id: r.id, from: r.sender, to: r.recipient, text: r.body, ts: +r.ts, editedAt: r.edited_at ? +r.edited_at : undefined, replyTo: r.reply_to, reactions: r.reactions || {}, attachments: r.attachments || [], ...(r.meta ? { call: r.meta.call } : {}) });
    for (const r of (await this.pool.query('SELECT id, data FROM files')).rows) db.files[r.id] = { ...r.data, id: r.id };
    this.db = db; return db;
  }
  /** Writes are queued in order so a quick edit can never land before the message it edits. */
  _run(sql, args) {
    this.q = this.q.then(() => this.pool.query(sql, args)).catch(e => console.error('[db] write failed:', e.message));
    return this.q;
  }
  saveUser(u) { const { id, username, pass, createdAt, ...data } = u; return this._run('INSERT INTO users (id, username, data, pass, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET username=$2, data=$3, pass=$4', [id, username, data, pass, createdAt]); }
  saveSession(h, s) { return this._run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (token_hash) DO UPDATE SET expires_at=$4, last_seen=$5', [h, s.userId, s.createdAt, s.expiresAt, s.lastSeen]); }
  deleteSession(h) { return this._run('DELETE FROM sessions WHERE token_hash=$1', [h]); }
  deleteSessions(userId, exceptHash) { return this._run('DELETE FROM sessions WHERE user_id=$1 AND token_hash <> $2', [userId, exceptHash || '']); }
  setContacts(owner, list) { return this._run('INSERT INTO contacts (owner, list) VALUES ($1,$2) ON CONFLICT (owner) DO UPDATE SET list=$2', [owner, JSON.stringify(list)]); }
  setDeclined(owner, data) { return this._run('INSERT INTO declined (owner, data) VALUES ($1,$2) ON CONFLICT (owner) DO UPDATE SET data=$2', [owner, JSON.stringify(data || {})]); }
  setReads(owner, data) { return this._run('INSERT INTO reads (owner, data) VALUES ($1,$2) ON CONFLICT (owner) DO UPDATE SET data=$2', [owner, JSON.stringify(data || {})]); }
  setBlocks(owner, list) { return this._run('INSERT INTO blocks (owner, list) VALUES ($1,$2) ON CONFLICT (owner) DO UPDATE SET list=$2', [owner, JSON.stringify(list)]); }
  saveMessage(m) { return this._run(`INSERT INTO messages (id, convo, sender, recipient, body, ts, edited_at, reply_to, reactions, attachments, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET body=$5, edited_at=$7, reactions=$9, attachments=$10, meta=$11`, [m.id, convoKey(m.from, m.to), m.from, m.to, m.text, m.ts, m.editedAt || null, m.replyTo || null, JSON.stringify(m.reactions || {}), JSON.stringify(m.attachments || []), m.call ? JSON.stringify({ call: m.call }) : null]); }
  deleteMessage(id) { return this._run('DELETE FROM messages WHERE id=$1', [id]); }
  saveFile(f) { const { id, owner, createdAt, ...rest } = f; return this._run('INSERT INTO files (id, owner, data, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET data=$3', [id, owner, { owner, createdAt, ...rest }, createdAt]); }
  deleteFile(id) { return this._run('DELETE FROM files WHERE id=$1', [id]); }
  async flush() { await this.q; await this.pool.end().catch(() => {}); }
}

function createStore(dataDir) {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  return new JsonStore(dataDir);
}
module.exports = { createStore, convoKey };
