package com.buno.app.model

data class Budget(
    val id: String,
    val monthlyLimit: Double,
    val currency: String = "INR",
    val month: Int,
    val year: Int,
    val qualitativeState: BudgetState? = null
)
