package io.buddybudget.app.features.investments

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBBadge
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBSwitchSize
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.PositionRow
import io.buddybudget.core.data.TitleItem
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.InvestmentsPeriod
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.InvestmentsTab
import io.buddybudget.core.domain.investments.InvestmentsText
import io.buddybudget.core.domain.investments.PortfolioHero
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.abs

/** Investimenti › Portafoglio (INV-011…030). iOS: PortfolioTab.swift. */
@Composable
fun PortfolioTab(model: InvestmentsModel) {
    val query = model.state.portfolioQuery
    InvestmentsGateView(model.gate(query, countsCash = true), model, { model.launch { model.loadPortfolio() } }) {
        val view = model.views[query] ?: return@InvestmentsGateView
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
            if (debugShows(0)) PortfolioHeroSection(model, view)
            if (debugShows(1)) PositionsSection(model, view)
            if (debugShows(2)) WatchedTitlesSection(model)
            if (debugShows(3)) DividendsSummary(view) { model.select(InvestmentsTab.Income) }
            CostDetails(view, model.countryContent == InvestmentsCountryContent.Italian) { model.select(InvestmentsTab.Taxes) }
        }
    }
}

@Composable
fun investmentsText(): InvestmentsText {
    val strings = LocalStrings.current
    return InvestmentsText(LocalBBLocale.current, LocalHideAmounts.current) { strings.lookup(it) }
}

// ---------------------------------------------------------------- Hero

@Composable
private fun PortfolioHeroSection(model: InvestmentsModel, view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val text = investmentsText()
    val hide = LocalHideAmounts.current
    val hero = PortfolioHero.of(view, model.state.reinvestFees, model.state.reinvestTaxes)
    val currency = view.currency
    val summary = view.summary
    var selection by remember { mutableStateOf<Int?>(null) }
    var costsOpen by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr("Il tuo portafoglio"), style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.Medium), color = c.mutedForeground)
            MoneyHero(hero.value, currency)
            val change = summary.dayChange
            val pct = summary.dayChangePct
            if (hero.showsDayChange && change != null && pct != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBIconView(if (change < 0) BBIcon.TrendingDown else BBIcon.TrendingUp, size = 16.dp, color = signedColor(change))
                    val line = buildAnnotatedString {
                        withStyle(SpanStyle(color = signedColor(change))) { append(text.dayChange(change, pct, currency, hide)) }
                        withStyle(SpanStyle(color = c.mutedForeground)) { append(" " + tr("dall'ultima chiusura")) }
                    }
                    Text(line, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
                }
            }
            if (view.brokerCash.isNotEmpty()) {
                BBText(text.cashLine(view.cashTotal, summary.totalValue + view.cashTotal, currency, hide), BBTextStyle.Body, color = c.mutedForeground)
            }
            if (hero.simulating) BBText(text.simulationLine(hero.extra, currency, hide), BBTextStyle.Body, color = c.mutedForeground)
        }
        if (view.series.isEmpty()) {
            BBText(tr("Nessun dato disponibile nel periodo selezionato."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            val series = buildList {
                add(InvestmentsSeries("value", hero.values, c.primary, InvestmentsSeries.Style.Area))
                hero.registered?.let { add(InvestmentsSeries("registered", it, c.foreground, InvestmentsSeries.Style.Line, 1.5.dp)) }
                add(InvestmentsSeries("invested", hero.invested, c.mutedForeground, InvestmentsSeries.Style.DashedStep, 1.5.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                InvestmentsChart(view.series.size, series, tr("Il tuo portafoglio"), selection, { selection = it },
                    Modifier.fullBleed()) { i ->
                    val point = view.series[i]
                    val value = hero.values[i]
                    val diff = value - point.invested
                    BBText(CalendarDate.parse(point.date)?.let { BBFormat.formatLongDate(it, text.locale) } ?: point.date, BBTextStyle.Caption,
                        color = c.mutedForeground, maxLines = 1)
                    BBText("${tr("Valore")} ${text.money(value, currency)}", BBTextStyle.Caption, maxLines = 1)
                    BBText("${tr("Versato")} ${text.money(point.invested, currency)}", BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                    BBText("${if (diff < 0) BBFormat.MINUS_SIGN else "+"}${text.money(abs(diff), currency)}", BBTextStyle.Caption, color = signedColor(diff), maxLines = 1)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4, Alignment.CenterHorizontally)) {
                    ChartLegendItem(tr("Valore") + if (hero.simulating) tr(" simulato") else "", c.primary)
                    if (hero.simulating) ChartLegendItem(tr("Valore registrato (senza simulazione)"), c.foreground)
                    ChartLegendItem(tr("Versato (acquisti meno vendite)"), c.mutedForeground, dashed = true)
                }
            }
        }
        InvestmentsPeriodSelector(model.state.period, model.state.customRange, model.state.today, { model.setPeriod(it) }, { model.applyCustomRange(it) })
        CostsButton(model) { costsOpen = true }
        if (!hero.simulating) {
            val gain = view.periodGain
            if (gain != null && model.state.period != InvestmentsPeriod.Max) {
                RunsText(text.periodGainSentence(gain, currency, hide))
            } else {
                RunsText(text.gainSentence(view.breakdown, summary.unpricedCount, currency, hide))
                ValueBreakdownBar(view.breakdown, currency)
            }
        }
    }
    BBSheet(costsOpen, { costsOpen = false }, tr("E se costi e imposte fossero rimasti investiti?")) { ReinvestmentPanel(model, view) }
}

@Composable
private fun CostsButton(model: InvestmentsModel, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val count = model.state.simulationCount
    val active = count > 0
    val shape = RoundedCornerShape(50)
    val label = if (active) tr("Costi e imposte: simulazione attiva su {0} di 2", mapOf("0" to count.toString())) else tr("Costi e imposte: simulazione spenta")
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Row(
            Modifier.height(32.dp).background(if (active) c.alphaPrimary10 else Color.Transparent, shape)
                .border(1.dp, if (active) c.primary.copy(alpha = 0.4f) else c.border, shape)
                .bbPressable(onClick, shape, translate = false).semantics { contentDescription = label }
                .padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            BBIconView(BBIcon.SlidersHorizontal, size = 14.dp, color = if (active) c.primary else c.mutedForeground)
            BBText(tr("Costi e imposte"), BBTextStyle.Body, color = if (active) c.primary else c.mutedForeground)
            if (active) BBText("·$count", BBTextStyle.Body, color = c.primary)
        }
    }
}

/** INV-013. */
@Composable
private fun ValueBreakdownBar(breakdown: InvestmentsView.Breakdown, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val gaining = breakdown.market >= 0
    val whole = if (gaining) breakdown.value else breakdown.paid
    val first = if (gaining) breakdown.paid else breakdown.value
    val money = { v: Double -> BBFormat.formatCurrency(v, currency, locale, maximumFractionDigits = 0, masked = hide) }
    val marketColor = if (gaining) c.pos else c.neg.copy(alpha = 0.7f)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(Modifier.fillMaxWidth().height(12.dp).clip(CircleShape).background(c.muted)) {
            val a = if (whole > 0) (first / whole).coerceIn(0.0, 1.0) else 0.0
            val b = if (whole > 0) (abs(breakdown.market) / whole).coerceIn(0.0, 1.0) else 0.0
            if (a > 0) Box(Modifier.weight(a.toFloat()).height(12.dp).background(c.primary))
            if (b > 0) Box(Modifier.weight(b.toFloat()).height(12.dp).background(marketColor))
            val rest = 1.0 - a - b
            if (rest > 0.0001) Spacer(Modifier.weight(rest.toFloat()))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Legend(c.primary, tr(if (gaining) "Pagato" else "Vale oggi"), money(first), c.foreground)
            Legend(marketColor, tr(if (gaining) "Dal mercato" else "Perso"), "${if (gaining) "+" else BBFormat.MINUS_SIGN}${money(abs(breakdown.market))}",
                if (gaining) c.pos else c.neg)
        }
    }
}

@Composable
private fun Legend(color: Color, label: String, value: String, valueColor: Color) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        Box(Modifier.size(8.dp).background(color, CircleShape))
        val t = buildAnnotatedString {
            withStyle(SpanStyle(color = c.mutedForeground)) { append("$label ") }
            withStyle(SpanStyle(color = valueColor, fontWeight = FontWeight.Medium)) { append(value) }
        }
        Text(t, style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
    }
}

/** INV-018…020. */
@Composable
private fun ReinvestmentPanel(model: InvestmentsModel, view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val impact = view.costImpact
    val disabled = !impact.available
    @Composable
    fun row(label: String, paid: String, amount: Double, effect: Double, on: Boolean, onChange: (Boolean) -> Unit) {
        Row(Modifier.alpha(if (disabled) 0.6f else 1f), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBSwitch(on, onChange, Modifier.padding(top = 3.dp), size = BBSwitchSize.Sm, accessibilityLabel = tr(label), enabled = !disabled)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(tr(label), BBTextStyle.BodyStrong)
                val paidText = tr(paid, mapOf("0" to BBFormat.formatCurrency(amount, view.currency, locale)))
                val effectText = if (effect > 0) " ${tr("Rimasti investiti, oggi varresti")} ${BBFormat.formatCurrency(effect, view.currency, locale, maximumFractionDigits = 0)} ${tr("in più.")}" else ""
                BBText(paidText + effectText, BBTextStyle.Body, color = c.mutedForeground)
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(tr("Ogni importo pagato torna nel portafoglio il giorno in cui l'hai versato e rende come il resto. Non cambia le tue operazioni."),
            BBTextStyle.Body, color = c.mutedForeground)
        row("Rimetti i costi nel portafoglio", "Commissioni e costi pagati: {0}.", impact.fees, view.reinvestmentEffects.fees, model.state.reinvestFees) {
            model.setReinvest(fees = it)
        }
        row("Rimetti le imposte nel portafoglio",
            if (model.countryContent == InvestmentsCountryContent.Italian) "Imposte registrate e stimate sulle vendite: {0}." else "Imposte registrate: {0}.",
            impact.taxes, view.reinvestmentEffects.taxes, model.state.reinvestTaxes) { model.setReinvest(taxes = it) }
        if (disabled) BBText(tr("Non disponibile finché ogni strumento non ha un prezzo."), BBTextStyle.Body, color = c.mutedForeground)
    }
}

// ---------------------------------------------------------------- Positions

@Composable
private fun PositionsSection(model: InvestmentsModel, view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    var searchOpen by remember { mutableStateOf(false) }
    val rows = view.summary.rows
    val weighted = rows.filter { it.weight != null }
    PanelSection(tr("Posizioni"), BBIcon.ChartPie) {
        // Web phone layout: the instrument search as a full-width field under the title, then the concentration line.
        Row(
            Modifier.fillMaxWidth().height(40.dp).border(1.dp, c.input, RoundedCornerShape(BBRadius.lg))
                .bbPressable({ searchOpen = true }, RoundedCornerShape(BBRadius.lg), translate = false).padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBText(tr("Cerca un titolo"), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground, maxLines = 1)
            BBIconView(BBIcon.ChevronDown, size = 16.dp, color = c.mutedForeground)
        }
        view.concentrationText?.let { BBText(it, BBTextStyle.Body, color = c.mutedForeground) }
        if (weighted.size > 1) StackedBar(weighted.map { bbSwatch(InstrumentIcons.typeSwatch(it.instrument.kind)) to (it.weight ?: 0.0) })
        if (rows.isEmpty()) {
            BBText(tr("Nessuna posizione aperta."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            Column {
                rows.forEachIndexed { i, row ->
                    PositionRowView(row, view.priceNote(row.instrument.id), view.currency, row.instrument.id in model.backfilling,
                        onOpen = { shell.push(ShellRoute.InstrumentRoute(row.instrument.id)) },
                        onManualPrice = { model.manualPriceFor = row.instrument },
                        onRemoteLogo = { model.logosShown = true })
                }
            }
            if (model.logosShown) LogoCredit()
        }
    }
    FormDialog(searchOpen, { searchOpen = false }) {
        BBText(tr("Cerca un titolo"), style = BBStyles.sectionHeading)
        InstrumentSearchContent(model.env, view.instruments, view.currency) { chosen ->
            searchOpen = false
            shell.push(ShellRoute.InstrumentRoute(chosen.id))
        }
    }
}

@Composable
private fun PositionRowView(
    row: PositionRow,
    note: InvestmentsView.PriceNote?,
    currency: String,
    loadingHistory: Boolean,
    onOpen: () -> Unit,
    onManualPrice: () -> Unit,
    onRemoteLogo: () -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val text = investmentsText()
    val hide = LocalHideAmounts.current
    var open by remember { mutableStateOf(false) }
    val rotation by animateFloatAsState(if (open) 180f else 0f, label = "row")
    val weight = row.weight?.let { InvestmentsRules.percent(it) } ?: "—"
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            Row(
                Modifier.weight(1f).bbPressable(onOpen, RoundedCornerShape(BBRadius.md), translate = false).padding(vertical = BBSpacing.space3),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                InstrumentIconView(row.instrument, onRemoteLogo = onRemoteLogo)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(row.instrument.name, BBTextStyle.BodyStrong, Modifier.weight(1f, fill = false), maxLines = 1)
                        if (loadingHistory) BBBadge(tr("Storico in caricamento"), variant = BBBadgeVariant.Secondary)
                    }
                    BBText("${tr(InstrumentIcons.typeLabel(row.instrument.kind))} · $weight", BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val value = row.value
                    if (value != null) AmountText(value, currency, style = BBStyles.rowAmount) else BBText("—", style = BBStyles.rowAmount)
                    BBText(text.positionGain(row, currency, hide), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"),
                        color = signedColor(row.unrealizedGain), maxLines = 1)
                }
            }
            val label = tr("Dettagli di {0}", mapOf("0" to row.instrument.name))
            Box(
                Modifier.size(36.dp).offset(x = 8.dp).bbPressable({ open = !open }, CircleShape, translate = false).semantics { contentDescription = label },
                contentAlignment = Alignment.Center,
            ) { BBIconView(BBIcon.ChevronDown, Modifier.rotate(rotation), color = c.mutedForeground) }
        }
        if (open) {
            val stale = note?.stale == true
            Column(Modifier.padding(start = 48.dp, bottom = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                    Detail(tr("Quantità"), text.quantityWithUnit(row), Modifier.weight(1f))
                    Detail(tr("Carico medio"), row.averagePrice?.let { text.price(it, currency) } ?: "—", Modifier.weight(1f))
                }
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(tr("Ultimo prezzo"), BBTextStyle.Caption, color = c.mutedForeground)
                        BBText(note?.price?.let { if (text.masked) BBFormat.AMOUNT_MASK else it } ?: tr("Nessun prezzo"), BBTextStyle.Body, color = if (stale) c.neg else c.foreground)
                        note?.detail?.let { BBText(it, BBTextStyle.Caption, color = if (stale) c.neg else c.foreground) }
                        note?.hint?.let { BBText(tr(it), BBTextStyle.Caption, color = if (stale) c.neg else c.foreground) }
                    }
                    BBButton(tr("Inserisci prezzo"), onManualPrice, icon = BBIcon.PencilLine, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                }
            }
        }
        val w = row.weight
        if (w != null) FillBar(maxOf(0.01, w), bbSwatch(InstrumentIcons.typeSwatch(row.instrument.kind)), height = 2.dp)
    }
}

@Composable
private fun Detail(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
    }
}

// ---------------------------------------------------------------- Seguiti, dividends, costs

/** «Seguiti» (INV-027, SEC-010/011). */
@Composable
fun WatchedTitlesSection(model: InvestmentsModel) {
    val shell = LocalShell.current
    val items = (model.titles ?: emptyList()).filter { it.watching && !it.held }
    if (items.isEmpty()) return
    PanelSection(tr("Seguiti"), BBIcon.Eye, description = tr("Titoli che osservi senza possederli. Aprine uno per il grafico e gli avvisi di prezzo.")) {
        Column {
            items.forEachIndexed { i, item ->
                TitleRow(item) { shell.push(ShellRoute.InstrumentRoute(item.instrument.id)) }
            }
        }
    }
}

/** One title of the list (SEC-011). */
@Composable
fun TitleRow(item: TitleItem, onOpen: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val instrument = item.instrument
    Row(
        Modifier.fillMaxWidth().bbPressable(onOpen, RoundedCornerShape(BBRadius.md), translate = false).padding(vertical = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        InstrumentIconView(instrument)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            BBText(instrument.name, BBTextStyle.BodyStrong, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr(InstrumentIcons.typeLabel(instrument.kind)), BBTextStyle.Caption, color = c.mutedForeground)
                if (item.held) BBBadge(tr("Posseduto"), variant = BBBadgeVariant.Secondary)
                if (item.watching && !item.held) BBBadge(tr("Seguito"), variant = BBBadgeVariant.Outline)
                if (item.activeAlerts > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBIconView(BBIcon.Bell, size = 12.dp, color = c.mutedForeground)
                        BBText("${item.activeAlerts} ${tr(if (item.activeAlerts == 1) "avviso" else "avvisi")}", BBTextStyle.Caption, color = c.mutedForeground)
                    }
                }
                if (item.triggeredAlerts > 0) {
                    BBBadge(if (item.triggeredAlerts == 1) tr("Avviso scattato") else tr("{0} avvisi scattati", mapOf("0" to item.triggeredAlerts.toString())),
                        variant = BBBadgeVariant.Destructive)
                }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val close = item.lastClose
            if (close != null) BBText(BBFormat.formatPrice(close, instrument.currency, locale), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            else BBText(tr("Nessun prezzo"), BBTextStyle.Caption, color = c.mutedForeground)
            val change = item.dayChange
            if (change != null) BBText(BBFormat.formatSignedPct(change, locale), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = signedColor(change))
            else BBText("—", BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** INV-028. */
@Composable
private fun DividendsSummary(view: InvestmentsView, onAll: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val income = view.income
    PanelSection(tr("Dividendi"), BBIcon.HandCoins, color = c.swatchAmber, linkLabel = tr("Tutti"), onLink = onAll) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            InvestmentsStat(tr("Ultimi 12 mesi"), BBFormat.formatCurrency(income.trailing, view.currency, locale, masked = hide), Modifier.weight(1f))
            InvestmentsStat(tr("Totale incassato"), BBFormat.formatCurrency(income.total, view.currency, locale, masked = hide), Modifier.weight(1f))
        }
        BBText(tr(if (income.count > 0) "Dividendi e cedole registrati, al netto di imposte e costi." else "Nessun dividendo o cedola registrato."),
            BBTextStyle.Body, color = c.mutedForeground)
    }
}

/** INV-029. */
@Composable
private fun CostDetails(view: InvestmentsView, italian: Boolean, onTaxes: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val impact = view.costImpact
    val money = { v: Double -> BBFormat.formatCurrency(v, view.currency, locale, masked = hide) }
    PanelSection(tr("Costi e imposte"), BBIcon.ReceiptText, color = c.neg, description = tr("Dall’inizio · operazioni registrate"),
        linkLabel = if (italian) tr("Dettaglio fiscale") else null, onLink = if (italian) onTaxes else null) {
        Column {
            InvestmentsValueRow(tr("Costi e commissioni"), money(impact.fees))
            InvestmentsValueRow(tr("Imposte già registrate"), money(impact.taxes - impact.estimatedTaxes))
            if (italian) InvestmentsValueRow(tr("Imposte aggiuntive stimate"), money(impact.estimatedTaxes))
            InvestmentsValueRow(tr("Totale costi e imposte"), money(impact.fees + impact.taxes), strong = true, showsDivider = false)
        }
        BBText(tr("I costi del fondo (TER) sono già riflessi nel prezzo: non vengono sottratti di nuovo né inclusi tra le commissioni registrate. Eventuali costi del broker non registrati non sono inclusi."),
            BBTextStyle.Body, color = c.mutedForeground)
        BBText(tr(if (italian) "Stesse stime della scheda Tasse, con aliquote, regime e compensazione delle minusvalenze. Bollo escluso."
        else "Per la Germania mostriamo solo costi e imposte registrati. Non aggiungiamo il bollo italiano né stime fiscali tedesche."),
            BBTextStyle.Body, color = c.mutedForeground)
    }
}

// ---------------------------------------------------------------- Manual price (INV-026)

@Composable
fun ManualPriceView(model: InvestmentsModel, instrument: Instrument) {
    var date by remember { mutableStateOf(InvestmentsModel.todayKey()) }
    var price by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val value = BBFormat.parseAmount(price)
    val label = if (instrument.isPercentOfNominal) "Prezzo (% del nominale)" else "Prezzo per quota"
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.PencilLine, "${tr("Prezzo di")} ${instrument.name}",
            tr("Vale solo per il tuo portafoglio e ha la precedenza sui prezzi automatici dello stesso giorno."))
        BBDateField(date, { date = minOf(it, InvestmentsModel.todayKey()) }, label = tr("Data"))
        BBTextField(price, { price = it }, label = "${tr(label)} (${instrument.currency})", keyboard = BBKeyboard.Amount)
        error?.let { BBErrorBox(it) }
        BBButton(tr("Salva prezzo"), {
            val v = value ?: return@BBButton
            saving = true
            model.launch {
                error = model.saveManualPrice(instrument, date, v)
                saving = false
            }
        }, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving, enabled = (value ?: 0.0) > 0)
    }
}
