package io.buddybudget.core.domain.shell

import io.buddybudget.core.data.AccountGate
import io.buddybudget.core.data.ApiErrorCode
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

        /**
         * SHELL-056 (api/auth.md §3.5): a `403 legal_acceptance_required` / `account_deactivated` from ANY call while
         * signed in routes straight to the gate screen (no generic load error), before the bootstrap confirms it.
         * Null for any other code, or when no session screen is showing (signed out, launching).
         */
        fun forGateError(code: ApiErrorCode?, current: AppRoute): AppRoute? {
            if (current == SignedOut || current == Launching) return null
            return when (code) {
                ApiErrorCode.AccountDeactivated -> AccountDeactivated
                // Legal re-acceptance applies after onboarding only (new users accept during onboarding).
                ApiErrorCode.LegalAcceptanceRequired -> if (current == Onboarding || current == AccountDeactivated) null else LegalAcceptance
                else -> null
            }
        }

        /** SHELL-056: leaving a gate screen for the app reloads the shell (its data failed while the gate was up). */
        fun reloadsShell(previous: AppRoute, next: AppRoute): Boolean =
            next == Main && (previous == LegalAcceptance || previous == AccountDeactivated)

        /**
         * IMP-068: a launch on a session that is already showing (a second activity opened by a file shared while the
         * app runs) keeps its route and only re-reads the bootstrap: going back to [Launching] would tear down the shell
         * that has just taken the shared file.
         */
        fun keepsRouteOnLaunch(current: AppRoute, hasBootstrap: Boolean): Boolean =
            hasBootstrap && current != SignedOut && current != Launching && current != Unavailable
    }
}

/**
 * Supported product countries, languages and currencies (user.md "Enums"; web `COUNTRY_LANGUAGES`,
 * `SUPPORTED_CURRENCIES`). Same names on iOS (`LocaleRules`).
 */
object LocaleRules {
    /** Web `PRODUCT_COUNTRIES` (#465): `OTHER` is every country whose tax and pension rules the app does not model yet. */
    val countries = listOf("IT", "DE", "OTHER")
    val currencies = listOf("EUR", "USD", "GBP", "CHF")
    const val DEFAULT_CURRENCY = "EUR"

    /** Web `COUNTRY_LANGUAGES`: IT → it, en; DE → en, de; OTHER → en, it, de (SHELL-006, SET-017). */
    fun languages(country: String): List<String> = when (country) {
        "DE" -> listOf("en", "de")
        "OTHER" -> listOf("en", "it", "de")
        else -> listOf("it", "en")
    }

    /** AUTH-027 / SET-017: switching to a country that doesn't support the current language selects English. */
    fun languageAfterSwitching(country: String, current: String): String =
        if (current in languages(country)) current else "en"

    /** SHELL-006 (web `resolveProfile`): `DE` and `OTHER` as stored, anything else IT. */
    fun resolveCountry(stored: String?): String = if (stored == "DE" || stored == "OTHER") stored else "IT"

    /** Country label (web `PRODUCT_COUNTRY_NAMES`, Italian source, translate with the catalog). */
    fun countryLabel(country: String): String = when (country) {
        "DE" -> "Germania"
        "OTHER" -> "Altro paese"
        else -> "Italia"
    }

    /** Web `COUNTRY_FLAGS`: the drawn flag next to each product country; `WORLD` is a globe for «Altro paese». */
    fun flagCode(country: String): String = when (country) {
        "DE" -> "DE"
        "OTHER" -> "WORLD"
        else -> "IT"
    }

    /** Web `COUNTRY_UNAVAILABLE_MESSAGE` (SHELL-010): title of the country-unavailable screen and of the API error. */
    const val UNAVAILABLE_MESSAGE = "Non ancora disponibile nel tuo paese. Arriverà presto."

    /** Web `COUNTRY_UNAVAILABLE_NOTES` (SHELL-010, SET-017, AUTH-027): what the country does not have yet; null for IT. */
    fun unavailableNote(country: String): String? = when (country) {
        "DE" -> "Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati."
        "OTHER" -> "Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona."
        else -> null
    }

    /** Languages spoken in the countries that have one of ours; the first is the default (web `COUNTRY_LOCAL_LANGUAGES`). */
    private val localLanguages = mapOf(
        "IT" to listOf("it"), "SM" to listOf("it"), "VA" to listOf("it"),
        "DE" to listOf("de"), "AT" to listOf("de"), "LI" to listOf("de"),
        "CH" to listOf("de", "it"),
    )

    /** Web `productCountryFor`: Italy and Germany have their rules, every other region gets `OTHER`. */
    fun productCountryFor(region: String): String = region.uppercase().let { if (it == "IT" || it == "DE") it else "OTHER" }

    /**
     * Web `detectLanguage`: the most preferred supported language of the device (`de-AT` counts as `de`); only
     * unsupported languages → English; no preference at all → Italian.
     */
    fun detectLanguage(preferred: List<String>): String {
        val primaries = preferred.map { it.lowercase().substringBefore('-').substringBefore('_') }.filter { it.isNotEmpty() && it != "*" }
        if (primaries.isEmpty()) return "it"
        return primaries.firstOrNull { it in allLanguages } ?: "en"
    }

    /**
     * AUTH-061 (web `proposedProfile`/`detectProfile`, #465): country and language proposed to a user who has not
     * finished onboarding. The device region stands in for the web's `CF-IPCountry`: IT/SM/VA → Italian, DE/AT/LI →
     * German, CH → German or Italian following the device languages, anything else English; the product country is
     * IT or DE only for those two regions, `OTHER` otherwise. Without a region the device language decides (German
     * implies DE, else IT). A language picked by hand ([chosen]) wins, keeping the country when it offers it.
     */
    fun proposedProfile(region: String?, preferred: List<String>, chosen: String? = null): Pair<String, String> {
        val code = region?.trim()?.uppercase()?.takeIf { Regex("^[A-Z]{2}$").matches(it) && it != "XX" && it != "ZZ" }
        val detected: Pair<String, String> = if (code == null) {
            profileForLanguage(detectLanguage(preferred))
        } else {
            val local = localLanguages[code] ?: listOf("en")
            val device = if (preferred.isEmpty()) null else detectLanguage(preferred)
            productCountryFor(code) to (if (device != null && device in local) device else local.first())
        }
        val pick = chosen?.takeIf { it in allLanguages }
        if (pick == null || pick == detected.second) return detected
        return if (pick in languages(detected.first)) detected.first to pick else profileForLanguage(pick)
    }

    /** Web `profileForLanguage`: German implies the German rules, anything else the Italian ones. */
    fun profileForLanguage(language: String): Pair<String, String> = (if (language == "de") "DE" else "IT") to language

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
