package com.azulado.recetas;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Vision client. The API credential is encrypted with Android Keystore, never
 * embedded in the APK, never returned to JavaScript or logged.
 * The ONLY network request is the user's explicitly requested photo analysis.
 */
public final class GroqRecipeScanner {
    private GroqRecipeScanner() {}
    private static final String MODEL = "qwen/qwen3.8-27b";
    private static final String ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
    private static final String KEY_ALIAS = "recetas_azulado_groq_aes_v1";
    private static final String PREF = "private_groq_settings";
    private static final String PREF_KEY = "encrypted_key";
    private static final int MAX_RESPONSE = 260000;

    public static boolean hasKey(Context ctx) {
        try { return readKey(ctx).length() > 8; } catch (Exception ex) { return false; }
    }

    public static void saveKey(Context ctx, String value) throws Exception {
        if (value == null || !value.trim().startsWith("gsk_") || value.trim().length() < 20 || value.trim().length() > 250) {
            throw new IOException("La clave de Groq no tiene el formato esperado (gsk_...).");
        }
        byte[] plain = value.trim().getBytes(StandardCharsets.UTF_8);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secureKey());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plain);
        byte[] joined = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, joined, 0, iv.length);
        System.arraycopy(encrypted, 0, joined, iv.length, encrypted.length);
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit()
            .putString(PREF_KEY, Base64.encodeToString(joined, Base64.NO_WRAP)).apply();
        Arrays.fill(plain, (byte) 0);
    }

    public static void removeKey(Context ctx) {
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().remove(PREF_KEY).apply();
    }

    private static SecretKey secureKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry)entry).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }

    private static String readKey(Context ctx) throws Exception {
        SharedPreferences prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        String data = prefs.getString(PREF_KEY, null);
        if (data == null || data.isEmpty()) return "";
        byte[] joined = Base64.decode(data, Base64.DEFAULT);
        if (joined.length < 29) return "";
        byte[] iv = Arrays.copyOfRange(joined, 0, 12);
        byte[] content = Arrays.copyOfRange(joined, 12, joined.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, secureKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(content), StandardCharsets.UTF_8);
    }

    private static final String PROMPT =
        "Leé esta FOTO de una receta de repostería (manuscrita o impresa). Respondé SOLO un objeto JSON válido, en español argentino, " +
        "con EXACTAMENTE estas claves de nivel superior: name (string), category (string), yield (number o null), " +
        "yieldUnit (string), ingredients (array), instructions (string), notes (string), warnings (array de strings). " +
        "Cada elemento de ingredients debe tener: name (string), amount (number o null), unit " +
        "(EXACTAMENTE una de: g, kg, ml, l, unid., cda., cdta., pizca, otro), ambiguous (boolean), note (string). " +
        "Transcribí lo que REALMENTE dice la imagen. NO inventes cantidades, unidades, instrucciones ni rendimiento. " +
        "Si el texto es ilegible o confuso, poné amount:null, ambiguous:true y explicá la duda en note. " +
        "No conviertas huevos en gramos sin que se indique. Si las unidades no aparecen, usa unit:'otro' y ambiguous:true. " +
        "Si la receta solo dice x6, NO infieras el número de cookies: yield debe ser null y explicá en warnings. " +
        "Si no hay rendimiento explícito, yield:null y yieldUnit:'unidades'. " +
        "No combines ingredientes parecidos en una sola fila. " +
        "Pasos de elaboración solo si figuran en la imagen. Mantener al menos el nombre, incluso si todo es incierto. " +
        "Si no parece una receta, devolver ingredients:[] y agregar warning de imagen no válida.";

    private static byte[] jpegPhoto(Context ctx, Uri uri) throws Exception {
        int degrees = 0;
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("No se pudo leer la imagen.");
            ExifInterface exif = new ExifInterface(in);
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (o == ExifInterface.ORIENTATION_ROTATE_90) degrees = 90;
            else if (o == ExifInterface.ORIENTATION_ROTATE_180) degrees = 180;
            else if (o == ExifInterface.ORIENTATION_ROTATE_270) degrees = 270;
        } catch (IOException ignored) { /* El EXIF es opcional. */ }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("No se pudo leer la foto.");
            BitmapFactory.decodeStream(in, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("El archivo no es una imagen válida.");
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / sample > 2400) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bmp;
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("No se pudo abrir la imagen.");
            bmp = BitmapFactory.decodeStream(in, null, options);
        }
        if (bmp == null) throw new IOException("No se pudo decodificar la imagen.");
        if (degrees != 0) {
            Matrix rotation = new Matrix(); rotation.postRotate(degrees);
            Bitmap rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), rotation, true);
            if (rotated != bmp) bmp.recycle();
            bmp = rotated;
        }
        float ratio = Math.min(1f, 2200f / Math.max(bmp.getWidth(), bmp.getHeight()));
        if (ratio < 1) {
            Bitmap resized = Bitmap.createScaledBitmap(bmp, Math.max(1,Math.round(bmp.getWidth()*ratio)),
                Math.max(1,Math.round(bmp.getHeight()*ratio)), true);
            if (resized != bmp) bmp.recycle();
            bmp = resized;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 87, out);
        bmp.recycle();
        if (out.size() > 8 * 1024 * 1024) throw new IOException("La fotografía es demasiado grande.");
        return out.toByteArray();
    }

    /**
     * Un HTTP 429 puede indicar TPM, RPD, RPM, cuota o saturación temporal.
     * Conservamos el motivo y retry-after del proveedor, sin registrar secretos.
     */
    private static IOException groqError(HttpURLConnection connection, int status) {
        String rawMessage = "";
        String code = "";
        try (InputStream stream = connection.getErrorStream()) {
            if (stream != null) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[2048]; int count;
                while ((count = stream.read(buf)) > 0 && out.size() < 12000) {
                    out.write(buf, 0, Math.min(count, 12000 - out.size()));
                }
                JSONObject error = new JSONObject(out.toString("UTF-8")).optJSONObject("error");
                if (error != null) {
                    rawMessage = error.optString("message", "");
                    code = error.optString("code", "");
                }
            }
        } catch (Exception ignored) {
            // Algunos gateways no devuelven cuerpo JSON; preservamos el HTTP.
        }
        // Los errores del proveedor son datos externos; ocultar tokens y evitar textos excesivos.
        String safeMessage = rawMessage.replaceAll("gsk_[A-Za-z0-9_-]+", "[clave oculta]").replaceAll("\\s+", " ").trim();
        if (safeMessage.length() > 360) safeMessage = safeMessage.substring(0, 360) + "…";
        String low = (safeMessage + " " + code).toLowerCase(java.util.Locale.ROOT);
        String wait = connection.getHeaderField("Retry-After");
        int waitSeconds = -1;
        try {
            if (wait != null) waitSeconds = Math.max(0, (int)Math.ceil(Double.parseDouble(wait.trim())));
        } catch (NumberFormatException ignored) { }
        if (status == 429) {
            String reason = "Groq rechazó temporalmente el análisis por un límite de uso";
            if (low.contains("token") || low.contains("tpm") || low.contains("itpm") || low.contains("otpm"))
                reason = "Groq informó un límite de tokens, no necesariamente de fotos";
            else if (low.contains("per day") || low.contains("daily") || low.contains("rpd") || low.contains("tpd"))
                reason = "Groq informó un límite diario de la cuenta";
            else if (low.contains("request") || low.contains("rpm"))
                reason = "Groq informó un límite de solicitudes";
            String action = waitSeconds >= 0
                ? " Reintentá dentro de " + waitSeconds + " segundos con la misma foto."
                : " Consultá los límites de tu organización en console.groq.com/settings/limits.";
            return new IOException("HTTP 429: " + reason + "." + action
                + (safeMessage.isEmpty() ? "" : " Detalle de Groq: " + safeMessage));
        }
        if (status == 401) return new IOException("HTTP 401: clave de Groq inválida o revocada. Revisá la clave configurada.");
        if (status == 403) return new IOException("HTTP 403: la clave no tiene acceso a este modelo de Groq. Revisá los permisos de tu proyecto."
            + (safeMessage.isEmpty() ? "" : " Detalle: " + safeMessage));
        if (status == 400 || status == 413) return new IOException("HTTP " + status + ": Groq rechazó el contenido de la solicitud. "
            + (safeMessage.isEmpty() ? "Verificá la foto y su tamaño." : safeMessage));
        if (status >= 500) return new IOException("HTTP " + status + ": el servicio de Groq no está disponible temporalmente."
            + (safeMessage.isEmpty() ? "" : " Detalle: " + safeMessage));
        return new IOException("HTTP " + status + " de Groq. " + (safeMessage.isEmpty() ? "Revisá los límites y permisos del proyecto." : safeMessage));
    }

    public static String scan(Context ctx, Uri uri) throws Exception {
        String key = readKey(ctx);
        if (key.isEmpty()) throw new IOException("Configurá tu clave de Groq antes de analizar fotos.");
        byte[] jpg = jpegPhoto(ctx, uri);
        String encoded = Base64.encodeToString(jpg, Base64.NO_WRAP);
        Arrays.fill(jpg, (byte)0);
        JSONArray content = new JSONArray().put(new JSONObject().put("type","text").put("text", PROMPT))
            .put(new JSONObject().put("type", "image_url")
                .put("image_url",new JSONObject().put("url","data:image/jpeg;base64," + encoded)));
        JSONArray messages = new JSONArray().put(new JSONObject().put("role","user").put("content",content));
        JSONObject request = new JSONObject().put("model",MODEL).put("messages",messages)
            .put("temperature",0).put("max_completion_tokens",1700)
            .put("reasoning_effort","none")
            .put("response_format",new JSONObject().put("type","json_object"));
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(17000);
        connection.setReadTimeout(85000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Authorization", "Bearer " + key);
        byte[] body = request.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(body.length);
        try {
            try (OutputStream out = connection.getOutputStream()) { out.write(body); }
            int status = connection.getResponseCode();
            if (status != 200) {
                throw groqError(connection, status);
            }
            byte[] output;
            try (InputStream in=connection.getInputStream(); ByteArrayOutputStream buffer=new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192]; int n;
                while ((n=in.read(chunk))!=-1) {
                    if (buffer.size()+n>MAX_RESPONSE) throw new IOException("La respuesta de Groq es demasiado grande.");
                    buffer.write(chunk,0,n);
                }
                output=buffer.toByteArray();
            }
            JSONObject response = new JSONObject(new String(output,StandardCharsets.UTF_8));
            String json = response.getJSONArray("choices").getJSONObject(0)
                .getJSONObject("message").getString("content");
            JSONObject parsed = new JSONObject(json);
            if (!parsed.has("ingredients") || !(parsed.opt("ingredients") instanceof JSONArray))
                throw new IOException("Groq devolvió un formato incompleto. Volvé a intentar.");
            return parsed.toString();
        } finally {
            connection.disconnect();
            Arrays.fill(body,(byte)0);
        }
    }
}
