package com.buno.app.domain.repository

import com.buno.app.network.BunoApiService
import com.buno.app.network.dto.SyncAcknowledgeResponse
import com.buno.app.network.dto.SyncStartResponse
import com.buno.app.network.dto.SyncStatusResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncRepository @Inject constructor(
    private val apiService: BunoApiService
) {
    suspend fun startSync(budgetId: String): Result<SyncStartResponse> {
        return try {
            val response = apiService.startSync(budgetId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message()))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSyncStatus(syncId: String): Result<SyncStatusResponse> {
        return try {
            val response = apiService.getSyncStatus(syncId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message()))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun acknowledgeSync(syncId: String): Result<SyncAcknowledgeResponse> {
        return try {
            val response = apiService.acknowledgeSync(syncId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message()))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
