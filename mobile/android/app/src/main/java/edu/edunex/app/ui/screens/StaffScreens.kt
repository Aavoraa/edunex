package edu.edunex.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import edu.edunex.app.data.Api
import edu.edunex.app.data.objects
import edu.edunex.app.data.prettyDate
import edu.edunex.app.data.str
import edu.edunex.app.data.today
import edu.edunex.app.ui.Empty
import edu.edunex.app.ui.InfoCard
import edu.edunex.app.ui.Loaded
import edu.edunex.app.ui.LocalNav
import edu.edunex.app.ui.PrimaryButton
import edu.edunex.app.ui.Route
import edu.edunex.app.ui.ScreenList
import edu.edunex.app.ui.SectionTitle
import edu.edunex.app.ui.StatRow
import edu.edunex.app.ui.StatusChip
import edu.edunex.app.ui.rememberLoad
import org.json.JSONObject

@Composable
fun GateLogScreen() {
    val nav = LocalNav.current
    val state = rememberLoad {
        Api.get("/api/gate/events", mapOf("date" to today(), "pageSize" to 100, "sort" to "time", "dir" to "desc")).arr().objects()
    }
    var admissionNo by remember { mutableStateOf("") }
    var direction by remember { mutableStateOf("in") }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()
    Loaded(state) { events ->
        ScreenList {
            if (nav.user.can("safety.manage")) {
                item {
                    InfoCard("Record a gate entry", subtitle = "For students without a card scan") {
                        OutlinedTextField(admissionNo, { admissionNo = it.trim() }, label = { Text("Admission number") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(direction == "in", { direction = "in" }, { Text("Coming in") })
                            FilterChip(direction == "out", { direction = "out" }, { Text("Going out") })
                        }
                        PrimaryButton("Record", busy, enabled = admissionNo.isNotBlank()) {
                            val body = JSONObject().put("studentId", admissionNo).put("direction", direction).put("method", "Manual")
                            act({ busy = it }, "Gate entry recorded", { Api.post("/api/gate/events", body) }) { admissionNo = ""; state.reload() }
                        }
                    }
                }
            }
            item { SectionTitle("Today's scans") }
            if (events.isEmpty()) item { Text("No scans yet today.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(events) { e ->
                InfoCard(
                    e.str("fullName") ?: "",
                    subtitle = "${e.str("grade").orEmpty()}${e.str("section").orEmpty()} · ${e.str("gate").orEmpty()} · ${e.str("method").orEmpty()} · ${prettyDate(e.str("occurredAt"))}",
                    trailing = { StatusChip(if (e.str("direction") == "in") "In" else "Out") },
                )
            }
        }
    }
}

@Composable
fun BoardingScreen() {
    val nav = LocalNav.current
    val state = rememberLoad { Api.get("/api/transport/boarding/summary").obj() }
    Loaded(state) { s ->
        ScreenList {
            item {
                StatRow(
                    "Boarded" to s.optInt("boarded").toString(),
                    "On bus" to s.optInt("stillOnboard").toString(),
                    "Not boarded" to s.optInt("notBoarded").toString(),
                    "Expected" to s.optInt("expected").toString(),
                )
            }
            item { SectionTitle("Routes") }
            items(s.optJSONArray("routes")?.objects().orEmpty()) { r ->
                InfoCard(
                    "${r.str("code").orEmpty()} · ${r.str("name").orEmpty()}",
                    subtitle = "Bus ${r.str("busNo").orEmpty()} · ${r.optInt("boarded")}/${r.optInt("expected")} boarded",
                    trailing = { StatusChip(r.str("runStatus")) },
                    onClick = { nav.go(Route.BoardingRoute(r.optString("id"), r.optString("name"))) },
                )
            }
        }
    }
}

@Composable
fun BoardingRouteScreen(routeId: String) {
    val nav = LocalNav.current
    val state = rememberLoad(routeId) { Api.get("/api/transport/routes/$routeId").obj() }
    val act = rememberAction()
    val canManage = nav.user.can("transport.manage")
    Loaded(state) { r ->
        val students = r.optJSONArray("students")?.objects().orEmpty()
        if (students.isEmpty()) Empty("No students on this route.") else ScreenList {
            items(students) { st ->
                var busy by remember { mutableStateOf(false) }
                val onBus = st.str("boardedAt") != null && st.str("deboardedAt") == null
                val status = when { st.str("deboardedAt") != null -> "Dropped"; onBus -> "Boarded"; else -> "Not boarded" }
                InfoCard(st.str("fullName") ?: "", subtitle = "${st.str("grade").orEmpty()}${st.str("section").orEmpty()} · ${st.str("stopName").orEmpty()}",
                    trailing = { StatusChip(status) }) {
                    if (canManage && status != "Dropped") {
                        val type = if (onBus) "deboarded" else "boarded"
                        OutlinedButton(enabled = !busy, onClick = {
                            val body = JSONObject().put("studentId", st.optString("id")).put("routeId", routeId).put("eventType", type)
                                .put("stopId", st.str("stopId") ?: JSONObject.NULL).put("method", "Manual")
                            act({ busy = it }, if (onBus) "Marked dropped" else "Marked boarded", { Api.post("/api/transport/boarding", body) }) { state.reload() }
                        }) { Text(if (onBus) "Mark dropped" else "Mark boarded", fontWeight = FontWeight.SemiBold) }
                    }
                }
            }
        }
    }
}

@Composable
fun VisitorsScreen() {
    val nav = LocalNav.current
    val state = rememberLoad { Api.get("/api/visitors", mapOf("date" to today(), "pageSize" to 100)).arr().objects() }
    val act = rememberAction()
    Loaded(state) { list ->
        if (list.isEmpty()) Empty("No visitors today.") else ScreenList {
            items(list) { v ->
                var busy by remember { mutableStateOf(false) }
                val status = v.str("status")
                InfoCard(
                    v.str("fullName") ?: "",
                    subtitle = "${v.str("purpose").orEmpty()} · meeting ${v.str("hostName") ?: "—"}\n" +
                        listOfNotNull(v.str("checkedInAt")?.let { "In ${prettyDate(it)}" }, v.str("checkedOutAt")?.let { "Out ${prettyDate(it)}" }).joinToString(" · "),
                    trailing = { StatusChip(status) },
                ) {
                    if (nav.user.can("safety.manage")) {
                        val next = when (status) { "Expected" -> "check-in" to "Check in"; "Inside" -> "check-out" to "Check out"; else -> null }
                        if (next != null) OutlinedButton(enabled = !busy, onClick = {
                            act({ busy = it }, "Visitor updated", { Api.post("/api/visitors/${v.str("id")}/${next.first}") }) { state.reload() }
                        }) { Text(next.second) }
                    }
                }
            }
        }
    }
}
