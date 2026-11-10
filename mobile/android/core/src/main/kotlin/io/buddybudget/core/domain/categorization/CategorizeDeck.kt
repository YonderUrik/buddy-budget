package io.buddybudget.core.domain.categorization

import io.buddybudget.core.data.CategorizeApplyGroup
import io.buddybudget.core.data.CategorizeSuggestion
import io.buddybudget.core.data.CategorySource
import io.buddybudget.core.data.SuggestionGroup
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

/** A decision taken on a card, not yet saved (CAT-064). */
data class CategorizeDecision(
    val group: SuggestionGroup,
    val categoryId: String,
    val excludedPercentage: Double,
    val remember: Boolean,
    /** Side the card left by (undo brings it back from there, CAT-067). */
    val exit: Exit,
) {
    enum class Exit { Confirm, Change }

    val applyGroup: CategorizeApplyGroup
        get() = CategorizeApplyGroup(group.transactionIds, categoryId, excludedPercentage, remember, group.merchantKey)
}

/**
 * «Da decidere» card deck (`use-swipe-deck.ts`), pure and immutable: the queue, skip, decide, undo and the pending
 * batch. Same type on iOS.
 */
data class CategorizeDeck(
    /** Groups still to decide, first = the active card. */
    val queue: List<SuggestionGroup>,
    /** Decided and not saved yet, oldest first (undo pops the last one). */
    val pending: List<CategorizeDecision> = emptyList(),
    /** Decided and being saved (no longer undoable). */
    val saving: List<CategorizeDecision> = emptyList(),
) {
    val current: SuggestionGroup? get() = queue.firstOrNull()
    val next: SuggestionGroup? get() = queue.getOrNull(1)
    val remaining: Int get() = queue.size
    val canUndo: Boolean get() = pending.isNotEmpty()
    val isEmpty: Boolean get() = queue.isEmpty()

    /** Movements still to decide (CAT-037 `Da decidere · n`). */
    val movementCount: Int get() = queue.sumOf { it.transactionIds.size }

    /** CAT-058/066: confirm the proposal with its split percentage; null without a proposal. */
    fun confirm(remember: Boolean): CategorizeDeck? {
        val group = current ?: return null
        val suggestion = group.suggestion ?: return null
        return decide(CategorizeDecision(group, suggestion.suggestedCategoryId, suggestion.suggestedSplitPercentage ?: 0.0, remember, CategorizeDecision.Exit.Confirm))
    }

    /** CAT-059/066: another category, with 0 % exclusion. */
    fun choose(categoryId: String, remember: Boolean): CategorizeDeck {
        val group = current ?: return this
        return decide(CategorizeDecision(group, categoryId, 0.0, remember, CategorizeDecision.Exit.Change))
    }

    /** CAT-060: the active card goes to the end of the queue (not saved). */
    fun skip(): CategorizeDeck = if (queue.size > 1) copy(queue = queue.drop(1) + queue.first()) else this

    /** Restores the last unsaved decision to the top of the deck. */
    fun undo(): Pair<CategorizeDeck, CategorizeDecision?> {
        val last = pending.lastOrNull() ?: return this to null
        return copy(queue = listOf(last.group) + queue, pending = pending.dropLast(1)) to last
    }

    /** Moves every pending decision to `saving`; returns the batch to send (null when nothing is pending). */
    fun beginSave(): Pair<CategorizeDeck, List<CategorizeDecision>?> {
        if (pending.isEmpty()) return this to null
        return copy(saving = saving + pending, pending = emptyList()) to pending
    }

    fun finishSave(batch: List<CategorizeDecision>): CategorizeDeck {
        val keys = batch.map { it.group.groupKey }.toSet()
        return copy(saving = saving.filterNot { it.group.groupKey in keys })
    }

    /** CAT-065: a failed save puts the cards back on the deck (at the top, in their original order). */
    fun failSave(batch: List<CategorizeDecision>): CategorizeDeck {
        val done = finishSave(batch)
        val keys = done.queue.map { it.groupKey }.toSet()
        return done.copy(queue = batch.map { it.group }.filterNot { it.groupKey in keys } + done.queue)
    }

    /** Hides groups (auto-apply `readyKeys`, CAT-040). */
    fun remove(keys: Set<String>): CategorizeDeck = copy(queue = queue.filterNot { it.groupKey in keys })

    /** Brings groups back after a failed auto-apply (CAT-042). */
    fun restore(groups: List<SuggestionGroup>): CategorizeDeck {
        val keys = queue.map { it.groupKey }.toSet()
        return copy(queue = queue + groups.filterNot { it.groupKey in keys })
    }

    /**
     * AI polling (CAT-052): fresh suggestions replace the cards still in the queue (same order); new groups not decided
     * yet go to the end; groups no longer returned leave the queue.
     */
    fun refresh(groups: List<SuggestionGroup>): CategorizeDeck {
        val byKey = groups.associateBy { it.groupKey }
        val decided = (pending + saving).map { it.group.groupKey }.toSet()
        val known = queue.map { it.groupKey }.toSet()
        return copy(queue = queue.mapNotNull { byKey[it.groupKey] } + groups.filter { it.groupKey !in known && it.groupKey !in decided })
    }

    /** Groups in the queue without a proposal (AI banner, CAT-048/052). */
    val withoutProposal: Int get() = queue.count { it.suggestion == null }

    private fun decide(decision: CategorizeDecision): CategorizeDeck = copy(queue = queue.drop(1), pending = pending + decision)

    companion object {
        /** CAT-039: groups sorted by number of movements, descending (stable). */
        fun of(groups: List<SuggestionGroup>): CategorizeDeck =
            CategorizeDeck(groups.sortedWith { a, b -> b.transactionIds.size - a.transactionIds.size })
    }
}

/**
 * Wording helpers shared by cards, «Messe dall'app» and Ricategorizza (`lib/categorization/origin.ts`). Strings are
 * Italian catalog keys with their placeholder values; the UI translates them.
 */
object CategorizationText {
    /** CAT-043: confidence at or above which a proposal applies on its own (0.7 since web #456). */
    const val AUTO_APPLY_THRESHOLD = 0.7

    /** SET-031 hint: the threshold as a whole percentage («70»). */
    val autoApplyPercent: String get() = confidencePercent(AUTO_APPLY_THRESHOLD).toString()

    data class Phrase(val key: String, val values: List<String> = emptyList())

    /** CAT-047: why a category is proposed. */
    fun suggestionOrigin(suggestion: CategorizeSuggestion): Phrase = when (suggestion.source) {
        CategorySource.assistente -> Phrase("Proposta dall'AI")
        CategorySource.regola ->
            suggestion.rulePattern?.let { Phrase("Simile alla tua regola «{0}»", listOf(it)) } ?: Phrase("Simile a una tua regola")
        else -> {
            val history = suggestion.history
            when {
                history == null -> Phrase("Come i tuoi movimenti passati")
                history.total == 1 -> Phrase("Come l'unico tuo movimento simile")
                history.agreeing == history.total -> Phrase("Come tutti i tuoi {0} movimenti simili", listOf(history.total.toString()))
                else -> Phrase("Come {0} dei tuoi {1} movimenti simili", listOf(history.agreeing.toString(), history.total.toString()))
            }
        }
    }

    /**
     * CAT-047 (`autoOriginDescription`): why the app set a category on its own, composed from the web's fragments.
     * `bankCategory` quotes the bank's label for origin `banca`. Null for the user's choice and unknown origins.
     */
    fun autoOriginDescription(source: CategorySource?, confidence: Double?, bankCategory: String?, tr: (String, Map<String, String>) -> String): String? {
        val percent = if (confidence == null) "" else tr(" (sicura al {0}%)", mapOf("0" to confidencePercent(confidence).toString()))
        return when (source) {
            CategorySource.regola -> tr("Messa dall'app con una tua regola", emptyMap())
            CategorySource.banca -> if (!bankCategory.isNullOrEmpty()) tr("Messa dall'app: nel file la banca la chiama «{0}»", mapOf("0" to bankCategory))
                else tr("Messa dall'app con la categoria scritta dalla banca nel file", emptyMap())
            CategorySource.assistente -> tr("Messa dall'app: proposta dell'AI{0}", mapOf("0" to percent))
            CategorySource.storico -> tr("Messa dall'app: la scegli sempre per questo esercente{0}", mapOf("0" to percent))
            else -> null
        }
    }

    /** Whole percentage of a 0…1 confidence (CAT-046: accessibility text only). */
    fun confidencePercent(confidence: Double): Int = JSNumber.round(confidence.coerceIn(0.0, 1.0) * 100).toInt()

    /**
     * When the movements happened: «9 ott», «2–9 ott», «28 set – 9 ott»; with the year when it is not the current one or
     * the range crosses years (`dateRangeLabel`).
     */
    fun dateRangeLabel(dates: List<String>, today: CalendarDate, locale: BBLocale): String {
        if (dates.isEmpty()) return ""
        val sorted = dates.sorted()
        val first = sorted.first()
        val last = sorted.last()
        fun year(iso: String) = iso.take(4).toIntOrNull() ?: 0
        val withYear = year(first) != year(last) || year(last) != today.year
        fun format(iso: String) = if (withYear) BBFormat.formatDateWithYear(iso, locale) else BBFormat.formatShortDate(iso, locale)
        if (first == last) return format(first)
        if (!withYear && first.take(7) == last.take(7)) {
            return "${first.substring(8, 10).toInt()}–${BBFormat.formatShortDate(last, locale)}"
        }
        return "${format(first)} – ${format(last)}"
    }

    /** Indices of the most recent movements of a group (preview, CAT-055): by date desc, at most `limit`. */
    fun recentIndices(dates: List<String>, limit: Int): List<Int> =
        dates.indices.sortedWith { a, b -> if (dates[a] != dates[b]) dates[b].compareTo(dates[a]) else a - b }.take(limit)
}

/**
 * «Messe dall'app» summary (CAT-077, web #456): the same Italian fragments the web joins, so every language reads exactly
 * as on the web. `tr` translates a catalog source with `{0}` values. Same names on iOS.
 */
object AutoReviewText {
    /** Days of history «Messe dall'app» covers (`AUTO_CATEGORIZED_RECENT_DAYS`). */
    const val RECENT_DAYS = 30

    /** The reason fragment: on/off × some rows from the bank's category. */
    fun reasonSource(autoApplyEnabled: Boolean, fromBank: Boolean): String = when {
        autoApplyEnabled && fromBank -> ", con le tue regole, con la categoria della banca o perché era abbastanza sicura"
        autoApplyEnabled -> ", con le tue regole o perché era abbastanza sicura"
        fromBank -> ", con le tue regole o con la categoria della banca"
        else -> ", con le tue regole"
    }

    /** «Negli ultimi 30 giorni, 12 movimenti hanno la categoria messa dall'app, con … . Non serve confermarle: …» */
    fun summary(total: Int, fromBank: Boolean, autoApplyEnabled: Boolean, tr: (String, Map<String, String>) -> String): String =
        tr("Negli ultimi {0} giorni,", mapOf("0" to RECENT_DAYS.toString())) + " " +
            (if (total == 1) tr("1 movimento ha", emptyMap()) else tr("{0} movimenti hanno", mapOf("0" to total.toString()))) + " " +
            tr("la categoria messa dall'app", emptyMap()) + tr(reasonSource(autoApplyEnabled, fromBank), emptyMap()) +
            tr(". Non serve confermarle: se una non va, toccala e cambiala.", emptyMap())
}
