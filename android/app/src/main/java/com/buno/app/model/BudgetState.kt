package com.buno.app.model

/**
 * The qualitative budget state derived from the backend.
 * CRITICAL: This model deliberately does NOT contain remainingBalance or any exact amount.
 * Buno philosophy: "Hide the number, reveal the signal."
 */
data class BudgetState(
    val riskLabel: RiskLabel,
    val zoneLabel: String,
    val paceLabel: String,
    val daysRemaining: Int,
    val expensesLogged: Int,
    val currency: String = "INR"
)
