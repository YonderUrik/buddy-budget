package io.buddybudget.core.domain.shell

import java.net.URLDecoder

/** Views of the Liquidità section, in the order of TX-001 (Categorie e regole arrives with 05). Same cases on iOS. */
enum class LiquiditySegment {
    Movements, Analysis, Accounts, Subscriptions;

    /** Segment label (Italian source; translate with the catalog). */
    val title: String
        get() = when (this) {
            Movements -> "Movimenti"
            Analysis -> "Analisi"
            Accounts -> "Conti"
            Subscriptions -> "Abbonamenti"
        }

    /** One-line description in the views sheet (web `LIQUIDITY_TABS`; Italian source). */
    val viewDescription: String
        get() = when (this) {
            Movements -> "Entrate e uscite, ricerca e categorie"
            Analysis -> "Dove vanno i soldi, mese per mese"
            Accounts -> "Saldi e collegamenti con le banche"
            Subscriptions -> "Addebiti ricorrenti, costo al mese e prossimi addebiti"
        }

    /** Lucide icon key in the views sheet. */
    val iconKey: String
        get() = when (this) {
            Movements -> "list-ordered"
            Analysis -> "chart-column"
            Accounts -> "landmark"
            Subscriptions -> "repeat"
        }

    val destination: AppDestination
        get() = when (this) {
            Movements -> AppDestination.Liquidity
            Analysis -> AppDestination.SpendingAnalysis
            Accounts -> AppDestination.Accounts
            Subscriptions -> AppDestination.Subscriptions
        }

    companion object {
        /** The segment a Liquidità destination opens on (null for destinations outside Liquidità). */
        fun fromDestination(destination: AppDestination): LiquiditySegment? = entries.firstOrNull { it.destination == destination }
    }
}

/**
 * One-shot request carried by a deep link into Conti (ACC-009 `rinnova=<origin>`, ACC-010 `nuovo=1`).
 * The shell keeps it until the Conti screen consumes it, then clears it ("removes the parameter").
 */
sealed class AccountsLaunchIntent {
    /** Open the New-account dialog (`/liquidita/conti?nuovo=1`; also `new`/`neu`, see 04 open question 3). */
    data object NewAccount : AccountsLaunchIntent()

    /** Open the bank renewal flow (`?rinnova=1|panoramica|sidebar`). */
    data class Renew(val origin: String) : AccountsLaunchIntent()

    companion object {
        fun fromPath(path: String): AccountsLaunchIntent? {
            if (!path.contains('?')) return null
            val destination = AppDestination.fromPath(path.substringBefore('?')) ?: return null
            if (destination != AppDestination.Accounts && destination != AppDestination.Liquidity) return null
            val query = path.substringAfter('?').split('&').filter { it.isNotEmpty() }.associate { pair ->
                val key = pair.substringBefore('=')
                val value = if (pair.contains('=')) pair.substringAfter('=') else ""
                key to runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
            }
            query["rinnova"]?.let { return Renew(it.ifEmpty { "1" }) }
            if (destination == AppDestination.Accounts && listOf("nuovo", "new", "neu").any { it in query }) return NewAccount
            return null
        }
    }
}

/**
 * TX-022 (web #444): what Movimenti, Analisi and Abbonamenti say before the first account, instead of zeros and empty
 * charts. Italian sources; null for Conti, which has its own empty state. Same names on iOS.
 */
object LiquidityNoAccounts {
    data class Content(val iconKey: String, val title: String, val description: String)

    fun content(segment: LiquiditySegment): Content? = when (segment) {
        LiquiditySegment.Movements -> Content(
            "arrow-left-right", "Prima serve un conto",
            "Collega la banca o crea un conto a mano, poi importa l'estratto conto: qui vedrai entrate e uscite, giorno per giorno.",
        )
        LiquiditySegment.Analysis -> Content(
            "chart-column", "Qui vedrai dove vanno i soldi",
            "Spese per categoria mese per mese, entrate e risparmio. Serve un conto con i suoi movimenti.",
        )
        LiquiditySegment.Subscriptions -> Content(
            "repeat", "Qui troverai i tuoi abbonamenti",
            "Li cerchiamo da soli nei movimenti di un conto: quanto costano al mese e all'anno, e quando arriva il prossimo addebito.",
        )
        LiquiditySegment.Accounts -> null
    }

    /** True once the accounts are known and there are none (never while they load). */
    fun applies(accountCount: Int?): Boolean = accountCount == 0
}
