package com.buno.app.di

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
