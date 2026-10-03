package com.erpmarket.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QrScannerPlugin.class);
        super.onCreate(savedInstanceState);

        // Huawei WebView HTTP cache can survive uninstall — wipe after bridge exists
        try {
            WebView wb = getBridge() != null ? getBridge().getWebView() : null;
            if (wb != null) {
                wb.clearCache(true);
                WebSettings s = wb.getSettings();
                s.setCacheMode(WebSettings.LOAD_NO_CACHE);
            }
        } catch (Exception ignored) { }

        // Visible package version proof
        try {
            final String ver = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            getWindow().getDecorView().post(() ->
                Toast.makeText(MainActivity.this, "ALLMARKET v" + ver, Toast.LENGTH_LONG).show()
            );
        } catch (Exception ignored) { }

        // Cold-start deep link: allmarket://connect?server=...
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        String scheme = data.getScheme();
        if (scheme == null || !scheme.equalsIgnoreCase("allmarket")) return;

        final String url = data.toString();
        Log.i(TAG, "Deep link: " + url);
        try {
            final Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) {
                // Bridge not ready yet — stash and retry shortly
                getWindow().getDecorView().postDelayed(() -> injectDeepLink(url), 800);
                return;
            }
            injectDeepLink(url);
        } catch (Exception e) {
            Log.e(TAG, "deep link inject failed", e);
        }
    }

    private void injectDeepLink(final String url) {
        try {
            final Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) return;
            final String js =
                "try{window.dispatchEvent(new CustomEvent('appUrlOpen',{detail:{url:" + JSONObject.quote(url) + "}}));}catch(e){}";
            bridge.getWebView().post(() -> {
                try {
                    bridge.getWebView().evaluateJavascript(js, null);
                } catch (Exception e) {
                    Log.e(TAG, "evaluateJavascript failed", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "injectDeepLink error", e);
        }
    }
}
