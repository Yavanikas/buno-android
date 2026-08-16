package com.buno.app.repository

import com.buno.app.model.BudgetState
import com.buno.app.model.Expense
import com.buno.app.model.PatternInsight
import com.buno.app.model.User
import kotlinx.coroutines.flow.Flow

interface BunoRepository {
    // ─── Auth ────────────────────────────────────────────────────────────────
    suspend fun register(email: String, password: String, name: String?): Result<User>
    suspend fun login(email: String, password: String): Result<User>
    suspend fun logout()
    val isLoggedIn: Flow<Boolean>

    // ─── Budget ──────────────────────────────────────────────────────────────
    fun getBudgetState(): Flow<BudgetState>
    suspend fun refreshBudgetState(): Result<Unit>
    suspend fun updateMonthlyBudget(amount: Double, currency: String): Result<Unit>

    // ─── Transactions ────────────────────────────────────────────────────────
    fun getTransactions(): Flow<List<Expense>>
    suspend fun refreshTransactions(): Result<Unit>
    suspend fun addTransaction(expense: Expense): Result<Unit>
    suspend fun deleteTransaction(id: String): Result<Unit>

    // ─── AI Insights (backend-served) ────────────────────────────────────────
    fun getPatternInsight(): Flow<PatternInsight>
    suspend fun refreshPatternInsight(): Result<Unit>

    // ─── Settings ────────────────────────────────────────────────────────────
    val currency: Flow<String>
    suspend fun setCurrency(currency: String)
}
