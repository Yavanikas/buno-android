package com.buno.app.domain.model

enum class RiskLabel {
    SAFE, WATCHFUL, FRAGILE
}

data class BudgetState(
    val riskLabel: RiskLabel,
    val zoneLabel: String,
    val paceLabel: String
)
