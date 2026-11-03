package edu.edunex.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import edu.edunex.app.R

// Edunex palette, the same tokens as the web app (frontend/src/styles/tokens.css)
val Indigo = Color(0xFF3B3FD9)           // the one action colour
val IndigoHover = Color(0xFF2F32B8)
val Midnight = Color(0xFF1E1B4B)         // menu and headers
val MidnightTop = Color(0xFF25216A)
val MidnightBottom = Color(0xFF171540)
val IndigoTint = Color(0xFFEEF0FF)
val Mint = Color(0xFFE0FDF9)             // the current menu item
val MintDeep = Color(0xFFC8F5F0)
val MidnightInk = Color(0xFF16184F)      // text on mint
val Spark = Color(0xFF5EEAD4)            // teal accent on dark surfaces
val SparkDeep = Color(0xFF0F766E)        // teal text on light surfaces (5.5:1)
val SparkTint = Color(0xFFE6FAF7)
val CoolWhite = Color(0xFFF6F7FB)
val Ink = Color(0xFF1B1E33)              // strong text
val InkSoft = Color(0xFF2F3447)          // body text
val Muted = Color(0xFF5A6070)            // secondary text (6.0:1)
val Hairline = Color(0xFFE5E8F0)         // card borders
val Teal = Color(0xFF167A55)             // status colours double as text: all ≥ 4.5:1 on white
val Amber = Color(0xFF94600A)
val Danger = Color(0xFFC0284A)

/** Muted icon hues for tiles and quick actions, as on the web dashboard. */
val TileHues = listOf(
    Color(0xFF3B3FD9) to Color(0xFFEEF0FF),  // brand
    Color(0xFF3E6E9E) to Color(0xFFEAF1F8),  // blue
    Color(0xFF7A4E8C) to Color(0xFFF3EDF6),  // plum
    Color(0xFF2F6A4C) to Color(0xFFEAF4EE),  // sage
    Color(0xFF855A0B) to Color(0xFFFAF2E1),  // amber
    Color(0xFF56657A) to Color(0xFFEEF1F4),  // steel
)

val MidnightGradient = Brush.verticalGradient(listOf(MidnightTop, Midnight, MidnightBottom))
val MintGradient = Brush.horizontalGradient(listOf(Mint, MintDeep))
val PrimaryGradient = Brush.verticalGradient(listOf(Color(0xFF4448E0), Color(0xFF3438C8)))
val LavenderGradient = Brush.linearGradient(listOf(Color(0xFFF8F9FF), Color(0xFFEFF1FF), Color(0xFFE4E8FF)))

@OptIn(ExperimentalTextApi::class)
private fun jakarta(weight: Int) =
    Font(R.font.plus_jakarta_sans, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))

@OptIn(ExperimentalTextApi::class)
private fun cormorant(weight: Int) =
    Font(R.font.cormorant_garamond, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))

/** Interface face: Plus Jakarta Sans. */
val Sans = FontFamily(jakarta(400), jakarta(500), jakarta(600), jakarta(700), jakarta(800))

/** Greetings, page titles and quotes: Cormorant Garamond. */
val Serif = FontFamily(cormorant(500), cormorant(600), cormorant(700))

private val Base = Typography()

private val AppType = Typography(
    displaySmall = TextStyle(fontFamily = Serif, fontWeight = FontWeight.Bold, fontSize = 36.sp, lineHeight = 40.sp),
    headlineLarge = TextStyle(fontFamily = Serif, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 38.sp),
    headlineMedium = TextStyle(fontFamily = Serif, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontFamily = Serif, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 25.sp, letterSpacing = (-0.2).sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 21.sp),
    titleSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp, lineHeight = 18.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 10.sp, lineHeight = 14.sp, letterSpacing = 1.6.sp),
    displayLarge = Base.displayLarge.copy(fontFamily = Serif),
    displayMedium = Base.displayMedium.copy(fontFamily = Serif),
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(22.dp),
)

private val Light = lightColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    primaryContainer = IndigoTint,
    onPrimaryContainer = MidnightInk,
    secondary = SparkDeep,
    onSecondary = Color.White,
    secondaryContainer = SparkTint,
    onSecondaryContainer = Color(0xFF053F3A),
    tertiary = Teal,
    background = CoolWhite,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEDEFF6),
    onSurfaceVariant = Muted,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF9FAFD),
    surfaceContainer = Color(0xFFF3F4F9),
    surfaceContainerHigh = Color(0xFFEDEFF6),
    outline = Color(0xFFCBD0DD),
    outlineVariant = Hairline,
    error = Danger,
)

private val Dark = darkColorScheme(
    primary = Color(0xFF8B8FF7),
    onPrimary = Color(0xFF12103A),
    primaryContainer = Color(0xFF2A2680),
    onPrimaryContainer = Color(0xFFE0E3FF),
    secondary = Spark,
    onSecondary = Color(0xFF042F2E),
    secondaryContainer = Color(0xFF0B4A45),
    onSecondaryContainer = Spark,
    tertiary = Color(0xFF3CC08A),
    background = Color(0xFF0B0C16),
    onBackground = Color(0xFFF3F4FA),
    surface = Color(0xFF131526),
    onSurface = Color(0xFFF3F4FA),
    surfaceVariant = Color(0xFF1B1E31),
    onSurfaceVariant = Color(0xFF9EA2B8),
    surfaceContainerLow = Color(0xFF171A2D),
    surfaceContainer = Color(0xFF1C1F35),
    surfaceContainerHigh = Color(0xFF23263F),
    outline = Color(0xFF343957),
    outlineVariant = Color(0xFF262A40),
    error = Color(0xFFF0697A),
)

/** Card border: the cool hairline in light mode, a quiet line in dark mode. */
val cardBorder: Color
    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.outlineVariant

@Composable
fun EdunexTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = AppType,
        shapes = AppShapes,
        content = content,
    )
}
