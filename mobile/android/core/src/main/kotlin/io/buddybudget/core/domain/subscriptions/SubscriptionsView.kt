package io.buddybudget.core.domain.subscriptions

import io.buddybudget.core.data.SubscriptionActivity
import io.buddybudget.core.data.SubscriptionCharge
import io.buddybudget.core.data.SubscriptionDecision
import io.buddybudget.core.data.SubscriptionDecisionInput
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionPriceChange
import io.buddybudget.core.data.SubscriptionStatus
import io.buddybudget.core.data.SubscriptionTotals
import io.buddybudget.core.data.SubscriptionsResponse
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

// Pure helpers of the Abbonamenti screen (web `lib/subscriptions/view.ts`, `subscriptions-overview.tsx`,
// `subscription-detail-dialog.tsx`). Same names and behaviour as `SubscriptionsView` on iOS.

/** The list sections of the screen, in display order (SUB-008…012). */
data class SubscriptionSections(
    /** `Trovati nei tuoi movimenti`: pending and active. */
    val toConfirm: List<SubscriptionItem> = emptyList(),
    /** `I tuoi abbonamenti`: confirmed and active. */
    val confirmed: List<SubscriptionItem> = emptyList(),
    /** `Non addebitati da un po'`: stopped, confirmed or pending. */
    val stopped: List<SubscriptionItem> = emptyList(),
    /** `Aumenti di prezzo`: recent rises, not excluded/terminated. */
    val priceRises: List<SubscriptionItem> = emptyList(),
    /** Archive `Terminati (n)`. */
    val ended: List<SubscriptionItem> = emptyList(),
    /** Archive `Non sono abbonamenti (n)`. */
    val excluded: List<SubscriptionItem> = emptyList(),
)

/** Hero line 2 (SUB-005): the next confirmed active charge within 30 days, with the window's count and sum. */
data class SubscriptionNextCharge(val item: SubscriptionItem, val date: String, val count: Int, val total: Double)

/** Footer actions of the detail (SUB-017, SUB-020, SUB-021). */
data class SubscriptionAllowedActions(
    val removal: Removal? = null,
    /** `Non è un abbonamento`. */
    val exclude: Boolean = false,
    /** `È terminato`. */
    val terminate: Boolean = false,
    val confirm: ConfirmLabel? = null,
) {
    /** `Delete` = manual `Elimina`; `Restore` = saved detected `Ripristina com'era`. */
    enum class Removal { Delete, Restore }

    /** `Yes` = `Sì, è un abbonamento`; `PutBack` = `Rimettilo tra i miei` (excluded or terminated). */
    enum class ConfirmLabel { Yes, PutBack }
}

/** How a decision is saved (SUB-018). */
sealed class SubscriptionDecisionRoute {
    data class Patch(val id: String, val status: SubscriptionStatus) : SubscriptionDecisionRoute()
    data class Post(val input: SubscriptionDecisionInput) : SubscriptionDecisionRoute()
    /** No saved choice and no amount or cadence: `Mancano importo e cadenza`. */
    data object MissingData : SubscriptionDecisionRoute()
}

/** What a quick action does (SUB-013). */
sealed class SubscriptionQuickAction {
    data class Save(val input: SubscriptionDecisionInput) : SubscriptionQuickAction()
    data object OpenDetail : SubscriptionQuickAction()
}

object SubscriptionsView {
    /** Days ahead counted as "upcoming" (`UPCOMING_WINDOW_DAYS`). */
    const val UPCOMING_WINDOW_DAYS = 30
    /** A price rise is shown for this many days (`PRICE_RISE_WINDOW_DAYS`). */
    const val PRICE_RISE_WINDOW_DAYS = 365
    /** Charges listed in the detail (`HISTORY_LIMIT`). */
    const val HISTORY_LIMIT = 12
    /** Dates further than this are written with the year (`YEAR_AWAY_DAYS`). */
    const val YEAR_AWAY_DAYS = 300

    /** Days from [today] to [date] (negative when past); 0 for invalid input. */
    fun daysBetween(today: String, date: String): Int {
        val a = CalendarDate.parse(today) ?: return 0
        val b = CalendarDate.parse(date) ?: return 0
        return b.epochDay - a.epochDay
    }

    /** SUB-008…012: partitions the items (server order kept, i.e. by next charge). */
    fun sections(items: List<SubscriptionItem>, today: String): SubscriptionSections = SubscriptionSections(
        toConfirm = items.filter { it.decision == SubscriptionDecision.DaConfermare && it.activity == SubscriptionActivity.Attivo },
        confirmed = items.filter { it.decision == SubscriptionDecision.Confermato && it.activity == SubscriptionActivity.Attivo },
        stopped = items.filter {
            it.activity == SubscriptionActivity.Fermo &&
                (it.decision == SubscriptionDecision.Confermato || it.decision == SubscriptionDecision.DaConfermare)
        },
        priceRises = recentPriceRises(items, today),
        ended = items.filter { it.decision == SubscriptionDecision.Terminato },
        excluded = items.filter { it.decision == SubscriptionDecision.Escluso },
    )

    /** `upcomingCharges`: confirmed active items due within the window (overdue included). */
    fun upcoming(items: List<SubscriptionItem>, today: String, windowDays: Int = UPCOMING_WINDOW_DAYS): List<SubscriptionItem> =
        items.filter {
            val next = it.nextDate
            it.decision == SubscriptionDecision.Confermato && it.activity == SubscriptionActivity.Attivo &&
                next != null && daysBetween(today, next) <= windowDays
        }

    /** SUB-005: first upcoming item (server order = next date ascending) with the window's count and sum. */
    fun nextCharge(items: List<SubscriptionItem>, today: String): SubscriptionNextCharge? {
        val upcoming = upcoming(items, today)
        val first = upcoming.firstOrNull() ?: return null
        val date = first.nextDate ?: return null
        return SubscriptionNextCharge(first, date, upcoming.size, upcoming.sumOf { it.amount ?: 0.0 })
    }

    /** SUB-011 (`recentPriceRises`): a real rise within 365 days, decision neither excluded nor terminated. */
    fun recentPriceRises(items: List<SubscriptionItem>, today: String): List<SubscriptionItem> = items.filter {
        val change = it.priceChange
        change != null && change.to > change.from && it.decision != SubscriptionDecision.Escluso &&
            it.decision != SubscriptionDecision.Terminato && daysBetween(change.since, today) <= PRICE_RISE_WINDOW_DAYS
    }

    /** Totals as the server computes them (`buildSubscriptionsView`), for local previews (pending undo). */
    fun totals(items: List<SubscriptionItem>): SubscriptionTotals {
        val confirmed = items.filter {
            it.decision == SubscriptionDecision.Confermato && it.activity == SubscriptionActivity.Attivo && it.monthly != null
        }
        val pending = items.filter {
            it.decision == SubscriptionDecision.DaConfermare && it.activity == SubscriptionActivity.Attivo && it.monthly != null
        }
        val monthly = JSNumber.round2(confirmed.fold(0.0) { sum, i -> sum + (i.monthly ?: 0.0) })
        return SubscriptionTotals(
            count = confirmed.size, monthly = monthly, yearly = JSNumber.round2(monthly * 12),
            pendingCount = pending.size, pendingMonthly = JSNumber.round2(pending.fold(0.0) { sum, i -> sum + (i.monthly ?: 0.0) }),
        )
    }

    /** SUB-016: up to 12 most recent charges, newest first (the server lists them oldest first). */
    fun history(item: SubscriptionItem): List<SubscriptionCharge> = item.charges.asReversed().take(HISTORY_LIMIT)

    /** Trailing line: monthly equivalent for non-monthly cadences. */
    fun showsMonthlyEquivalent(item: SubscriptionItem): Boolean =
        item.cadence != null && item.cadence != SubscriptionCadence.MENSILE && item.monthly != null

    /** The rise shown under the amount (`era {from}`), if the price went up. */
    fun rise(item: SubscriptionItem): SubscriptionPriceChange? = item.priceChange?.takeIf { it.to > it.from }

    /** SUB-017: the decision actions allowed for the item's state. */
    fun allowedActions(item: SubscriptionItem): SubscriptionAllowedActions {
        val archived = item.decision == SubscriptionDecision.Escluso || item.decision == SubscriptionDecision.Terminato
        return SubscriptionAllowedActions(
            removal = when {
                item.id == null -> null
                item.isManual -> SubscriptionAllowedActions.Removal.Delete
                else -> SubscriptionAllowedActions.Removal.Restore
            },
            exclude = item.decision != SubscriptionDecision.Escluso && !item.isManual,
            terminate = item.decision != SubscriptionDecision.Terminato &&
                (item.decision != SubscriptionDecision.DaConfermare || item.activity == SubscriptionActivity.Fermo),
            confirm = when {
                item.decision == SubscriptionDecision.Confermato -> null
                archived -> SubscriptionAllowedActions.ConfirmLabel.PutBack
                else -> SubscriptionAllowedActions.ConfirmLabel.Yes
            },
        )
    }

    /** SUB-018: PATCH when a saved choice exists, else POST `rilevato` (needs amount and cadence). */
    fun decisionRoute(item: SubscriptionItem, status: SubscriptionStatus): SubscriptionDecisionRoute {
        item.id?.let { return SubscriptionDecisionRoute.Patch(it, status) }
        return decisionInput(item, status)?.let { SubscriptionDecisionRoute.Post(it) } ?: SubscriptionDecisionRoute.MissingData
    }

    /** SUB-013: quick actions always POST the snapshot; without amount or cadence they open the detail. */
    fun quickAction(item: SubscriptionItem, status: SubscriptionStatus): SubscriptionQuickAction =
        decisionInput(item, status)?.let { SubscriptionQuickAction.Save(it) } ?: SubscriptionQuickAction.OpenDetail

    private fun decisionInput(item: SubscriptionItem, status: SubscriptionStatus): SubscriptionDecisionInput? {
        val amount = item.amount ?: return null
        val cadence = item.cadence ?: return null
        return SubscriptionDecisionInput(item.key, status, item.name, amount, cadence, item.categoryId)
    }

    /**
     * Decision 0003: what the list shows while a removal waits for its undo window. A manual item (or a saved detected
     * item that is no longer detected) disappears; a detected one goes back to «da confermare» without its saved id.
     */
    fun applyingRemovals(items: List<SubscriptionItem>, removedIds: Set<String>): List<SubscriptionItem> {
        if (removedIds.isEmpty()) return items
        return items.mapNotNull { item ->
            val id = item.id
            when {
                id == null || id !in removedIds -> item
                item.isManual || item.charges.isEmpty() -> null
                else -> item.copy(id = null, decision = SubscriptionDecision.DaConfermare)
            }
        }
    }

    /** Swatches of the coloured-initial fallback (`AVATAR_COLORS`). */
    val AVATAR_SWATCHES = listOf("blue", "teal", "purple", "orange", "pink", "indigo", "cyan", "amber")

    /** Stable avatar swatch per key (`avatarColor`, JS `hash * 31 + charCode >>> 0` over UTF-16 units). */
    fun avatarSwatch(key: String): String {
        var hash = 0u
        for (ch in key) hash = hash * 31u + ch.code.toUInt()
        return AVATAR_SWATCHES[(hash % AVATAR_SWATCHES.size.toUInt()).toInt()]
    }
}

/** Forms (SUB-019, SUB-023). */
object SubscriptionForm {
    const val NAME_MAX_LENGTH = 80
    const val AMOUNT_MAX = 100_000.0

    sealed class Result {
        data class Valid(val name: String, val amount: Double?) : Result()
        /** Italian catalog key of the message. */
        data class Invalid(val key: String) : Result()
    }

    /** Name required (trimmed, ≤ 80); amount (when [requireAmount]) parsed with the locale rules, > 0 and ≤ 100,000. */
    fun validate(name: String, amountText: String, requireAmount: Boolean): Result {
        val trimmed = JSNumber.trim(name)
        if (trimmed.isEmpty()) return Result.Invalid("Dai un nome all'abbonamento")
        if (trimmed.codePointCount(0, trimmed.length) > NAME_MAX_LENGTH) return Result.Invalid("Il nome è troppo lungo")
        if (!requireAmount) return Result.Valid(trimmed, null)
        val amount = BBFormat.parseAmount(amountText)
        if (amount == null || amount <= 0) return Result.Invalid("Inserisci l'importo di ogni addebito")
        if (amount > AMOUNT_MAX) return Result.Invalid("L'importo è troppo alto")
        return Result.Valid(trimmed, amount)
    }

    /** Prefill of the amount field (2 decimals, locale separator, no grouping, so it parses back). */
    fun amountText(amount: Double?, locale: BBLocale): String {
        if (amount == null) return ""
        val fixed = String.format(java.util.Locale.ROOT, "%.2f", JSNumber.round2(amount))
        return if (locale == BBLocale.EN_GB) fixed else fixed.replace('.', ',')
    }

    /** Caps the name at 80 characters while typing (web `maxLength`). */
    fun clampName(name: String): String = if (name.length > NAME_MAX_LENGTH) name.take(NAME_MAX_LENGTH) else name
}

/** Everything the Abbonamenti screen renders, derived from the last response. Same fields as on iOS. */
data class SubscriptionsUiState(
    val phase: Phase = Phase.Loading,
    val response: SubscriptionsResponse? = null,
    /** A quick action or a detail/add save is running (SUB-015: quick buttons disabled). */
    val isSaving: Boolean = false,
    /** Saved ids whose removal waits for the undo window (decision 0003). */
    val pendingRemovals: Set<String> = emptySet(),
) {
    enum class Phase { Loading, Failed, Loaded }

    val today: String get() = response?.today ?: ""
    val currency: String get() = response?.currency ?: "EUR"

    /** Items as shown (pending removals applied). */
    val items: List<SubscriptionItem> get() = SubscriptionsView.applyingRemovals(response?.items.orEmpty(), pendingRemovals)

    /** Server totals, or recomputed while a removal is pending so the hero matches the list. */
    val totals: SubscriptionTotals
        get() {
            val r = response ?: return SubscriptionTotals()
            return if (pendingRemovals.isEmpty()) r.totals else SubscriptionsView.totals(items)
        }

    val sections: SubscriptionSections get() = SubscriptionsView.sections(items, today)

    val nextCharge: SubscriptionNextCharge? get() = SubscriptionsView.nextCharge(items, today)

    /** SUB-007: no items at all. */
    val isEmpty: Boolean get() = items.isEmpty()

    /** The current version of an item (after a refetch), by key. */
    fun item(key: String): SubscriptionItem? = items.firstOrNull { it.key == key }
}
