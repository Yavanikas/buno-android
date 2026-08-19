package com.buno.app.network

import com.buno.app.network.dto.AdviceResponse
import com.buno.app.network.dto.ApiResponse
import com.buno.app.network.dto.AuthResponseData
import com.buno.app.network.dto.BudgetDto
import com.buno.app.network.dto.CreateBudgetRequest
import com.buno.app.network.dto.CreateTransactionRequest
import com.buno.app.network.dto.HealthResponse
import com.buno.app.network.dto.LoginRequest
import com.buno.app.network.dto.LogoutRequest
import com.buno.app.network.dto.PatternInsightResponse
import com.buno.app.network.dto.RefreshTokenRequest
import com.buno.app.network.dto.RefreshTokenResponseData
import com.buno.app.network.dto.RegisterRequest
import com.buno.app.network.dto.TransactionDto
import com.buno.app.network.dto.UpdateBudgetRequest
import com.buno.app.network.dto.UserDataDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface BunoApiService {

    // ─── Health ──────────────────────────────────────────────────────────────
    @GET("health")
    suspend fun getHealth(): Response<HealthResponse>

    // ─── Auth ────────────────────────────────────────────────────────────────
    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponseData>>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponseData>>

    @POST("api/auth/refresh")
    suspend fun refresh(@Body request: RefreshTokenRequest): Response<ApiResponse<RefreshTokenResponseData>>

    @POST("api/auth/logout")
    suspend fun logout(@Body request: LogoutRequest = LogoutRequest()): Response<ApiResponse<Unit>>

    @GET("api/auth/me")
    suspend fun getMe(): Response<ApiResponse<UserDataDto>>

    // ─── Budgets ─────────────────────────────────────────────────────────────
    @GET("api/budgets")
    suspend fun getBudgets(): Response<ApiResponse<List<BudgetDto>>>

    @POST("api/budgets")
    suspend fun createBudget(@Body request: CreateBudgetRequest): Response<ApiResponse<BudgetDto>>

    @GET("api/budgets/{id}")
    suspend fun getBudgetById(@Path("id") id: String): Response<ApiResponse<BudgetDto>>

    @PATCH("api/budgets/{id}")
    suspend fun updateBudget(
        @Path("id") id: String,
        @Body request: UpdateBudgetRequest
    ): Response<ApiResponse<BudgetDto>>

    @DELETE("api/budgets/{id}")
    suspend fun deleteBudget(@Path("id") id: String): Response<ApiResponse<Unit>>

    // ─── Transactions ────────────────────────────────────────────────────────
    @GET("api/budgets/{budgetId}/transactions")
    suspend fun getTransactions(
        @Path("budgetId") budgetId: String
    ): Response<ApiResponse<List<TransactionDto>>>

    @POST("api/budgets/{budgetId}/transactions")
    suspend fun createTransaction(
        @Path("budgetId") budgetId: String,
        @Body request: CreateTransactionRequest
    ): Response<ApiResponse<TransactionDto>>

    @DELETE("api/budgets/{budgetId}/transactions/{id}")
    suspend fun deleteTransaction(
        @Path("budgetId") budgetId: String,
        @Path("id") id: String
    ): Response<ApiResponse<Unit>>

    // ─── AI Insights ─────────────────────────────────────────────────────────
    @GET("api/v1/insights/pattern")
    suspend fun getPatternInsight(): Response<ApiResponse<PatternInsightResponse>>

    @GET("api/v1/insights/advice")
    suspend fun getAdvice(): Response<ApiResponse<AdviceResponse>>

    // ─── Sync ────────────────────────────────────────────────────────────────
    @POST("api/budgets/{budgetId}/sync/start")
    suspend fun startSync(@Path("budgetId") budgetId: String): Response<com.buno.app.network.dto.SyncStartResponse>

    @GET("api/sync/{syncId}/status")
    suspend fun getSyncStatus(@Path("syncId") syncId: String): Response<com.buno.app.network.dto.SyncStatusResponse>

    @POST("api/sync/{syncId}/acknowledge")
    suspend fun acknowledgeSync(@Path("syncId") syncId: String): Response<com.buno.app.network.dto.SyncAcknowledgeResponse>
}
