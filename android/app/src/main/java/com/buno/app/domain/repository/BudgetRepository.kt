package com.buno.app.domain.repository

import com.buno.app.model.Budget
import com.buno.app.model.BudgetState
import kotlinx.coroutines.flow.Flow

interface BudgetRepository {
    val activeBudgetId: Flow<String?>
    val budgetState: Flow<BudgetState>

    suspend fun getBudgets(): Result<List<Budget>>
    suspend fun getBudgetById(id: String): Result<Budget>
    suspend fun createBudget(
        monthlyLimit: Double,
        currency: String = "INR",
        month: Int? = null,
        year: Int? = null
    ): Result<Budget>
    suspend fun updateBudget(
        id: String,
        monthlyLimit: Double? = null,
        currency: String? = null
    ): Result<Budget>
    suspend fun deleteBudget(id: String): Result<Unit>
    suspend fun refreshBudgetState(budgetId: String? = null): Result<BudgetState>
    suspend fun setActiveBudgetId(id: String)
}
