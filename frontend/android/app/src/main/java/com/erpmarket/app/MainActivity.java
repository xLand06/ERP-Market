package com.erpmarket.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QrScannerPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            final String ver = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            getWindow().getDecorView().post(() ->
                Toast.makeText(MainActivity.this, "ALLMARKET v" + ver, Toast.LENGTH_LONG).show()
            );
        } catch (Exception ignored) { }

        // WebView may not exist yet in onCreate — retry a few times
        wipeWebViewCache();
        mainHandler.postDelayed(this::wipeWebViewCache, 500);
        mainHandler.postDelayed(this::wipeWebViewCache, 1500);

        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        wipeWebViewCache();
        handleDeepLink(getIntent());
    }

    private void wipeWebViewCache() {
        try {
            Bridge bridge = getBridge();
            if (bridge == null) return;
            WebView wb = bridge.getWebView();
            if (wb == null) return;
            wb.clearCache(true);
            wb.clearHistory();
            WebSettings s = wb.getSettings();
            s.setCacheMode(WebSettings.LOAD_NO_CACHE);
            s.setAppCacheEnabled(false);
        } catch (Throwable t) {
            Log.w(TAG, "wipeWebViewCache", t);
        }
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        String scheme = data.getScheme();
        if (scheme == null || !scheme.equalsIgnoreCase("allmarket")) return;

        final String url = data.toString();
        Log.i(TAG, "Deep link: " + url);
        runOnUiThread(() ->
            Toast.makeText(this, "QR: " + url, Toast.LENGTH_LONG).show()
        );

        // Inject now and again after WebView is definitely up
        injectDeepLink(url);
        mainHandler.postDelayed(() -> injectDeepLink(url), 700);
        mainHandler.postDelayed(() -> injectDeepLink(url), 2000);
    }

    private void injectDeepLink(final String url) {
        try {
            final Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) return;
            final String js =
                "try{window.dispatchEvent(new CustomEvent('appUrlOpen',{detail:{url:" + JSONObject.quote(url) + "}}));}catch(e){console.error(e);}";
            runOnUiThread(() -> {
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
