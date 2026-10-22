package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.FormDialogSection
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentSettingsInput
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.InvestmentsTaxes
import io.buddybudget.core.data.SaleSimulation
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.investments.TaxRules
import kotlinx.coroutines.delay
import kotlin.math.abs

/** Investimenti › Tasse (IT, INV-083…091). iOS: TaxesTab.swift. */
@Composable
fun TaxesTab(model: InvestmentsModel) {
    if (model.countryContent == InvestmentsCountryContent.GermanPlan) {
        io.buddybudget.app.features.planningde.GermanTaxScreen(model.planning)
        return
    }
    var editing by remember { mutableStateOf<Instrument?>(null) }
    when (val state = model.taxes) {
        Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 160.dp, radius = BBRadius.xl)
            BBSkeleton(Modifier.fillMaxWidth(), height = 288.dp, radius = BBRadius.xl)
        }
        Loadable.Failed -> LoadError(tr("Impossibile caricare le tasse."), { model.launch { model.loadTaxes() } })
        is Loadable.Loaded -> {
            val taxes = state.value
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
                if (debugShows(0) && taxes.report.years.isNotEmpty()) TaxYearSection(taxes)
                if (debugShows(1) && taxes.sellable.any { it.price != null && it.fxRate != null }) SaleSimulatorSection(model, taxes)
                if (debugShows(2)) RatesSection(taxes) { editing = it }
                if (debugShows(3)) LossPoolSection(model, taxes)
                OpportunitiesSection(taxes)
                RegimeNote(model, taxes.regime)
            }
            val target = editing
            FormDialog(target != null, { editing = null }) {
                if (target != null) InstrumentSettingsView(model, target, taxes.setting(target.id), taxes.resolved(target.id)) { editing = null }
            }
        }
    }
}

@Composable
private fun TaxRow(label: String, value: String, hint: String? = null, color: androidx.compose.ui.graphics.Color = BuddyBudgetTheme.colors.foreground) {
    val c = BuddyBudgetTheme.colors
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space1_5), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(label, BBTextStyle.Body, color = c.mutedForeground)
                if (hint != null) InfoHintButton(tr("Cos'è: {0}", mapOf("0" to label)), hint)
            }
            BBText(value, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"), color = color)
        }
    }
}

@Composable
private fun TaxYearSection(taxes: InvestmentsTaxes) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var year by remember { mutableStateOf<Int?>(null) }
    val recent = TaxRules.recentYears(taxes.report.years)
    val y = recent.firstOrNull { it.year == year } ?: recent[0]
    val f = { v: Double -> BBFormat.formatCurrency(v, taxes.currency, locale, masked = hide) }
    val hasCrypto = y.cryptoGains > 0 || y.cryptoLosses > 0
    val gap = y.estimatedTax - y.taxOnCrypto - y.withheld
    val title = if (y.year == taxes.currentYear) tr("Quest'anno") else tr("Anno {0}", mapOf("0" to y.year.toString()))
    val years = recent.map { it.year to it.year.toString() }
    // The year choice sits beside the title (web phone layout) while it fits.
    PanelSection(title, BBIcon.ReceiptText, color = c.neg, action = {
        if (years.size > 1 && years.size <= TitleSegments.MAX_INLINE) io.buddybudget.app.designsystem.components.SegmentedControl(years, y.year, { year = it }, accessibilityLabel = tr("Anno"))
    }) {
        if (years.size > TitleSegments.MAX_INLINE) ScrollableSegmentedControl(years, y.year, { year = it }, accessibilityLabel = tr("Anno"))
        RunsText(listOf(
            InvestmentsTextRun("${tr("Imposte stimate su quanto hai venduto:")} "),
            InvestmentsTextRun(f(y.estimatedTax), InvestmentsTextRun.Style.Strong),
            if (taxes.regime == "dichiarativo" && y.estimatedTax > 0) InvestmentsTextRun(tr(", da versare in dichiarazione."), InvestmentsTextRun.Style.Muted)
            else InvestmentsTextRun("."),
        ))
        if (taxes.regime == "amministrato" && (y.withheld > 0 || y.estimatedTax > 0)) {
            BBText(if (abs(gap) <= 1) tr("Hai registrato {0} di imposte trattenute sulle vendite: in linea con la stima.", mapOf("0" to f(y.withheld)))
            else tr("Hai registrato {0} di imposte trattenute sulle vendite, {1} {2} della stima (crypto escluse): controlla le imposte delle vendite o l'aliquota degli strumenti.",
                mapOf("0" to f(y.withheld), "1" to f(abs(gap)), "2" to tr(if (gap > 0) "in meno" else "in più"))), BBTextStyle.Body, color = c.mutedForeground)
        }
        Column {
            TaxRow(tr("Plusvalenze"), f(y.gains), tr("Guadagni da vendite e rimborsi di azioni, obbligazioni ed ETC: si possono compensare con lo zaino."),
                if (y.gains > 0) c.pos else c.foreground)
            TaxRow(tr("Minusvalenze"), f(y.losses), tr("Perdite da vendite e rimborsi, anche di ETF e fondi: entrano nello zaino."), if (y.losses > 0) c.neg else c.foreground)
            TaxRow(tr("Guadagni da ETF e fondi"), f(y.fundGains), tr("Sono redditi di capitale: tassati per intero, non si compensano con lo zaino."))
            TaxRow(tr("Zaino usato"), f(y.lossesUsed), tr("Minusvalenze (portate all'aliquota del 26%) usate per ridurre le plusvalenze."))
            if (y.lossesExpired > 0) TaxRow(tr("Zaino scaduto"), f(y.lossesExpired), color = c.neg)
            if (hasCrypto) TaxRow(tr("Crypto (netto)"), f(y.cryptoGains - y.cryptoLosses), tr("Sempre in dichiarazione, compensabili solo tra crypto. Aliquota {0} {1}.",
                mapOf("0" to if (y.year >= 2026) "33%" else "26%", "1" to if (y.year <= 2024) tr("con franchigia di 2.000 €") else "")))
            TaxRow(tr("Imposte su plusvalenze"), f(y.taxOnGains))
            TaxRow(tr("Imposte su ETF e fondi"), f(y.taxOnFunds))
            if (hasCrypto) TaxRow(tr("Imposte su crypto"), f(y.taxOnCrypto))
            TaxRow(tr("Dividendi e cedole lordi"), f(y.incomeGross))
            TaxRow(tr("Ritenute sui proventi"), f(y.incomeWithheld), tr("Quelle registrate sui dividendi e le cedole: le trattiene sempre chi paga."))
            TaxRow(tr(if (y.year == taxes.currentYear) "Bollo stimato" else "Bollo"), f(y.bollo),
                tr("0,2% del valore a fine anno, in proporzione ai giorni in cui hai investito. Per l'anno in corso: se il valore restasse quello di oggi."))
        }
        if (y.nonHarmonizedCount > 0) {
            BBText(tr("Hai venduto in guadagno ETF non armonizzati: in realtà sono tassati all'aliquota IRPEF in dichiarazione, qui sono stimati al 26%."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** «Prima di vendere» (INV-086): server simulation, debounced 300 ms. */
@Composable
private fun SaleSimulatorSection(model: InvestmentsModel, taxes: InvestmentsTaxes) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var instrumentId by remember { mutableStateOf<String?>(null) }
    var quantityText by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<SaleSimulation?>(null) }
    var failed by remember { mutableStateOf(false) }
    val priced = taxes.sellable.filter { it.price != null && it.fxRate != null }
    val position = priced.firstOrNull { it.instrument.id == instrumentId } ?: priced[0]
    val quantity = (quantityText?.let { BBFormat.parseAmount(it) } ?: if (quantityText == null) position.quantity else null)?.let { minOf(it, position.quantity) }
    val f = { v: Double -> BBFormat.formatCurrency(v, taxes.currency, locale, masked = hide) }
    LaunchedEffect(position.instrument.id, quantity) {
        if (quantity == null || quantity <= 0) return@LaunchedEffect
        delay(300)
        val r = model.simulateSale(position.instrument.id, quantity)
        result = r
        failed = r == null
    }
    PanelSection(tr("Prima di vendere"), BBIcon.Calculator, color = c.swatchIndigo) {
        BBSelect(priced.map { it.instrument.id to it.instrument.name }, position.instrument.id, { instrumentId = it; quantityText = null },
            label = tr("Posizione"), title = tr("Posizione da vendere"))
        BBTextField(quantityText ?: OperationForm.numberText(position.quantity), { quantityText = it },
            label = tr("Quote (di {0})", mapOf("0" to if (hide) BBFormat.AMOUNT_MASK else BBFormat.formatNumber(position.quantity, locale, maximumFractionDigits = 4))), keyboard = BBKeyboard.Amount)
        BBText("${tr("All'ultimo prezzo (")}${BBFormat.formatCurrency(position.price ?: 0.0, position.instrument.currency, locale, masked = hide)}${if (position.instrument.isPercentOfNominal) tr(" ogni 100 di nominale") else ""}${tr("), senza commissioni.")}",
            BBTextStyle.Caption, color = c.mutedForeground)
        val r = result
        if (quantity != null && quantity > 0 && r != null && r.instrumentId == position.instrument.id) {
            io.buddybudget.app.designsystem.components.SimulationResult(tr("Ti resta"), f(r.net))
            Column {
                TaxRow(tr("Incasso"), f(r.proceeds))
                TaxRow(tr("Costo fiscale (prezzo medio)"), f(r.cost))
                TaxRow(tr(if (r.gain >= 0) "Plusvalenza" else "Minusvalenza"), BBFormat.formatSignedCurrency(r.gain, taxes.currency, locale, hide))
                if (r.lossesUsed > 0) TaxRow(tr("Zaino usato"), f(r.lossesUsed))
                if (r.lossesCreated > 0) TaxRow(tr("Nuovo zaino"), f(r.lossesCreated))
                TaxRow(r.taxLineLabel, f(abs(r.taxDelta)))
            }
            BBText(r.note, BBTextStyle.Body, color = c.mutedForeground)
        } else if (quantity == null || quantity <= 0) {
            BBText(tr("Inserisci quante quote vuoi vendere."), BBTextStyle.Body, color = c.mutedForeground)
        } else if (failed) {
            BBText(tr("Qualcosa è andato storto. Riprova."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            BBSkeleton(Modifier.fillMaxWidth(), height = 160.dp, radius = BBRadius.lg)
        }
    }
}

@Composable
private fun RatesSection(taxes: InvestmentsTaxes, onEdit: (Instrument) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val shown = taxes.rateListInstrumentIds.mapNotNull { taxes.instrument(it) }.filter { it.kind != InstrumentType.Crypto && taxes.resolved(it.id) != null }
    if (shown.isEmpty()) return
    PanelSection(tr("Aliquote degli strumenti"), BBIcon.List, color = c.swatchSlate) {
        Column {
            for (instrument in shown) {
                val r = taxes.resolved(instrument.id)!!
                Row(Modifier.padding(vertical = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                    InstrumentIconView(instrument, size = 28.dp)
                    Column(Modifier.weight(1f)) {
                        BBText(instrument.name, BBTextStyle.Body, maxLines = 1)
                        val fund = instrument.kind == InstrumentType.Etf || instrument.kind == InstrumentType.Fondo
                        BBText("${BBFormat.formatPct(r.taxRate, locale)} · ${tr(TaxRules.rateSourceLabel(r.taxRateSource))}" +
                            if (fund) " · ${tr(if (r.harmonized == true) "armonizzato" else "non armonizzato")}" else "", BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    BBButton(tr("Modifica"), { onEdit(instrument) }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                }
            }
        }
    }
}

@Composable
private fun LossPoolSection(model: InvestmentsModel, taxes: InvestmentsTaxes) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    var adding by remember { mutableStateOf(false) }
    var year by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<String?>(null) }
    val byExpiry = TaxRules.lossesByExpiry(taxes.report.losses)
    val crypto = TaxRules.lossesByExpiry(taxes.report.losses, crypto = true)
    val total = byExpiry.sumOf { it.second }
    val max = byExpiry.maxOfOrNull { it.second } ?: 0.0
    val money = { v: Double -> BBFormat.formatCurrency(v, taxes.currency, locale, maximumFractionDigits = 0, masked = hide) }
    PanelSection(tr("Zaino delle minusvalenze"), BBIcon.Backpack, color = c.swatchIndigo, action = {
        InfoHintButton(tr("Cos'è lo zaino"),
            tr("Le minusvalenze di un anno si possono usare fino al 31 dicembre del quarto anno dopo, per non pagare tasse sulle plusvalenze di azioni, obbligazioni ed ETC (non sui guadagni degli ETF). Gli importi sono portati all'aliquota del 26%."))
    }) {
        if (total > 0) RunsText(listOf(InvestmentsTextRun("${tr("Puoi ancora compensare")} "), InvestmentsTextRun(money(total), InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun(" ${tr("di plusvalenze.")}")))
        else BBText(tr("Lo zaino è vuoto: nessuna minusvalenza da compensare."), BBTextStyle.BodyLarge)
        for ((expires, value) in byExpiry) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText("${tr("Scade fine")} $expires", if (expires == taxes.currentYear) BBTextStyle.BodyStrong else BBTextStyle.Body, Modifier.width(120.dp),
                    color = if (expires == taxes.currentYear) c.neg else c.mutedForeground)
                Box(Modifier.weight(1f)) { FillBar(if (max > 0) value / max else 0.0, c.primary, height = 8.dp) }
                BBText(money(value), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
            }
        }
        if (crypto.isNotEmpty()) BBText("${tr("Zaino crypto (compensabile solo con crypto):")} ${money(crypto.sumOf { it.second })}.", BBTextStyle.Body, color = c.mutedForeground)
        BBText(tr("Minusvalenze pregresse"), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.Medium), color = c.mutedForeground)
        if (taxes.carryforwards.isEmpty()) {
            BBText(tr("Se il broker aveva già minusvalenze da prima dell'app, aggiungile qui."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            for (cf in taxes.carryforwards) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    val line = buildAnnotatedString {
                        append("${cf.year} · ${BBFormat.formatCurrency(cf.amountValue, taxes.currency, locale, masked = hide)}")
                        cf.note?.let { withStyle(SpanStyle(color = c.mutedForeground)) { append(" · $it") } }
                    }
                    Text(line, Modifier.weight(1f), style = BBTextStyle.Body.style.copy(color = c.foreground), maxLines = 1)
                    Box(Modifier.bbDisabled(deleting != null)) {
                        BBIconButton(BBIcon.Trash2, tr("Elimina la minusvalenza del {0}", mapOf("0" to cf.year.toString()))) {
                            if (deleting == null) {
                                deleting = cf.id
                                model.launch {
                                    model.deleteCarryforward(cf.id)
                                    deleting = null
                                }
                            }
                        }
                    }
                }
            }
        }
        if (adding) {
            Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.6f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBTextField(year, { year = it }, Modifier.width(96.dp), keyboard = BBKeyboard.Number)
                    BBTextField(amount, { amount = it }, Modifier.weight(1f), placeholder = tr("Importo ({0})", mapOf("0" to taxes.currency)), keyboard = BBKeyboard.Amount)
                }
                BBTextField(note, { note = it }, placeholder = tr("Nota (facoltativa)"))
                BBText(tr("Usa il residuo dello zaino che vedi nel rendiconto fiscale del broker, con l'anno in cui è nato."), BBTextStyle.Caption, color = c.mutedForeground)
                error?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBButton(tr("Aggiungi"), {
                        val value = BBFormat.parseAmount(amount)
                        val problem = TaxRules.carryforwardError(year.toIntOrNull(), value, taxes.currentYear)
                        if (problem != null) {
                            error = problem
                        } else {
                            saving = true
                            model.launch {
                                error = model.addCarryforward(year.toInt(), value!!, note.trim().ifEmpty { null })
                                saving = false
                                if (error == null) adding = false
                            }
                        }
                    }, size = BBButtonSize.Sm, isLoading = saving)
                    BBButton(tr("Annulla"), { adding = false }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                }
            }
        } else {
            BBButton(tr("Aggiungi minusvalenza pregressa"), {
                year = (taxes.currentYear - 1).toString(); amount = ""; note = ""; error = null; adding = true
            }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
    }
}

@Composable
private fun OpportunitiesSection(taxes: InvestmentsTaxes) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val o = taxes.opportunities
    if (o.expiringThisYear <= 0 && o.losses.isEmpty()) return
    val money = { v: Double -> BBFormat.formatCurrency(v, taxes.currency, locale, maximumFractionDigits = 0, masked = hide) }
    @Composable
    fun rows(items: List<InvestmentsTaxes.OpportunityRow>, positive: Boolean) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            for (row in items.take(4)) {
                Row {
                    BBText(taxes.instrument(row.instrumentId)?.name ?: tr("Strumento"), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground, maxLines = 1)
                    BBText("${if (positive) "+" else BBFormat.MINUS_SIGN}${money(abs(row.unrealized))}", style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"),
                        color = if (positive) c.pos else c.neg)
                }
            }
        }
    }
    PanelSection(tr("Da sapere"), BBIcon.Lightbulb, color = c.swatchAmber) {
        if (o.expiringThisYear > 0) {
            RunsText(listOf(
                InvestmentsTextRun(money(o.expiringThisYear), InvestmentsTextRun.Style.Neg),
                InvestmentsTextRun(" ${tr("di minusvalenze scadono il 31 dicembre")} ${taxes.currentYear}." + if (o.compensableGains.isEmpty())
                    tr(" Non hai posizioni in guadagno che possano usarle: gli ETF non compensano lo zaino.")
                else tr(" Le posizioni in guadagno che potrebbero usarle valgono {0} di plusvalenze (base 26%):", mapOf("0" to money(o.compensableTotal)))),
            ), style = BBTextStyle.Body.style)
            rows(o.compensableGains, true)
        }
        if (o.losses.isNotEmpty()) {
            BBText("${tr("Hai posizioni in perdita per")} ${money(o.lossesTotal)} ${tr("(base 26%): vendendole, la minusvalenza entrerebbe nello zaino per 4 anni, anche quella di un ETF.")}",
                BBTextStyle.Body)
            rows(o.losses, false)
        }
        BBText(tr("Informazioni per capire l'effetto fiscale, non un consiglio di vendita."), BBTextStyle.Caption, color = c.mutedForeground)
    }
}

/** INV-090. */
@Composable
private fun RegimeNote(model: InvestmentsModel, regime: String) {
    val c = BuddyBudgetTheme.colors
    var saving by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBText(tr("Sono stime secondo le regole italiane, non un calcolo fiscale: per la dichiarazione fai riferimento al broker o a un commercialista."),
            BBTextStyle.Body, color = c.mutedForeground)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(tr("Regime"), BBTextStyle.Body, color = c.mutedForeground)
            InfoHintButton(tr("Cos'è: regime"),
                tr("Amministrato (quasi tutti i broker italiani): il broker trattiene le tasse a ogni vendita e una minusvalenza compensa solo le plusvalenze che realizzi dopo. Dichiarativo (di solito i broker esteri, come IBKR o DEGIRO): paghi in dichiarazione e nell'anno si sommano tutte. Le crypto seguono sempre la dichiarazione."))
            SegmentedControl(listOf("amministrato" to tr("Amministrato"), "dichiarativo" to tr("Dichiarativo")), regime, { next ->
                if (!saving && next != regime) {
                    saving = true
                    model.launch {
                        model.setRegime(next)
                        saving = false
                    }
                }
            }, accessibilityLabel = tr("Regime fiscale del portafoglio"))
        }
    }
}

/** Instrument settings (INV-082, SEC-050…052). */
@Composable
fun InstrumentSettingsView(model: InvestmentsModel, instrument: Instrument, setting: InvestmentsTaxes.Setting?, resolved: InvestmentsTaxes.Resolved?, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val italian = model.countryContent == InvestmentsCountryContent.Italian
    val fund = instrument.kind == InstrumentType.Etf || instrument.kind == InstrumentType.Fondo
    val bond = instrument.kind == InstrumentType.Obbligazione
    var rate by remember { mutableStateOf(setting?.taxRate?.toDoubleOrNull()?.let { if (it == 0.125) "0.125" else "0.26" } ?: "") }
    var harmonized by remember { mutableStateOf(setting?.taxHarmonized?.let { if (it) "si" else "no" } ?: "") }
    var couponRate by remember { mutableStateOf(setting?.couponRate?.toDoubleOrNull()?.let { OperationForm.numberText(Math.rint(it * 100 * 10_000) / 10_000) } ?: "") }
    var frequency by remember { mutableStateOf(setting?.couponFrequency ?: 2) }
    var maturity by remember { mutableStateOf(setting?.maturityDate) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    fun save(input: InstrumentSettingsInput) {
        saving = true
        error = null
        model.launch {
            error = model.saveSettings(instrument.id, input)
            saving = false
            if (error == null) onClose()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.Settings, instrument.name, tr("Valgono solo per te: servono a stimare tasse e proventi."))
        if (italian) {
            FormDialogSection(tr("Imposte")) {
                BBSelect(listOf("" to tr("Automatica ({0})", mapOf("0" to BBFormat.formatPct(resolved?.taxRate ?: 0.26, locale))), "0.26" to tr("26% (ordinaria)"),
                    "0.125" to tr("12,5% (titoli di Stato)")), rate, { rate = it }, label = tr("Aliquota"))
                if (fund) BBSelect(listOf("" to tr("Automatico ({0})", mapOf("0" to tr(if (resolved?.harmonized == false) "no" else "sì"))), "si" to tr("Sì (UCITS)"),
                    "no" to tr("No")), harmonized, { harmonized = it }, label = tr("Armonizzato UE"))
            }
        }
        if (bond) {
            FormDialogSection(tr("Cedole")) {
                BBTextField(couponRate, { couponRate = it }, label = tr("Tasso annuo lordo (%)"), placeholder = tr("Es. 3,85"), keyboard = BBKeyboard.Amount)
                BBSelect(listOf(1 to tr("Annuale"), 2 to tr("Semestrale"), 4 to tr("Trimestrale")), frequency, { frequency = it }, label = tr("Frequenza"),
                    title = tr("Frequenza delle cedole"))
                val m = maturity
                if (m != null) BBDateField(m, { maturity = it }, label = tr("Scadenza"))
                else BBButton(tr("Scadenza"), { maturity = InvestmentsModel.todayKey() }, icon = BBIcon.CalendarDays, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                BBText(tr("Le date delle cedole si contano a ritroso dalla scadenza."), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        error?.let { BBErrorBox(tr(it)) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr("Torna all'automatico"), { save(InstrumentSettingsInput()) }, variant = BBButtonVariant.Ghost, enabled = setting != null && !saving)
            Spacer(Modifier.weight(1f))
            BBButton(tr(if (saving) "Salvataggio…" else "Salva"), {
                val couponValue = BBFormat.parseAmount(couponRate)
                val problem = if (bond) TaxRules.couponsError(couponValue, maturity) else null
                if (problem != null) {
                    error = problem
                } else {
                    val hasCoupons = bond && couponValue != null
                    save(InstrumentSettingsInput(
                        taxRate = if (italian && rate.isNotEmpty()) rate else null,
                        taxHarmonized = if (italian && fund && harmonized.isNotEmpty()) harmonized == "si" else null,
                        couponRate = if (hasCoupons) couponValue!! / 100 else null, couponFrequency = if (hasCoupons) frequency else null,
                        maturityDate = if (hasCoupons) maturity else null,
                    ))
                }
            }, isLoading = saving)
        }
    }
}
