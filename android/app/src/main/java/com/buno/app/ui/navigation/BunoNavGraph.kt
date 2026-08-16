package com.buno.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.buno.app.ui.screen.BankSyncScreen
import com.buno.app.ui.screen.BudgetSetupScreen
import com.buno.app.ui.screen.DashboardScreen
import com.buno.app.ui.screen.LoginScreen
import com.buno.app.ui.screen.PatternsScreen
import com.buno.app.ui.screen.PremiumScreen
import com.buno.app.ui.screen.RegisterScreen
import com.buno.app.ui.screen.SettingsScreen
import com.buno.app.ui.screen.SplashScreen
import com.buno.app.ui.screen.TransactionsScreen

@Composable
fun BunoNavGraph(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {

        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToLogin = { navController.popBackStack() },
                onRegisterSuccess = {
                    navController.navigate(Screen.BudgetSetup.route) {
                        popUpTo(Screen.Register.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.BudgetSetup.route) {
            BudgetSetupScreen(
                onSetupComplete = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.BudgetSetup.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToTransactions = { navController.navigate(Screen.Transactions.route) },
                onNavigateToPatterns = { navController.navigate(Screen.Patterns.route) },
                onNavigateToBankSync = { navController.navigate(Screen.BankSync.route) },
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                onNavigateToPremium = { navController.navigate(Screen.Premium.route) },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Transactions.route) {
            TransactionsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.BankSync.route) {
            BankSyncScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Patterns.route) {
            PatternsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Premium.route) {
            PremiumScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}
