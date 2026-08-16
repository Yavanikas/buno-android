package com.buno.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.buno.app.ui.navigation.BunoNavGraph
import com.buno.app.presentation.theme.BunoTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Allow Compose to draw behind system bars
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            BunoTheme {
                BunoNavGraph()
            }
        }
    }
}
