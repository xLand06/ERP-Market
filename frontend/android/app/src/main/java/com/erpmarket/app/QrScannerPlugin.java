package com.erpmarket.app;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.journeyapps.barcodescanner.CaptureActivity;

/**
 * Native QR scanner (ZXing) — WebView getUserMedia paints black on
 * Huawei HMS devices (P40 Pro). Camera/ZXing uses the Android camera API.
 */
@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {
    private static final String TAG = "QrScanner";
    private PluginCall savedCall;

    @PluginMethod
    public void scan(PluginCall call) {
        savedCall = call;
        try {
            IntentIntegrator integrator = new IntentIntegrator(getActivity());
            integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
            integrator.setPrompt("Escaneá el QR del panel ALLMARKET");
            integrator.setBeepEnabled(true);
            integrator.setBarcodeImageEnabled(false);
            integrator.setOrientationLocked(false);
            integrator.setCaptureActivity(CaptureActivity.class);
            integrator.initiateScan();
        } catch (Exception e) {
            Log.e(TAG, "scan failed", e);
            savedCall = null;
            call.reject("No se pudo abrir el escáner nativo", e);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result == null) return;
        if (savedCall == null) return;

        if (result.getContents() != null) {
            JSObject ret = new JSObject();
            ret.put("text", result.getContents());
            savedCall.resolve(ret);
        } else {
            savedCall.reject("cancelled");
        }
        savedCall = null;
    }
}
