package com.buno.app.network.dto

import com.google.gson.annotations.SerializedName

// ─── Generic API Response Wrapper ────────────────────────────────────────────

data class ApiResponse<T>(
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String? = null,
    @SerializedName("data") val data: T? = null,
    @SerializedName("errors") val errors: List<ApiValidationError>? = null
)

data class ApiValidationError(
    @SerializedName("msg") val msg: String,
    @SerializedName("param") val param: String?,
    @SerializedName("location") val location: String?
)

// ─── Auth DTOs ───────────────────────────────────────────────────────────────

data class RegisterRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("name") val name: String? = null
)

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RefreshTokenRequest(
    @SerializedName("refreshToken") val refreshToken: String
)

data class LogoutRequest(
    @SerializedName("refreshToken") val refreshToken: String? = null
)

data class AuthResponseData(
    @SerializedName("user") val user: UserDataDto,
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String
)

data class RefreshTokenResponseData(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String
)

data class UserDataDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

// ─── Budget DTOs ─────────────────────────────────────────────────────────────

data class BudgetDto(
    @SerializedName("id") val id: String,
    @SerializedName("monthlyLimit") val monthlyLimit: Double,
    @SerializedName("currency") val currency: String = "INR",
    @SerializedName("month") val month: Int,
    @SerializedName("year") val year: Int,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("qualitativeState") val qualitativeState: QualitativeStateDto? = null,
    @SerializedName("transactions") val transactions: List<TransactionDto>? = null
)

data class QualitativeStateDto(
    @SerializedName("riskLabel") val riskLabel: String,
    @SerializedName("zoneLabel") val zoneLabel: String,
    @SerializedName("paceLabel") val paceLabel: String,
    @SerializedName("daysRemaining") val daysRemaining: Int,
    @SerializedName("expensesLogged") val expensesLogged: Int,
    @SerializedName("currency") val currency: String = "INR"
)

data class CreateBudgetRequest(
    @SerializedName("monthlyLimit") val monthlyLimit: Double,
    @SerializedName("currency") val currency: String = "INR",
    @SerializedName("month") val month: Int? = null,
    @SerializedName("year") val year: Int? = null
)

data class UpdateBudgetRequest(
    @SerializedName("monthlyLimit") val monthlyLimit: Double? = null,
    @SerializedName("currency") val currency: String? = null
)

// ─── Transaction DTOs ────────────────────────────────────────────────────────

data class TransactionDto(
    @SerializedName("id") val id: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("category") val category: String,
    @SerializedName("note") val note: String? = null,
    @SerializedName("date") val date: String,
    @SerializedName("source") val source: String = "manual",
    @SerializedName("budgetId") val budgetId: String? = null
)

data class CreateTransactionRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("category") val category: String,
    @SerializedName("note") val note: String? = null,
    @SerializedName("date") val date: String? = null
)

// ─── AI Insights DTOs ────────────────────────────────────────────────────────

data class PatternInsightResponse(
    @SerializedName("patternTag") val patternTag: String,
    @SerializedName("insight") val insight: String,
    @SerializedName("confidence") val confidence: String
)

data class AdviceResponse(
    @SerializedName("paceSummary") val paceSummary: String,
    @SerializedName("monthOutlook") val monthOutlook: String,
    @SerializedName("todaySuggestion") val todaySuggestion: String
)

// ─── Health ──────────────────────────────────────────────────────────────────

data class HealthResponse(
    @SerializedName("status") val status: String,
    @SerializedName("service") val service: String,
    @SerializedName("timestamp") val timestamp: String
)
