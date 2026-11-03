package edu.edunex.tracker

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import edu.edunex.tracker.ui.TrackerScreen
import edu.edunex.tracker.ui.TrackerTheme

class MainActivity : ComponentActivity() {
    /** A setup link (edunex-tracker:setup?…) scanned with the phone's camera app. */
    private val pendingSetup = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        TrackerConfig.init(applicationContext)
        pendingSetup.value = setupFrom(intent)
        enableEdgeToEdge()
        setContent { TrackerTheme { TrackerScreen(pendingSetup.value) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setupFrom(intent)?.let { pendingSetup.value = it }
    }

    private fun setupFrom(intent: Intent?): String? =
        intent?.takeIf { it.data?.scheme == "edunex-tracker" }?.dataString
}
