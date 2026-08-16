package com.buno.app.model

enum class ConfidenceLevel {
    LOW, MEDIUM, HIGH;

    companion object {
        fun fromString(value: String): ConfidenceLevel = when (value.lowercase()) {
            "high" -> HIGH
            "medium" -> MEDIUM
            else -> LOW
        }
    }
}

/**
 * AI-generated pattern insight from the backend.
 * Insight text must never contain exact currency amounts.
 */
data class PatternInsight(
    val patternTag: String,
    val insight: String,
    val confidence: ConfidenceLevel
)
