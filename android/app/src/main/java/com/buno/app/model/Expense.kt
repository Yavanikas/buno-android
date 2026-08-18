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
    SHOPPING("Shopping"),
    ENTERTAINMENT("Entertainment"),
    UTILITIES("Utilities"),
    PERSONAL_CARE("Personal Care"),
    HEALTHCARE("Healthcare"),
    EDUCATION("Education"),
    INCOME("Income"),
    SUBSCRIPTIONS("Subscriptions"),
    ACADEMICS("Academics"),
    SOCIAL("Social"),
    OTHER("Other");

    companion object {
        fun fromString(value: String): ExpenseCategory =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
                ?: entries.firstOrNull { it.displayName.equals(value, ignoreCase = true) }
                ?: OTHER
    }
}
