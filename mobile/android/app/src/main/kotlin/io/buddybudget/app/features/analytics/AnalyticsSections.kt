package io.buddybudget.app.features.analytics

import io.buddybudget.app.designsystem.components.BBStyles
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.ChartLegendItem
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.pension.LegendDot
import io.buddybudget.app.tr
import io.buddybudget.core.data.AnalyticsView
import io.buddybudget.core.domain.analytics.AnalyticsLastingAnswer
import io.buddybudget.core.domain.analytics.AnalyticsQuestion
import io.buddybudget.core.domain.analytics.AnalyticsRules
import io.buddybudget.core.domain.analytics.AnalyticsSensitivityTable
import io.buddybudget.core.domain.analytics.AnalyticsText
import io.buddybudget.core.domain.analytics.AnalyticsVerdict
import io.buddybudget.core.domain.costs.CostSummary
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireCalc
import io.buddybudget.core.domain.fire.FireFigureSource
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.FireRetireAt
import io.buddybudget.core.domain.fire.MonteCarloResult
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.format.BBFormat
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

// The four questions of «Risposte» with their «Per esperti» panels (web components/domain/analytics/{journey,timeline,
// lasting,costs}-section.tsx and {growth,fire,simulation,withdrawal,risk,costs}-tab.tsx). iOS: AnalyticsSections.swift.

@Composable
fun AnalyticsQuestionView(
    model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, assumptions: FireAssumptions, saved: FirePlan, text: AnalyticsText,
    costs: CostSummary, lasting: AnalyticsLastingAnswer?,
) {
    val q = model.state.selected
    val open = q in model.state.expertOpen
    when (q) {
        AnalyticsQuestion.DOVE_SONO -> AnalyticsQuestionSection("da dove arriva la crescita, mese per mese", open, { model.toggleExpert(q) },
            { JourneyAnswer(view, plan, assumptions, text) }) { GrowthExpert(view, text) }
        AnalyticsQuestion.QUANDO -> AnalyticsQuestionSection(
            if (plan.target == null) "sensibilità, Coast FIRE" else "sensibilità alle ipotesi, Coast FIRE, lean FIRE", open, { model.toggleExpert(q) },
            { TimelineAnswer(model, view, plan, assumptions, saved, text) }) { FireExpert(model, view, plan, assumptions, text) }
        AnalyticsQuestion.REGGERA -> AnalyticsQuestionSection("probabilità di successo, regole di prelievo, rischio del portafoglio", open, { model.toggleExpert(q) },
            { LastingAnswerView(model, view, assumptions, text, lasting) }) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                if (debugShows(4)) SimulationExpert(model, view, plan, text)
                if (debugShows(5)) WithdrawalExpert(model, view, plan, assumptions, text)
                RiskExpert(view, assumptions.volatility, text)
            }
        }
        AnalyticsQuestion.COSTI -> AnalyticsQuestionSection("costo di ogni fondo (TER), erosione, imposte", open, { model.toggleExpert(q) },
            { CostsAnswer(view, plan, assumptions, text, costs) }) { CostsExpert(model, view, plan, assumptions, text, costs) }
    }
}

// ---------------------------------------------------------------- 1. Strada fatta (ANA-021, ANA-027)

@Composable
private fun JourneyAnswer(view: AnalyticsView, plan: FirePlan, a: FireAssumptions, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val currency = view.currency
    val split = FireCalc.splitGrowth(view.base.splitPoints)
    val sentences = text.journeySentences(plan, if (split.rows.size >= 2) split else null, currency, a.withdrawalRate)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) { sentences.forEach { GlossedText(text.glossed(it)) } }
        plan.target?.let { target ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                AnalyticsProgress(min(plan.progress ?: 0.0, 1.0))
                Row {
                    BBText("0", BBTextStyle.Caption, color = c.mutedForeground)
                    Spacer(Modifier.weight(1f))
                    BBText(text.money(target, currency), BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            AnalyticsMetric(tr("Il tuo patrimonio"), text.money(plan.wealth, currency))
            AnalyticsMetric(tr("Numero FIRE"), plan.target?.let { text.money(it, currency) } ?: "—",
                sub = if (plan.taxShare > 0) plan.fireNumberGross?.let { tr("{0} prima delle imposte", mapOf("0" to text.money(it, currency))) } else null,
                term = "numero-fire")
            AnalyticsMetric(tr("Ti mancano"), plan.target?.let { text.money(max(it - plan.wealth, 0.0), currency) } ?: "—",
                sub = plan.progress?.let { tr("hai fatto il {0}", mapOf("0" to text.pct(min(it, 9.99), 0))) },
                tone = if (plan.target != null && plan.wealth >= plan.target!!) AnalyticsVerdict.Tone.POS else AnalyticsVerdict.Tone.DEFAULT)
        }
    }
}

@Composable
private fun GrowthExpert(view: AnalyticsView, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val currency = view.currency
    val split = FireCalc.splitGrowth(view.base.splitPoints)
    if (split.rows.size < 2) {
        AnalyticsMissing(tr("Servono almeno due mesi di storico del patrimonio e dei movimenti. Con i conti collegati o qualche mese di uso la scheda si riempie da sola."))
        return
    }
    AnalyticsBlock(tr("Da dove arriva la crescita"), "growth") {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            AnalyticsMetric(tr("Variazione del patrimonio"), text.money(split.totalDelta, currency), sub = tr("liquidità + investimenti, ultimi 12 mesi"),
                tone = if (split.totalDelta >= 0) AnalyticsVerdict.Tone.POS else AnalyticsVerdict.Tone.NEG)
            AnalyticsMetric(tr("Dal tuo risparmio"), text.money(split.totalFromSavings, currency),
                sub = split.savingsShare?.let { tr("{0} della crescita", mapOf("0" to text.pct(it, 0))) })
            AnalyticsMetric(tr("Da mercato e altro"), text.money(split.totalFromMarket, currency), sub = tr("per differenza"),
                tone = if (split.totalFromMarket >= 0) AnalyticsVerdict.Tone.POS else AnalyticsVerdict.Tone.NEG)
        }
        val labels = split.rows.map { text.shortMonth(it.month) }
        AnalyticsStackedBars(labels, split.rows.map { listOf(it.fromSavings to c.primary, it.fromMarket to c.swatchTeal) }, tr("Da dove arriva la crescita")) { i ->
            val r = split.rows[i]
            AnalyticsTooltip(labels[i], listOf(
                Triple(tr("Dal risparmio:"), text.money(r.fromSavings, currency), false),
                Triple(tr("Da mercato e altro:"), text.money(r.fromMarket, currency), false),
                Triple(tr("Variazione totale:"), text.money(r.delta, currency), false),
            ))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            LegendDot(tr("Dal risparmio"), c.primary)
            LegendDot(tr("Da mercato e altro"), c.swatchTeal)
        }
    }
}

// ---------------------------------------------------------------- 2. Arrivo (ANA-022, ANA-028)

@Composable
private fun TimelineAnswer(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, a: FireAssumptions, saved: FirePlan, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val currency = view.currency
    val target = plan.target
    if (target == null || plan.spending == null) {
        AnalyticsMissing(tr("Per stimare quando arrivi serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti e la ricavo da lì."))
        return
    }
    val scenario = model.state.hasScenario
    val series = AnalyticsRules.timelineSeries(plan, a)
    val baseline = if (scenario) AnalyticsRules.timelineSeries(saved, view.assumptions) else null
    val year = model.todayYear
    val maxValue = max((series.map { it.wealth } + (baseline?.map { it.wealth } ?: emptyList())).maxOrNull() ?: 0.0, target) * 1.05
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        GlossedText(text.timelineSentence(plan.savings, a.expectedReturn, currency, scenario))
        val lines = (baseline?.let { b -> listOf(AnalyticsLine("baseline", series.indices.map { b.getOrNull(it)?.wealth }, c.mutedForeground, 1.8.dp, listOf(4f, 4f))) }
            ?: emptyList()) + AnalyticsLine("wealth", series.map { it.wealth }, c.primary, 2.5.dp, fill = 0.12f)
        AnalyticsChart(series.size, 0.0..max(maxValue, 1.0), series.map { (year + it.year).toString() }, tr("Patrimonio previsto"), lines = lines,
            reference = AnalyticsReference(target, c.pos, "${tr("Numero FIRE")} ${text.money(target, currency)}"), height = 224.dp, minTickGap = 32.0) { i ->
            AnalyticsTooltip((year + series[i].year).toString(), listOf(Triple(tr("Patrimonio:"), text.money(series[i].wealth, currency), false)) +
                (baseline?.getOrNull(i)?.let { listOf(Triple(tr("Ipotesi salvate:"), text.money(it.wealth, currency), true)) } ?: emptyList()))
        }
    }
}

@Composable
private fun FireExpert(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, a: FireAssumptions, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val currency = view.currency
    val target = plan.target
    val spending = plan.spending
    if (target == null || spending == null) {
        AnalyticsMissing(tr("Per calcolare il numero FIRE serve la tua spesa annua. Scrivila nelle ipotesi qui sopra, oppure registra almeno 3 mesi di movimenti e la ricavo da lì."))
        return
    }
    val savings = plan.savings ?: 0.0
    val lean = AnalyticsRules.leanNumber(view.base, a)
    val finishYear = plan.yearsToFire?.let { model.todayYear + ceil(it).toInt() }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        if (debugShows(4)) AnalyticsBlock(tr("Il tuo numero FIRE"), "fire-number") {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                AnalyticsMetric(tr("Numero FIRE"), text.money(target, currency),
                    sub = if (plan.taxShare > 0) tr("{0} prima delle imposte", mapOf("0" to text.money(plan.fireNumberGross ?: target, currency)))
                    else tr("spesa {0} ÷ {1}", mapOf("0" to text.money(spending, currency), "1" to text.pct(a.withdrawalRate))))
                AnalyticsMetric(tr("Il tuo patrimonio"), text.money(plan.wealth, currency),
                    sub = tr("{0} del traguardo", mapOf("0" to text.pct(min(plan.progress ?: 0.0, 9.99), 0))))
                AnalyticsMetric(tr("Anni al traguardo"), text.formatYears(plan.yearsToFire),
                    sub = finishYear?.let { tr("intorno al {0}", mapOf("0" to it.toString())) }
                        ?: if (savings <= 0) tr("con risparmio nullo non ci arrivi") else null)
            }
            AnalyticsProgress(min(plan.progress ?: 0.0, 1.0), height = 8.dp)
            BBText(tr("Con un risparmio di") + " " + text.money(savings, currency) + " " + tr("l'anno e un rendimento reale del") + " " + text.pct(a.expectedReturn) +
                ". " + (if (plan.spendingSource == FireFigureSource.DATI) tr("La spesa viene dai tuoi movimenti del periodo scelto. ") else "") +
                (lean?.let { tr("Se vivessi solo con le spese Dovute e Saltuarie il numero scenderebbe a {0} («lean FIRE»).", mapOf("0" to text.money(it, currency))) } ?: ""),
                BBTextStyle.Body, color = c.mutedForeground)
        }
        if (debugShows(5)) AnalyticsBlock(tr("Coast FIRE"), "coast") {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                plan.coast.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        row.forEach { cp ->
                            val reached = plan.wealth >= cp.number
                            AnalyticsMetric(tr("Fra {0} anni", mapOf("0" to AnalyticsRules.intText(cp.years))), text.money(cp.number, currency), Modifier.weight(1f),
                                sub = if (reached) tr("già raggiunto") else null, tone = if (reached) AnalyticsVerdict.Tone.POS else AnalyticsVerdict.Tone.DEFAULT)
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
        AnalyticsBlock(tr("Sensibilità alle ipotesi"), "sensitivity") {
            AnalyticsRules.rateSensitivity(plan, a, text)?.let { SensitivityTable(it, tr("tasso di prelievo"), tr("rendimento reale"), text) }
            AnalyticsRules.spendingSensitivity(plan, a, text)?.let { SensitivityTable(it, tr("spesa"), tr("risparmio"), text) }
            BBText(tr("Anni al numero FIRE. «—» = oltre 80 anni o mai; «ok» = già raggiunto. La cella evidenziata è la tua ipotesi."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** Years-to-FIRE grid (scrolls horizontally inside its block; the user's cell highlighted). */
@Composable
private fun SensitivityTable(table: AnalyticsSensitivityTable, rowLabel: String, columnLabel: String, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(tr("Righe:") + " " + rowLabel + " " + tr("· Colonne:") + " " + columnLabel, BBTextStyle.Caption, color = c.mutedForeground)
        Column(Modifier.horizontalScroll(rememberScrollState()).widthIn(min = 400.dp)) {
            Row {
                Spacer(Modifier.width(52.dp))
                table.columns.forEach { Cell(it, header = true) }
            }
            table.cells.forEachIndexed { i, row ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BBText(table.rows[i], Modifier.width(52.dp).padding(vertical = 6.dp),
                        BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500), color = c.mutedForeground)
                    row.forEachIndexed { j, cell -> Cell(AnalyticsRules.cellText(cell, text), header = false, highlight = i == 2 && j == 2) }
                }
            }
        }
    }
}

@Composable
private fun Cell(value: String, header: Boolean, highlight: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    BBText(
        value,
        Modifier.widthIn(min = 66.dp).background(if (highlight) c.alphaPrimary10 else Color.Transparent, RoundedCornerShape(4.dp))
            .padding(vertical = 6.dp, horizontal = 6.dp),
        when {
            header -> BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500, textAlign = TextAlign.End)
            highlight -> BBTextStyle.BodyStrong.style.copy(textAlign = TextAlign.End, fontFeatureSettings = "tnum")
            else -> BBTextStyle.Body.style.copy(textAlign = TextAlign.End, fontFeatureSettings = "tnum")
        },
        color = if (header) c.mutedForeground else c.foreground, maxLines = 1,
    )
}

// ---------------------------------------------------------------- 3. Regge (ANA-023, ANA-029, ANA-030)

@Composable
private fun LastingAnswerView(model: AnalyticsModel, view: AnalyticsView, a: FireAssumptions, text: AnalyticsText, answer: AnalyticsLastingAnswer?) {
    val c = BuddyBudgetTheme.colors
    val results = model.results
    when {
        model.state.simulationInput == null ->
            AnalyticsMissing(tr("Per simulare serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        answer != null && results != null -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                GlossedText(text.glossed(answer.headline), BBStyles.figure, c.foreground)
                BBText(answer.verdict.text + ".", BBTextStyle.BodyLarge, color = c.mutedForeground)
                answer.better?.let { better ->
                    BBText(tr("Cambiando il modo di prelevare la situazione cambia: con la regola «") + better.label + tr("» il patrimonio regge nel") + " " +
                        text.pct(better.success, 0) + " " + tr("dei casi."), BBTextStyle.BodyLarge, color = c.mutedForeground)
                }
            }
            RuleChips(answer.rules, text)
            results.firstOrNull { it.rule == a.rule }?.let { current ->
                AnalyticsBlock(tr("3.000 futuri possibili del tuo patrimonio")) {
                    FanChart(current, 0, view.currency, text)
                    FanCaption(current, 0, 0.0, view.currency, text)
                }
            }
        }
        else -> BBSkeleton(height = 256.dp, radius = BBRadius.xl)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RuleChips(rules: List<AnalyticsLastingAnswer.Rule>, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val openTerm = LocalAnalyticsTerm.current
    FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        rules.forEach { r ->
            val fg = if (r.success >= 0.9) c.pos else if (r.success >= 0.75) c.foreground else c.neg
            val bg = if (r.success >= 0.9) c.posSoft else if (r.success >= 0.75) c.muted else c.negSoft
            val annotated = buildAnnotatedString {
                pushStyle(SpanStyle(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline))
                append(r.label)
                pop()
                append(" · " + text.pct(r.success, 0))
            }
            BasicText(annotated,
                Modifier.background(bg, CircleShape).bbPressable({ openTerm(AnalyticsRules.ruleTerm(r.rule)) }, CircleShape, translate = false)
                    .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space1),
                style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W600, color = fg))
        }
    }
}

/** Monte Carlo percentile fan: bands 10–90 (0.12) and 25–75 (0.20), median line. */
@Composable
private fun FanChart(result: MonteCarloResult, retireYear: Int, currency: String, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val w = result.wealth
    AnalyticsChart(w.size, AnalyticsRules.zeroAutoDomain(w.map { it.p90 }), w.map { "${it.year}a" }, tr("Probabilità che il patrimonio duri"),
        lines = listOf(AnalyticsLine("p50", w.map { it.p50 }, c.primary, 2.dp)),
        bands = listOf(AnalyticsBand("80", w.map { it.p10 }, w.map { it.p90 }, c.primary, 0.12f), AnalyticsBand("50", w.map { it.p25 }, w.map { it.p75 }, c.primary, 0.20f)),
        height = 256.dp, minTickGap = 24.0) { i ->
        AnalyticsTooltip(tr("Anno") + " " + w[i].year + (if (w[i].year == retireYear) tr(" · inizio pensione") else ""), listOf(
            Triple(tr("Sfortunato (10°):"), text.money(w[i].p10, currency), false),
            Triple(tr("Tipico (mediana):"), text.money(w[i].p50, currency), false),
            Triple(tr("Fortunato (90°):"), text.money(w[i].p90, currency), false),
        ))
    }
}

@Composable
private fun FanCaption(result: MonteCarloResult, retireYear: Int, savings: Double, currency: String, text: AnalyticsText) {
    BBText(
        BBFormat.formatNumber(result.paths.toDouble(), text.locale, maximumFractionDigits = 0) + " " + tr("scenari. Asse orizzontale: anni da oggi") +
            (if (retireYear > 0) tr("; la pensione inizia dopo {0} anni, versando {1} l'anno", mapOf("0" to retireYear.toString(), "1" to text.money(savings, currency))) else "") +
            tr(". Tutto in euro di oggi."),
        BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground,
    )
}

@Composable
private fun SimulationExpert(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val input = model.state.expertSimulationInput
    if (input == null) {
        AnalyticsMissing(tr("Per simulare serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        return
    }
    AnalyticsBlock(tr("Probabilità che il patrimonio duri"), "montecarlo") {
        SegmentedControl(listOf(FireRetireAt.OGGI to tr("Smetto oggi"), FireRetireAt.FIRE to tr("Smetto al traguardo FIRE")), model.state.retireAt,
            { model.setRetireAt(it) }, Modifier.fillMaxWidth(), accessibilityLabel = tr("Quando inizia la pensione"), stretch = true)
        if (model.state.retireAt == FireRetireAt.FIRE && plan.yearsToFire == null) {
            BBText(tr("Con queste ipotesi il traguardo FIRE non si raggiunge entro 80 anni: la simulazione parte da oggi."), BBTextStyle.Body, color = c.mutedForeground)
        }
        val result = model.expertResult
        if (result != null) {
            val v = text.successVerdict(result.successRate)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                AnalyticsMetric(tr("Probabilità di successo"), text.pct(result.successRate, 0), sub = v.text, tone = v.tone)
                AnalyticsMetric(tr("Patrimonio finale (caso tipico)"), text.money(result.endingWealth.p50, view.currency),
                    sub = tr("caso sfortunato {0}", mapOf("0" to text.money(result.endingWealth.p10, view.currency))))
                AnalyticsMetric(tr("Spesa annua"), text.money(input.annualSpending, view.currency),
                    sub = tr("regola: {0} · {1} anni", mapOf("0" to text.ruleShortName(input.rule), "1" to AnalyticsRules.intText(input.retirementYears))))
            }
            FanChart(result, input.accumulationYears.toInt(), view.currency, text)
            FanCaption(result, input.accumulationYears.toInt(), input.annualSavings, view.currency, text)
        } else {
            BBSkeleton(height = 256.dp, radius = BBRadius.xl)
        }
    }
}

@Composable
private fun WithdrawalExpert(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, a: FireAssumptions, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val results = model.results
    if (results == null) {
        if (model.state.simulationInput == null) {
            AnalyticsMissing(tr("Per confrontare le regole serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        }
        return
    }
    val selected = model.state.withdrawalRule ?: a.rule
    val best = results.maxOf { it.successRate }
    val current = results.firstOrNull { it.rule == selected } ?: results[0]
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        AnalyticsBlock(tr("Quattro regole a confronto"), "rules") {
            BBText(tr("Si parte da oggi con") + " " + text.money(plan.wealth, view.currency) + tr(", spendendo") + " " + text.money(plan.spending ?: 0.0, view.currency) +
                " " + tr("l'anno per") + " " + AnalyticsRules.intText(a.retirementYears) + " " + tr("anni. Tocca una riga per vedere la sua spesa nel tempo."),
                BBTextStyle.Body, color = c.mutedForeground)
            Column {
                WithdrawalRule.entries.forEach { rule ->
                    val r = results.firstOrNull { it.rule == rule } ?: return@forEach
                    Column(Modifier.fillMaxWidth()) {
                        Column(
                            Modifier.fillMaxWidth().background(if (selected == rule) c.alphaPrimary10 else Color.Transparent, RoundedCornerShape(BBRadius.md))
                                .bbPressable({ model.selectRule(rule) }, RoundedCornerShape(BBRadius.md), translate = false).padding(BBSpacing.space2),
                            verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                        ) {
                            BBText(text.ruleLabel(rule), BBTextStyle.BodyStrong)
                            RuleRow(tr("Successo"), text.pct(r.successRate, 0), if (r.successRate == best) c.pos else c.foreground)
                            RuleRow(tr("Taglio massimo tipico"), text.pct(r.maxCut.median, 0))
                            RuleRow(tr("Taglio nel 10% dei casi peggiori"), text.pct(r.maxCut.p90, 0))
                            RuleRow(tr("Patrimonio finale tipico"), text.money(r.endingWealth.p50, view.currency))
                        }
                    }
                }
            }
            BBText(tr("«Taglio massimo» = di quanto la spesa scende, nel punto peggiore, rispetto a quella del primo anno. Più il taglio è alto, più la regola ti chiede sacrifici quando il mercato va male."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
        AnalyticsBlock(tr("Spesa nel tempo · {0}", mapOf("0" to text.ruleLabel(selected).split(" (").first().lowercase()))) {
            val s = current.spending
            AnalyticsChart(s.size, AnalyticsRules.zeroAutoDomain(s.map { it.p90 }), s.map { "${it.year + 1}a" }, tr("Spesa nel tempo"),
                lines = listOf(AnalyticsLine("p90", s.map { it.p90 }, c.swatchTeal, 1.5.dp), AnalyticsLine("p10", s.map { it.p10 }, c.neg, 1.5.dp),
                    AnalyticsLine("p50", s.map { it.p50 }, c.primary, 2.dp)), height = 224.dp, minTickGap = 24.0) { i ->
                AnalyticsTooltip(tr("Anno di pensione") + " " + (s[i].year + 1), listOf(
                    Triple(tr("Sfortunato (10°):"), text.money(s[i].p10, view.currency), false),
                    Triple(tr("Tipico:"), text.money(s[i].p50, view.currency), false),
                    Triple(tr("Fortunato (90°):"), text.money(s[i].p90, view.currency), false),
                ))
            }
            BBText(tr("Spesa annua effettivamente sostenuta (comprende la pensione pubblica se l'hai indicata), in euro di oggi."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun RuleRow(label: String, value: String, color: Color = BuddyBudgetTheme.colors.foreground) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        Spacer(Modifier.weight(1f).widthIn(min = BBSpacing.space2))
        BBText(value, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"), color = color)
    }
}

@Composable
private fun RiskExpert(view: AnalyticsView, assumedVolatility: Double, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val risk = view.base.risk
    if (risk == null) {
        AnalyticsMissing(tr("Servono operazioni di investimento e almeno qualche settimana di prezzi per misurare il rischio del portafoglio."))
        return
    }
    val m = BBFormat.MINUS_SIGN
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        AnalyticsBlock(tr("Rischio del portafoglio"), "risk") {
            if (risk.fewData) BBText(tr("Meno di un anno di dati: i numeri sono indicativi."), BBTextStyle.Body, color = c.neg)
            val metrics: List<@Composable (Modifier) -> Unit> = listOf(
                { md -> AnalyticsMetric(tr("Volatilità annua"), risk.volatility?.let { text.pct(it) } ?: "—", md, sub = tr("ipotizzata {0}", mapOf("0" to text.pct(assumedVolatility))), term = "volatilita") },
                { md -> AnalyticsMetric(tr("Peggior calo"), risk.maxDrawdown?.let { m + text.pct(it) } ?: "—", md, sub = tr("dal picco al minimo"), tone = AnalyticsVerdict.Tone.NEG, term = "peggior-calo") },
                { md -> AnalyticsMetric(tr("Sharpe"), risk.sharpe?.let { text.num(it) } ?: "—", md, sub = tr("rendimento per unità di rischio"), term = "sharpe") },
                { md -> AnalyticsMetric(tr("Sortino"), risk.sortino?.let { text.num(it) } ?: "—", md, sub = tr("conta solo i ribassi"), term = "sortino") },
                { md -> AnalyticsMetric(tr("Calmar"), risk.calmar?.let { text.num(it) } ?: "—", md, sub = risk.annualReturn?.let { tr("rendimento annuo {0}", mapOf("0" to text.pct(it))) }, term = "calmar") },
                { md -> AnalyticsMetric(tr("VaR 95% (giorno)"), risk.tail?.let { m + text.pct(it.`var`) } ?: "—", md, sub = tr("nel 5% dei giorni peggiori si perde almeno"), tone = AnalyticsVerdict.Tone.NEG, term = "var") },
                { md -> AnalyticsMetric(tr("CVaR 95% (giorno)"), risk.tail?.let { m + text.pct(it.cvar) } ?: "—", md, sub = tr("perdita media in quei giorni"), tone = AnalyticsVerdict.Tone.NEG, term = "cvar") },
                { md -> AnalyticsMetric(tr("Posizioni effettive"), risk.concentration?.let { text.num(it.effectiveN, 1) } ?: "—", md, sub = tr("1 = tutto su un titolo"), term = "posizioni-effettive") },
            )
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                metrics.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3), verticalAlignment = Alignment.Top) {
                        row.forEach { it(Modifier.weight(1f)) }
                    }
                }
            }
            val vol = risk.volatility
            if (vol != null && abs(vol - assumedVolatility) > 0.05) {
                BBText(tr("La volatilità osservata (") + text.pct(vol, 0) + tr(") è lontana da quella che hai ipotizzato (") + text.pct(assumedVolatility, 0) +
                    tr("): se la tua vera tolleranza è quella osservata, aggiorna l'ipotesi per rendere la simulazione più realistica."), BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        AnalyticsBlock(tr("Quanto ogni posizione pesa sul rischio")) {
            val contributions = view.base.riskContribution
            if (contributions != null) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    contributions.sortedByDescending { it.riskShare }.forEach { cc ->
                        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                BBText(view.base.names[cc.id] ?: cc.id, BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 1)
                                BBText(text.pct(cc.riskShare, 0) + " " + tr("del rischio ·") + " " + text.pct(cc.weight, 0) + " " + tr("del valore"),
                                    BBTextStyle.Body, color = c.mutedForeground, maxLines = 1)
                            }
                            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth().height(12.dp)) {
                                val wdt = maxWidth
                                Box(Modifier.align(Alignment.CenterStart).fillMaxWidth().height(8.dp).background(c.muted, CircleShape))
                                Box(Modifier.align(Alignment.CenterStart).width(wdt * min(cc.riskShare, 1.0).toFloat()).height(8.dp).background(c.primary, CircleShape))
                                Box(Modifier.offset(x = wdt * min(cc.weight, 1.0).toFloat() - 1.dp).width(2.dp).height(12.dp).background(c.foreground.copy(alpha = 0.6f)))
                            }
                        }
                    }
                }
            } else {
                AnalyticsMissing(tr("Servono almeno due posizioni con 60 giorni di prezzi in comune."))
            }
            BBText(tr("La barra piena è il peso sul rischio, il trattino il peso sul valore: se la barra supera il trattino, quella posizione pesa sul rischio più di quanto pesi sul valore."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

// ---------------------------------------------------------------- 4. Costi (ANA-024, ANA-031)

@Composable
private fun CostsAnswer(view: AnalyticsView, plan: FirePlan, a: FireAssumptions, text: AnalyticsText, costs: CostSummary) {
    val currency = view.currency
    val drag = AnalyticsRules.drag(costs, a.expectedReturn)
    val sentences = text.costsSentences(costs, drag.lastOrNull()?.lost, AnalyticsRules.COST_DRAG_YEARS, plan.liquidation, currency)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) { sentences.forEach { GlossedText(text.glossed(it)) } }
        if (costs.totalValue > 0) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                AnalyticsMetric(tr("Costo annuo"), text.money(costs.annualCost, currency),
                    sub = costs.annualPct?.let { tr("{0} del portafoglio", mapOf("0" to text.pct(it, 2))) }, term = "ter")
                AnalyticsMetric(tr("Persi in {0} anni", mapOf("0" to AnalyticsRules.COST_DRAG_YEARS.toString())), drag.lastOrNull()?.let { text.money(it.lost, currency) } ?: "—",
                    sub = tr("a parità di rendimento"), tone = AnalyticsVerdict.Tone.NEG, term = "erosione")
                AnalyticsMetric(tr("Imposte se vendessi tutto"), text.money(plan.liquidation.latentTax, currency),
                    sub = plan.liquidation.taxRatio?.let { tr("{0} del valore", mapOf("0" to text.pct(it))) }, term = "imposte-latenti")
            }
        }
    }
}

@Composable
private fun CostsExpert(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, a: FireAssumptions, text: AnalyticsText, costs: CostSummary) {
    val c = BuddyBudgetTheme.colors
    val currency = view.currency
    if (view.base.positions.isEmpty()) {
        AnalyticsMissing(tr("Servono posizioni di investimento aperte per calcolare costi e imposte."))
        return
    }
    val drag = AnalyticsRules.drag(costs, a.expectedReturn)
    val liquidation = plan.liquidation
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        if (debugShows(4)) AnalyticsBlock(tr("Costi del portafoglio"), "costs") {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                AnalyticsMetric(tr("Costo annuo"), text.money(costs.annualCost, currency), sub = costs.annualPct?.let { tr("{0} del portafoglio", mapOf("0" to text.pct(it, 2))) })
                AnalyticsMetric(tr("Persi in {0} anni", mapOf("0" to AnalyticsRules.COST_DRAG_YEARS.toString())), drag.lastOrNull()?.let { text.money(it.lost, currency) } ?: "—",
                    sub = tr("rispetto allo stesso portafoglio senza costi"), tone = AnalyticsVerdict.Tone.NEG)
                AnalyticsMetric(tr("Senza costo inserito"), text.money(costs.missingTerValue, currency), sub = tr("valore delle posizioni senza costo inserito"))
            }
            Column {
                view.base.positions.forEach { p ->
                    val row = costs.rows.firstOrNull { it.id == p.id }
                    Column(Modifier.padding(vertical = BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            BBText(p.name, BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 1)
                            BBText(text.money(p.value, currency), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"), color = c.mutedForeground)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            BBTextField(model.terDrafts[p.id] ?: "", { model.terDrafts[p.id] = it }, Modifier.width(96.dp), placeholder = tr("es. 0,20"),
                                keyboard = BBKeyboard.Amount)
                            BBText(tr("Costo annuo fondo (TER, %)"), BBTextStyle.Caption, Modifier.weight(1f), color = c.mutedForeground)
                            BBText(row?.let { text.money(it.total, currency) } ?: "—", style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
            }
            BBText(tr("Il TER lo trovi nel KID/scheda del fondo (per un ETF globale di solito 0,1-0,4%). Il bollo (0,2%) è incluso per i titoli in deposito; è escluso per le crypto."),
                BBTextStyle.Caption, color = c.mutedForeground)
            (model.terError ?: model.state.saveError)?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
            BBButton(if (model.state.saving) tr("Salvo…") else tr("Salva costi"), { model.saveTers() }, enabled = !model.state.saving)
            if (drag.isNotEmpty()) {
                AnalyticsChart(drag.size, AnalyticsRules.autoDomain(drag.map { it.withoutCosts } + drag.map { it.withCosts }), drag.map { "${it.year}a" },
                    tr("Costi del portafoglio"), lines = listOf(AnalyticsLine("without", drag.map { it.withoutCosts }, c.swatchTeal, 2.dp, listOf(4f, 3f)),
                        AnalyticsLine("with", drag.map { it.withCosts }, c.primary, 2.dp)), height = 224.dp, minTickGap = 24.0) { i ->
                    val p = drag[i]
                    AnalyticsTooltip(tr("Tra") + " " + p.year + " " + tr("anni"), listOf(
                        Triple(tr("Senza costi:"), text.money(p.withoutCosts, currency), false),
                        Triple(tr("Con costi:"), text.money(p.withCosts, currency), false),
                        Triple(tr("Persi:"), text.money(p.lost, currency), false),
                    ))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
                    ChartLegendItem(tr("Senza costi"), c.swatchTeal, dashed = true)
                    ChartLegendItem(tr("Con i tuoi costi"), c.primary)
                }
            }
        }
        AnalyticsBlock(tr("Se vendessi tutto oggi"), "liquidation") {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                AnalyticsMetric(tr("Valore di mercato"), text.money(liquidation.grossValue, currency))
                AnalyticsMetric(tr("Imposta sulle plusvalenze"), text.money(liquidation.latentTax, currency),
                    sub = liquidation.taxRatio?.let { tr("{0} del valore", mapOf("0" to text.pct(it))) }, tone = AnalyticsVerdict.Tone.NEG)
                AnalyticsMetric(tr("Netto dopo le imposte"), text.money(liquidation.netValue, currency))
            }
            if (liquidation.byPosition.isEmpty()) {
                BBText(tr("Nessuna plusvalenza non realizzata: nessuna imposta latente."), BBTextStyle.Body, color = c.mutedForeground)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    liquidation.byPosition.take(6).forEach { p ->
                        Row(Modifier.padding(top = BBSpacing.space1), verticalAlignment = Alignment.CenterVertically) {
                            BBText(p.name, BBTextStyle.Body, Modifier.weight(1f), maxLines = 1)
                            BBText(text.money(p.tax, currency), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"), color = c.mutedForeground)
                        }
                    }
                }
            }
        }
    }
}
