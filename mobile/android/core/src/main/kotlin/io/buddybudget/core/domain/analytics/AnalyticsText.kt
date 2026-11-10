package io.buddybudget.core.domain.analytics

import io.buddybudget.core.domain.costs.CostSummary
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireExpectedReturnInfo
import io.buddybudget.core.domain.fire.FireGrowthSplit
import io.buddybudget.core.domain.fire.FireHistoricalReturnResult
import io.buddybudget.core.domain.fire.FireLiquidationResult
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.FirePlanning
import io.buddybudget.core.domain.fire.FireReturnSource
import io.buddybudget.core.domain.fire.MonteCarloResult
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.DataPeriod
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.min

// Analitiche phrasing (web components/domain/analytics/{analytics-format,period-text,plain-answers,return-source,
// scenario-headline,scenario-controls,cashflow-source-note}.ts), bound to one language. `translate` maps an Italian
// catalog key to its template in the app language (identity in tests). Same API on iOS (`AnalyticsText.swift`).
//
// Mobile translates the sentences the web builds with hard-coded Italian (open question 3 of 11-analytics) and fills the
// `{0}` of the metric sub-labels the web leaves unfilled (decision 0003: implement the correct behaviour).

/** A piece of a sentence: plain text or a glossary term (underlined, tap = definition, ANA-032). */
sealed interface AnalyticsTextPart {
    val string: String

    data class Text(override val string: String) : AnalyticsTextPart
    data class Term(val id: String, override val string: String) : AnalyticsTextPart
}

/** The four questions (`ANALYTICS_QUESTIONS`), in reading order. Tab label, title, «Per esperti» hint, icon. */
enum class AnalyticsQuestion(val key: String) {
    DOVE_SONO("dove-sono"), QUANDO("quando"), REGGERA("reggera"), COSTI("costi");

    val label: String
        get() = when (this) {
            DOVE_SONO -> "Strada fatta"
            QUANDO -> "Arrivo"
            REGGERA -> "Regge"
            COSTI -> "Costi"
        }

    val title: String
        get() = when (this) {
            DOVE_SONO -> "Quanta strada ho fatto?"
            QUANDO -> "Quando posso smettere di lavorare?"
            REGGERA -> "Il patrimonio reggerà nel tempo?"
            COSTI -> "Quanto mi costa tenere il portafoglio?"
        }

    val iconKey: String
        get() = when (this) {
            DOVE_SONO -> "trending-up"
            QUANDO -> "calendar-clock"
            REGGERA -> "shield-check"
            COSTI -> "percent"
        }

    companion object {
        /**
         * ANA-035: legacy sub-routes and anchors (`/analitiche/costi` → `#costi`, `/crescita` → `#dove-sono`,
         * `/prelievi|rischio|simulazione` → `#reggera`) select the matching question.
         */
        fun fromPath(path: String): AnalyticsQuestion? {
            val clean = path.substringBefore("?")
            val hash = clean.split("#").getOrNull(1)
            if (hash != null) entries.firstOrNull { it.key == hash }?.let { return it }
            return when (clean.substringBefore("#")) {
                "/analitiche/costi" -> COSTI
                "/analitiche/crescita" -> DOVE_SONO
                "/analitiche/prelievi", "/analitiche/rischio", "/analitiche/simulazione" -> REGGERA
                else -> null
            }
        }
    }
}

/** One of the four answer tiles (ANA-020). */
/** [loading]: the value is still being computed (Monte Carlo of «Regge»): show a placeholder, not the empty state. */
data class AnalyticsAnswerTile(val question: AnalyticsQuestion, val value: String, val note: String, val loading: Boolean = false)

/** «Puoi smettere di lavorare intorno al» headline (ANA-009, ANA-010). */
data class AnalyticsHeadline(
    val lead: String,
    val big: String,
    val sub: String?,
    val comparison: String?,
    val positive: Boolean,
    val missing: Boolean,
)

/** Verdict on a success probability (`successVerdict`). */
data class AnalyticsVerdict(val text: String, val tone: Tone) {
    enum class Tone { POS, NEG, DEFAULT }
}

/** «Il patrimonio reggerà?» in words (`lastingAnswer`). */
data class AnalyticsLastingAnswer(
    val headline: String,
    val verdict: AnalyticsVerdict,
    val success: Double,
    val rules: List<Rule>,
    val better: Rule?,
) {
    data class Rule(val rule: WithdrawalRule, val label: String, val success: Double)
}

class AnalyticsText(val locale: BBLocale, val masked: Boolean = false, private val translate: (String) -> String) {
    fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    // MARK: Formats (`localizedAnalyticsFormats`)

    /** Currency without decimals («97.534 €»), masked in privacy mode. */
    fun money(value: Double, currency: String): String =
        BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = 0, masked = masked)

    /** Percent with exactly [digits] decimals («3,5%»). */
    fun pct(value: Double, digits: Int = 1): String = BBFormat.formatPct(value, locale, digits)

    /** Plain number with exactly [digits] decimals («1,91»). */
    fun num(value: Double, digits: Int = 2): String = BBFormat.formatRatio(value, locale, digits)

    /** «12,3 anni», «già raggiunto» at 0, «oltre 80 anni» when null. */
    fun formatYears(years: Double?): String {
        if (years == null) return tr("oltre 80 anni")
        if (years == 0.0) return tr("già raggiunto")
        return tr("{0} anni", mapOf("0" to BBFormat.formatNumber(years, locale, minimumFractionDigits = 0, maximumFractionDigits = 1)))
    }

    private fun monthFormatted(key: String, skeleton: BBDateSkeleton): String {
        val y = key.take(4).toIntOrNull() ?: 2000
        val m = key.drop(5).take(2).toIntOrNull() ?: 1
        return BBFormat.formatDate(CalendarDate(y, m, 1), skeleton, locale).replaceFirst(".", "")
    }

    /** «ott 2025» from `YYYY-MM-DD` or `YYYY-MM` (first "." removed). */
    fun monthText(key: String): String = monthFormatted(key, BBDateSkeleton.MMM_Y)

    /** «ott 2025 – set 2026». */
    fun rangeText(fromKey: String, toKey: String): String = "${monthText(fromKey)} – ${monthText(toKey)}"

    /** «negli ultimi 12 mesi» / «da gen 2024 a dic 2025». */
    fun periodPhrase(period: DataPeriod, fromKey: String, toKey: String): String = when (period) {
        is DataPeriod.Ultimi -> tr("negli ultimi {0} mesi", mapOf("0" to period.months.toString()))
        is DataPeriod.Personalizzato -> tr("da {0} a {1}", mapOf("0" to monthText(fromKey), "1" to monthText(toKey)))
    }

    /** «gen 26» (growth bars: `{month short, year 2-digit}`, "." removed). */
    fun shortMonth(key: String): String = monthFormatted(key, BBDateSkeleton.MMM_YY)

    /** Signed percent of the sensitivity rows/columns («+10%», «−20%», «0%»). */
    fun signedPct(value: Double): String = (if (value > 0) "+" else if (value < 0) BBFormat.MINUS_SIGN else "") + pct(abs(value), 0)

    // MARK: Headline and deltas

    /** ANA-009 / ANA-010 (`ScenarioHeadline`). */
    fun headline(plan: FirePlan, baseline: FirePlan, todayYear: Int): AnalyticsHeadline {
        if (plan.target == null) {
            return AnalyticsHeadline(
                tr("Quando puoi smettere di lavorare"), tr("Mi serve la tua spesa annua"),
                tr("Registra almeno 3 mesi di movimenti oppure scrivila in «Tutte le ipotesi»."), null, false, true,
            )
        }
        val years = plan.yearsToFire
        val big = when {
            years == null -> tr("Oltre 80 anni")
            years == 0.0 -> tr("Già oggi")
            else -> (todayYear + ceil(years).toInt()).toString()
        }
        var comparison: String? = null
        var positive = false
        val b = baseline.yearsToFire
        if (years != null && b != null && abs(b - years) >= 0.05) {
            val diff = b - years
            positive = diff > 0
            comparison = tr(if (diff > 0) "{0} prima delle ipotesi salvate" else "{0} dopo delle ipotesi salvate", mapOf("0" to formatYears(abs(diff))))
        }
        return AnalyticsHeadline(
            lead = if (years == 0.0) tr("Hai già raggiunto il numero FIRE") else tr("Puoi smettere di lavorare intorno al"),
            big = big,
            sub = if ((years ?: 0.0) > 0) tr("tra {0}", mapOf("0" to formatYears(years))) else null,
            comparison = comparison, positive = positive, missing = false,
        )
    }

    /** ANA-015 (`deltaText`): years earlier/later than the saved plan; null when negligible. */
    fun deltaText(base: Double?, next: Double?): String? {
        if (base == null || next == null) return if (next == null && base != null) tr("il traguardo supera gli 80 anni") else null
        val diff = base - next
        if (abs(diff) < 0.05) return null
        return tr(if (diff > 0) "{0} prima" else "{0} dopo", mapOf("0" to formatYears(abs(diff))))
    }

    // MARK: Tiles (ANA-020)

    fun tiles(
        plan: FirePlan, scenario: Boolean, todayYear: Int, lasting: AnalyticsLastingAnswer?, retirementYears: Double,
        costs: CostSummary, currency: String, simulating: Boolean = false,
    ): List<AnalyticsAnswerTile> = AnalyticsQuestion.entries.map { q ->
        when (q) {
            AnalyticsQuestion.DOVE_SONO -> AnalyticsAnswerTile(
                q, plan.progress?.let { pct(min(it, 9.99), 0) } ?: "—",
                plan.target?.let { tr("{0} su {1}", mapOf("0" to money(plan.wealth, currency), "1" to money(it, currency))) } ?: money(plan.wealth, currency),
            )
            AnalyticsQuestion.QUANDO -> {
                val years = plan.yearsToFire
                val value = when {
                    years == null -> "—"
                    years == 0.0 -> tr("Già qui")
                    else -> (todayYear + ceil(years).toInt()).toString()
                }
                AnalyticsAnswerTile(q, value, if (scenario) tr("con i valori dei cursori") else tr("ai ritmi attuali"))
            }
            AnalyticsQuestion.REGGERA -> if (lasting == null && simulating) AnalyticsAnswerTile(q, "", "", loading = true) else AnalyticsAnswerTile(
                q, lasting?.let { pct(it.success, 0) } ?: "—",
                if (lasting != null) tr("su {0} anni, smettendo oggi", mapOf("0" to AnalyticsRules.intText(retirementYears))) else tr("serve la spesa annua"),
            )
            AnalyticsQuestion.COSTI -> AnalyticsAnswerTile(
                q, if (costs.totalValue > 0) money(costs.annualCost, currency) else "—",
                costs.annualPct?.let { tr("{0} l'anno", mapOf("0" to pct(it, 2))) } ?: tr("costo annuo"),
            )
        }
    }

    // MARK: Plain answers (`plain-answers.ts`)

    fun successVerdict(success: Double): AnalyticsVerdict = when {
        success >= 0.9 -> AnalyticsVerdict(tr("Solida: regge nella grande maggioranza degli scenari"), AnalyticsVerdict.Tone.POS)
        success >= 0.75 -> AnalyticsVerdict(tr("Discreta: nei casi sfortunati servirebbe tagliare le spese"), AnalyticsVerdict.Tone.DEFAULT)
        else -> AnalyticsVerdict(tr("Fragile: in troppi scenari il patrimonio finisce prima"), AnalyticsVerdict.Tone.NEG)
    }

    /** Question 1: where you are and where recent growth came from. */
    fun journeySentences(plan: FirePlan, split: FireGrowthSplit?, currency: String, withdrawalRate: Double?): List<String> {
        val out = mutableListOf<String>()
        val target = plan.target
        if (target != null) {
            out += tr(
                "Hai {0} su {1} necessari: {2} del percorso.",
                mapOf("0" to money(plan.wealth, currency), "1" to money(target, currency), "2" to pct(min(plan.progress ?: 0.0, 9.99), 0)),
            )
        } else {
            out += tr("Hai {0}. Per sapere quanto ti serve indica la spesa annua nelle ipotesi.", mapOf("0" to money(plan.wealth, currency)))
        }
        val spending = plan.spending
        if (target != null && spending != null && withdrawalRate != null) {
            out += tr(
                "Il numero FIRE è la tua spesa annua ({0}) divisa per il tasso di prelievo ({1}).",
                mapOf("0" to money(spending, currency), "1" to pct(withdrawalRate)),
            )
        }
        if (split != null && split.rows.size >= 2) {
            val share = split.savingsShare
            out += if (share != null) {
                tr(
                    "Negli ultimi 12 mesi il patrimonio è cresciuto di {0}: {1} grazie al tuo risparmio, il resto dal mercato.",
                    mapOf("0" to money(split.totalDelta, currency), "1" to pct(share, 0)),
                )
            } else {
                tr("Negli ultimi 12 mesi il patrimonio è variato di {0}.", mapOf("0" to money(split.totalDelta, currency)))
            }
        }
        return out
    }

    /** Question 2 sentence above the chart: «Con {risparmio} risparmiati l'anno e un rendimento reale del {x}%, in euro di oggi.» */
    fun timelineSentence(savings: Double?, expectedReturn: Double, currency: String, baseline: Boolean): List<AnalyticsTextPart> {
        val parts = mutableListOf(
            AnalyticsTextPart.Text(tr("Con") + " " + money(savings ?: 0.0, currency) + " " + tr("risparmiati l'anno e un") + " "),
            AnalyticsTextPart.Term("rendimento-reale", tr("rendimento reale")),
            AnalyticsTextPart.Text(" " + tr("del") + " " + BBFormat.formatRatio(expectedReturn * 100, locale, 1) + tr("%, in") + " "),
            AnalyticsTextPart.Term("euro-di-oggi", tr("euro di oggi")),
            AnalyticsTextPart.Text("."),
        )
        if (baseline) parts += AnalyticsTextPart.Text(tr(" La linea tratteggiata è il percorso con le ipotesi salvate."))
        return parts
    }

    /** Short rule names (`RULE_SHORT_NAMES`). */
    fun ruleShortName(rule: WithdrawalRule): String = when (rule) {
        WithdrawalRule.FISSA -> tr("spesa fissa")
        WithdrawalRule.PERCENTUALE -> tr("percentuale del patrimonio")
        WithdrawalRule.GUYTON_KLINGER -> "Guyton-Klinger"
        WithdrawalRule.VANGUARD -> tr("Vanguard dinamica")
    }

    /** Long rule names (`RULE_LABELS`), as in «Tutte le ipotesi» and the rules table. */
    fun ruleLabel(rule: WithdrawalRule): String = tr(AnalyticsRules.ruleLabel(rule))

    /** Question 3 (`lastingAnswer`), from the rules compared retiring today. */
    fun lastingAnswer(results: List<MonteCarloResult>, selected: WithdrawalRule, retirementYears: Double): AnalyticsLastingAnswer? {
        val current = results.firstOrNull { it.rule == selected } ?: results.firstOrNull() ?: return null
        val rules = results.map { AnalyticsLastingAnswer.Rule(it.rule, ruleShortName(it.rule), it.successRate) }
        // JS sort is stable: the first of the best wins.
        val best = rules.sortedByDescending { it.success }.first()
        val better = if (best.rule != current.rule && best.success > current.successRate + 0.005) best else null
        return AnalyticsLastingAnswer(
            tr(
                "Se smettessi oggi, il patrimonio dura {0} anni nel {1} degli scenari simulati (regola: {2}).",
                mapOf("0" to AnalyticsRules.intText(retirementYears), "1" to pct(current.successRate, 0), "2" to ruleShortName(current.rule)),
            ),
            successVerdict(current.successRate), current.successRate, rules, better,
        )
    }

    /** Question 4 (`costsSentences`). */
    fun costsSentences(summary: CostSummary, lostAfterYears: Double?, years: Int, liquidation: FireLiquidationResult, currency: String): List<String> {
        if (summary.totalValue <= 0) return listOf(tr("Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano."))
        val out = mutableListOf(
            summary.annualPct?.let {
                tr("Costi dei fondi e bollo: {0} l'anno ({1} del portafoglio).", mapOf("0" to money(summary.annualCost, currency), "1" to pct(it, 2)))
            } ?: tr("Costi dei fondi e bollo: {0} l'anno.", mapOf("0" to money(summary.annualCost, currency))),
        )
        if (lostAfterYears != null && lostAfterYears > 0) {
            out += tr("In {0} anni sono {1} in meno, a parità di rendimento.", mapOf("0" to years.toString(), "1" to money(lostAfterYears, currency)))
        }
        if (summary.missingTerValue > 0) {
            out += tr("Per posizioni da {0} manca il costo del fondo: il totale è più basso del reale.", mapOf("0" to money(summary.missingTerValue, currency)))
        }
        if (liquidation.latentTax > 0) {
            out += tr("Vendendo tutto oggi pagheresti circa {0} di imposte sulle plusvalenze.", mapOf("0" to money(liquidation.latentTax, currency)))
        }
        return out
    }

    // MARK: Sources of the figures (`return-source.ts`, `cashflow-source-note.tsx`)

    /** Short label under the return slider. */
    fun returnSourceLabel(info: FireExpectedReturnInfo): String = when (info.source) {
        FireReturnSource.MANUALE -> tr("Scritto a mano")
        FireReturnSource.PRUDENTE -> tr("Valore prudente")
        FireReturnSource.STORICO -> tr("Dai tuoi dati")
    }

    private fun missingReturnText(reason: String, currency: String): String = when (reason) {
        "storico-breve" -> tr("per partire dal tuo rendimento servono almeno 12 mesi di investimenti nel periodo scelto")
        "periodo-breve" -> tr("per calcolare un rendimento annuo serve un periodo di almeno 12 mesi")
        "patrimonio-basso" -> tr("con meno di {0} investiti il tuo rendimento dice poco", mapOf("0" to money(AnalyticsRules.MIN_INVESTED_FOR_ESTIMATE, currency)))
        "prezzi-mancanti" -> tr("alcuni titoli non hanno un prezzo e il tuo rendimento non sarebbe affidabile")
        else -> tr("senza investimenti registrati non c'è un tuo rendimento da cui partire")
    }

    /** Where the return in use comes from (info hint under the slider and in «Tutte le ipotesi»). */
    fun returnSourceText(info: FireExpectedReturnInfo, currency: String, period: DataPeriod): String = when (info.source) {
        FireReturnSource.MANUALE -> tr("Inserito a mano.")
        FireReturnSource.PRUDENTE -> {
            val reason = (info.history as? FireHistoricalReturnResult.Manca)?.let { missingReturnText(it.reason, currency) } ?: ""
            tr("Uso un {0} prudente: {1}.", mapOf("0" to pct(FireAssumptions.defaults.expectedReturn, 0), "1" to reason))
        }
        FireReturnSource.STORICO -> {
            val h = info.history as? FireHistoricalReturnResult.Ok
            val real = info.historyReal
            if (h == null || real == null) {
                ""
            } else {
                val clamped = if (info.clamped) tr(" Uso {0}, il limite del cursore.", mapOf("0" to pct(info.value))) else ""
                val whenText = when {
                    h.shorterThanPeriod -> tr("negli ultimi {0} mesi (da quando investi)", mapOf("0" to h.months.toString()))
                    period is DataPeriod.Ultimi -> tr("negli ultimi {0} mesi", mapOf("0" to period.months.toString()))
                    else -> tr("da {0} a {1}", mapOf("0" to monthText(h.fromKey), "1" to monthText(h.toKey)))
                }
                tr(
                    "Il tuo portafoglio {0} ha reso {1} l'anno, {2} tolta l'inflazione.{3}",
                    mapOf("0" to whenText, "1" to pct(h.nominal), "2" to pct(real), "3" to clamped),
                )
            }
        }
    }

    /** Warning text above 8% (`HIGH_RETURN_TEXT`). */
    val highReturnText: String
        get() = tr(
            "Sopra {0} reale le proiezioni diventano ottimistiche: nel lungo periodo le borse mondiali hanno reso in media intorno al 5% reale.",
            mapOf("0" to pct(FirePlanning.highReturnWarning, 0)),
        )

    /** Info hint of «Dai tuoi dati» under savings / spending. */
    fun cashflowAverageText(periodPhrase: String, coveredMonths: Int, periodMonths: Int): String {
        val average = if (coveredMonths < periodMonths) {
            tr("dei {0} mesi da quando registri i movimenti", mapOf("0" to coveredMonths.toString()))
        } else {
            tr("dei movimenti {0}", mapOf("0" to periodPhrase))
        }
        return tr("Media mensile") + " " + average + tr(", moltiplicata per 12. I giroconti tra i tuoi conti non contano.")
    }

    /** ANA-018: «Non nota» hint. */
    val notKnownHint: String
        get() = tr("Per calcolarla") + " " + tr("servono almeno 3 mesi di movimenti nel periodo scelto") + tr(". Puoi scriverla in «Tutte le ipotesi».")

    /** «Altre ipotesi: volatilità 12%, inflazione 2%, imposte contate». */
    fun otherAssumptions(a: FireAssumptions): String =
        tr("Altre ipotesi: volatilità") + " " + pct(a.volatility, 0) + tr(", inflazione") + " " + pct(a.inflation, 0) + tr(", imposte") + " " +
            (if (a.includeLatentTax) tr("contate") else tr("non contate"))

    /** `GlossedText`: the first occurrence of each glossary phrase becomes a term (case-insensitive, whole words). */
    fun glossed(text: String): List<AnalyticsTextPart> = AnalyticsRules.glossed(text)

    /** Sentence under the «Il tuo traguardo» preview target. */
    fun goalPreviewWhen(preview: FirePlan, todayYear: Int): String {
        if (preview.savingsSource == io.buddybudget.core.domain.fire.FireFigureSource.MANCA) {
            return tr("Per dirti quando ci arrivi servono almeno 3 mesi di movimenti.")
        }
        val years = preview.yearsToFire ?: return tr("Ai ritmi di oggi ci vorrebbero più di 80 anni.")
        if (years == 0.0) return tr("Il tuo patrimonio lo ha già raggiunto.")
        return tr(
            "Ai ritmi di oggi ci arrivi intorno al {0}, tra {1}.",
            mapOf("0" to (todayYear + ceil(years).toInt()).toString(), "1" to formatYears(years)),
        )
    }
}
