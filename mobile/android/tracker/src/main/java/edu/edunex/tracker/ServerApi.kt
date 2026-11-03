package edu.edunex.tracker

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** A failed API call with the server's message and error code. */
class ServerException(val status: Int, val code: String, message: String, val details: JSONObject? = null) : Exception(message)

/** Minimal JSON-over-HTTPS client for the tracker (no user session is ever stored). */
object ServerApi {
    suspend fun call(
        server: String, method: String, path: String, bearer: String? = null, body: JSONObject? = null,
    ): JSONObject = withContext(Dispatchers.IO) {
        val conn = (URL(server.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-Client-Type", "mobile")
            bearer?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONTokener(text).nextValue() as? JSONObject }.getOrNull() ?: JSONObject()
            if (code !in 200..299) {
                throw ServerException(code, json.optString("error", "HTTP_$code"), json.optString("message").ifBlank { "Request failed ($code)" }, json.optJSONObject("details"))
            }
            json
        } finally {
            conn.disconnect()
        }
    }

    fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
}

/**
 * A short-lived administrator sign-in on the phone, used only while connecting
 * the phone to a device and a student. Kept in memory and signed out at the end.
 */
class AdminSession private constructor(
    val server: String,
    private val accessToken: String,
    private val refreshToken: String?,
    val name: String,
) {
    companion object {
        suspend fun signIn(server: String, identifier: String, password: String): AdminSession {
            val r = ServerApi.call(server, "POST", "/api/auth/login", body = JSONObject()
                .put("identifier", identifier.trim()).put("password", password).put("clientType", "mobile"))
            val data = r.getJSONObject("data")
            val user = data.getJSONObject("user")
            val perms = user.optJSONArray("permissions") ?: JSONArray()
            val s = AdminSession(server, data.getString("accessToken"), data.optString("refreshToken").ifBlank { null }, user.optString("fullName"))
            if ((0 until perms.length()).none { perms.optString(it) == "tracking.manage" }) {
                s.signOut()
                throw ServerException(403, "FORBIDDEN", "${s.name} cannot manage GPS devices. Sign in as Principal, School Admin or Super Admin.")
            }
            return s
        }
    }

    private suspend fun api(method: String, path: String, body: JSONObject? = null) =
        ServerApi.call(server, method, path, accessToken, body)

    /** Finds a device from what the label QR contains (device ID, IMEI, serial…). */
    suspend fun lookup(code: String): DeviceInfo = DeviceInfo.from(api("GET", "/api/devices/lookup?code=${ServerApi.enc(code)}").getJSONObject("data"))

    /** Issues a fresh token for the device. The previous token stops working. */
    suspend fun issueToken(deviceCode: String): String =
        api("POST", "/api/devices/${ServerApi.enc(deviceCode)}/token", JSONObject()).getJSONObject("data").getString("token")

    /** Registers this phone as a new device; returns (device, token). */
    suspend fun registerPhone(note: String): Pair<DeviceInfo, String> {
        val d = api("POST", "/api/devices", JSONObject().put("deviceType", "mobile_app").put("notes", note)).getJSONObject("data")
        return DeviceInfo.from(d.getJSONObject("device")) to d.getString("token")
    }

    suspend fun searchStudents(q: String): List<StudentInfo> {
        val arr = api("GET", "/api/tracking/students?pageSize=20&q=${ServerApi.enc(q)}").optJSONArray("data") ?: JSONArray()
        return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.map {
            StudentInfo(
                id = it.optString("studentId"), admissionNo = it.optString("admissionNo"), fullName = it.optString("fullName"),
                grade = listOfNotNull(it.optString("grade").takeIf { g -> g.isNotBlank() && g != "null" }, it.optString("section").takeIf { g -> g.isNotBlank() && g != "null" }).joinToString(""),
                currentDevice = it.optString("deviceCode").takeIf { d -> d.isNotBlank() && d != "null" },
            )
        }
    }

    /** Assigns; throws ServerException(code = REASSIGN_REQUIRED) when confirmation is needed. */
    suspend fun assign(studentId: String, deviceCode: String, reassign: Boolean) {
        api("POST", "/api/device-assignments", JSONObject()
            .put("studentId", studentId).put("deviceId", deviceCode).put("reassign", reassign)
            .put("notes", "Assigned from the GPS Tracker app"))
    }

    suspend fun signOut() {
        refreshToken?.let { runCatching { ServerApi.call(server, "POST", "/api/auth/logout", body = JSONObject().put("refreshToken", it)) } }
    }
}

data class DeviceInfo(
    val deviceCode: String,
    val deviceType: String,
    val status: String,
    val hasToken: Boolean,
    val lastSeenAt: String?,
    val studentName: String?,
    val admissionNo: String?,
) {
    companion object {
        fun from(o: JSONObject) = DeviceInfo(
            deviceCode = o.optString("deviceCode"),
            deviceType = o.optString("deviceType"),
            status = o.optString("status"),
            hasToken = o.optBoolean("hasToken"),
            lastSeenAt = o.str("lastSeenAt"),
            studentName = o.str("studentName"),
            admissionNo = o.str("admissionNo"),
        )
    }
}

data class StudentInfo(val id: String, val admissionNo: String, val fullName: String, val grade: String, val currentDevice: String?)

/** GET /api/v1/device/status — what the server knows about this phone. */
data class ServerStatus(
    val deviceStatus: String,
    val gpsStatus: String,
    val lastSeenAt: String?,
    val studentName: String?,
    val admissionNo: String?,
    val grade: String?,
    val trackingEnabled: Boolean,
    val todayPoints: Int,
    val todayKm: Double,
    val todayFirst: String?,
    val todayLast: String?,
    val assignmentPoints: Int,
    val fetchedAt: Long = System.currentTimeMillis(),
) {
    companion object {
        suspend fun fetch(): ServerStatus {
            val d = ServerApi.call(TrackerConfig.server, "GET", "/api/v1/device/status", TrackerConfig.token).getJSONObject("data")
            val dev = d.getJSONObject("device")
            val st = d.optJSONObject("student")
            val today = d.optJSONObject("today") ?: JSONObject()
            return ServerStatus(
                deviceStatus = dev.optString("status"),
                gpsStatus = dev.optString("gpsStatus"),
                lastSeenAt = dev.str("lastSeenAt"),
                studentName = st?.str("fullName"),
                admissionNo = st?.str("admissionNo"),
                grade = st?.let { listOfNotNull(it.str("grade"), it.str("section")).joinToString("") }?.ifBlank { null },
                trackingEnabled = st?.optBoolean("trackingEnabled") ?: false,
                todayPoints = today.optInt("points"),
                todayKm = today.optDouble("distanceKm", 0.0),
                todayFirst = today.str("firstAt"),
                todayLast = today.str("lastAt"),
                assignmentPoints = d.optInt("assignmentPoints"),
            )
        }
    }
}

private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() && it != "null" }
