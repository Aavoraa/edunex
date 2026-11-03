package edu.edunex.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** An API failure with the server's error code (e.g. TOKEN_EXPIRED) and a readable message. */
class ApiException(val status: Int, val code: String, message: String) : Exception(message)

/** A successful response: `data` from the envelope, plus pagination `meta` when present. */
class ApiResult(val data: Any?, val meta: JSONObject?) {
    fun obj(): JSONObject = data as? JSONObject ?: JSONObject()
    fun arr(): JSONArray = data as? JSONArray ?: JSONArray()
}

/**
 * Client for the Edunex REST API (docs/API.md). Access token lives in memory;
 * the refresh token is kept in encrypted storage by [Session]. On TOKEN_EXPIRED
 * the client refreshes once (serialised by a mutex, replacing both tokens) and
 * retries the request.
 */
object Api {
    private val refreshLock = Mutex()
    @Volatile private var accessToken: String? = null

    /** Called when the session can no longer be refreshed and the user must sign in again. */
    var onSessionExpired: (() -> Unit)? = null

    fun setAccessToken(token: String?) { accessToken = token }

    suspend fun get(path: String, query: Map<String, Any?> = emptyMap()) = call("GET", path, query, null)
    suspend fun post(path: String, body: JSONObject? = null) = call("POST", path, emptyMap(), body ?: JSONObject())
    suspend fun put(path: String, body: JSONObject) = call("PUT", path, emptyMap(), body)
    suspend fun patch(path: String, body: JSONObject? = null) = call("PATCH", path, emptyMap(), body ?: JSONObject())

    /** Signs in and stores the session. Returns the signed-in user. */
    suspend fun login(identifier: String, password: String): User {
        val body = JSONObject()
            .put("identifier", identifier.trim())
            .put("password", password)
            .put("clientType", "mobile")
        val res = raw("POST", "/api/auth/login", emptyMap(), body, auth = false)
        return saveTokens(res.obj())
    }

    /** Restores a saved session on app start. Returns null when the user must sign in. */
    suspend fun restore(): User? {
        if (Session.refreshToken == null) return null
        return try {
            refresh()
            Session.user
        } catch (e: ApiException) {
            if (e.status == 401) { Session.clear(); null } else Session.user
        } catch (e: IOException) {
            // Offline: keep the saved user so the app opens; calls will retry the refresh.
            Session.user
        }
    }

    suspend fun logout() {
        val token = Session.refreshToken
        try {
            if (token != null) raw("POST", "/api/auth/logout", emptyMap(), JSONObject().put("refreshToken", token), auth = false)
        } catch (_: Exception) {
            // Signing out locally always succeeds even if the server is unreachable.
        }
        accessToken = null
        Session.clear()
    }

    private fun saveTokens(data: JSONObject): User {
        accessToken = data.optString("accessToken")
        val user = User.from(data.getJSONObject("user"))
        Session.save(data.optString("refreshToken"), user)
        return user
    }

    private suspend fun refresh() {
        val used = Session.refreshToken ?: throw ApiException(401, "REFRESH_MISSING", "Please sign in again.")
        refreshLock.withLock {
            // Another request may have refreshed while we waited for the lock.
            if (Session.refreshToken != used && accessToken != null) return
            val res = raw("POST", "/api/auth/refresh", emptyMap(), JSONObject().put("refreshToken", used), auth = false)
            saveTokens(res.obj())
        }
    }

    private suspend fun call(method: String, path: String, query: Map<String, Any?>, body: JSONObject?): ApiResult {
        if (accessToken == null && Session.refreshToken != null) refreshOrExpire()
        return try {
            raw(method, path, query, body, auth = true)
        } catch (e: ApiException) {
            if (e.status == 401 && (e.code == "TOKEN_EXPIRED" || e.code == "UNAUTHORIZED")) {
                refreshOrExpire()
                raw(method, path, query, body, auth = true)
            } else throw e
        }
    }

    private suspend fun refreshOrExpire() {
        try {
            refresh()
        } catch (e: ApiException) {
            if (e.status == 401) {
                accessToken = null
                Session.clear()
                onSessionExpired?.invoke()
            }
            throw e
        }
    }

    private suspend fun raw(
        method: String, path: String, query: Map<String, Any?>, body: JSONObject?, auth: Boolean,
    ): ApiResult = withContext(Dispatchers.IO) {
        val qs = query.filterValues { it != null && it.toString().isNotEmpty() }
            .entries.joinToString("&") { (k, v) -> "${enc(k)}=${enc(v.toString())}" }
        val url = URL(Session.baseUrl.trimEnd('/') + path + if (qs.isEmpty()) "" else "?$qs")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-Client-Type", "mobile")
            if (auth) accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = if (text.isBlank()) JSONObject() else
                (JSONTokener(text).nextValue() as? JSONObject) ?: JSONObject()
            if (status !in 200..299 || !json.optBoolean("success", status in 200..299)) {
                val msg = json.optString("message").ifBlank { "Request failed ($status)" }
                throw ApiException(status, json.optString("error", "HTTP_$status"), detail(msg, json))
            }
            ApiResult(if (json.isNull("data")) null else json.opt("data"), json.optJSONObject("meta"))
        } finally {
            conn.disconnect()
        }
    }

    /** Adds field-level validation messages to the error text. */
    private fun detail(msg: String, json: JSONObject): String {
        val details = json.optJSONArray("details") ?: return msg
        val parts = (0 until details.length()).mapNotNull { details.optJSONObject(it)?.optString("message") }
        return if (parts.isEmpty()) msg else msg + "\n" + parts.joinToString("\n") { "• $it" }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
}

/** Human message for any failure, including network errors. */
fun Throwable.friendly(): String = when (this) {
    is ApiException -> when (code) {
        "FORBIDDEN" -> "Your account doesn't have access to this."
        "EMPLOYEE_NOT_LINKED" -> "Your account isn't linked to a staff record."
        else -> message ?: "Something went wrong."
    }
    is IOException -> "Can't reach the server. Check your connection and the server address."
    else -> message ?: "Something went wrong."
}
