package edu.edunex.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import edu.edunex.app.data.Session
import edu.edunex.app.tracker.TrackerConfig
import edu.edunex.app.ui.AppRoot
import edu.edunex.app.ui.TrackerLaunch
import edu.edunex.app.ui.theme.EdunexTheme

class MainActivity : ComponentActivity() {
    private val trackerLaunch = mutableStateOf<TrackerLaunch?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Session.init(applicationContext)
        TrackerConfig.init(applicationContext)
        trackerLaunch.value = launchFrom(intent) ?: if (TrackerConfig.enabled && TrackerConfig.isConfigured) TrackerLaunch() else null
        enableEdgeToEdge()
        setContent { EdunexTheme { AppRoot(trackerLaunch.value) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        launchFrom(intent)?.let { trackerLaunch.value = it }
    }

    /** A setup link (edunex-tracker:setup?…) scanned by the phone camera, or a tap on the tracking notification. */
    private fun launchFrom(intent: Intent?): TrackerLaunch? = when {
        intent?.data?.scheme == "edunex-tracker" -> TrackerLaunch(setup = intent.dataString)
        intent?.getBooleanExtra("tracker", false) == true -> TrackerLaunch()
        else -> null
    }
}
