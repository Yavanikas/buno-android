package com.buno.app.data.repository

import com.buno.app.domain.model.BudgetState
import com.buno.app.domain.model.ConfidenceLevel
import com.buno.app.domain.model.Expense
import com.buno.app.domain.model.PatternInsight
import com.buno.app.domain.model.RiskLabel
import com.buno.app.domain.repository.BunoRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

class MockBunoRepository : BunoRepository {
    
    private val defaultExpenses = listOf(
        Expense(UUID.randomUUID().toString(), 90.0, "food", "Canteen breakfast", "2026-07-01"),
        Expense(UUID.randomUUID().toString(), 45.0, "transport", "Metro recharge", "2026-07-03"),
        Expense(UUID.randomUUID().toString(), 320.0, "groceries", "Hostel snacks", "2026-07-05"),
        Expense(UUID.randomUUID().toString(), 149.0, "subscriptions", "Music plan", "2026-07-07"),
        Expense(UUID.randomUUID().toString(), 520.0, "academics", "Lab manual", "2026-07-09"),
        Expense(UUID.randomUUID().toString(), 180.0, "food", "Lunch with friends", "2026-07-10")
    )

    private val _expenses = MutableStateFlow(defaultExpenses)
    
    private val _budgetState = MutableStateFlow(
        BudgetState(
            riskLabel = RiskLabel.WATCHFUL,
            zoneLabel = "You are keeping a steady pace.",
            paceLabel = "Things are getting tighter."
        )
    )

    private val _patternInsight = MutableStateFlow(
        PatternInsight(
            patternTag = "Recent activity",
            insight = "Recent spending activity is worth watching over the next few days.",
            confidence = ConfidenceLevel.LOW
        )
    )
    
    private val _greetingAdvice = MutableStateFlow("You're spending slower than usual this week.")

    override fun getExpenses(): Flow<List<Expense>> = _expenses.asStateFlow()
    override fun getBudgetState(): Flow<BudgetState> = _budgetState.asStateFlow()
    override fun getPatternInsight(): Flow<PatternInsight> = _patternInsight.asStateFlow()
    override fun getGreetingAdvice(): Flow<String> = _greetingAdvice.asStateFlow()

    override suspend fun addExpense(expense: Expense) {
        val current = _expenses.value.toMutableList()
        current.add(expense)
        _expenses.value = current
    }

    override suspend fun deleteExpense(id: String) {
        _expenses.value = _expenses.value.filter { it.id != id }
    }

    override suspend fun updateMonthlyBudget(amount: Double) {
        // Mock update
    }

    override suspend fun resetToDefaults() {
        _expenses.value = defaultExpenses
    }

    override suspend fun clearExpenses() {
        _expenses.value = emptyList()
    }
}
