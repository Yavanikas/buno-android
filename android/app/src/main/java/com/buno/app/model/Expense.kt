package com.buno.app.model

data class Expense(
    val id: String,
    val amount: Double,
    val category: ExpenseCategory,
    val note: String = "",
    val date: String, // ISO date string: "2026-07-01"
    val source: String = "manual",
    val budgetId: String? = null
)

enum class ExpenseCategory(val displayName: String) {
    FOOD("Food"),
    TRANSPORT("Transport"),
    GROCERIES("Groceries"),
    SUBSCRIPTIONS("Subscriptions"),
    ACADEMICS("Academics"),
    SOCIAL("Social"),
    PERSONAL_CARE("Personal Care"),
    OTHER("Other");

    companion object {
        fun fromString(value: String): ExpenseCategory =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
                ?: entries.firstOrNull { it.displayName.equals(value, ignoreCase = true) }
                ?: OTHER
    }
}
