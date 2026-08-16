package com.buno.app.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = BunoPrimary,
    onPrimary = BunoOnPrimary,
    secondary = BunoSecondary,
    background = BunoBackground,
    surface = BunoBackground,
    onBackground = BunoTextPrimary,
    onSurface = BunoTextPrimary
)

@Composable
fun BunoTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
