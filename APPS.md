# Bastion Crossroads apps (Android + Windows)

Both apps open your live server, **https://bastion-crossroads.onrender.com**. Anything you change on the website (new features, emoji, themes) shows up in the apps automatically. You only need to rebuild the apps if the server address changes.

## Android (`bastion-crossroads.apk`)

**Install:** send the APK to your phone, tap it, and allow "Install unknown apps" for the app you opened it with (Files, Chrome, Discord…). Android will say it's from an unknown developer because it's not from the Play Store. That's expected.

- Works on Android 6 and newer.
- Calls: the first time you call, Android asks for Camera and Microphone. Tap Allow.
- Files you're sent are saved to your phone's **Downloads** folder.
- The back button closes the open chat, then leaves the app.

**Rebuilding** (Linux, needs `aapt zipalign apksigner dalvik-exchange android-sdk-platform-23` from apt):
1. To point at a different server, change `SERVER` at the top of `android-shell/src/com/bastioncrossroads/app/MainActivity.java`.
2. Raise `android:versionCode` (and `versionName`) in `android-shell/AndroidManifest.xml` for every new release, or phones won't accept it as an update.
3. Run `KS_PASS="$(cat android-shell/keystore/PASSWORD.txt)" android-shell/build.sh`.

### Keep the signing key safe
`android-shell/keystore/` holds the key that signs the app, plus its password. **Back it up somewhere private and never upload it to GitHub** (it's listed in `.gitignore`). Android only installs an update if it's signed with the same key, so if you lose it, people would have to uninstall and reinstall to get future versions.

## Windows (`Bastion-Crossroads-Setup-3.0.0.exe`)

**Install:** run the setup. No administrator access is needed; it installs to your user folder and adds Start Menu and Desktop shortcuts. Uninstall from **Settings → Apps** like any other program.

Windows SmartScreen will likely say **"Windows protected your PC"** the first few times, because the installer isn't code-signed (a signing certificate costs money each year). Click **More info → Run anyway**. Tell your friends to expect this.

- Calls, notifications, file downloads and spellcheck work.
- Links to other websites open in your normal browser.
- If the server is unreachable, the app shows a Try again screen and retries on its own.
- Ctrl+R reloads, Ctrl+plus/minus zooms.

**Rebuilding** (Linux): the app code is in `desktop-shell/` (`main.js`). To point at a different server, change `SERVER` at the top of `main.js`. The build steps are: unzip Electron for win32-x64, rename `electron.exe` to `Bastion Crossroads.exe`, delete `resources/default_app.asar`, copy `desktop-shell/{main.js,offline.html,package.json,icon.png}` into `resources/app/`, set the icon with `seticon.mjs`, then run `makensis desktop-shell/installer/installer.nsi`.
