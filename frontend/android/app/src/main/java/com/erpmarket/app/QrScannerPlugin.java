package com.erpmarket.app;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native QR scanner entry point.
 * Launches NativeQrActivity (CameraX + ZXing) which works on Huawei HMS
 * where WebView getUserMedia and JourneyApps CaptureActivity paint black.
 */
@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {
    private static final String TAG = "QrScanner";
    private static final int RC_SCAN = 77321;
    private PluginCall savedCall;

    @PluginMethod
    public void scan(PluginCall call) {
        savedCall = call;
        try {
            Intent intent = new Intent(getActivity(), NativeQrActivity.class);
            getActivity().startActivityForResult(intent, RC_SCAN);
        } catch (Exception e) {
            Log.e(TAG, "launch failed", e);
            savedCall = null;
            call.reject("No se pudo abrir el escáner nativo", e);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != RC_SCAN || savedCall == null) return;

        if (resultCode == android.app.Activity.RESULT_OK && data != null) {
            String text = data.getStringExtra(NativeQrActivity.EXTRA_TEXT);
            if (text != null && !text.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("text", text);
                savedCall.resolve(ret);
            } else {
                savedCall.reject("empty");
            }
        } else {
            savedCall.reject("cancelled");
        }
        savedCall = null;
    }
}
