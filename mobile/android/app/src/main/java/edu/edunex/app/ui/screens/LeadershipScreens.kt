package edu.edunex.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import edu.edunex.app.data.Api
import edu.edunex.app.data.money
import edu.edunex.app.data.num
import edu.edunex.app.data.objects
import edu.edunex.app.data.prettyDate
import edu.edunex.app.data.str
import edu.edunex.app.ui.Empty
import edu.edunex.app.ui.InfoCard
import edu.edunex.app.ui.Loaded
import edu.edunex.app.ui.PrimaryButton
import edu.edunex.app.ui.ScreenList
import edu.edunex.app.ui.SectionTitle
import edu.edunex.app.ui.StatRow
import edu.edunex.app.ui.StatusChip
import edu.edunex.app.ui.rememberLoad
import org.json.JSONObject

@Composable
fun PulseScreen() {
    val state = rememberLoad { Api.get("/api/dashboard/command-center").obj() }
    Loaded(state) { d ->
        val att = d.optJSONObject("attendance") ?: JSONObject()
        val t = att.optJSONObject("today") ?: JSONObject()
        val students = d.optJSONObject("students") ?: JSONObject()
        val staff = d.optJSONObject("staff") ?: JSONObject()
        val approvals = d.optJSONObject("approvals") ?: JSONObject()
        ScreenList {
            item { SectionTitle("Students today") }
            item {
                StatRow(
                    "Attendance" to (att.num("todayPct")?.let { "${it.toInt()}%" } ?: "—"),
                    "Present" to t.optInt("present").toString(),
                    "Absent" to t.optInt("absent").toString(),
                    "Late" to t.optInt("late").toString(),
                )
            }
            item { StatRow("Enrolled" to students.optInt("total").toString(), "At risk" to students.optInt("atRisk").toString(), "Developing" to students.optInt("developing").toString()) }
            item { SectionTitle("Staff today") }
            item {
                StatRow("Present" to staff.optInt("present").toString(), "Absent" to staff.optInt("absent").toString(),
                    "On leave" to staff.optInt("onLeave").toString(), "Late" to staff.optInt("late").toString())
            }
            d.optJSONObject("finance")?.let { f ->
                item { SectionTitle("Fees") }
                item { StatRow("Collected today" to money(f.num("collectedToday")), "Outstanding" to money(f.num("outstanding")), "Collected" to (f.num("collectionPct")?.let { "${it.toInt()}%" } ?: "—")) }
            }
            item { SectionTitle("Waiting for approval · ${approvals.optInt("total")}") }
            item {
                StatRow("Leave" to approvals.optInt("leave").toString(), "Expenses" to approvals.optInt("expenses").toString(),
                    "Overtime" to approvals.optInt("overtime").toString(), "Concessions" to approvals.optInt("concessions").toString())
            }
            val attention = d.optJSONArray("attention")?.objects().orEmpty()
            if (attention.isNotEmpty()) {
                item { SectionTitle("Needs attention") }
                items(attention) { a -> InfoCard(a.str("title") ?: "", subtitle = a.str("meta"), trailing = { StatusChip(a.str("tone")?.replaceFirstChar(Char::uppercase)) }) }
            }
        }
    }
}

@Composable
fun LeaveApprovalsScreen() {
    var filter by remember { mutableStateOf("open") }
    val state = rememberLoad(filter) {
        Api.get("/api/workforce/leave-requests", mapOf("status" to filter, "pageSize" to 100, "sort" to "created", "dir" to "desc")).arr().objects()
    }
    val act = rememberAction()
    var rejecting by remember { mutableStateOf<JSONObject?>(null) }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("open" to "Waiting", "Approved" to "Approved", "Rejected" to "Rejected").forEach { (k, l) -> FilterChip(filter == k, { filter = k }, { Text(l) }) }
        }
        Loaded(state) { list ->
            if (list.isEmpty()) Empty("No leave requests here.") else ScreenList {
                items(list) { r ->
                    var busy by remember { mutableStateOf(false) }
                    InfoCard(
                        r.str("employeeName") ?: "",
                        subtitle = "${r.str("designation").orEmpty()} · ${r.str("leaveType").orEmpty()} · ${r.num("days")?.toString()?.removeSuffix(".0")} day(s)\n" +
                            "${prettyDate(r.str("fromDate"))} – ${prettyDate(r.str("toDate"))}",
                        trailing = { StatusChip(r.str("status")) },
                    ) {
                        Text(r.str("reason") ?: "", style = MaterialTheme.typography.bodyMedium)
                        r.str("coverArrangement")?.let { Text("Cover: $it", style = MaterialTheme.typography.bodySmall) }
                        if (r.str("status") in listOf("Submitted", "Under Review")) {
                            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedButton(enabled = !busy, onClick = { rejecting = r }, modifier = Modifier.weight(1f)) { Text("Reject") }
                                PrimaryButton("Approve", busy, modifier = Modifier.weight(1f)) {
                                    act({ busy = it }, "Leave approved", { Api.post("/api/workforce/leave-requests/${r.str("id")}/approve", JSONObject()) }) { state.reload() }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    rejecting?.let { r ->
        var note by remember(r) { mutableStateOf("") }
        var busy by remember(r) { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { rejecting = null },
            title = { Text("Reject leave for ${r.str("employeeName")}") },
            text = { OutlinedTextField(note, { note = it.take(500) }, label = { Text("Reason") }, minLines = 3, modifier = Modifier.fillMaxWidth()) },
            confirmButton = {
                TextButton(enabled = !busy && note.isNotBlank(), onClick = {
                    act({ busy = it }, "Leave rejected", { Api.post("/api/workforce/leave-requests/${r.str("id")}/reject", JSONObject().put("note", note.trim())) }) {
                        rejecting = null; state.reload()
                    }
                }) { Text("Reject") }
            },
            dismissButton = { TextButton(onClick = { rejecting = null }) { Text("Cancel") } },
        )
    }
}
