package com.mifa.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int MUSIC_PERMISSION_REQUEST = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().addJavascriptInterface(
            new MusicBridge(),
            "MifaMusic"
        );
    }

    private void requestMusicPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {

                requestPermissions(
                    new String[]{Manifest.permission.READ_MEDIA_AUDIO},
                    MUSIC_PERMISSION_REQUEST
                );
            } else {
                sendMusicToWeb();
            }

        } else {
            if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {

                requestPermissions(
                    new String[]{Manifest.permission.READ_EXTERNAL_STORAGE},
                    MUSIC_PERMISSION_REQUEST
                );
            } else {
                sendMusicToWeb();
            }
        }
    }

    private void sendMusicToWeb() {
        try {
            ContentResolver resolver = getContentResolver();

            Uri collection;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                collection = MediaStore.Audio.Media.getContentUri(
                    MediaStore.VOLUME_EXTERNAL
                );
            } else {
                collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }

            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.MIME_TYPE
            };

            String selection =
                MediaStore.Audio.Media.IS_MUSIC + " != 0";

            String sortOrder =
                MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";

            Cursor cursor = resolver.query(
                collection,
                projection,
                selection,
                null,
                sortOrder
            );

            JSONArray music = new JSONArray();

            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media._ID
                );

                int titleColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.TITLE
                );

                int artistColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.ARTIST
                );

                int albumColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.ALBUM
                );

                int durationColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.DURATION
                );

                int mimeColumn = cursor.getColumnIndexOrThrow(
                    MediaStore.Audio.Media.MIME_TYPE
                );

                while (cursor.moveToNext()) {

                    long id = cursor.getLong(idColumn);

                    String title = cursor.getString(titleColumn);
                    String artist = cursor.getString(artistColumn);
                    String album = cursor.getString(albumColumn);
                    long duration = cursor.getLong(durationColumn);
                    String mime = cursor.getString(mimeColumn);

                    Uri audioUri = Uri.withAppendedPath(
                        collection,
                        String.valueOf(id)
                    );

                    JSONObject item = new JSONObject();

                    item.put("id", id);
                    item.put(
                        "title",
                        title == null || title.isEmpty()
                            ? "Titre inconnu"
                            : title
                    );

                    item.put(
                        "artist",
                        artist == null || artist.isEmpty()
                            ? "Artiste inconnu"
                            : artist
                    );

                    item.put(
                        "album",
                        album == null || album.isEmpty()
                            ? "Album inconnu"
                            : album
                    );

                    item.put("duration", duration);
                    item.put("mime", mime);
                    item.put("audio", audioUri.toString());

                    music.put(item);
                }

                cursor.close();
            }

            String json = music.toString();

            getBridge().getWebView().post(() -> {
                getBridge().getWebView().evaluateJavascript(
                    "window.mifaPhoneMusic && window.mifaPhoneMusic(" +
                    JSONObject.quote(json) +
                    ");",
                    null
                );
            });

        } catch (Exception e) {
            e.printStackTrace();

            String error = JSONObject.quote(
                e.getMessage() == null
                    ? "Erreur MediaStore"
                    : e.getMessage()
            );

            getBridge().getWebView().post(() -> {
                getBridge().getWebView().evaluateJavascript(
                    "window.mifaPhoneMusicError && " +
                    "window.mifaPhoneMusicError(" +
                    error +
                    ");",
                    null
                );
            });
        }
    }

    public class MusicBridge {

        @JavascriptInterface
        public void requestPermission() {
            runOnUiThread(() -> requestMusicPermission());
        }

        @JavascriptInterface
        public void loadMusic() {
            runOnUiThread(() -> {

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

                    if (checkSelfPermission(
                        Manifest.permission.READ_MEDIA_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED) {

                        sendMusicToWeb();

                    } else {
                        requestMusicPermission();
                    }

                } else {

                    if (checkSelfPermission(
                        Manifest.permission.READ_EXTERNAL_STORAGE
                    ) == PackageManager.PERMISSION_GRANTED) {

                        sendMusicToWeb();

                    } else {
                        requestMusicPermission();
                    }
                }
            });
        }
    }
}
