package com.buno.app.network

import android.content.Context
import com.buno.app.BuildConfig
import com.buno.app.data.local.TokenStore
import com.buno.app.network.dto.ApiResponse
import com.buno.app.network.dto.RefreshTokenRequest
import com.buno.app.network.dto.RefreshTokenResponseData
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Interceptor that attaches the stored JWT access token to every request.
 */
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Skip adding Authorization header for unauthenticated endpoints
        val path = originalRequest.url.encodedPath
        if (path.contains("api/auth/login") || path.contains("api/auth/register") || path.contains("api/auth/refresh")) {
            return chain.proceed(originalRequest)
        }

        val token = runBlocking { tokenStore.accessToken.firstOrNull() }
        val request = if (!token.isNullOrBlank()) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }
        return chain.proceed(request)
    }
}

/**
 * Authenticator that handles HTTP 401 responses by refreshing the access token
 * using the persisted refresh token, and retrying the failed request.
 */
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore
) : Authenticator {

    private val gson = Gson()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Prevent infinite loop if refresh itself returned 401
        if (response.request.url.encodedPath.contains("api/auth/refresh")) {
            return null
        }

        // Only retry once
        if (responseCount(response) >= 2) {
            return null
        }

        val currentRefreshToken = runBlocking { tokenStore.refreshToken.firstOrNull() }
        if (currentRefreshToken.isNullOrBlank()) {
            runBlocking { tokenStore.clearSession() }
            return null
        }

        synchronized(this) {
            val freshToken = runBlocking { tokenStore.accessToken.firstOrNull() }
            val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")?.trim()

            // If another thread already refreshed the token, retry with the fresh token
            if (freshToken != null && freshToken != requestToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $freshToken")
                    .build()
            }

            // Perform synchronous refresh call
            val refreshHttpClient = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            val requestBodyJson = gson.toJson(RefreshTokenRequest(refreshToken = currentRefreshToken))
            val refreshRequest = Request.Builder()
                .url("${BuildConfig.BASE_URL}/api/auth/refresh")
                .post(requestBodyJson.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                val refreshResponse = refreshHttpClient.newCall(refreshRequest).execute()
                if (refreshResponse.isSuccessful) {
                    val responseBody = refreshResponse.body?.string()
                    val type = object : TypeToken<ApiResponse<RefreshTokenResponseData>>() {}.type
                    val apiResponse: ApiResponse<RefreshTokenResponseData>? = gson.fromJson(responseBody, type)

                    val newAccessToken = apiResponse?.data?.accessToken
                    val newRefreshToken = apiResponse?.data?.refreshToken

                    if (!newAccessToken.isNullOrBlank()) {
                        runBlocking {
                            tokenStore.updateAccessToken(newAccessToken, newRefreshToken)
                        }
                        return response.request.newBuilder()
                            .header("Authorization", "Bearer $newAccessToken")
                            .build()
                    }
                } else {
                    // Refresh token invalid or expired — clear session
                    runBlocking { tokenStore.clearSession() }
                }
            } catch (e: Exception) {
                // Network error during refresh
            }

            return null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

@Singleton
class RetrofitClient @Inject constructor(
    private val authInterceptor: AuthInterceptor,
    private val tokenAuthenticator: TokenAuthenticator
) {
    val apiService: BunoApiService by lazy {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .authenticator(tokenAuthenticator)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(if (BuildConfig.BASE_URL.endsWith("/")) BuildConfig.BASE_URL else "${BuildConfig.BASE_URL}/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(BunoApiService::class.java)
    }
}
