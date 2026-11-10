package io.buddybudget.app

import android.app.Application

/** Process entry point; owns the [AppEnvironment] shared by every screen. */
class BuddyBudgetApplication : Application() {
    lateinit var environment: AppEnvironment
        private set

    override fun onCreate() {
        super.onCreate()
        environment = AppEnvironment.live(this)
    }
}
