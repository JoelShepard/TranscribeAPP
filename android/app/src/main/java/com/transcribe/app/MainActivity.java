package com.transcribe.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;

import android.provider.OpenableColumns;

import com.getcapacitor.BridgeActivity;

import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final String EVENT_NAME = "sharedFileReceived";
    private static final String PENDING_SHARED_FILE_KEY = "__TRANSCRIBE_PENDING_SHARED_FILE__";
    private String pendingSharedFileScript;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchPendingSharedFile();
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && isSupportedSharedMimeType(type)) {
            Uri fileUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (fileUri != null) {
                processSharedFile(fileUri, intent);
            }
        } else if (Intent.ACTION_VIEW.equals(action) && isSupportedSharedMimeType(type)) {
            Uri fileUri = intent.getData();
            if (fileUri != null) {
                processSharedFile(fileUri, intent);
            }
        }
    }

    private boolean isSupportedSharedMimeType(String type) {
        return type != null && (type.startsWith("audio/") || "application/octet-stream".equals(type));
    }

    private void processSharedFile(Uri fileUri, Intent intent) {
        Log.d(TAG, "Received shared file URI: " + fileUri.toString());

        try {
            String fileName = getFileName(fileUri);
            String mimeType = intent.getType();

            byte[] bytes;
            try (InputStream inputStream = getContentResolver().openInputStream(fileUri)) {
                if (inputStream == null) {
                    Log.e(TAG, "Failed to open input stream for URI: " + fileUri);
                    return;
                }

                bytes = inputStream.readAllBytes();
            }

            String base64Content = Base64.encodeToString(bytes, Base64.NO_WRAP);

            String js = String.format(
                "(function(){const detail={ fileName: '%s', mimeType: '%s', content: '%s' };window['%s']=detail;window.dispatchEvent(new CustomEvent('%s', { detail }));})();",
                escapeJsString(fileName),
                escapeJsString(mimeType != null ? mimeType : "audio/*"),
                base64Content,
                PENDING_SHARED_FILE_KEY,
                EVENT_NAME
            );

            pendingSharedFileScript = js;
            dispatchPendingSharedFile();

            Log.d(TAG, "Shared file sent to WebView: " + fileName + " (" + bytes.length + " bytes)");
        } catch (Exception e) {
            Log.e(TAG, "Error processing shared file", e);
        }
    }

    private void dispatchPendingSharedFile() {
        if (pendingSharedFileScript == null) {
            return;
        }

        runOnUiThread(() -> {
            if (getBridge() != null) {
                getBridge().eval(pendingSharedFileScript, null);
                pendingSharedFileScript = null;
            } else {
                Log.w(TAG, "Bridge is not ready yet; will retry shared file dispatch");
            }
        });
    }

    private String getFileName(Uri uri) {
        try (Cursor cursor = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int displayNameColumnIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (displayNameColumnIndex != -1) {
                    String displayName = cursor.getString(displayNameColumnIndex);
                    if (displayName != null && !displayName.isBlank()) {
                        return displayName;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Unable to resolve display name from content resolver", e);
        }

        if (uri != null) {
            String path = uri.getPath();
            if (path != null) {
                int lastSlash = path.lastIndexOf('/');
                if (lastSlash != -1 && lastSlash < path.length() - 1) {
                    return path.substring(lastSlash + 1);
                }
            }
        }

        return "shared_audio";
    }

    private String escapeJsString(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("'", "\\'")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r");
    }
}
