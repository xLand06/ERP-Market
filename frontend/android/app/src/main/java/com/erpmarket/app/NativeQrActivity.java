package com.erpmarket.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import java.util.concurrent.TimeUnit;
import android.util.Log;
import android.util.Size;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.MeteringPointFactory;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * CameraX + ZXing QR scanner.
 * Engineered for robustness across all Android vendors (Samsung, Huawei HMS, Xiaomi, Motorola).
 * Fixes Camera2 Y-plane rowStride padding, sensor rotation, backlight binarization, and tap-to-focus.
 */
public class NativeQrActivity extends AppCompatActivity {
    private static final String TAG = "NativeQr";
    private static final int RC_PERM = 8821;
    public static final String EXTRA_TEXT = "qr_text";

    private PreviewView previewView;
    private TextView hintView;
    private Button switchBtn;
    private Button torchBtn;
    private Button closeBtn;
    private Camera camera;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService analysisExecutor;

    private final QRCodeReader qrCodeReader = new QRCodeReader();
    private final MultiFormatReader multiFormatReader = new MultiFormatReader();
    private final Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);

    private int lensFacing = CameraSelector.LENS_FACING_BACK;
    private boolean isTorchOn = false;
    private volatile boolean handled = false;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        // 1. Camera Preview
        previewView = new PreviewView(this);
        previewView.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(previewView);

        // 2. Viewfinder Overlay
        View overlay = new View(this) {
            private final Paint boxPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            private final Paint dimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

            {
                boxPaint.setColor(0xFF10B981); // Emerald green
                boxPaint.setStyle(Paint.Style.STROKE);
                boxPaint.setStrokeWidth(8f);
                dimPaint.setColor(0x55000000);
            }

            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                int w = getWidth();
                int h = getHeight();
                int boxSize = (int) (Math.min(w, h) * 0.70f);
                int left = (w - boxSize) / 2;
                int top = (h - boxSize) / 2;
                int right = left + boxSize;
                int bottom = top + boxSize;

                // Dim outer area
                canvas.drawRect(0, 0, w, top, dimPaint);
                canvas.drawRect(0, bottom, w, h, dimPaint);
                canvas.drawRect(0, top, left, bottom, dimPaint);
                canvas.drawRect(right, top, w, bottom, dimPaint);

                // Viewfinder frame
                RectF rect = new RectF(left, top, right, bottom);
                canvas.drawRoundRect(rect, 32f, 32f, boxPaint);
            }
        };
        root.addView(overlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // 3. Top Header Bar (Close + Hint)
        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(24, 48, 24, 24);

        closeBtn = new Button(this);
        closeBtn.setText("✕");
        closeBtn.setTextColor(0xFFFFFFFF);
        closeBtn.setTextSize(18f);
        closeBtn.setBackgroundColor(0x33000000);
        closeBtn.setOnClickListener(v -> {
            setResult(RESULT_CANCELED);
            finish();
        });
        topBar.addView(closeBtn, new LinearLayout.LayoutParams(120, 120));

        hintView = new TextView(this);
        hintView.setText("Apuntá al código QR del panel");
        hintView.setTextColor(0xFFFFFFFF);
        hintView.setTextSize(15f);
        hintView.setGravity(Gravity.CENTER);
        hintView.setPadding(16, 0, 16, 0);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        topBar.addView(hintView, hintLp);

        FrameLayout.LayoutParams topBarLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        topBarLp.gravity = Gravity.TOP;
        root.addView(topBar, topBarLp);

        // 4. Bottom Controls Bar (Flashlight + Switch Camera)
        LinearLayout bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.HORIZONTAL);
        bottomBar.setGravity(Gravity.CENTER);
        bottomBar.setPadding(32, 24, 32, 64);

        torchBtn = new Button(this);
        torchBtn.setText("🔦 Luz");
        torchBtn.setTextColor(0xFFFFFFFF);
        torchBtn.setBackgroundColor(0x55000000);
        torchBtn.setOnClickListener(v -> toggleTorch());
        LinearLayout.LayoutParams torchLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        torchLp.setMargins(16, 0, 16, 0);
        bottomBar.addView(torchBtn, torchLp);

        switchBtn = new Button(this);
        switchBtn.setText("🔄 Cambiar cámara");
        switchBtn.setTextColor(0xFFFFFFFF);
        switchBtn.setBackgroundColor(0x55000000);
        switchBtn.setOnClickListener(v -> toggleCamera());
        LinearLayout.LayoutParams switchLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        switchLp.setMargins(16, 0, 16, 0);
        bottomBar.addView(switchBtn, switchLp);

        FrameLayout.LayoutParams bottomBarLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        bottomBarLp.gravity = Gravity.BOTTOM;
        root.addView(bottomBar, bottomBarLp);

        // 5. Tap-to-focus on preview
        previewView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP && camera != null) {
                try {
                    MeteringPointFactory factory = previewView.getMeteringPointFactory();
                    MeteringPoint point = factory.createPoint(event.getX(), event.getY());
                    FocusMeteringAction action = new FocusMeteringAction.Builder(
                            point, FocusMeteringAction.FLAG_AF).build();
                    camera.getCameraControl().startFocusAndMetering(action);
                } catch (Exception ignored) {}
            }
            return true;
        });

        setContentView(root);

        // Configure ZXing hints
        hints.put(DecodeHintType.POSSIBLE_FORMATS, Collections.singletonList(BarcodeFormat.QR_CODE));
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.CHARACTER_SET, "UTF-8");
        multiFormatReader.setHints(hints);

        analysisExecutor = Executors.newSingleThreadExecutor();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA}, RC_PERM);
        }
    }

    private void toggleTorch() {
        if (camera != null && camera.getCameraInfo().hasFlashUnit()) {
            isTorchOn = !isTorchOn;
            camera.getCameraControl().enableTorch(isTorchOn);
            torchBtn.setText(isTorchOn ? "🔦 Apagar" : "🔦 Luz");
        } else {
            Toast.makeText(this, "Linterna no disponible", Toast.LENGTH_SHORT).show();
        }
    }

    private void toggleCamera() {
        lensFacing = (lensFacing == CameraSelector.LENS_FACING_BACK)
                ? CameraSelector.LENS_FACING_FRONT
                : CameraSelector.LENS_FACING_BACK;
        isTorchOn = false;
        torchBtn.setText("🔦 Luz");
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

    private byte[] yBufferArray;
    private byte[] rotatedArray;

    private final Handler autoFocusHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoFocusRunnable = new Runnable() {
        @Override
        public void run() {
            if (isFinishing() || isDestroyed() || camera == null || previewView == null) return;
            try {
                if (previewView.getWidth() > 0 && previewView.getHeight() > 0) {
                    MeteringPointFactory factory = previewView.getMeteringPointFactory();
                    MeteringPoint point = factory.createPoint(previewView.getWidth() / 2f, previewView.getHeight() / 2f);
                    FocusMeteringAction action = new FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF)
                            .setAutoCancelDuration(2, TimeUnit.SECONDS)
                            .build();
                    camera.getCameraControl().startFocusAndMetering(action);
                }
            } catch (Exception ignored) {}
            autoFocusHandler.postDelayed(this, 1800);
        }
    };

    private void bindCamera() {
        if (cameraProvider == null) return;

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis.Builder analysisBuilder = new ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setTargetResolution(new Size(1280, 720));

        if (previewView.getDisplay() != null) {
            analysisBuilder.setTargetRotation(previewView.getDisplay().getRotation());
        }

        ImageAnalysis analysis = analysisBuilder.build();
        analysis.setAnalyzer(analysisExecutor, this::analyzeFrame);

        CameraSelector selector = new CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build();

        try {
            camera = cameraProvider.bindToLifecycle(this, selector, preview, analysis);
            autoFocusHandler.removeCallbacksAndMessages(null);
            autoFocusHandler.postDelayed(autoFocusRunnable, 600);
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
            int rotation = image.getImageInfo().getRotationDegrees();
            int width = image.getWidth();
            int height = image.getHeight();
            int totalPixels = width * height;

            // Reusable buffers to eliminate per-frame GC thrashing
            if (yBufferArray == null || yBufferArray.length != totalPixels) {
                yBufferArray = new byte[totalPixels];
            }
            if (rotatedArray == null || rotatedArray.length != totalPixels) {
                rotatedArray = new byte[totalPixels];
            }

            // 1. Extract clean continuous Y plane (compensating for Camera2 rowStride padding)
            toContinuousY(image, yBufferArray);

            // 2. Rotate pixels to match real display orientation
            rotateY(yBufferArray, rotatedArray, width, height, rotation);

            int finalWidth = (rotation == 90 || rotation == 270) ? height : width;
            int finalHeight = (rotation == 90 || rotation == 270) ? width : height;

            // Center-crop (75% of viewport where the user frames the QR in the green box)
            int cropSize = (int) (Math.min(finalWidth, finalHeight) * 0.75f);
            int cropLeft = (finalWidth - cropSize) / 2;
            int cropTop = (finalHeight - cropSize) / 2;
            PlanarYUVLuminanceSource centerSource = new PlanarYUVLuminanceSource(
                    rotatedArray, finalWidth, finalHeight, cropLeft, cropTop, cropSize, cropSize, false
            );

            Result result = null;

            // Strategy 1: Center-crop with HybridBinarizer (fast and accurate for framed QR)
            try {
                qrCodeReader.reset();
                BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(centerSource));
                result = qrCodeReader.decode(bitmap, hints);
            } catch (Exception ignored) {}

            // Strategy 2: Center-crop with GlobalHistogramBinarizer (superior for scanning LCD/LED screens with reflection/glare)
            if (result == null) {
                try {
                    qrCodeReader.reset();
                    BinaryBitmap bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(centerSource));
                    result = qrCodeReader.decode(bitmap, hints);
                } catch (Exception ignored) {}
            }

            // Strategy 3: Full-frame with GlobalHistogramBinarizer (for screens when user is further away)
            if (result == null) {
                try {
                    qrCodeReader.reset();
                    PlanarYUVLuminanceSource fullSource = new PlanarYUVLuminanceSource(
                            rotatedArray, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight, false
                    );
                    BinaryBitmap bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(fullSource));
                    result = qrCodeReader.decode(bitmap, hints);
                } catch (Exception ignored) {}
            }

            // Strategy 4: Full-frame with HybridBinarizer
            if (result == null) {
                try {
                    qrCodeReader.reset();
                    PlanarYUVLuminanceSource fullSource = new PlanarYUVLuminanceSource(
                            rotatedArray, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight, false
                    );
                    BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(fullSource));
                    result = qrCodeReader.decode(bitmap, hints);
                } catch (Exception ignored) {}
            }

            // Strategy 5: Inverted luminance (dark mode screens)
            if (result == null) {
                try {
                    qrCodeReader.reset();
                    BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(centerSource.invert()));
                    result = qrCodeReader.decode(bitmap, hints);
                } catch (Exception ignored) {}
            }

            // Strategy 6: MultiFormatReader fallback
            if (result == null) {
                try {
                    multiFormatReader.reset();
                    BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(centerSource));
                    result = multiFormatReader.decodeWithState(bitmap);
                } catch (Exception ignored) {}
            }

            if (result != null && result.getText() != null && !result.getText().trim().isEmpty()) {
                handled = true;
                final String payload = result.getText().trim();
                Log.i(TAG, "QR decode success: " + payload);

                // Haptic feedback
                try {
                    Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (v != null) {
                        v.vibrate(60);
                    }
                } catch (Exception ignored) {}

                runOnUiThread(() -> {
                    Intent data = new Intent();
                    data.putExtra(EXTRA_TEXT, payload);
                    setResult(RESULT_OK, data);
                    finish();
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "analyzeFrame error", e);
        } finally {
            qrCodeReader.reset();
            multiFormatReader.reset();
            image.close();
        }
    }

    /**
     * Extracts pure 8-bit Y plane data without rowStride padding into target array.
     */
    private void toContinuousY(ImageProxy image, byte[] out) {
        ImageProxy.PlaneProxy yPlane = image.getPlanes()[0];
        ByteBuffer yBuffer = yPlane.getBuffer();
        int rowStride = yPlane.getRowStride();
        int width = image.getWidth();
        int height = image.getHeight();

        int bufferPos = yBuffer.position();

        if (rowStride == width) {
            yBuffer.get(out, 0, width * height);
        } else {
            for (int row = 0; row < height; row++) {
                yBuffer.position(bufferPos + row * rowStride);
                yBuffer.get(out, row * width, width);
            }
        }
    }

    /**
     * Rotates Y plane byte array to match display rotation degrees into dest array.
     */
    private void rotateY(byte[] src, byte[] dest, int width, int height, int rotation) {
        if (rotation == 0) {
            System.arraycopy(src, 0, dest, 0, width * height);
            return;
        }
        if (rotation == 90) {
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    dest[x * height + (height - 1 - y)] = src[y * width + x];
                }
            }
        } else if (rotation == 180) {
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    dest[(height - 1 - y) * width + (width - 1 - x)] = src[y * width + x];
                }
            }
        } else if (rotation == 270) {
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    dest[(width - 1 - x) * height + y] = src[y * width + x];
                }
            }
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
        autoFocusHandler.removeCallbacksAndMessages(null);
        if (analysisExecutor != null) {
            analysisExecutor.shutdown();
        }
        qrCodeReader.reset();
        multiFormatReader.reset();
    }
}
