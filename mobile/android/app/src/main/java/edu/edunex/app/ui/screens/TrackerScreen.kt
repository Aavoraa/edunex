package edu.edunex.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.BarcodeEncoder
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import edu.edunex.app.tracker.TrackerConfig
import edu.edunex.app.tracker.TrackerService
import edu.edunex.app.ui.theme.Danger
import edu.edunex.app.ui.theme.Amber
import edu.edunex.app.ui.theme.Midnight
import edu.edunex.app.ui.theme.Teal
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/**
 * "Student GPS Tracker": turns this phone into the GPS device assigned to a
 * student. Setup comes from the QR shown once when the device is registered on
 * the GPS Devices page; the phone then shows its own device-ID QR so staff can
 * scan it on the student's page to assign it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerScreen(pendingSetup: String? = null, onExit: () -> Unit) {
    val context = LocalContext.current
    val status by TrackerService.status.collectAsState()
    var configured by remember { mutableStateOf(TrackerConfig.isConfigured) }
    var setupMessage by remember { mutableStateOf<String?>(null) }
    var showManual by remember { mutableStateOf(false) }
    var showQr by remember { mutableStateOf(false) }
    var confirmReset by remember { mutableStateOf(false) }

    fun applySetup(text: String) {
        val err = TrackerConfig.applySetup(text)
        if (err == null) {
            if (status.running) TrackerService.stop(context)
            configured = true
            setupMessage = "Ready. Device ${TrackerConfig.deviceId} is set up."
        } else setupMessage = err
    }

    LaunchedEffect(pendingSetup) { pendingSetup?.let { applySetup(it) } }

    val scan = rememberLauncherForActivityResult(ScanContract()) { r -> r.contents?.let { applySetup(it) } }
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.ACCESS_FINE_LOCATION] == true) TrackerService.start(context)
        else setupMessage = "Location permission is needed to track this device."
    }

    fun start() {
        val needed = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = needed.filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) TrackerService.start(context) else permissions.launch(missing.toTypedArray())
    }

    // Resume tracking after the app was closed while tracking was on.
    LaunchedEffect(Unit) {
        if (TrackerConfig.enabled && TrackerConfig.isConfigured && !status.running && TrackerService.hasLocationPermission(context)) {
            TrackerService.start(context)
        }
    }

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TopAppBar(
            title = { Text("Student GPS Tracker") },
            navigationIcon = { IconButton(onClick = onExit) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Midnight, titleContentColor = Color.White, navigationIconContentColor = Color.White,
            ),
        )
        Column(
            Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (!configured) {
                SetupCard(onScan = {
                    scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Scan the setup QR from GPS Devices").setBeepEnabled(false).setOrientationLocked(false))
                }, onManual = { showManual = true })
            } else {
                StatusCard(status)
                if (status.running) {
                    Button(
                        onClick = { TrackerService.stop(context) },
                        colors = ButtonDefaults.buttonColors(containerColor = Danger),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    ) { Text("STOP TRACKING", fontWeight = FontWeight.Bold) }
                } else {
                    Button(
                        onClick = { start() },
                        colors = ButtonDefaults.buttonColors(containerColor = Teal),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    ) { Text("START TRACKING", fontWeight = FontWeight.Bold) }
                }
                IntervalRow(enabled = !status.running)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { showQr = true }, modifier = Modifier.weight(1f)) { Text("Show device QR") }
                    OutlinedButton(onClick = { confirmReset = true }, modifier = Modifier.weight(1f)) { Text("Change device") }
                }
                Text(
                    "Keep this app allowed to run in the background (Settings → Battery → Unrestricted) so tracking is not paused.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            setupMessage?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = if (it.startsWith("Ready")) Teal else MaterialTheme.colorScheme.error)
            }
        }
    }

    if (showManual) ManualSetupDialog(onDismiss = { showManual = false }) { server, device, token ->
        showManual = false
        applySetup("edunex-tracker:setup?server=${android.net.Uri.encode(server)}&device=${android.net.Uri.encode(device)}&token=${android.net.Uri.encode(token)}")
    }
    if (showQr) DeviceQrDialog(TrackerConfig.deviceId) { showQr = false }
    if (confirmReset) AlertDialog(
        onDismissRequest = { confirmReset = false },
        title = { Text("Remove this device setup?") },
        text = { Text("Tracking stops and the device token is deleted from this phone. You will need a new setup QR to track again.") },
        confirmButton = {
            TextButton(onClick = {
                confirmReset = false
                TrackerService.stop(context)
                TrackerConfig.clear()
                configured = false
                setupMessage = null
            }) { Text("Remove", color = Danger) }
        },
        dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("Cancel") } },
    )
}

@Composable
private fun SetupCard(onScan: () -> Unit, onManual: () -> Unit) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Set up this phone as a GPS device", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "1. On the web: GPS Devices → Register device → type “Android phone”.\n" +
                    "2. Choose “Android phone setup” in the token window.\n" +
                    "3. Scan that QR here.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Button(onClick = onScan, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Icon(Icons.Outlined.QrCodeScanner, null)
                Spacer(Modifier.size(8.dp))
                Text("Scan setup QR")
            }
            TextButton(onClick = onManual, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Enter details manually") }
        }
    }
}

@Composable
private fun StatusCard(s: edu.edunex.app.tracker.TrackerStatus) {
    val fmt = remember { DateFormat.getTimeInstance(DateFormat.MEDIUM) }
    val loc = s.location
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Field("Device", TrackerConfig.deviceId, mono = true)
            Field("GPS", if (!s.running) "STOPPED" else if (loc == null) "SEARCHING" else "ACTIVE",
                color = if (!s.running) MaterialTheme.colorScheme.onSurfaceVariant else if (loc == null) Amber else Teal)
            HorizontalDivider(Modifier.padding(vertical = 6.dp))
            Field("Latitude", loc?.let { String.format(Locale.US, "%.7f", it.latitude) } ?: "—", mono = true)
            Field("Longitude", loc?.let { String.format(Locale.US, "%.7f", it.longitude) } ?: "—", mono = true)
            Field("Accuracy", loc?.takeIf { it.hasAccuracy() }?.let { String.format(Locale.US, "%.1f m", it.accuracy) } ?: "—")
            Field("Battery", s.battery?.let { "$it%" } ?: "—")
            Field("Last Sent", s.lastSentAt?.let { fmt.format(Date(it)) } ?: "—")
            s.lastStudent?.let { Field("Recorded for", it) }
            if (s.queued > 0) Field("Waiting to send", "${s.queued}")
            Field("Interval", "${TrackerConfig.intervalSeconds} s")
            s.message?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodySmall, color = if (s.messageIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun Field(label: String, value: String, mono: Boolean = false, color: Color? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold,
            fontFamily = if (mono) FontFamily.Monospace else null, color = color ?: MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
private fun IntervalRow(enabled: Boolean) {
    var interval by remember { mutableStateOf(TrackerConfig.intervalSeconds) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Send every", style = MaterialTheme.typography.bodyMedium)
        listOf(15, 30, 60, 120).forEach { s ->
            val selected = interval == s
            OutlinedButton(
                onClick = { interval = s; TrackerConfig.intervalSeconds = s }, enabled = enabled,
                colors = if (selected) ButtonDefaults.outlinedButtonColors(containerColor = MaterialTheme.colorScheme.primaryContainer) else ButtonDefaults.outlinedButtonColors(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp),
            ) { Text(if (s < 60) "${s}s" else "${s / 60}m") }
        }
    }
}

@Composable
private fun ManualSetupDialog(onDismiss: () -> Unit, onSave: (String, String, String) -> Unit) {
    var server by remember { mutableStateOf(TrackerConfig.server) }
    var device by remember { mutableStateOf(TrackerConfig.deviceId) }
    var token by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Device details") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(server, { server = it }, label = { Text("Server address") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                OutlinedTextField(device, { device = it.uppercase() }, label = { Text("Device ID") }, singleLine = true, placeholder = { Text("GPS000123") })
                OutlinedTextField(token, { token = it }, label = { Text("Device token") }, singleLine = true, placeholder = { Text("hsd_…") })
            }
        },
        confirmButton = { TextButton(onClick = { onSave(server, device, token) }, enabled = device.isNotBlank() && token.startsWith("hsd_")) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** The device-ID QR staff scan on the student's page to assign this phone. */
@Composable
private fun DeviceQrDialog(deviceId: String, onDismiss: () -> Unit) {
    val bitmap: Bitmap? = remember(deviceId) {
        runCatching { BarcodeEncoder().encodeBitmap(deviceId, BarcodeFormat.QR_CODE, 600, 600) }.getOrNull()
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Device $deviceId") },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                bitmap?.let { Image(it.asImageBitmap(), "QR code for $deviceId", Modifier.size(240.dp).background(Color.White)) }
                Spacer(Modifier.height(8.dp))
                Text(deviceId, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                Text("Scan this on the student's page (Assign device) to link this phone to the student.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}
