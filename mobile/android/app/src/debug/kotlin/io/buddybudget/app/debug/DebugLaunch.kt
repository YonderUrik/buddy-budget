package io.buddybudget.app.debug

import android.content.Intent
import androidx.compose.runtime.Composable
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.BBThemePreference
import io.buddybudget.app.generated.AppLanguage

/**
 * Debug-only launch hooks (the release source set has a no-op twin), same semantics as iOS `DebugLaunch`:
 * `--ez bbSignOut true`, `--es bbToken <bearer>`, `--es bbEmail <email>`, `--es bbTheme light|dark|system`,
 * `--es bbLanguage it|en|de`, `--es bbOpen <path>` (`/altro` = More tab), `--ez bbAutoSend true`, `--es bbCode <code>`.
 */
object DebugLaunch {
    /** `--ei bbGallery <page>` opens the component gallery on that page. */
    fun galleryPage(intent: Intent?): Int? =
        intent?.takeIf { it.hasExtra("bbGallery") }?.also { periodOpen = it.getBooleanExtra("bbPeriodOpen", false) }?.getIntExtra("bbGallery", 0)

    /** `--ez bbPeriodOpen true`: the first `PeriodSelector` with a custom range opens its calendar sheet (one shot). */
    var periodOpen = false

    /** `--ei bbScrollY <dp>`: screens scroll down by this much after loading, so screenshots reach lower content. */
    var scrollY = 0
        private set

    /** All launch extras as strings (feature screenshot hooks, e.g. `--es bbFrom composition`). */
    private var extras: Map<String, String> = emptyMap()

    fun value(name: String): String? = extras[name]

    var openPath: String? = null
        private set
    var autoSend = false
        private set
    var code: String? = null
        private set
    /** `--es bbSubscriptions add|archive|bottom|<key>`: opens the add dialog / archive / an item's detail (once). */
    private var subscriptions: String? = null

    fun takeSubscriptions(): String? = subscriptions.also { subscriptions = null }

    /** `--ei bbSkip <n>`: hides the first n blocks of a long screen so screenshots reach the lower content. */
    var skip = 0
        private set

    /** `--es bbSegment analysis`: initial Liquidità segment. */
    var segment: String? = null
        private set

    /** `--es bbSheet actions|category|split|note|edit|add`: opens a Movimenti sheet once the feed loads (one shot). */
    var sheet: String? = null

    /** `--es bbTab auto`: Categorizza opens on «Messe dall'app». */
    var tab: String? = null
        private set


    fun apply(intent: Intent?, env: AppEnvironment) {
        intent ?: return
        intent.getStringExtra("bbTheme")?.let { raw ->
            BBThemePreference.entries.firstOrNull { it.name.equals(raw, ignoreCase = true) }?.let(env.preferences::updateTheme)
        }
        intent.getStringExtra("bbLanguage")?.let { raw ->
            AppLanguage.entries.firstOrNull { it.code == raw }?.let(env.preferences::updateSignedOutLanguage)
        }
        env.session.applyDebugLaunch(intent.getStringExtra("bbToken"), intent.getStringExtra("bbEmail"), intent.getBooleanExtra("bbSignOut", false))
        @Suppress("DEPRECATION")
        extras = intent.extras?.let { b -> b.keySet().associateWith { b.get(it)?.toString() ?: "" } } ?: emptyMap()
        openPath = intent.getStringExtra("bbOpen")
        autoSend = intent.getBooleanExtra("bbAutoSend", false)
        code = intent.getStringExtra("bbCode")
        subscriptions = intent.getStringExtra("bbSubscriptions")
        skip = intent.getIntExtra("bbSkip", 0)
        segment = intent.getStringExtra("bbSegment")
        sheet = intent.getStringExtra("bbSheet")
        tab = intent.getStringExtra("bbTab")
        periodOpen = intent.getBooleanExtra("bbPeriodOpen", false)
        scrollY = intent.getIntExtra("bbScrollY", 0)
    }

    @Composable
    fun Gallery(page: Int) = ComponentGallery(GalleryPage.entries.getOrElse(page) { GalleryPage.Surfaces })
}
