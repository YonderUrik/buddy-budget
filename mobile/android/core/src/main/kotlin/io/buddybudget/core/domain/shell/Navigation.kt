package io.buddybudget.core.domain.shell

import io.buddybudget.core.data.MeBootstrap

/**
 * Every in-app destination, identified by its web path (deep links and `homePage` use the same paths).
 * Same cases and paths as `AppDestination` on iOS. A feature screen is registered in the app's `FeatureRegistry`;
 * destinations without a screen yet show a placeholder with their title.
 */
enum class AppDestination(val path: String) {
    Overview("/panoramica"),
    Liquidity("/liquidita"),
    Accounts("/liquidita/conti"),
    SpendingAnalysis("/liquidita/analisi"),
    Subscriptions("/liquidita/abbonamenti"),
    Categories("/liquidita/categorie"),
    Rules("/liquidita/regole"),
    Categorize("/categorizza"),
    /** Personal CSV / Excel imports (14-imports), pushed on the Liquidità stack. */
    Imports("/importazioni"),
    Investments("/investimenti"),
    Pension("/pensione"),
    Debts("/debiti"),
    Analytics("/analitiche"),
    Settings("/impostazioni"),
    Help("/aiuto"),
    CountryUnavailable("/country-unavailable"),
    ;

    /** Title (Italian source; translate with the catalog). */
    val title: String
        get() = when (this) {
            Overview -> "Panoramica"
            Liquidity -> "Liquidità"
            Accounts -> "Conti"
            SpendingAnalysis -> "Analisi dei movimenti"
            Subscriptions -> "Abbonamenti"
            Categories, Rules -> "Categorie e regole"
            Categorize -> "Categorizza"
            Imports -> "Importa da CSV o Excel"
            Investments -> "Investimenti"
            Pension -> "Pensione"
            Debts -> "Debiti"
            Analytics -> "Analitiche"
            Settings -> "Impostazioni"
            Help -> "Aiuto e segnalazioni"
            CountryUnavailable -> "Questa funzione non è ancora disponibile per la Germania."
        }

    /** Tab whose stack hosts this destination (SHELL-014: everything outside the four sections lives under «Altro»). */
    val tab: AppTab
        get() = when (this) {
            Overview -> AppTab.Overview
            Liquidity, Accounts, SpendingAnalysis, Subscriptions, Categories, Rules, Categorize, Imports -> AppTab.Liquidity
            Investments -> AppTab.Investments
            Debts -> AppTab.Debts
            Pension, Analytics, Settings, Help, CountryUnavailable -> AppTab.More
        }

    /** Lucide icon key of the primary sections (web `NAV_ITEMS`). */
    val iconKey: String?
        get() = when (this) {
            Overview -> "layout-dashboard"
            Liquidity -> "wallet"
            Investments -> "trending-up"
            Pension -> "umbrella"
            Debts -> "credit-card"
            Analytics -> "chart-column"
            else -> null
        }

    /** One-line hint in «Altro» › «Altre sezioni» (web `MORE_MENU_HINTS`). */
    val moreMenuHint: String?
        get() = when (this) {
            Pension -> "Fondi, rendimento e a quanto arriverai"
            Analytics -> "Quando arrivi al traguardo e cosa cambia con le tue ipotesi"
            else -> null
        }

    /** SHELL-007 / SHELL-008: route policy from the server's `capabilities.sections`. */
    fun isAvailable(sections: MeBootstrap.Sections): Boolean = when (this) {
        Pension -> sections.pension
        Analytics -> sections.analytics
        else -> true
    }

    companion object {
        /** Parses a web path (also subpaths, `?query`), e.g. a deep link. Unknown paths → null. */
        fun fromPath(path: String): AppDestination? {
            val clean = path.substringBefore('?')
            entries.firstOrNull { it.path == clean }?.let { return it }
            // Longest matching prefix (`/analitiche/obiettivi` belongs to Analitiche).
            return entries.filter { clean.startsWith(it.path + "/") }.maxByOrNull { it.path.length }
        }
    }
}

/** Bottom-bar tabs (SHELL-013), identical order and icons on both platforms. */
enum class AppTab {
    Overview, Liquidity, Investments, Debts, More;

    val root: AppDestination?
        get() = when (this) {
            Overview -> AppDestination.Overview
            Liquidity -> AppDestination.Liquidity
            Investments -> AppDestination.Investments
            Debts -> AppDestination.Debts
            More -> null
        }

    val title: String get() = root?.title ?: "Altro"
    val iconKey: String get() = root?.iconKey ?: "ellipsis"
}

object Navigation {
    /** SHELL-012: primary sections in order, filtered by country. */
    fun primarySections(sections: MeBootstrap.Sections): List<AppDestination> =
        listOf(
            AppDestination.Overview, AppDestination.Liquidity, AppDestination.Investments,
            AppDestination.Pension, AppDestination.Debts, AppDestination.Analytics,
        ).filter { it.isAvailable(sections) }

    /** SHELL-013: Panoramica, Liquidità, Investimenti, Debiti + «Altro» (none of the four is country-gated today). */
    fun tabs(sections: MeBootstrap.Sections): List<AppTab> =
        AppTab.entries.filter { tab -> tab.root?.isAvailable(sections) ?: true }

    /** SHELL-018/019: «Altre sezioni» = available sections that are not in the bottom bar (empty for DE). */
    fun otherSections(sections: MeBootstrap.Sections): List<AppDestination> =
        primarySections(sections).filter { it.tab == AppTab.More }
}

/** SHELL-005 / SET-014: the user's home page. */
object HomePage {
    /** Options in Settings, in order (`HOME_PAGE_OPTIONS`). */
    val options = listOf(
        AppDestination.Overview, AppDestination.Liquidity, AppDestination.Accounts,
        AppDestination.SpendingAnalysis, AppDestination.Investments,
    )

    private val legacy = mapOf(
        "/conti" to AppDestination.Accounts,
        "/movimenti" to AppDestination.Liquidity,
        "/movimenti/analisi" to AppDestination.SpendingAnalysis,
    )

    /** Maps the stored value (legacy paths included) to a destination; anything else → Panoramica. */
    fun resolve(stored: String?): AppDestination {
        if (stored == null) return AppDestination.Overview
        legacy[stored]?.let { return it }
        return options.firstOrNull { it.path == stored } ?: AppDestination.Overview
    }
}

/** Initials of the account avatar (web `initialsOf`): first letter of the first two words, uppercased. */
object Initials {
    fun of(name: String): String =
        name.split(" ").filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().toString() }.uppercase()
}

/** Public website links (web `LANDING_URL`, `legalHref`, auth foot links). Legal URLs prefer `GET /api/legal`. */
object ExternalLinks {
    const val LANDING = "https://buddybudget.io"
    const val SECURITY = "$LANDING/sicurezza"
    const val OPEN_SOURCE = "$LANDING/#codice"
    const val HELP = "$LANDING/#domande"

    /** `privacy` | `termini` | `cookie`; [meta] (from `GET /api/legal`) wins when available. */
    fun legal(id: String, meta: io.buddybudget.core.data.LegalMeta? = null): String = meta?.document(id)?.url ?: "$LANDING/$id"

    val legalDocuments = listOf("privacy", "termini", "cookie")
}
