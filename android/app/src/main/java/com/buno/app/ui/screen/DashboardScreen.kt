package com.buno.app.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DashboardScreen(
    onNavigateToTransactions: () -> Unit,
    onNavigateToPatterns: () -> Unit,
    onNavigateToBankSync: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToPremium: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Dashboard Screen")
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onNavigateToTransactions) { Text("Transactions") }
        Button(onClick = onNavigateToPatterns) { Text("Patterns") }
        Button(onClick = onNavigateToBankSync) { Text("Bank Sync") }
        Button(onClick = onNavigateToPremium) { Text("Premium") }
        Button(onClick = onNavigateToSettings) { Text("Settings") }
    }
}
