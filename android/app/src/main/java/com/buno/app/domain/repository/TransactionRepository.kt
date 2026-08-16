package com.buno.app.domain.repository

import com.buno.app.model.Expense
import com.buno.app.model.ExpenseCategory
import kotlinx.coroutines.flow.Flow

interface TransactionRepository {
    fun getTransactions(budgetId: String): Flow<List<Expense>>
    suspend fun refreshTransactions(budgetId: String): Result<List<Expense>>
    suspend fun addTransaction(
        budgetId: String,
        amount: Double,
        category: ExpenseCategory,
        note: String? = null,
        date: String? = null
    ): Result<Expense>
    suspend fun deleteTransaction(budgetId: String, transactionId: String): Result<Unit>
}
