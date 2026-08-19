package com.buno.app.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.buno.app.presentation.theme.*
import com.buno.app.viewmodel.BankSyncUiState
import com.buno.app.viewmodel.BankSyncViewModel
import com.buno.app.viewmodel.SyncUiPhase

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankSyncScreen(
    onBack: () -> Unit,
    onNavigateToTransactions: () -> Unit,
    viewModel: BankSyncViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = BunoBackground,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Connect Bank",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Serif,
                        color = BunoTextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = BunoTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BunoBackground)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            when (uiState.phase) {
                SyncUiPhase.IDLE -> IdleContent(uiState, viewModel)
                SyncUiPhase.SYNCING -> SyncingContent(uiState)
                SyncUiPhase.SUCCESS -> SuccessContent(uiState, onNavigateToTransactions)
                SyncUiPhase.ERROR -> ErrorContent(uiState, viewModel::retry)
            }
        }
    }
}

// ─── IDLE / Connect Bank + Demo Bank disclaimer ──────────────────────────────
@Composable
private fun IdleContent(uiState: BankSyncUiState, viewModel: BankSyncViewModel) {
    if (!uiState.showDisclaimer) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Auto-sync your transactions",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = BunoTextPrimary,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Connect your bank account and Buno will automatically import your recent expenses and income — no manual entry needed.",
                    fontSize = 14.sp,
                    color = BunoTextSecondary,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = viewModel::onConnectBankClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = BunoPrimary,
                        contentColor = BunoOnPrimary
                    )
                ) {
                    Text("Connect Bank", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    } else {
        // Demo Bank disclaimer
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.WarningAmber,
                    contentDescription = "Demo notice",
                    tint = RiskWatchful,
                    modifier = Modifier.size(40.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Demo Bank (Simulated)",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = BunoTextPrimary
                )
                Spacer(modifier = Modifier.height(10.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Text(
                        text = "This connects to a simulated Demo Bank, not a real bank. All accounts and transactions are fabricated demo data for preview purposes. No real money or credentials are involved.",
                        modifier = Modifier.padding(14.dp),
                        fontSize = 13.sp,
                        color = BunoTextSecondary,
                        lineHeight = 20.sp
                    )
                }
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = viewModel::startSync,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = BunoPrimary,
                        contentColor = BunoOnPrimary
                    )
                ) {
                    Text("Connect", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(modifier = Modifier.height(8.dp))
                TextButton(onClick = viewModel::dismissDisclaimer) {
                    Text("Cancel", color = BunoTextSecondary)
                }
            }
        }
    }
}

// ─── SYNCING / progress ──────────────────────────────────────────────────────
@Composable
private fun SyncingContent(uiState: BankSyncUiState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                color = BunoPrimary,
                strokeWidth = 4.dp,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "Syncing transactions…",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = BunoTextPrimary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Fetching your recent transactions from ${uiState.provider}. This usually takes a few seconds.",
                fontSize = 13.sp,
                color = BunoTextSecondary,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ─── SUCCESS / transactions synced ───────────────────────────────────────────
@Composable
private fun SuccessContent(uiState: BankSyncUiState, onNavigateToTransactions: () -> Unit) {
    val emptySync = uiState.transactionsCreated == 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = "Sync complete",
                tint = RiskSafe,
                modifier = Modifier.size(56.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = if (emptySync) "Nothing new to sync" else "Sync complete!",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                color = BunoTextPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (emptySync) {
                // Empty state: no new transactions arrived
                Text(
                    text = "All transactions from ${uiState.provider} were already in your ledger (${uiState.duplicatesSkipped} duplicates skipped).",
                    fontSize = 13.sp,
                    color = BunoTextSecondary,
                    textAlign = TextAlign.Center
                )
            } else {
                Text(
                    text = "${uiState.transactionsCreated} transactions synced to your budget.",
                    fontSize = 14.sp,
                    color = BunoTextSecondary,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SummaryRow("Provider", uiState.provider)
                    uiState.accountId?.let { SummaryRow("Account", it) }
                    SummaryRow("Transactions fetched", uiState.transactionsFetched.toString())
                    SummaryRow("Transactions synced", uiState.transactionsCreated.toString())
                    SummaryRow("Duplicates skipped", uiState.duplicatesSkipped.toString())
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = onNavigateToTransactions,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BunoPrimary,
                    contentColor = BunoOnPrimary
                )
            ) {
                Text("View Transactions", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = BunoTextSecondary
        )
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = BunoTextPrimary
        )
    }
}

// ─── ERROR / sync failure + retry ────────────────────────────────────────────
@Composable
private fun ErrorContent(uiState: BankSyncUiState, onRetry: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.ErrorOutline,
                contentDescription = "Sync failed",
                tint = RiskFragile,
                modifier = Modifier.size(56.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Sync failed",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                color = BunoTextPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Text(
                    text = uiState.errorMessage ?: "Something went wrong while syncing. Please try again.",
                    modifier = Modifier.padding(14.dp),
                    fontSize = 13.sp,
                    color = BunoTextSecondary,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = onRetry,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BunoPrimary,
                    contentColor = BunoOnPrimary
                )
            ) {
                Text("Retry", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}