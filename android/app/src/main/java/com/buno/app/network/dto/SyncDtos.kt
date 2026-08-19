package com.buno.app.network.dto

import com.google.gson.annotations.SerializedName

data class SyncStartResponse(
    @SerializedName("message") val message: String,
    @SerializedName("syncId") val syncId: String,
    @SerializedName("provider") val provider: String? = null
)

data class SyncStatusResponse(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("accountId") val accountId: String? = null,
    @SerializedName("transactionsFetched") val transactionsFetched: Int = 0,
    @SerializedName("transactionsCreated") val transactionsCreated: Int = 0,
    @SerializedName("duplicatesSkipped") val duplicatesSkipped: Int = 0,
    @SerializedName("lastSyncAt") val lastSyncAt: String? = null,
    @SerializedName("error") val error: String? = null
)

data class SyncAcknowledgeResponse(
    @SerializedName("message") val message: String,
    @SerializedName("id") val id: String
)
