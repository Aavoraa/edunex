package edu.edunex.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import edu.edunex.app.data.Api
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
import edu.edunex.app.ui.Route
import edu.edunex.app.ui.ScreenList
import edu.edunex.app.ui.SectionTitle
import edu.edunex.app.ui.StatRow
import edu.edunex.app.ui.StatusChip
import edu.edunex.app.ui.rememberLoad
import org.json.JSONArray
import org.json.JSONObject

// ---- Mark attendance -----------------------------------------------------------

@Composable
fun SectionsScreen() {
    val nav = LocalNav.current
    val state = rememberLoad { Api.get("/api/attendance/sections").arr().objects() }
    Loaded(state) { list ->
        if (list.isEmpty()) Empty("No classes assigned to you.") else ScreenList {
            item { Text("Today · ${prettyDate(today())}", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(list) { s ->
                InfoCard(
                    s.str("label") ?: "",
                    subtitle = "${s.optInt("students")} students · ${s.optInt("marked")} marked",
                    trailing = { StatusChip(s.str("status")) },
                    onClick = { nav.go(Route.Register(s.optString("id"), s.optString("label"))) },
                )
            }
        }
    }
}

private val ATT = listOf("present" to "P", "late" to "L", "absent" to "A", "leave" to "Lv")

@Composable
fun RegisterScreen(sectionId: String) {
    val nav = LocalNav.current
    val state = rememberLoad(sectionId) { Api.get("/api/attendance/register", mapOf("sectionId" to sectionId)).obj() }
    val marks = remember(sectionId) { mutableStateMapOf<String, String>() }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()

    Loaded(state) { reg ->
        val students = reg.optJSONArray("students")?.objects().orEmpty()
        // Start from saved statuses; unmarked students default to present.
        if (marks.isEmpty()) students.forEach { marks[it.optString("id")] = it.str("status") ?: "present" }
        val editable = reg.optBoolean("editable", true)
        Box(Modifier.fillMaxSize()) {
            ScreenList {
                item {
                    StatRow(*ATT.map { (k, _) -> k.replaceFirstChar(Char::uppercase) to marks.values.count { it == k }.toString() }.toTypedArray())
                }
                reg.str("readOnlyReason")?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
                reg.optJSONObject("lastMarkedBy")?.let { item { Text("Last saved by ${it.str("name")} · ${prettyDate(it.str("at"))}", style = MaterialTheme.typography.bodySmall) } }
                items(students) { st ->
                    val id = st.optString("id")
                    InfoCard(st.str("fullName") ?: "", subtitle = "Roll ${st.str("roll") ?: "—"} · ${st.str("admissionNo").orEmpty()}") {
                        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                            ATT.forEachIndexed { i, (key, short) ->
                                SegmentedButton(
                                    selected = marks[id] == key, enabled = editable,
                                    onClick = { marks[id] = key },
                                    shape = SegmentedButtonDefaults.itemShape(i, ATT.size),
                                ) { Text(short) }
                            }
                        }
                    }
                }
            }
            if (editable && students.isNotEmpty()) {
                Surface(Modifier.align(Alignment.BottomCenter).fillMaxWidth(), tonalElevation = 6.dp, shadowElevation = 8.dp) {
                    Box(Modifier.padding(16.dp)) {
                        PrimaryButton("Save attendance", busy) {
                            val body = JSONObject().put("sectionId", sectionId).put("date", reg.str("date") ?: today())
                                .put("marks", JSONArray(students.map { JSONObject().put("studentId", it.optString("id")).put("status", marks[it.optString("id")]) }))
                            act({ busy = it }, "Attendance saved", { Api.put("/api/attendance/register", body) }) { nav.back() }
                        }
                    }
                }
            }
        }
    }
}

// ---- Homework ------------------------------------------------------------------

@Composable
fun HomeworkScreen() {
    val nav = LocalNav.current
    val state = rememberLoad { Api.get("/api/academics/homework", mapOf("pageSize" to 50, "sort" to "dueOn", "dir" to "desc")).arr().objects() }
    val act = rememberAction()
    Box(Modifier.fillMaxSize()) {
        Loaded(state) { list ->
            if (list.isEmpty()) Empty("No homework set yet.") else ScreenList {
                items(list) { h ->
                    var busy by remember { mutableStateOf(false) }
                    InfoCard(
                        h.str("title") ?: "",
                        subtitle = "${h.str("sectionLabel").orEmpty()} · ${h.str("subject").orEmpty()}\nDue ${prettyDate(h.str("dueOn"))} · ${h.optInt("submitted")}/${h.optInt("of")} submitted",
                        trailing = { StatusChip(h.str("displayStatus") ?: h.str("status")) },
                    ) {
                        if (h.str("status") == "Draft") OutlinedButton(enabled = !busy, onClick = {
                            act({ busy = it }, "Homework published", { Api.post("/api/academics/homework/${h.str("id")}/publish") }) { state.reload() }
                        }) { Text("Publish") }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { nav.go(Route.NewHomework) }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Set homework") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

@Composable
fun NewHomeworkScreen() {
    val nav = LocalNav.current
    val state = rememberLoad {
        Api.get("/api/academics/sections").arr().objects() to Api.get("/api/lookups").obj().optJSONArray("subjects")?.objects().orEmpty()
    }
    var section by remember { mutableStateOf<String?>(null) }
    var subject by remember { mutableStateOf<String?>(null) }
    var title by remember { mutableStateOf("") }
    var instructions by remember { mutableStateOf("") }
    var due by remember { mutableStateOf(java.time.LocalDate.now().plusDays(1).toString()) }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()

    Loaded(state) { (sections, subjects) ->
        val sec = sections.firstOrNull { it.str("id") == section }
        // Offer the teacher's own subjects for the section (names → ids via /lookups); class teachers may pick any.
        val mine = sec?.optJSONArray("mySubjects")?.let { a -> (0 until a.length()).map { a.optString(it) } }.orEmpty()
        val subjectOptions = subjects.filter { sec == null || sec.optBoolean("isClassTeacher") || it.str("name") in mine }
            .map { it.optString("id") to it.optString("name") }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Picker("Class", sections.map { it.optString("id") to it.optString("label") }, section) { section = it; subject = null }
            Picker("Subject", subjectOptions, subject) { subject = it }
            OutlinedTextField(title, { title = it.take(160) }, label = { Text("Title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(instructions, { instructions = it.take(2000) }, label = { Text("Instructions") }, minLines = 4, modifier = Modifier.fillMaxWidth())
            DateField("Due date", due) { due = it }
            Spacer(Modifier.height(8.dp))
            PrimaryButton("Set homework", busy, enabled = section != null && subject != null && title.isNotBlank()) {
                val body = JSONObject().put("sectionId", section).put("subjectId", subject).put("title", title.trim())
                    .put("instructions", instructions.trim().ifBlank { JSONObject.NULL }).put("dueOn", due).put("status", "Open")
                act({ busy = it }, "Homework set — students and parents notified", { Api.post("/api/academics/homework", body) }) { nav.back() }
            }
        }
    }
}

// ---- Marks ---------------------------------------------------------------------

@Composable
fun AssessmentsScreen() {
    val nav = LocalNav.current
    var status by remember { mutableStateOf("Scheduled,In Progress") }
    val state = rememberLoad(status) {
        status.split(",").flatMap { s ->
            Api.get("/api/academics/assessments", mapOf("status" to s.ifBlank { null }, "pageSize" to 100, "sort" to "heldOn", "dir" to "desc")).arr().objects()
        }
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(status != "", { status = "Scheduled,In Progress" }, { Text("To enter") })
            FilterChip(status == "", { status = "" }, { Text("All") })
        }
        Loaded(state) { list ->
            if (list.isEmpty()) Empty("No assessments waiting for marks.") else ScreenList {
                items(list) { a ->
                    InfoCard(
                        a.str("name") ?: "",
                        subtitle = "${a.str("grade").orEmpty()} · ${a.str("subject").orEmpty()} · ${prettyDate(a.str("heldOn"))}\n${a.optInt("entered")}/${a.optInt("of")} entered · max ${a.num("maxMarks")?.toInt()}",
                        trailing = { StatusChip(a.str("status")) },
                        onClick = { nav.go(Route.MarksEntry(a.optString("id"), a.optString("name"))) },
                    )
                }
            }
        }
    }
}

@Composable
fun MarksEntryScreen(assessmentId: String) {
    val nav = LocalNav.current
    val state = rememberLoad(assessmentId) { Api.get("/api/academics/assessments/$assessmentId").obj() }
    val marks = remember(assessmentId) { mutableStateMapOf<String, String>() }
    val absent = remember(assessmentId) { mutableStateMapOf<String, Boolean>() }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()

    Loaded(state) { a ->
        val students = a.optJSONArray("students")?.objects().orEmpty()
        val max = a.num("maxMarks") ?: 100.0
        if (marks.isEmpty() && absent.isEmpty()) students.forEach {
            val id = it.optString("id")
            marks[id] = it.num("marks")?.let { m -> if (m % 1.0 == 0.0) m.toInt().toString() else m.toString() }.orEmpty()
            absent[id] = it.optBoolean("isAbsent")
        }
        val canEnter = a.optBoolean("canEnter", true) && !a.optBoolean("locked")

        fun save(action: String) {
            val bad = students.firstOrNull { st ->
                val v = marks[st.optString("id")].orEmpty()
                absent[st.optString("id")] != true && v.isNotBlank() && (v.toDoubleOrNull() == null || v.toDouble() < 0 || v.toDouble() > max)
            }
            if (bad != null) { act({}, "Check the mark for ${bad.str("fullName")} (0–${max.toInt()})", {}) {}; return }
            val rows = JSONArray(students.map { st ->
                val id = st.optString("id")
                val isAbsent = absent[id] == true
                JSONObject().put("studentId", id).put("isAbsent", isAbsent)
                    .put("marks", if (isAbsent) JSONObject.NULL else marks[id]?.toDoubleOrNull() ?: JSONObject.NULL)
            })
            act({ busy = it }, if (action == "save") "Marks saved" else "Submitted for moderation",
                { Api.put("/api/academics/assessments/$assessmentId/marks", JSONObject().put("marks", rows).put("action", action)) }) {
                if (action == "save") state.reload() else nav.back()
            }
        }

        Box(Modifier.fillMaxSize()) {
            ScreenList {
                item {
                    InfoCard(a.str("name") ?: "", subtitle = "${a.str("grade").orEmpty()} · ${a.str("subject").orEmpty()} · out of ${max.toInt()}",
                        trailing = { StatusChip(a.str("status")) })
                }
                a.str("lockReason")?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
                itemsIndexed(students) { _, st ->
                    val id = st.optString("id")
                    Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
                        Row(Modifier.fillMaxWidth().padding(12.dp, 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(st.str("fullName") ?: "", fontWeight = FontWeight.Medium)
                                Text("Roll ${st.str("roll") ?: "—"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            OutlinedTextField(
                                value = if (absent[id] == true) "" else marks[id].orEmpty(),
                                onValueChange = { v -> marks[id] = v.filter { it.isDigit() || it == '.' }.take(6) },
                                enabled = canEnter && absent[id] != true, singleLine = true,
                                placeholder = { Text("—") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.width(84.dp),
                            )
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Checkbox(absent[id] == true, { absent[id] = it }, enabled = canEnter)
                                Text("Absent", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
            if (canEnter && students.isNotEmpty()) {
                Surface(Modifier.align(Alignment.BottomCenter).fillMaxWidth(), tonalElevation = 6.dp, shadowElevation = 8.dp) {
                    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(onClick = { save("moderation") }, enabled = !busy, modifier = Modifier.weight(1f).height(50.dp)) { Text("Submit") }
                        PrimaryButton("Save", busy, modifier = Modifier.weight(1f)) { save("save") }
                    }
                }
            }
        }
    }
}

// ---- Early Warning signals -------------------------------------------------------

@Composable
fun SignalsScreen() {
    val nav = LocalNav.current
    var filter by remember { mutableStateOf("awaiting") }
    val state = rememberLoad(filter) {
        Api.get("/api/early-warning/signals", mapOf("status" to filter, "pageSize" to 100, "sort" to "raised", "dir" to "desc")).arr().objects()
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("awaiting" to "To review", "open" to "Open", "closed" to "Closed").forEach { (k, l) ->
                FilterChip(filter == k, { filter = k }, { Text(l) })
            }
        }
        Loaded(state) { list ->
            if (list.isEmpty()) Empty("No signals here.") else ScreenList {
                items(list) { s ->
                    InfoCard(
                        s.str("studentName") ?: "",
                        subtitle = "${s.str("grade").orEmpty()}${s.str("section").orEmpty()} · ${s.str("signalType").orEmpty()} · ${prettyDate(s.str("raisedOn"))}\n${s.str("signal").orEmpty()}",
                        trailing = { StatusChip(s.str("stageLabel")) },
                        onClick = { nav.go(Route.Signal(s.optString("id"), s.optString("code"))) },
                    )
                }
            }
        }
    }
}

@Composable
fun SignalScreen(id: String) {
    val nav = LocalNav.current
    val state = rememberLoad(id) { Api.get("/api/early-warning/signals/$id").obj() }
    var mode by remember { mutableStateOf<String?>(null) }
    var text by remember { mutableStateOf("") }
    var nextReview by remember { mutableStateOf(java.time.LocalDate.now().plusDays(7).toString()) }
    var risk by remember { mutableStateOf("Watch") }
    var busy by remember { mutableStateOf(false) }
    val act = rememberAction()
    val canManage = nav.user.can("earlywarning.manage")

    Loaded(state) { s ->
        val st = s.optJSONObject("student") ?: JSONObject()
        val p = s.optJSONObject("participation") ?: JSONObject()
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            InfoCard(s.str("studentName") ?: "", subtitle = "${s.str("admissionNo").orEmpty()} · ${s.str("grade").orEmpty()}${s.str("section").orEmpty()}",
                trailing = { StatusChip(s.str("risk")) }) {
                Text(s.str("signal") ?: "", style = MaterialTheme.typography.bodyMedium)
            }
            StatRow(
                "Attendance" to (st.num("attendance")?.let { "${it.toInt()}%" } ?: "—"),
                "Average" to (st.num("average")?.let { "${it.toInt()}%" } ?: "—"),
                "Absent 30d" to p.optInt("absent30").toString(),
                "Late 30d" to p.optInt("late30").toString(),
            )
            KeyValue("Stage", s.str("stageLabel") ?: "—")
            KeyValue("Owner", s.str("owner") ?: "—")
            s.str("actionPlan")?.let { KeyValue("Action plan", it) }
            s.str("nextReviewOn")?.let { KeyValue("Next review", prettyDate(it)) }

            val behaviour = s.optJSONArray("behaviour")?.objects().orEmpty()
            if (behaviour.isNotEmpty()) {
                SectionTitle("Recent behaviour")
                behaviour.take(5).forEach { b -> Text("• ${prettyDate(b.str("date"))} — ${b.str("note").orEmpty()}", style = MaterialTheme.typography.bodySmall) }
            }

            if (canManage && s.str("decision") == null && s.optInt("stage") <= 1) {
                SectionTitle("Your review")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(mode == "accept", { mode = "accept"; text = "" }, { Text("Accept & plan") })
                    FilterChip(mode == "dismiss", { mode = "dismiss"; text = "" }, { Text("Dismiss") })
                }
                if (mode != null) {
                    OutlinedTextField(text, { text = it.take(1000) }, minLines = 3, modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (mode == "accept") "Action plan" else "Reason for dismissing") })
                    if (mode == "accept") {
                        DateField("Next review", nextReview) { nextReview = it }
                        Picker("Risk level", listOf("On Track", "Watch", "Developing Risk", "At Risk").map { it to it }, risk) { risk = it }
                    }
                    PrimaryButton(if (mode == "accept") "Accept signal" else "Dismiss signal", busy, enabled = text.trim().length >= 5) {
                        val body = if (mode == "accept") JSONObject().put("decision", "accept").put("actionPlan", text.trim())
                            .put("ownerId", nav.user.employeeId).put("nextReviewOn", nextReview).put("riskLevel", risk)
                        else JSONObject().put("decision", "dismiss").put("reason", text.trim())
                        act({ busy = it }, "Review saved", { Api.post("/api/early-warning/signals/$id/review", body) }) { nav.back() }
                    }
                    if (mode == "accept" && nav.user.employeeId == null) {
                        Text("Your account isn't linked to a staff record, so you can't own the plan.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
