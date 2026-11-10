package io.buddybudget.app.features.accounts

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.browser.customtabs.CustomTabsIntent
import io.buddybudget.app.MainActivity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * In-app browsers for the bank link (R6): the consent runs in a Custom Tab that ends on
 * `buddybudget://bank/return?…` (captured by [BankReturnActivity]); «Come funziona» opens in a Custom Tab too.
 * iOS: `BankBrowser` (ASWebAuthenticationSession / SFSafariViewController).
 */
/** The hosting activity (Compose's `LocalContext` may be a localized wrapper). */
fun Context.findActivity(): Activity? {
    var current: Context? = this
    while (current != null) {
        if (current is Activity) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}

private fun launch(context: Context, url: String) {
    val activity = context.findActivity()
    val intent = CustomTabsIntent.Builder().setShowTitle(true).build()
    if (activity == null) intent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    intent.launchUrl(activity ?: context, Uri.parse(url))
}

object BankBrowser {
    private var pending: CompletableDeferred<String?>? = null
    private var leftApp = false
    private val scope = MainScope()

    /** The callback URL, or null when the user came back to the app without it (closed the tab). */
    suspend fun authenticate(context: Context, url: String): String? {
        pending?.complete(null)
        val deferred = CompletableDeferred<String?>()
        pending = deferred
        leftApp = false
        launch(context, url)
        return deferred.await().also { if (pending === deferred) pending = null }
    }

    /** Opens a public page (security explanation) in the in-app browser. */
    fun open(context: Context, url: String) = launch(context, url)

    /** From [BankReturnActivity]. */
    fun deliver(url: String?) {
        pending?.complete(url)
        pending = null
    }

    /** The app went to the background (the tab is showing). */
    fun onAppPaused() {
        if (pending != null) leftApp = true
    }

    /** The app is back: without a callback shortly after, the user closed the tab. */
    fun onAppResumed() {
        val waiting = pending ?: return
        if (!leftApp) return
        scope.launch {
            delay(1500)
            if (pending === waiting) deliver(null)
        }
    }
}

/** Receives `buddybudget://bank/return?…`, hands it to [BankBrowser] and brings the app back over the Custom Tab. */
class BankReturnActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        BankBrowser.deliver(intent?.data?.toString())
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        finish()
    }
}
