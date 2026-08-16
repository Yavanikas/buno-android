package com.buno.app.domain.repository

import com.buno.app.model.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val isLoggedIn: Flow<Boolean>
    val currentUser: Flow<User?>

    suspend fun register(email: String, password: String, name: String? = null): Result<User>
    suspend fun login(email: String, password: String): Result<User>
    suspend fun refreshToken(): Result<String>
    suspend fun logout()
    suspend fun getMe(): Result<User>
}
