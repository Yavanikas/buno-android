package com.buno.app.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.buno.app.presentation.theme.*
import com.buno.app.viewmodel.BudgetSetupViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetSetupScreen(
    onSetupComplete: () -> Unit,
    viewModel: BudgetSetupViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onSetupComplete()
        }
    }

    Scaffold(
        containerColor = BunoBackground
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Editorial Heading
                Text(
                    text = "Set Your Monthly Rhythm",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = BunoTextPrimary,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Text(
                    text = "Buno translates your monthly target into calm, qualitative signals — keeping you mindful without exact numerical stress.",
                    fontSize = 14.sp,
                    color = BunoTextSecondary,
                    lineHeight = 20.sp,
                    modifier = Modifier.padding(bottom = 32.dp)
                )

                // Setup Card
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
                            .padding(24.dp)
                    ) {
                        // Error Banner
                        if (uiState.errorMessage != null) {
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 16.dp),
                                shape = RoundedCornerShape(8.dp),
                                color = RiskFragile.copy(alpha = 0.12f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RiskFragile.copy(alpha = 0.4f))
                            ) {
                                Text(
                                    text = uiState.errorMessage!!,
                                    color = RiskFragile,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }

                        // Currency Selector
                        Text(
                            text = "Currency",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = BunoTextSecondary,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            listOf("INR" to "₹ Indian Rupee (INR)", "USD" to "$ US Dollar (USD)").forEach { (code, label) ->
                                val isSelected = uiState.currency == code
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { viewModel.onCurrencyChanged(code) },
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (isSelected) BunoPrimary else Color.White,
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (isSelected) BunoPrimary else BunoBorder
                                    )
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) BunoOnPrimary else BunoTextPrimary,
                                        modifier = Modifier
                                            .padding(vertical = 12.dp, horizontal = 8.dp)
                                            .wrapContentWidth(Alignment.CenterHorizontally)
                                    )
                                }
                            }
                        }

                        // Monthly Target Amount Field
                        Text(
                            text = "Monthly Spending Target",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = BunoTextSecondary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        OutlinedTextField(
                            value = uiState.amountInput,
                            onValueChange = { viewModel.onAmountChanged(it) },
                            placeholder = { Text("e.g. 50000", color = BunoTextMuted) },
                            prefix = {
                                Text(
                                    text = if (uiState.currency == "INR") "₹ " else "$ ",
                                    fontWeight = FontWeight.Bold,
                                    color = BunoTextPrimary
                                )
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Number,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    focusManager.clearFocus()
                                    viewModel.saveBudget()
                                }
                            ),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White,
                                focusedBorderColor = BunoPrimary,
                                unfocusedBorderColor = BunoBorder,
                                focusedTextColor = BunoTextPrimary,
                                unfocusedTextColor = BunoTextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 24.dp),
                            shape = RoundedCornerShape(10.dp)
                        )

                        // Save & Continue Button
                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                viewModel.saveBudget()
                            },
                            enabled = !uiState.isLoading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = BunoPrimary,
                                contentColor = BunoOnPrimary
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = BunoOnPrimary,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    text = "Save & Enter Dashboard",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
