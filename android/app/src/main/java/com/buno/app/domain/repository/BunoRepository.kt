package com.buno.app.domain.repository

import com.buno.app.domain.model.BudgetState
import com.buno.app.domain.model.Expense
import com.buno.app.domain.model.PatternInsight
import kotlinx.coroutines.flow.Flow

interface BunoRepository {
    fun getExpenses(): Flow<List<Expense>>
    fun getBudgetState(): Flow<BudgetState>
    fun getPatternInsight(): Flow<PatternInsight>
    fun getGreetingAdvice(): Flow<String>
    
    suspend fun addExpense(expense: Expense)
    suspend fun deleteExpense(id: String)
    suspend fun updateMonthlyBudget(amount: Double)
    suspend fun resetToDefaults()
    suspend fun clearExpenses()
}
