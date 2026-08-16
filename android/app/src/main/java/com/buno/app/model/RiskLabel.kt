package com.buno.app.model

/**
 * The three qualitative spending states Buno uses.
 * Never expose exact amounts — only the signal.
 */
enum class RiskLabel {
    SAFE,
    WATCHFUL,
    FRAGILE;

    companion object {
        fun fromString(value: String): RiskLabel = when (value.lowercase()) {
            "safe" -> SAFE
            "fragile" -> FRAGILE
            else -> WATCHFUL
        }
    }
}
