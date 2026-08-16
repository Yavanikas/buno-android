package com.buno.app.repository

import com.buno.app.data.local.TokenStore
import com.buno.app.model.BudgetState
import com.buno.app.model.ConfidenceLevel
import com.buno.app.model.Expense
import com.buno.app.model.ExpenseCategory
import com.buno.app.model.PatternInsight
import com.buno.app.model.RiskLabel
import com.buno.app.model.User
import com.buno.app.network.BunoApiService
import com.buno.app.network.dto.CreateTransactionRequest
import com.buno.app.network.dto.LoginRequest
import com.buno.app.network.dto.RegisterRequest
import com.buno.app.network.dto.UpdateBudgetRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BunoRepositoryImpl @Inject constructor(
    private val api: BunoApiService,
    private val tokenStore: TokenStore
) : BunoRepository {

    // ─── In-memory state (backed by StateFlow) ────────────────────────────────
    private val _budgetState = MutableStateFlow(defaultBudgetState())
    private val _transactions = MutableStateFlow<List<Expense>>(emptyList())
    private val _patternInsight = MutableStateFlow(defaultPatternInsight())

    // ─── Auth ─────────────────────────────────────────────────────────────────
    override val isLoggedIn: Flow<Boolean> = tokenStore.accessToken.map { it != null }

    override suspend fun register(email: String, password: String, name: String?): Result<User> =
        runCatching {
            val response = api.register(RegisterRequest(email, password, name))
            if (response.isSuccessful) {
                val body = response.body()!!
                tokenStore.saveAuthToken(body.accessToken, body.userId, email)
                User(id = body.userId, email = email, name = name)
            } else {
                throw Exception("Registration failed: ${response.code()}")
            }
        }

    override suspend fun login(email: String, password: String): Result<User> =
        runCatching {
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()!!
                tokenStore.saveAuthToken(body.accessToken, body.userId, email)
                User(id = body.userId, email = email, name = null)
            } else {
                throw Exception("Login failed: ${response.code()}")
            }
        }

    override suspend fun logout() {
        tokenStore.clearSession()
        _budgetState.value = defaultBudgetState()
        _transactions.value = emptyList()
        _patternInsight.value = defaultPatternInsight()
    }

    // ─── Budget ───────────────────────────────────────────────────────────────
    override fun getBudgetState(): Flow<BudgetState> = _budgetState.asStateFlow()

    override suspend fun refreshBudgetState(): Result<Unit> = runCatching {
        val response = api.getBudgetState()
        if (response.isSuccessful) {
            val dto = response.body()!!
            _budgetState.value = BudgetState(
                riskLabel = RiskLabel.fromString(dto.riskLabel),
                zoneLabel = dto.zoneLabel,
                paceLabel = dto.paceLabel,
                daysRemaining = dto.daysRemaining,
                expensesLogged = dto.expensesLogged,
                currency = dto.currency
            )
        } else {
            throw Exception("Failed to refresh budget: ${response.code()}")
        }
    }

    override suspend fun updateMonthlyBudget(amount: Double, currency: String): Result<Unit> =
        runCatching {
            val response = api.updateBudget(UpdateBudgetRequest(amount, currency))
            if (!response.isSuccessful) throw Exception("Failed to update budget: ${response.code()}")
        }

    // ─── Transactions ─────────────────────────────────────────────────────────
    override fun getTransactions(): Flow<List<Expense>> = _transactions.asStateFlow()

    override suspend fun refreshTransactions(): Result<Unit> = runCatching {
        val response = api.getTransactions()
        if (response.isSuccessful) {
            _transactions.value = response.body()!!.map { dto ->
                Expense(
                    id = dto.id,
                    amount = dto.amount,
                    category = ExpenseCategory.fromString(dto.category),
                    note = dto.note ?: "",
                    date = dto.date,
                    source = dto.source
                )
            }
        } else {
            throw Exception("Failed to refresh transactions: ${response.code()}")
        }
    }

    override suspend fun addTransaction(expense: Expense): Result<Unit> = runCatching {
        val response = api.createTransaction(
            CreateTransactionRequest(
                amount = expense.amount,
                category = expense.category.name.lowercase(),
                note = expense.note,
                date = expense.date
            )
        )
        if (response.isSuccessful) {
            // Refresh the local list
            refreshTransactions()
        } else {
            throw Exception("Failed to add transaction: ${response.code()}")
        }
    }

    override suspend fun deleteTransaction(id: String): Result<Unit> = runCatching {
        val response = api.deleteTransaction(id)
        if (response.isSuccessful) {
            _transactions.value = _transactions.value.filter { it.id != id }
        } else {
            throw Exception("Failed to delete transaction: ${response.code()}")
        }
    }

    // ─── Pattern Insight ──────────────────────────────────────────────────────
    override fun getPatternInsight(): Flow<PatternInsight> = _patternInsight.asStateFlow()

    override suspend fun refreshPatternInsight(): Result<Unit> = runCatching {
        val response = api.getPatternInsight()
        if (response.isSuccessful) {
            val dto = response.body()!!
            _patternInsight.value = PatternInsight(
                patternTag = dto.patternTag,
                insight = dto.insight,
                confidence = ConfidenceLevel.fromString(dto.confidence)
            )
        } else {
            throw Exception("Failed to refresh pattern insight: ${response.code()}")
        }
    }

    // ─── Settings ────────────────────────────────────────────────────────────
    override val currency: Flow<String> = tokenStore.currency

    override suspend fun setCurrency(currency: String) {
        tokenStore.setCurrency(currency)
    }

    // ─── Private helpers ─────────────────────────────────────────────────────
    private fun defaultBudgetState() = BudgetState(
        riskLabel = RiskLabel.WATCHFUL,
        zoneLabel = "You are keeping a steady pace.",
        paceLabel = "Things are getting tighter.",
        daysRemaining = 0,
        expensesLogged = 0
    )

    private fun defaultPatternInsight() = PatternInsight(
        patternTag = "Recent activity",
        insight = "Nothing unusual stands out in your recent spending.",
        confidence = ConfidenceLevel.LOW
    )
}
