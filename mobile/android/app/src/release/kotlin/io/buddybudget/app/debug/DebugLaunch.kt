package io.buddybudget.app.debug

import android.content.Intent
import androidx.compose.runtime.Composable
import io.buddybudget.app.AppEnvironment

/** Release twin of the debug launch hooks: no gallery, no launch overrides. */
object DebugLaunch {
    @Suppress("UNUSED_PARAMETER")
    fun galleryPage(intent: Intent?): Int? = null

    @Suppress("UNUSED_PARAMETER")
    fun value(name: String): String? = null

    val openPath: String? = null
    val autoSend = false
    val code: String? = null
    val skip = 0
    val segment: String? = null
    var sheet: String? = null
    val tab: String? = null
    var periodOpen = false
    val scrollY = 0

    fun takeSubscriptions(): String? = null

    @Suppress("UNUSED_PARAMETER")
    fun apply(intent: Intent?, env: AppEnvironment) = Unit

    @Suppress("UNUSED_PARAMETER")
    @Composable
    fun Gallery(page: Int) = Unit
}
