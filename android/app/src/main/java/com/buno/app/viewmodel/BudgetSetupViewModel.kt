package com.buno.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.buno.app.domain.repository.BudgetRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BudgetSetupUiState(
    val amountInput: String = "50000",
    val currency: String = "INR",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isSuccess: Boolean = false
)

@HiltViewModel
class BudgetSetupViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BudgetSetupUiState())
    val uiState: StateFlow<BudgetSetupUiState> = _uiState.asStateFlow()

    fun onAmountChanged(value: String) {
        // Keep only digits and decimal point
        val cleaned = value.filter { it.isDigit() || it == '.' }
        _uiState.update { it.copy(amountInput = cleaned, errorMessage = null) }
    }

    fun onCurrencyChanged(value: String) {
        _uiState.update { it.copy(currency = value) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun saveBudget() {
        val state = _uiState.value
        val amount = state.amountInput.toDoubleOrNull()

        if (amount == null || amount <= 0) {
            _uiState.update { it.copy(errorMessage = "Please enter a valid monthly budget amount.") }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            val result = budgetRepository.createBudget(
                monthlyLimit = amount,
                currency = state.currency
            )
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false, isSuccess = true, errorMessage = null) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Failed to save monthly budget."
                        )
                    }
                }
            )
        }
    }
}
