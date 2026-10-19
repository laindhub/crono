package com.azulado.recetas;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ClipData;
import androidx.core.content.FileProvider;
import android.provider.MediaStore;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Contenedor Android totalmente offline: los archivos de interfaz se resuelven
 * en un origen HTTPS local interceptado, sin servidores ni llamadas de red.
 */
public final class MainActivity extends Activity {
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    private static final String ASSET_PREFIX = "/assets/";
    private static final int REQUEST_IMPORT = 201;
    private static final int REQUEST_EXPORT = 202;
    private static final int REQUEST_CAMERA = 301;
    private static final int REQUEST_GALLERY = 302;
    private static final int MAX_BACKUP_BYTES = 5 * 1024 * 1024;
    private WebView browser;
    private String pendingExport;
    private Uri cameraPhoto;
    private Uri lastScanPhoto;
    private final AtomicBoolean scanInProgress = new AtomicBoolean(false);
    private final ExecutorService scanWorker = Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(251, 248, 243));
        getWindow().setNavigationBarColor(Color.rgb(255, 253, 249));
        getWindow().getDecorView().setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
            android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );

        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(251, 248, 243));
        browser.getSettings().setJavaScriptEnabled(true);
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setAllowFileAccess(false);
        browser.getSettings().setAllowContentAccess(false);
        browser.getSettings().setAllowFileAccessFromFileURLs(false);
        browser.getSettings().setAllowUniversalAccessFromFileURLs(false);
        browser.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        browser.getSettings().setSupportMultipleWindows(false);
        browser.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.getSettings().setDefaultTextEncodingName("UTF-8");
        browser.setWebViewClient(new LocalOnlyClient());
        browser.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Recetas Azulado")
                    .setMessage(message)
                    .setPositiveButton("Confirmar", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
                return true;
            }
        });
        browser.addJavascriptInterface(new NativeFunctions(), "RecetasAndroid");
        setContentView(browser);
        browser.loadUrl(LOCAL_ORIGIN + ASSET_PREFIX + "index.html");
    }

    private final class LocalOnlyClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) &&
                "appassets.androidplatform.net".equals(uri.getHost()) &&
                uri.getPath() != null && uri.getPath().startsWith(ASSET_PREFIX)) {
                String asset = uri.getPath().substring(ASSET_PREFIX.length());
                // Evita path traversal y restringe a recursos previstos de la aplicación.
                if (!(asset.equals("index.html") || asset.equals("styles.css") ||
                      asset.equals("logic.js") || asset.equals("app.js") ||
                      asset.equals("brand-logo.png"))) return denied();
                String mime = asset.endsWith(".html") ? "text/html" :
                              asset.endsWith(".css") ? "text/css" :
                              asset.endsWith(".png") ? "image/png" : "application/javascript";
                try {
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(asset));
                } catch (IOException ex) { return denied(); }
            }
            return denied();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !LOCAL_ORIGIN.concat(ASSET_PREFIX + "index.html").equals(request.getUrl().toString());
        }

        private WebResourceResponse denied() {
            return new WebResourceResponse("text/plain", "UTF-8",
                new ByteArrayInputStream(new byte[0]));
        }
    }

    private final class NativeFunctions {
        @JavascriptInterface
        public void exportBackup(String contents) {
            if (contents == null || contents.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
                notifyWeb("El respaldo es demasiado grande.");
                return;
            }
            runOnUiThread(() -> {
                pendingExport = contents;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "recetas-azulado.json");
                startActivityForResult(intent, REQUEST_EXPORT);
            });
        }

        @JavascriptInterface
        public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                startActivityForResult(intent, REQUEST_IMPORT);
            });
        }

        @JavascriptInterface
        public boolean hasGroqKey() { return GroqRecipeScanner.hasKey(MainActivity.this); }

        @JavascriptInterface
        public void saveGroqKey(String key) {
            try {
                GroqRecipeScanner.saveKey(MainActivity.this,key);
                reportToWeb("window.azGroqKeyResult", "Clave guardada cifrada en el dispositivo.");
            } catch (Exception ex) { reportToWeb("window.azGroqKeyResult",ex.getMessage()); }
        }

        @JavascriptInterface
        public void clearGroqKey() {
            GroqRecipeScanner.removeKey(MainActivity.this);
            reportToWeb("window.azGroqKeyResult", "Clave de Groq eliminada.");
        }

        @JavascriptInterface
        public void chooseRecipePhoto(boolean camera) {
            runOnUiThread(() -> {
                try {
                    if (camera) {
                        File dir = new File(getCacheDir(), "camera");
                        if (!dir.exists() && !dir.mkdirs()) throw new IOException("No se pudo preparar la cámara.");
                        File file = new File(dir, "azulado-scan.jpg");
                        cameraPhoto = FileProvider.getUriForFile(MainActivity.this,
                            getPackageName() + ".files", file);
                        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhoto);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        intent.setClipData(ClipData.newRawUri("Foto de receta",cameraPhoto));
                        startActivityForResult(intent, REQUEST_CAMERA);
                    } else {
                        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("image/*");
                        startActivityForResult(intent, REQUEST_GALLERY);
                    }
                } catch (Exception ex) { notifyWeb("No se pudo abrir la cámara o la galería."); }
            });
        }

        @JavascriptInterface
        public boolean canRetryPhoto() {
            return lastScanPhoto != null;
        }

        @JavascriptInterface
        public void retryRecipePhoto() {
            Uri saved = lastScanPhoto;
            if (saved == null) {
                reportToWeb("window.azScanFailed", "La fotografía ya no está disponible. Volvé a elegirla.");
                return;
            }
            startPhotoScan(saved);
        }

        @JavascriptInterface
        public void shareText(String text) {
            if (text == null || text.length() > 150000) return;
            runOnUiThread(() -> {
                Intent share = new Intent(Intent.ACTION_SEND);
                share.setType("text/plain");
                share.putExtra(Intent.EXTRA_SUBJECT, "Ingredientes · Recetas Azulado");
                share.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(share, "Compartir cantidades"));
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CAMERA || requestCode == REQUEST_GALLERY) {
            if (resultCode == RESULT_OK) {
                Uri photo = requestCode == REQUEST_CAMERA ? cameraPhoto : (data == null ? null : data.getData());
                if (photo == null) { reportToWeb("window.azScanFailed", "No se recibió ninguna foto."); return; }
                if (requestCode == REQUEST_GALLERY && data != null) {
                    try {
                        getContentResolver().takePersistableUriPermission(photo, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) { /* El permiso de la sesión continúa disponible. */ }
                }
                startPhotoScan(photo);
            }
            return;
        }
        if (requestCode == REQUEST_EXPORT) {
            String contents = pendingExport;
            pendingExport = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && contents != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IOException("Archivo inaccesible");
                    out.write(contents.getBytes(StandardCharsets.UTF_8));
                    notifyWeb("Respaldo guardado correctamente.");
                } catch (Exception ex) { notifyWeb("No fue posible guardar el archivo."); }
            }
        } else if (requestCode == REQUEST_IMPORT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (InputStream input = getContentResolver().openInputStream(data.getData())) {
                    if (input == null) throw new IOException("Archivo inaccesible");
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int amount;
                    while ((amount = input.read(buffer)) != -1) {
                        if (bytes.size() + amount > MAX_BACKUP_BYTES) throw new IOException("Archivo demasiado grande");
                        bytes.write(buffer, 0, amount);
                    }
                    String json = bytes.toString("UTF-8");
                    browser.evaluateJavascript("window.receiveBackupJson(" + JSONObject.quote(json) + ")", null);
                } catch (Exception ex) { notifyWeb("No se pudo abrir el respaldo. Máximo: 5 MB."); }
            }
        }
    }

    private void startPhotoScan(Uri photo) {
        if (!scanInProgress.compareAndSet(false, true)) return;
        lastScanPhoto = photo;
        reportToWeb("window.azScanStarted", "Leyendo foto con Groq…");
        scanWorker.execute(() -> {
            try {
                reportToWeb("window.azScanFinished", GroqRecipeScanner.scan(getApplicationContext(),photo));
            } catch (Exception ex) {
                reportToWeb("window.azScanFailed", ex.getMessage() == null ? "Error de conexión con Groq." : ex.getMessage());
            } finally {
                scanInProgress.set(false);
            }
        });
    }

    private void reportToWeb(String jsFunction, String value) {
        // Only hardcoded callback names from this native class are accepted.
        runOnUiThread(() -> {
            if (browser != null) browser.evaluateJavascript(jsFunction + "(" + JSONObject.quote(value) + ")", null);
        });
    }

    private void notifyWeb(String message) {
        runOnUiThread(() -> browser.evaluateJavascript(
            "window.nativeActionResult(" + JSONObject.quote(message) + ")", null));
    }

    @Override
    @Deprecated
    public void onBackPressed() {
        browser.evaluateJavascript("Boolean(window.azBack && window.azBack())", result -> {
            if (!"true".equals(result)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        scanWorker.shutdownNow();
        if (browser != null) {
            browser.removeJavascriptInterface("RecetasAndroid");
            browser.destroy();
        }
        super.onDestroy();
    }
}
