package com.erpmarket.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.common.HybridBinarizer;

import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * CameraX + ZXing QR scanner.
 * JourneyApps CaptureActivity (old Camera API) paints black on Huawei HMS (P40 Pro).
 * CameraX uses Camera2/HAL paths that work without Google Mobile Services.
 */
public class NativeQrActivity extends AppCompatActivity {
    private static final String TAG = "NativeQr";
    private static final int RC_PERM = 8821;
    public static final String EXTRA_TEXT = "qr_text";

    private PreviewView previewView;
    private TextView hintView;
    private Button switchBtn;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService analysisExecutor;
    private final MultiFormatReader reader = new MultiFormatReader();
    private int lensFacing = CameraSelector.LENS_FACING_BACK;
    private boolean handled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        previewView = new PreviewView(this);
        previewView.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(previewView);

        hintView = new TextView(this);
        hintView.setText("Escaneá el QR del panel ALLMARKET");
        hintView.setTextColor(0xFFFFFFFF);
        hintView.setTextSize(14f);
        hintView.setPadding(32, 32, 32, 32);
        FrameLayout.LayoutParams hintLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        hintLp.gravity = android.view.Gravity.TOP;
        root.addView(hintView, hintLp);

        switchBtn = new Button(this);
        switchBtn.setText("Cambiar cámara");
        FrameLayout.LayoutParams btnLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        btnLp.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.CENTER_HORIZONTAL;
        btnLp.bottomMargin = 48;
        root.addView(switchBtn, btnLp);
        switchBtn.setOnClickListener(v -> toggleCamera());

        setContentView(root);

        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.POSSIBLE_FORMATS, Collections.singletonList(com.google.zxing.BarcodeFormat.QR_CODE));
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        reader.setHints(hints);

        analysisExecutor = Executors.newSingleThreadExecutor();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA}, RC_PERM);
        }
    }

    private void toggleCamera() {
        lensFacing = (lensFacing == CameraSelector.LENS_FACING_BACK)
                ? CameraSelector.LENS_FACING_FRONT
                : CameraSelector.LENS_FACING_BACK;
        hintView.setText(lensFacing == CameraSelector.LENS_FACING_FRONT
                ? "Cámara frontal activa"
                : "Cámara trasera activa");
        if (cameraProvider != null) {
            cameraProvider.unbindAll();
            bindCamera();
        }
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCamera();
            } catch (Exception e) {
                Log.e(TAG, "camera provider failed", e);
                Toast.makeText(this, "No se pudo iniciar la cámara", Toast.LENGTH_LONG).show();
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void bindCamera() {
        if (cameraProvider == null) return;

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis analysis = new ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build();
        analysis.setAnalyzer(analysisExecutor, this::analyzeFrame);

        CameraSelector selector = new CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build();

        try {
            cameraProvider.bindToLifecycle(this, selector, preview, analysis);
        } catch (Exception e) {
            Log.e(TAG, "bind failed", e);
            Toast.makeText(this, "Error al vincular cámara", Toast.LENGTH_LONG).show();
        }
    }

    private void analyzeFrame(ImageProxy image) {
        if (handled) {
            image.close();
            return;
        }
        try {
            ImageProxy.PlaneProxy yPlane = image.getPlanes()[0];
            ByteBuffer buffer = yPlane.getBuffer();
            byte[] bytes = new byte[buffer.remaining()];
            buffer.get(bytes);

            int width = image.getWidth();
            int height = image.getHeight();
            // Crop center square for faster decode on tall preview streams
            int crop = Math.min(width, height);
            int x0 = (width - crop) / 2;
            int y0 = (height - crop) / 2;

            PlanarYUVLuminanceSource source = new PlanarYUVLuminanceSource(
                    bytes, width, height, x0, y0, crop, crop, false);
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
            com.google.zxing.Result result = reader.decodeWithState(bitmap);
            String text = result != null ? result.getText() : null;
            if (text != null && !text.isEmpty()) {
                handled = true;
                final String payload = text;
                runOnUiThread(() -> {
                    Intent data = new Intent();
                    data.putExtra(EXTRA_TEXT, payload);
                    setResult(RESULT_OK, data);
                    finish();
                });
            }
        } catch (Exception ignored) {
            // no QR in this frame
        } finally {
            reader.reset();
            image.close();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RC_PERM) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera();
            } else {
                Toast.makeText(this, "Permiso de cámara requerido", Toast.LENGTH_LONG).show();
                finish();
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (analysisExecutor != null) {
            analysisExecutor.shutdown();
        }
        reader.reset();
    }
}
