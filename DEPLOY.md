# Putting Bastion Crossroads online (free)

This puts the server on the internet so phones and PCs anywhere can use it. It takes about 30–45 minutes the first time. You need three free accounts:

| Service | What it does for you | Free allowance |
|---|---|---|
| **Render** | Runs the server, hosts the website and the status page | 750 hours a month (enough for one server all month) |
| **Neon** | Keeps accounts and messages (PostgreSQL database) | 1 GB of data |
| **Backblaze B2** | Keeps uploaded files | 10 GB stored |

Why three? Render's free server **erases its own disk** whenever it restarts or falls asleep. If accounts, messages and files lived there, they would vanish. Neon and Backblaze keep them safe permanently.

You'll end up with:
- `https://YOUR-NAME.onrender.com`: the website (people can chat right in the browser or install it)
- `https://YOUR-NAME.onrender.com/status`: the status page
- The same address as the "server" your phone/PC app connects to

---

## Step 1: Put the project on GitHub

Render deploys from GitHub.

1. Create a free account at **github.com** if you don't have one.
2. Click **New repository**. Name it `bastion-crossroads`. Choose **Private**. Click **Create repository**.
3. Click **uploading an existing file**, then drag in everything inside the `bastion-crossroads` folder **except** `node_modules` and `server/data` if they exist.
4. Click **Commit changes**.

## Step 2: Create the database (Neon)

1. Sign up at **neon.com**.
2. Create a project. Pick the region closest to you (Render lets you pick a region too; matching them makes the app faster).
3. On the project dashboard, click **Connect** and copy the **connection string**. It looks like
   `postgresql://user:password@ep-something.region.aws.neon.tech/neondb?sslmode=require`
4. Keep it somewhere private. This is your `DATABASE_URL`.

The server creates its own tables the first time it starts. You don't need to run anything.

## Step 3: Create the file bucket (Backblaze B2)

1. Sign up at **backblaze.com** for **B2 Cloud Storage**.
2. Go to **Buckets → Create a Bucket**.
   - Name: something unique, e.g. `bastion-files-ashton`
   - Files in bucket: **Private** (important)
   - Create it.
3. On the bucket card, note the **Endpoint**, e.g. `s3.us-east-005.backblazeb2.com`.
   - Your `S3_ENDPOINT` is that with `https://` in front: `https://s3.us-east-005.backblazeb2.com`
   - Your `S3_REGION` is the middle part: `us-east-005`
4. Go to **Application Keys → Add a New Application Key**.
   - Name: `bastion-server`
   - Allow access to bucket: **only the bucket you just made**
   - Type of access: **Read and Write**
   - Create it. Copy the **keyID** and **applicationKey** right away (the second one is shown only once).
   - `keyID` → `S3_ACCESS_KEY_ID`, `applicationKey` → `S3_SECRET_ACCESS_KEY`

The server sets the bucket's upload rules (CORS) by itself when it starts. If the Render log says it could not, open the bucket's **CORS Rules**, choose to share with **specific origins**, enter your Render address, and apply it to the **S3 Compatible API**.

## Step 4: Start the server (Render)

1. Sign up at **render.com** (signing in with GitHub is easiest).
2. Click **New → Blueprint**, pick your `bastion-crossroads` repository. Render reads `render.yaml` and sets almost everything up.
3. It asks for these values. Paste what you collected:

   | Setting | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string |
   | `S3_ENDPOINT` | e.g. `https://s3.us-east-005.backblazeb2.com` |
   | `S3_REGION` | e.g. `us-east-005` |
   | `S3_BUCKET` | your bucket name |
   | `S3_ACCESS_KEY_ID` | B2 keyID |
   | `S3_SECRET_ACCESS_KEY` | B2 applicationKey |
   | `REGISTRATION_CODE` | optional, see "Make it private" below. Leave empty for open sign-ups. |
   | `ALLOWED_ORIGINS` | leave empty unless you host the website somewhere else |

   `TOKEN_SECRET` is generated for you.
4. Click **Apply**. The first build takes a few minutes.
5. Open `https://YOUR-NAME.onrender.com/status`. You want to see **Online and working** with two green **Permanent** tags. If it says data is not permanent, a database or bucket setting is missing or mistyped; check **Environment** in Render and the **Logs** tab.

Create your account at `https://YOUR-NAME.onrender.com`. Done: anyone can now use it in a browser.

## Step 5: Point the apps at your server

Open `www/index.html` and find this line near the top of the script:

```js
const DEFAULT_SERVER = '';
```

Change it to your address:

```js
const DEFAULT_SERVER = 'https://YOUR-NAME.onrender.com';
```

Save, and upload the changed file to GitHub (Render redeploys automatically).

- **Phones (Android/iOS app):** build with Capacitor as in the README (`npm run cap:android`). The app opens straight to your server's sign-in.
- **PC:** open your Render address in Chrome or Edge and click **Install** in the address bar. It becomes a desktop app with its own window and icon.
- **Phones without the app store:** open your Render address and use **Add to Home Screen** (iPhone) or **Install app** (Android).

---

## Make it private (recommended at first)

Set `REGISTRATION_CODE` in Render to a phrase only your friends know (Render → your service → **Environment**). New sign-ups must type it. Existing accounts aren't affected. Change it anytime.

## Things to know about the free plan

- **Sleeping:** when nobody has used it for 15 minutes, Render puts the server to sleep. The next person to open the app waits up to about a minute while it wakes; the app shows a "Waking up the server" notice and connects by itself. Open chats keep it awake.
  - Want it always awake? A free uptime monitor (for example UptimeRobot or cron-job.org) visiting `https://YOUR-NAME.onrender.com/healthz` every 10 minutes keeps it up. One server running all month fits inside the 750 free hours.
- **Storage cap:** the server stops accepting uploads at **9.5 GB** total so you never go past B2's free 10 GB. Each person can upload up to **3 GB per day**. Change these with `STORAGE_LIMIT_BYTES` and `UPLOAD_DAILY_BYTES`.
- **Downloads:** B2 lets downloads total about 3× what you store each month for free. Lots of people re-watching big videos is what would use that up.
- **Database:** Neon's free 1 GB holds a very large amount of text chat. Profile pictures are the biggest thing in it.
- **Neon naps too:** the database sleeps after a few idle minutes and wakes when the server needs it, usually quickly enough that you won't notice.

## Security built in

What's protecting the server, and what each item stops:

**Accounts**
- Passwords are hashed with scrypt (slow on purpose, so a stolen database can't be cracked quickly). At least 8 characters, common passwords and passwords containing the username are refused.
- Password guessing is locked out for 15 minutes after 8 wrong tries on an account, no matter how many networks the guesses come from, and after 30 failures from one network.
- Sign-in answers are identical for "no such user" and "wrong password", so nobody can find out who has an account.
- Sign-ups are limited to 5 per network per hour and 60 server-wide per hour (stops bot account floods). Optional invite code.
- Reserved names like `admin`, `support` and `bastion` can't be taken (stops impersonation).

**Sign-in sessions**
- Session keys are 256-bit random. The database only stores a fingerprint (hash) of each key, so a leaked database can't be used to sign in.
- Keys are sent inside the encrypted connection after it opens, never in a web address (addresses end up in logs).
- Sign-ins expire after 30 days unused. **Sign out of all other devices** in Settings → Connection kills every other session instantly.

**Messages and people**
- People only ever receive messages from conversations they're in. Editing, deleting and reacting are checked on the server for every request.
- Blocking: a blocked person can't message you, find you in search, or see you typing.
- Every message, name, bio and status is length-limited and cleaned of invisible text-direction tricks used for spoofing (like `photo‮gnp.exe`).
- The app shows everything as plain text, and the page carries a strict script policy (CSP) locked to the app's own code by its exact fingerprint, so even if a trick slipped through, injected scripts would not run.

**Files**
- The bucket is private. Files are reachable only through signed links that expire, handed out only to the two people in the conversation.
- Upload links are signed for the exact file size and type: the bucket rejects anything bigger. The server double-checks the size afterward and deletes mismatches.
- Web pages, scripts, programs and similar files are always delivered as downloads, never opened in the browser.
- 1 GB per file, per-person daily allowance, total storage cap, abandoned uploads cleaned up automatically.

**Flooding and abuse**
- Per-connection speed limits on messages, reactions, typing, searches and profile changes. A flooder gets "slow down" and is disconnected if they keep going; everyone else is unaffected.
- Caps on connections per network, per account and server-wide; silent connections are dropped after 10 seconds; oversized and malformed requests are refused; slow-drip ("slowloris") requests time out.

**The website**
- Security headers: no framing (stops clickjacking), no MIME sniffing, no referrer leaks, HTTPS-only (HSTS) on Render, camera/mic/location blocked.
- Other websites can't use your server's API or connect to its chat (origin checks). Your own site, the Android/iOS app and installed PC app are allowed.
- Database queries use parameters everywhere (no SQL injection). File paths are locked to the website folder (no path tricks).
- The status page shows only totals, never names or secrets.

**Test it yourself.** From the project folder on your computer (after `npm install`), run this against **your own** server:

```bash
node server/attack-test.js https://YOUR-NAME.onrender.com
```

It tries about 48 attacks (fake logins, password guessing, sign-up spam, stealing files, editing other people's messages, flooding, path tricks and more) and reports which were refused. It creates a few throwaway test accounts. Note: Render's network limits apply to your own address during the test, so run it once, not over and over.

### What no setup can promise

No server is impossible to attack. These measures stop the common attacks (stolen or guessed passwords, spam, snooping on other people's chats, file tricks, floods from one attacker). What a free server **can't** survive is a large distributed attack (a botnet sending huge traffic from thousands of addresses). That would make it slow or knock it offline for a while; it wouldn't expose anyone's messages. If that ever becomes a real worry, putting a service like Cloudflare in front of your own domain is the next step.

Good habits that matter more than any setting: keep the keys and connection strings in this guide secret (never put them in GitHub files), use the invite code while it's just friends, and update the `ws`, `pg` and AWS packages now and then (`npm update`, then push).

## Troubleshooting

| What you see | What to do |
|---|---|
| Status page says data is **not permanent** | A `DATABASE_URL` or `S3_*` value is missing. Render → Environment → fix → **Save** (it redeploys). |
| Build fails | Render → Logs. Most often a file didn't get uploaded to GitHub. `package.json` and `package-lock.json` must be in the top folder. |
| "Could not open the database" in Logs | The Neon string is wrong or incomplete. Copy it again from Neon → Connect. |
| Images or files don't upload | Logs mention CORS → set the bucket CORS rule as described in Step 3. Or a B2 key typo. |
| App says "This site is not allowed to use this server" | You're hosting the website somewhere other than Render. Add that site's address to `ALLOWED_ORIGINS`. |
| Takes a minute to open | The free server was asleep. Normal; see "Sleeping" above. |
