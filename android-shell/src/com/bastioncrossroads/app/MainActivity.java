package com.bastioncrossroads.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bastion Crossroads for Android.
 * A full-screen WebView showing the Bastion Crossroads server, plus the native
 * pieces a web page can't do on its own: camera/microphone for calls, the file
 * picker for attachments, downloads, the back button, and an offline screen.
 */
public class MainActivity extends Activity {
    /** The server the app opens. Change this and rebuild if your server moves. */
    static final String SERVER = "https://bastion-crossroads.onrender.com/";
    static final String HOST = Uri.parse(SERVER).getHost();

    private static final int REQ_FILES = 1001;
    private static final int REQ_MEDIA_PERMS = 1002;
    private static final int REQ_STORAGE = 1003;
    private static final int REQ_PICK = 1004;
    private static final int REQ_MEDIA = 1005;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingWebPermission;
    private String[] pendingDownload; // url, contentDisposition, mimeType
    private boolean showingOffline = false;
    private NativeMedia media;
    private boolean pickBusy = false;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.parseColor("#1B212B"));
        w.setNavigationBarColor(Color.parseColor("#151A22"));
        w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        media = new NativeMedia(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#151A22"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);  // so call audio/video starts playing
        s.setAllowFileAccess(false);                     // the page never needs the phone's file system directly
        s.setAllowContentAccess(true);                   // needed for picked attachments
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " BastionCrossroadsApp/3.3 Android");
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "BastionNative");
        web.setWebViewClient(new WebViewClient() {
            // The picker's thumbnails and chosen files are served from the app itself (never the network)
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/__native/")) return nativeResponse(u);
                return null;
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openOutside(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (url != null && url.startsWith("http")) showingOffline = false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int code, String desc, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith(SERVER)) showOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // Calls: the page asks for camera/microphone; ask Android first, then grant to our own site only
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        Uri origin = request.getOrigin();
                        if (origin == null || !HOST.equals(origin.getHost())) { request.deny(); return; }
                        List<String> needed = new ArrayList<String>();
                        for (String r : request.getResources()) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && !has(Manifest.permission.CAMERA)) needed.add(Manifest.permission.CAMERA);
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && !has(Manifest.permission.RECORD_AUDIO)) needed.add(Manifest.permission.RECORD_AUDIO);
                        }
                        if (needed.isEmpty()) { grantWeb(request); return; }
                        pendingWebPermission = request;
                        requestPermissions(needed.toArray(new String[0]), REQ_MEDIA_PERMS);
                    }
                });
            }

            // Attachments: open Android's file picker (any type, several at once)
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                // Respect the page's accept="" (e.g. images only for a profile picture)
                List<String> types = new ArrayList<String>();
                String[] acc = params.getAcceptTypes();
                if (acc != null) for (String a : acc) {
                    for (String t : a.split(",")) {
                        t = t.trim().toLowerCase(java.util.Locale.ROOT);
                        if (t.isEmpty()) continue;
                        if (t.startsWith(".")) { String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(t.substring(1)); if (m != null) types.add(m); }
                        else if (t.contains("/")) types.add(t);
                    }
                }
                if (types.size() == 1) pick.setType(types.get(0));
                else { pick.setType("*/*"); if (types.size() > 1) pick.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0])); }
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(Intent.createChooser(pick, "Attach files"), REQ_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("No file picker app is available.");
                    return false;
                }
                return true;
            }
        });

        // Downloads (files people send you) go to the phone's Downloads folder
        web.setDownloadListener(new DownloadListener() {
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long length) {
                if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
                    toast("That file can't be downloaded in the app. Open Bastion Crossroads in your browser to save it.");
                    return;
                }
                downloadNamed(url, URLUtil.guessFileName(url, contentDisposition, mimeType), mimeType);
            }
        });

        cleanPicked(0);
        if (saved != null) web.restoreState(saved);
        else web.loadUrl(SERVER);
    }

    /** Links to other websites open in the phone's browser; our own pages stay in the app. */
    private boolean openOutside(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if ("file".equals(scheme) && showingOffline) return false;
        if (("https".equals(scheme) || "http".equals(scheme)) && HOST.equals(uri.getHost())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            toast("No app can open that link.");
        }
        return true;
    }

    private void showOffline() {
        if (showingOffline) return;
        showingOffline = true;
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>"
            + "body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#151A22;color:#ECE6D8;font:16px system-ui,sans-serif;text-align:center}"
            + "div{padding:28px;max-width:340px}h1{font-size:22px;margin:16px 0 8px}p{color:#97A1AE;margin:0 0 22px;line-height:1.45}"
            + "a{display:inline-block;background:#E9B44C;color:#1D1404;font-weight:700;padding:13px 26px;border-radius:12px;text-decoration:none}"
            + "svg{width:56px;height:62px}</style></head><body><div>"
            + "<svg viewBox='0 0 64 72'><path fill='#E9B44C' d='M6 4h10v6h7V4h7v6h4V4h7v6h7V4h10v32c0 16-11.5 27-26 32C17.5 63 6 52 6 36z'/><path fill='#151A22' d='M28 14h8v50.5l-4 1.7-4-1.7zM11 30h42v8H11z'/></svg>"
            + "<h1>Can't reach Bastion Crossroads</h1><p>Check your internet connection. If the server was asleep, it can take up to a minute to wake up.</p>"
            + "<a href='" + SERVER + "'>Try again</a></div></body></html>";
        web.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "utf-8", null);
    }

    private void downloadNamed(String url, String name, String mimeType) {
        if (Build.VERSION.SDK_INT < 29 && !has(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            pendingDownload = new String[] { url, name, mimeType };
            requestPermissions(new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, REQ_STORAGE);
            return;
        }
        try {
            if (name == null || name.trim().isEmpty()) name = "download";
            name = name.replaceAll("[\\\\/]", "_");
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setMimeType(mimeType);
            r.setTitle(name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
            toast("Downloading " + name);
        } catch (Exception e) {
            toast("The download couldn't start.");
        }
    }

    private boolean has(String perm) {
        return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    private void grantWeb(PermissionRequest request) {
        List<String> ok = new ArrayList<String>();
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(Manifest.permission.CAMERA)) ok.add(r);
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(Manifest.permission.RECORD_AUDIO)) ok.add(r);
        }
        if (ok.isEmpty()) request.deny(); else request.grant(ok.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_MEDIA_PERMS && pendingWebPermission != null) {
            PermissionRequest r = pendingWebPermission;
            pendingWebPermission = null;
            grantWeb(r);
            boolean anyDenied = false;
            for (int g : results) if (g != PackageManager.PERMISSION_GRANTED) anyDenied = true;
            if (anyDenied) explainDenied();
        } else if (code == REQ_MEDIA) {
            js("perm", mediaState());
        } else if (code == REQ_STORAGE && pendingDownload != null) {
            String[] d = pendingDownload;
            pendingDownload = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) downloadNamed(d[0], d[1], d[2]);
            else toast("Allow storage access to save files.");
        }
    }

    private void explainDenied() {
        new AlertDialog.Builder(this)
            .setTitle("Microphone and camera needed")
            .setMessage("For calls and voice messages, allow Camera and Microphone for Bastion Crossroads in your phone's Settings > Apps.")
            .setPositiveButton("Open settings", new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface d, int which) {
                    Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                    try { startActivity(i); } catch (Exception ignored) { }
                }
            })
            .setNegativeButton("Not now", null)
            .show();
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILES) {
            if (fileCallback == null) return;
            final List<Uri> src = new ArrayList<Uri>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    for (int i = 0; i < n; i++) src.add(data.getClipData().getItemAt(i).getUri());
                } else if (data.getData() != null) {
                    src.add(data.getData());
                }
            }
            if (src.isEmpty()) { fileCallback.onReceiveValue(null); fileCallback = null; return; }
            final ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            copyPicked(src, cb);
            return;
        }
        if (code == REQ_PICK) {
            final List<Uri> src = new ArrayList<Uri>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    for (int i = 0; i < n; i++) src.add(data.getClipData().getItemAt(i).getUri());
                } else if (data.getData() != null) {
                    src.add(data.getData());
                }
            }
            if (src.isEmpty()) { pickBusy = false; js("picked", "[]"); return; }
            new Thread(new Runnable() {
                public void run() {
                    JSONArray out = new JSONArray();
                    int failed = 0;
                    for (Uri u : src) {
                        try {
                            Uri c = copyOne(u);
                            File f = new File(new File(PickedFilesProvider.baseDir(MainActivity.this), c.getPathSegments().get(0)), c.getPathSegments().get(1));
                            JSONObject o = new JSONObject();
                            o.put("u", "/__native/c/" + Uri.encode(c.getPathSegments().get(0)) + "/" + Uri.encode(f.getName()));
                            o.put("n", f.getName());
                            o.put("s", f.length());
                            o.put("t", PickedFilesProvider.mimeOf(f.getName()));
                            out.put(o);
                        } catch (Exception e) { failed++; }
                    }
                    final String json = out.toString();
                    final int bad = failed;
                    runOnUiThread(new Runnable() {
                        public void run() {
                            pickBusy = false;
                            if (bad > 0) toast(bad + " file(s) couldn't be opened and were skipped.");
                            js("picked", json);
                        }
                    });
                }
            }).start();
            return;
        }
        super.onActivityResult(code, result, data);
    }

    /** Tells the page something happened (permission answered, files chosen). */
    private void js(final String event, final String value) {
        runOnUiThread(new Runnable() {
            public void run() {
                if (web == null) return;
                web.evaluateJavascript("window.__bxNative&&window.__bxNative(" + JSONObject.quote(event) + "," + JSONObject.quote(value) + ")", null);
            }
        });
    }

    /** "granted", "partial" (Android 14: only the photos you picked) or "denied". */
    private String mediaState() {
        int sdk = Build.VERSION.SDK_INT;
        if (sdk >= 33) {
            if (has("android.permission.READ_MEDIA_IMAGES")) return "granted";
            if (sdk >= 34 && has("android.permission.READ_MEDIA_VISUAL_USER_SELECTED")) return "partial";
            return "denied";
        }
        return has(Manifest.permission.READ_EXTERNAL_STORAGE) ? "granted" : "denied";
    }

    private void askMedia() {
        int sdk = Build.VERSION.SDK_INT;
        List<String> p = new ArrayList<String>();
        if (sdk >= 33) {
            p.add("android.permission.READ_MEDIA_IMAGES");
            p.add("android.permission.READ_MEDIA_VIDEO");
            if (sdk >= 34) p.add("android.permission.READ_MEDIA_VISUAL_USER_SELECTED");
        } else {
            p.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        requestPermissions(p.toArray(new String[0]), REQ_MEDIA);
    }

    private boolean canReadMedia() { return !"denied".equals(mediaState()); }

    private boolean canReadVideos() {
        int sdk = Build.VERSION.SDK_INT;
        if (sdk >= 33) return has("android.permission.READ_MEDIA_VIDEO") || (sdk >= 34 && has("android.permission.READ_MEDIA_VISUAL_USER_SELECTED"));
        return has(Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private static WebResourceResponse nativeError(int code, String why) {
        return new WebResourceResponse("text/plain", "utf-8", code, why, new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    /** /__native/t/<id> = thumbnail, /__native/f/<id> = original photo or video, /__native/c/<dir>/<name> = a file chosen with Browse. */
    private WebResourceResponse nativeResponse(Uri u) {
        try {
            java.util.List<String> seg = u.getPathSegments(); // ["__native", kind, ...]
            if (seg.size() < 3) return nativeError(404, "Not found");
            String kind = seg.get(1);
            Map<String, String> h = new HashMap<String, String>();
            h.put("Cache-Control", "no-store");
            if ("c".equals(kind) && seg.size() == 4) {
                File base = PickedFilesProvider.baseDir(this).getCanonicalFile();
                File f = new File(new File(base, seg.get(2)), seg.get(3)).getCanonicalFile();
                if (!f.getPath().startsWith(base.getPath() + File.separator) || !f.isFile()) return nativeError(404, "Not found");
                h.put("Content-Length", String.valueOf(f.length()));
                return new WebResourceResponse(PickedFilesProvider.mimeOf(f.getName()), null, 200, "OK", h, new java.io.FileInputStream(f));
            }
            String key = seg.get(2);
            if (seg.size() != 3 || !NativeMedia.KEY.matcher(key).matches()) return nativeError(404, "Not found");
            if (!canReadMedia()) return nativeError(403, "No access");
            if ("t".equals(kind)) {
                byte[] b = media.thumbnail(key);
                if (b == null) return nativeError(404, "No preview");
                h.put("Cache-Control", "private, max-age=3600");
                return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new ByteArrayInputStream(b));
            }
            if ("f".equals(kind)) {
                NativeMedia.Opened o = media.open(key);
                if (o == null) return nativeError(404, "Not found");
                if (o.length >= 0) h.put("Content-Length", String.valueOf(o.length));
                return new WebResourceResponse(o.mime, null, 200, "OK", h, o.stream);
            }
        } catch (SecurityException e) {
            return nativeError(403, "No access");
        } catch (Throwable e) {
            return nativeError(500, "Error");
        }
        return nativeError(404, "Not found");
    }

    /** What the page can ask the app to do. Only our own pages are ever shown in this window. */
    private class Bridge {
        @JavascriptInterface public String version() { return "3.3.0"; }
        @JavascriptInterface public String state() { return mediaState(); }
        @JavascriptInterface public void request() { runOnUiThread(new Runnable() { public void run() { askMedia(); } }); }
        @JavascriptInterface public String list(int offset, int limit) {
            try { return media.list(offset, limit, canReadVideos()); } catch (Throwable t) { return "ERR"; }
        }
        @JavascriptInterface public void settings() {
            runOnUiThread(new Runnable() { public void run() {
                try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
            } });
        }
        @JavascriptInterface public void pickFiles(final String accept, final boolean multiple) {
            runOnUiThread(new Runnable() { public void run() {
                if (pickBusy) return;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType(accept != null && accept.matches("^[a-z]+/[a-z0-9.*+-]+$") ? accept : "*/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
                try {
                    pickBusy = true;
                    startActivityForResult(Intent.createChooser(pick, multiple ? "Choose files" : "Choose a file"), REQ_PICK);
                } catch (Exception e) {
                    pickBusy = false;
                    toast("No file picker app is available.");
                    js("picked", "[]");
                }
            } });
        }
        @JavascriptInterface public void download(final String url, final String name, final String mime) {
            runOnUiThread(new Runnable() { public void run() {
                if (url == null || !url.startsWith("https://")) { toast("That file can't be downloaded in the app."); return; }
                downloadNamed(url, name, mime);
            } });
        }
    }

    /**
     * Copies picked files into the app's private cache, then gives the page the copies.
     * Copies have an exact size, name and type, which some phone file sources leave out
     * (that made uploads fail). Runs in the background so big files don't freeze the app.
     */
    private void copyPicked(final List<Uri> src, final ValueCallback<Uri[]> cb) {
        cleanPicked(24L * 3600 * 1000);
        long total = 0;
        for (Uri u : src) { long n = sizeOf(u); if (n > 0) total += n; }
        if (total > 15L * 1024 * 1024) toast(src.size() > 1 ? "Preparing " + src.size() + " files…" : "Preparing file…");
        new Thread(new Runnable() {
            public void run() {
                final List<Uri> out = new ArrayList<Uri>();
                int failed = 0;
                for (Uri u : src) {
                    try { out.add(copyOne(u)); } catch (Exception e) { failed++; }
                }
                final int bad = failed;
                runOnUiThread(new Runnable() {
                    public void run() {
                        if (bad > 0) toast(bad == src.size() ? "That file couldn't be opened. Try picking it from the Files app." : bad + " file(s) couldn't be opened and were skipped.");
                        cb.onReceiveValue(out.isEmpty() ? null : out.toArray(new Uri[0]));
                    }
                });
            }
        }).start();
    }

    private Uri copyOne(Uri u) throws Exception {
        String name = null;
        Cursor c = null;
        try {
            c = getContentResolver().query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
            if (c != null && c.moveToFirst() && !c.isNull(0)) name = c.getString(0);
        } catch (Exception ignored) {
        } finally { if (c != null) c.close(); }
        if (name == null || name.trim().isEmpty()) name = u.getLastPathSegment();
        if (name == null || name.trim().isEmpty()) name = "file";
        name = name.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
        if (name.startsWith(".")) name = "file" + name;
        if (name.length() > 120) name = name.substring(name.length() - 120);
        // No extension? Add one from the source's type, so the page knows what kind of file it is
        if (name.lastIndexOf('.') < 1) {
            String type = getContentResolver().getType(u);
            String ext = type != null ? MimeTypeMap.getSingleton().getExtensionFromMimeType(type) : null;
            if (ext != null) name = name + "." + ext;
        }
        File dir = new File(PickedFilesProvider.baseDir(this), UUID.randomUUID().toString().replace("-", ""));
        if (!dir.mkdirs()) throw new Exception("no space");
        File f = new File(dir, name);
        InputStream in = getContentResolver().openInputStream(u);
        if (in == null) throw new Exception("can't open");
        OutputStream o = new FileOutputStream(f);
        try {
            byte[] buf = new byte[256 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        } finally { in.close(); o.close(); }
        return PickedFilesProvider.uriFor(f);
    }

    private long sizeOf(Uri u) {
        Cursor c = null;
        try {
            c = getContentResolver().query(u, new String[] { OpenableColumns.SIZE }, null, null, null);
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getLong(0);
        } catch (Exception ignored) {
        } finally { if (c != null) c.close(); }
        return -1;
    }

    /** Removes copies older than maxAgeMs (0 = all), so the cache doesn't fill up. */
    private void cleanPicked(final long maxAgeMs) {
        final File base = PickedFilesProvider.baseDir(this);
        new Thread(new Runnable() {
            public void run() {
                File[] dirs = base.listFiles();
                if (dirs == null) return;
                long now = System.currentTimeMillis();
                for (File d : dirs) {
                    if (maxAgeMs > 0 && now - d.lastModified() < maxAgeMs) continue;
                    File[] kids = d.listFiles();
                    if (kids != null) for (File k : kids) k.delete();
                    d.delete();
                }
            }
        }).start();
    }

    /** Back closes the open chat (the page handles it like a browser back), then leaves the app. */
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack() && !showingOffline) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_LONG).show(); }
}
