/* Bastion Crossroads for Windows (Electron).
 * Opens the Bastion Crossroads server in its own app window with safe defaults:
 * the page has no access to your computer beyond what a normal website gets,
 * only your own server may use the camera, microphone and notifications,
 * and links to other sites open in your regular browser.
 */
'use strict';
const { app, BrowserWindow, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const SERVER = process.env.BASTION_URL || 'https://bastion-crossroads.onrender.com/';
const ORIGIN = new URL(SERVER).origin;
const APP_ID = 'com.bastioncrossroads.app';
const ALLOWED = new Set(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'speaker-selection']);
const OFFLINE = path.join(__dirname, 'offline.html');

app.setAppUserModelId(APP_ID); // needed for Windows notifications
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
const sameOrigin = u => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const isWeb = u => /^https?:\/\//i.test(u);

function loadBounds() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; } }
function saveBounds() { if (!win || win.isDestroyed()) return; try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch {} }

/** Windows only shows notifications from apps whose Start Menu shortcut carries the app ID. */
function ensureShortcut() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Bastion Crossroads.lnk');
  try { shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'update' : 'create', { target: process.execPath, appUserModelId: APP_ID, icon: process.execPath, iconIndex: 0, description: 'Bastion Crossroads' }); } catch {}
}

function createWindow() {
  const b = loadBounds() || {};
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width || 1200, height: b.height || 800, minWidth: 380, minHeight: 520,
    title: 'Bastion Crossroads', backgroundColor: '#151A22', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: true }
  });
  if (b.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  ['resize', 'move', 'close'].forEach(ev => win.on(ev, saveBounds));
  win.on('closed', () => { win = null; });

  const wc = win.webContents;
  // New windows (target=_blank, file links): open in the regular browser instead
  wc.setWindowOpenHandler(({ url }) => { if (isWeb(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Never navigate the app window away from your server (except our own offline page)
  wc.on('will-navigate', (e, url) => {
    if (sameOrigin(url) || url.startsWith('file:') && url.includes('offline.html')) return;
    e.preventDefault(); if (isWeb(url)) shell.openExternal(url);
  });
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* aborted */ && sameOrigin(url)) win.loadFile(OFFLINE, { query: { server: SERVER } });
  });
  // Flash the taskbar when the unread count (in the page title) goes up while you're elsewhere
  let lastUnread = 0;
  wc.on('page-title-updated', (e, title) => {
    const n = +((/^\((\d+)\)/.exec(title) || [])[1] || 0);
    if (n > lastUnread && !win.isFocused()) win.flashFrame(true);
    lastUnread = n;
  });
  win.on('focus', () => win.flashFrame(false));
  // Keyboard: reload, zoom, devtools off in the installed app
  wc.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const mod = i.control || i.meta;
    if (i.key === 'F5' || (mod && i.key.toLowerCase() === 'r')) { e.preventDefault(); wc.reloadIgnoringCache(); }
    else if (mod && (i.key === '=' || i.key === '+')) { e.preventDefault(); wc.setZoomLevel(Math.min(wc.getZoomLevel() + .5, 4)); }
    else if (mod && i.key === '-') { e.preventDefault(); wc.setZoomLevel(Math.max(wc.getZoomLevel() - .5, -3)); }
    else if (mod && i.key === '0') { e.preventDefault(); wc.setZoomLevel(0); }
    else if (app.isPackaged && (i.key === 'F12' || (mod && i.shift && i.key.toLowerCase() === 'i'))) e.preventDefault();
  });
  // Right-click menu with spelling suggestions and copy/paste
  wc.on('context-menu', (e, p) => {
    const items = [];
    for (const s of (p.dictionarySuggestions || []).slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (p.misspelledWord) items.push({ label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: 'separator' });
    if (p.isEditable) items.push({ role: 'cut', enabled: p.editFlags.canCut }, { role: 'copy', enabled: p.editFlags.canCopy }, { role: 'paste', enabled: p.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll' });
    else if (p.selectionText) items.push({ role: 'copy' });
    if (p.linkURL && isWeb(p.linkURL)) items.push({ label: 'Copy link', click: () => require('electron').clipboard.writeText(p.linkURL) });
    if (p.mediaType === 'image' && p.srcURL) items.push({ label: 'Save image as…', click: () => wc.downloadURL(p.srcURL) });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  win.loadURL(SERVER);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureShortcut();
  const ses = session.defaultSession;
  // Camera/microphone (calls), notifications and copying: only for your own server
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(ALLOWED.has(perm) && sameOrigin(details.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((wc, perm, origin) => ALLOWED.has(perm) && (origin === ORIGIN || sameOrigin(origin)));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
// Block embedded <webview> tags and any extra windows outright
app.on('web-contents-created', (e, contents) => {
  contents.on('will-attach-webview', ev => ev.preventDefault());
});
