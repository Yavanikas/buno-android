package com.buno.app.domain.model

enum class ConfidenceLevel {
    LOW, MEDIUM, HIGH
}

data class PatternInsight(
    val patternTag: String,
    val insight: String,
    val confidence: ConfidenceLevel
)
