package com.buno.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.domain.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SyncUiPhase {
    IDLE,        // "Connect Bank" intro + disclaimer
    SYNCING,     // progress/loading
    SUCCESS,     // transactions synced
    ERROR        // sync failure
}

data class BankSyncUiState(
    val phase: SyncUiPhase = SyncUiPhase.IDLE,
    val showDisclaimer: Boolean = false,
    val isConnecting: Boolean = false,
    val transactionsFetched: Int = 0,
    val transactionsCreated: Int = 0,
    val duplicatesSkipped: Int = 0,
    val accountId: String? = null,
    val provider: String = "Demo Bank",
    val errorMessage: String? = null
)

@HiltViewModel
class BankSyncViewModel @Inject constructor(
    private val syncRepository: SyncRepository,
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BankSyncUiState())
    val uiState: StateFlow<BankSyncUiState> = _uiState.asStateFlow()

    /** First tap on "Connect Bank" — reveal the Demo Bank disclaimer. */
    fun onConnectBankClick() {
        _uiState.update { it.copy(showDisclaimer = true, errorMessage = null) }
    }

    /** Confirmed connect — starts the sync. */
    fun startSync() {
        _uiState.update {
            it.copy(phase = SyncUiPhase.SYNCING, isConnecting = true, errorMessage = null)
        }
        viewModelScope.launch {
            val budgetsResult = budgetRepository.getBudgets()
            val activeBudgetId = budgetsResult.getOrNull()?.firstOrNull()?.id

            if (activeBudgetId == null) {
                _uiState.update {
                    it.copy(
                        phase = SyncUiPhase.ERROR,
                        isConnecting = false,
                        errorMessage = "No active budget found. Set up a budget first to sync transactions."
                    )
                }
                return@launch
            }

            val result = syncRepository.startSync(activeBudgetId)
            result.fold(
                onSuccess = { response ->
                    pollSyncStatus(response.syncId)
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            phase = SyncUiPhase.ERROR,
                            isConnecting = false,
                            errorMessage = error.message ?: "Failed to start sync"
                        )
                    }
                }
            )
        }
    }

    private fun pollSyncStatus(syncId: String) {
        viewModelScope.launch {
            var attempts = 0
            while (attempts < 30) { // up to ~30s
                delay(1000)
                val statusResult = syncRepository.getSyncStatus(syncId)

                statusResult.fold(
                    onSuccess = { response ->
                        when (response.status) {
                            "success" -> {
                                syncRepository.acknowledgeSync(syncId)
                                _uiState.update {
                                    it.copy(
                                        phase = SyncUiPhase.SUCCESS,
                                        isConnecting = false,
                                        transactionsFetched = response.transactionsFetched,
                                        transactionsCreated = response.transactionsCreated,
                                        duplicatesSkipped = response.duplicatesSkipped,
                                        accountId = response.accountId,
                                        provider = response.provider ?: "Demo Bank",
                                        errorMessage = null
                                    )
                                }
                                return@launch
                            }
                            "error" -> {
                                _uiState.update {
                                    it.copy(
                                        phase = SyncUiPhase.ERROR,
                                        isConnecting = false,
                                        errorMessage = response.error ?: "Sync failed on the server"
                                    )
                                }
                                return@launch
                            }
                            else -> {
                                // status still "syncing" — keep polling
                            }
                        }
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(
                                phase = SyncUiPhase.ERROR,
                                isConnecting = false,
                                errorMessage = error.message ?: "Failed to get sync status"
                            )
                        }
                        return@launch
                    }
                )
                attempts++
            }
            _uiState.update {
                it.copy(
                    phase = SyncUiPhase.ERROR,
                    isConnecting = false,
                    errorMessage = "Sync timed out. Please retry."
                )
            }
        }
    }

    fun retry() {
        _uiState.update { it.copy(showDisclaimer = true, errorMessage = null) }
        startSync()
    }

    fun dismissDisclaimer() {
        _uiState.update { it.copy(showDisclaimer = false, errorMessage = null) }
    }

    fun reset() {
        _uiState.update {
            BankSyncUiState()
        }
    }
}
