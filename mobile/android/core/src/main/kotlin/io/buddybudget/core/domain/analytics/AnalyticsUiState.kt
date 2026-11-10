package io.buddybudget.core.domain.analytics

import io.buddybudget.core.data.AnalyticsAssumptionsPatch
import io.buddybudget.core.domain.periods.DateKeyRange
import io.buddybudget.core.data.AnalyticsBase
import io.buddybudget.core.data.AnalyticsView
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.domain.costs.CostDragPoint
import io.buddybudget.core.domain.costs.CostSummary
import io.buddybudget.core.domain.costs.CostsCalc
import io.buddybudget.core.domain.fire.FireAssumptionLimits
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireCalc
import io.buddybudget.core.domain.fire.FireExpectedReturnInfo
import io.buddybudget.core.domain.fire.FireFigureSource
import io.buddybudget.core.domain.fire.FireGrowthInput
import io.buddybudget.core.domain.fire.FireLimit
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.FirePlanning
import io.buddybudget.core.domain.fire.FireRetireAt
import io.buddybudget.core.domain.fire.FireReturnSource
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.fire.FireSensitivityCell
import io.buddybudget.core.domain.fire.FireSliderSpec
import io.buddybudget.core.domain.fire.MonteCarloInput
import io.buddybudget.core.domain.fire.MonteCarloPublicPension
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.overview.CatalogText
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.DataPeriod
import io.buddybudget.core.domain.periods.Periods
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

// Analitiche «Risposte» state and rules (spec: features/11-analytics.md). The server sends the saved assumptions and
// the data base (`GET /api/analytics/base`); every slider move re-runs `FirePlanning.resolvePlan` on the device, Monte
// Carlo runs off the main thread with the web's seed. Same names on iOS (`AnalyticsUiState.swift`).

/** What the Risposte screen shows (shared "view gate"). */
enum class AnalyticsGate { LOADING, FAILED, UNAVAILABLE, CONTENT }

/** Data-period picker choice (ANA-011). */
enum class AnalyticsPeriodChoice(val key: String) {
    TWELVE("12"), TWENTY_FOUR("24"), CUSTOM("personalizzato");

    val label: String
        get() = when (this) {
            TWELVE -> "12 mesi"
            TWENTY_FOUR -> "24 mesi"
            CUSTOM -> "Scegli i mesi"
        }

    companion object {
        fun of(period: DataPeriod): AnalyticsPeriodChoice = when (period) {
            is DataPeriod.Personalizzato -> CUSTOM
            is DataPeriod.Ultimi -> if (period.months == 24) TWENTY_FOUR else TWELVE
        }
    }
}

/** One point of the «Quando arrivi» chart. */
data class AnalyticsTimelinePoint(val year: Int, val wealth: Double)

/** A sensitivity table (rows × columns of years to FIRE, the user's cell in the middle). */
data class AnalyticsSensitivityTable(val rows: List<String>, val columns: List<String>, val cells: List<List<FireSensitivityCell>>)

/** A translated validation message. */
data class AnalyticsMessage(val text: String)

/** Result of a validation: the value or the message. */
sealed interface AnalyticsValidation<out T> {
    data class Ok<T>(val value: T) : AnalyticsValidation<T>
    data class Error<E>(val error: E) : AnalyticsValidation<Nothing>
}

object AnalyticsRules {
    /** `MIN_INVESTED_FOR_ESTIMATE`. */
    const val MIN_INVESTED_FOR_ESTIMATE = 1000.0
    /** Years over which costs erode the portfolio (`COST_DRAG_YEARS`). */
    const val COST_DRAG_YEARS = 30
    const val TIMELINE_EXTRA_YEARS = 3
    const val TIMELINE_MAX_YEARS = 60
    const val TIMELINE_DEFAULT_YEARS = 30
    /** Custom period: 3 months to 10 years (`CUSTOM_PERIOD_LIMITS`). */
    const val CUSTOM_PERIOD_MIN_MONTHS = 3
    const val CUSTOM_PERIOD_MAX_MONTHS = 120
    /** Years offered in the custom period selects. */
    const val PERIOD_YEARS_BACK = 10
    private val rateSteps = listOf(-0.01, -0.005, 0.0, 0.005, 0.01)
    private val returnSteps = listOf(-0.02, -0.01, 0.0, 0.01, 0.02)
    private val spendingChanges = listOf(-0.2, -0.1, 0.0, 0.1, 0.2)
    private val savingChanges = listOf(-0.2, -0.1, 0.0, 0.1, 0.2)

    /** Integer as text («40»). */
    fun intText(value: Double): String = JSNumber.round(value).toLong().toString()

    /** `RULE_LABELS` (Italian source). */
    fun ruleLabel(rule: WithdrawalRule): String = when (rule) {
        WithdrawalRule.FISSA -> "Fissa (stessa spesa ogni anno)"
        WithdrawalRule.PERCENTUALE -> "Percentuale del patrimonio"
        WithdrawalRule.GUYTON_KLINGER -> "Guyton-Klinger (semplificata)"
        WithdrawalRule.VANGUARD -> "Vanguard dinamica"
    }

    /** Glossary id of each rule chip. */
    fun ruleTerm(rule: WithdrawalRule): String = when (rule) {
        WithdrawalRule.FISSA -> "regola-fissa"
        WithdrawalRule.PERCENTUALE -> "regola-percentuale"
        WithdrawalRule.GUYTON_KLINGER -> "regola-gk"
        WithdrawalRule.VANGUARD -> "regola-vanguard"
    }

    // MARK: Sliders (ANA-014…019)

    /** Starting value of a slider: plan figures for money, assumptions for rates. */
    fun baseline(field: FireScenarioField, plan: FirePlan, assumptions: FireAssumptions): Double? = when (field) {
        FireScenarioField.ANNUAL_SAVINGS -> plan.savings
        FireScenarioField.ANNUAL_SPENDING -> plan.spending
        FireScenarioField.EXPECTED_RETURN -> assumptions.expectedReturn
        FireScenarioField.WITHDRAWAL_RATE -> assumptions.withdrawalRate
    }

    /** Value set by a slider move: back onto the baseline (within half a step) clears the override. */
    fun override(value: Double, baseline: Double?, spec: FireSliderSpec): Double? =
        if (abs(value - (baseline ?: value)) < spec.step / 2) null else value

    /** Snaps a slider position to its step. */
    fun snap(value: Double, spec: FireSliderSpec): Double {
        val steps = JSNumber.round((value - spec.min) / spec.step)
        val snapped = spec.min + steps * spec.step
        return min(max(JSNumber.round(snapped * 1e9) / 1e9, spec.min), spec.max)
    }

    fun overrides(o: FireScenarioOverrides, field: FireScenarioField, value: Double?): FireScenarioOverrides = when (field) {
        FireScenarioField.ANNUAL_SAVINGS -> o.copy(annualSavings = value)
        FireScenarioField.ANNUAL_SPENDING -> o.copy(annualSpending = value)
        FireScenarioField.EXPECTED_RETURN -> o.copy(expectedReturn = value)
        FireScenarioField.WITHDRAWAL_RATE -> o.copy(withdrawalRate = value)
    }

    fun value(o: FireScenarioOverrides, field: FireScenarioField): Double? = when (field) {
        FireScenarioField.ANNUAL_SAVINGS -> o.annualSavings
        FireScenarioField.ANNUAL_SPENDING -> o.annualSpending
        FireScenarioField.EXPECTED_RETURN -> o.expectedReturn
        FireScenarioField.WITHDRAWAL_RATE -> o.withdrawalRate
    }

    /** Years to FIRE with only this field moved (the delta under a slider, ANA-015). */
    fun yearsWithField(field: FireScenarioField, value: Double, plan: FirePlan, assumptions: FireAssumptions): Double? =
        FirePlanning.yearsToFireWith(plan, assumptions, overrides(FireScenarioOverrides(), field, value))

    /** ANA-016: «Usa il tuo ({x}%)» offer when the return was written by hand and a history exists. */
    fun historyOffer(info: FireExpectedReturnInfo): Double? {
        val real = info.historyReal
        if (info.source != FireReturnSource.MANUALE || real == null) return null
        val lim = FireAssumptionLimits.expectedReturn
        return min(max(real, lim.min), lim.max)
    }

    // MARK: Data period (ANA-011…013)

    /** Default custom range: the last 12 complete months. */
    fun defaultCustomRange(today: CalendarDate): Pair<String, String> {
        val lastFull = today.plusMonthsOverflow(-1)
        return lastFull.plusMonthsOverflow(-11).monthKey to lastFull.monthKey
    }

    /** Years in the custom selects: this year and the 10 before. */
    fun pickerYears(today: CalendarDate): List<Int> = (0..PERIOD_YEARS_BACK).map { today.year - it }

    /** ANA-012: validation message (Italian source + values), null when valid. */
    fun customPeriodError(from: String, to: String, today: CalendarDate): CatalogText? {
        val span = Periods.monthSpan(from, to)
        if (to > today.plusMonthsOverflow(-1).monthKey) return CatalogText("Il mese in corso non è finito: fermati al mese scorso.")
        if (span < CUSTOM_PERIOD_MIN_MONTHS) return CatalogText("Scegli almeno {0} mesi.", mapOf("0" to CUSTOM_PERIOD_MIN_MONTHS.toString()))
        if (span > CUSTOM_PERIOD_MAX_MONTHS) return CatalogText("Scegli al massimo 10 anni.")
        return null
    }

    // MARK: Charts and tables

    /** «Quando arrivi»: wealth year by year up to a little past the target (`timelineSeries`). */
    fun timelineSeries(plan: FirePlan, a: FireAssumptions): List<AnalyticsTimelinePoint> {
        val horizon = plan.yearsToFire?.let { min(ceil(it).toInt() + TIMELINE_EXTRA_YEARS, TIMELINE_MAX_YEARS) } ?: TIMELINE_DEFAULT_YEARS
        val growth = FireGrowthInput(plan.wealth, plan.savings ?: 0.0, a.expectedReturn)
        return (0..horizon).map { AnalyticsTimelinePoint(it, max(0.0, FireCalc.wealthAfterYears(growth, it.toDouble()))) }
    }

    /** Sensitivity by withdrawal rate (rows) × real return (columns). */
    fun rateSensitivity(plan: FirePlan, a: FireAssumptions, text: AnalyticsText): AnalyticsSensitivityTable? {
        val spending = plan.spending ?: return null
        val rates = rateSteps.map { max(a.withdrawalRate + it, 0.01) }
        val returns = returnSteps.map { a.expectedReturn + it }
        val cells = FireCalc.sensitivityByRateAndReturn(spending, plan.wealth, plan.savings ?: 0.0, rates, returns)
        return AnalyticsSensitivityTable(rates.map { text.pct(it) }, returns.map { text.pct(it) }, cells)
    }

    /** Sensitivity by spending change (rows) × saving change (columns). */
    fun spendingSensitivity(plan: FirePlan, a: FireAssumptions, text: AnalyticsText): AnalyticsSensitivityTable? {
        val spending = plan.spending ?: return null
        val cells = FireCalc.sensitivityBySpendingAndSaving(
            spending, a.withdrawalRate, a.expectedReturn, plan.wealth, plan.savings ?: 0.0, spendingChanges, savingChanges,
        )
        return AnalyticsSensitivityTable(spendingChanges.map(text::signedPct), savingChanges.map(text::signedPct), cells)
    }

    /** Cell text: «—» beyond 80 years, «ok» reached, else «12,3 a». */
    fun cellText(cell: FireSensitivityCell, text: AnalyticsText): String {
        val years = cell.years ?: return "—"
        if (years == 0.0) return text.tr("ok")
        return text.tr("{0} a", mapOf("0" to BBFormat.formatRatio(years, text.locale, 1)))
    }

    /** Lean FIRE number (essential + occasional spending only). */
    fun leanNumber(base: AnalyticsBase, a: FireAssumptions): Double? =
        base.cashflow.leanSpending?.let { FireCalc.fireNumber(it, a.withdrawalRate) }

    /**
     * X labels kept by Recharts' `preserveEnd` with `minTickGap`: the last one always, then backwards every label that
     * does not overlap the previous kept one. Label width is estimated (12 pt text, 6.6 pt per character) so both
     * platforms thin the same way.
     */
    fun visibleTicks(labels: List<String>, plotWidth: Double, minTickGap: Double): List<Int> {
        if (labels.isEmpty()) return emptyList()
        val n = labels.size
        fun x(i: Int) = if (n > 1) i * plotWidth / (n - 1) else plotWidth / 2
        fun size(i: Int) = labels[i].length * 6.6
        val kept = mutableListOf(n - 1)
        var edge = x(n - 1) - size(n - 1) / 2
        for (i in n - 2 downTo 0) {
            val right = x(i) + size(i) / 2
            if (right + minTickGap <= edge && x(i) - size(i) / 2 >= -size(i) / 2) {
                kept += i
                edge = x(i) - size(i) / 2
            }
        }
        return kept.reversed()
    }

    /** Y domain of an analytics chart: `[0, auto]` (nice max). */
    fun zeroAutoDomain(values: List<Double>): ClosedFloatingPointRange<Double> {
        val hi = values.maxOrNull() ?: 1.0
        val top = ChartScale.niceTicks(0.0, max(hi, 0.0)).lastOrNull() ?: hi
        return 0.0..(if (top > 0) top else 1.0)
    }

    /** `[auto, auto]` (nice min/max). */
    fun autoDomain(values: List<Double>): ClosedFloatingPointRange<Double> {
        val lo = values.minOrNull() ?: return 0.0..1.0
        val hi = values.maxOrNull() ?: return 0.0..1.0
        val ticks = ChartScale.niceTicks(lo, hi)
        val a = ticks.firstOrNull()
        val b = ticks.lastOrNull()
        return if (a == null || b == null || b <= a) (lo - 1)..(hi + 1) else a..b
    }

    /** Horizontal grid lines inside a domain. */
    fun gridLines(domain: ClosedFloatingPointRange<Double>): List<Double> =
        ChartScale.niceTicks(domain.start, domain.endInclusive).filter { it in domain }

    // MARK: Costs (ANA-024, ANA-031)

    fun costs(base: AnalyticsBase, ter: Map<String, Double>, country: String): CostSummary =
        runCatching { CostsCalc.summarizeCosts(base.costPositions(ter), country) }.getOrElse { CostSummary(emptyList(), 0.0, 0.0, null, 0.0) }

    fun drag(summary: CostSummary, expectedReturn: Double): List<CostDragPoint> {
        val pct = summary.annualPct ?: return emptyList()
        return CostsCalc.costDrag(summary.totalValue, expectedReturn, pct, COST_DRAG_YEARS)
    }

    /** TER field texts from the saved values (`toFieldText(ter, true)`). */
    fun terDrafts(ters: Map<String, Double>): Map<String, String> = ters.mapValues { toFieldText(it.value, percent = true) }

    /** ANA-031: every non-empty TER must be 0–5%; the result replaces `terByInstrument`. */
    fun validateTers(drafts: Map<String, String>, positions: List<AnalyticsBase.Position>): AnalyticsValidation<Map<String, Double>> {
        val next = LinkedHashMap<String, Double>()
        for (p in positions) {
            val text = drafts[p.id] ?: continue
            if (JSNumber.trim(text).isEmpty()) continue
            val value = parseNumber(text)
            if (value == null || value < 0 || value > 5) {
                return AnalyticsValidation.Error(CatalogText("Costo di «{0}»: inserisci un valore tra 0% e 5%.", mapOf("0" to p.name)))
            }
            next[p.id] = value / 100
        }
        return AnalyticsValidation.Ok(next)
    }

    // MARK: Number fields (`assumptions-fields.ts`)

    /** Italian-style number ("3,5", "1.250,5"); null when empty or invalid. */
    fun parseNumber(text: String): Double? {
        val chars = JSNumber.trim(text).filter { !it.isWhitespace() }
        val out = StringBuilder()
        for (i in chars.indices) {
            val c = chars[i]
            if (c == '.') {
                val next = chars.substring(i + 1)
                val digits = next.take(3)
                if (digits.length == 3 && digits.all { it in '0'..'9' } && (next.length == 3 || next[3] !in '0'..'9')) continue
            }
            out.append(c)
        }
        val s = out.toString().replaceFirst(",", ".")
        if (s.isEmpty()) return null
        val value = JSNumber.parse(s) ?: return null
        return if (value.isFinite()) value else null
    }

    /** Number as an Italian field text ("0,035" → "3,5" when [percent]). */
    fun toFieldText(value: Double?, percent: Boolean): String {
        if (value == null) return ""
        val shown = if (percent) JSNumber.round(value * 10000) / 100 else JSNumber.round(value)
        return jsString(shown).replace(".", ",")
    }

    internal fun jsString(value: Double): String =
        if (value == Math.rint(value) && abs(value) < 1e15) value.roundToLong().toString() else value.toString()

    // MARK: Glossary (`GlossedText`)

    private val glossaryPattern: Regex by lazy {
        val phrases = AnalyticsContent.glossary.flatMap { it.match }.sortedByDescending { it.length }
        Regex(
            "(?<![\\p{L}\\p{N}])(${phrases.joinToString("|") { Regex.escape(it) }})(?![\\p{L}\\p{N}])",
            setOf(RegexOption.IGNORE_CASE),
        )
    }

    private val idByPhrase: Map<String, String> by lazy {
        val map = LinkedHashMap<String, String>()
        for (entry in AnalyticsContent.glossary) for (phrase in entry.match) map.putIfAbsent(phrase, entry.id)
        map
    }

    fun glossed(text: String): List<AnalyticsTextPart> {
        val parts = mutableListOf<AnalyticsTextPart>()
        val seen = HashSet<String>()
        var last = 0
        for (m in glossaryPattern.findAll(text)) {
            val group = m.groups[1] ?: continue
            val id = idByPhrase[group.value.lowercase()] ?: continue
            if (!seen.add(id)) continue
            if (group.range.first > last) parts += AnalyticsTextPart.Text(text.substring(last, group.range.first))
            parts += AnalyticsTextPart.Term(id, group.value)
            last = group.range.last + 1
        }
        if (last < text.length) parts += AnalyticsTextPart.Text(text.substring(last))
        return parts
    }
}

// MARK: - «Tutte le ipotesi» (ANA-033, ANA-034)

/** Form state of «Tutte le ipotesi» (`AssumptionsPanel`): texts as typed, validated on save into a partial update. */
data class AnalyticsAssumptionsDraft(
    val percents: Map<PercentField, String>,
    /** True = on save the return follows the history again. */
    val returnAuto: Boolean,
    val years: String,
    val spending: String,
    val savings: String,
    val rule: WithdrawalRule,
    val includePension: Boolean,
    val includeTax: Boolean,
    val pensionAnnual: String,
    val pensionAfter: String,
    val initialExpectedReturn: String,
) {
    enum class PercentField(val key: String) {
        WITHDRAWAL_RATE("withdrawalRate"), EXPECTED_RETURN("expectedReturn"), VOLATILITY("volatility"), INFLATION("inflation");

        val label: String
            get() = when (this) {
                WITHDRAWAL_RATE -> "Tasso di prelievo"
                EXPECTED_RETURN -> "Rendimento reale atteso"
                VOLATILITY -> "Volatilità annua"
                INFLATION -> "Inflazione attesa"
            }

        val hint: String
            get() = when (this) {
                WITHDRAWAL_RATE ->
                    "Quanto del capitale prelevi il primo anno di pensione. 4% è la regola storica americana; per un orizzonte lungo e per l'Europa si ragiona su valori più prudenti (3-3,5%)."
                EXPECTED_RETURN ->
                    "Rendimento annuo del portafoglio al netto dell'inflazione. Un portafoglio azionario globale ha reso storicamente circa 4-5% reale, ma non è una promessa: nel dubbio scendi."
                VOLATILITY ->
                    "Quanto oscillano i rendimenti da un anno all'altro. Circa 15% per un portafoglio quasi tutto azionario, 8-10% per uno bilanciato. Nella scheda Rischio vedi quella osservata sul tuo."
                INFLATION -> "Serve solo a una regola di prelievo (Guyton-Klinger). Tutto il resto è già in euro di oggi."
            }

        val limits: FireLimit
            get() = when (this) {
                WITHDRAWAL_RATE -> FireAssumptionLimits.withdrawalRate
                EXPECTED_RETURN -> FireAssumptionLimits.expectedReturn
                VOLATILITY -> FireAssumptionLimits.volatility
                INFLATION -> FireAssumptionLimits.inflation
            }
    }

    /** Typing in a percent field; the return field stops following the history. */
    fun set(field: PercentField, text: String): AnalyticsAssumptionsDraft =
        copy(percents = percents + (field to text), returnAuto = if (field == PercentField.EXPECTED_RETURN) false else returnAuto)

    /** «Usa il tuo rendimento ({x}%)». */
    fun useHistory(offer: Double): AnalyticsAssumptionsDraft =
        copy(percents = percents + (PercentField.EXPECTED_RETURN to AnalyticsRules.toFieldText(offer, percent = true)), returnAuto = true)

    /** ANA-034: «Ripristina i valori consigliati» (TERs kept; applied only on save). */
    fun resetToDefaults(info: FireExpectedReturnInfo): AnalyticsAssumptionsDraft {
        val d = FireAssumptions.defaults
        val manual = info.source == FireReturnSource.MANUALE
        val texts = percentTexts(d).toMutableMap()
        texts[PercentField.EXPECTED_RETURN] =
            if (manual) AnalyticsRules.toFieldText(AnalyticsRules.historyOffer(info) ?: d.expectedReturn, percent = true) else initialExpectedReturn
        return copy(
            percents = texts, returnAuto = manual, years = AnalyticsRules.jsString(d.retirementYears), spending = "", savings = "",
            rule = d.rule, includePension = d.includePensionFunds, includeTax = d.includeLatentTax, pensionAnnual = "", pensionAfter = "",
        )
    }

    /** ANA-033: validates and builds the partial update; the error is a translated message. */
    fun submit(text: AnalyticsText): AnalyticsValidation<AnalyticsAssumptionsPatch> {
        var patch = AnalyticsAssumptionsPatch()
        for (field in PercentField.entries) {
            val lim = field.limits
            val value = AnalyticsRules.parseNumber(percents[field] ?: "")
            if (value == null || value / 100 < lim.min || value / 100 > lim.max) {
                return AnalyticsValidation.Error(
                    AnalyticsMessage(
                        text.tr("{0}: inserisci un valore tra {1} e {2}.", mapOf("0" to text.tr(field.label), "1" to text.pct(lim.min), "2" to text.pct(lim.max))),
                    ),
                )
            }
            patch = patch.with(field.key, AnalyticsAssumptionsPatch.Value.Number(value / 100))
        }
        if (returnAuto) {
            patch = patch.with("expectedReturn", null).with("expectedReturnAuto", AnalyticsAssumptionsPatch.Value.Bool(true))
        } else if (percents[PercentField.EXPECTED_RETURN] == initialExpectedReturn) {
            patch = patch.with("expectedReturn", null)
        }
        val lim = FireAssumptionLimits.retirementYears
        val y = AnalyticsRules.parseNumber(years)
        if (y == null || y != Math.rint(y) || y < lim.min || y > lim.max) {
            return AnalyticsValidation.Error(
                AnalyticsMessage(
                    text.tr("Anni di pensione: inserisci un numero intero tra {0} e {1}.", mapOf("0" to AnalyticsRules.intText(lim.min), "1" to AnalyticsRules.intText(lim.max))),
                ),
            )
        }
        patch = patch.with("retirementYears", AnalyticsAssumptionsPatch.Value.Number(y))
        patch = patch.with("annualSpending", AnalyticsRules.parseNumber(spending)?.let { AnalyticsAssumptionsPatch.Value.Number(it) } ?: AnalyticsAssumptionsPatch.Value.Null)
        patch = patch.with("annualSavings", AnalyticsRules.parseNumber(savings)?.let { AnalyticsAssumptionsPatch.Value.Number(it) } ?: AnalyticsAssumptionsPatch.Value.Null)
        val annual = AnalyticsRules.parseNumber(pensionAnnual)
        patch = if (annual != null && annual > 0) {
            val after = max(0.0, JSNumber.round(AnalyticsRules.parseNumber(pensionAfter) ?: 0.0))
            patch.with("publicPension", AnalyticsAssumptionsPatch.Value.Pension(MonteCarloPublicPension(annual, after)))
        } else {
            patch.with("publicPension", AnalyticsAssumptionsPatch.Value.Pension(null))
        }
        patch = patch.with("rule", AnalyticsAssumptionsPatch.Value.Text(rule.key))
            .with("includePensionFunds", AnalyticsAssumptionsPatch.Value.Bool(includePension))
            .with("includeLatentTax", AnalyticsAssumptionsPatch.Value.Bool(includeTax))
        return AnalyticsValidation.Ok(patch)
    }

    companion object {
        fun percentTexts(a: FireAssumptions): Map<PercentField, String> = mapOf(
            PercentField.WITHDRAWAL_RATE to AnalyticsRules.toFieldText(a.withdrawalRate, percent = true),
            PercentField.EXPECTED_RETURN to AnalyticsRules.toFieldText(a.expectedReturn, percent = true),
            PercentField.VOLATILITY to AnalyticsRules.toFieldText(a.volatility, percent = true),
            PercentField.INFLATION to AnalyticsRules.toFieldText(a.inflation, percent = true),
        )

        fun of(a: FireAssumptions): AnalyticsAssumptionsDraft {
            val percents = percentTexts(a)
            return AnalyticsAssumptionsDraft(
                percents = percents, returnAuto = false, years = AnalyticsRules.jsString(a.retirementYears),
                spending = AnalyticsRules.toFieldText(a.annualSpending, percent = false),
                savings = AnalyticsRules.toFieldText(a.annualSavings, percent = false), rule = a.rule,
                includePension = a.includePensionFunds, includeTax = a.includeLatentTax,
                pensionAnnual = AnalyticsRules.toFieldText(a.publicPension?.annual, percent = false),
                pensionAfter = a.publicPension?.let { AnalyticsRules.jsString(it.startsAfterYears) } ?: "",
                initialExpectedReturn = percents[PercentField.EXPECTED_RETURN] ?: "",
            )
        }
    }
}

// MARK: - «Il tuo traguardo» (ANA-007, ANA-008)

data class AnalyticsGoalDraft(val text: String, val dataSpending: Double?) {
    val value: Double? get() = AnalyticsRules.parseNumber(text)
    val isValid: Boolean get() = value?.let { it > 0 && it <= FireAssumptionLimits.amount.max } ?: false

    /** Equal to the data-derived figure → saved as `null` (stays linked to the data). */
    val followsData: Boolean
        get() {
            val d = dataSpending ?: return false
            val v = value ?: return false
            return JSNumber.round(v) == JSNumber.round(d)
        }

    /** Live preview of target and arrival year. */
    fun preview(base: AnalyticsBase, assumptions: FireAssumptions): FirePlan? {
        val v = value ?: return null
        if (!isValid) return null
        return FirePlanning.resolvePlan(base.planBase, assumptions.copy(annualSpending = v))
    }

    /** `PUT` body, or null when invalid («Scrivi quanto ti serve in un anno, per esempio 24.000.»). */
    val patch: AnalyticsAssumptionsPatch?
        get() = if (!isValid) null else AnalyticsAssumptionsPatch.annualSpending(if (followsData) null else value)

    companion object {
        /** Prefilled with the current spending, Italian grouping like the web (the field parses Italian numbers). */
        fun of(plan: FirePlan) = AnalyticsGoalDraft(
            text = plan.spending?.let { BBFormat.formatNumber(JSNumber.round(it), BBLocale.IT_IT, 0, 0) } ?: "",
            dataSpending = if (plan.spendingSource == FireFigureSource.DATI) plan.spending else null,
        )
    }
}

// MARK: - Screen state

/** Risposte state: the view, the sliders being tried and the derived plans. Same fields as `AnalyticsUiState` on iOS. */
data class AnalyticsUiState(
    val view: AnalyticsView? = null,
    val failed: Boolean = false,
    val unavailable: Boolean = false,
    val overrides: FireScenarioOverrides = FireScenarioOverrides(),
    val selected: AnalyticsQuestion = AnalyticsQuestion.QUANDO,
    /** «Per esperti» panels opened (collapsed by default, ANA-026). */
    val expertOpen: Set<AnalyticsQuestion> = emptySet(),
    val saving: Boolean = false,
    val saveError: String? = null,
    /** The period picker shows the custom selects (local until «Usa questi mesi»). */
    val periodChoice: AnalyticsPeriodChoice? = null,
    val customFrom: String = "",
    val customTo: String = "",
    /** Expert simulation: retire today or at the FIRE target (ANA-029). */
    val retireAt: FireRetireAt = FireRetireAt.OGGI,
    /** Rule selected in the rules table. */
    val withdrawalRule: WithdrawalRule? = null,
) {
    val gate: AnalyticsGate
        get() = when {
            unavailable -> AnalyticsGate.UNAVAILABLE
            view == null -> if (failed) AnalyticsGate.FAILED else AnalyticsGate.LOADING
            else -> AnalyticsGate.CONTENT
        }

    val today: CalendarDate get() = view?.let { CalendarDate.parse(it.today) } ?: CalendarDate(2026, 1, 1)

    /** Saved plan (assumptions in use, i.e. return from history when automatic). */
    val savedPlan: FirePlan? get() = view?.let { FirePlanning.resolvePlan(it.base.planBase, it.assumptions) }

    val hasScenario: Boolean get() = FirePlanning.hasScenario(overrides)

    /** Assumptions with the slider values on top. */
    val scenarioAssumptions: FireAssumptions? get() = view?.let { FirePlanning.applyScenario(it.assumptions, overrides) }

    val scenarioPlan: FirePlan?
        get() {
            val v = view ?: return null
            val a = scenarioAssumptions ?: return null
            return if (hasScenario) FirePlanning.resolvePlan(v.base.planBase, a) else savedPlan
        }

    val period: DataPeriod get() = view?.assumptions?.dataPeriod ?: DataPeriod.Ultimi(12)

    /** Choice shown by the segmented control. */
    val shownPeriodChoice: AnalyticsPeriodChoice get() = periodChoice ?: AnalyticsPeriodChoice.of(period)

    /** Opens the custom selects with the saved custom range or the last 12 complete months. */
    fun choosingCustomPeriod(): AnalyticsUiState {
        val p = period
        if (p is DataPeriod.Personalizzato) return copy(periodChoice = AnalyticsPeriodChoice.CUSTOM, customFrom = p.from, customTo = p.to)
        val (from, to) = AnalyticsRules.defaultCustomRange(today)
        return copy(periodChoice = AnalyticsPeriodChoice.CUSTOM, customFrom = from, customTo = to)
    }

    /** ANA-013 month calendar (`PeriodSelector`, #408): the range it opens on (saved custom range, else the last 12
     *  complete months) and its bounds (10 years back from January, up to the last complete month). */
    val customPeriodRange: DateKeyRange
        get() {
            val p = period
            if (p is DataPeriod.Personalizzato) return DateKeyRange(p.from, p.to)
            val (from, to) = AnalyticsRules.defaultCustomRange(today)
            return DateKeyRange(from, to)
        }

    val customPeriodMin: String get() = "%04d-01".format(today.year - AnalyticsRules.PERIOD_YEARS_BACK)

    val customPeriodMax: String get() = today.plusMonthsOverflow(-1).monthKey

    /** ANA-012 message for the current selects. */
    val customError: CatalogText? get() = AnalyticsRules.customPeriodError(customFrom, customTo, today)

    val customUnchanged: Boolean
        get() = (period as? DataPeriod.Personalizzato)?.let { it.from == customFrom && it.to == customTo } ?: false

    /** Slider move (ANA-014): values back on the baseline clear the override. */
    fun moving(field: FireScenarioField, value: Double): AnalyticsUiState {
        val plan = savedPlan ?: return this
        val v = view ?: return this
        val baseline = AnalyticsRules.baseline(field, plan, v.assumptions)
        val spec = FirePlanning.scenarioSlider(field, baseline) ?: return this
        val snapped = AnalyticsRules.snap(value, spec)
        return copy(overrides = AnalyticsRules.overrides(overrides, field, AnalyticsRules.override(snapped, baseline, spec)))
    }

    /** Simulation input of the «Regge» answer (retire today, the saved rule and the compare over the four rules). */
    val simulationInput: MonteCarloInput?
        get() {
            val plan = scenarioPlan ?: return null
            val a = scenarioAssumptions ?: return null
            return FirePlanning.buildSimulationInput(plan, a, FireRetireAt.OGGI)
        }

    /** Input of the expert simulation with the retire-at toggle. */
    val expertSimulationInput: MonteCarloInput?
        get() {
            val plan = scenarioPlan ?: return null
            val a = scenarioAssumptions ?: return null
            return FirePlanning.buildSimulationInput(plan, a, retireAt)
        }
}
