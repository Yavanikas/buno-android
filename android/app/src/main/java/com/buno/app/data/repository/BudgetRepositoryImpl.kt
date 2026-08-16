package com.buno.app.data.repository

import com.buno.app.data.local.TokenStore
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.model.Budget
import com.buno.app.model.BudgetState
import com.buno.app.model.RiskLabel
import com.buno.app.network.BunoApiService
import com.buno.app.network.dto.BudgetDto
import com.buno.app.network.dto.CreateBudgetRequest
import com.buno.app.network.dto.QualitativeStateDto
import com.buno.app.network.dto.UpdateBudgetRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BudgetRepositoryImpl @Inject constructor(
    private val api: BunoApiService,
    private val tokenStore: TokenStore
) : BudgetRepository {

    override val activeBudgetId: Flow<String?> = tokenStore.activeBudgetId

    private val _budgetState = MutableStateFlow(defaultBudgetState())
    override val budgetState: Flow<BudgetState> = _budgetState.asStateFlow()

    override suspend fun getBudgets(): Result<List<Budget>> = runCatching {
        val response = api.getBudgets()
        if (response.isSuccessful && response.body()?.status == "success") {
            val list = response.body()!!.data ?: emptyList()
            val domainBudgets = list.map { it.toDomain() }

            // If active budget ID is unset, pick the most recent one
            val currentActiveId = tokenStore.activeBudgetId.firstOrNull()
            if (currentActiveId.isNullOrBlank() && domainBudgets.isNotEmpty()) {
                val latest = domainBudgets.first()
                tokenStore.setActiveBudgetId(latest.id)
                latest.qualitativeState?.let { _budgetState.value = it }
            } else if (!currentActiveId.isNullOrBlank()) {
                domainBudgets.find { it.id == currentActiveId }?.qualitativeState?.let {
                    _budgetState.value = it
                }
            }

            domainBudgets
        } else {
            throw Exception(response.body()?.message ?: "Failed to fetch budgets (${response.code()})")
        }
    }

    override suspend fun getBudgetById(id: String): Result<Budget> = runCatching {
        val response = api.getBudgetById(id)
        if (response.isSuccessful && response.body()?.status == "success") {
            val dto = response.body()!!.data!!
            val budget = dto.toDomain()
            budget.qualitativeState?.let { _budgetState.value = it }
            budget
        } else {
            throw Exception(response.body()?.message ?: "Failed to fetch budget (${response.code()})")
        }
    }

    override suspend fun createBudget(
        monthlyLimit: Double,
        currency: String,
        month: Int?,
        year: Int?
    ): Result<Budget> = runCatching {
        val response = api.createBudget(
            CreateBudgetRequest(
                monthlyLimit = monthlyLimit,
                currency = currency,
                month = month,
                year = year
            )
        )
        if (response.isSuccessful && response.body()?.status == "success") {
            val dto = response.body()!!.data!!
            val created = dto.toDomain()
            tokenStore.setActiveBudgetId(created.id)
            tokenStore.setCurrency(created.currency)
            created.qualitativeState?.let { _budgetState.value = it }
            created
        } else {
            throw Exception(response.body()?.message ?: "Failed to create budget (${response.code()})")
        }
    }

    override suspend fun updateBudget(
        id: String,
        monthlyLimit: Double?,
        currency: String?
    ): Result<Budget> = runCatching {
        val response = api.updateBudget(
            id = id,
            request = UpdateBudgetRequest(monthlyLimit = monthlyLimit, currency = currency)
        )
        if (response.isSuccessful && response.body()?.status == "success") {
            val dto = response.body()!!.data!!
            val updated = dto.toDomain()
            if (currency != null) {
                tokenStore.setCurrency(currency)
            }
            updated.qualitativeState?.let { _budgetState.value = it }
            updated
        } else {
            throw Exception(response.body()?.message ?: "Failed to update budget (${response.code()})")
        }
    }

    override suspend fun deleteBudget(id: String): Result<Unit> = runCatching {
        val response = api.deleteBudget(id)
        if (response.isSuccessful) {
            val currentActiveId = tokenStore.activeBudgetId.firstOrNull()
            if (currentActiveId == id) {
                _budgetState.value = defaultBudgetState()
            }
            Unit
        } else {
            throw Exception(response.body()?.message ?: "Failed to delete budget (${response.code()})")
        }
    }

    override suspend fun refreshBudgetState(budgetId: String?): Result<BudgetState> = runCatching {
        val targetId = budgetId ?: tokenStore.activeBudgetId.firstOrNull()
        if (targetId.isNullOrBlank()) {
            val budgets = getBudgets().getOrThrow()
            if (budgets.isNotEmpty()) {
                budgets.first().qualitativeState ?: _budgetState.value
            } else {
                _budgetState.value = defaultBudgetState()
                _budgetState.value
            }
        } else {
            val budget = getBudgetById(targetId).getOrThrow()
            budget.qualitativeState ?: _budgetState.value
        }
    }

    override suspend fun setActiveBudgetId(id: String) {
        tokenStore.setActiveBudgetId(id)
        refreshBudgetState(id)
    }

    private fun BudgetDto.toDomain(): Budget = Budget(
        id = id,
        monthlyLimit = monthlyLimit,
        currency = currency,
        month = month,
        year = year,
        qualitativeState = qualitativeState?.toDomain()
    )

    private fun QualitativeStateDto.toDomain(): BudgetState = BudgetState(
        riskLabel = RiskLabel.fromString(riskLabel),
        zoneLabel = zoneLabel,
        paceLabel = paceLabel,
        daysRemaining = daysRemaining,
        expensesLogged = expensesLogged,
        currency = currency
    )

    private fun defaultBudgetState() = BudgetState(
        riskLabel = RiskLabel.WATCHFUL,
        zoneLabel = "Keeping a steady rhythm.",
        paceLabel = "Pace is aligned with the monthly rhythm.",
        daysRemaining = 0,
        expensesLogged = 0,
        currency = "INR"
    )
}
