package edu.edunex.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** String value or null when the key is missing, JSON null or blank. */
fun JSONObject.str(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() && it != "null" }

fun JSONObject.num(key: String): Double? = if (isNull(key)) null else opt(key).let {
    when (it) { is Number -> it.toDouble(); is String -> it.toDoubleOrNull(); else -> null }
}

fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }

private val dayFmt = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)
private val timeFmt = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH)

/** "2026-09-21" → "21 Sep 2026"; ISO timestamps → "21 Sep, 9:05 AM" (device time zone). */
fun prettyDate(v: String?): String {
    if (v.isNullOrBlank()) return "—"
    return runCatching {
        if (v.length <= 10) LocalDate.parse(v).format(dayFmt)
        else OffsetDateTime.parse(v).atZoneSameInstant(ZoneId.systemDefault()).format(timeFmt)
    }.getOrDefault(v)
}

private val inr = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN")).apply { maximumFractionDigits = 0 }

fun money(v: Double?): String = if (v == null) "—" else inr.format(v)

fun today(): String = LocalDate.now().toString()
