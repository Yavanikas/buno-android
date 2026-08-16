package com.buno.app.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.buno.app.model.ExpenseCategory
import com.buno.app.model.RiskLabel
import com.buno.app.presentation.theme.*
import com.buno.app.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToTransactions: () -> Unit,
    onNavigateToPatterns: () -> Unit = {},
    onNavigateToBankSync: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToPremium: () -> Unit = {},
    onLogout: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = BunoBackground,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Buno",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Serif,
                            color = BunoTextPrimary
                        )
                        Text(
                            text = "Qualitative Dashboard",
                            fontSize = 12.sp,
                            color = BunoTextSecondary
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadDashboard() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = BunoTextSecondary
                        )
                    }
                    IconButton(onClick = {
                        viewModel.logout()
                        onLogout()
                    }) {
                        Icon(
                            imageVector = Icons.Default.ExitToApp,
                            contentDescription = "Logout",
                            tint = BunoTextSecondary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BunoBackground
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = BunoPrimary,
                contentColor = BunoOnPrimary,
                shape = CircleShape
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Log Expense")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(top = 8.dp, bottom = 80.dp)
        ) {
            // ─── 1. Qualitative Spending Signal Hero Card ────────────────────
            item {
                val risk = uiState.budgetState.riskLabel
                val (badgeBg, badgeText, badgeLabel) = when (risk) {
                    RiskLabel.SAFE -> Triple(RiskSafe.copy(alpha = 0.15f), RiskSafe, "SAFE PACE")
                    RiskLabel.WATCHFUL -> Triple(RiskWatchful.copy(alpha = 0.15f), RiskWatchful, "STEADY PACE")
                    RiskLabel.FRAGILE -> Triple(RiskFragile.copy(alpha = 0.15f), RiskFragile, "TIGHT PACE")
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .border(1.dp, BunoBorder, RoundedCornerShape(16.dp)),
                    colors = CardDefaults.cardColors(containerColor = BunoAsideBackground)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp)
                    ) {
                        // Badge row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = badgeBg,
                                border = androidx.compose.foundation.BorderStroke(1.dp, badgeText.copy(alpha = 0.3f))
                            ) {
                                Text(
                                    text = badgeLabel,
                                    color = badgeText,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    letterSpacing = 1.sp
                                )
                            }

                            Text(
                                text = "${uiState.currency} Cycle",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = BunoTextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Qualitative Main Signal (Zero Numeric Balance!)
                        Text(
                            text = uiState.budgetState.zoneLabel,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Serif,
                            color = BunoTextPrimary,
                            lineHeight = 26.sp
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = uiState.budgetState.paceLabel,
                            fontSize = 14.sp,
                            color = BunoTextSecondary,
                            lineHeight = 20.sp
                        )

                        Spacer(modifier = Modifier.height(20.dp))
                        Divider(color = BunoBorder)
                        Spacer(modifier = Modifier.height(16.dp))

                        // Qualitative Meta Metrics
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "Days Remaining",
                                    fontSize = 11.sp,
                                    color = BunoTextMuted
                                )
                                Text(
                                    text = "${uiState.budgetState.daysRemaining} days",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = BunoTextPrimary
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Expenses Logged",
                                    fontSize = 11.sp,
                                    color = BunoTextMuted
                                )
                                Text(
                                    text = "${uiState.budgetState.expensesLogged} entries",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = BunoTextPrimary
                                )
                            }
                        }
                    }
                }
            }

            // ─── 2. Recent Transactions Section ──────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Recent Transactions",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = BunoTextPrimary
                    )

                    TextButton(onClick = onNavigateToTransactions) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "View All",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = BunoPrimary
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowForward,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = BunoPrimary
                            )
                        }
                    }
                }
            }

            if (uiState.recentTransactions.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, BunoBorderDashed, RoundedCornerShape(12.dp)),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No expenses logged yet this cycle.\nTap + below to record your first expense.",
                                fontSize = 13.sp,
                                color = BunoTextMuted,
                                lineHeight = 18.sp,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(uiState.recentTransactions, key = { it.id }) { expense ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, BunoBorder, RoundedCornerShape(12.dp)),
                        color = Color.White
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = BunoAsideBackground,
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = expense.category.name.take(1),
                                            fontWeight = FontWeight.Bold,
                                            color = BunoPrimary,
                                            fontSize = 14.sp
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column {
                                    Text(
                                        text = expense.category.displayName,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = BunoTextPrimary
                                    )
                                    if (expense.note.isNotBlank()) {
                                        Text(
                                            text = expense.note,
                                            fontSize = 12.sp,
                                            color = BunoTextSecondary,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "${if (uiState.currency == "INR") "₹" else "$"}${expense.amount}",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = BunoTextPrimary,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                                IconButton(
                                    onClick = { viewModel.deleteTransaction(expense.id) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Delete expense",
                                        tint = BunoTextMuted,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ─── Quick Add Expense Dialog ─────────────────────────────────────────────
    if (showAddDialog) {
        AddExpenseDialog(
            currency = uiState.currency,
            onDismiss = { showAddDialog = false },
            onConfirm = { amount, category, note ->
                viewModel.quickAddExpense(amount, category, note)
                showAddDialog = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddExpenseDialog(
    currency: String,
    onDismiss: () -> Unit,
    onConfirm: (amount: Double, category: ExpenseCategory, note: String) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(ExpenseCategory.FOOD) }
    var noteText by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Log Expense",
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.Bold,
                color = BunoTextPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            ) {
                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = RiskFragile,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }

                // Amount
                Text(
                    text = "Amount",
                    fontSize = 12.sp,
                    color = BunoTextSecondary,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                OutlinedTextField(
                    value = amountText,
                    onValueChange = {
                        val cleaned = it.filter { c -> c.isDigit() || c == '.' }
                        amountText = cleaned
                    },
                    placeholder = { Text("0.00") },
                    prefix = { Text(if (currency == "INR") "₹ " else "$ ") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    shape = RoundedCornerShape(8.dp)
                )

                // Category Dropdown
                Text(
                    text = "Category",
                    fontSize = 12.sp,
                    color = BunoTextSecondary,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                ExposedDropdownMenuBox(
                    expanded = isExpanded,
                    onExpandedChange = { isExpanded = !isExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedCategory.displayName,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                            .padding(bottom = 12.dp),
                        shape = RoundedCornerShape(8.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = isExpanded,
                        onDismissRequest = { isExpanded = false }
                    ) {
                        ExpenseCategory.entries.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat.displayName) },
                                onClick = {
                                    selectedCategory = cat
                                    isExpanded = false
                                }
                            )
                        }
                    }
                }

                // Note
                Text(
                    text = "Note (Optional)",
                    fontSize = 12.sp,
                    color = BunoTextSecondary,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    placeholder = { Text("e.g. Lunch with team") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull()
                    if (amt == null || amt <= 0) {
                        errorMessage = "Please enter a valid amount"
                        return@Button
                    }
                    onConfirm(amt, selectedCategory, noteText)
                },
                colors = ButtonDefaults.buttonColors(containerColor = BunoPrimary)
            ) {
                Text("Log", color = BunoOnPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = BunoTextSecondary)
            }
        },
        containerColor = BunoBackground
    )
}
