package com.bastioncrossroads.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.regex.Pattern;

/**
 * Reads the phone's recent photos and videos for the in-app picker.
 * A web page can't see the photo library, so the app lists it, makes small
 * thumbnails, and hands the chosen files to the page. Everything is read-only.
 */
final class NativeMedia {
    static final Pattern KEY = Pattern.compile("^[iv][0-9]{1,18}$");
    private static final int THUMB = 360;
    private final Context ctx;

    NativeMedia(Context ctx) { this.ctx = ctx; }

    private ContentResolver cr() { return ctx.getContentResolver(); }

    private static Uri uriOf(String key) {
        long id = Long.parseLong(key.substring(1));
        return ContentUris.withAppendedId(key.charAt(0) == 'i' ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);
    }

    /** One page of recent photos (and videos, if allowed), newest first, as JSON for the page. */
    String list(int offset, int limit, boolean videos) throws Exception {
        if (offset < 0) offset = 0;
        if (limit < 1) limit = 1;
        if (limit > 120) limit = 120;
        Uri files = MediaStore.Files.getContentUri("external");
        String sel = "(media_type=1" + (videos ? " OR media_type=3" : "") + ") AND _size>0";
        String[][] attempts = {
            { "_id", "_display_name", "_size", "mime_type", "media_type", "date_added", "width", "height", "duration" },
            { "_id", "_display_name", "_size", "mime_type", "media_type", "date_added", "width", "height" },
            { "_id", "_display_name", "_size", "mime_type", "media_type", "date_added" }
        };
        Cursor c = null;
        for (String[] cols : attempts) {
            try { c = cr().query(files, cols, sel, null, "date_added DESC"); } catch (Exception e) { c = null; }
            if (c != null) break;
        }
        JSONArray out = new JSONArray();
        if (c == null) return out.toString();
        try {
            int iId = c.getColumnIndex("_id"), iName = c.getColumnIndex("_display_name"), iSize = c.getColumnIndex("_size"),
                iMime = c.getColumnIndex("mime_type"), iType = c.getColumnIndex("media_type"), iAdded = c.getColumnIndex("date_added"),
                iW = c.getColumnIndex("width"), iH = c.getColumnIndex("height"), iDur = c.getColumnIndex("duration");
            if (!c.moveToPosition(offset)) return out.toString();
            int n = 0;
            do {
                boolean video = c.getInt(iType) == 3;
                String name = c.isNull(iName) ? (video ? "video" : "photo") : c.getString(iName);
                String mime = iMime >= 0 && !c.isNull(iMime) ? c.getString(iMime) : null;
                if (mime == null) mime = guessMime(name, video);
                JSONObject o = new JSONObject();
                o.put("k", (video ? "v" : "i") + c.getLong(iId));
                o.put("n", name);
                o.put("s", c.getLong(iSize));
                o.put("t", mime);
                o.put("a", iAdded >= 0 && !c.isNull(iAdded) ? c.getLong(iAdded) * 1000L : 0L);
                if (iW >= 0 && !c.isNull(iW)) o.put("w", c.getInt(iW));
                if (iH >= 0 && !c.isNull(iH)) o.put("h", c.getInt(iH));
                if (video && iDur >= 0 && !c.isNull(iDur)) o.put("d", c.getLong(iDur));
                out.put(o);
                n++;
            } while (n < limit && c.moveToNext());
        } finally { c.close(); }
        return out.toString();
    }

    private static String guessMime(String name, boolean video) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot >= 0) {
            String t = MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT));
            if (t != null) return t;
        }
        return video ? "video/mp4" : "image/jpeg";
    }

    /** A small JPEG preview of one photo or video. Null if it can't be made. */
    byte[] thumbnail(String key) {
        Uri uri = uriOf(key);
        boolean video = key.charAt(0) == 'v';
        long id = Long.parseLong(key.substring(1));
        Bitmap bm = null;
        if (Build.VERSION.SDK_INT >= 29) {
            // loadThumbnail (Android 10+) applies the photo's rotation for us. Called by name because the build SDK is older.
            try {
                Class<?> sizeCls = Class.forName("android.util.Size");
                Object size = sizeCls.getConstructor(int.class, int.class).newInstance(THUMB, THUMB);
                Method m = ContentResolver.class.getMethod("loadThumbnail", Uri.class, sizeCls, android.os.CancellationSignal.class);
                bm = (Bitmap) m.invoke(cr(), uri, size, null);
            } catch (Throwable ignored) { bm = null; }
        }
        if (bm == null && video) {
            try { bm = MediaStore.Video.Thumbnails.getThumbnail(cr(), id, MediaStore.Video.Thumbnails.MINI_KIND, null); } catch (Throwable ignored) { bm = null; }
        }
        if (bm == null && !video) bm = decodeImage(uri);
        if (bm == null) return null;
        int max = Math.max(bm.getWidth(), bm.getHeight());
        if (max > THUMB) {
            float f = THUMB / (float) max;
            Bitmap s = Bitmap.createScaledBitmap(bm, Math.max(1, Math.round(bm.getWidth() * f)), Math.max(1, Math.round(bm.getHeight() * f)), true);
            if (s != bm) bm.recycle();
            bm = s;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(24 * 1024);
        bm.compress(Bitmap.CompressFormat.JPEG, 80, out);
        bm.recycle();
        return out.toByteArray();
    }

    /** Decodes a photo at small size and turns it the right way up (phone photos are often stored sideways). */
    private Bitmap decodeImage(Uri uri) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream in = cr().openInputStream(uri);
            if (in == null) return null;
            try { BitmapFactory.decodeStream(in, null, o); } finally { in.close(); }
            int sample = 1;
            while (o.outWidth / (sample * 2) >= THUMB && o.outHeight / (sample * 2) >= THUMB) sample *= 2;
            BitmapFactory.Options d = new BitmapFactory.Options();
            d.inSampleSize = sample;
            in = cr().openInputStream(uri);
            if (in == null) return null;
            Bitmap bm;
            try { bm = BitmapFactory.decodeStream(in, null, d); } finally { in.close(); }
            if (bm == null) return null;
            int deg = 0;
            Cursor c = null;
            try {
                c = cr().query(uri, new String[] { "orientation" }, null, null, null);
                if (c != null && c.moveToFirst() && !c.isNull(0)) deg = c.getInt(0);
            } catch (Exception ignored) {
            } finally { if (c != null) c.close(); }
            if (deg != 0) {
                Matrix m = new Matrix();
                m.postRotate(deg);
                Bitmap r = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
                if (r != bm) bm.recycle();
                bm = r;
            }
            return bm;
        } catch (Throwable t) {
            return null;
        }
    }

    /** The original file, with its exact length. Caller closes the stream. */
    static final class Opened {
        final InputStream stream; final long length; final String mime;
        Opened(InputStream s, long l, String m) { stream = s; length = l; mime = m; }
    }

    Opened open(String key) throws Exception {
        Uri uri = uriOf(key);
        AssetFileDescriptor fd = cr().openAssetFileDescriptor(uri, "r");
        if (fd == null) return null;
        String mime = cr().getType(uri);
        return new Opened(fd.createInputStream(), fd.getLength(), mime != null ? mime : "application/octet-stream");
    }
}
