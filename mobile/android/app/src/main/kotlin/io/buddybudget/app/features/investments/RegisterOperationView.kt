package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.FormDialogSection
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.PriceOnDate
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.investments.OperationType
import io.buddybudget.core.domain.investments.PriceSuggestionHint
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.MainScope

/** «Registra operazione» stepped flow and «Modifica operazione» single screen (INV-062…073). iOS: RegisterOperationView.swift. */
@Composable
fun RegisterOperationView(model: InvestmentsModel, initial: OperationForm) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val editing = model.editing != null
    var form by remember(initial) { mutableStateOf(initial) }
    var step by remember(initial) { mutableStateOf(0) }
    var priceEdited by remember(initial) { mutableStateOf(editing || initial.price.isNotEmpty()) }
    var suggestion by remember(initial) { mutableStateOf<PriceOnDate?>(null) }
    var fetching by remember(initial) { mutableStateOf(false) }
    var error by remember(initial) { mutableStateOf<String?>(null) }
    var saving by remember(initial) { mutableStateOf(false) }
    val scope = remember { MainScope() }
    var priceJob by remember { mutableStateOf<Job?>(null) }
    val userCurrency = model.currency
    val suggestions = model.anyView?.let { v -> v.heldInstrumentIds.mapNotNull { v.instrument(it) } } ?: emptyList()

    fun refreshPrice() {
        priceJob?.cancel()
        val id = form.instrument?.id
        if (editing || !form.type.suggestsMarketPrice || id == null) {
            suggestion = null
            return
        }
        val date = form.date
        suggestion = null
        fetching = true
        priceJob = scope.launch {
            repeat(30) {
                val result = runCatching { model.env.instruments.price(id, date) }.getOrNull()
                suggestion = result ?: PriceOnDate(null, false)
                val close = result?.price?.close
                if (close != null && !priceEdited) form = form.copy(price = OperationForm.priceText(close))
                if (result?.loading != true) {
                    fetching = false
                    return@launch
                }
                delay(2000)
            }
            fetching = false
        }
    }
    LaunchedEffect(initial) { refreshPrice() }
    DisposableEffect(Unit) { onDispose { priceJob?.cancel() } }

    fun save() {
        val problem = form.validate(InvestmentsModel.todayKey())
        if (problem != null) {
            error = problem
            return
        }
        saving = true
        error = null
        model.launch {
            error = model.save(form)
            saving = false
        }
    }

    @Composable
    fun typeSelect() = BBSelect(OperationType.entries.map { it to tr(it.label) }, form.type, {
        form = form.copy(type = it)
        if (step >= form.stepCount) step = form.stepCount - 1
        refreshPrice()
    }, label = tr("Tipo"), title = tr("Tipo di operazione"))

    @Composable
    fun dateField() = BBDateField(form.date, {
        form = form.copy(date = minOf(it, InvestmentsModel.todayKey()))
        refreshPrice()
    }, label = tr("Data"))

    @Composable
    fun amounts() {
        val currency = form.instrument?.currency
        if (form.showsQuantity) BBTextField(form.quantity, { form = form.copy(quantity = it) }, label = tr(form.quantityLabel), keyboard = BBKeyboard.Amount)
        if (form.showsPrice) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBTextField(form.price, {
                    form = form.copy(price = it)
                    priceEdited = true
                }, label = tr(form.priceLabel) + (currency?.let { " ($it)" } ?: ""), keyboard = BBKeyboard.Amount)
                val hint = if (form.type.suggestsMarketPrice) PriceSuggestionHint.of(suggestion, fetching, form.date) else null
                if (hint != null) {
                    val dateText = (hint as? PriceSuggestionHint.Close)?.let { BBFormat.formatDateWithYear(it.date, locale) } ?: ""
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        BBText(tr(hint.source, mapOf("0" to dateText)), BBTextStyle.Caption, color = c.mutedForeground)
                        val close = suggestion?.price?.close
                        if (close != null && priceEdited && form.priceValue != close) {
                            BBText("· ${tr("Usa")} ${BBFormat.formatNumber(close, locale, maximumFractionDigits = 6)}", BBTextStyle.Caption, color = c.primary,
                                modifier = Modifier.bbPressable({
                                    form = form.copy(price = OperationForm.priceText(close))
                                    priceEdited = false
                                }, RoundedCornerShape(4.dp), translate = false))
                        }
                    }
                }
            }
        }
        if (form.showsGross) {
            BBTextField(form.gross, { form = form.copy(gross = it) }, label = tr("Importo lordo{0}", mapOf("0" to (currency?.let { " ($it)" } ?: ""))),
                keyboard = BBKeyboard.Amount)
        }
    }

    @Composable
    fun costs() {
        BBTextField(form.fees, { form = form.copy(fees = it) }, label = tr("Commissioni ({0})", mapOf("0" to userCurrency)), placeholder = "0", keyboard = BBKeyboard.Amount)
        BBTextField(form.taxes, { form = form.copy(taxes = it) }, label = tr("Imposte trattenute ({0})", mapOf("0" to userCurrency)), placeholder = "0",
            keyboard = BBKeyboard.Amount)
        val instrument = form.instrument
        if (form.needsFx(userCurrency) && instrument != null) {
            BBTextField(form.fxRate, { form = form.copy(fxRate = it) }, label = tr("Cambio 1 {0} = ? {1}", mapOf("0" to instrument.currency, "1" to userCurrency)),
                placeholder = tr("BCE del giorno"), keyboard = BBKeyboard.Amount)
        }
    }

    @Composable
    fun countervalue() {
        val value = form.countervalue
        val currency = form.instrument?.currency
        if (value != null && currency != null) {
            BBText("${tr("Controvalore")} ${BBFormat.formatCurrency(value, currency, locale)}", style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
        }
    }

    @Composable
    fun heading(title: String, description: String?) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr(title), style = BBStyles.sectionHeading)
            if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        if (editing) {
            FormDialogHeader(BBIcon.Pencil, tr("Modifica operazione"), tr("Lo strumento non si cambia: per un altro strumento elimina e registra di nuovo."))
            FormDialogSection(tr("Operazione")) {
                typeSelect()
                dateField()
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(tr("Strumento"), BBTextStyle.BodyStrong)
                    BBText(form.instrument?.name ?: "", BBTextStyle.Body, color = c.mutedForeground)
                }
            }
            FormDialogSection(tr("Importi")) {
                amounts()
                if (form.type.hasCosts) costs()
            }
            countervalue()
            error?.let { BBErrorBox(tr(it), reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Operazione) }
            BBButton(tr(if (saving) "Salvataggio…" else "Salva modifiche"), { save() }, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving)
        } else {
            FormDialogHeader(BBIcon.Plus, tr("Registra operazione"), tr("Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio."))
            val label = tr("Passi della nuova operazione")
            Row(Modifier.fillMaxWidth().semantics { contentDescription = "$label ${step + 1}/${form.stepCount}" }, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                repeat(form.stepCount) { i -> Box(Modifier.weight(1f).height(4.dp).background(if (i <= step) c.primary else c.muted, CircleShape)) }
            }
            when (step) {
                0 -> {
                    heading("Che operazione è?", tr("Scegli il tipo e lo strumento."))
                    typeSelect()
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(tr("Strumento"), BBTextStyle.BodyStrong)
                        InstrumentPickerField(form.instrument, suggestions, userCurrency) { chosen ->
                            form = form.copy(instrument = chosen, held = model.heldQuantity(chosen.id), price = "")
                            priceEdited = false
                            refreshPrice()
                        }
                    }
                }
                1 -> {
                    heading("Quando e quanto?", if (form.type == OperationType.Split)
                        tr("Es. 2 se ogni quota diventa due, 0,1 per un raggruppamento 10 a 1. Il costo resta lo stesso.") else form.instrument?.name)
                    dateField()
                    amounts()
                    countervalue()
                }
                else -> {
                    heading("Costi e imposte", tr("Facoltativi: lascia 0 se non ci sono."))
                    costs()
                    countervalue()
                }
            }
            error?.let { BBErrorBox(tr(it), reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Operazione) }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                if (step > 0) BBButton(tr("Indietro"), {
                    error = null
                    step -= 1
                }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
                Spacer(Modifier.weight(1f))
                if (step < form.stepCount - 1) {
                    BBButton(tr("Continua"), {
                        val gate = if (step == 0) form.stepOneError else form.stepTwoError
                        if (gate != null) error = gate else {
                            error = null
                            step += 1
                        }
                    }, size = BBButtonSize.Touch, enabled = !(step == 0 && form.instrument == null))
                } else {
                    BBButton(tr(if (saving) "Registrazione…" else "Registra operazione"), { save() }, size = BBButtonSize.Touch, isLoading = saving)
                }
            }
        }
    }
}
