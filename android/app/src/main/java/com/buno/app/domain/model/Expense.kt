package com.buno.app.domain.model

data class Expense(
    val id: String,
    val amount: Double,
    val category: String,
    val note: String,
    val date: String
)
