package io.buddybudget.core.domain.overview

import io.buddybudget.core.data.SidebarDeadlines
import io.buddybudget.core.data.SidebarFire
import io.buddybudget.core.data.SidebarSummary
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.AppDestination
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// «Il tuo quadro» in «Altro»: the web sidebar's insight modules (spec: features/00 SHELL-020, SHELL-028…038;
// features/15 SET-020/021; web lib/sidebar/modules.ts, components/domain/sidebar-insights). Same names on iOS.

enum class SidebarModuleId(val raw: String, val settingsLabel: String, val settingsHint: String, val title: String) {
    Oggi("oggi", "Patrimonio netto", "Il totale di oggi e la variazione dell'ultimo mese.", "Oggi"),
    Portafoglio("portafoglio", "Portafoglio", "Valore degli investimenti e posizioni principali.", "Portafoglio"),
    Watchlist("watchlist", "Watchlist", "I titoli che segui, con gli avvisi di prezzo scattati.", "Watchlist"),
    Scadenze("scadenze", "Prossime scadenze", "Rate dei finanziamenti e collegamenti bancari da rinnovare.", "Prossime scadenze"),
    Fire("fire", "Obiettivo FIRE", "Quanto manca al numero FIRE, con le ipotesi di Analitiche.", "Obiettivo FIRE");

    /** Per-device switch (`bb:sidebar:module:{id}`), default on (SHELL-028, SET-020). */
    val preferenceKey: String get() = "bb:sidebar:module:$raw"

    /** SHELL-029: Watchlist starts collapsed, the others open. */
    val openByDefault: Boolean get() = this != Watchlist

    /** SHELL-037: summary 5 min (Oggi, Portafoglio, Watchlist), deadlines 10 min, FIRE 60 min. */
    val freshSeconds: Long
        get() = when (this) {
            Oggi, Portafoglio, Watchlist -> 5 * 60L
            Scadenze -> 10 * 60L
            Fire -> 60 * 60L
        }

    companion object {
        const val ENABLED_BY_DEFAULT = true

        /** SET-020 order (`SIDEBAR_MODULES`), without FIRE where `retirement` is off (SET-021). */
        fun settingsOrder(retirement: Boolean): List<SidebarModuleId> =
            listOf(Oggi, Portafoglio, Watchlist, Scadenze, Fire).filter { it != Fire || retirement }

        /** SHELL-029 render order of the enabled modules (FIRE only with `retirement`, SHELL-036). */
        fun renderOrder(enabled: (SidebarModuleId) -> Boolean, retirement: Boolean): List<SidebarModuleId> =
            listOf(Oggi, Scadenze, Fire, Portafoglio, Watchlist).filter { enabled(it) && (it != Fire || retirement) }

        /** SHELL-028: which requests the enabled modules need (a disabled module makes none). */
        fun needsSummary(modules: List<SidebarModuleId>): Boolean = Oggi in modules || Portafoglio in modules || Watchlist in modules
    }
}

object SidebarInsights {
    const val MAX_HOLDINGS = 3
    const val MAX_WATCHLIST = 4
    const val MASK = "••••"

    /** SHELL-030: net worth and its 30-day change, without pension when the user excluded it. */
    fun today(netWorth: SidebarSummary.NetWorth, pensionIncluded: Boolean): Pair<Double, Double?> {
        val drop = if (!pensionIncluded) netWorth.pension else null
        val total = netWorth.total - (drop?.total ?: 0.0)
        val change = netWorth.monthChange?.let { it - (drop?.monthChange ?: 0.0) }
        return total to change
    }

    /** Change color: neutral when missing or ~0, else positive / negative (`changeToneClass`). */
    fun tone(value: Double?): AmountTone = when {
        value == null || abs(value) < 0.00005 -> AmountTone.Neutral
        value < 0 -> AmountTone.Neg
        else -> AmountTone.Pos
    }

    /** SHELL-035: overdue items counted in the badge. */
    fun overdueCount(items: List<SidebarDeadlines.Item>): Int = items.count { it.overdue }

    /** `{n} scaduta|scadute` (Italian sources). */
    fun overdueBadge(count: Int): String? = when {
        count <= 0 -> null
        count == 1 -> "scaduta"
        else -> "scadute"
    }

    /** `{n} titolo|titoli`. */
    fun watchlistSummary(count: Int): String = if (count == 1) "titolo" else "titoli"

    /** `{n} avviso|avvisi`. */
    fun alertsWord(count: Int): String = if (count == 1) "avviso" else "avvisi"

    /** FIRE bar fill (0…1) and `38%` text (capped at 100%, SHELL-036). */
    fun fireFraction(progress: Double): Double = min(max(progress, 0.0), 1.0)
    fun fireProgressText(progress: Double): String = "${jsRound(fireFraction(progress) * 100)}%"

    /** SHELL-036: `tra N anni` / `tra 1 anno` / `tra meno di un anno` / `raggiunto`; null when unknown. */
    fun yearsToFire(years: Double?): CatalogText? {
        if (years == null) return null
        if (years <= 0) return CatalogText("raggiunto")
        if (years < 1) return CatalogText("tra meno di un anno")
        val rounded = jsRound(years)
        return if (rounded == 1) CatalogText("tra 1 anno") else CatalogText("tra {0} anni", mapOf("0" to rounded.toString()))
    }

    sealed class FireState {
        /** Without annual retirement spending: invitation copy. */
        data object Invite : FireState()
        /** SHELL-036 (web #444): no target and nothing set aside yet — a new user gets no FIRE hint. */
        data object Hidden : FireState()
        data class Reached(val progress: Double) : FireState()
        data class Progress(val progress: Double, val remaining: Double, val years: CatalogText?) : FireState()
    }

    fun fireState(fire: SidebarFire): FireState {
        val target = fire.target
        val progress = fire.progress
        if (target == null || progress == null) return if (fire.wealth <= 0) FireState.Hidden else FireState.Invite
        if (progress >= 1) return FireState.Reached(progress)
        return FireState.Progress(progress, max(target - fire.wealth, 0.0), yearsToFire(fire.yearsToFire))
    }

    /** Collapsed summary of the deadlines module: next date `{d} {mon}`. */
    fun deadlineDay(iso: String, locale: BBLocale): Pair<String, String> {
        val date = CalendarDate.parse(iso) ?: return iso to ""
        return date.day.toString() to BBFormat.monthNameShort(date.month, locale)
    }
}

/**
 * Web hrefs served by the API (deadlines, «Novità») mapped to an in-app path `ShellModel.open(path)` understands.
 * Unknown paths open the section's root (api/endpoints/meta.md).
 */
object InAppLinks {
    fun nativePath(href: String): String {
        if (AppDestination.fromPath(href) != null) return href
        val path = href.substringBefore("?")
        return when (path) {
            "/conti/collega" -> AppDestination.Liquidity.path
            else -> {
                val section = "/" + (path.split("/").firstOrNull { it.isNotEmpty() } ?: "")
                if (AppDestination.fromPath(section) != null) section else AppDestination.Overview.path
            }
        }
    }

    /** SHELL-034: a deadline row — instalments open the debt (Debiti area), renewals open Conti with the renewal flow. */
    fun deadlinePath(item: SidebarDeadlines.Item): String {
        if (item.kind == "rinnovo") return "/liquidita/conti?rinnova=sidebar"
        val id = if (item.id.startsWith("rata:")) item.id.removePrefix("rata:") else ""
        return if (id.isEmpty()) AppDestination.Debts.path else "/debiti/finanziamenti?id=$id"
    }

    /** SHELL-033: security page of a holding / watchlist row. */
    fun securityPath(instrumentId: String): String = "/investimenti/titoli/$instrumentId"
}

/** SHELL-037: data fresh for a while, never retried (an error renders nothing until the next freshness window). */
class FreshnessClock(var loadedAtMillis: Long? = null) {
    fun isFresh(nowMillis: Long, seconds: Long): Boolean {
        val at = loadedAtMillis ?: return false
        return nowMillis - at < seconds * 1000
    }

    fun mark(nowMillis: Long) {
        loadedAtMillis = nowMillis
    }
}
