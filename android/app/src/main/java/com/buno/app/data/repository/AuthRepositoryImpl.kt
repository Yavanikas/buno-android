package com.buno.app.data.repository

import com.buno.app.data.local.TokenStore
import com.buno.app.domain.repository.AuthRepository
import com.buno.app.model.User
import com.buno.app.network.BunoApiService
import com.buno.app.network.dto.LoginRequest
import com.buno.app.network.dto.RefreshTokenRequest
import com.buno.app.network.dto.RegisterRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val api: BunoApiService,
    private val tokenStore: TokenStore
) : AuthRepository {

    override val isLoggedIn: Flow<Boolean> = tokenStore.isLoggedIn

    override val currentUser: Flow<User?> = combine(
        tokenStore.userId,
        tokenStore.userEmail,
        tokenStore.userName
    ) { id, email, name ->
        if (id != null && email != null) {
            User(id = id, email = email, name = name)
        } else {
            null
        }
    }

    override suspend fun register(email: String, password: String, name: String?): Result<User> =
        runCatching {
            val response = api.register(RegisterRequest(email = email.trim(), password = password, name = name?.trim()))
            if (response.isSuccessful && response.body()?.status == "success") {
                val data = response.body()!!.data!!
                tokenStore.saveSession(
                    accessToken = data.accessToken,
                    refreshToken = data.refreshToken,
                    userId = data.user.id,
                    email = data.user.email,
                    name = data.user.name
                )
                User(id = data.user.id, email = data.user.email, name = data.user.name)
            } else {
                val errorMsg = response.body()?.message ?: "Registration failed (${response.code()})"
                throw Exception(errorMsg)
            }
        }

    override suspend fun login(email: String, password: String): Result<User> =
        runCatching {
            val response = api.login(LoginRequest(email = email.trim(), password = password))
            if (response.isSuccessful && response.body()?.status == "success") {
                val data = response.body()!!.data!!
                tokenStore.saveSession(
                    accessToken = data.accessToken,
                    refreshToken = data.refreshToken,
                    userId = data.user.id,
                    email = data.user.email,
                    name = data.user.name
                )
                User(id = data.user.id, email = data.user.email, name = data.user.name)
            } else {
                val errorMsg = response.body()?.message ?: "Invalid email or password"
                throw Exception(errorMsg)
            }
        }

    override suspend fun refreshToken(): Result<String> =
        runCatching {
            val currentRefreshToken = tokenStore.refreshToken.firstOrNull()
                ?: throw Exception("No refresh token available")

            val response = api.refresh(RefreshTokenRequest(refreshToken = currentRefreshToken))
            if (response.isSuccessful && response.body()?.status == "success") {
                val data = response.body()!!.data!!
                tokenStore.updateAccessToken(data.accessToken, data.refreshToken)
                data.accessToken
            } else {
                tokenStore.clearSession()
                throw Exception("Session expired, please log in again")
            }
        }

    override suspend fun logout() {
        runCatching {
            val token = tokenStore.refreshToken.firstOrNull()
            api.logout(com.buno.app.network.dto.LogoutRequest(token))
        }
        tokenStore.clearSession()
    }

    override suspend fun getMe(): Result<User> =
        runCatching {
            val response = api.getMe()
            if (response.isSuccessful && response.body()?.status == "success") {
                val u = response.body()!!.data!!
                User(id = u.id, email = u.email, name = u.name)
            } else {
                throw Exception("Failed to load user profile (${response.code()})")
            }
        }
}
