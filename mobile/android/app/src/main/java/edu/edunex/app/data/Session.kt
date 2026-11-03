package edu.edunex.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import edu.edunex.app.BuildConfig
import org.json.JSONArray
import org.json.JSONObject

/** The signed-in user as returned by POST /api/auth/login. */
data class User(
    val id: String,
    val fullName: String,
    val email: String,
    val roleKey: String,
    val roleName: String,
    val permissions: Set<String>,
    val employeeId: String?,
    val parentId: String?,
    val studentId: String?,
    val json: JSONObject,
) {
    fun can(vararg perms: String) = perms.any { it in permissions }
    val firstName get() = fullName.split(" ").firstOrNull().orEmpty()

    companion object {
        fun from(o: JSONObject): User {
            val role = o.optJSONObject("role") ?: JSONObject()
            val perms = o.optJSONArray("permissions") ?: JSONArray()
            return User(
                id = o.optString("id"),
                fullName = o.optString("fullName"),
                email = o.optString("email"),
                roleKey = role.optString("key"),
                roleName = role.optString("name"),
                permissions = (0 until perms.length()).map { perms.getString(it) }.toSet(),
                employeeId = o.str("employeeId"),
                parentId = o.str("parentId"),
                studentId = o.str("studentId"),
                json = o,
            )
        }
    }
}

/**
 * Persistent session: server address, refresh token and cached user, stored in
 * EncryptedSharedPreferences (keys protected by the Android Keystore).
 */
object Session {
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        prefs = EncryptedSharedPreferences.create(
            context, "edunex_session", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var baseUrl: String
        get() = prefs.getString("baseUrl", null) ?: BuildConfig.DEFAULT_API_URL
        set(v) = prefs.edit().putString("baseUrl", v.trim().trimEnd('/')).apply()

    val refreshToken: String? get() = prefs.getString("refreshToken", null)

    val user: User? get() = prefs.getString("user", null)?.let { runCatching { User.from(JSONObject(it)) }.getOrNull() }

    fun save(refreshToken: String, user: User) {
        prefs.edit().putString("refreshToken", refreshToken).putString("user", user.json.toString()).apply()
    }

    fun clear() {
        prefs.edit().remove("refreshToken").remove("user").apply()
    }
}
