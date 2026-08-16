package com.buno.app.network.dto

import com.google.gson.annotations.SerializedName

// ─── Auth DTOs ───────────────────────────────────────────────────────────────

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String?
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class AuthResponse(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("userId") val userId: String
)

// ─── Budget DTOs ─────────────────────────────────────────────────────────────

data class BudgetStateResponse(
    @SerializedName("riskLabel") val riskLabel: String,
    @SerializedName("zoneLabel") val zoneLabel: String,
    @SerializedName("paceLabel") val paceLabel: String,
    @SerializedName("daysRemaining") val daysRemaining: Int,
    @SerializedName("expensesLogged") val expensesLogged: Int,
    @SerializedName("currency") val currency: String
)

data class UpdateBudgetRequest(
    @SerializedName("monthlyLimit") val monthlyLimit: Double,
    @SerializedName("currency") val currency: String
)

// ─── Transaction DTOs ────────────────────────────────────────────────────────

data class TransactionResponse(
    @SerializedName("id") val id: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("category") val category: String,
    @SerializedName("note") val note: String?,
    @SerializedName("date") val date: String,
    @SerializedName("source") val source: String
)

data class CreateTransactionRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("category") val category: String,
    @SerializedName("note") val note: String?,
    @SerializedName("date") val date: String
)

// ─── Pattern Insight DTOs ────────────────────────────────────────────────────

data class PatternInsightResponse(
    @SerializedName("patternTag") val patternTag: String,
    @SerializedName("insight") val insight: String,
    @SerializedName("confidence") val confidence: String
)

// ─── Advice DTOs ─────────────────────────────────────────────────────────────

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
