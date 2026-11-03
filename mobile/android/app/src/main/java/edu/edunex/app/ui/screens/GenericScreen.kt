package edu.edunex.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import edu.edunex.app.data.Api
import edu.edunex.app.data.friendly
import edu.edunex.app.data.money
import edu.edunex.app.data.objects
import edu.edunex.app.data.prettyDate
import edu.edunex.app.ui.Empty
import edu.edunex.app.ui.InfoCard
import edu.edunex.app.ui.Loaded
import edu.edunex.app.ui.LocalNav
import edu.edunex.app.ui.Route
import edu.edunex.app.ui.ScreenList
import edu.edunex.app.ui.SectionTitle
import edu.edunex.app.ui.StatusChip
import edu.edunex.app.ui.rememberLoad
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Read-only view for any endpoint: a paged list of records, or a summary object.
 * Used for back-office lists (finance, admissions, HR) where the phone only needs to look.
 */
@Composable
fun GenericScreen(route: Route.Generic) {
    if (route.list) GenericList(route) else GenericSummary(route)
}

private const val PAGE = 30

@Composable
private fun GenericList(route: Route.Generic) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val rows = remember(route) { mutableStateListOf<JSONObject>() }
    var page by remember(route) { mutableIntStateOf(1) }
    var pages by remember(route) { mutableIntStateOf(1) }
    var loadingMore by remember { mutableStateOf(false) }
    val state = rememberLoad(route) {
        val res = Api.get(route.path, route.query + mapOf("page" to "1", "pageSize" to PAGE.toString()))
        rows.clear(); rows.addAll(res.arr().objects())
        page = 1; pages = res.meta?.optInt("totalPages", 1) ?: 1
        true
    }
    Loaded(state) {
        if (rows.isEmpty()) Empty("Nothing to show.") else ScreenList {
            items(rows) { RecordCard(it) }
            if (page < pages) item {
                TextButton(enabled = !loadingMore, onClick = {
                    scope.launch {
                        loadingMore = true
                        try {
                            val res = Api.get(route.path, route.query + mapOf("page" to (page + 1).toString(), "pageSize" to PAGE.toString()))
                            rows.addAll(res.arr().objects()); page++
                        } catch (e: Exception) { nav.toast(e.friendly()) }
                        loadingMore = false
                    }
                }) { Text(if (loadingMore) "Loading…" else "Load more") }
            }
        }
    }
}

@Composable
private fun GenericSummary(route: Route.Generic) {
    val state = rememberLoad(route) { Api.get(route.path, route.query).obj() }
    Loaded(state) { obj ->
        ScreenList {
            val scalars = obj.keys().asSequence().filter { obj.opt(it) !is JSONObject && obj.opt(it) !is JSONArray }.toList()
            if (scalars.isNotEmpty()) item {
                InfoCard(route.label) { Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { scalars.forEach { KeyValue(humanize(it), fmt(it, obj.opt(it))) } } }
            }
            obj.keys().asSequence().toList().forEach { key ->
                when (val v = obj.opt(key)) {
                    is JSONObject -> item {
                        InfoCard(humanize(key)) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                v.keys().asSequence().filter { v.opt(it) !is JSONObject && v.opt(it) !is JSONArray }
                                    .forEach { KeyValue(humanize(it), fmt(it, v.opt(it))) }
                            }
                        }
                    }
                    is JSONArray -> if (v.length() > 0 && v.opt(0) is JSONObject) {
                        item { SectionTitle(humanize(key)) }
                        items(v.objects().take(15)) { RecordCard(it) }
                    }
                }
            }
        }
    }
}

private val TITLE_KEYS = listOf("fullName", "studentName", "employeeName", "parentName", "name", "title", "description", "label", "code")
private val HIDDEN = setOf("id", "photoUrl", "route", "icon", "tone", "status", "displayStatus")

/** Picks a sensible title, status and three short details from any record. */
@Composable
fun RecordCard(o: JSONObject) {
    val titleKey = TITLE_KEYS.firstOrNull { o.optString(it).isNotBlank() && !o.isNull(it) }
    val details = o.keys().asSequence()
        .filter { it != titleKey && it !in HIDDEN && !it.endsWith("Id") && !o.isNull(it) }
        .filter { val v = o.opt(it); (v is String && v.isNotBlank() && v.length < 60) || v is Number }
        .take(4)
        .map { fmt(it, o.opt(it)).let { v -> if (o.opt(it) is Number) "${humanize(it)} $v" else v } }
        .joinToString(" · ")
    InfoCard(
        titleKey?.let { o.optString(it) } ?: "Record",
        subtitle = details,
        trailing = { StatusChip(o.optString("displayStatus").ifBlank { o.optString("status") }.takeIf { it.isNotBlank() && it != "null" }) },
    )
}

private val MONEY = Regex("(?i)(amount|billed|paid|collected|outstanding|balance|gross|net|deductions|fee|budget|spent|total[A-Z]?.*amount)")

private fun fmt(key: String, v: Any?): String = when {
    v == null || v == JSONObject.NULL -> "—"
    v is Number && MONEY.containsMatchIn(key) -> money(v.toDouble())
    v is Number -> if (v.toDouble() % 1.0 == 0.0) v.toLong().toString() else "%.1f".format(v.toDouble())
    v is Boolean -> if (v) "Yes" else "No"
    v is String && Regex("""^\d{4}-\d{2}-\d{2}""").containsMatchIn(v) -> prettyDate(v)
    else -> v.toString()
}

/** "collectedToday" → "Collected today". */
fun humanize(key: String): String =
    key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replace('_', ' ').lowercase().replaceFirstChar(Char::uppercase)
