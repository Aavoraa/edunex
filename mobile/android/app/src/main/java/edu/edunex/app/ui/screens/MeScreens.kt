package edu.edunex.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import edu.edunex.app.data.Api
import edu.edunex.app.data.friendly
import edu.edunex.app.data.num
import edu.edunex.app.data.objects
import edu.edunex.app.data.prettyDate
import edu.edunex.app.data.str
import edu.edunex.app.data.today
import edu.edunex.app.ui.DateField
import edu.edunex.app.ui.Empty
import edu.edunex.app.ui.InfoCard
import edu.edunex.app.ui.Loaded
import edu.edunex.app.ui.LocalNav
import edu.edunex.app.ui.Picker
import edu.edunex.app.ui.PrimaryButton
import edu.edunex.app.ui.ScreenList
import edu.edunex.app.ui.SectionTitle
import edu.edunex.app.ui.StatRow
import edu.edunex.app.ui.StatusChip
import edu.edunex.app.ui.rememberLoad
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Tiny helper: run an API action with busy flag, toast the result, then refresh. */
@Composable
fun rememberAction(): (busy: (Boolean) -> Unit, done: String, block: suspend () -> Unit, after: () -> Unit) -> Unit {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    return { busy, done, block, after ->
        scope.launch {
            busy(true)
            try {
                block(); nav.toast(done); after()
            } catch (e: Exception) {
                nav.toast(e.friendly())
            }
            busy(false)
        }
    }
}

@Composable
fun MyAttendanceScreen() {
    val state = rememberLoad { Api.get("/api/me/attendance").obj() }
    val act = rememberAction()
    var busy by remember { mutableStateOf(false) }
    Loaded(state) { a ->
        val rows = a.optJSONArray("rows")?.objects().orEmpty()
        val todayRow = rows.firstOrNull { it.str("date") == today() }
        val s = a.optJSONObject("summary") ?: JSONObject()
        ScreenList {
            item {
                InfoCard("Today · ${prettyDate(today())}", subtitle = when {
                    todayRow?.str("checkOut") != null -> "Checked in ${todayRow.str("checkIn")} · out ${todayRow.str("checkOut")}"
                    todayRow?.str("checkIn") != null -> "Checked in at ${todayRow.str("checkIn")}"
                    else -> "Not checked in yet"
                }, trailing = { StatusChip(todayRow?.str("status")) }) {
                    when {
                        todayRow?.str("checkIn") == null -> PrimaryButton("Check in", busy) {
                            act({ busy = it }, "Checked in", { Api.post("/api/me/attendance/check-in") }) { state.reload() }
                        }
                        todayRow?.str("checkOut") == null -> PrimaryButton("Check out", busy) {
                            act({ busy = it }, "Checked out", { Api.post("/api/me/attendance/check-out") }) { state.reload() }
                        }
                    }
                }
            }
            item {
                StatRow(
                    "Present" to (s.optInt("present") + s.optInt("late")).toString(),
                    "Late" to s.optInt("late").toString(),
                    "Absent" to s.optInt("absent").toString(),
                    "Leave" to s.optInt("leave").toString(),
                )
            }
            item { SectionTitle("Last 30 days") }
            items(rows) { r ->
                InfoCard(prettyDate(r.str("date")), subtitle = listOfNotNull(r.str("checkIn")?.let { "In $it" }, r.str("checkOut")?.let { "Out $it" }).joinToString(" · "),
                    trailing = { StatusChip(r.str("status")) })
            }
        }
    }
}

@Composable
fun LeaveScreen() {
    val state = rememberLoad {
        Triple(
            Api.get("/api/me/leave-balances").arr().objects(),
            Api.get("/api/me/leave-requests").arr().objects(),
            Api.get("/api/workforce/leave-types").arr().objects(),
        )
    }
    var applying by remember { mutableStateOf(false) }
    val act = rememberAction()
    Box(Modifier.fillMaxSize()) {
        Loaded(state) { (balances, requests, types) ->
            ScreenList {
                item { SectionTitle("Balance") }
                items(balances.chunked(3)) { chunk ->
                    StatRow(*chunk.map { (it.str("type") ?: "") to "${it.num("balance")?.let(::fmtDays) ?: "0"}/${it.num("entitled")?.let(::fmtDays) ?: "0"}" }.toTypedArray())
                }
                item { SectionTitle("My requests") }
                if (requests.isEmpty()) item { Text("No leave requests yet.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                items(requests) { r ->
                    var busy by remember { mutableStateOf(false) }
                    InfoCard(
                        "${r.str("leaveType")} · ${r.num("days")?.let(::fmtDays)} day(s)",
                        subtitle = "${prettyDate(r.str("fromDate"))} – ${prettyDate(r.str("toDate"))}\n${r.str("reason").orEmpty()}",
                        trailing = { StatusChip(r.str("status")) },
                    ) {
                        r.str("decisionNote")?.let { Text("Note: $it", style = MaterialTheme.typography.bodySmall) }
                        if (r.str("status") in listOf("Submitted", "Under Review", "Draft")) {
                            OutlinedButton(enabled = !busy, onClick = {
                                act({ busy = it }, "Leave request cancelled", { Api.post("/api/me/leave-requests/${r.str("id")}/cancel") }) { state.reload() }
                            }) { Text("Cancel request") }
                        }
                    }
                }
            }
            if (applying) ApplyLeaveDialog(types, onClose = { applying = false }, onDone = { applying = false; state.reload() })
        }
        ExtendedFloatingActionButton(
            onClick = { applying = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Apply leave") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

private fun fmtDays(d: Double) = if (d % 1.0 == 0.0) d.toInt().toString() else d.toString()

@Composable
private fun ApplyLeaveDialog(types: List<JSONObject>, onClose: () -> Unit, onDone: () -> Unit) {
    var type by remember { mutableStateOf(types.firstOrNull()?.str("id")) }
    var from by remember { mutableStateOf(today()) }
    var to by remember { mutableStateOf(today()) }
    var halfDay by remember { mutableStateOf(false) }
    var reason by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Apply for leave") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Picker("Leave type", types.map { it.optString("id") to it.optString("name") }, type) { type = it }
                DateField("From", from) { from = it; if (to < it) to = it }
                DateField("To", to) { to = it }
                if (from == to) Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(halfDay, { halfDay = it }); Text("Half day")
                }
                OutlinedTextField(reason, { reason = it.take(500) }, label = { Text("Reason") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(enabled = !busy && type != null && reason.isNotBlank(), onClick = {
                val body = JSONObject().put("leaveTypeId", type).put("fromDate", from).put("toDate", to)
                    .put("halfDay", halfDay && from == to).put("reason", reason.trim())
                act({ busy = it }, "Leave request submitted", { Api.post("/api/me/leave-requests", body) }, onDone)
            }) { Text(if (busy) "Sending…" else "Submit") }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("Cancel") } },
    )
}

@Composable
fun NotificationsScreen() {
    val state = rememberLoad { Api.get("/api/notifications", mapOf("pageSize" to 50)).arr().objects() }
    val act = rememberAction()
    Loaded(state) { list ->
        if (list.isEmpty()) Empty("You're all caught up.") else ScreenList {
            item {
                TextButton(onClick = { act({}, "All marked as read", { Api.post("/api/notifications/read-all") }) { state.reload() } }) {
                    Text("Mark all as read")
                }
            }
            items(list) { n ->
                val unread = n.str("readAt") == null
                InfoCard(
                    n.str("title") ?: "", subtitle = "${n.str("body").orEmpty()}\n${prettyDate(n.str("createdAt"))}",
                    trailing = { StatusChip(if (unread) n.str("category") else null) },
                    onClick = if (unread) ({ act({}, "Marked as read", { Api.patch("/api/notifications/${n.str("id")}/read") }) { state.reload() } }) else null,
                )
            }
        }
    }
}

@Composable
fun TasksScreen() {
    val state = rememberLoad { Api.get("/api/tasks", mapOf("pageSize" to 50)).arr().objects() }
    val act = rememberAction()
    Loaded(state) { list ->
        if (list.isEmpty()) Empty("No open tasks.") else ScreenList {
            items(list) { t ->
                var busy by remember { mutableStateOf(false) }
                InfoCard(
                    t.str("title") ?: "",
                    subtitle = listOfNotNull(t.str("module"), t.str("dueOn")?.let { "Due ${prettyDate(it)}" }, t.str("priority")).joinToString(" · "),
                    trailing = { StatusChip(if (t.optBoolean("overdue")) "Overdue" else t.str("status")) },
                ) {
                    OutlinedButton(enabled = !busy, onClick = {
                        act({ busy = it }, "Task completed", { Api.patch("/api/tasks/${t.str("id")}", JSONObject().put("status", "Completed")) }) { state.reload() }
                    }) { Text("Mark complete", fontWeight = FontWeight.SemiBold) }
                }
            }
        }
    }
}
