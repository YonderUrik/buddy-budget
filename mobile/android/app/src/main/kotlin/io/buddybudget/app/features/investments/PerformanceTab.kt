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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.tr
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.HeatmapCell
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentCreateInput
import io.buddybudget.core.data.InvestmentsPerformance
import io.buddybudget.core.data.ReturnHeatmap
import io.buddybudget.core.data.ReturnValues
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.BenchmarkRules
import io.buddybudget.core.domain.investments.BenchmarkWait
import io.buddybudget.core.domain.investments.InvestmentsGate
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.InvestmentsText
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import io.buddybudget.core.domain.investments.RiskCopy
import io.buddybudget.core.domain.investments.TitleRules
import io.buddybudget.core.domain.periods.CalendarDate

/** Investimenti › Performance (INV-031…044). iOS: PerformanceTab.swift. */
@Composable
fun PerformanceTab(model: InvestmentsModel) {
    val gate = when (val p = model.performance) {
        Loadable.Loading -> InvestmentsGate.Loading
        Loadable.Failed -> InvestmentsGate.Failed
        is Loadable.Loaded -> if (p.value.hasTransactions) InvestmentsGate.Content
        else if (model.state.excludedBrokers.isEmpty()) InvestmentsGate.Empty else InvestmentsGate.EmptyFiltered
    }
    InvestmentsGateView(gate, model, { model.launch { model.loadPerformance() } }) {
        val perf = (model.performance as? Loadable.Loaded)?.value ?: return@InvestmentsGateView
        PerformanceContent(model, perf)
    }
}

@Composable
private fun PerformanceContent(model: InvestmentsModel, perf: InvestmentsPerformance) {
    val c = BuddyBudgetTheme.colors
    val text = investmentsText()
    val returns = perf.returns
    val periodLabel = returns?.let { "${text.date(it.fromKey)} – ${text.date(it.toKey)}" } ?: tr("Nessuna operazione nell’intervallo")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(tr("Periodo della performance"), BBTextStyle.BodyStrong)
                BBText(periodLabel, BBTextStyle.Body, color = c.mutedForeground)
            }
            InvestmentsPeriodSelector(model.state.performancePeriod, model.state.performanceCustomRange, model.state.today,
                { model.setPerformancePeriod(it) }, { model.applyPerformanceRange(it) })
            if (model.selection != null) {
                Row(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.3f), RoundedCornerShape(BBRadius.lg))
                    .border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText("${tr("Intervallo selezionato sul grafico ·")} $periodLabel", BBTextStyle.Body, Modifier.weight(1f))
                    BBButton(tr("Torna al periodo scelto"), { model.selectRange(null) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                }
            }
        }
        if (debugShows(1)) {
            if (returns != null) ReturnsCard(model, perf, returns, text)
            else BBText(tr("Nessuna operazione nell’intervallo scelto. Seleziona un altro periodo."), BBTextStyle.Body,
                Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space4), color = c.mutedForeground)
        }
        val risk = perf.risk
        if (debugShows(2) && risk != null) RiskCard(risk, perf.benchmark?.name, perf.currency, text, tr("Periodo del grafico · {0}", mapOf("0" to periodLabel)))
        if (returns != null && returns.series.isNotEmpty()) HeatmapCard(perf, text, periodLabel)
    }
}

// ---------------------------------------------------------------- Returns

@Composable
private fun ReturnsCard(model: InvestmentsModel, perf: InvestmentsPerformance, returns: InvestmentsPerformance.ReturnsSeries, text: InvestmentsText) {
    val c = BuddyBudgetTheme.colors
    var choosing by remember { mutableStateOf(false) }
    val inspected = model.inspectIndex?.let { InvestmentsRules.nearestInspect(it, perf.inspect) }
    val values = inspected?.values ?: returns.values
    val dates = text.rangeLabel(values)
    PanelSection(tr("Rendimenti del periodo"), BBIcon.TrendingUp) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText("${tr(if (inspected != null) "Anteprima dal grafico" else "Periodo del grafico")} · $dates", BBTextStyle.Body, color = c.mutedForeground)
            BBText("${tr("Importi e rendimenti in")} ${perf.currency}${tr(". Passa su un numero per capire cosa misura.")}", BBTextStyle.Caption, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                ReturnMetric("Portafoglio · TWR", values.twr, values.twrAnnual, dates, text, "La performance degli investimenti. È la linea del grafico.",
                    tr("Il rendimento ponderato per il tempo (TWR) concatena i rendimenti giornalieri e neutralizza acquisti e vendite. Misura la performance degli strumenti, senza dare più peso ai giorni in cui avevi più soldi investiti. È il valore da confrontare con un indice."),
                    modifier = Modifier.weight(1f))
                ReturnMetric("I tuoi versamenti · MWR", values.moneyWeighted, values.moneyWeightedAnnual, dates, text, "Tiene conto di quanto e quando hai investito.",
                    tr("Il rendimento ponderato per il denaro (MWR), calcolato con XIRR e riportato alla durata del periodo, considera importi e date dei tuoi movimenti. Può differire dal TWR se hai investito di più prima di un rialzo o di un calo. Non è la linea del grafico. Se non esiste un tasso calcolabile, mostriamo un trattino."),
                    modifier = Modifier.weight(1f))
            }
            if (model.showsInflation) {
                val country = tr(io.buddybudget.core.domain.shell.LocaleRules.countryLabel(model.productCountry))
                val real = values.real
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                    ReturnMetric("Potere d’acquisto · Reale", real?.value, null, dates, text, "Il TWR dopo l’effetto dell’inflazione.",
                        tr("Corregge il rendimento TWR per l’aumento dei prezzi nel paese del prodotto ({0}, indice Eurostat). Un valore positivo indica un aumento del potere d’acquisto. È una stima che usa l’ultimo dato mensile di inflazione disponibile: la data è indicata sotto il numero. Non è la linea del grafico.", mapOf("0" to country)),
                        note = real?.let {
                            tr("Inflazione ({2}) {0} fino a {1}", mapOf("2" to country, "0" to text.pct(it.inflation ?: 0.0),
                                "1" to BBFormat.formatMonthLabel(it.throughMonth ?: "", text.locale).lowercase()))
                        } ?: tr("Dati sull’inflazione insufficienti per questo intervallo."), modifier = Modifier.weight(1f))
                    Box(Modifier.weight(1f))
                }
            }
        }
        BBText(values.timingInsight ?: tr("TWR e MWR misurano aspetti diversi dello stesso periodo."), BBTextStyle.Body, color = c.mutedForeground)
        BenchmarkSummary(model, perf, values, text) { choosing = true }
        if (returns.series.size >= 2) ReturnsChart(model, perf, returns, text)
    }
    FormDialog(choosing, { choosing = false }) { BenchmarkDialog(model, perf.benchmark) { choosing = false } }
}

@Composable
private fun BenchmarkSummary(model: InvestmentsModel, perf: InvestmentsPerformance, values: ReturnValues, text: InvestmentsText, onChoose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    var retrying by remember { mutableStateOf(false) }
    val name = perf.benchmark?.name ?: tr("questo strumento")
    val comparison = values.benchmark
    if (values.benchmarkStatus == "none") {
        Row(Modifier.fillMaxWidth().dashedBorder(c.border).padding(BBSpacing.space3), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(tr("Avresti fatto meglio con un indice? Confronta gli stessi versamenti con un ETF."), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground)
            BBButton(tr("Scegli un confronto"), onChoose, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
    } else if (values.benchmarkStatus == "missing_prices" || comparison == null) {
        val wait = BenchmarkRules.wait(model.benchmarkBackfill, perf.benchmarkFirstPriceDate, values.baseKey ?: values.fromKey)
        Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.5f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(waitMessage(wait, name, text), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground)
                if (wait.canRetry) {
                    BBButton(tr(if (retrying) "Riprovo…" else "Riprova"), {
                        val id = perf.benchmark?.id ?: return@BBButton
                        retrying = true
                        model.launch {
                            model.setBenchmark(id)
                            retrying = false
                        }
                    }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm, enabled = !retrying)
                }
                BBButton(tr("Cambia"), onChoose, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            }
            ProgressBar(when (wait) {
                BenchmarkWait.Checking -> BBProgressState.Indeterminate
                is BenchmarkWait.Downloading -> wait.total?.let { BBProgressState.Determinate(wait.saved.toDouble(), it.toDouble()) } ?: BBProgressState.Indeterminate
                else -> BBProgressState.None
            }, label = tr("Prezzi di {0}", mapOf("0" to name)))
        }
    } else {
        val simulated = comparison.simulatedValue ?: return
        val portfolio = comparison.portfolioValue ?: return
        val verdict = BenchmarkRules.verdict(portfolio, simulated)
        val difference = portfolio - simulated
        val money = { v: Double -> text.money(v, perf.currency, 0) }
        Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.5f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                val title = buildAnnotatedString {
                    withStyle(SpanStyle(color = c.foreground)) {
                        append(tr(when (verdict) { "better" -> "Il tuo portafoglio ha fatto meglio"; "worse" -> "L'indice avrebbe fatto meglio"; else -> "Praticamente pari" }))
                    }
                    if (verdict != "even") withStyle(SpanStyle(color = signedColor(difference))) {
                        append(" (${BBFormat.formatSignedCurrency(difference, perf.currency, text.locale)})")
                    }
                }
                Text(title, Modifier.weight(1f), style = BBTextStyle.BodyStrong.style)
                BBButton(tr("Cambia"), onChoose, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            }
            val asOf = if (model.inspectIndex != null) tr("al {0}", mapOf("0" to text.date(values.toKey))) else tr("oggi")
            RunsText(listOf(
                InvestmentsTextRun("${tr("Con gli stessi versamenti in")} ", InvestmentsTextRun.Style.Muted),
                InvestmentsTextRun(name),
                InvestmentsTextRun(" $asOf ${tr("avresti")} ", InvestmentsTextRun.Style.Muted),
                InvestmentsTextRun(money(simulated), InvestmentsTextRun.Style.Strong),
                InvestmentsTextRun(" ${tr("invece di")} ", InvestmentsTextRun.Style.Muted),
                InvestmentsTextRun(money(portfolio), InvestmentsTextRun.Style.Strong),
                InvestmentsTextRun("${tr(". Nel periodo l'ETF di confronto ha reso")} ${text.pct(comparison.twr ?: 0.0)}" +
                    (comparison.twrAnnual?.let { " (${text.pct(it)} ${tr("l'anno)")})" } ?: "") + ".", InvestmentsTextRun.Style.Muted),
            ), style = BBTextStyle.Body.style)
            if (comparison.depleted == true) {
                BBText(tr("Le vendite hanno superato il valore dell'indice simulato, che si è azzerato."), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}

@Composable
private fun waitMessage(wait: BenchmarkWait, name: String, text: InvestmentsText): String = when (wait) {
    BenchmarkWait.Checking -> tr("Controllo i prezzi di {0}…", mapOf("0" to name))
    is BenchmarkWait.Downloading -> wait.total?.let {
        tr("Scarico i prezzi di {0}: {1} giorni su {2}. Il confronto compare appena finito.", mapOf("0" to name, "1" to wait.saved.toString(), "2" to it.toString()))
    } ?: tr("Chiedo alle fonti lo storico dei prezzi di {0}. Il confronto compare appena finito.", mapOf("0" to name))
    BenchmarkWait.Failed -> tr("Non sono riuscito a scaricare i prezzi di {0}: le fonti non hanno risposto. Puoi riprovare o scegliere un altro indice.", mapOf("0" to name))
    is BenchmarkWait.NoHistory -> tr("{0} ha prezzi solo dal {1}, dopo l'inizio del periodo. Scegli un periodo più corto o un altro indice.",
        mapOf("0" to name, "1" to text.date(wait.firstPriceDate)))
    BenchmarkWait.Incomplete -> tr("Mancano alcuni prezzi o cambi di {0} nel periodo. Riprova a scaricarli.", mapOf("0" to name))
}

/** Dashed rounded border (the «none» benchmark invite). */
fun Modifier.dashedBorder(color: Color): Modifier = this.drawBehind {
    drawRoundRect(color, cornerRadius = CornerRadius(8.dp.toPx()),
        style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
}

@Composable
private fun ReturnsChart(model: InvestmentsModel, perf: InvestmentsPerformance, returns: InvestmentsPerformance.ReturnsSeries, text: InvestmentsText) {
    val c = BuddyBudgetTheme.colors
    val series = returns.series
    val hasBenchmark = returns.benchmark != null && series.any { it.benchmark != null }
    val lines = buildList {
        add(InvestmentsSeries("twr", series.map { it.portfolio }, c.primary))
        if (hasBenchmark) add(InvestmentsSeries("bench", series.map { it.benchmark }, c.swatchAmber))
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(tr("Rendimento del portafoglio · TWR cumulato"), BBTextStyle.BodyStrong)
        InvestmentsChart(series.size, lines, tr("Rendimento del portafoglio · TWR cumulato"), model.inspectIndex, { model.inspectIndex = it },
            height = 220.dp, zeroBased = true) { i ->
            val p = series[i]
            BBText(CalendarDate.parse(p.date)?.let { BBFormat.formatLongDate(it, text.locale) } ?: p.date, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
            BBText("${tr("Portafoglio · TWR")} ${text.pct(p.portfolio)}", BBTextStyle.Caption, maxLines = 1)
            val b = p.benchmark
            val name = perf.benchmark?.name
            if (hasBenchmark && b != null && name != null) BBText("$name ${text.pct(b)}", BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
        }
        // Web phone layout: the chart sits inside the page margins with its dates underneath.
        io.buddybudget.app.features.pension.ChartAxisLabels(series.map { BBFormat.formatShortDate(it.date, text.locale) })
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4, Alignment.CenterHorizontally)) {
            ChartLegendItem(tr("Portafoglio · TWR"), c.primary)
            val name = perf.benchmark?.name
            if (hasBenchmark && name != null) ChartLegendItem(name, c.swatchAmber)
        }
        BBText(tr("Tieni premuto e scorri su una data per aggiornare i numeri sopra, oppure scegli le date in «Personalizzato»."), BBTextStyle.Caption,
            color = c.mutedForeground)
    }
}

@Composable
private fun ReturnMetric(label: String, value: Double?, annual: Double?, dates: String, text: InvestmentsText, description: String, hint: String,
    modifier: Modifier = Modifier, note: String? = null) {
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    val formatted = value?.let { text.pct(it) } ?: tr("Non disponibile")
    val a11y = tr("{0}: {1}. Mostra la spiegazione", mapOf("0" to tr(label), "1" to formatted))
    Column(modifier.bbPressable({ open = true }, RoundedCornerShape(BBRadius.sm), translate = false).semantics { contentDescription = a11y },
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr(label), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.Medium), color = c.mutedForeground)
            BBIconView(BBIcon.Info, size = 14.dp, color = c.mutedForeground)
        }
        BBText(if (value == null) "—" else formatted, style = BBTextStyle.StatValue.style.copy(fontSize = 24.sp, lineHeight = 32.sp),
            color = value?.let { if (it < 0) c.neg else c.pos } ?: c.mutedForeground, maxLines = 1)
        BBText(tr("Cumulato nel periodo"), BBTextStyle.Caption, color = c.mutedForeground)
        if (annual != null) BBText("${text.pct(annual)} ${tr("annualizzato")}", BBTextStyle.Caption, color = c.mutedForeground)
        BBText(tr(description), BBTextStyle.Caption, color = c.mutedForeground)
        if (note != null) BBText(note, BBTextStyle.Caption, color = c.mutedForeground)
    }
    BBSheet(open, { open = false }, "${tr(label)} · $formatted") {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(dates, BBTextStyle.Caption, color = c.mutedForeground)
            BBText(hint, BBTextStyle.Body)
            if (value != null) BBText(tr("La percentuale principale è il rendimento complessivo di questo intervallo. Il valore annualizzato, quando presente, è il tasso annuo equivalente."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** «Confronta con un indice» (INV-038). */
@Composable
fun BenchmarkDialog(model: InvestmentsModel, current: Instrument?, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    var pending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun run(work: suspend () -> String?) {
        pending = true
        error = null
        model.launch {
            val result = work()
            pending = false
            if (result != null) error = result else onClose()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.GitCompareArrows, tr("Confronta con un indice"), tr("Confrontiamo gli stessi versamenti, negli stessi giorni, con un ETF ad accumulazione."),
            color = c.swatchIndigo)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(tr("Benchmark comuni"), BBTextStyle.BodyStrong)
            BBText(tr("Scegli un indice: il confronto usa l’ETF ad accumulazione indicato."), BBTextStyle.Caption, color = c.mutedForeground)
            for (s in BenchmarkRules.suggestions) {
                val selected = current?.isin == s.isin
                val shape = RoundedCornerShape(BBRadius.lg)
                Column(
                    Modifier.fillMaxWidth().bbDisabled(pending).background(if (selected) c.secondary else Color.Transparent, shape)
                        .then(if (selected) Modifier else Modifier.border(1.dp, c.border, shape))
                        .bbPressable({
                            if (!pending) run {
                                try {
                                    val created = model.env.instruments.create(InstrumentCreateInput.Yahoo(s.yahooSymbol, s.name, "etf", s.isin), deferHistory = true)
                                    model.setBenchmark(created.id)
                                } catch (e: Exception) {
                                    (e as? ApiError.Http)?.body?.message ?: "Qualcosa è andato storto. Riprova."
                                }
                            }
                        }, shape, translate = false).padding(BBSpacing.space3),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    BBText(tr(s.label) + if (selected) tr(" · Attuale") else "", BBTextStyle.BodyStrong)
                    BBText(tr(s.description), BBTextStyle.Caption, color = c.mutedForeground)
                    BBText("${s.name} · ${s.yahooSymbol}", BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
        InstrumentPickerField(null, emptyList(), model.currency, "Oppure cerca un altro strumento", enabled = !pending, deferHistory = true) { chosen ->
            run { model.setBenchmark(chosen.id) }
        }
        if (pending) BBText(tr("Salvo e scarico i prezzi…"), BBTextStyle.Body, color = c.mutedForeground)
        error?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
        if (current != null) BBButton(tr("Togli il confronto"), { run { model.setBenchmark(null) } }, variant = BBButtonVariant.Ghost, enabled = !pending)
    }
}

// ---------------------------------------------------------------- Risk

@Composable
private fun RiskCard(risk: InvestmentsPerformance.Risk, benchmarkName: String?, currency: String, text: InvestmentsText, periodLabel: String) {
    val c = BuddyBudgetTheme.colors
    var selection by remember { mutableStateOf<Int?>(null) }
    PanelSection(tr("Quanto rischia"), BBIcon.ShieldAlert, color = c.swatchOrange, description = periodLabel) {
        val volatility = risk.volatility
        if (volatility == null) {
            BBText(tr("Servono almeno 20 giorni di borsa nel periodo per misurare il rischio. Prova un periodo più lungo o torna tra qualche giorno."),
                BBTextStyle.Body, color = c.mutedForeground)
            return@PanelSection
        }
        val level = risk.level ?: TitleRules.riskLevel(volatility)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            RiskMeter(level, risk.scalePosition ?: TitleRules.riskScalePosition(volatility), "±${BBFormat.formatPct(volatility, text.locale)}",
                listOfNotNull(risk.levelInsight, risk.volatilityInsight).joinToString(" "),
                tr("Nome tecnico: volatilità. Di quanto si muove di solito il valore in un anno, in più o in meno. Più è alta, più il percorso è accidentato."))
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
                RiskMetric("Perdita peggiore", risk.drawdown?.let { if (it.depth < 0) text.pct(it.depth) else "0%" } ?: "0%", tr("dal massimo"),
                    risk.drawdown?.let { text.drawdownText(it, risk.recoveryDays) },
                    tr("Nome tecnico: massima perdita dal picco (drawdown). Quanto hai visto scendere il portafoglio, al massimo, rispetto al suo valore più alto. Non conta i versamenti."))
                RiskMetric("Rischio ripagato?", if (risk.sharpe == null) null else RiskCopy.sharpeWord(risk.sharpeLevel)?.let { tr(it) },
                    risk.sharpe?.let { tr("Sharpe {0}", mapOf("0" to BBFormat.formatRatio(it, text.locale, digits = 2))) } ?: tr("servono 3 mesi di dati"),
                    if (risk.sharpe == null) null else risk.sharpeInsight,
                    tr("Nome tecnico: Sharpe ratio. Quanto rendimento in più di un conto deposito hai avuto per ogni unità di rischio. Sotto 0,5 è poco, sopra 1 è buono."))
                if (benchmarkName != null) {
                    val bench = risk.benchmark
                    RiskMetric("Quanto segue l'indice", bench?.beta?.let { BBFormat.formatRatio(it, text.locale, digits = 2) },
                        bench?.correlation?.let { tr("correlazione {0}", mapOf("0" to BBFormat.formatRatio(it, text.locale, digits = 2))) } ?: tr("servono 3 mesi di dati"),
                        if (bench?.beta == null) null else risk.betaInsight,
                        tr("Nome tecnico: beta rispetto a {0}. 1 vuol dire che si muove come l'indice, 0,5 la metà, 1,5 una volta e mezza. La correlazione (da −1 a 1) dice quanto i movimenti vanno nella stessa direzione.", mapOf("0" to benchmarkName)))
                }
            }
            val footnote = listOfNotNull(
                if (risk.fewData) tr("Meno di un anno di dati: numeri indicativi.") else null,
                if (benchmarkName == null) tr("Scegli un indice in «Rendimenti del periodo» per vedere quanto lo segui.") else null,
            ).joinToString(" ")
            if (footnote.isNotEmpty()) BBText(footnote, BBTextStyle.Caption, color = c.mutedForeground)
            Column {
                if (risk.drawdownSeries.size >= 2) {
                    InvestmentsDisclosure(tr("Guarda le cadute nel tempo")) {
                        BBText(tr("Quanto il portafoglio era sotto il suo massimo, giorno per giorno."), BBTextStyle.Body, color = c.mutedForeground)
                        val points = risk.drawdownSeries
                        InvestmentsChart(points.size, listOf(InvestmentsSeries("dd", points.map { it.drawdown }, c.neg, InvestmentsSeries.Style.Area)),
                            tr("Guarda le cadute nel tempo"), selection, { selection = it }, height = 160.dp, zeroBased = true) { i ->
                            BBText(text.date(points[i].date), BBTextStyle.Caption, color = c.mutedForeground)
                            BBText(text.pct(points[i].drawdown), BBTextStyle.Caption)
                        }
                    }
                }
                InvestmentsDisclosure(tr("Come è calcolato")) {
                    RiskMethod()
                    if (risk.sharpe != null) {
                        BBText(risk.riskFreeRate?.let { tr("Conto con il tasso €STR medio del periodo ({0}).", mapOf("0" to BBFormat.formatPct(it, text.locale))) }
                            ?: tr(if (currency != "EUR") "Calcolato senza tasso privo di rischio (disponibile solo per l'euro)."
                            else "Calcolato senza tasso privo di rischio: il tasso €STR non è ancora stato scaricato."), BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
            }
        }
    }
}

/** 4-band risk scale (INV-041, SEC-026). */
@Composable
fun RiskMeter(level: Int, position: Double, volatilityText: String, insight: String, hint: String) {
    val c = BuddyBudgetTheme.colors
    val colors = listOf(c.risk1, c.risk2, c.risk3, c.risk4)
    val label = tr(TitleRules.riskLevelLabels[(level - 1).coerceIn(0, 3)])
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(label, BBTextStyle.StatValue, color = colors[(level - 1).coerceIn(0, 3)])
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText("$volatilityText ${tr("all’anno")}", BBTextStyle.Body, color = c.mutedForeground)
                InfoHintButton(tr("Cos'è: quanto oscilla"), hint)
            }
        }
        val a11y = tr("Livello di rischio {0}, {1} su 4", mapOf("0" to label, "1" to level.toString()))
        Column(Modifier.semantics { contentDescription = a11y }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BoxWithConstraints(Modifier.fillMaxWidth().height(16.dp)) {
                Row(Modifier.fillMaxWidth().height(10.dp).align(Alignment.CenterStart), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (step in 1..4) Box(Modifier.weight(1f).height(10.dp).alpha(if (step == level) 1f else 0.25f).background(colors[step - 1], CircleShape))
                }
                Box(Modifier.offset(x = maxWidth * position.toFloat() - 8.dp).size(16.dp).background(c.background, CircleShape).padding(3.dp)
                    .background(c.foreground, CircleShape))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (step in 1..4) {
                    BBText(tr(TitleRules.riskLevelLabels[step - 1]), style = BBTextStyle.Caption.style.copy(fontWeight = if (step == level) FontWeight.Medium else FontWeight.Normal,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = if (step == level) c.foreground else c.mutedForeground,
                        modifier = Modifier.weight(1f), maxLines = 1)
                }
            }
        }
        if (insight.isNotEmpty()) BBText(insight, BBTextStyle.Body, color = c.mutedForeground)
    }
}

@Composable
private fun RiskMetric(label: String, value: String?, note: String?, description: String?, hint: String) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr(label), BBTextStyle.BodyStrong)
            InfoHintButton(tr("Cos'è: {0}", mapOf("0" to tr(label))), hint)
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(value ?: "—", style = BBTextStyle.StatValue.style.copy(fontSize = 24.sp, lineHeight = 32.sp))
            if (note != null) BBText(note, BBTextStyle.Caption, color = c.mutedForeground)
        }
        if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
    }
}

@Composable
private fun RiskMethod() {
    val c = BuddyBudgetTheme.colors
    val steps = listOf(
        "1. Rendimento di ogni giorno" to tr("Si parte dal rendimento giornaliero del portafoglio senza l'effetto dei versamenti e dei prelievi (il TWR, lo stesso dei rendimenti). Si scartano i giorni senza nulla di investito e i weekend fermi: con i mercati chiusi non c'è movimento e abbasserebbero il rischio. Servono almeno {0} giorni.", mapOf("0" to "20")),
        "2. Quanto oscilla" to tr("È la deviazione standard dei rendimenti giornalieri, portata a un anno moltiplicandola per la radice dei giorni di borsa in un anno (circa 252). Il ± dice quanto ci si muove di solito: in circa due anni su tre il valore resta dentro quell'intervallo."),
        "3. Il livello" to tr("Si legge l'oscillazione annua: sotto {0} basso (per esempio obbligazioni), fino a {1} medio, fino a {2} alto (l'azionario mondiale sta intorno al {3}), oltre molto alto. Sono soglie di lettura scelte da noi, non una classificazione ufficiale.", mapOf("0" to "8%", "1" to "15%", "2" to "25%", "3" to "15%")),
        "4. Perdita peggiore" to tr("Si costruisce un indice che parte da 1 e segue i rendimenti giornalieri (così i versamenti non lo fanno salire). La perdita peggiore è la distanza massima da un picco al punto più basso successivo; «tornato al massimo» è il giorno in cui l'indice rivede quel picco."),
        "5. Rischio ripagato (Sharpe)" to tr("Rendimento medio giornaliero meno quello di un conto senza rischio (il tasso €STR, solo per l'euro), diviso per la deviazione standard e portato a un anno. Sotto 0 hai reso meno di un conto deposito, tra 0 e 0,5 poco, tra 0,5 e 1 discreto, sopra 1 bene. Serve almeno {0} giorni di dati.", mapOf("0" to "60")),
        "6. Quanto segue l'indice" to tr("Con un indice di confronto si usano solo i giorni in cui ci sono entrambi i prezzi. La correlazione (da −1 a 1) dice se vanno nella stessa direzione; il beta quanto si muove il portafoglio per ogni 1% dell'indice."),
    )
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        for ((title, body) in steps) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(tr(title), BBTextStyle.BodyStrong)
                BBText(body, BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        BBText(tr("Il passato non dice come andrà in futuro: con meno di un anno di dati i numeri sono solo indicativi."), BBTextStyle.Caption, color = c.mutedForeground)
    }
}

// ---------------------------------------------------------------- Heatmap

@Composable
private fun HeatmapCard(perf: InvestmentsPerformance, text: InvestmentsText, periodLabel: String) {
    val c = BuddyBudgetTheme.colors
    var grouping by remember { mutableStateOf("mese") }
    var inspected by remember { mutableStateOf<HeatmapCell?>(null) }
    val map = when (grouping) {
        "giorno" -> perf.heatmaps.giorno
        "settimana" -> perf.heatmaps.settimana
        "anno" -> perf.heatmaps.anno
        else -> perf.heatmaps.mese
    } ?: return
    PanelSection(tr("Rendimento TWR nel tempo"), BBIcon.CalendarRange, color = c.swatchTeal,
        description = tr("{0}. Mesi e anni ai bordi possono essere parziali. ", mapOf("0" to periodLabel)) + text.heatmapSummary(map)) {
        ScrollableSegmentedControl(listOf("giorno" to tr("Giorni"), "settimana" to tr("Settimane"), "mese" to tr("Mesi"), "anno" to tr("Anni")), grouping,
            { grouping = it; inspected = null }, accessibilityLabel = tr("Raggruppa i rendimenti per"))
        HeatmapGrid(map, inspected?.key) { inspected = it }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            val cell = inspected
            if (cell != null) {
                val line = buildAnnotatedString {
                    withStyle(SpanStyle(color = c.foreground)) { append(tr(cell.label)) }
                    val ret = cell.ret
                    if (ret != null) {
                        withStyle(SpanStyle(color = c.mutedForeground)) { append(" · ") }
                        withStyle(SpanStyle(color = if (ret < 0) c.neg else c.pos)) { append(text.pct(ret)) }
                        cell.gain?.let { g -> withStyle(SpanStyle(color = c.mutedForeground)) { append(" · " + BBFormat.formatSignedCurrency(g, perf.currency, text.locale)) } }
                    } else {
                        withStyle(SpanStyle(color = c.mutedForeground)) { append(tr(" · niente investito")) }
                    }
                }
                Text(line, style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
            } else {
                BBText(tr("Passa sopra o tocca una casella per il dettaglio."), BBTextStyle.Caption, color = c.mutedForeground)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                BBText(tr("Perdita"), BBTextStyle.Caption, color = c.mutedForeground)
                for (l in 4 downTo 1) HeatmapSwatch(-1.0, l, Modifier.size(12.dp))
                HeatmapSwatch(null, 0, Modifier.size(12.dp))
                for (l in 1..4) HeatmapSwatch(1.0, l, Modifier.size(12.dp))
                BBText(tr("Guadagno"), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}

/** Web `heatmapCellColor`: `--pos` / `--neg` over `--muted` (0, 30, 50, 72, 100 %). */
@Composable
private fun HeatmapSwatch(ret: Double?, level: Int, modifier: Modifier) {
    val c = BuddyBudgetTheme.colors
    val mix = listOf(0f, 0.30f, 0.50f, 0.72f, 1f)[level.coerceIn(0, 4)]
    val shape = RoundedCornerShape(3.dp)
    Box(modifier.background(c.muted, shape).background(if (ret != null && level > 0) (if (ret > 0) c.pos else c.neg).copy(alpha = mix) else Color.Transparent, shape))
}

@Composable
private fun HeatmapGrid(heatmap: ReturnHeatmap, selected: String?, onInspect: (HeatmapCell) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val showValue = heatmap.grouping == "mese" || heatmap.grouping == "anno"
    val hasTotal = heatmap.rows.any { it.total != null }
    val hasLabels = heatmap.rows.any { it.label.isNotEmpty() }
    val cell = if (showValue) 44.dp else 12.dp
    val height = if (showValue) 36.dp else 12.dp
    Column(Modifier.horizontalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            if (hasLabels) Box(Modifier.width(36.dp))
            for (label in heatmap.columns) Box(Modifier.width(cell)) {
                BBText(label, style = BBTextStyle.Caption.style.copy(fontSize = 10.sp, lineHeight = 16.sp), color = c.mutedForeground, maxLines = 1)
            }
            if (hasTotal) Box(Modifier.width(cell), contentAlignment = Alignment.Center) {
                BBText(tr("Anno"), style = BBTextStyle.Caption.style.copy(fontSize = 10.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium), maxLines = 1)
            }
        }
        for (row in heatmap.rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                if (hasLabels) Box(Modifier.width(36.dp)) {
                    BBText(row.label, style = BBTextStyle.Caption.style.copy(fontSize = 10.sp, lineHeight = 16.sp), color = c.mutedForeground)
                }
                for (item in row.cells) HeatCell(item, cell, height, showValue, selected, locale, onInspect)
                if (hasTotal) HeatCell(row.total, cell, height, true, selected, locale, onInspect)
            }
        }
    }
}

@Composable
private fun HeatCell(cell: HeatmapCell?, width: androidx.compose.ui.unit.Dp, height: androidx.compose.ui.unit.Dp, showValue: Boolean, selected: String?,
    locale: io.buddybudget.core.domain.format.BBLocale, onInspect: (HeatmapCell) -> Unit) {
    val c = BuddyBudgetTheme.colors
    if (cell == null) {
        Box(Modifier.width(width).height(height))
        return
    }
    val shape = RoundedCornerShape(3.dp)
    val mix = listOf(0f, 0.30f, 0.50f, 0.72f, 1f)[cell.level.coerceIn(0, 4)]
    val ret = cell.ret
    Box(
        Modifier.width(width).height(height).background(c.muted, shape)
            .background(if (ret != null && cell.level > 0) (if (ret > 0) c.pos else c.neg).copy(alpha = mix) else Color.Transparent, shape)
            .then(if (selected == cell.key) Modifier.border(2.dp, c.foreground, shape) else Modifier)
            .bbPressable({ onInspect(cell) }, shape, translate = false),
        contentAlignment = Alignment.Center,
    ) {
        if (showValue && ret != null) {
            BBText(BBFormat.formatSignedPct(ret, locale).replace("+", ""), style = BBTextStyle.Caption.style.copy(fontSize = 11.sp, lineHeight = 14.sp,
                fontFeatureSettings = "tnum"), color = if (cell.level >= 3) c.background else c.foreground, maxLines = 1)
        }
    }
}
