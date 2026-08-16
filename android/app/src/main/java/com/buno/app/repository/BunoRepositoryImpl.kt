package com.buno.app.repository

import com.buno.app.data.local.TokenStore
import com.buno.app.domain.repository.AuthRepository
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.domain.repository.TransactionRepository
import com.buno.app.model.BudgetState
import com.buno.app.model.ConfidenceLevel
import com.buno.app.model.Expense
import com.buno.app.model.PatternInsight
import com.buno.app.model.User
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BunoRepositoryImpl @Inject constructor(
    private val authRepo: AuthRepository,
    private val budgetRepo: BudgetRepository,
    private val transactionRepo: TransactionRepository,
    private val tokenStore: TokenStore
) : BunoRepository {

    private val _patternInsight = MutableStateFlow(
        PatternInsight(
            patternTag = "Recent activity",
            insight = "Nothing unusual stands out in your recent spending.",
            confidence = ConfidenceLevel.LOW
        )
    )

    // ─── Auth ─────────────────────────────────────────────────────────────────
    override val isLoggedIn: Flow<Boolean> = authRepo.isLoggedIn

    override suspend fun register(email: String, password: String, name: String?): Result<User> =
        authRepo.register(email, password, name)

    override suspend fun login(email: String, password: String): Result<User> =
        authRepo.login(email, password)

    override suspend fun logout() {
        authRepo.logout()
    }

    // ─── Budget ───────────────────────────────────────────────────────────────
    override fun getBudgetState(): Flow<BudgetState> = budgetRepo.budgetState

    override suspend fun refreshBudgetState(): Result<Unit> = runCatching {
        budgetRepo.refreshBudgetState().getOrThrow()
        Unit
    }

    override suspend fun updateMonthlyBudget(amount: Double, currency: String): Result<Unit> = runCatching {
        val activeId = tokenStore.activeBudgetId.firstOrNull()
        if (activeId.isNullOrBlank()) {
            budgetRepo.createBudget(monthlyLimit = amount, currency = currency).getOrThrow()
        } else {
            budgetRepo.updateBudget(id = activeId, monthlyLimit = amount, currency = currency).getOrThrow()
        }
        Unit
    }

    // ─── Transactions ─────────────────────────────────────────────────────────
    override fun getTransactions(): Flow<List<Expense>> {
        val activeId = runCatching {
            kotlinx.coroutines.runBlocking { tokenStore.activeBudgetId.firstOrNull() }
        }.getOrNull() ?: ""
        return transactionRepo.getTransactions(activeId)
    }

    override suspend fun refreshTransactions(): Result<Unit> = runCatching {
        val activeId = tokenStore.activeBudgetId.firstOrNull()
        if (!activeId.isNullOrBlank()) {
            transactionRepo.refreshTransactions(activeId).getOrThrow()
        }
        Unit
    }

    override suspend fun addTransaction(expense: Expense): Result<Unit> = runCatching {
        val activeId = tokenStore.activeBudgetId.firstOrNull()
            ?: throw Exception("No active budget found. Please set up a budget first.")
        transactionRepo.addTransaction(
            budgetId = activeId,
            amount = expense.amount,
            category = expense.category,
            note = expense.note,
            date = expense.date
        ).getOrThrow()
        budgetRepo.refreshBudgetState(activeId)
        Unit
    }

    override suspend fun deleteTransaction(id: String): Result<Unit> = runCatching {
        val activeId = tokenStore.activeBudgetId.firstOrNull()
            ?: throw Exception("No active budget found.")
        transactionRepo.deleteTransaction(budgetId = activeId, transactionId = id).getOrThrow()
        budgetRepo.refreshBudgetState(activeId)
        Unit
    }

    // ─── Pattern Insight ──────────────────────────────────────────────────────
    override fun getPatternInsight(): Flow<PatternInsight> = _patternInsight.asStateFlow()

    override suspend fun refreshPatternInsight(): Result<Unit> = runCatching {
        // Will be wired to backend insights in future steps
    }

    // ─── Settings ────────────────────────────────────────────────────────────
    override val currency: Flow<String> = tokenStore.currency

    override suspend fun setCurrency(currency: String) {
        tokenStore.setCurrency(currency)
    }
}
