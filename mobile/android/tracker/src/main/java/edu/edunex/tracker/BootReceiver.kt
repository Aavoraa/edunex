package edu.edunex.tracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Resumes tracking after the phone restarts (or the app is updated) if it was
 * on. Android only lets a location service start from here when the app has
 * "Allow all the time" location access; otherwise it resumes when opened.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        TrackerConfig.init(context.applicationContext)
        if (!TrackerConfig.enabled || !TrackerConfig.isConfigured) return
        if (!TrackerService.hasLocationPermission(context) || !TrackerService.hasBackgroundPermission(context)) return
        runCatching { TrackerService.start(context) }
            .onFailure { Log.w("BootReceiver", "Could not resume tracking", it) }
    }
}
