package io.buddybudget.core.domain.goals

import io.buddybudget.core.data.GoalSourceView
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.overview.GoalsTile
import java.net.URLDecoder
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Obiettivi screens state and rules (spec: features/12-goals.md). The server computes the plan, the sources and the
// FIRE comparison (`GET /api/goals`); the 5-step form runs on the device with the ported `GoalWizard`. Same names on
// iOS (`GoalsUiState.swift`).

/** What the Goals list shows. */
enum class GoalsGate { LOADING, FAILED, UNAVAILABLE, EMPTY, CONTENT }

/** Kind label in the form (`GOAL_KIND_INFO[kind].label`), Italian source. */
val GoalKind.label: String
    get() = when (this) {
        GoalKind.EMERGENZA -> "Fondo di emergenza"
        GoalKind.VIAGGIO -> "Viaggio"
        GoalKind.CASA -> "Casa"
        GoalKind.ACQUISTO -> "Un acquisto"
        GoalKind.ALTRO -> "Qualcos'altro"
    }

val GoalKind.hint: String
    get() = when (this) {
        GoalKind.EMERGENZA -> "Qualche mese di spese da parte per gli imprevisti"
        GoalKind.VIAGGIO -> "Una vacanza o un viaggio da pagare senza debiti"
        GoalKind.CASA -> "L'anticipo di una casa o dei lavori"
        GoalKind.ACQUISTO -> "Un'auto, un computer, un matrimonio"
        GoalKind.ALTRO -> "Qualunque cosa per cui vuoi mettere da parte"
    }

val GoalKind.iconKey: String get() = GoalsTile.iconKey(key)
val GoalKind.colorToken: String get() = GoalsTile.colorToken(key)

/** `KEPT_GOAL_KINDS`: the money stays in the user's wealth. */
val GoalKind.isKept: Boolean get() = this == GoalKind.EMERGENZA

/** Request coming from a deep link (GOAL-003, GOAL-001, detail path). */
sealed interface GoalsLaunchIntent {
    /** `/analitiche/obiettivi?nuovo=1[&tipo=…]`. */
    data class New(val kind: GoalKind?) : GoalsLaunchIntent

    /** `/analitiche/obiettivi/{id}`. */
    data class Detail(val id: String) : GoalsLaunchIntent

    /** `/analitiche/obiettivi`. */
    data object List : GoalsLaunchIntent

    companion object {
        const val BASE_PATH = "/analitiche/obiettivi"

        /** null when the path is not a Goals path. */
        fun parse(path: String): GoalsLaunchIntent? {
            val clean = path.substringBefore("?")
            if (clean != BASE_PATH && !clean.startsWith("$BASE_PATH/")) return null
            val id = clean.removePrefix(BASE_PATH).trim('/')
            if (id.isNotEmpty()) return Detail(id)
            val query = if (path.contains("?")) path.substringAfter("?") else ""
            val params = query.split("&").filter { it.isNotEmpty() }.associate {
                val k = it.substringBefore("=")
                val v = if (it.contains("=")) it.substringAfter("=") else ""
                k to runCatching { URLDecoder.decode(v, "UTF-8") }.getOrDefault(v)
            }
            return if (params.containsKey("nuovo")) New(params["tipo"]?.let { GoalKind.fromKey(it) }) else List
        }
    }
}

/** One segment of the capacity bar (GOAL-007). */
data class GoalsBarSegment(val key: String, val label: String, val value: Double, val colorToken: String, val dashed: Boolean)

/** Capacity header (GOAL-007): title, second line, explanation and the stacked bar. */
data class GoalsCapacityHeader(
    val title: String,
    val requested: String?,
    val explanation: String,
    val segments: kotlin.collections.List<GoalsBarSegment>,
    /** Right end of the scale (capacity + gap). */
    val scaleMax: Double,
)

/** A stop of «La strada» (GOAL-012). */
data class GoalsRoadStop(val key: String, val `when`: String, val sort: String, val label: String, val iconKey: String, val colorToken: String)

/** Savings of the month and how much the other open goals already take. */
data class GoalsFormCapacity(val total: Double, val taken: Double)

object GoalsRules {
    /** FIRE row colour and icon (`FIRE_GOAL_INFO`). */
    const val FIRE_ICON_KEY = "target"
    const val FIRE_COLOR_TOKEN = "swatch-emerald"

    /** GOAL-008: goals not marked achieved (a reached-but-not-marked goal stays here). */
    fun openGoals(view: GoalsView): kotlin.collections.List<GoalView> = view.goals.filter { it.status != "raggiunto" || it.achievedAt == null }

    /** GOAL-013. */
    fun doneGoals(view: GoalsView): kotlin.collections.List<GoalView> = view.goals.filter { it.status == "raggiunto" && it.achievedAt != null }

    /** GOAL-009: swaps an open goal with its open neighbour; achieved goals keep their place in the full order. */
    fun reorder(view: GoalsView, openIndex: Int, delta: Int): kotlin.collections.List<String>? {
        val open = openGoals(view)
        if (openIndex !in open.indices || (openIndex + delta) !in open.indices) return null
        val ids = view.goals.map { it.id }.toMutableList()
        val ia = ids.indexOf(open[openIndex].id)
        val ib = ids.indexOf(open[openIndex + delta].id)
        if (ia < 0 || ib < 0) return null
        ids[ia] = ids[ib].also { ids[ib] = ids[ia] }
        return ids
    }

    /** Applies an id order to the view (optimistic update). */
    fun applying(ids: kotlin.collections.List<String>, view: GoalsView): GoalsView {
        val byId = view.goals.associateBy { it.id }
        val goals = ids.mapNotNull { byId[it] }
        return view.copy(goals = if (goals.size == view.goals.size) goals else view.goals)
    }

    /** GOAL-006: emergency-fund suggestion (6 months of essential spending, free account money); null when unknown. */
    /** GOAL-006: the suggestion sentence (Italian source) by `essentialBasis` (web #382). */
    fun emergencySuggestionSource(view: GoalsView): String =
        if (view.essentialBasis == "tutte") "Con {0} mesi delle tue spese sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora."
        else "Con {0} mesi di spese dovute sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora."

    fun emergencySuggestion(view: GoalsView): Pair<Double, Double>? {
        val essential = view.essentialMonthly ?: return null
        val free = view.sources.filter { it.kind == "account" }.fold(0.0) { sum, s -> sum + s.free }
        return GoalWizard.emergencyTarget(essential, GoalConstants.DEFAULT_EMERGENCY_MONTHS.toDouble()) to free
    }

    /** Source rows of the form (GOAL-018/019): free parts with this goal's own parts added back. */
    fun formSources(view: GoalsView, goal: GoalView?): kotlin.collections.List<GoalFreeSource> = GoalWizard.availableSources(
        view.sources.map {
            GoalFreeSource(GoalSourceKind.entries.firstOrNull { k -> k.key == it.kind } ?: GoalSourceKind.ACCOUNT, it.id, it.name, it.total, it.free, it.taxPerEuro)
        },
        goal?.let(::wizardGoal),
    )

    /** The wizard's view of an existing goal. */
    fun wizardGoal(goal: GoalView): GoalWizardGoal = GoalWizardGoal(
        GoalKind.fromKey(goal.kind) ?: GoalKind.ALTRO, goal.name, goal.target, goal.targetDate, goal.monthly, goal.priority,
        goal.sources.map {
            GoalAssignedSource(GoalSourceKind.entries.firstOrNull { k -> k.key == it.kind } ?: GoalSourceKind.ACCOUNT, it.refId, it.amount, it.counted, it.tax)
        },
    )

    /** Initial draft: the goal's values, or a new one at the end (preset kind applied, GOAL-003). */
    fun initialDraft(view: GoalsView, goal: GoalView?, presetKind: GoalKind?): GoalDraft {
        val initial = GoalWizard.initialDraft(goal?.let(::wizardGoal), view.goals.size)
        return if (goal == null && presetKind != null) GoalWizard.withKind(initial, presetKind, view.essentialMonthly) else initial
    }

    /** GOAL-018: tapping a row selects it with the amount still missing (capped at the free part), or deselects it. */
    fun toggleSource(draft: GoalDraft, source: GoalFreeSource): GoalDraft {
        val key = GoalWizard.sourceKey(source.kind, source.id)
        if (draft.sources.any { it.key == key }) return draft.copy(sources = draft.sources.filter { it.key != key })
        val missing = max(0.0, (draft.target ?: 0.0) - GoalWizard.assignedTotal(draft))
        val proposed = max(0.0, min(source.free, missing))
        return draft.copy(sources = draft.sources + GoalDraftSource(key, if (proposed != 0.0) proposed else max(0.0, floor(source.free))))
    }

    /** Savings of the month and how much the other open goals already take; null when capacity is unknown. */
    fun formCapacity(view: GoalsView, goal: GoalView?): GoalsFormCapacity? {
        val capacity = view.capacity ?: return null
        val taken = view.goals.filter { it.id != goal?.id && it.status != "raggiunto" }.fold(0.0) { sum, g -> sum + g.funded }
        return GoalsFormCapacity(max(0.0, capacity), taken)
    }

    /** GOAL-020: «Quanto avanza» (floor of what is left), null when unknown. */
    fun freeCapacity(capacity: GoalsFormCapacity?): Double? = capacity?.let { max(0.0, floor(it.total - it.taken)) }

    /** GOAL-021: the other goals, in order, for the position choice (new goals only). */
    fun positionChoices(view: GoalsView, goal: GoalView?): kotlin.collections.List<GoalView> = if (goal == null) view.goals else emptyList()

    /** Names of the form sources by draft key. */
    fun sourceNames(sources: kotlin.collections.List<GoalFreeSource>): Map<String, String> {
        val map = LinkedHashMap<String, String>()
        for (s in sources) map.putIfAbsent(GoalWizard.sourceKey(s.kind, s.id), s.name)
        return map
    }
}

/**
 * Obiettivi phrasing (web `goal-format.ts`, `goals-capacity.tsx`, `fire-goal-row.tsx`, `goals-road.tsx`), bound to one
 * language and currency. Same API on iOS (`GoalsText`).
 */
class GoalsText(val locale: BBLocale, val currency: String, val masked: Boolean = false, private val translate: (String) -> String) {
    fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    /** Currency without decimals (GOAL-034: masked in privacy mode). */
    fun money(value: Double): String = BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = 0, masked = masked)

    /** «giugno 2027» from `YYYY-MM` or `YYYY-MM-DD`. */
    fun month(key: String): String = BBFormat.formatMonthLabel(key.take(7), locale)

    fun statusLabel(goal: GoalView): String? = GoalsTile.statusLabel(goal.status)?.let { tr(it) }

    fun statusSentence(goal: GoalView): String {
        val (parts, capitalizeFirst) = GoalsTile.statusSentence(goal, ::money, ::month)
        val texts = parts.map { tr(it.source, it.values) }.toMutableList()
        if (capitalizeFirst && texts.isNotEmpty()) texts[0] = BBFormat.capitalize(texts[0])
        return texts.joinToString("")
    }

    /** `fireShiftText`: how far the goal moves the FIRE target; null when unknown or reached. */
    fun fireShift(goal: GoalView): String? {
        val months = goal.fireShiftMonths ?: return null
        if (goal.status == "raggiunto") return null
        if (months <= 0) return tr("non sposta il traguardo")
        if (months < 12) return if (months == 1) tr("sposta il traguardo di 1 mese") else tr("sposta il traguardo di {0} mesi", mapOf("0" to months.toString()))
        val years = JSNumber.round(months / 12.0).toInt()
        return if (years == 1) tr("sposta il traguardo di circa 1 anno") else tr("sposta il traguardo di circa {0} anni", mapOf("0" to years.toString()))
    }

    /** GOAL-007. */
    fun capacityHeader(view: GoalsView): GoalsCapacityHeader {
        val capacity = view.capacity ?: return GoalsCapacityHeader(
            tr("Non sappiamo ancora quanto risparmi al mese."), null,
            tr("Servono almeno tre mesi di movimenti, oppure scrivi il tuo risparmio nelle ipotesi delle Risposte. Intanto gli obiettivi tengono il conto di quanto hai già messo da parte."),
            emptyList(), 0.0,
        )
        val open = view.goals.filter { it.status != "raggiunto" }
        val left = max(0.0, capacity - view.allocated)
        val segments = open.filter { it.funded > 0.5 }.map {
            GoalsBarSegment(it.id, it.name, it.funded, (GoalKind.fromKey(it.kind) ?: GoalKind.ALTRO).colorToken, false)
        }.toMutableList()
        if (left > 0.5) {
            segments += if (view.fire != null) GoalsBarSegment("fire", tr("Traguardo"), left, GoalsRules.FIRE_COLOR_TOKEN, false)
            else GoalsBarSegment("free", tr("Liberi"), left, "muted-foreground", false)
        }
        if (view.gap > 0.5) segments += GoalsBarSegment("gap", tr("Mancano"), view.gap, "neg", true)
        val lowest = open.lastOrNull { it.funded + 0.5 < it.monthly }
        val explanation = when {
            capacity <= 0 -> tr("Finché resta così gli obiettivi non ricevono niente: contano solo i soldi che hai già messo da parte.")
            view.gap > 0.5 -> tr(
                "Il risparmio va agli obiettivi nell'ordine che scegli. Ne mancano {0} al mese: {1} resta indietro.",
                mapOf("0" to money(view.gap), "1" to (lowest?.name ?: tr("l'ultimo della lista"))),
            )
            left > 0.5 -> if (view.fire != null) {
                tr("Il risparmio va agli obiettivi nell'ordine che scegli; i {0} che avanzano vanno verso il traguardo.", mapOf("0" to money(left)))
            } else {
                tr("Il risparmio va agli obiettivi nell'ordine che scegli; ne avanzano {0} al mese.", mapOf("0" to money(left)))
            }
            else -> tr("Il risparmio va agli obiettivi nell'ordine che scegli.")
        }
        return GoalsCapacityHeader(
            title = if (capacity <= 0) tr("In questo periodo hai speso più di quanto hai incassato.") else tr("Metti da parte {0} al mese.", mapOf("0" to money(capacity))),
            requested = if (view.requested > 0) tr("I tuoi obiettivi ne chiedono {0}.", mapOf("0" to money(view.requested))) else null,
            explanation = explanation, segments = segments, scaleMax = max(capacity, 0.0) + view.gap,
        )
    }

    /** Bar segment text: «{name} {amount}» or «−{gap}». */
    fun segmentText(s: GoalsBarSegment): String = if (s.dashed) "−" + money(s.value) else "${s.label} ${money(s.value)}"

    /** GOAL-011: sentence of the «Smettere di lavorare» row. */
    fun fireSentence(fire: GoalsView.Fire): String {
        val with = fire.withGoalsYear ?: return tr("Il traguardo delle Analitiche: al ritmo di oggi non ci arrivi entro 50 anni.")
        val base = fire.baseYear
        if (base != null && base != with) {
            return tr("Il traguardo delle Analitiche: ci arrivi nel {0} con i tuoi obiettivi, nel {1} senza.", mapOf("0" to with.toString(), "1" to base.toString()))
        }
        return tr("Il traguardo delle Analitiche: ci arrivi nel {0}.", mapOf("0" to with.toString()))
    }

    /** GOAL-012: stops sorted by date; empty when fewer than 2. */
    fun road(view: GoalsView): kotlin.collections.List<GoalsRoadStop> {
        val stops = view.goals.filter { it.etaMonth != null && it.status != "raggiunto" }.map { g ->
            val kind = GoalKind.fromKey(g.kind) ?: GoalKind.ALTRO
            GoalsRoadStop(g.id, month(g.etaMonth!!), g.etaMonth, g.name, kind.iconKey, kind.colorToken)
        }.toMutableList()
        view.fire?.withGoalsYear?.let { year ->
            stops += GoalsRoadStop("fire", year.toString(), "$year-12", tr("Smetti di lavorare"), GoalsRules.FIRE_ICON_KEY, GoalsRules.FIRE_COLOR_TOKEN)
        }
        if (stops.size < 2) return emptyList()
        return stops.sortedBy { it.sort }
    }

    /** GOAL-027: source row detail («{0} dei {1} sul conto», «… della posizione · imposta stimata {2}», short warning). */
    fun sourceDetail(s: GoalSourceView): String {
        val base = if (s.kind == "account") {
            tr("{0} dei {1} sul conto", mapOf("0" to money(s.amount), "1" to money(s.total)))
        } else {
            tr("{0} dei {1} della posizione · imposta stimata {2}", mapOf("0" to money(s.amount), "1" to money(s.total), "2" to money(s.tax)))
        }
        return if (s.short) base + " · " + tr("oggi ne trovi solo una parte") else base
    }

    /** GOAL-027: «di {target} · entro {mese anno}» / «di {target}». */
    fun targetLine(goal: GoalView): String =
        goal.targetDate?.let { tr("di {0} · entro {1}", mapOf("0" to money(goal.target), "1" to month(it))) } ?: tr("di {0}", mapOf("0" to money(goal.target)))

    /** GOAL-028: wealth impact (value, caption). */
    fun wealthImpact(goal: GoalView): Pair<String, String> {
        if ((GoalKind.fromKey(goal.kind) ?: GoalKind.ALTRO).isKept) return money(0.0) to tr("i soldi restano tuoi, da parte")
        return ("−" + money(goal.target)) to (goal.etaMonth?.let { tr("escono a {0}", mapOf("0" to month(it))) } ?: tr("escono quando lo raggiungi"))
    }

    /** Step quanto note (GOAL-016). */
    fun requiredNote(draft: GoalDraft, todayKey: String, capacity: GoalsFormCapacity?): String? {
        val m = draft.targetMonth ?: return null
        val required = GoalWizard.requiredMonthly(draft, todayKey) ?: return null
        var text = tr("Per arrivare a {0} servono {1} al mese.", mapOf("0" to month(m), "1" to money(required)))
        if (capacity != null) {
            text += " " + tr("Metti da parte {0} al mese, di cui {1} già presi dagli altri obiettivi.", mapOf("0" to money(capacity.total), "1" to money(capacity.taken)))
        }
        return text
    }

    /** Step riepilogo rows (GOAL-022). */
    fun summaryRows(draft: GoalDraft): kotlin.collections.List<Pair<String, String>> = listOf(
        tr("Quanto") to money(draft.target ?: 0.0),
        tr("Entro") to (draft.targetMonth?.let(::month) ?: tr("Nessuna data")),
        tr("Già da parte") to (if (draft.sources.isEmpty()) tr("Niente, parti da zero") else money(GoalWizard.assignedTotal(draft))),
        tr("Ogni mese") to money(draft.monthly ?: 0.0),
    )

    /** «Da: Conto deposito 1.500 €, …». */
    fun summarySources(draft: GoalDraft, names: Map<String, String>): String? {
        if (draft.sources.isEmpty()) return null
        return tr("Da: {0}", mapOf("0" to draft.sources.joinToString(", ") { "${names[it.key] ?: ""} ${money(it.amount)}" }))
    }
}

/** Goals list state. Same fields as `GoalsUiState` on iOS. */
data class GoalsUiState(
    val view: GoalsView? = null,
    val failed: Boolean = false,
    val unavailable: Boolean = false,
    val reordering: Boolean = false,
    /** Time of the last successful load in ms (5-minute reuse, GOAL-004). */
    val loadedAt: Long? = null,
) {
    val gate: GoalsGate
        get() = when {
            unavailable -> GoalsGate.UNAVAILABLE
            view == null -> if (failed) GoalsGate.FAILED else GoalsGate.LOADING
            view.goals.isEmpty() -> GoalsGate.EMPTY
            else -> GoalsGate.CONTENT
        }

    fun isFresh(nowMs: Long): Boolean {
        val at = loadedAt ?: return false
        return view != null && nowMs - at < CACHE_MS
    }

    companion object {
        const val CACHE_MS = 300_000L
    }
}
