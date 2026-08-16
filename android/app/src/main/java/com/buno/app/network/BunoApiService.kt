package com.buno.app.network

import com.buno.app.network.dto.AdviceResponse
import com.buno.app.network.dto.AuthResponse
import com.buno.app.network.dto.BudgetStateResponse
import com.buno.app.network.dto.CreateTransactionRequest
import com.buno.app.network.dto.HealthResponse
import com.buno.app.network.dto.LoginRequest
import com.buno.app.network.dto.PatternInsightResponse
import com.buno.app.network.dto.RegisterRequest
import com.buno.app.network.dto.TransactionResponse
import com.buno.app.network.dto.UpdateBudgetRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface BunoApiService {

    // ─── Health ──────────────────────────────────────────────────────────────
    @GET("health")
    suspend fun getHealth(): Response<HealthResponse>

    // ─── Auth ────────────────────────────────────────────────────────────────
    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    // ─── Budget ──────────────────────────────────────────────────────────────
    @GET("api/v1/budget")
    suspend fun getBudgetState(): Response<BudgetStateResponse>

    @PUT("api/v1/budget")
    suspend fun updateBudget(@Body request: UpdateBudgetRequest): Response<BudgetStateResponse>

    // ─── Transactions ────────────────────────────────────────────────────────
    @GET("api/v1/transactions")
    suspend fun getTransactions(): Response<List<TransactionResponse>>

    @POST("api/v1/transactions")
    suspend fun createTransaction(
        @Body request: CreateTransactionRequest
    ): Response<TransactionResponse>

    @DELETE("api/v1/transactions/{id}")
    suspend fun deleteTransaction(@Path("id") id: String): Response<Unit>

    // ─── AI Insights (served from backend, never directly from Android) ───────
    @GET("api/v1/insights/pattern")
    suspend fun getPatternInsight(): Response<PatternInsightResponse>

    @GET("api/v1/insights/advice")
    suspend fun getAdvice(): Response<AdviceResponse>
}
