package io.buddybudget.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.generated.AppLanguage
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.LocalizedStrings
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.UserSettingsPatch
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.shell.AppRoute
import io.buddybudget.core.domain.shell.HomePage
import io.buddybudget.core.domain.shell.LocaleRules
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/**
 * Owns the signed-in state and decides the top-level screen (SHELL-001…004, AUTH-017…023): reads the token, loads
 * `GET /api/me/bootstrap`, applies language / privacy, reacts to 401 (sign out) and to gate 403s (re-route).
 * Same name and responsibilities as `SessionModel` on iOS.
 */
class SessionModel(private val env: AppEnvironment) {
    var route by mutableStateOf(AppRoute.Launching)
        private set
    var bootstrap by mutableStateOf<MeBootstrap?>(null)
        private set
    /** Legal metadata in the current language; loaded on demand. */
    var legal by mutableStateOf<LegalMeta?>(null)
        private set
    /** Bumped on every sign-in so the shell and feature models start from scratch (SHELL-025). */
    var generation by mutableIntStateOf(0)
        private set
    /** Language of the UI and of `BBFormat` (AUTH-029, SET-016). */
    var language by mutableStateOf(AppLanguage.IT)
        private set
    /** Login notice after an account deletion (AUTH-010). */
    var accountDeletedNotice by mutableStateOf(false)
    /** Email to prefill on the login screen (DEBUG intent extra). */
    var prefillEmail = ""

    private val scope = MainScope()
    private var loading = false

    init {
        env.api.events.set(
            onUnauthorized = { scope.launch { sessionExpired() } },
            onGate = { scope.launch { refresh() } },
        )
    }

    val sections: MeBootstrap.Sections get() = bootstrap?.capabilities?.sections ?: MeBootstrap.Sections()
    /** Engine capabilities of the product country (`taxes`, `inflation`, …); null before the bootstrap. */
    val features: MeBootstrap.Features? get() = bootstrap?.capabilities?.features
    val currency: String get() = bootstrap?.profile?.currency ?: LocaleRules.DEFAULT_CURRENCY
    /** SHELL-006: product country (`DE` only when stored as such). */
    val country: String get() = LocaleRules.resolveCountry(bootstrap?.profile?.productCountry)
    val homePage: AppDestination get() = HomePage.resolve(bootstrap?.profile?.homePage)

    /** Strings outside composition (toasts) in the current language. */
    fun strings(): LocalizedStrings = LocalizedStrings(env.context, language)

    /** App launch: no token → login; otherwise load the bootstrap and route on its gate. */
    suspend fun launch() {
        language = env.preferences.signedOutLanguage
        if (env.api.session.readToken() == null) {
            route = AppRoute.SignedOut
            return
        }
        route = AppRoute.Launching
        refresh()
    }

    /** Re-reads the bootstrap (foreground, after onboarding / legal acceptance / reactivation / settings, gate 403). */
    suspend fun refresh() {
        if (env.api.session.readToken() == null) {
            route = AppRoute.SignedOut
            return
        }
        if (loading) return
        loading = true
        try {
            apply(env.me.bootstrap())
        } catch (_: ApiError.Unauthorized) {
            route = AppRoute.SignedOut
        } catch (_: Exception) {
            if (bootstrap == null) route = AppRoute.Unavailable
        } finally {
            loading = false
        }
    }

    /** Called after a successful email-code sign-in (the token is already stored). */
    suspend fun signedIn() {
        generation += 1
        accountDeletedNotice = false
        bootstrap = null
        route = AppRoute.Launching
        refresh()
    }

    /** SHELL-025 / AUTH-023: ends the session on the server, wipes token and caches, back to login. */
    suspend fun signOut(accountDeleted: Boolean = false) {
        env.auth.signOut()
        reset(accountDeleted)
    }

    /** After `DELETE /api/user/account` the session no longer exists: wipe locally. */
    fun accountDeleted() {
        env.api.session.clear()
        // AUTH-059: a deleted account is not offered again on the login screen.
        env.preferences.remove(io.buddybudget.core.domain.auth.ReturningUser.KEY)
        reset(true)
    }

    /** SHELL-056: a 401 from any call is session expiry. */
    private fun sessionExpired() {
        if (route == AppRoute.SignedOut) return
        reset(false)
        env.toasts.show(BBToastKind.Info, strings().get(L10n.sessionExpired))
    }

    private fun reset(accountDeleted: Boolean) {
        bootstrap = null
        legal = null
        generation += 1
        accountDeletedNotice = accountDeleted
        env.privacy.hideAmounts = false
        applyLanguage(env.preferences.signedOutLanguage)
        route = AppRoute.SignedOut
    }

    private fun apply(next: MeBootstrap) {
        val languageChanged = next.profile.language != bootstrap?.profile?.language
        bootstrap = next
        applyLanguage(AppLanguage.resolve(next.profile.language, next.profile.productCountry))
        env.privacy.hideAmounts = next.profile.hideAmounts
        if (languageChanged) legal = null
        route = AppRoute.resolve(true, next)
    }

    fun applyLanguage(value: AppLanguage) {
        if (value != language) legal = null
        language = value
    }

    /** Signed-out language picker (AUTH-015). */
    fun chooseSignedOutLanguage(value: AppLanguage) {
        env.preferences.updateSignedOutLanguage(value)
        applyLanguage(value)
    }

    /** Optimistic privacy toggle saved on the account, reverted on failure (SHELL-051). */
    suspend fun setHideAmounts(hidden: Boolean) {
        val previous = env.privacy.hideAmounts
        env.privacy.hideAmounts = hidden
        try {
            env.user.updateSettings(UserSettingsPatch(hideAmounts = hidden))
        } catch (_: Exception) {
            env.privacy.hideAmounts = previous
            env.toasts.show(BBToastKind.Error, strings().get(L10n.genericError))
        }
    }

    /** `GET /api/legal` in the UI language (cached until the language changes). */
    suspend fun loadLegal(): LegalMeta? {
        val code = language.code
        legal?.let { if (it.language == code) return it }
        legal = runCatching { env.legalApi.get(code) }.getOrNull()
        return legal
    }

    /** DEBUG-only launch hooks (see `DebugLaunch`). */
    fun applyDebugLaunch(token: String?, email: String?, signOut: Boolean) {
        if (signOut) env.api.session.clear()
        if (!token.isNullOrEmpty()) env.api.session.saveToken(token)
        if (email != null) prefillEmail = email
    }
}
