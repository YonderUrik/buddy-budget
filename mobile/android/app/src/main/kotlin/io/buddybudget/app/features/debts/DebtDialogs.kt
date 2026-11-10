package io.buddybudget.app.features.debts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.FormDialogSection
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.features.investments.RunsText
import io.buddybudget.app.features.liquidity.StepBars
import io.buddybudget.app.features.onboarding.StepHeading
import io.buddybudget.app.tr
import io.buddybudget.core.data.DebtEventInput
import io.buddybudget.core.data.DebtPlanRow
import io.buddybudget.core.data.DebtView
import io.buddybudget.core.data.Movement
import io.buddybudget.core.domain.debts.DebtAddCostField
import io.buddybudget.core.domain.debts.DebtAddFormResolution
import io.buddybudget.core.domain.debts.DebtAddFormState
import io.buddybudget.core.domain.debts.DebtCalc
import io.buddybudget.core.domain.debts.DebtCostKind
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentEffect
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentFormValues
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentMode
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentOutcome
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentPreview
import io.buddybudget.core.domain.debts.DebtEventDialogKind
import io.buddybudget.core.domain.debts.DebtFieldCopy
import io.buddybudget.core.domain.debts.DebtLoanInputKey
import io.buddybudget.core.domain.debts.DebtPenaltyUnit
import io.buddybudget.core.domain.debts.DebtResolvedAddForm
import io.buddybudget.core.domain.debts.DebtStartMode
import io.buddybudget.core.domain.debts.DebtStartOption
import io.buddybudget.core.domain.debts.DebtsRules
import io.buddybudget.core.domain.debts.DebtsText
import io.buddybudget.core.domain.debts.rankInstallmentCandidates
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.liquidity.MovementFilter
import io.buddybudget.core.domain.transactions.AmountInputText
import kotlinx.coroutines.launch
import kotlin.math.abs

// Debiti dialogs (10-debts §2, §4–6): add flow, pay installment with the optional linked transaction, simple events and
// early repayment. Full-screen form dialogs; every open starts from empty fields. Twin of DebtDialogs.swift.

// ---------------------------------------------------------------- Add debt (DEBT-009…017)

@Composable
fun AddDebtFlow(model: DebtsModel) {
    val text = debtsText()
    val locale = LocalBBLocale.current
    var form by remember { mutableStateOf<DebtAddFormState?>(null) }
    var step by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var costsOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        // DEBUG-only `--es bbAddStep 1…3`: a prefilled example for screenshots.
        val n = DebugLaunch.value("bbAddStep")?.toIntOrNull()
        if (form == null && n != null) {
            form = DebtAddFormState(name = "Prestito auto", startMode = DebtStartMode.NUOVO, principal = "15000", installments = "60", annualRate = "6,9",
                firstInstallmentDate = DebtsModel.todayKey())
            step = n
        }
    }
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.Landmark, tr("Aggiungi un debito"),
            tr(if (form == null) "Il finanziamento parte adesso o è già in corso?" else "Un passo alla volta: bastano tre dati su quattro, il quarto lo calcoliamo noi."))
        StepBars(step, DebtsRules.ADD_STEPS, tr("Passi per aggiungere un debito"))
        val state = form
        if (state == null) {
            Column {
                DebtStartOption.all.forEachIndexed { index, option ->
                    Row(
                        Modifier.fillMaxWidth().bbPressable({
                            form = DebtAddFormState(startMode = option.mode, firstInstallmentDate = DebtsModel.todayKey())
                            step = 1
                        }, RoundedCornerShape(BBRadius.lg), pressedBackground = c.alphaPrimary5, translate = false).padding(vertical = BBSpacing.space4),
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                    ) {
                        BBIconBadge(when (option.mode) {
                            DebtStartMode.NUOVO -> BBIcon.Play
                            DebtStartMode.ORIGINE -> BBIcon.FileText
                            DebtStartMode.FOTOGRAFIA -> BBIcon.Camera
                        }, c.primary, 36.dp, 18.dp)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                            BBText(tr(option.title), style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500))
                            BBText(tr(option.description), BBTextStyle.Body, color = c.mutedForeground)
                        }
                        BBIconView(BBIcon.ChevronRight, Modifier.padding(top = 10.dp), size = 16.dp, color = c.mutedForeground)
                    }
                    if (index < DebtStartOption.all.size - 1) BBSeparator()
                }
            }
            return@Column
        }
        val copy = DebtFieldCopy.of(state.startMode)
        val resolution = DebtCalc.resolveAddForm(state)
        val resolved = (resolution as? DebtAddFormResolution.Ok)?.value
        when (step) {
            1 -> {
                StepHeading(tr("Come si chiama il finanziamento?"),
                    tr("Il nome serve a riconoscerlo nell'elenco; poi la data della {0}.", mapOf("0" to tr(copy.firstDate).lowercase())))
                DebtField(tr("Nome"), state.name, { form = state.copy(name = it.take(DebtsRules.NAME_MAX_LENGTH)) },
                    placeholder = tr("Es. Prestito auto"), keyboard = BBKeyboard.Text)
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBText(tr(copy.firstDate), BBTextStyle.Caption, color = c.mutedForeground)
                    BBDateField(state.firstInstallmentDate, { form = state.copy(firstInstallmentDate = it) })
                }
            }
            2 -> {
                StepHeading(tr("I dati che conosci"), tr("Compila quelli che hai. Se te ne manca uno, lascialo vuoto: lo calcoliamo dagli altri tre."))
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        DebtField(tr(copy.principal), state.principal, { form = state.copy(principal = it) }, Modifier.weight(1f),
                            placeholder = text.calculatedPlaceholder(DebtLoanInputKey.PRINCIPAL, resolved))
                        DebtField(tr("Rata mensile"), state.installment, { form = state.copy(installment = it) }, Modifier.weight(1f),
                            placeholder = text.calculatedPlaceholder(DebtLoanInputKey.INSTALLMENT, resolved))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        DebtField(tr(copy.installments), state.installments, { form = state.copy(installments = it) }, Modifier.weight(1f),
                            placeholder = text.calculatedPlaceholder(DebtLoanInputKey.INSTALLMENTS, resolved))
                        DebtField(tr("Tasso annuo (TAN, %)"), state.annualRate, { form = state.copy(annualRate = it) }, Modifier.weight(1f),
                            placeholder = text.calculatedPlaceholder(DebtLoanInputKey.ANNUAL_RATE, resolved))
                    }
                }
                val calc = resolved?.calculated
                if (resolved != null && calc != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBIconView(BBIcon.Info, Modifier.padding(top = 2.dp), size = 16.dp, color = c.primary)
                        RunsText(text.calculated(calc, value(calc, resolved), model.currency), style = BBTextStyle.Body.style)
                    }
                }
                val failure = (resolution as? DebtAddFormResolution.Failure)?.message
                if (failure != null) BBText(tr(failure), BBTextStyle.Body, color = c.neg)
            }
            else -> {
                StepHeading(tr("Spese accessorie e conferma"), tr("Le spese sono facoltative; sotto vedi il piano che ne esce."))
                CostsSection(state, costsOpen, { costsOpen = !costsOpen }, { form = it }, model.currency)
                val preview = resolved?.let { runCatching { DebtCalc.previewAddForm(state, it) }.getOrNull() }
                if (resolved != null && preview != null) {
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(tr("Anteprima del piano"), BBTextStyle.BodyStrong)
                        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            PreviewCell(tr("Rata"), text.money(preview.installment, model.currency), Modifier.weight(1f))
                            PreviewCell(tr("Finisce a"), BBFormat.formatMonthYear(preview.endDate, locale), Modifier.weight(1f))
                            PreviewCell(tr(if (resolved.apr != null) "Interessi · TAEG" else "Interessi totali"),
                                text.money(preview.totalInterest, model.currency, 0) +
                                    (resolved.apr?.let { " · " + BBFormat.formatNumber(it, locale, minimumFractionDigits = 2, maximumFractionDigits = 2) + "%" } ?: ""),
                                Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        error?.let { BBErrorBox(tr(it), reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Debito) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr("Indietro"), {
                error = null
                if (step == 1) form = null
                step -= 1
            }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
            Spacer(Modifier.weight(1f))
            BBButton(tr(if (step == 3) (if (saving) "Salvo…" else "Aggiungi debito") else "Continua"), {
                val missing = "Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso"
                when (step) {
                    1 -> if (JSNumber.trim(state.name).isEmpty()) error = "Dai un nome al debito, per riconoscerlo nell'elenco." else { error = null; step = 2 }
                    2 -> if (resolved == null) error = (resolution as? DebtAddFormResolution.Failure)?.message ?: missing else { error = null; step = 3 }
                    else -> {
                        val basics = DebtCalc.validateAddFormBasics(state)
                        if (basics != null) error = basics
                        else if (resolved == null) error = (resolution as? DebtAddFormResolution.Failure)?.message ?: missing
                        else {
                            error = null
                            saving = true
                            scope.launch {
                                error = model.create(DebtCalc.buildCreateDebtInput(state, resolved, DebtsModel.todayKey()))
                                saving = false
                            }
                        }
                    }
                }
            }, size = BBButtonSize.Touch, isLoading = saving)
        }
    }
}

private fun value(key: DebtLoanInputKey, resolved: DebtResolvedAddForm): Double = when (key) {
    DebtLoanInputKey.PRINCIPAL -> resolved.inputs.principal
    DebtLoanInputKey.INSTALLMENT -> resolved.inputs.installment
    DebtLoanInputKey.INSTALLMENTS -> resolved.inputs.installments
    DebtLoanInputKey.ANNUAL_RATE -> resolved.inputs.annualRate
}

@Composable
private fun PreviewCell(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = BBStyles.rowAmount.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.W500))
    }
}

@Composable
private fun CostsSection(state: DebtAddFormState, open: Boolean, onToggle: () -> Unit, onChange: (DebtAddFormState) -> Unit, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val expanded = open || state.costs.isNotEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget).bbPressable(onToggle, RoundedCornerShape(BBRadius.lg), translate = false),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBIconBadge(BBIcon.Receipt, c.primary, 28.dp, 14.dp)
            Text(buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c.foreground)) { append(tr("Spese accessorie")) }
                withStyle(SpanStyle(color = c.mutedForeground)) { append(" " + tr("(facoltativo)")) }
            }, Modifier.weight(1f), style = BBTextStyle.Body.style)
            BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (expanded) 180f else 0f), size = 16.dp, color = c.mutedForeground)
        }
        if (expanded) {
            state.costs.forEachIndexed { index, cost ->
                fun update(next: DebtAddCostField) = onChange(state.copy(costs = state.costs.mapIndexed { i, x -> if (i == index) next else x }))
                Column(Modifier.padding(bottom = BBSpacing.space1), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        val nameLabel = tr("Nome della spesa")
                        BBTextField(cost.label, { update(cost.copy(label = it)) }, Modifier.weight(1f).semantics { contentDescription = nameLabel },
                            placeholder = tr("Es. Assicurazione"))
                        BBIconButton(BBIcon.X, tr("Togli la spesa")) { onChange(state.copy(costs = state.costs.filterIndexed { i, _ -> i != index })) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        val amountLabel = tr("Importo della spesa")
                        BBTextField(cost.amount, { update(cost.copy(amount = it)) }, Modifier.weight(1f).semantics { contentDescription = amountLabel },
                            placeholder = BBFormat.getCurrencySymbol(currency, locale), keyboard = BBKeyboard.Amount)
                        BBSelect(DebtCostKind.entries.map { it to tr(if (it == DebtCostKind.UNA_TANTUM) "Una tantum" else "Ogni rata") }, cost.kind,
                            { update(cost.copy(kind = it)) }, Modifier.weight(1f), title = tr("Quando si paga"))
                    }
                }
            }
            if (state.costs.size < DebtsRules.MAX_COSTS) {
                BBButton(tr("Aggiungi una spesa"), { onChange(state.copy(costs = state.costs + DebtAddCostField("", "", DebtCostKind.UNA_TANTUM))) },
                    icon = BBIcon.Plus, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            }
        }
    }
}

// ---------------------------------------------------------------- Pay installment (DEBT-023, DEBT-024)

@Composable
fun PayInstallmentView(model: DebtsModel, debtId: String, row: DebtPlanRow) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var date by remember { mutableStateOf(DebtsRules.defaultPaymentDate(row, DebtsModel.todayKey())) }
    var amount by remember { mutableStateOf(AmountInputText.input(row.installment, locale)) }
    var transaction by remember { mutableStateOf<Movement?>(null) }
    var linkOpen by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.CircleCheck, tr("Rata {0} pagata{1}", mapOf("0" to row.number.toString(), "1" to "")),
            tr("Data e importo reali, precompilati dal piano."))
        FormDialogSection(tr("Il pagamento"), BBIcon.Wallet) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBText(tr("Data del pagamento"), BBTextStyle.Caption, color = c.mutedForeground)
                    BBDateField(date, { date = it })
                }
                DebtField(tr("Importo pagato"), amount, { amount = it }, Modifier.weight(1f), hint = tr("Quello realmente addebitato"))
            }
        }
        Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(Modifier.fillMaxWidth().heightIn(min = 36.dp).bbPressable({ linkOpen = !linkOpen }, RoundedCornerShape(BBRadius.md), translate = false),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.Link, size = 16.dp, color = c.mutedForeground)
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Medium, color = c.foreground)) { append(tr("Collega una transazione")) }
                    withStyle(SpanStyle(color = c.mutedForeground)) { append(" " + tr("(facoltativo)")) }
                }, Modifier.weight(1f), style = BBTextStyle.Body.style)
                BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (linkOpen) 180f else 0f), size = 16.dp, color = c.mutedForeground)
            }
            if (linkOpen || transaction != null) {
                BBText(tr("Solo un promemoria: non cambia la transazione."), BBTextStyle.Body, color = c.mutedForeground)
                TransactionPicker(model, row.dueDate, row.installment, transaction) { transaction = it }
            }
        }
        error?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            BBButton(tr(if (saving) "Salvo…" else "Segna pagata"), {
                val (input, problem) = DebtsRules.paymentInput(row, date, amount, transaction?.id)
                if (input == null) error = problem?.source
                else {
                    error = null
                    saving = true
                    scope.launch {
                        error = model.addEvent(debtId, input)
                        saving = false
                    }
                }
            }, size = BBButtonSize.Touch, isLoading = saving)
        }
    }
}

/** DEBT-024: expenses ±20 days around the due date, same amount first; never links on its own. */
@Composable
private fun TransactionPicker(model: DebtsModel, dueDate: String, expected: Double, selected: Movement?, onSelect: (Movement?) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hidden = LocalHideAmounts.current
    var all by remember { mutableStateOf<List<Movement>?>(null) }
    var search by remember { mutableStateOf("") }
    var categoryId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(dueDate) { all = model.candidates(dueDate) }
    val visible = DebtCalc.rankInstallmentCandidates(all ?: emptyList(), MovementFilter(categoryId = categoryId, searchText = search), dueDate, expected)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        val searchLabel = tr("Cerca transazioni per descrizione o nota")
        BBTextField(search, { search = it }, Modifier.semantics { contentDescription = searchLabel }, placeholder = tr("Cerca…"))
        BBSelect(listOf<Pair<String?, String>>(null to tr("Tutte le categorie")) + model.categories.map { it.id to it.name }, categoryId,
            { categoryId = it }, title = tr("Filtra per categoria"))
        if (selected != null) {
            Row(Modifier.fillMaxWidth().background(c.alphaPrimary5, RoundedCornerShape(BBRadius.md)).border(1.dp, c.alphaPrimary45, RoundedCornerShape(BBRadius.md))
                .padding(start = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically) {
                BBText("${tr("Collegata:")} ${selected.description} · ${BBFormat.formatCurrency(abs(selected.amount), model.currency, locale, masked = hidden)}",
                    BBTextStyle.Body, Modifier.weight(1f), maxLines = 1)
                BBIconButton(BBIcon.X, tr("Scollega la transazione")) { onSelect(null) }
            }
        }
        Column(Modifier.fillMaxWidth().heightIn(max = 224.dp).clip(RoundedCornerShape(BBRadius.md)).border(1.dp, c.border, RoundedCornerShape(BBRadius.md))
            .verticalScroll(rememberScrollState())) {
            when {
                all == null -> PickerStatus(tr("Cerco le transazioni…"))
                visible.isEmpty() -> PickerStatus(tr(if (all?.isEmpty() == true) "Nessuna uscita vicina alla scadenza." else "Nessuna transazione corrisponde ai filtri."))
                else -> visible.forEach { t ->
                    val isSelected = t.id == selected?.id
                    Row(Modifier.fillMaxWidth().background(if (isSelected) c.alphaPrimary10 else Color.Transparent)
                        .bbPressable({ onSelect(if (isSelected) null else t) }, RoundedCornerShape(0.dp), translate = false)
                        .semantics { this.selected = isSelected }.padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space1_5),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        model.categories.firstOrNull { it.id == t.categoryId }?.let { CategoryAvatar(it, 20.dp) }
                        Column(Modifier.weight(1f)) {
                            BBText(t.description, BBTextStyle.Body, maxLines = 1)
                            BBText(BBFormat.formatShortDate(t.date, locale), BBTextStyle.Caption, color = c.text2)
                        }
                        BBText(BBFormat.formatCurrency(abs(t.amount), model.currency, locale, masked = hidden),
                            style = BBStyles.rowAmount.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.W500))
                        if (isSelected) BBIconView(BBIcon.Check, size = 16.dp, color = c.primary)
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerStatus(text: String) {
    BBText(text, BBTextStyle.Body, Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space3), color = BuddyBudgetTheme.colors.text2)
}

// ---------------------------------------------------------------- Rate change / balance correction (DEBT-025, DEBT-026)

@Composable
fun DebtEventFormView(model: DebtsModel, debtId: String, kind: DebtEventDialogKind) {
    val c = BuddyBudgetTheme.colors
    var date by remember { mutableStateOf(DebtsModel.todayKey()) }
    var value by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(if (kind == DebtEventDialogKind.BalanceCorrection) BBIcon.SlidersHorizontal else BBIcon.Percent, tr(kind.title), tr(kind.description))
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr("Dalla data"), BBTextStyle.Caption, color = c.mutedForeground)
                BBDateField(date, { date = it })
            }
            DebtField(tr(kind.label), value, { value = it }, Modifier.weight(1f), hint = tr(kind.hint))
        }
        error?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            BBButton(tr(if (saving) "Salvo…" else kind.submit), {
                val (input, problem) = kind.input(date, value)
                if (input == null) error = problem?.source
                else {
                    error = null
                    saving = true
                    scope.launch {
                        error = model.addEvent(debtId, input)
                        saving = false
                    }
                }
            }, size = BBButtonSize.Touch, isLoading = saving)
        }
    }
}

// ---------------------------------------------------------------- Early repayment (DEBT-032…035)

@Composable
fun EarlyRepaymentView(model: DebtsModel, debt: DebtView) {
    val c = BuddyBudgetTheme.colors
    val text = debtsText()
    val hidden = LocalHideAmounts.current
    var mode by remember { mutableStateOf(DebtEarlyRepaymentMode.ONCE) }
    var date by remember { mutableStateOf(DebtsModel.todayKey()) }
    var amount by remember { mutableStateOf("") }
    var penalty by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf(DebtPenaltyUnit.EUR) }
    var effect by remember { mutableStateOf<DebtEarlyRepaymentEffect?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        // DEBUG-only `--es bbDialog early-filled`: 5000 € and the reduce-duration choice, for screenshots.
        if (DebugLaunch.value("bbDialog") == "early-filled") {
            amount = "5000"
            effect = DebtEarlyRepaymentEffect.REDUCE_DURATION
        }
    }
    val preview = DebtsRules.earlyRepayment(debt, model.state.today, DebtEarlyRepaymentFormValues(mode, date, amount, penalty, unit))
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.PiggyBank, tr("Estinzione anticipata"),
            tr("Vedi cosa cambia prima di decidere. Se l'hai già fatto, scegli l'alternativa che la banca ti ha applicato e registrala."))
        FormDialogSection(tr("Quanto e quando"), BBIcon.Banknote) {
            SegmentedControl(listOf(DebtEarlyRepaymentMode.ONCE to tr("Una volta"), DebtEarlyRepaymentMode.MONTHLY to tr("Ogni mese (simula)")), mode,
                { mode = it; amount = ""; effect = null }, accessibilityLabel = tr("Quante volte"), stretch = true)
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                DebtField(tr(if (mode == DebtEarlyRepaymentMode.ONCE) "Importo che estingui" else "Extra ogni mese"), amount, { amount = it }, Modifier.weight(1f))
                if (mode == DebtEarlyRepaymentMode.ONCE) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        BBText(tr("Data"), BBTextStyle.Caption, color = c.mutedForeground)
                        BBDateField(date, { date = it })
                    }
                }
            }
            if (mode == DebtEarlyRepaymentMode.ONCE) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBText(tr("Penale di estinzione (facoltativa)"), BBTextStyle.Caption, color = c.mutedForeground)
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBTextField(penalty, { penalty = it }, Modifier.weight(1f), keyboard = BBKeyboard.Amount)
                        BBSelect(listOf(DebtPenaltyUnit.EUR to "€", DebtPenaltyUnit.PERCENT to tr("% della somma")), unit, { unit = it },
                            Modifier.width(150.dp), title = tr("Unità della penale"))
                    }
                    BBText(tr("La trovi nel contratto: spesso fino all'1% della somma"), BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
        if (preview != DebtEarlyRepaymentPreview.Empty || error != null) {
            FormDialogSection(tr("Cosa cambia"), BBIcon.GitCompareArrows) {
                when (preview) {
                    is DebtEarlyRepaymentPreview.Error -> BBText(tr(preview.message), BBTextStyle.Body, color = c.neg)
                    is DebtEarlyRepaymentPreview.Once -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(text.baseline(preview.comparison, model.currency, hidden), BBTextStyle.Caption, color = c.mutedForeground)
                        OutcomeCard(preview.comparison.reduceInstallment, effect == DebtEarlyRepaymentEffect.REDUCE_INSTALLMENT, text, model.currency) {
                            effect = DebtEarlyRepaymentEffect.REDUCE_INSTALLMENT
                        }
                        OutcomeCard(preview.comparison.reduceDuration, effect == DebtEarlyRepaymentEffect.REDUCE_DURATION, text, model.currency) {
                            effect = DebtEarlyRepaymentEffect.REDUCE_DURATION
                        }
                    }
                    is DebtEarlyRepaymentPreview.Monthly -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        BBText("${tr("Con")} ${text.money(preview.amount, model.currency, masked = hidden)} ${tr("in più ogni mese")}", BBTextStyle.BodyStrong,
                            Modifier.padding(bottom = BBSpacing.space1))
                        OutcomeRow(tr("Finisci"), text.finish(preview.result.endDate, preview.result.monthsSaved))
                        OutcomeRow(tr("Interessi risparmiati"), text.money(preview.result.interestSaved, model.currency, masked = hidden), true, c.pos)
                        OutcomeRow(tr("Versato in extra in totale"), text.money(preview.result.extraPaid, model.currency, masked = hidden))
                        BBText(tr("È solo una simulazione: non si registra. Per registrarle, inserisci le singole estinzioni quando le fai."),
                            BBTextStyle.Caption, Modifier.padding(top = BBSpacing.space1), color = c.mutedForeground)
                    }
                    DebtEarlyRepaymentPreview.Empty -> Unit
                }
                error?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
            }
        }
        if (mode == DebtEarlyRepaymentMode.ONCE) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                BBButton(tr(if (saving) "Salvo…" else if (effect != null) "Registra come fatto" else "Scegli un'alternativa per registrarla"), {
                    val once = preview as? DebtEarlyRepaymentPreview.Once
                    val chosen = effect
                    if (once != null && chosen != null) {
                        error = null
                        saving = true
                        scope.launch {
                            error = model.addEvent(debt.id, DebtEventInput.EarlyRepayment(once.date.iso, once.amount, once.penalty, chosen))
                            saving = false
                        }
                    }
                }, icon = if (effect != null && !saving) BBIcon.Check else null, size = BBButtonSize.Touch, isLoading = saving,
                    enabled = effect != null && preview is DebtEarlyRepaymentPreview.Once)
            }
        }
    }
}

@Composable
private fun OutcomeCard(outcome: DebtEarlyRepaymentOutcome, selected: Boolean, text: DebtsText, currency: String, onSelect: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val reduceRate = outcome.effect == DebtEarlyRepaymentEffect.REDUCE_INSTALLMENT
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(
        Modifier.fillMaxWidth().background(if (selected) c.alphaPrimary5 else Color.Transparent, shape).border(1.dp, if (selected) c.primary else c.border, shape)
            .bbPressable(onSelect, shape, translate = false).semantics { this.selected = selected }.padding(BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBIconView(if (reduceRate) BBIcon.TrendingDown else BBIcon.CalendarCheck, size = 16.dp, color = c.primary)
            BBText(tr(if (reduceRate) "Riduci la rata" else "Riduci la durata"), BBTextStyle.BodyStrong)
        }
        BBText(tr(if (reduceRate) "Stessa scadenza, rata più bassa" else "Stessa rata, finisci prima"), BBTextStyle.Caption,
            Modifier.padding(bottom = BBSpacing.space1), color = c.mutedForeground)
        OutcomeRow(tr("Prossima rata"), if (outcome.closesDebt) "—" else text.money(outcome.nextInstallment, currency, masked = hidden))
        OutcomeRow(tr("Finisci"), text.finish(outcome.endDate, outcome.monthsSaved))
        OutcomeRow(tr("Interessi risparmiati"), text.money(outcome.interestSaved, currency, masked = hidden), true, c.pos)
        OutcomeRow(tr("Al netto della penale"), text.money(outcome.netBenefit, currency, masked = hidden), true, if (outcome.netBenefit > 0) c.pos else c.foreground)
    }
}

@Composable
private fun OutcomeRow(label: String, value: String, strong: Boolean = false, color: Color = BuddyBudgetTheme.colors.foreground) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(label, BBTextStyle.Body, Modifier.weight(1f), color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = (if (strong) BBTextStyle.BodyStrong else BBTextStyle.Body).style.copy(fontFeatureSettings = "tnum"), color = color)
    }
}
