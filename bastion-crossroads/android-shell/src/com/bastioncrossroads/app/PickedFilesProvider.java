package com.bastioncrossroads.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

/**
 * Serves copies of the files you pick for attachments back to the app's web page.
 * Many Android file sources (Google Photos, Drive, some galleries) don't report a
 * file's exact size or type, which made uploads fail. Copies kept in the app's own
 * cache always have a known name, size and type. Private to this app (not exported),
 * read-only, and limited to the app's "picked" cache folder.
 */
public class PickedFilesProvider extends ContentProvider {
    static final String AUTHORITY = "com.bastioncrossroads.app.picked";

    static File baseDir(android.content.Context c) { return new File(c.getCacheDir(), "picked"); }

    static Uri uriFor(File f) {
        File dir = f.getParentFile();
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(dir.getName()).appendPath(f.getName()).build();
    }

    @Override public boolean onCreate() { return true; }

    private File fileFor(Uri uri) throws FileNotFoundException {
        List<String> seg = uri.getPathSegments();
        if (seg == null || seg.size() != 2) throw new FileNotFoundException("Not found");
        try {
            File base = baseDir(getContext()).getCanonicalFile();
            File f = new File(new File(base, seg.get(0)), seg.get(1)).getCanonicalFile();
            if (!f.getPath().startsWith(base.getPath() + File.separator) || !f.isFile()) throw new FileNotFoundException("Not found");
            return f;
        } catch (IOException e) {
            throw new FileNotFoundException("Not found");
        }
    }

    static String mimeOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        String t = MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT));
        return t != null ? t : "application/octet-stream";
    }

    @Override
    public String getType(Uri uri) {
        List<String> seg = uri.getPathSegments();
        return seg != null && seg.size() == 2 ? mimeOf(seg.get(1)) : null;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        File f;
        try { f = fileFor(uri); } catch (FileNotFoundException e) { return null; }
        String[] cols = projection != null ? projection : new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
            else row[i] = null;
        }
        MatrixCursor c = new MatrixCursor(cols, 1);
        c.addRow(row);
        return c;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    /** Reports the exact length, so the page always knows the file's real size. */
    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(uri);
        if (!"r".equals(mode)) throw new FileNotFoundException("Read only");
        return new AssetFileDescriptor(ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY), 0, f.length());
    }

    @Override public Uri insert(Uri uri, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { throw new UnsupportedOperationException(); }
}
