package edu.edunex.tracker.ui

import android.os.Build
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import edu.edunex.tracker.AdminSession
import edu.edunex.tracker.DeviceInfo
import edu.edunex.tracker.ServerException
import edu.edunex.tracker.StudentInfo
import edu.edunex.tracker.TrackerConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.IOException

/** What the administrator is doing on this phone. */
sealed class ConnectMode {
    /** A device label QR was scanned: connect this phone as that device. */
    data class Link(val code: String) : ConnectMode()
    /** No label: register this phone as a new device. */
    data object Register : ConnectMode()
    /** Already connected: choose (or change) the student. */
    data object AssignOnly : ConnectMode()
}

private enum class Step { SignIn, Device, Student, Done }

/**
 * Connect this phone without a setup QR: an administrator signs in once on the
 * phone, the server issues the device token directly to the phone, and the
 * student is picked here. The admin session lives only in this dialog and is
 * signed out when it closes.
 */
@Composable
fun ConnectDialog(mode: ConnectMode, onDone: (connected: Boolean) -> Unit) {
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(Step.SignIn) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var session by remember { mutableStateOf<AdminSession?>(null) }
    var device by remember { mutableStateOf<DeviceInfo?>(null) }
    var connected by remember { mutableStateOf(false) }
    var assignedTo by remember { mutableStateOf<String?>(null) }

    var server by remember { mutableStateOf(TrackerConfig.server) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    fun close() {
        val s = session
        scope.launch { s?.signOut() }
        onDone(connected)
    }

    fun run(block: suspend () -> Unit) {
        busy = true; error = null
        scope.launch {
            try { block() } catch (e: ServerException) { error = e.message } catch (e: IOException) {
                error = "Cannot reach the server. Check the internet connection and the server address."
            } catch (e: Exception) { error = e.message ?: "Something went wrong." }
            busy = false
        }
    }

    Dialog(onDismissRequest = { if (!busy) close() }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    when (mode) {
                        is ConnectMode.Link -> "Connect to ${mode.code}"
                        ConnectMode.Register -> "Register this phone"
                        ConnectMode.AssignOnly -> "Choose student"
                    },
                    style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                )
                StepDots(step)

                when (step) {
                    Step.SignIn -> {
                        Text("An administrator (Principal, School Admin or Super Admin) signs in once to connect this phone. " +
                            "The sign-in is not kept on the phone.", style = MaterialTheme.typography.bodyMedium)
                        OutlinedTextField(server, { server = it }, label = { Text("Server") }, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(email, { email = it }, label = { Text("Admin email or phone") }, singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next), modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done), modifier = Modifier.fillMaxWidth())
                        Primary("Sign in", busy, enabled = email.isNotBlank() && password.isNotEmpty() && server.startsWith("http")) {
                            run {
                                val s = AdminSession.signIn(server.trim().trimEnd('/'), email, password)
                                session = s
                                password = ""
                                when (mode) {
                                    is ConnectMode.Link -> { device = s.lookup(mode.code); step = Step.Device }
                                    ConnectMode.Register -> step = Step.Device
                                    ConnectMode.AssignOnly -> step = Step.Student
                                }
                            }
                        }
                    }

                    Step.Device -> {
                        val d = device
                        if (mode is ConnectMode.Link && d != null) {
                            DeviceSummary(d)
                            val blocked = d.status !in listOf("available", "assigned")
                            val inUse = d.hasToken && d.lastSeenAt != null && d.deviceType != "mobile_app"
                            when {
                                blocked -> Warn("This device is ${d.status}. Put it back in service on the GPS Devices page first.")
                                inUse -> Warn("${d.deviceCode} is a ${d.deviceType.replace('_', ' ')} that has already reported. Connecting this phone gives it a new token, and the other device will stop sending.")
                                d.hasToken -> Text("A new token will be issued to this phone; any older token for ${d.deviceCode} stops working.", style = MaterialTheme.typography.bodySmall)
                            }
                            Primary("Connect this phone as ${d.deviceCode}", busy, enabled = !blocked) {
                                run {
                                    val token = session!!.issueToken(d.deviceCode)
                                    TrackerConfig.connect(session!!.server, d.deviceCode, token)
                                    connected = true
                                    assignedTo = d.studentName?.let { "$it (${d.admissionNo})" }
                                    step = Step.Student
                                }
                            }
                        } else if (mode == ConnectMode.Register) {
                            Text("A new device of type “Android phone” is created on the server and its token is stored on this phone.",
                                style = MaterialTheme.typography.bodyMedium)
                            Primary("Register and connect", busy) {
                                run {
                                    val (info, token) = session!!.registerPhone("Registered from ${Build.MANUFACTURER} ${Build.MODEL}")
                                    TrackerConfig.connect(session!!.server, info.deviceCode, token)
                                    device = info
                                    connected = true
                                    step = Step.Student
                                }
                            }
                        }
                    }

                    Step.Student -> StudentStep(
                        session = session!!,
                        deviceCode = TrackerConfig.deviceId,
                        current = assignedTo,
                        onAssigned = { assignedTo = it; step = Step.Done },
                        onSkip = { step = Step.Done },
                    )

                    Step.Done -> {
                        Text("✔ This phone is ${TrackerConfig.deviceId}.", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Teal)
                        Text(assignedTo?.let { "Locations will be recorded for $it." }
                            ?: "Not assigned to a student yet — locations are refused until it is assigned (here or on the web).",
                            style = MaterialTheme.typography.bodyMedium)
                        Text("The administrator has been signed out of this phone.", style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Primary("Start tracking", false) { close() }
                    }
                }

                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                if (step != Step.Done) TextButton(onClick = { close() }, enabled = !busy, modifier = Modifier.align(Alignment.End)) { Text("Cancel") }
            }
        }
    }
}

@Composable
private fun StudentStep(session: AdminSession, deviceCode: String, current: String?, onAssigned: (String) -> Unit, onSkip: () -> Unit) {
    val scope = rememberCoroutineScope()
    var q by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<StudentInfo>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf<Pair<StudentInfo, String>?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(q) {
        if (q.trim().length < 2) { results = emptyList(); return@LaunchedEffect }
        delay(300)
        searching = true
        results = runCatching { session.searchStudents(q.trim()) }.getOrElse { error = it.message; emptyList() }
        searching = false
    }

    fun assign(s: StudentInfo, reassign: Boolean) {
        busy = true; error = null
        scope.launch {
            try {
                session.assign(s.id, deviceCode, reassign)
                onAssigned("${s.fullName} (${s.admissionNo})")
            } catch (e: ServerException) {
                if (e.code == "REASSIGN_REQUIRED" && !reassign) confirm = s to e.message.orEmpty().removeSuffix(" Confirm to reassign.")
                else error = e.message
            } catch (e: Exception) { error = e.message ?: "Could not assign." }
            busy = false
        }
    }

    current?.let {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.padding(12.dp)) {
                Text("Currently assigned to", style = MaterialTheme.typography.labelMedium)
                Text(it, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
    Text(if (current == null) "Which student carries this phone?" else "Or choose another student:", style = MaterialTheme.typography.bodyMedium)
    OutlinedTextField(q, { q = it }, label = { Text("Search name or admission number") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    if (searching) CircularProgressIndicator(Modifier.size(20.dp))
    Column(Modifier.heightIn(max = 280.dp).verticalScroll(rememberScrollState())) {
        results.forEach { s ->
            Row(
                Modifier.fillMaxWidth().clickable(enabled = !busy) { assign(s, false) }.padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(s.fullName, fontWeight = FontWeight.SemiBold)
                    Text(listOf(s.admissionNo, s.grade.ifBlank { null }, s.currentDevice?.let { "has $it" } ?: "no device").filterNotNull().joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("Assign", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            }
            HorizontalDivider()
        }
    }
    confirm?.let { (s, msg) ->
        Warn("$msg. Reassign to ${s.fullName}? Earlier locations stay with the previous student.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { confirm = null }) { Text("No") }
            Button(onClick = { confirm = null; assign(s, true) }, enabled = !busy) { Text("Reassign") }
        }
    }
    if (busy) CircularProgressIndicator(Modifier.size(20.dp))
    error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    TextButton(onClick = onSkip, enabled = !busy) { Text(if (current != null) "Keep current student" else "Skip — assign later on the web") }
}

@Composable
private fun DeviceSummary(d: DeviceInfo) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(12.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(d.deviceCode, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Text("${d.deviceType.replace('_', ' ')} · ${d.status}", style = MaterialTheme.typography.bodySmall)
            Text(d.studentName?.let { "Assigned to $it (${d.admissionNo})" } ?: "Not assigned to a student", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun Warn(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = Amber)
}

@Composable
private fun StepDots(step: Step) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("Sign in", "Device", "Student", "Done").forEachIndexed { i, label ->
            val active = i <= step.ordinal
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = if (i == step.ordinal) FontWeight.Bold else null,
                color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            if (i < 3) Text("›", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    Spacer(Modifier.size(2.dp))
}

@Composable
private fun Primary(text: String, busy: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(text)
    }
}
