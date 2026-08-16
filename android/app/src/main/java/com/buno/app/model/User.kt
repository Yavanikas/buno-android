package com.buno.app.model

data class User(
    val id: String,
    val email: String,
    val name: String?
)

data class AuthToken(
    val accessToken: String,
    val userId: String
)
