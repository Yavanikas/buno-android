package com.buno.app.ui.navigation

/**
 * All navigation destinations in the Buno app.
 * Using a sealed class for type safety.
 */
sealed class Screen(val route: String) {
    // ─── Unauthenticated flow ─────────────────────────────────────────────────
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object BudgetSetup : Screen("budget_setup")

    // ─── Authenticated main flow (bottom nav) ─────────────────────────────────
    data object Dashboard : Screen("dashboard")
    data object BankSync : Screen("bank_sync")
    data object Transactions : Screen("transactions")
    data object Patterns : Screen("patterns")
    data object Premium : Screen("premium")
    data object Settings : Screen("settings")
}
