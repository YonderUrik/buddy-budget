package io.buddybudget.core.domain.shell

import io.buddybudget.core.data.AccountGate
import io.buddybudget.core.data.MeBootstrap

/**
 * Top-level screen of the app, decided from the session and `bootstrap.gate` in the proxy's order
 * (AUTH-022: session → deactivated → legal → onboarding). Same cases as `AppRoute` on iOS.
 */
enum class AppRoute {
    /** Launching: reading the token / first bootstrap. */
    Launching,
    SignedOut,
    AccountDeactivated,
    LegalAcceptance,
    Onboarding,
    Main,
    /** Bootstrap failed for a reason other than 401 (offline, server down): retry screen. */
    Unavailable,
    ;

    companion object {
        /** SHELL-001…004. A signed-in user whose bootstrap succeeded goes where `gate` says. */
        fun resolve(hasToken: Boolean, bootstrap: MeBootstrap?): AppRoute {
            if (!hasToken) return SignedOut
            if (bootstrap == null) return Launching
            return when (bootstrap.gate) {
                AccountGate.AccountDeactivated -> AccountDeactivated
                AccountGate.LegalAcceptanceRequired -> LegalAcceptance
                AccountGate.OnboardingRequired -> Onboarding
                AccountGate.Unknown -> when {
                    // Unknown future gate: fall back to the documented fields in the same order.
                    bootstrap.account.deactivated -> AccountDeactivated
                    bootstrap.onboarding.completed && bootstrap.legal.needsAcceptance -> LegalAcceptance
                    bootstrap.onboarding.completed -> Main
                    else -> Onboarding
                }
                null -> Main
            }
        }
    }
}

/**
 * Supported product countries, languages and currencies (user.md "Enums"; web `COUNTRY_LANGUAGES`,
 * `SUPPORTED_CURRENCIES`). Same names on iOS (`LocaleRules`).
 */
object LocaleRules {
    val countries = listOf("IT", "DE")
    val currencies = listOf("EUR", "USD", "GBP", "CHF")
    const val DEFAULT_CURRENCY = "EUR"

    /** IT → it, en; DE → en, de (SHELL-006, SET-017). */
    fun languages(country: String): List<String> = if (country == "DE") listOf("en", "de") else listOf("it", "en")

    /** AUTH-027 / SET-017: switching to a country that doesn't support the current language selects English. */
    fun languageAfterSwitching(country: String, current: String): String =
        if (current in languages(country)) current else "en"

    /** SHELL-006: DE only when stored as `DE`, otherwise IT. */
    fun resolveCountry(stored: String?): String = if (stored == "DE") "DE" else "IT"

    /** Country label (Italian source, translate with the catalog). */
    fun countryLabel(country: String): String = if (country == "DE") "Germania" else "Italia"

    /** AUTH-060 / SET-017 (web #397): every language, in the list order of the chooser. */
    val allLanguages = listOf("it", "en", "de")

    /** The country that offers [language] («Disponibile col paese {0}» for the greyed ones). */
    fun countryOf(language: String): String? = countries.firstOrNull { language in languages(it) }

    /** Sample amount of the preview: how numbers look in a language, not the user's money (never masked). */
    const val PREVIEW_AMOUNT = 1234.56

    /** «20 ott 2026 · 1.234,56 €»: today's date and the sample amount as [language] writes them. */
    fun languagePreview(language: String, currency: String, today: io.buddybudget.core.domain.periods.CalendarDate): String {
        val locale = io.buddybudget.core.domain.format.BBLocale.of(
            io.buddybudget.core.domain.format.BBLanguage.entries.firstOrNull { it.code == language } ?: io.buddybudget.core.domain.format.BBLanguage.IT,
        )
        val date = io.buddybudget.core.domain.format.BBFormat.formatDate(today, io.buddybudget.core.domain.format.BBDateSkeleton.D_MMM_Y, locale)
        return "$date · ${io.buddybudget.core.domain.format.BBFormat.formatCurrency(PREVIEW_AMOUNT, currency, locale)}"
    }

    /** Native language names (shown untranslated, like the web's `LANGUAGE_NAMES`). */
    fun languageName(language: String): String = when (language) {
        "en" -> "English"
        "de" -> "Deutsch"
        else -> "Italiano"
    }

    /** Currency label (Italian source) and symbol, for the onboarding tiles and the Settings select. */
    fun currencyLabel(currency: String): String = when (currency) {
        "USD" -> "Dollaro USA"
        "GBP" -> "Sterlina britannica"
        "CHF" -> "Franco svizzero"
        else -> "Euro"
    }

    fun currencySymbol(currency: String): String = when (currency) {
        "USD" -> "$"
        "GBP" -> "£"
        "CHF" -> "CHF"
        else -> "€"
    }
}
