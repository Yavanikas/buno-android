package com.buno.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.buno.app.domain.repository.AuthRepository
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.domain.repository.TransactionRepository
import com.buno.app.model.BudgetState
import com.buno.app.model.Expense
import com.buno.app.model.ExpenseCategory
import com.buno.app.model.RiskLabel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val budgetState: BudgetState = BudgetState(
        riskLabel = RiskLabel.SAFE,
        zoneLabel = "Keeping a steady pace.",
        paceLabel = "Pace is aligned with the monthly rhythm.",
        daysRemaining = 0,
        expensesLogged = 0,
        currency = "INR"
    ),
    val recentTransactions: List<Expense> = emptyList(),
    val activeBudgetId: String? = null,
    val currency: String = "INR",
    val errorMessage: String? = null,
    val isAddSheetOpen: Boolean = false,
    val isAddingExpense: Boolean = false,
    val hasBudget: Boolean = true
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val transactionRepository: TransactionRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        // Collect budget state reactively
        viewModelScope.launch {
            budgetRepository.budgetState.collect { state ->
                _uiState.update { it.copy(budgetState = state, currency = state.currency) }
            }
        }

        // Collect active budget ID and observe its transactions
        viewModelScope.launch {
            budgetRepository.activeBudgetId.collect { budgetId ->
                _uiState.update { it.copy(activeBudgetId = budgetId) }
                if (!budgetId.isNullOrBlank()) {
                    transactionRepository.getTransactions(budgetId).collect { transactions ->
                        _uiState.update { it.copy(recentTransactions = transactions.take(5)) }
                    }
                }
            }
        }

        loadDashboard()
    }

    fun loadDashboard() {
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            val budgetsResult = budgetRepository.getBudgets()
            budgetsResult.fold(
                onSuccess = { budgets ->
                    if (budgets.isEmpty()) {
                        _uiState.update { it.copy(isLoading = false, hasBudget = false) }
                    } else {
                        val active = budgets.first()
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                hasBudget = true,
                                activeBudgetId = active.id,
                                currency = active.currency
                            )
                        }
                        transactionRepository.refreshTransactions(active.id)
                        budgetRepository.refreshBudgetState(active.id)
                    }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = err.message ?: "Failed to refresh dashboard"
                        )
                    }
                }
            )
        }
    }

    fun openAddSheet() {
        _uiState.update { it.copy(isAddSheetOpen = true) }
    }

    fun closeAddSheet() {
        _uiState.update { it.copy(isAddSheetOpen = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun quickAddExpense(amount: Double, category: ExpenseCategory, note: String) {
        val budgetId = _uiState.value.activeBudgetId
        if (budgetId.isNullOrBlank()) {
            _uiState.update { it.copy(errorMessage = "Please set up a monthly budget first.") }
            return
        }

        _uiState.update { it.copy(isAddingExpense = true, errorMessage = null) }
        viewModelScope.launch {
            val result = transactionRepository.addTransaction(
                budgetId = budgetId,
                amount = amount,
                category = category,
                note = note.ifBlank { null },
                date = null
            )
            result.fold(
                onSuccess = {
                    budgetRepository.refreshBudgetState(budgetId)
                    _uiState.update { it.copy(isAddingExpense = false, isAddSheetOpen = false) }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isAddingExpense = false,
                            errorMessage = err.message ?: "Failed to log expense"
                        )
                    }
                }
            )
        }
    }

    fun deleteTransaction(transactionId: String) {
        val budgetId = _uiState.value.activeBudgetId ?: return
        viewModelScope.launch {
            transactionRepository.deleteTransaction(budgetId, transactionId)
            budgetRepository.refreshBudgetState(budgetId)
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}
