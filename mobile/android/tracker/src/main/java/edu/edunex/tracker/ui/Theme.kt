package edu.edunex.tracker.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Edunex brand palette (same values as the main app's theme)
val Indigo = Color(0xFF3B3FD9)
val Midnight = Color(0xFF1E1B4B)
val Spark = Color(0xFF2DD4BF)
val Teal = Color(0xFF0D7B66)
val Amber = Color(0xFFC27E0A)
val Danger = Color(0xFFC62828)

private val Light = lightColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEEF0FF),
    onPrimaryContainer = Midnight,
    tertiary = Teal,
    background = Color(0xFFF6F7FB),
    onBackground = Color(0xFF171717),
    surface = Color.White,
    onSurface = Color(0xFF171717),
    surfaceVariant = Color(0xFFEDEFF6),
    onSurfaceVariant = Color(0xFF5A6070),
    outline = Color(0xFFCBD0DD),
    error = Danger,
)

private val Dark = darkColorScheme(
    primary = Color(0xFF8B8FF7),
    onPrimary = Color(0xFF12103A),
    primaryContainer = Color(0xFF2A2680),
    onPrimaryContainer = Color(0xFFE0E3FF),
    tertiary = Color(0xFF6FD6BF),
    background = Color(0xFF0B0C16),
    surface = Color(0xFF131526),
    surfaceVariant = Color(0xFF1B1E31),
    error = Color(0xFFFF8A80),
)

@Composable
fun TrackerTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
