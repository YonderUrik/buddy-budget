package io.buddybudget.core.domain.goals

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.Periods

/** Goal kinds (web `GOAL_KINDS`). */
enum class GoalKind(val key: String) {
    EMERGENZA("emergenza"), VIAGGIO("viaggio"), CASA("casa"), ACQUISTO("acquisto"), ALTRO("altro");

    /** Name proposed when the kind is picked (`GOAL_KIND_INFO[kind].defaultName`): an Italian catalog source key, "" = none. */
    val defaultName: String
        get() = when (this) {
            EMERGENZA -> "Fondo di emergenza"
            VIAGGIO -> "Viaggio"
            CASA -> "Anticipo casa"
            ACQUISTO, ALTRO -> ""
        }

    companion object {
        fun fromKey(key: String): GoalKind? = entries.firstOrNull { it.key == key }
    }
}

enum class GoalFormStep(val key: String) { TIPO("tipo"), QUANTO("quanto"), FONTI("fonti"), RITMO("ritmo"), RIEPILOGO("riepilogo") }

enum class GoalSourceKind(val key: String) { ACCOUNT("account"), INSTRUMENT("instrument") }

object GoalConstants {
    val EMERGENCY_MONTH_CHOICES = listOf(3, 6, 12)
    const val DEFAULT_EMERGENCY_MONTHS = 6
    const val MAX_GOALS = 20
    const val MAX_GOAL_SOURCES = 12
}

/** A key/amount pair of the draft's sources; an ordered list mirrors JS object insertion order. */
data class GoalDraftSource(val key: String, val amount: Double)

/** Wizard draft (web `GoalDraft`). */
data class GoalDraft(
    val kind: GoalKind? = null,
    val name: String = "",
    val target: Double? = null,
    val emergencyMonths: Int? = null,
    /** `YYYY-MM` or null. */
    val targetMonth: String? = null,
    val monthly: Double? = null,
    /** Assigned amounts per `account:id` / `instrument:id`, in insertion order. */
    val sources: List<GoalDraftSource> = emptyList(),
    val priority: Int = 0,
    /** GOAL-017 (web #382): monthly spending typed for the emergency fund; null = the one computed from the movements. */
    val monthlySpend: Double? = null,
) {
    /** JS object semantics: setting an existing key keeps its position. */
    fun setSource(key: String, amount: Double): GoalDraft {
        val i = sources.indexOfFirst { it.key == key }
        val next = if (i >= 0) sources.toMutableList().also { it[i] = GoalDraftSource(key, amount) } else sources + GoalDraftSource(key, amount)
        return copy(sources = next)
    }
}

/** Free part of an account / position (web `FreeSource`). */
data class GoalFreeSource(val kind: GoalSourceKind, val id: String, val name: String, val total: Double, val free: Double, val taxPerEuro: Double)

/** Source already assigned to an existing goal (subset of web `GoalSourceView`). */
data class GoalAssignedSource(val kind: GoalSourceKind, val refId: String, val amount: Double, val counted: Double, val tax: Double)

/** Existing goal fields the wizard reads (subset of web `GoalView`). */
data class GoalWizardGoal(
    val kind: GoalKind,
    val name: String,
    val target: Double,
    val targetDate: String?,
    val monthly: Double,
    val priority: Int,
    val sources: List<GoalAssignedSource>,
)

data class GoalPayloadSource(val accountId: String?, val instrumentId: String?, val amount: Double)

/** Body of `POST /api/goals` (web `GoalPayload`). */
data class GoalPayload(
    val name: String,
    val kind: GoalKind,
    val targetAmount: Double,
    val targetDate: String?,
    val monthlyAmount: Double,
    val priority: Int,
    val sources: List<GoalPayloadSource>,
)

/** Goal-creation wizard maths, ported 1:1 from components/domain/goals/goal-form-state.ts. Same as Swift `GoalWizard`. */
object GoalWizard {
    fun sourceKey(kind: GoalSourceKind, id: String): String = "${kind.key}:$id"

    fun initialDraft(goal: GoalWizardGoal?, goalsCount: Int): GoalDraft {
        if (goal == null) return GoalDraft(priority = goalsCount)
        var draft = GoalDraft(
            kind = goal.kind, name = goal.name, target = goal.target, emergencyMonths = null,
            targetMonth = goal.targetDate?.take(7), monthly = goal.monthly, priority = goal.priority,
        )
        for (s in goal.sources) draft = draft.setSource(sourceKey(s.kind, s.refId), s.amount)
        return draft
    }

    /** Changes the kind: proposes the kind's name unless the user typed their own; for "emergenza", months of expenses. */
    fun withKind(draft: GoalDraft, kind: GoalKind, essentialMonthly: Double?): GoalDraft {
        val previousDefault = draft.kind?.defaultName ?: ""
        val name = if (JSNumber.trim(draft.name) == "" || draft.name == previousDefault) kind.defaultName else draft.name
        if (kind == GoalKind.EMERGENZA && draft.target == null) {
            // Without computed spending the months stay chosen: the amount comes when the user types the spending (web #382).
            return draft.copy(
                kind = kind, name = name, emergencyMonths = GoalConstants.DEFAULT_EMERGENCY_MONTHS,
                target = essentialMonthly?.let { emergencyTarget(it, GoalConstants.DEFAULT_EMERGENCY_MONTHS.toDouble()) },
            )
        }
        return draft.copy(kind = kind, name = name, emergencyMonths = if (kind == GoalKind.EMERGENZA) draft.emergencyMonths else null)
    }

    /** GOAL-017: the monthly spending the emergency fund uses — typed by the user, else computed from the movements. */
    fun emergencySpend(draft: GoalDraft, essentialMonthly: Double?): Double? = draft.monthlySpend ?: essentialMonthly

    /** GOAL-017: a months chip; the target follows when a spending figure exists. */
    fun withEmergencyMonths(draft: GoalDraft, months: Int, essentialMonthly: Double?): GoalDraft {
        val spend = emergencySpend(draft, essentialMonthly)
        return if (spend == null) draft.copy(emergencyMonths = months) else draft.copy(emergencyMonths = months, target = emergencyTarget(spend, months.toDouble()))
    }

    /** GOAL-017: `Spese al mese` typed; the target follows with the chosen months. */
    fun withMonthlySpend(draft: GoalDraft, value: Double?): GoalDraft {
        val months = draft.emergencyMonths
        return if (value != null && months != null) draft.copy(monthlySpend = value, target = emergencyTarget(value, months.toDouble()))
        else draft.copy(monthlySpend = value)
    }

    /** GOAL-017: the note under `Spese al mese` (Italian source) by where the figure comes from. */
    fun spendNote(draft: GoalDraft, essentialBasis: String?): String = when {
        draft.monthlySpend != null || essentialBasis == null -> "Scrivi quanto spendi in un mese: la cifra si aggiorna da sola."
        essentialBasis == "dovute" -> "Media delle tue spese dovute e saltuarie degli ultimi mesi (casa, bollette, spesa, rate). Puoi cambiarla."
        else -> "Media di tutte le tue uscite degli ultimi mesi: molte non hanno ancora una categoria, quindi è una stima larga. Puoi cambiarla."
    }

    /** Emergency fund amount: months of essential spending, rounded to hundreds. */
    fun emergencyTarget(essentialMonthly: Double, months: Double): Double = JSNumber.round((essentialMonthly * months) / 100) * 100

    /** Selectable sources with the free part as seen by [goal] (its own share becomes available again). */
    fun availableSources(sources: List<GoalFreeSource>, goal: GoalWizardGoal?): List<GoalFreeSource> {
        val own = LinkedHashMap<String, Double>()
        for (s in goal?.sources.orEmpty()) own[sourceKey(s.kind, s.refId)] = s.counted + s.tax
        return sources.map { it.copy(free = it.free + (own[sourceKey(it.kind, it.id)] ?: 0.0)) }
            .filter { it.total > 0 || own.containsKey(sourceKey(it.kind, it.id)) }
    }

    /** Gross amount assigned in the draft. */
    fun assignedTotal(draft: GoalDraft): Double = draft.sources.fold(0.0) { sum, s -> sum + s.amount }

    /** True when the money already assigned covers the target. */
    fun isCovered(draft: GoalDraft): Boolean {
        val target = draft.target ?: return false
        return target > 0 && assignedTotal(draft) >= target
    }

    /** Monthly amount needed to arrive on time from what is already assigned; null without a date. */
    fun requiredMonthly(draft: GoalDraft, todayKey: String): Double? {
        val targetMonth = draft.targetMonth?.takeIf { it.isNotEmpty() } ?: return null
        val target = draft.target ?: return null
        val left = maxOf(0.0, target - assignedTotal(draft))
        return Math.ceil(left / maxOf(1, Periods.monthsBetween(todayKey, targetMonth)))
    }

    fun canAdvance(step: GoalFormStep, draft: GoalDraft, todayKey: String): Boolean = when (step) {
        GoalFormStep.TIPO -> draft.kind != null && JSNumber.trim(draft.name).length in 1..80
        GoalFormStep.QUANTO -> draft.target != null && draft.target > 0 && (draft.targetMonth == null || draft.targetMonth > todayKey.take(7))
        GoalFormStep.FONTI -> draft.sources.size <= GoalConstants.MAX_GOAL_SOURCES && draft.sources.all { it.amount > 0 }
        GoalFormStep.RITMO -> (draft.monthly != null && draft.monthly >= 0) || isCovered(draft)
        GoalFormStep.RIEPILOGO -> true
    }

    /** Draft ready for the API (the draft must have a kind). */
    fun toPayload(draft: GoalDraft): GoalPayload = GoalPayload(
        name = JSNumber.trim(draft.name),
        kind = draft.kind!!,
        targetAmount = draft.target ?: 0.0,
        targetDate = draft.targetMonth?.takeIf { it.isNotEmpty() }?.let { "$it-01" },
        monthlyAmount = draft.monthly ?: 0.0,
        priority = draft.priority,
        sources = draft.sources.map { s ->
            val parts = s.key.split(":")
            val id = parts.getOrElse(1) { "" }
            if (parts[0] == "account") GoalPayloadSource(id, null, s.amount) else GoalPayloadSource(null, id, s.amount)
        },
    )
}
