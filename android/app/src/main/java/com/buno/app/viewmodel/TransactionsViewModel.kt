package com.buno.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.domain.repository.TransactionRepository
import com.buno.app.model.Expense
import com.buno.app.model.ExpenseCategory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TransactionsUiState(
    val isLoading: Boolean = false,
    val transactions: List<Expense> = emptyList(),
    val filteredTransactions: List<Expense> = emptyList(),
    val selectedCategory: ExpenseCategory? = null,
    val activeBudgetId: String? = null,
    val errorMessage: String? = null,
    val isAddSheetOpen: Boolean = false,
    val isAddingExpense: Boolean = false
)

@HiltViewModel
class TransactionsViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TransactionsUiState())
    val uiState: StateFlow<TransactionsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            budgetRepository.activeBudgetId.collect { budgetId ->
                _uiState.update { it.copy(activeBudgetId = budgetId) }
                if (!budgetId.isNullOrBlank()) {
                    transactionRepository.getTransactions(budgetId).collect { list ->
                        _uiState.update { state ->
                            val filtered = if (state.selectedCategory != null) {
                                list.filter { it.category == state.selectedCategory }
                            } else {
                                list
                            }
                            state.copy(transactions = list, filteredTransactions = filtered)
                        }
                    }
                }
            }
        }

        refresh()
    }

    fun refresh() {
        val budgetId = _uiState.value.activeBudgetId
        if (budgetId.isNullOrBlank()) return

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            val result = transactionRepository.refreshTransactions(budgetId)
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false) }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = err.message ?: "Failed to load transactions"
                        )
                    }
                }
            )
        }
    }

    fun selectCategory(category: ExpenseCategory?) {
        _uiState.update { state ->
            val filtered = if (category != null) {
                state.transactions.filter { it.category == category }
            } else {
                state.transactions
            }
            state.copy(selectedCategory = category, filteredTransactions = filtered)
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

    fun addTransaction(amount: Double, category: ExpenseCategory, note: String, date: String? = null) {
        val budgetId = _uiState.value.activeBudgetId ?: return
        _uiState.update { it.copy(isAddingExpense = true, errorMessage = null) }

        viewModelScope.launch {
            val result = transactionRepository.addTransaction(
                budgetId = budgetId,
                amount = amount,
                category = category,
                note = note.ifBlank { null },
                date = date
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
                            errorMessage = err.message ?: "Failed to add transaction"
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
}
