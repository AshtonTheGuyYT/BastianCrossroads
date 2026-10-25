# Bastion Crossroads

One-on-one messaging. Add people by username, DM them, react, mention, share files of any type up to 1 GB.

## What's in the box

```
bastion-crossroads/
├── www/                      The app (this is what gets installed)
│   ├── index.html            Entire client: HTML, CSS and JS in one file
│   ├── manifest.webmanifest  Makes it installable (PWA)
│   ├── sw.js                 Service worker: opens offline, caches the app
│   └── icons/                App icons (any, maskable, Apple touch, SVG)
├── server/
│   ├── server.js             Real-time server: accounts, live DMs, uploads, status page
│   ├── security.js           Password hashing, rate limits, input cleaning, headers
│   ├── store.js              PostgreSQL (or local file) storage
│   ├── files.js              Cloud bucket (or local disk) file storage with signed links
│   ├── attack-test.js        Security self-test: node server/attack-test.js <your server>
│   └── public/               Status page (/status)
├── render.yaml               One-click Render setup
├── DEPLOY.md                 How to put it online for free
├── capacitor.config.json     Native Android / iOS wrapper config
└── package.json
```

## Putting it online for free

See **DEPLOY.md** for the step-by-step guide (Render + Neon + Backblaze B2), the status page, and the full list of security measures. Once online, set `DEFAULT_SERVER` near the top of the script in `www/index.html` so the phone and PC apps connect automatically.

## Two ways to run it

**Device mode (no server).** Open `www/index.html` from any web host. Everything is saved in the browser on that device, and a few demo neighbours (Wren, Juno, Theo…) are there so you can try every feature. Demo people reply and react on their own.

**Server mode (real people).** Requires Node 20 or newer.

```bash
npm install
npm start            # http://localhost:8787
```

Open that address, create an account, and have a friend do the same on their device. Add each other by username and chat live. When the page is served by the server it connects automatically. From anywhere else (or the native app), go to **Settings → Connection** and enter the server address.

All server settings are listed at the top of `server/server.js` and in DEPLOY.md. With no settings it stores everything in `server/data` on your computer.

For use over the internet, put the server behind HTTPS (e.g. Caddy or nginx with a certificate). Phones and app stores expect HTTPS.

## Turning it into an app

**Install as a web app (fastest):** open the server address on a phone, then *Add to Home Screen* (iOS Safari) or *Install app* (Android Chrome / desktop Chrome / Edge).

**Native Android / iOS with Capacitor:**

```bash
npm install
npm run cap:android   # opens Android Studio → Run / Build APK
npm run cap:ios       # macOS + Xcode only
```

After changing anything in `www/`, run `npm run cap:sync`.
`allowMixedContent` is enabled in `capacitor.config.json` so you can test against an `http://` server on your LAN; remove it once your server uses HTTPS.

## Features

- 1-on-1 conversations; search people and add them by `@username`
- Profile popup with Settings: display name, username, pronouns, bio, custom status, profile picture, banner image or color, profile color, status (online / idle / do not disturb / invisible)
- Emoji picker with search and recents, `:shortcode` suggestions while typing
- `@mentions` with autocomplete, highlighted messages, mention badges and a distinct chime
- Reactions (hover bar, picker, or press-and-hold on phones)
- Replies, edit (↑ for last message), delete, copy, typing indicator, unread badges
- Formatting: `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, code blocks, `||spoilers||`, links
- Files of any type, up to 1 GB each (images and video play inline), drag & drop and paste
- 14 themes: Bastion (default dark), Daybreak, Sweetheart, High Roller, Gold Vault, Neon Grid, Phosphor, Sunset Drive, Starfall, Abyss, Forge, Rubber Duck, Pizza Night, Cat Café
- Phones: the chat fills the screen; drag the whole chat to the right to close it and see your list (the back button / system back also works)
- Sound and system notifications, Do-not-disturb, export conversations

## Notes

- In device mode, files are stored in the browser's storage. Very large files depend on the free space the browser allows on that device; the app tells you if space runs out.
- Passwords are hashed with scrypt. Online, accounts and messages live in PostgreSQL and files in a private cloud bucket (see DEPLOY.md).
