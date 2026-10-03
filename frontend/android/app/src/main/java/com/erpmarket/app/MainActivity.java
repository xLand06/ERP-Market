package com.erpmarket.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

        // Visible package version proof (this is the new install)
        try {
            final String ver = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            getWindow().getDecorView().post(() ->
                Toast.makeText(MainActivity.this, "ALLMARKET v" + ver, Toast.LENGTH_LONG).show()
            );
        } catch (Exception ignored) { }
    }
}
