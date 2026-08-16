package com.buno.app.di

import com.buno.app.data.repository.AuthRepositoryImpl
import com.buno.app.data.repository.BudgetRepositoryImpl
import com.buno.app.data.repository.TransactionRepositoryImpl
import com.buno.app.domain.repository.AuthRepository
import com.buno.app.domain.repository.BudgetRepository
import com.buno.app.domain.repository.TransactionRepository
import com.buno.app.network.BunoApiService
import com.buno.app.network.RetrofitClient
import com.buno.app.repository.BunoRepository
import com.buno.app.repository.BunoRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindBudgetRepository(impl: BudgetRepositoryImpl): BudgetRepository

    @Binds
    @Singleton
    abstract fun bindTransactionRepository(impl: TransactionRepositoryImpl): TransactionRepository

    @Binds
    @Singleton
    abstract fun bindBunoRepository(impl: BunoRepositoryImpl): BunoRepository
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideBunoApiService(retrofitClient: RetrofitClient): BunoApiService =
        retrofitClient.apiService
}
