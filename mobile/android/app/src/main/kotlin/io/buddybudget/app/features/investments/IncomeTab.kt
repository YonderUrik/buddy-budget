package io.buddybudget.app.features.investments

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.InvestmentsIncome
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.IncomeRules
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.investments.OperationType

/** Investimenti › Dividendi (IT, INV-074…082). iOS: IncomeTab.swift. */
@Composable
fun IncomeTab(model: InvestmentsModel) {
    val c = BuddyBudgetTheme.colors
    if (model.countryContent == InvestmentsCountryContent.GermanPlan) {
        io.buddybudget.app.features.planningde.GermanIncomeScreen(model.planning)
        return
    }
    when (val state = model.income) {
        Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 160.dp, radius = BBRadius.xl)
            BBSkeleton(Modifier.fillMaxWidth(), height = 288.dp, radius = BBRadius.xl)
        }
        Loadable.Failed -> LoadError(tr("Impossibile caricare i dividendi."), { model.launch { model.loadIncome() } })
        is Loadable.Loaded -> {
            val income = state.value
            if (!income.hasTransactions) {
                BBText(tr("Qui vedrai dividendi e cedole: registra prima un acquisto nella scheda Portafoglio."), style = BBTextStyle.Body.style.copy(textAlign = TextAlign.Center),
                    color = c.mutedForeground, modifier = Modifier.fillMaxWidth().dashed(c.border).padding(BBSpacing.space8))
            } else {
                IncomeContent(model, income)
            }
        }
    }
}

fun Modifier.dashed(color: androidx.compose.ui.graphics.Color): Modifier = this.drawBehind {
    drawRoundRect(color, cornerRadius = CornerRadius(12.dp.toPx()),
        style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
}

@Composable
private fun IncomeContent(model: InvestmentsModel, income: InvestmentsIncome) {
    val c = BuddyBudgetTheme.colors
    var couponsFor by remember { mutableStateOf<Instrument?>(null) }
    LaunchedEffect(Unit) { if (model.taxes !is Loadable.Loaded) model.loadTaxes() }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (income.pendingDividendHistory > 0) {
            BBText("${tr("Scarico lo storico dei dividendi di")} ${if (income.pendingDividendHistory == 1) tr("uno strumento")
            else tr("{0} strumenti", mapOf("0" to income.pendingDividendHistory.toString()))}…", BBTextStyle.Body, color = c.mutedForeground)
        }
        if (debugShows(0) && income.byMonth.isNotEmpty()) IncomeMonthsSection(income)
        if (debugShows(1) && income.byInstrument.isNotEmpty()) IncomeInstrumentsSection(income) { couponsFor = it }
        if (income.byMonth.isEmpty()) {
            BBText(tr("Nessun dividendo o cedola registrato."), BBTextStyle.Body, Modifier.fillMaxWidth().dashed(c.border).padding(BBSpacing.space6), color = c.mutedForeground)
        }
        if (debugShows(2) && income.missing.isNotEmpty()) MissingIncomeSection(model, income)
        IncomeForecastSection(income, model.taxesEnabled) { couponsFor = it }
    }
    val target = couponsFor
    val taxes = (model.taxes as? Loadable.Loaded)?.value
    FormDialog(target != null, { couponsFor = null }) {
        if (target != null) InstrumentSettingsView(model, target, taxes?.setting(target.id), taxes?.resolved(target.id)) { couponsFor = null }
    }
}

data class MonthBar(val id: String, val label: String, val primary: Double, val secondary: Double, val title: String)

/** Stacked monthly bars (web `MonthBars`). */
@Composable
fun MonthBarsView(bars: List<MonthBar>, height: androidx.compose.ui.unit.Dp = 112.dp) {
    val c = BuddyBudgetTheme.colors
    var selected by remember { mutableStateOf<String?>(null) }
    val max = bars.maxOfOrNull { it.primary + it.secondary } ?: 0.0
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (bar in bars) {
                val total = bar.primary + bar.secondary
                val h = if (max > 0) maxOf(total / max * height.value, if (total > 0) 3.0 else 0.0) else 0.0
                Column(Modifier.weight(1f).alpha(if (selected == null || selected == bar.id) 1f else 0.5f)
                    .bbPressable({ selected = if (selected == bar.id) null else bar.id }, RoundedCornerShape(2.dp), translate = false)
                    .semantics { contentDescription = bar.title },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.height(height).widthIn(max = 32.dp).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                        if (total > 0) Column(Modifier.fillMaxWidth().height(h.dp).clip(RoundedCornerShape(2.dp))) {
                            Box(Modifier.fillMaxWidth().height((h * bar.secondary / total).dp).background(c.mutedForeground.copy(alpha = 0.3f)))
                            Box(Modifier.fillMaxWidth().weight(1f).background(c.pos))
                        }
                    }
                    BBText(bar.label, style = BBTextStyle.Caption.style.copy(fontSize = 11.sp, lineHeight = 14.sp), color = c.mutedForeground, maxLines = 1)
                }
            }
        }
        bars.firstOrNull { it.id == selected }?.let { BBText(it.title, BBTextStyle.Caption) }
    }
}

@Composable
private fun IncomeMonthsSection(income: InvestmentsIncome) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var year by remember { mutableStateOf<Int?>(null) }
    var expanded by remember { mutableStateOf(false) }
    val selected = income.byMonth.firstOrNull { it.year == year } ?: income.byMonth[0]
    val money = { v: Double -> BBFormat.formatCurrency(v, income.currency, locale, maximumFractionDigits = 0, masked = hide) }
    val full = { v: Double -> BBFormat.formatCurrency(v, income.currency, locale, masked = hide) }
    val years = income.byMonth.map { it.year to it.year.toString() }
    PanelSection(tr("Dividendi incassati"), BBIcon.Banknote, color = c.swatchAmber, action = {
        if (years.size > 1 && years.size <= TitleSegments.MAX_INLINE) io.buddybudget.app.designsystem.components.SegmentedControl(years, selected.year, { year = it; expanded = true }, accessibilityLabel = tr("Anno"))
    }) {
        if (years.size > TitleSegments.MAX_INLINE) {
            ScrollableSegmentedControl(years, selected.year, { year = it; expanded = true }, accessibilityLabel = tr("Anno"))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            MiniStat(tr("Lordo"), money(selected.gross), c.foreground, null, Modifier.weight(1f))
            MiniStat(tr("Ritenute e costi"), money(selected.withheld), c.foreground,
                if (selected.gross > 0) BBFormat.formatPct(selected.withheld / selected.gross, locale, digits = 0) else null, Modifier.weight(1f))
            MiniStat(tr("Netto"), money(selected.net), c.pos, null, Modifier.weight(1f))
        }
        MonthBarsView(selected.months.map { m ->
            val label = BBFormat.shortMonthLabel(m.month, locale)
            MonthBar(m.month.toString(), label, maxOf(m.net, 0.0), m.withheld, "$label ${selected.year} · ${tr("Lordo")}: ${full(m.gross)} · ${tr("Netto")}: ${full(m.net)}")
        })
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            LegendSquare(c.pos, tr("Netto"))
            LegendSquare(c.mutedForeground.copy(alpha = 0.3f), tr("Ritenute e costi"))
        }
        androidx.compose.runtime.key(selected.year) {
            InvestmentsDisclosure("${tr("Pagamenti del")} ${selected.year}", expanded) {
                IncomePaymentsList(income.history.payments.filter { it.date.startsWith(selected.year.toString()) }, income.currency) { income.instrument(it) }
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, color: androidx.compose.ui.graphics.Color, note: String?, modifier: Modifier) {
    val c = BuddyBudgetTheme.colors
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BBText(label, BBTextStyle.Caption, color = c.mutedForeground)
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp), color = color, maxLines = 1)
            if (note != null) BBText(note, BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun LegendSquare(color: androidx.compose.ui.graphics.Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        Box(Modifier.size(10.dp).background(color, RoundedCornerShape(2.dp)))
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

@Composable
fun IncomePaymentsList(payments: List<InvestmentsView.IncomeHistory.Payment>, currency: String, instrument: ((String) -> Instrument?)? = null) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    if (payments.isEmpty()) {
        BBText(tr("Nessun pagamento registrato."), BBTextStyle.Body, color = c.mutedForeground)
        return
    }
    Column {
        payments.forEachIndexed { i, p ->
            Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row {
                    BBText("${BBFormat.formatDateWithYear(p.date, locale)} · ${tr(if (p.kind == "cedola") "Cedola" else "Dividendo")}", BBTextStyle.Body, Modifier.weight(1f))
                    if (instrument != null) BBText(instrument(p.instrumentId)?.name ?: tr("Strumento"), BBTextStyle.BodyStrong, maxLines = 1)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    for ((label, amount) in listOf("Lordo" to p.gross, "Imposte" to p.taxes, "Costi" to p.fees, "Netto" to p.net)) {
                        Column(Modifier.weight(1f)) {
                            BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
                            BBText(BBFormat.formatCurrency(amount, currency, locale, masked = hide), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun IncomeInstrumentsSection(income: InvestmentsIncome, onCoupons: (Instrument) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var open by remember { mutableStateOf(setOf<String>()) }
    PanelSection(tr("Per strumento"), BBIcon.List, color = c.swatchSlate, action = {
        InfoHintButton(tr("Come leggere i rendimenti da dividendo"),
            "${tr("Sul costo")}${tr(": netto incassato negli ultimi 12 mesi su quanto hai pagato le quote che hai.")} ${tr("Attuale")}${tr(": lordo previsto nei prossimi 12 mesi sul valore di oggi.")} ${tr("Crescita")}${tr(": di quanto è cresciuto ogni anno il dividendo per quota, sugli ultimi anni completi.")}")
    }) {
        Column {
            for (row in income.byInstrument) {
                val instrument = income.instrument(row.instrumentId) ?: continue
                val payments = income.history.payments.filter { it.instrumentId == row.instrumentId }
                val isOpen = row.instrumentId in open
                val rotation by animateFloatAsState(if (isOpen) 180f else 0f, label = "open")
                Column {
                    Row(Modifier.fillMaxWidth().bbPressable({ open = if (isOpen) open - row.instrumentId else open + row.instrumentId }, RoundedCornerShape(BBRadius.md),
                        translate = false).padding(vertical = BBSpacing.space4), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                        InstrumentIconView(instrument, size = 28.dp)
                        Column(Modifier.weight(1f)) {
                            BBText(instrument.name, BBTextStyle.BodyStrong, maxLines = 1)
                            BBText("${payments.size} ${tr(if (payments.size == 1) "pagamento" else "pagamenti")}", BBTextStyle.Caption, color = c.mutedForeground)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            BBText(BBFormat.formatCurrency(row.trailingNet, income.currency, locale, masked = hide), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
                            BBText(tr("ultimi 12 mesi"), BBTextStyle.Caption, color = c.mutedForeground)
                        }
                        BBIconView(BBIcon.ChevronDown, Modifier.rotate(rotation), color = c.mutedForeground)
                    }
                    if (isOpen) {
                        Column(Modifier.padding(bottom = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                            Row {
                                Metric("Sul costo", if (row.yieldOnCost != null && row.trailingNet > 0) BBFormat.formatPct(row.yieldOnCost!!, locale) else "—", Modifier.weight(1f))
                                Metric("Attuale", if (row.currentYield != null && row.forecastGross > 0) BBFormat.formatPct(row.currentYield!!, locale) else "—", Modifier.weight(1f))
                                Metric("Crescita", row.growth?.let { "${BBFormat.formatSignedPct(it.rate, locale)}/${tr("anno")}" } ?: "—", Modifier.weight(1f))
                            }
                            if (instrument.kind == InstrumentType.Obbligazione) {
                                BBButton(tr(if (row.hasCouponTerms) "Cedole" else "Inserisci cedole"), { onCoupons(instrument) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                            }
                            IncomePaymentsList(payments, income.currency)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Metric(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        BBText(tr(label), BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
    }
}

@Composable
private fun MissingIncomeSection(model: InvestmentsModel, income: InvestmentsIncome) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val locale = LocalBBLocale.current
    var showAll by remember { mutableStateOf(false) }
    val missing = income.missing
    val oldBefore = IncomeRules.monthsAgo(income.todayKey, 12)
    val old = missing.filter { it.date < oldBefore }
    val shown = if (showAll) missing else missing.take(5)
    PanelSection(tr("Da registrare"), BBIcon.CircleAlert, color = c.neg) {
        BBText("${if (missing.size == 1) tr("Un provento") else tr("{0} proventi", mapOf("0" to missing.size.toString()))}${tr(" che probabilmente hai incassato: avevi le quote il giorno dello stacco, ma non c'è")} ${tr("un dividendo o una cedola registrati vicino a quella data. Controlla l'importo netto sull'estratto del broker.")}",
            BBTextStyle.Body, color = c.mutedForeground)
        Column {
            for (item in shown) {
                val instrument = income.instrument(item.instrumentId)
                Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(instrument?.name ?: tr("Strumento"), BBTextStyle.BodyStrong, maxLines = 1)
                        BBText("${tr(if (item.kind == "cedola") "Cedola" else "Stacco")} ${tr("del")} ${BBFormat.formatDateWithYear(item.date, locale)} · ${if (hide) BBFormat.AMOUNT_MASK else BBFormat.formatNumber(item.quantity, locale, maximumFractionDigits = 4)} ${tr(if (item.kind == "cedola") "di nominale" else "quote")}",
                            BBTextStyle.Body, color = c.mutedForeground)
                        val line = buildAnnotatedString {
                            append("${BBFormat.formatCurrency(item.gross, instrument?.currency ?: income.currency, locale, masked = hide)} ${tr("lordi")}")
                            item.estimatedTax?.let { withStyle(SpanStyle(color = c.mutedForeground)) { append(" ${tr("· ritenuta stimata")} ${BBFormat.formatCurrency(it, income.currency, locale, masked = hide)}") } }
                        }
                        Text(line, style = BBTextStyle.Body.style.copy(color = c.foreground, fontFeatureSettings = "tnum"))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBButton(tr("Registra"), {
                            model.openRegister(OperationForm(if (item.kind == "cedola") OperationType.Cedola else OperationType.Dividendo, instrument, item.date,
                                gross = OperationForm.numberText(Math.rint(item.gross * 100) / 100),
                                taxes = item.estimatedTax?.let { OperationForm.numberText(Math.rint(it * 100) / 100) } ?: ""))
                        }, size = BBButtonSize.Sm)
                        BBButton(tr("Ignora"), { model.launch { model.dismiss(listOf(item)) } }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (missing.size > 5) BBButton(if (showAll) tr("Mostra meno") else tr("Mostra tutte ({0})", mapOf("0" to missing.size.toString())), { showAll = !showAll },
                variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            if (old.size > 1) BBButton("${tr("Ignora le")} ${old.size} ${tr("più vecchie di un anno")}", { model.launch { model.dismiss(old) } },
                variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IncomeForecastSection(income: InvestmentsIncome, taxes: Boolean, onCoupons: (Instrument) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var showAll by remember { mutableStateOf(false) }
    val forecast = income.forecast
    val money = { v: Double -> BBFormat.formatCurrency(v, income.currency, locale, maximumFractionDigits = 0, masked = hide) }
    val events = if (showAll) forecast.events else forecast.events.take(6)
    val missingTerms = forecast.bondsWithoutTerms.mapNotNull { income.instrument(it) }
    PanelSection(tr("Prossimi 12 mesi"), BBIcon.CalendarClock, color = c.swatchAmber) {
        if (forecast.events.isEmpty()) {
            BBText(tr("Nessun incasso previsto: i tuoi strumenti non hanno staccato dividendi nell'ultimo anno (es. ETF ad accumulazione)."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            val period = tr("{0} a {1}", mapOf("0" to BBFormat.formatMonthLabel(forecast.months.firstOrNull()?.key ?: "", locale),
                "1" to BBFormat.formatMonthLabel(forecast.months.lastOrNull()?.key ?: "", locale)))
            // INV-113: where the country has no tax rules the forecast is gross and said once (web `taxes={features.taxes}`).
            RunsText(if (taxes) listOf(
                InvestmentsTextRun("${tr("Da")} $period${tr(", con le quote di oggi dovresti incassare circa")} "),
                InvestmentsTextRun(money(forecast.totalNet), InvestmentsTextRun.Style.Pos),
                InvestmentsTextRun(" ${tr("netti")}"),
                InvestmentsTextRun(" (${money(forecast.totalGross)} ${tr("lordi), circa")} ${money(forecast.totalNet / 12)} ${tr("al mese.")}", InvestmentsTextRun.Style.Muted),
            ) else listOf(
                InvestmentsTextRun("${tr("Da")} $period${tr(", con le quote di oggi dovresti incassare circa")} "),
                InvestmentsTextRun(money(forecast.totalGross), InvestmentsTextRun.Style.Pos),
                InvestmentsTextRun(" ${tr("lordi")}"),
                InvestmentsTextRun("${tr(", circa")} ${money(forecast.totalGross / 12)} ${tr("al mese.")}", InvestmentsTextRun.Style.Muted),
            ))
            MonthBarsView(forecast.months.map { m ->
                val label = BBFormat.shortMonthLabel(m.key, locale)
                MonthBar(m.key, label, m.net, m.gross - m.net,
                    if (taxes) "$label ${m.key.take(4)}: ${money(m.net)} ${tr("netti")}, ${money(m.gross)} ${tr("lordi")}" else "$label ${m.key.take(4)}: ${money(m.gross)}")
            })
            Column {
                for (event in events) {
                    Row(Modifier.padding(vertical = BBSpacing.space2), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        Column(Modifier.weight(1f)) {
                            BBText(income.instrument(event.instrumentId)?.name ?: tr("Strumento"), BBTextStyle.Body, maxLines = 1)
                            BBText("${tr(when (event.kind) { "rimborso" -> "Rimborso a scadenza"; "cedola" -> "Cedola"; else -> "Stacco" })} ${tr("del")} ${BBFormat.formatDateWithYear(event.date, locale)} · ${tr(IncomeRules.basisLabel(event.basis))}",
                                BBTextStyle.Caption, color = c.mutedForeground)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            BBText(BBFormat.formatCurrency(event.net, income.currency, locale, masked = hide), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"),
                                color = if (event.kind == "rimborso") c.foreground else c.pos)
                            if (taxes && event.kind != "rimborso") BBText("${BBFormat.formatCurrency(event.gross, income.currency, locale, masked = hide)} ${tr("lordi")}",
                                style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.mutedForeground)
                        }
                    }
                }
            }
            if (forecast.events.size > 6) BBButton(if (showAll) tr("Mostra meno") else tr("Mostra tutti ({0})", mapOf("0" to forecast.events.size.toString())),
                { showAll = !showAll }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            BBText(if (taxes) tr("Stima per data di stacco, netta della sola imposta italiana: sui dividendi esteri c'è anche la ritenuta del paese d'origine. Il rimborso di un'obbligazione è capitale che torna, non un provento.")
                else tr("Stima per data di stacco, al lordo delle imposte: quelle del tuo paese non sono calcolate. Il rimborso di un'obbligazione è capitale che torna, non un provento."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
        if (missingTerms.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.6f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr("Per prevedere le cedole servono tasso e scadenza di:"), BBTextStyle.Body)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    for (i in missingTerms) BBButton(i.name, { onCoupons(i) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                }
            }
        }
    }
}
