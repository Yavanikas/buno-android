package com.buno.app.data.repository

import com.buno.app.domain.repository.TransactionRepository
import com.buno.app.model.Expense
import com.buno.app.model.ExpenseCategory
import com.buno.app.network.BunoApiService
import com.buno.app.network.dto.CreateTransactionRequest
import com.buno.app.network.dto.TransactionDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TransactionRepositoryImpl @Inject constructor(
    private val api: BunoApiService
) : TransactionRepository {

    private val transactionFlows = ConcurrentHashMap<String, MutableStateFlow<List<Expense>>>()

    private fun getFlowForBudget(budgetId: String): MutableStateFlow<List<Expense>> {
        return transactionFlows.computeIfAbsent(budgetId) {
            MutableStateFlow(emptyList())
        }
    }

    override fun getTransactions(budgetId: String): Flow<List<Expense>> {
        return getFlowForBudget(budgetId).asStateFlow()
    }

    override suspend fun refreshTransactions(budgetId: String): Result<List<Expense>> = runCatching {
        val response = api.getTransactions(budgetId)
        if (response.isSuccessful && response.body()?.status == "success") {
            val dtoList = response.body()!!.data ?: emptyList()
            val domainList = dtoList.map { it.toDomain() }
            getFlowForBudget(budgetId).value = domainList
            domainList
        } else {
            throw Exception(response.body()?.message ?: "Failed to fetch transactions (${response.code()})")
        }
    }

    override suspend fun addTransaction(
        budgetId: String,
        amount: Double,
        category: ExpenseCategory,
        note: String?,
        date: String?
    ): Result<Expense> = runCatching {
        val response = api.createTransaction(
            budgetId = budgetId,
            request = CreateTransactionRequest(
                amount = amount,
                category = category.name.lowercase(),
                note = note,
                date = date
            )
        )
        if (response.isSuccessful && response.body()?.status == "success") {
            val created = response.body()!!.data!!.toDomain()
            val flow = getFlowForBudget(budgetId)
            flow.value = listOf(created) + flow.value
            created
        } else {
            throw Exception(response.body()?.message ?: "Failed to add transaction (${response.code()})")
        }
    }

    override suspend fun deleteTransaction(budgetId: String, transactionId: String): Result<Unit> = runCatching {
        val response = api.deleteTransaction(budgetId = budgetId, id = transactionId)
        if (response.isSuccessful) {
            val flow = getFlowForBudget(budgetId)
            flow.value = flow.value.filter { it.id != transactionId }
            Unit
        } else {
            throw Exception(response.body()?.message ?: "Failed to delete transaction (${response.code()})")
        }
    }

    private fun TransactionDto.toDomain(): Expense = Expense(
        id = id,
        amount = amount,
        category = ExpenseCategory.fromString(category),
        note = note ?: "",
        date = date,
        source = source,
        budgetId = budgetId
    )
}
