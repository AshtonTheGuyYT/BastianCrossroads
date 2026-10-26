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
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

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

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingWebPermission;
    private String[] pendingDownload; // url, contentDisposition, mimeType
    private boolean showingOffline = false;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.parseColor("#1B212B"));
        w.setNavigationBarColor(Color.parseColor("#151A22"));
        w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

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
        s.setUserAgentString(s.getUserAgentString() + " BastionCrossroadsApp/3.0 Android");
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
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
                pick.setType("*/*");
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
                if (Build.VERSION.SDK_INT < 29 && !has(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                    pendingDownload = new String[] { url, contentDisposition, mimeType };
                    requestPermissions(new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, REQ_STORAGE);
                    return;
                }
                download(url, contentDisposition, mimeType);
            }
        });

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

    private void download(String url, String contentDisposition, String mimeType) {
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
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
        } else if (code == REQ_STORAGE && pendingDownload != null) {
            String[] d = pendingDownload;
            pendingDownload = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) download(d[0], d[1], d[2]);
            else toast("Allow storage access to save files.");
        }
    }

    private void explainDenied() {
        new AlertDialog.Builder(this)
            .setTitle("Calls need permission")
            .setMessage("To make calls, allow Camera and Microphone for Bastion Crossroads in your phone's Settings > Apps.")
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
            Uri[] picked = null;
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    picked = new Uri[n];
                    for (int i = 0; i < n; i++) picked[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    picked = new Uri[] { data.getData() };
                }
            }
            fileCallback.onReceiveValue(picked);
            fileCallback = null;
            return;
        }
        super.onActivityResult(code, result, data);
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
