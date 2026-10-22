package io.buddybudget.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.core.content.IntentCompat
import io.buddybudget.app.features.imports.ImportFileTypes
import io.buddybudget.core.domain.imports.ImportsRoutes
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.core.view.WindowCompat
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBToastHost
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LocalLogoLoader
import io.buddybudget.app.designsystem.components.bbLocale
import io.buddybudget.app.generated.ProvideLocalizedStrings

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val env = (application as BuddyBudgetApplication).environment
        val galleryPage = DebugLaunch.galleryPage(intent)
        if (galleryPage == null) DebugLaunch.apply(intent, env)
        if (savedInstanceState == null) receive(intent, env)
        setContent {
            // App language follows the account (user.language), not the device: see generated/LocalizedStrings.kt.
            val language = env.session.language
            ProvideLocalizedStrings(language) {
                CompositionLocalProvider(
                    LocalBBLocale provides language.bbLocale,
                    LocalHideAmounts provides env.privacy.hideAmounts,
                    LocalLogoLoader provides env.logoLoader,
                    LocalEnv provides env,
                ) {
                    BuddyBudgetTheme(env.preferences.theme) {
                        val dark = BuddyBudgetTheme.isDark
                        SideEffect {
                            WindowCompat.getInsetsController(window, window.decorView).apply {
                                isAppearanceLightStatusBars = !dark
                                isAppearanceLightNavigationBars = !dark
                            }
                        }
                        if (galleryPage != null) {
                            DebugLaunch.Gallery(galleryPage)
                        } else {
                            BBToastHost(env.toasts) { RootView(env) }
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        receive(intent, (application as BuddyBudgetApplication).environment)
    }

    /**
     * CSV / Excel files shared to the app (ACTION_SEND, ACTION_SEND_MULTIPLE, ACTION_VIEW of a content URI) and
     * BuddyBudget links (`https://buddybudget.io/importazioni?job=…`, `buddybudget://…`): read now, while the grant
     * lasts, and handed to the shell (14-imports and 07-investments mobile notes).
     */
    private fun receive(intent: Intent?, env: AppEnvironment) {
        intent ?: return
        val uris: List<Uri> = when (intent.action) {
            Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE -> IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            Intent.ACTION_VIEW -> {
                val data = intent.data ?: return
                if (data.scheme == "content" || data.scheme == "file") listOf(data) else {
                    ImportsRoutes.inAppPath(data.toString())?.let { env.incoming = IncomingItem.Link(it) }
                    return
                }
            }
            else -> return
        }
        val files = uris.mapNotNull { ImportFileTypes.read(this, it) }
        if (files.isNotEmpty()) env.incoming = IncomingItem.Files(files)
    }
}
