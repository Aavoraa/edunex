package edu.edunex.app.tracker

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import edu.edunex.app.data.Session
import org.json.JSONArray
import org.json.JSONObject

/**
 * GPS-tracker settings for this phone: server, device ID and device token,
 * kept in EncryptedSharedPreferences. The token is what authenticates the
 * phone to POST /api/v1/location; it is separate from any user sign-in.
 *
 * Points that could not be sent (no signal) wait in a small queue and are
 * sent oldest-first when the connection returns.
 */
object TrackerConfig {
    private const val MAX_QUEUE = 2_000   // ~16 hours at 30 s
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        prefs = EncryptedSharedPreferences.create(
            context, "edunex_tracker", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var server: String
        get() = prefs.getString("server", null) ?: Session.baseUrl
        set(v) = prefs.edit().putString("server", v.trim().trimEnd('/')).apply()

    var deviceId: String
        get() = prefs.getString("deviceId", null).orEmpty()
        set(v) = prefs.edit().putString("deviceId", v.trim().uppercase()).apply()

    var token: String
        get() = prefs.getString("token", null).orEmpty()
        set(v) = prefs.edit().putString("token", v.trim()).apply()

    /** Seconds between points; the server can change it via next_interval_seconds. */
    var intervalSeconds: Int
        get() = prefs.getInt("interval", 30)
        set(v) = prefs.edit().putInt("interval", v.coerceIn(5, 3600)).apply()

    /** Whether tracking should be running (restored when the app reopens). */
    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(v) = prefs.edit().putBoolean("enabled", v).apply()

    val isConfigured get() = deviceId.isNotBlank() && token.startsWith("hsd_") && server.startsWith("http")

    fun endpoint() = server.trimEnd('/') + "/api/v1/location"

    fun clear() {
        prefs.edit().remove("deviceId").remove("token").remove("enabled").remove("queue").apply()
    }

    /**
     * Applies a setup QR from the GPS Devices page:
     *   edunex-tracker:setup?server=https://…&device=GPS000123&token=hsd_…
     * Returns an error message, or null on success.
     */
    fun applySetup(text: String): String? {
        val uri = runCatching { Uri.parse(text.trim()) }.getOrNull()
        if (uri == null || uri.scheme != "edunex-tracker") {
            return if (Regex("^[A-Z0-9][A-Z0-9-]{2,49}$").matches(text.trim().uppercase()))
                "That is a device label QR. Scan the setup QR shown when the device was registered."
            else "This is not a Edunex tracker setup code."
        }
        // Opaque URIs ("scheme:setup?…") need their query parsed by hand.
        val query = text.substringAfter('?', "")
        val params = query.split('&').mapNotNull {
            val i = it.indexOf('=')
            if (i <= 0) null else it.substring(0, i) to Uri.decode(it.substring(i + 1))
        }.toMap()
        val server = params["server"].orEmpty()
        val device = params["device"].orEmpty()
        val token = params["token"].orEmpty()
        if (!server.startsWith("http") || device.isBlank() || !token.startsWith("hsd_")) return "The setup code is incomplete."
        this.server = server
        this.deviceId = device
        this.token = token
        prefs.edit().remove("queue").apply()
        return null
    }

    // ---- offline queue ------------------------------------------------------
    @Synchronized fun queue(): MutableList<JSONObject> {
        val arr = runCatching { JSONArray(prefs.getString("queue", "[]")) }.getOrElse { JSONArray() }
        return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.toMutableList()
    }

    @Synchronized fun saveQueue(items: List<JSONObject>) {
        val arr = JSONArray()
        items.takeLast(MAX_QUEUE).forEach { arr.put(it) }
        prefs.edit().putString("queue", arr.toString()).apply()
    }

    @Synchronized fun enqueue(point: JSONObject) = saveQueue(queue().apply { add(point) })
}
