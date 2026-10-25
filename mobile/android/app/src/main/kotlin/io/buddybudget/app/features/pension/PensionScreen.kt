package io.buddybudget.app.features.pension

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.InfoHintButton
import io.buddybudget.app.features.investments.InvestmentsChart
import io.buddybudget.app.features.investments.InvestmentsSeries
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.investments.fullBleed
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.R
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.PensionSnapshot
import io.buddybudget.core.data.PensionView
import io.buddybudget.core.domain.pension.PensionGate
import io.buddybudget.core.domain.pension.PensionRules
import io.buddybudget.core.domain.pension.PensionTab
import io.buddybudget.core.domain.pension.PensionText

/**
 * Pensione frame (09-pension): title and subtitle, fund chips when there is more than one (PEN-003), the five tabs as a
 * scrollable segmented bar, the states (PEN-005, PEN-013) and the disclaimer under every tab (PEN-004). IT only.
 * Twin of `PensionScreen` on iOS.
 */
@Composable
fun PensionScreen() {
    val shell = LocalShell.current
    val model = shell.pension
    val c = BuddyBudgetTheme.colors
    LaunchedEffect(Unit) { model.start() }
    val version = remember { mutableStateOf(shell.dataVersion) }
    LaunchedEffect(shell.dataVersion) {
        if (version.value != shell.dataVersion) {
            version.value = shell.dataVersion
            model.load()
        }
    }
    val view = model.state.view
    val hasFund = view?.fund != null
    // #427: with a fund the current tab is the title («Panoramica ⌄», views sheet); without one, title and subtitle.
    BBScreen(if (hasFund) null else tr("Pensione"), onBack = LocalShellBack.current, onRefresh = { model.load() }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            if (view != null && view.fund != null) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    io.buddybudget.app.designsystem.components.SectionViewsHeading(
                        tr("Pensione"),
                        PensionTab.entries.map { tab ->
                            io.buddybudget.app.designsystem.components.SectionViewItem(tab.name, tr(tab.title), tr(tab.description),
                                BBIcon.forKey(tab.iconKey), tab == model.state.tab) { model.select(tab) }
                        },
                        Modifier.padding(top = BBSpacing.space4),
                    )
                    if (view.funds.size > 1) FundChips(model, view.funds)
                }
            } else {
                BBText(tr("Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà"), BBTextStyle.Body,
                    Modifier.offset(y = -BBSpacing.space3), color = c.mutedForeground)
            }
            PensionGateView(model)
        }
    }
    val fund = model.state.fund
    FormDialog(model.importOpen, { model.importOpen = false }) {
        if (fund != null && model.importOpen) PensionImportView(model, fund)
    }
}

@Composable
fun pensionText(): PensionText {
    val strings = LocalStrings.current
    return PensionText(LocalBBLocale.current) { strings.lookup(it) }
}

/** PEN-003. */
@Composable
private fun FundChips(model: PensionModel, funds: List<PensionView.FundSummary>) {
    val c = BuddyBudgetTheme.colors
    val label = tr("Fondo")
    Row(Modifier.horizontalScroll(rememberScrollState()).semantics { contentDescription = label }, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        funds.forEach { fund ->
            val active = fund.id == model.state.fundId
            BBText(fund.name, if (active) BBTextStyle.BodyStrong else BBTextStyle.Body,
                Modifier.height(30.dp).background(if (active) c.alphaPrimary10 else Color.Transparent, CircleShape)
                    .border(1.dp, if (active) c.primary else c.border, CircleShape)
                    .bbPressable({ model.selectFund(fund.id) }, CircleShape, translate = false)
                    .padding(horizontal = BBSpacing.space3, vertical = 5.dp),
                color = if (active) c.primary else c.mutedForeground, maxLines = 1)
        }
    }
}

@Composable
private fun PensionGateView(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    when (model.state.gate) {
        PensionGate.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 208.dp, radius = BBRadius.xl)
            BBSkeleton(Modifier.fillMaxWidth(), height = 128.dp, radius = BBRadius.xl)
        }
        PensionGate.Failed -> LoadError(tr("Impossibile caricare i dati della pensione."), { model.retry() })
        PensionGate.Unavailable -> io.buddybudget.app.features.shell.CountryUnavailableState()
        PensionGate.Empty -> PanelSection(tr("Aggiungi il tuo fondo pensione"), BBIcon.Umbrella, color = c.swatchTeal,
            description = tr("Ti basta inserire, ogni tanto, i due numeri che vedi nell'area clienti del fondo: contributi netti e controvalore. Da lì calcoliamo rendimento, quanto ti resterebbe prelevando oggi, il confronto col TFR in azienda e dove arriverai.")) {
            AddFundForm(model)
        }
        PensionGate.Content -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
            when (model.state.tab) {
                PensionTab.Overview -> PensionOverviewTab(model)
                PensionTab.Trend -> PensionTrendTab(model)
                PensionTab.Scenarios -> PensionScenariosTab(model)
                PensionTab.Projection -> PensionProjectionTab(model)
                PensionTab.Data -> PensionDataTab(model)
            }
            BBText(tr("Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista."),
                BBTextStyle.Caption, color = c.text2)
        }
    }
}

/** PEN-013. */
@Composable
fun PensionNoSnapshots(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    PanelSection(tr("Mancano i valori del fondo"), BBIcon.Database, color = c.primary) {
        Text(buildAnnotatedString {
            withStyle(SpanStyle(color = c.text2)) { append(tr("Inserisci contributi netti e controvalore dalla scheda")) }
            withStyle(SpanStyle(color = c.primary, fontWeight = FontWeight.SemiBold)) { append(" " + tr("I tuoi dati")) }
            withStyle(SpanStyle(color = c.text2)) { append(tr(": al resto pensiamo noi.")) }
        }, Modifier.bbPressable({ model.select(PensionTab.Data) }, CircleShape, translate = false), style = BBTextStyle.Body.style)
    }
}

// ---------------------------------------------------------------- Panoramica (PEN-019…021)

@Composable
private fun PensionOverviewTab(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    val text = pensionText()
    val hidden = LocalHideAmounts.current
    val view = model.state.view
    val fund = view?.fund
    val perf = view?.performance
    if (view == null || fund == null || perf == null || !model.state.hasSnapshots) {
        PensionNoSnapshots(model)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) PensionHero(model, fund, perf, text)
        PanelSection(tr("Dove stai andando"), BBIcon.Compass, color = c.swatchTeal) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                val beats = PensionRules.beatsTfr(view)
                Insight(model, "Fondo o TFR in azienda", if (beats) "Il fondo rende più della rivalutazione del TFR lasciato in azienda."
                    else "Il TFR in azienda si rivaluta più di quanto ha reso il fondo finora.", PensionTab.Scenarios) {
                    Text(buildAnnotatedString {
                        withStyle(SpanStyle(color = if (beats) c.pos else c.neg)) { append(perf.annualReturn?.let { text.percent(it) } ?: "—") }
                        withStyle(SpanStyle(color = c.text2, fontSize = 16.sp, fontFamily = BBTextStyle.BodyLarge.style.fontFamily)) {
                            append(" ${tr("contro")} ${text.percent(view.tfr?.annualRate ?: 0.0)}")
                        }
                    }, style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"), color = c.foreground)
                }
                view.scenarios.firstOrNull()?.let { pension ->
                    Insight(model, "Se prelevassi oggi", "Netto stimato alla pensione, tasse comprese.", PensionTab.Scenarios) {
                        Text(buildAnnotatedString {
                            append(text.money(pension.netLow, model.currency, hidden))
                            withStyle(SpanStyle(color = c.text2)) { append(" –") }
                            append(text.money(pension.netHigh, model.currency, hidden))
                        }, style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"), color = c.foreground)
                    }
                }
                Insight(model, tr("Tra {0} anni", mapOf("0" to PensionRules.PREVIEW_YEARS.toString())), "Scenario base, in euro di oggi: già al netto dell'inflazione.",
                    PensionTab.Projection) {
                    BBText(text.money(view.projection.preview?.base ?: 0.0, model.currency, hidden), style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"))
                }
            }
        }
    }
}

@Composable
private fun Insight(model: PensionModel, eyebrow: String, caption: String, tab: PensionTab, headline: @Composable () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth().bbPressable({ model.select(tab) }, androidx.compose.foundation.shape.RoundedCornerShape(0.dp), translate = false)) {
        Column(Modifier.padding(top = BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr(eyebrow), BBTextStyle.Body, color = c.text2)
            headline()
            BBText(tr(caption), BBTextStyle.Body, color = c.text2)
            Row(Modifier.padding(top = BBSpacing.space1), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr("Vedi i dettagli"), style = BBStyles.link, color = c.primary)
                BBIconView(BBIcon.ArrowRight, size = 16.dp, color = c.primary)
            }
        }
    }
}

@Composable
private fun PensionHero(model: PensionModel, fund: PensionView.Fund, perf: PensionView.Performance, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val up = perf.gain >= 0
    val tone = if (up) c.pos else c.neg
    Column {
        BBText(text.heroEyebrow(fund.name, perf.lastDate), BBTextStyle.BodyLarge, color = c.text2)
        MoneyHero(perf.value, model.currency)
        Row(Modifier.padding(top = BBSpacing.space3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBIconView(if (up) BBIcon.TrendingUp else BBIcon.TrendingDown, size = 16.dp, color = tone)
                BBText(text.signedMoney(perf.gain, model.currency, hidden), style = BBTextStyle.Mono.style.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.W600),
                    color = tone)
            }
            BBText(text.gainCaption(perf.gain), BBTextStyle.Body, color = c.text2)
        }
        Box(Modifier.padding(top = BBSpacing.space2)) { PensionTrendChart(model, fund.snapshots, text) }
        Column(Modifier.padding(top = BBSpacing.space5), verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                Measure(tr("Versato"), text.money(perf.netContributions, model.currency, hidden), Modifier.weight(1f))
                Measure(tr("Sui contributi"), perf.gainPct?.let { text.signedPercent(it) } ?: "—", Modifier.weight(1f), tone)
            }
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBText(text.annualReturnLabel(perf.approximate), BBTextStyle.Body, color = c.text2)
                    InfoHintButton(tr("Come si calcola il rendimento annuo"),
                        tr("Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima."))
                }
                BBText(perf.annualReturn?.let { text.signedPercent(it) } ?: "—", style = BBStyles.figure.copy(fontFeatureSettings = "tnum"))
            }
        }
    }
}

@Composable
private fun Measure(label: String, value: String, modifier: Modifier, color: Color = BuddyBudgetTheme.colors.foreground) {
    Column(modifier) {
        BBText(label, BBTextStyle.Body, color = BuddyBudgetTheme.colors.text2)
        BBText(value, style = BBStyles.figure.copy(fontFeatureSettings = "tnum"), color = color)
    }
}

/** PEN-020. */
@Composable
fun PensionTrendChart(model: PensionModel, snapshots: List<PensionSnapshot>, text: PensionText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    var selection by remember { mutableStateOf<Int?>(null) }
    if (snapshots.size < PensionRules.MIN_CHART_POINTS) {
        BBText(tr("Il grafico compare dalla seconda fotografia del fondo."), BBTextStyle.Body, color = c.text2)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        InvestmentsChart(snapshots.size, listOf(
            InvestmentsSeries("value", snapshots.map { it.value }, c.primary, InvestmentsSeries.Style.Line, 2.6.dp),
            InvestmentsSeries("contributions", snapshots.map { it.netContributions }, c.swatchSlate, InvestmentsSeries.Style.AreaStep),
        ), tr("Andamento del fondo"), selection, { selection = it }, height = 260.dp, zeroBased = true) { i ->
            val s = snapshots[i]
            BBText(text.chartDate(s.date), BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
            BBText("${tr("Controvalore")} ${text.money(s.value, model.currency, hidden)}", BBTextStyle.Caption, maxLines = 1)
            BBText("${tr("Contributi netti")} ${text.money(s.netContributions, model.currency, hidden)}", BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
        }
        ChartAxisLabels(snapshots.map { text.chartDate(it.date) })
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space5, Alignment.CenterHorizontally)) {
            LegendDot(tr("Controvalore"), c.primary)
            LegendDot(tr("Contributi netti"), c.mutedForeground.copy(alpha = 0.6f))
        }
    }
}

/** First, middle and last x labels under a chart. */
@Composable
fun ChartAxisLabels(labels: List<String>) {
    val c = BuddyBudgetTheme.colors
    if (labels.isEmpty()) return
    val picks = setOf(0, labels.size / 2, labels.size - 1).sorted()
    Row(Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space1).clearAndSetSemantics {}) {
        picks.forEachIndexed { index, i ->
            if (index > 0) Spacer(Modifier.weight(1f))
            BBText(labels[i], BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
        }
    }
}

/** 8 dp dot + caption. */
@Composable
fun LegendDot(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        Box(Modifier.size(8.dp).background(color, CircleShape))
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.text2, maxLines = 1)
    }
}

// ---------------------------------------------------------------- Andamento (PEN-020, PEN-022)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PensionTrendTab(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    val text = pensionText()
    val hidden = LocalHideAmounts.current
    val view = model.state.view
    val fund = view?.fund
    if (view == null || fund == null || fund.snapshots.isEmpty()) {
        PensionNoSnapshots(model)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) PanelSection(tr("Andamento del fondo"), BBIcon.ChartLine, color = c.primary,
            description = tr("I contributi versati e il controvalore del fondo, fotografia dopo fotografia.")) {
            PensionTrendChart(model, fund.snapshots, text)
        }
        PanelSection(tr("Anno per anno"), BBIcon.ChartNoAxesColumn, color = c.swatchGreen,
            description = tr("Quanto hai versato e quanto ha reso il fondo in ogni anno, anche in percentuale: rendimento diviso per il valore a inizio anno più i versamenti. * anno in corso, non annualizzato.")) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                YearlyBars(view.yearly)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space5, Alignment.CenterHorizontally)) {
                    LegendDot(tr("Versato"), c.primary)
                    LegendDot(tr("Rendimento"), c.pos)
                    LegendDot(tr("Perdita"), c.neg)
                }
                val label = tr("Rendimento percentuale per anno")
                FlowRow(Modifier.fillMaxWidth().semantics { contentDescription = label }, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space5),
                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    view.yearly.forEach { year ->
                        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                            BBText(if (year.partial) "${year.year}*" else year.year.toString(), BBTextStyle.Body, color = c.text2)
                            BBText(year.returnRate?.let { text.signedPercent(it) } ?: tr("n.d."),
                                style = BBTextStyle.Body.style.copy(fontWeight = FontWeight.W600, fontFeatureSettings = "tnum"),
                                color = if (year.returnRate == null) c.text2 else if (year.gain < 0) c.neg else c.pos)
                        }
                    }
                }
                PensionRules.bestAndWorst(view.yearly)?.let { (best, worst) ->
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                        YearStat(tr("Anno migliore"), best, c.pos, text, model.currency, hidden)
                        YearStat(tr("Anno peggiore"), worst, if (worst.gain < 0) c.neg else c.foreground, text, model.currency, hidden)
                    }
                }
            }
        }
    }
}

@Composable
private fun YearStat(label: String, year: PensionView.Year, color: Color, text: PensionText, currency: String, hidden: Boolean) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = BBSpacing.space3)) {
            BBText(label, BBTextStyle.Body, color = c.text2)
            Text(buildAnnotatedString {
                withStyle(SpanStyle(color = color)) { append("${year.year} · ${text.signedMoney(year.gain, currency, hidden)}") }
                year.returnRate?.let { r ->
                    withStyle(SpanStyle(color = c.text2, fontSize = 14.sp, fontFamily = BBTextStyle.Body.style.fontFamily)) { append(" (${text.signedPercent(r)})") }
                }
            }, style = BBStyles.figure.copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** PEN-022: stacked bars per year (contributions + gain above zero, loss below). */
@Composable
private fun YearlyBars(years: List<PensionView.Year>) {
    val c = BuddyBudgetTheme.colors
    val top = maxOf(years.maxOfOrNull { it.contributions + maxOf(0.0, it.gain) } ?: 1.0, 1.0)
    val bottom = years.minOfOrNull { minOf(0.0, it.gain) } ?: 0.0
    val range = top - bottom
    Column(Modifier.clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Canvas(Modifier.fillMaxWidth().height(240.dp)) {
            val h = size.height
            val zeroY = (h * top / range).toFloat()
            drawLine(c.border, Offset(0f, zeroY), Offset(size.width, zeroY), 1.dp.toPx())
            val slot = size.width / maxOf(1, years.size)
            val barW = minOf(48.dp.toPx(), slot * 0.6f)
            val r = 4.dp.toPx()
            years.forEachIndexed { i, year ->
                val x = slot * i + (slot - barW) / 2
                val contrib = (h * year.contributions / range).toFloat()
                val up = (h * maxOf(0.0, year.gain) / range).toFloat()
                val down = (h * -minOf(0.0, year.gain) / range).toFloat()
                drawRect(c.primary, Offset(x, zeroY - contrib), Size(barW, contrib))
                if (up > 0) drawPath(Path().apply {
                    addRoundRect(RoundRect(x, zeroY - contrib - up, x + barW, zeroY - contrib, topLeftCornerRadius = CornerRadius(r), topRightCornerRadius = CornerRadius(r)))
                }, c.pos)
                if (down > 0) drawPath(Path().apply {
                    addRoundRect(RoundRect(x, zeroY, x + barW, zeroY + down, bottomLeftCornerRadius = CornerRadius(r), bottomRightCornerRadius = CornerRadius(r)))
                }, c.neg)
            }
        }
        Row(Modifier.fillMaxWidth()) {
            years.forEach { year ->
                BBText(if (year.partial) "${year.year}*" else year.year.toString(), style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center),
                    color = c.mutedForeground, modifier = Modifier.weight(1f))
            }
        }
    }
}
