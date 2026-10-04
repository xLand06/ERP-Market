package com.erpmarket.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native QR scanner entry point.
 * Launches NativeQrActivity (CameraX + ZXing) which works on Huawei HMS,
 * Samsung, Xiaomi, Motorola where WebView getUserMedia paints black.
 */
@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {
    private static final String TAG = "QrScanner";

    @PluginMethod
    public void scan(PluginCall call) {
        try {
            Intent intent = new Intent(getActivity(), NativeQrActivity.class);
            startActivityForResult(call, intent, "handleScanResult");
        } catch (Exception e) {
            Log.e(TAG, "launch failed", e);
            call.reject("No se pudo abrir el escáner nativo", e);
        }
    }

    @ActivityCallback
    private void handleScanResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String text = result.getData().getStringExtra(NativeQrActivity.EXTRA_TEXT);
            if (text != null && !text.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("text", text);
                call.resolve(ret);
                return;
            } else {
                call.reject("empty");
                return;
            }
        }
        call.reject("cancelled");
    }
}
