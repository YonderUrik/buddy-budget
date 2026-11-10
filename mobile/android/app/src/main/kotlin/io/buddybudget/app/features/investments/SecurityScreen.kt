package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBBadge
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.TitleAnalysis
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.ExposureKeys
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.investments.TitleFormat
import io.buddybudget.core.domain.investments.TitlePeriod
import io.buddybudget.core.domain.investments.TitleRules
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.abs

/** Security page `/investimenti/titoli/{id}` (SEC-015…053). iOS: SecurityScreen.swift. */
@Composable
fun SecurityScreen(instrumentId: String) {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val investments = shell.investments
    val model = remember(instrumentId) {
        SecurityModel(env, instrumentId).also { m ->
            m.onChanged = {
                investments.loadTitles()
                investments.reloadAll()
            }
        }
    }
    LaunchedEffect(model) { model.load() }
    DisposableEffect(model) { onDispose { model.stop() } }
    val c = BuddyBudgetTheme.colors
    val a = model.value
    // Web phone layout: the name is the page title with the instrument's badge, «Segui» and «Registra» under it.
    BBScreen(null, onBack = LocalShellBack.current, onRefresh = { model.load() }) {
        when (val state = model.analysis) {
            Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                BBSkeleton(Modifier.fillMaxWidth(), height = 120.dp, radius = BBRadius.xl)
                BBSkeleton(Modifier.fillMaxWidth(), height = 240.dp, radius = BBRadius.xl)
                BBSkeleton(Modifier.fillMaxWidth(), height = 160.dp, radius = BBRadius.xl)
            }
            Loadable.Failed -> LoadError(model.errorMessage ?: tr("Impossibile caricare il titolo."), { model.launch { model.load() } })
            is Loadable.Loaded -> SecurityContent(model, investments, state.value)
        }
    }
    val form = investments.registerForm
    FormDialog(form != null && investments.registerHost == instrumentId, {
        investments.registerForm = null; investments.editing = null; investments.registerHost = ""
    }) { if (form != null) RegisterOperationView(investments, form) }
}

@Composable
private fun SecurityContent(model: SecurityModel, investments: InvestmentsModel, a: TitleAnalysis) {
    val locale = LocalBBLocale.current
    val isFund = a.instrument.kind == InstrumentType.Etf || a.instrument.kind == InstrumentType.Fondo
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            SecurityHeader(model, investments, a)
            KeyFactsGrid(a)
        }
        if (debugShows(1)) PriceChartSection(model, a)
        if (a.instrument.priceMode == "manuale" && a.instrument.isin != null && a.instrument.createdByUserId != null) QuotationSection(model, a)
        val stats = a.stats
        if (debugShows(2) && stats != null) NumbersSection(a, stats)
        val position = a.position
        if (debugShows(3) && position != null && position.quantity > 0) PositionSection(a, position, investments.taxesEnabled)
        val vol = stats?.volatility
        if (debugShows(4) && stats != null && vol != null) {
            PanelSection(tr("Quanto rischia"), BBIcon.ShieldAlert, color = BuddyBudgetTheme.colors.swatchOrange, description = tr("Nell'ultimo anno")) {
                RiskMeter(TitleRules.riskLevel(vol), TitleRules.riskScalePosition(vol), "±${BBFormat.formatPct(vol, locale, digits = 0)}", "",
                    tr("Volatilità annua: di norma il prezzo si muove di circa questa percentuale in un anno, in su o in giù (due anni su tre)."))
                val dd = stats.maxDrawdown
                BBText("${tr("Calo peggiore dal massimo nell'ultimo anno:")} ${if (dd != null && dd < -0.005) BBFormat.formatSignedPct(dd, locale) else tr("nessuno")}",
                    BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
            }
        }
        if (a.instrument.kind == InstrumentType.Azione && a.insideFunds.isNotEmpty()) InsideFundsSection(a)
        if (debugShows(5)) AlertsSection(model, a)
        val stock = a.stock
        if (a.instrument.kind == InstrumentType.Azione && stock != null) StockSections(a, stock)
        else if (a.instrument.kind == InstrumentType.Azione) FundamentalsCard(a)
        a.composition?.let { FundCompositionSection(it) }
        if (a.instrument.kind != InstrumentType.Azione && a.annualReturns.isNotEmpty()) AnnualReturnsSection(a)
        if (isFund && a.fundamentals != null) FundCostSections(a)
        if (isFund && a.fundamentals == null && a.fundamentalsStatus != "unsupported") FundamentalsCard(a)
        a.dividends?.let { DividendsSection(a, it) }
        if (a.commentaryAvailable && a.stats != null) CommentarySection(model)
        val note = when {
            a.instrument.kind == InstrumentType.Azione && a.stock != null ->
                "Bilanci, numeri chiave e date di stacco da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; multipli, valori per azione e confronti con il passato calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita."
            isFund -> "Composizione, TER e multipli del paniere da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; rendimenti, costi e sovrapposizioni calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita."
            else -> null
        }
        if (note != null) BBText(tr(note), BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

@Composable
private fun SecurityHeader(model: SecurityModel, investments: InvestmentsModel, a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val instrument = a.instrument
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                InstrumentIconView(instrument, size = 32.dp)
                BBText(instrument.name, Modifier.semantics { heading() }, BBStyles.sectionHeading)
            }
            Row(Modifier.padding(start = 44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(listOfNotNull(tr(InstrumentIcons.typeLabel(instrument.kind)), instrument.isin, instrument.currency).joinToString(" · "), BBTextStyle.Caption,
                    Modifier.weight(1f, fill = false), color = c.mutedForeground, maxLines = 1)
                if (a.position != null) BBBadge(tr("Posseduto"), variant = BBBadgeVariant.Secondary)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr(if (a.watching) "Non seguire più" else "Segui"), { model.launch { model.toggleFollow() } }, icon = if (a.watching) BBIcon.EyeOff else BBIcon.Eye,
                variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm, isLoading = model.followPending)
            BBButton(tr("Registra"), {
                investments.registerHost = instrument.id
                investments.openRegister(OperationForm(instrument = instrument, date = InvestmentsModel.todayKey()))
            }, icon = BBIcon.Plus, size = BBButtonSize.Sm)
        }
        val stats = a.stats
        if (stats != null) {
            io.buddybudget.app.designsystem.components.MoneyHero(stats.lastClose, instrument.currency, Modifier.padding(top = BBSpacing.space2))
            val line = buildAnnotatedString {
                stats.dayChange?.let { d ->
                    withStyle(SpanStyle(color = if (d < 0) c.neg else c.pos)) { append(BBFormat.formatSignedPct(d, locale)) }
                    withStyle(SpanStyle(color = c.mutedForeground)) { append(" ${tr("nel giorno ·")} ") }
                }
                stats.returns["1A"]?.let { y ->
                    withStyle(SpanStyle(color = if (y < 0) c.neg else c.pos)) { append(BBFormat.formatSignedPct(y, locale)) }
                    withStyle(SpanStyle(color = c.mutedForeground)) { append(" ${tr("in un anno ·")} ") }
                }
                withStyle(SpanStyle(color = c.mutedForeground)) { append("${tr("chiusura del")} ${BBFormat.formatShortDate(stats.lastDate, locale)}") }
            }
            Text(line, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
        }
    }
}

@Composable
private fun KeyFactsGrid(a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val facts = TitleFormat.keyFacts(a, locale)
    if (facts.isEmpty()) return
    // Web: the facts sit on the page under a thin top border, not in a card.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        io.buddybudget.app.designsystem.components.BBSeparator()
        for (pair in facts.chunked(2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                for (f in pair) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(tr(f.label), BBTextStyle.Caption, color = c.mutedForeground)
                        BBText(tr(f.value), style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp, fontFeatureSettings = "tnum"), maxLines = 1)
                        f.note?.let { BBText(tr(it, f.noteValues), BBTextStyle.Caption, color = c.mutedForeground) }
                    }
                }
                if (pair.size == 1) Box(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PriceChartSection(model: SecurityModel, a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var selection by remember { mutableStateOf<Int?>(null) }
    val series = a.series
    val rising = TitleRules.isRising(series)
    val average = a.position?.averagePrice
    val markers = a.position?.let { TitleRules.purchaseMarkers(series, it.purchases) } ?: emptyList()
    PanelSection(tr("Andamento"), BBIcon.ChartLine) {
        io.buddybudget.app.designsystem.components.PeriodSelector(TitlePeriod.entries.map { it to it.raw }, model.period, { model.updatePeriod(it) },
            accessibilityLabel = tr("Periodo del grafico"))
        if (series.size < 2) {
            Box(Modifier.fillMaxWidth().heightIn(min = 120.dp), contentAlignment = Alignment.Center) {
                BBText(tr(if (a.backfilling) "Sto scaricando lo storico dei prezzi…" else "Non ci sono ancora abbastanza prezzi per il grafico."), BBTextStyle.Body,
                    color = c.mutedForeground)
            }
        } else {
            InvestmentsChart(series.size, listOf(InvestmentsSeries("close", series.map { it.close }, if (rising) c.pos else c.neg, InvestmentsSeries.Style.Area)),
                tr("Andamento"), selection, { selection = it }, height = 220.dp, reference = average, markers = markers) { i ->
                BBText(CalendarDate.parse(series[i].date)?.let { BBFormat.formatLongDate(it, locale) } ?: series[i].date, BBTextStyle.Caption, color = c.mutedForeground)
                BBText("${tr("Chiusura")} ${BBFormat.formatPrice(series[i].close, a.instrument.currency, locale)}", BBTextStyle.Caption)
            }
            // Web phone layout: inside the page margins, dates underneath.
            io.buddybudget.app.features.pension.ChartAxisLabels(series.map { BBFormat.formatShortDate(it.date, locale) })
            if (average != null) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4, Alignment.CenterHorizontally)) {
                    if (markers.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        Box(Modifier.size(8.dp).background(c.foreground, CircleShape))
                        BBText(tr("I tuoi acquisti"), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    ChartLegendItem("${tr("Il tuo prezzo medio (")}${BBFormat.formatPrice(average, a.instrument.currency, locale)})", c.mutedForeground, dashed = true)
                }
            }
            if (a.backfilling) BBText(tr("Sto ancora scaricando lo storico: il grafico si completa da solo."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun QuotationSection(model: SecurityModel, a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val isin = a.instrument.isin ?: ""
    val cur = a.instrument.currency
    PanelSection(tr("Prezzi automatici"), BBIcon.Link) {
        BBText("${tr("Questo titolo ha solo i prezzi del rendiconto (")}$isin${tr("). Collegalo a una quotazione in")} $cur ${tr("per avere prezzi aggiornati ogni giorno, rendimenti, settori e sovrapposizioni.")}",
            BBTextStyle.Body, color = c.mutedForeground)
        val q = model.quotations
        when {
            model.quotationsLoading -> BBText("${tr("Cerco le quotazioni di")} $isin…", BBTextStyle.Body, color = c.mutedForeground)
            q != null -> when (q.status) {
                "ok" -> for (cand in q.candidates ?: emptyList()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BBText("${cand.symbol} · ${cand.exchange ?: tr("Borsa non indicata")} · ${cand.currency}", BBTextStyle.Body, Modifier.weight(1f))
                        BBButton(tr("Collega"), { model.launch { model.link(cand.symbol) } }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                    }
                }
                "empty" -> BBText("${tr("Non ho trovato una quotazione in")} $cur ${tr("per questo ISIN: restano i prezzi del rendiconto.")}", BBTextStyle.Body, color = c.mutedForeground)
                else -> BBText(tr("Le fonti non rispondono in questo momento. Riprova tra poco."), BBTextStyle.Body, color = c.mutedForeground)
            }
            else -> BBButton(tr("Cerca la quotazione"), { model.launch { model.searchQuotations() } }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
        model.quotationError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
    }
}

@Composable
private fun NumbersSection(a: TitleAnalysis, stats: TitleAnalysis.Stats) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val returns = TitleRules.returnKeys.mapNotNull { (k, label) -> stats.returns[k]?.let { label to it } }
    PanelSection(tr("In numeri"), BBIcon.ChartNoAxesColumn) {
        if (returns.isEmpty()) {
            BBText(tr("Lo storico è ancora troppo corto per calcolare le variazioni."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                for (row in returns.chunked(2)) {
                    Row {
                        for ((label, value) in row) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                                BBText(BBFormat.formatSignedPct(value, locale), style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp,
                                    fontFeatureSettings = "tnum"), color = signedColor(value))
                            }
                        }
                        repeat(2 - row.size) { Box(Modifier.weight(1f)) }
                    }
                }
            }
        }
        val low = stats.low52
        val high = stats.high52
        if (low != null && high != null) {
            val pos = TitleFormat.rangePosition(stats.lastClose, low, high)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                val fromHigh = stats.fromHigh ?: 0.0
                val line = buildAnnotatedString {
                    append(tr("Forbice dell'ultimo anno"))
                    withStyle(SpanStyle(color = c.mutedForeground)) {
                        append(if (fromHigh < -0.005) " · ${BBFormat.formatPct(-fromHigh, locale)} ${tr("sotto il massimo")}" else " ${tr("· sui massimi")}")
                    }
                }
                Text(line, style = BBTextStyle.Body.style.copy(color = c.foreground))
                val a11y = tr("Ultima chiusura al {0}% della forbice tra minimo e massimo a 52 settimane", mapOf("0" to Math.round(pos * 100).toString()))
                BoxWithConstraints(Modifier.fillMaxWidth().height(12.dp).semantics { contentDescription = a11y }) {
                    Box(Modifier.fillMaxWidth().height(6.dp).align(Alignment.CenterStart).background(c.muted, CircleShape))
                    Box(Modifier.offset(x = maxWidth * pos.toFloat() - 6.dp).size(12.dp).background(c.background, CircleShape).padding(2.dp).background(c.foreground, CircleShape))
                }
                Row {
                    BBText("${tr("Min")} ${BBFormat.formatPrice(low, a.instrument.currency, locale)}", BBTextStyle.Caption, Modifier.weight(1f), color = c.mutedForeground)
                    BBText("${tr("Max")} ${BBFormat.formatPrice(high, a.instrument.currency, locale)}", BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
    }
}

@Composable
private fun PositionSection(a: TitleAnalysis, position: TitleAnalysis.Position, italian: Boolean) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val cur = a.instrument.currency
    val items = buildList {
        add(Triple("Valore", BBFormat.formatCurrency(position.value, cur, locale, masked = hide), c.foreground))
        add(Triple("Guadagno sul prezzo medio", position.gain?.let { g ->
            BBFormat.formatSignedCurrency(g, cur, locale, hide) + (position.changeVsAverage?.let { " · ${BBFormat.formatSignedPct(it, locale)}" } ?: "")
        } ?: "—", signedColor(position.gain)))
        if (position.incomeReceived > 0) add(Triple("Proventi incassati (lordi)", BBFormat.formatCurrency(position.incomeReceived, cur, locale, masked = hide), c.foreground))
        // INV-112: quantity and average price are the user's money too.
        add(Triple("Quote", if (hide) BBFormat.AMOUNT_MASK else BBFormat.formatNumber(position.quantity, locale, maximumFractionDigits = 6), c.foreground))
        add(Triple("Prezzo medio", position.averagePrice?.let { BBFormat.formatPrice(it, cur, locale, hide) } ?: "—", c.foreground))
    }
    PanelSection(tr("La tua posizione"), BBIcon.Briefcase) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            for (pair in items.chunked(2)) {
                Row {
                    for ((label, value, color) in pair) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                            BBText(value, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"), color = color)
                        }
                    }
                    if (pair.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
        BBText("${tr("Valori nella valuta del titolo (")}$cur${tr(if (italian) "), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse." else "), senza cambio né stime fiscali.")}",
            BBTextStyle.Caption, color = c.mutedForeground)
    }
}

@Composable
private fun InsideFundsSection(a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    PanelSection(tr("Ce l'hai già dentro"), BBIcon.Layers, color = c.swatchViolet) {
        for (fund in a.insideFunds) {
            Row {
                BBText(fund.name, BBTextStyle.Body, Modifier.weight(1f))
                fund.weight?.let { BBText(tr("{0} del fondo", mapOf("0" to BBFormat.formatPct(it, locale))), BBTextStyle.Body, color = c.mutedForeground) }
            }
        }
        BBText(tr("Dai primi titoli dei fondi che possiedi (fonte Yahoo Finance)."), BBTextStyle.Caption, color = c.mutedForeground)
    }
}

@Composable
private fun AlertsSection(model: SecurityModel, a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var above by remember { mutableStateOf(true) }
    var level by remember { mutableStateOf("") }
    val cur = a.instrument.currency
    val parsed = TitleRules.parseAlertLevel(level)
    PanelSection(tr("Avvisi di prezzo"), BBIcon.Bell, color = c.swatchAmber) {
        if (a.alerts.isEmpty()) {
            BBText(tr(if (a.instrument.hasAutomaticPrices) "Nessun avviso. Ti scrivo per email quando la chiusura raggiunge il livello che scegli."
            else "Gli avvisi funzionano solo per i titoli con prezzi automatici."), BBTextStyle.Body, color = c.mutedForeground)
        }
        for (alert in a.alerts) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBIconView(if (alert.isTriggered) BBIcon.BellRing else BBIcon.Bell, color = if (alert.isTriggered) c.swatchAmber else c.mutedForeground)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText("${tr(if (alert.isAbove) "Sale sopra" else "Scende sotto")} ${BBFormat.formatPrice(alert.target, cur, locale)}", BBTextStyle.BodyStrong)
                    BBText(if (alert.isTriggered) tr("Scattato il {0} con la chiusura a {1}", mapOf("0" to BBFormat.formatShortDate((alert.triggeredAt ?: "").take(10), locale),
                        "1" to BBFormat.formatPrice(alert.triggered ?: 0.0, cur, locale))) else tr("In attesa: controllo ogni sera dopo la chiusura"), BBTextStyle.Caption,
                        color = c.mutedForeground)
                }
                BBIconButton(BBIcon.Trash2, tr("Elimina avviso")) { model.launch { model.deleteAlert(alert) } }
            }
        }
        if (a.instrument.hasAutomaticPrices) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                SegmentedControl(listOf(true to tr("Sale sopra"), false to tr("Scende sotto")), above, { above = it }, accessibilityLabel = tr("Direzione dell'avviso"),
                    stretch = true)
                BBTextField(level, { level = it }, label = "${tr("Livello (")}$cur)",
                    placeholder = a.stats?.let { tr("Ultima chiusura {0}", mapOf("0" to BBFormat.formatPrice(it.lastClose, cur, locale))) } ?: tr("Prezzo"),
                    error = if (level.isNotEmpty() && parsed == null) tr("Prezzo non valido") else null, keyboard = BBKeyboard.Amount)
                model.alertError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
                BBButton(tr("Crea avviso"), {
                    val p = parsed ?: return@BBButton
                    model.launch { if (model.createAlert(above, p)) level = "" }
                }, icon = BBIcon.Bell, isLoading = model.alertPending, enabled = parsed != null)
            }
        }
    }
}

@Composable
private fun FundamentalsCard(a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val cur = a.instrument.currency
    val f = a.fundamentals
    val compact = { v: Double -> "${BBFormat.formatCompactAmount(v, locale)} $cur" }
    val ratio = { v: Double, d: Int -> BBFormat.formatRatio(v, locale, digits = d) }
    val items = if (f == null) emptyList() else listOfNotNull(
        f.expenseRatio?.let { Triple("Costo annuo (TER)", BBFormat.formatPct(it, locale, digits = 2), "Quanto costa tenerlo ogni anno, già scalato dal prezzo.") },
        f.totalAssets?.let { Triple("Patrimonio gestito", compact(it), "Più è grande, di solito più è facile comprarlo e venderlo.") },
        f.marketCap?.let { Triple("Capitalizzazione", compact(it), "Valore di mercato dell'intera azienda.") },
        f.trailingPE?.let { Triple("P/E", ratio(it, 1), "Anni di utili necessari a ripagare il prezzo, ai ritmi di oggi.") },
        f.forwardPE?.let { Triple("P/E atteso", ratio(it, 1), "Lo stesso calcolo sugli utili previsti dagli analisti.") },
        f.priceToBook?.let { Triple("Prezzo / patrimonio (P/B)", ratio(it, 1), "Sotto 1 costa meno del patrimonio contabile dell'azienda.") },
        f.eps?.let { Triple("Utile per azione", "${ratio(it, 2)} $cur", "Utile degli ultimi 12 mesi diviso il numero di azioni.") },
        f.dividendYield?.let { Triple("Rendimento da dividendo", BBFormat.formatPct(it, locale, digits = 2), "Dividendo annuo diviso il prezzo attuale.") },
        f.profitMargin?.let { Triple("Margine di profitto", BBFormat.formatPct(it, locale), "Quanto resta di utile su ogni 100 di ricavi.") },
        f.returnOnEquity?.let { Triple("Redditività del capitale (ROE)", BBFormat.formatPct(it, locale), "Utile in rapporto al capitale degli azionisti.") },
        f.revenueGrowth?.let { Triple("Crescita dei ricavi", BBFormat.formatPct(it, locale), "Rispetto allo stesso periodo dell'anno prima.") },
        f.debtToEquity?.let { Triple("Debiti / capitale", ratio(it / 100, 2), "Sopra 1 l'azienda ha più debiti che capitale proprio.") },
        f.beta?.let { Triple("Beta", ratio(it, 2), "Sopra 1 si muove più del mercato, sotto 1 meno.") },
    )
    PanelSection(tr("Numeri chiave"), BBIcon.ChartColumn) {
        if (items.isEmpty()) {
            BBText(tr(if (a.fundamentalsStatus == "unavailable") "Yahoo non ha risposto o non ha questi dati per il titolo. Riprova più tardi." else "Nessun dato disponibile per questo titolo."),
                BBTextStyle.Body, color = c.mutedForeground)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                for (pair in items.chunked(2)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        for ((label, value, hint) in pair) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                                BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp, fontFeatureSettings = "tnum"))
                                BBText(tr(hint), BBTextStyle.Caption, color = c.mutedForeground)
                            }
                        }
                        if (pair.size == 1) Box(Modifier.weight(1f))
                    }
                }
            }
            BBText(tr("Fonte: Yahoo Finance, aggiornata una volta al giorno. Dati non ufficiali, da usare come orientamento."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun IndicatorItem(key: String, indicator: TitleAnalysis.Indicator, currency: String, priceCurrency: String, modifier: Modifier) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val strings = LocalStrings.current
    var open by remember { mutableStateOf(false) }
    val meta = TitleFormat.indicatorMeta.getValue(key)
    fun format(v: Double): String {
        val t = TitleFormat.indicator(v, meta.format, locale)
        return if (meta.format == "years") strings.lookup("{0} anni", mapOf("0" to t)) else t
    }
    val value = format(indicator.value)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr(meta.label), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.Medium), color = c.mutedForeground)
            val a11y = tr("Come si calcola: {0}", mapOf("0" to tr(meta.label)))
            Box(Modifier.size(20.dp).bbPressable({ open = true }, CircleShape, translate = false).semantics { contentDescription = a11y }, contentAlignment = Alignment.Center) {
                BBIconView(BBIcon.CircleQuestionMark, size = 14.dp, color = c.mutedForeground)
            }
        }
        BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 20.sp, lineHeight = 28.sp, fontFeatureSettings = "tnum"))
        val h = indicator.history
        if (h != null) {
            BoxWithConstraints(Modifier.fillMaxWidth().height(10.dp)) {
                val span = maxOf(h.max - h.min, 0.0001)
                fun x(v: Double) = ((v - h.min) / span).coerceIn(0.0, 1.0).toFloat()
                Box(Modifier.fillMaxWidth().height(6.dp).align(Alignment.CenterStart).background(c.muted, CircleShape))
                Box(Modifier.offset(x = maxWidth * x(h.average) - 1.dp).width(2.dp).height(10.dp).background(c.mutedForeground))
                Box(Modifier.offset(x = maxWidth * x(indicator.value) - 5.dp).size(10.dp).background(c.primary, CircleShape))
            }
            Row {
                BBText("${tr("min")} ${format(h.min)}", BBTextStyle.Caption, Modifier.weight(1f), color = c.mutedForeground)
                BBText("${tr("max")} ${format(h.max)}", BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        BBText(tr(meta.hint), BBTextStyle.Caption, color = c.mutedForeground)
    }
    BBSheet(open, { open = false }, tr(meta.label)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(tr(meta.formula), BBTextStyle.Body)
            val shares = tr("azioni")
            BBText("${TitleFormat.operand(indicator.numerator, currency, priceCurrency, locale, shares)} ${tr("÷")} ${TitleFormat.operand(indicator.denominator, currency, priceCurrency, locale, shares)} = $value",
                style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            BBText(tr("Calcolato dall'app sui bilanci pubblicati da Yahoo Finance (non ufficiali)."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun IndicatorGrid(keys: List<String>, map: Map<String, TitleAnalysis.Indicator>, currency: String, priceCurrency: String) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        for (pair in keys.filter { it in map }.chunked(2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                for (key in pair) IndicatorItem(key, map.getValue(key), currency, priceCurrency, Modifier.weight(1f))
                if (pair.size == 1) Box(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun StockSections(a: TitleAnalysis, stock: TitleAnalysis.StockFundamentals) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val priceCurrency = a.instrument.currency
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        PanelSection(tr("Quanto costa rispetto a quello che produce"), BBIcon.Scale, description = tr("Multipli calcolati con l'ultima chiusura e i bilanci degli ultimi 12 mesi.")) {
            when {
                !stock.priceComparable -> BBText(tr("I bilanci sono in {0} e il prezzo in {1}: i multipli col prezzo non si calcolano.", mapOf("0" to stock.currency, "1" to priceCurrency)),
                    BBTextStyle.Body, color = c.mutedForeground)
                stock.valuation.isEmpty() -> BBText(tr("Con gli utili o la cassa di oggi questi multipli non hanno senso (sono negativi o mancano)."), BBTextStyle.Body,
                    color = c.mutedForeground)
                else -> {
                    IndicatorGrid(TitleFormat.valuationOrder, stock.valuation, stock.currency, priceCurrency)
                    BBText(tr("La barra va dal minimo al massimo degli esercizi passati, con la tacca sulla media e il pallino sul valore di oggi."), BBTextStyle.Caption,
                        color = c.mutedForeground)
                }
            }
        }
        PanelSection(tr("Per ogni azione"), BBIcon.Table, description = tr("Ricavi, utili e cassa divisi per il numero di azioni.")) {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(tr("Per azione"), BBTextStyle.Caption, color = c.mutedForeground)
                    for ((_, label) in TitleFormat.perShareRows) BBText(tr(label), BBTextStyle.Body)
                }
                stock.columns.forEachIndexed { i, col ->
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(if (col.trailing) tr("12 mesi") else col.label, BBTextStyle.Caption, color = c.mutedForeground)
                        for ((key, _) in TitleFormat.perShareRows) {
                            val v = stock.perShare[key]?.getOrNull(i)
                            BBText(v?.let { TitleFormat.perShare(it, stock.currency, locale) } ?: "—",
                                style = (if (i == stock.columns.lastIndex) BBTextStyle.BodyStrong else BBTextStyle.Body).style.copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
            }
            BBText(tr("Calcolati dall'app: voce di bilancio ÷ numero medio di azioni dell'esercizio."), BBTextStyle.Caption, color = c.mutedForeground)
        }
        PanelSection(tr("I conti dell'azienda"), BBIcon.Factory, description = tr("Esercizi annuali e ultimi 12 mesi, in valuta di bilancio.")) {
            MiniBars(tr("Ricavi"), stock.company.revenue, stock.columns, stock.currency)
            MiniBars(tr("Utile netto"), stock.company.netIncome, stock.columns, stock.currency)
            MiniBars(tr("Cassa libera"), stock.company.freeCashFlow, stock.columns, stock.currency)
            IndicatorGrid(TitleFormat.marginOrder, stock.margins, stock.currency, priceCurrency)
            val g = stock.growth.lastYear
            if (g != null) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText(tr("Crescita dei ricavi"), BBTextStyle.Caption, color = c.mutedForeground)
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(BBFormat.formatSignedPct(g, locale), style = BBTextStyle.CardTitle.style.copy(fontSize = 20.sp, lineHeight = 28.sp), color = signedColor(g))
                        val avg = stock.growth.average
                        if (avg != null && stock.growth.averageYears >= 2) BBText(tr("media {0} anni {1}", mapOf("0" to stock.growth.averageYears.toString(),
                            "1" to BBFormat.formatSignedPct(avg, locale))), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    BBText(tr("Ultimo esercizio rispetto al precedente."), BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
        if (stock.profitability.isNotEmpty()) PanelSection(tr("Quanto rende il capitale"), BBIcon.Percent) {
            IndicatorGrid(TitleFormat.profitabilityOrder, stock.profitability, stock.currency, priceCurrency)
        }
        if (stock.solidity.isNotEmpty()) PanelSection(tr("Debiti e solidità"), BBIcon.Shield) {
            IndicatorGrid(TitleFormat.solidityOrder, stock.solidity, stock.currency, priceCurrency)
        }
    }
}

@Composable
private fun MiniBars(label: String, values: List<Double?>, columns: List<TitleAnalysis.StockFundamentals.Column>, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var selected by remember { mutableStateOf<Int?>(null) }
    val max = values.mapNotNull { it?.let(::abs) }.maxOrNull() ?: 1.0
    val lastIndex = values.indexOfLast { it != null }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row {
            BBText(label, BBTextStyle.BodyStrong, Modifier.weight(1f))
            val i = selected ?: lastIndex
            val v = values.getOrNull(i)
            if (v != null) {
                val col = columns.getOrNull(i)
                BBText("${BBFormat.formatCompactAmount(v, locale)} $currency · ${col?.let { if (it.trailing) tr("ultimi 12 mesi") else it.label } ?: ""}", BBTextStyle.Caption,
                    color = c.mutedForeground)
            }
        }
        Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            values.forEachIndexed { i, v ->
                val color = if ((v ?: 0.0) < 0) c.neg else if (i == lastIndex) c.primary else c.primary.copy(alpha = 0.5f)
                Box(Modifier.weight(1f).height(maxOf(2.0, 48 * abs(v ?: 0.0) / max).dp).background(color, RoundedCornerShape(2.dp))
                    .bbPressable({ selected = i }, RoundedCornerShape(2.dp), translate = false))
            }
        }
    }
}

@Composable
private fun FundCompositionSection(composition: TitleAnalysis.Composition) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val top = composition.holdings.take(10)
    val share = top.sumOf { it.weight }
    val maxWeight = top.maxOfOrNull { it.weight } ?: 1.0
    @Composable
    fun weightRow(name: String, weight: Double, max: Double, color: androidx.compose.ui.graphics.Color) {
        // Web phone row: name, bar and share on one line.
        Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(name, BBTextStyle.Body, Modifier.width(110.dp), maxLines = 1)
            Box(Modifier.weight(1f)) { FillBar(weight / maxOf(max, 0.0001), color) }
            BBText(BBFormat.formatPct(weight, locale), Modifier.width(48.dp), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum", textAlign = androidx.compose.ui.text.style.TextAlign.End),
                color = c.mutedForeground)
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (top.isNotEmpty()) {
            PanelSection(tr("Cosa c'è dentro"), BBIcon.Layers, description = tr("Primi {0} titoli: {1} del fondo.", mapOf("0" to top.size.toString(), "1" to BBFormat.formatPct(share, locale)))) {
                for (h in top) weightRow(h.name, h.weight, maxWeight, c.swatchBlue)
                for (s in composition.shared) BBText("${s.holding.name} — ${s.elsewhere.joinToString(", ") { it.name }}", BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        val sectors = composition.sectors
        if (!sectors.isNullOrEmpty()) {
            val sorted = sectors.entries.sortedByDescending { it.value }
            PanelSection(tr("Settori"), BBIcon.ChartPie, description = tr("Parte azionaria del fondo.")) {
                for ((key, w) in sorted) weightRow(tr(ExposureKeys.sectorLabels[key] ?: key), w, sorted.first().value, bbSwatch(ExposureKeys.sectorColors[key] ?: "slate"))
                BBText(tr("Fonte: Yahoo Finance. Le aree geografiche arriveranno con i file degli emittenti."), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}

@Composable
private fun AnnualReturnsSection(a: TitleAnalysis) {
    val locale = LocalBBLocale.current
    val rows = a.annualReturns.sortedByDescending { it.year }.take(6)
    PanelSection(tr("Anno per anno"), BBIcon.CalendarRange, description = tr("Variazione del prezzo in ogni anno solare, senza dividendi né tasse.")) {
        for (r in rows) {
            Row {
                BBText(if (r.partial) tr("{0} (finora)", mapOf("0" to r.year.toString())) else r.year.toString(), BBTextStyle.Body, Modifier.weight(1f))
                BBText(BBFormat.formatSignedPct(r.value, locale), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"), color = signedColor(r.value))
            }
        }
    }
}

@Composable
private fun FundCostSections(a: TitleAnalysis) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val f = a.fundamentals ?: return
    val cur = a.instrument.currency
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        val basket = listOfNotNull(
            f.holdingsPE?.let { "P/E medio" to BBFormat.formatRatio(it, locale) }, f.holdingsPB?.let { "P/B medio" to BBFormat.formatRatio(it, locale) },
            f.holdingsPS?.let { "P/S medio" to BBFormat.formatRatio(it, locale) }, f.fundYield?.let { "Rendimento da dividendo" to BBFormat.formatPct(it, locale) },
        )
        if (basket.isNotEmpty()) PanelSection(tr("Quanto costa il paniere"), BBIcon.ShoppingBag, description = tr("Media pesata dei titoli contenuti nel fondo.")) {
            for (pair in basket.chunked(2)) Row {
                for ((label, value) in pair) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                    BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp, fontFeatureSettings = "tnum"))
                }
                if (pair.size == 1) Box(Modifier.weight(1f))
            }
            BBText(tr("Fonte: Yahoo Finance, aggiornata una volta al giorno (non ufficiale)."), BBTextStyle.Caption, color = c.mutedForeground)
        }
        val ter = f.expenseRatio
        if (ter != null && ter > 0) {
            val capital = "${BBFormat.formatNumber(10_000.0, locale)} $cur"
            PanelSection(tr("Quanto ti costa tenerlo"), BBIcon.ReceiptText, color = c.neg, description = tr("Effetto del TER ({0}) su {1} con un rendimento ipotetico del {2} l'anno.",
                mapOf("0" to BBFormat.formatPct(ter, locale, digits = 2), "1" to capital, "2" to "5%"))) {
                a.position?.let { p -> CostRow(tr("Sulla tua posizione"), "≈ ${BBFormat.formatCurrency(p.value * ter, cur, locale)} ${tr("l'anno")}") }
                for (years in listOf(10, 20)) CostRow(tr("Dopo {0} anni", mapOf("0" to years.toString())),
                    "${BBFormat.MINUS_SIGN}${BBFormat.formatCurrency(TitleRules.terCost(ter, years), cur, locale, maximumFractionDigits = 0)}")
                BBText(tr("Differenza rispetto allo stesso fondo senza costi."), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}

@Composable
private fun CostRow(label: String, value: String) {
    Row {
        BBText(label, BBTextStyle.Body, Modifier.weight(1f))
        BBText(value, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
    }
}

@Composable
private fun DividendsSection(a: TitleAnalysis, dividends: TitleAnalysis.DividendFacts) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val cur = a.instrument.currency
    val maxAmount = dividends.perYear.maxOfOrNull { it.amount } ?: 1.0
    PanelSection(tr("Dividendi"), BBIcon.HandCoins, color = c.swatchAmber, description = tr("Dividendo per quota con data di stacco nell'anno; l'anno in corso è parziale.")) {
        Row(Modifier.fillMaxWidth().height(84.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            for (y in dividends.perYear) {
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.fillMaxWidth().height(maxOf(2.0, 64 * y.amount / maxOf(maxAmount, 0.0001)).dp)
                        .background(if (y.partial) c.swatchAmber.copy(alpha = 0.4f) else c.swatchAmber, RoundedCornerShape(2.dp)))
                    BBText(y.year.toString(), style = BBTextStyle.Caption.style.copy(fontSize = 11.sp, lineHeight = 14.sp), color = c.mutedForeground)
                }
            }
        }
        val current = dividends.perYear.lastOrNull()
        if (current != null && current.partial) {
            BBText("${current.year} ${tr("finora:")} ${TitleFormat.perShare(current.amount, cur, locale)} ${tr("per quota.")}", BBTextStyle.Caption, color = c.mutedForeground)
        }
        val stats = listOfNotNull(
            dividends.yieldToday?.let { "Rendimento oggi" to BBFormat.formatPct(it, locale) },
            dividends.yieldOnCost?.let { "Sul tuo prezzo medio" to BBFormat.formatPct(it, locale) },
            dividends.growth?.let { "Crescita media" to "${BBFormat.formatSignedPct(it, locale)} ${tr("l'anno")}" },
            dividends.nextExDate?.let { "Prossimo stacco" to BBFormat.formatDateWithYear(it, locale) },
        )
        for (pair in stats.chunked(2)) Row {
            for ((label, value) in pair) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                BBText(value, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            }
            if (pair.size == 1) Box(Modifier.weight(1f))
        }
        if (dividends.nextExDate != null) BBText(tr("Data annunciata secondo Yahoo, da confermare."), BBTextStyle.Caption, color = c.mutedForeground)
    }
}

@Composable
private fun CommentarySection(model: SecurityModel) {
    val c = BuddyBudgetTheme.colors
    PanelSection(tr("Commento"), BBIcon.Sparkles, color = c.swatchViolet,
        description = tr("Un riassunto in parole semplici di come è andato il titolo, scritto da un modello in esecuzione sul server.")) {
        model.commentary?.let { BBText(it, BBTextStyle.Body) }
        (model.commentaryState as? SecurityModel.CommentaryState.Failed)?.let {
            BBText(it.message ?: tr("Il modello non ha risposto. Riprova tra poco."), BBTextStyle.Body, color = c.mutedForeground)
        }
        val writing = model.commentaryState == SecurityModel.CommentaryState.Writing
        BBButton(tr(if (writing) "Sto scrivendo…" else if (model.commentary == null) "Genera commento" else "Riscrivi"), { model.launch { model.generateCommentary() } },
            icon = BBIcon.Sparkles, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm, isLoading = writing)
        BBText(tr("Generato automaticamente da dati di prezzo e numeri chiave: può sbagliare e non è una raccomandazione di investimento."), BBTextStyle.Caption,
            color = c.mutedForeground)
    }
}
