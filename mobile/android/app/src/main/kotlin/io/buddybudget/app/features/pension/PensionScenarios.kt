package io.buddybudget.app.features.pension

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSlider
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.InfoHintButton
import io.buddybudget.app.features.investments.InvestmentsChart
import io.buddybudget.app.features.investments.InvestmentsSeries
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.investments.RunsText
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.investments.fullBleed
import io.buddybudget.app.tr
import io.buddybudget.core.data.PensionView
import io.buddybudget.core.domain.pension.PensionCalc
import io.buddybudget.core.domain.pension.PensionRules
import io.buddybudget.core.domain.pension.PensionText
import kotlin.math.roundToInt

// Pensione «Scenari» (PEN-023…026) and «Proiezione» (PEN-027/028). Twin of PensionScenarios.swift.

@Composable
fun PensionScenariosTab(model: PensionModel) {
    val text = pensionText()
    val view = model.state.view
    val last = view?.last
    val perf = view?.performance
    val tfr = view?.tfr
    if (view == null || last == null || perf == null || tfr == null) {
        PensionNoSnapshots(model)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) WithdrawalSection(model, view, last.value, text)
        if (debugShows(1)) TfrSection(model, view, last.value, perf.annualReturn, tfr, text)
        view.fund?.let { TaxSection(model, view, it.adhesionDate, text) }
    }
}

@Composable
private fun SectionHead(icon: BBIcon, color: androidx.compose.ui.graphics.Color, title: String) {
    // #427: the title stands alone (`icon`/`color` are kept for the call sites).
    BBText(title, Modifier.semantics { heading() }, style = BBStyles.sectionHeading)
}

/** PEN-023. */
@Composable
private fun WithdrawalSection(model: PensionModel, view: PensionView, value: Double, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val simulating = model.state.isSimulating
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        SectionHead(BBIcon.Wallet, c.swatchOrange, tr("Se prelevassi oggi"))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            Text(buildAnnotatedString {
                if (simulating) withStyle(SpanStyle(color = c.foreground, fontWeight = FontWeight.Medium)) {
                    append(tr("Simulazione dell'aliquota in corso (vedi «Quando l'aliquota scende»).") + " ")
                }
                withStyle(SpanStyle(color = c.text2)) { append(tr("Quanto ti resterebbe al netto delle tasse, in tre ipotesi. È una stima, non consulenza fiscale.")) }
            }, Modifier.weight(1f, fill = false), style = BBTextStyle.Body.style)
            InfoHintButton(tr("Come si stima il netto"),
                tr("Il valore alto presuppone che l'imposta si applichi solo ai contributi (i rendimenti hanno già pagato il 20% mentre maturavano). Il valore basso applica l'aliquota a tutto il controvalore. Quale sia giusto per te va confermato da un commercialista; non sono incluse eventuali penali del prodotto."))
        }
        Column(Modifier.padding(top = BBSpacing.space1), verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            model.state.scenarios.forEach { scenario ->
                val total = maxOf(value, 1.0)
                val baseline = view.scenarios.firstOrNull { it.reason == scenario.reason }?.netLow ?: scenario.netLow
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                        BBText(text.reasonTitle(scenario.reason), style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W600), modifier = Modifier.weight(1f))
                        Text(buildAnnotatedString {
                            append(text.money(scenario.netLow, model.currency, hidden))
                            withStyle(SpanStyle(color = c.text2)) { append(" – ") }
                            append(text.money(scenario.netHigh, model.currency, hidden))
                        }, style = BBStyles.figure.copy(fontFeatureSettings = "tnum"), color = c.foreground)
                    }
                    val label = tr("Netto tra {0} e {1} su {2}", mapOf("0" to text.money(scenario.netLow, model.currency),
                        "1" to text.money(scenario.netHigh, model.currency), "2" to text.money(value, model.currency)))
                    BoxWithConstraints(Modifier.fillMaxWidth().height(14.dp).clip(CircleShape).background(c.neg.copy(alpha = 0.25f))
                        .semantics { contentDescription = label }) {
                        val full = maxWidth
                        Row {
                            Box(Modifier.width(full * maxOf(0.0, scenario.netLow / total).toFloat()).fillMaxHeight().background(c.primary))
                            Box(Modifier.width(full * maxOf(0.0, (scenario.netHigh - scenario.netLow) / total).toFloat()).fillMaxHeight().background(c.alphaPrimary45))
                        }
                    }
                    RunsText(text.scenarioDetail(scenario, if (simulating) scenario.netLow - baseline else 0.0, model.currency, hidden), style = BBTextStyle.Body.style)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                LegendDot(tr("Netto sicuro"), c.primary)
                LegendDot(tr("Netto possibile"), c.alphaPrimary45)
                LegendDot(tr("Tasse"), c.neg.copy(alpha = 0.4f))
            }
        }
    }
}

/** PEN-024. */
@Composable
private fun TfrSection(model: PensionModel, view: PensionView, fundValue: Double, annualReturn: Double?, tfr: PensionView.Tfr, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val top = maxOf(fundValue, tfr.net, 1.0)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        SectionHead(BBIcon.Scale, c.swatchBlue, tr("Fondo o TFR in azienda?"))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr("Gli stessi versamenti, in due posti diversi."), BBTextStyle.Body, Modifier.weight(1f, fill = false), color = c.text2)
            InfoHintButton(tr("Come funziona il confronto"),
                tr("In azienda il TFR si rivaluta ogni anno dell'1,5% più il 75% dell'inflazione, con un'imposta sostitutiva sulla rivalutazione. Il confronto usa un'inflazione costante e non include le tasse all'uscita (diverse nei due casi). Regole da validare con un professionista."))
        }
        Column(Modifier.padding(top = BBSpacing.space1), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            listOf(Triple(tr("Nel fondo"), fundValue to annualReturn, c.primary), Triple(tr("In azienda, rivalutato"), tfr.net to tfr.annualRate, c.mutedForeground.copy(alpha = 0.5f)))
                .forEach { (label, pair, color) ->
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                            BBText(label, style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W600), modifier = Modifier.weight(1f))
                            BBText(text.money(pair.first, model.currency, hidden), style = BBStyles.figure.copy(fontFeatureSettings = "tnum"))
                        }
                        Box(Modifier.fillMaxWidth().height(14.dp).clip(CircleShape).background(c.alphaForeground10.copy(alpha = c.alphaForeground10.alpha * 0.6f))) {
                            Box(Modifier.fillMaxWidth((pair.first / top).toFloat()).fillMaxHeight().clip(CircleShape).background(color))
                        }
                        BBText(pair.second?.let { tr("{0} l'anno", mapOf("0" to text.percent(it))) } ?: tr("rendimento non calcolabile"), BBTextStyle.Body, color = c.text2)
                    }
                }
        }
        RunsText(text.tfrConclusion(fundValue, tfr, view.assumedInflation, model.currency, hidden), Modifier.padding(top = BBSpacing.space1), style = BBTextStyle.Body.style)
    }
}

/** PEN-025/026. */
@Composable
private fun TaxSection(model: PensionModel, view: PensionView, adhesionDate: String, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    PanelSection(tr("Quando l'aliquota scende"), BBIcon.Percent, color = c.swatchPurple,
        description = tr("Sui contributi dal 2007 l'imposta in uscita è il 15%, ridotta di 0,30 punti per ogni anno oltre il quindicesimo di partecipazione, fino al 9%. Conta dalla prima adesione.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            TaxTimeline(model, view, adhesionDate, text)
            RunsText(text.taxSimulation(model.state, adhesionDate, model.currency, hidden), style = BBTextStyle.Body.style)
            if (model.state.isSimulating) BBButton(tr("Torna a oggi"), { model.setSimulatedYears(null) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
    }
}

@Composable
private fun TaxTimeline(model: PensionModel, view: PensionView, adhesionDate: String, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val maxYears = view.exitTax.maxYears
    val shown = model.state.shownYears
    val real = minOf(maxYears, view.exitTax.realYears)
    val flat = PensionRules.FLAT_YEARS.toFloat() / maxYears
    val rate = text.percent(PensionCalc.exitTaxRate(shown.toDouble()))
    val milestones = PensionCalc.exitTaxMilestones(adhesionDate)
    val label = tr("Anni di partecipazione al fondo, per simulare l'aliquota in uscita")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BoxWithConstraints(
            Modifier.fillMaxWidth().height(38.dp)
                .pointerInput(maxYears) {
                    fun update(x: Float) {
                        val years = ((x / size.width).coerceIn(0f, 1f) * maxYears).roundToInt()
                        if (years != model.state.shownYears) model.setSimulatedYears(years)
                    }
                    detectDragGestures(onDragStart = { update(it.x) }) { change, _ ->
                        update(change.position.x)
                    }
                }
                .pointerInput(maxYears) { detectTapGestures { pos -> model.setSimulatedYears(((pos.x / size.width).coerceIn(0f, 1f) * maxYears).roundToInt()) } }
                .semantics {
                    contentDescription = label
                    stateDescription = "$shown · $rate"
                    progressBarRangeInfo = ProgressBarRangeInfo(shown.toFloat(), 0f..maxYears.toFloat(), maxYears - 1)
                    setProgress { v -> model.setSimulatedYears(v.roundToInt().coerceIn(0, maxYears)); true }
                },
        ) {
            val w = maxWidth
            Row(Modifier.padding(top = 26.dp).fillMaxWidth().height(12.dp).clip(CircleShape)) {
                Box(Modifier.width(w * flat).fillMaxHeight().background(c.neg.copy(alpha = 0.7f)))
                Box(Modifier.weight(1f).fillMaxHeight().background(c.pos.copy(alpha = 0.7f)))
            }
            if (shown != real) {
                Box(Modifier.padding(top = 26.dp).offset(x = w * (real.toFloat() / maxYears) - 1.dp).size(2.dp, 12.dp).background(c.foreground.copy(alpha = 0.4f), CircleShape))
            }
            Column(Modifier.centeredAt(w * (shown.toFloat() / maxYears)), horizontalAlignment = Alignment.CenterHorizontally) {
                BBText(rate, style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500, fontFeatureSettings = "tnum"), color = c.background,
                    modifier = Modifier.background(c.foreground, RoundedCornerShape(BBRadius.md)).padding(horizontal = BBSpacing.space1_5, vertical = BBSpacing.space0_5))
                Box(Modifier.size(1.dp, 14.dp).background(c.foreground))
            }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().height(36.dp)) {
            val w = maxWidth
            Mark(adhesionDate.take(4), tr("Adesione"), Alignment.Start, Modifier)
            Mark(milestones.reductionStartsOn.take(4), tr("Inizia a scendere"), Alignment.CenterHorizontally, Modifier.centeredAt(w * flat))
            Mark(milestones.minRateOn.take(4), tr("Minimo"), Alignment.End, Modifier.align(Alignment.TopEnd))
        }
    }
}

/** Places the node so that its horizontal centre is at [x]. */
private fun Modifier.centeredAt(x: androidx.compose.ui.unit.Dp): Modifier = layout { measurable, constraints ->
    val placeable = measurable.measure(constraints.copy(minWidth = 0))
    layout(placeable.width, placeable.height) { placeable.place(x.roundToPx() - placeable.width / 2, 0) }
}

@Composable
private fun Mark(title: String, caption: String, alignment: Alignment.Horizontal, modifier: Modifier) {
    Column(modifier.wrapContentWidth(), horizontalAlignment = alignment) {
        BBText(title, style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500, fontFeatureSettings = "tnum"))
        BBText(caption, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.text2)
    }
}

// ---------------------------------------------------------------- Proiezione (PEN-027, PEN-028)

@Composable
fun PensionProjectionTab(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    val text = pensionText()
    val hidden = LocalHideAmounts.current
    val view = model.state.view
    val last = view?.last
    if (view == null || last == null) {
        PensionNoSnapshots(model)
        return
    }
    var selection by remember { mutableStateOf<Int?>(null) }
    val state = model.state
    val rates = view.projection.rates
    val points = PensionRules.projection(last.value, state.quarterly, state.years, rates)
    val end = points.last()
    val paidIn = state.quarterly * 4 * state.years
    PanelSection(tr("Proiezione a pensione"), BBIcon.Hourglass, color = c.swatchTeal,
        description = tr("In euro di oggi, quindi già al netto dell'inflazione. Una stima, non una promessa.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            if (debugShows(0)) Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                ScenarioFigure("Prudente", rates.prudent, end.prudent, c.swatchSlate, last.value, paidIn, state.years, text, model.currency)
                ScenarioFigure("Base", rates.base, end.base, c.primary, last.value, paidIn, state.years, text, model.currency, strong = true)
                ScenarioFigure("Ottimistico", rates.optimistic, end.optimistic, c.swatchTeal, last.value, paidIn, state.years, text, model.currency)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                InvestmentsChart(points.size, listOf(
                    InvestmentsSeries("base", points.map { it.base }, c.primary, InvestmentsSeries.Style.Line, 2.6.dp),
                    InvestmentsSeries("band", points.map { it.optimistic }, c.primary, InvestmentsSeries.Style.Fill),
                    InvestmentsSeries("optimistic", points.map { it.optimistic }, c.swatchTeal, InvestmentsSeries.Style.Dashed, 1.5.dp),
                    InvestmentsSeries("prudent", points.map { it.prudent }, c.swatchSlate, InvestmentsSeries.Style.Dashed, 1.5.dp),
                ), tr("Proiezione a pensione"), selection, { selection = it }, zeroBased = true) { i ->
                    val p = points[i]
                    BBText(tr("Tra {0} anni", mapOf("0" to p.year.toString())), BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                    BBText("${tr("Ottimistico")} ${text.money(p.optimistic, model.currency, hidden)}", BBTextStyle.Caption, maxLines = 1)
                    BBText("${tr("Base")} ${text.money(p.base, model.currency, hidden)}", BBTextStyle.Caption, maxLines = 1)
                    BBText("${tr("Prudente")} ${text.money(p.prudent, model.currency, hidden)}", BBTextStyle.Caption, maxLines = 1)
                }
                ChartAxisLabels(points.map { "${it.year}a" })
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                val sliders = view.projection.sliders
                SliderRow(tr("Anni alla pensione"), state.years.toString(), state.years.toDouble(), { model.setProjection(years = it.roundToInt()) },
                    sliders.years.min..sliders.years.max, 1.0)
                SliderRow(tr("Versamento ogni trimestre"), text.money(state.quarterly, model.currency, hidden), state.quarterly, { model.setProjection(quarterly = it) },
                    sliders.quarterlyContribution.min..sliders.quarterlyContribution.max, sliders.quarterlyContribution.step, tr("Versamento trimestrale"))
            }
            RunsText(text.paidInSentence(paidIn, model.currency, hidden), style = BBTextStyle.Body.style)
        }
    }
}

@Composable
private fun ScenarioFigure(label: String, rate: Double, value: Double, color: androidx.compose.ui.graphics.Color, start: Double, paidIn: Double, years: Int,
    text: PensionText, currency: String, strong: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Box(Modifier.size(10.dp).background(color, CircleShape))
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(color = if (strong) c.foreground else c.text2, fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal)) { append(tr(label)) }
                    withStyle(SpanStyle(color = c.text2)) { append(" ${tr("· rendimento reale")} ${text.percent(rate, 0)}") }
                }, style = BBTextStyle.Body.style)
            }
            BBText(text.money(value, currency, hidden), style = BBTextStyle.StatValue.style.copy(fontFeatureSettings = "tnum"))
            BBText(text.projectionCaption(years, value - start - paidIn, currency, hidden), BBTextStyle.Body, color = c.text2)
        }
    }
}

@Composable
private fun SliderRow(label: String, value: String, current: Double, onChange: (Double) -> Unit, range: ClosedFloatingPointRange<Double>, step: Double,
    accessibility: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            BBText(label, BBTextStyle.Body, Modifier.weight(1f), color = c.text2)
            BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 28.sp, fontFeatureSettings = "tnum"))
        }
        BBSlider(current, onChange, range = range, step = step, accessibilityLabel = accessibility ?: label)
    }
}
