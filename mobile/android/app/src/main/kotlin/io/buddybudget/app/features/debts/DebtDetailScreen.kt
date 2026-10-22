package io.buddybudget.app.features.debts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwipeToDelete
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.investments.RunsText
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.liquidity.SheetActionRow
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.DebtPlanRow
import io.buddybudget.core.data.DebtView
import io.buddybudget.core.data.DebtsViewData
import io.buddybudget.core.domain.debts.DebtEventDialogKind
import io.buddybudget.core.domain.debts.DebtInstallmentStatus
import io.buddybudget.core.domain.debts.DebtSimulationKind
import io.buddybudget.core.domain.debts.DebtsRules
import io.buddybudget.core.domain.debts.DebtsText
import io.buddybudget.core.domain.format.BBFormat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Loan detail (10-debts §3): loan chips (DEBT-019), facts with the progress ring (DEBT-018), pending banner (DEBT-020),
 * «E se…» (DEBT-030/031), «Cosa hai registrato» (DEBT-027) and «Piano delle rate» (DEBT-021/022). `Estinzione anticipata`
 * is the visible action; `Cambio tasso`, `Correggi residuo` and `Elimina` live in the «⋯» sheet. Twin of `DebtDetailScreen` on iOS.
 */
@Composable
fun DebtDetailScreen(@Suppress("UNUSED_PARAMETER") debtId: String) {
    val shell = LocalShell.current
    val back = LocalShellBack.current
    val model = shell.debts
    val text = debtsText()
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { model.start() }
    val debt = model.state.selected
    // Web phone layout: the loan chips come first, then the loan name as the page title (drawn by the content).
    BBScreen(null, onBack = back, onRefresh = { model.load() }, actions = {
        if (debt != null) BBIconButton(BBIcon.Ellipsis, l10n(io.buddybudget.app.R.string.more_actions_3676f0)) { menu = true }
    }) {
        DebtsGateView(model) {
            val data = model.state.data
            if (debt != null && data != null) DebtDetailContent(model, data, debt, text)
        }
    }
    DebtsDialogs(model)
    val kind = model.eventKind
    FormDialog(kind != null, { model.eventKind = null }) {
        if (kind != null && debt != null) DebtEventFormView(model, debt.id, kind)
    }
    FormDialog(model.earlyOpen, { model.earlyOpen = false }) {
        if (debt != null && model.earlyOpen) EarlyRepaymentView(model, debt)
    }
    fun afterMenu(action: () -> Unit) {
        menu = false
        scope.launch {
            delay(BBMotion.durationSheetExit.toLong() + 50)
            action()
        }
    }
    BBSheet(menu, { menu = false }, l10n(io.buddybudget.app.R.string.more_actions_3676f0)) {
        SheetActionRow(BBIcon.Percent, tr("Cambio tasso")) { afterMenu { model.eventKind = DebtEventDialogKind.RateChange } }
        SheetActionRow(BBIcon.SlidersHorizontal, tr("Correggi residuo")) { afterMenu { model.eventKind = DebtEventDialogKind.BalanceCorrection } }
        SheetActionRow(BBIcon.Trash2, tr("Elimina"), destructive = true) { afterMenu { model.confirmDelete = true } }
    }
    BBAlertSheet(
        model.confirmDelete, tr("Eliminare «{0}»?", mapOf("0" to (debt?.name ?: ""))),
        tr("Spariscono il piano e tutto ciò che hai registrato su questo debito. Le transazioni collegate restano dove sono."),
        tr("Elimina"), onConfirm = { debt?.let { d -> model.delete(d) { back?.invoke() } } }, onDismiss = { model.confirmDelete = false },
    )
}

@Composable
private fun DebtDetailContent(model: DebtsModel, data: DebtsViewData, debt: DebtView, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        if (debugShows(1)) Column(Modifier.padding(top = BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            if (data.debts.size > 1) DebtChips(model, data.debts, debt.id)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(debt.name, Modifier.semantics { heading() }, BBStyles.screenTitle)
                BBText(text.startMode(debt.startMode), BBTextStyle.Caption, color = c.mutedForeground)
            }
            BBButton(tr("Estinzione anticipata"), { model.earlyOpen = true }, icon = BBIcon.PiggyBank,
                variant = io.buddybudget.app.designsystem.components.BBButtonVariant.Sun, size = BBButtonSize.Sm, enabled = !debt.finished)
        }
        if (debugShows(2)) DebtFacts(debt, DebtsRules.repaidShare(debt, data.insights), model.currency, text)
        val pending = text.pending(debt)
        if (debugShows(3) && pending != null) DebtPendingBanner(pending, model.bulkBusy) { model.markAllPaid(debt) }
        if (debugShows(4) && !debt.finished) DebtSimulationPanel(model, debt, text)
        if (debugShows(5)) PanelSection(tr("Cosa hai registrato"), BBIcon.History, color = c.swatchSlate) { DebtEventsList(model, debt, text) }
        PanelSection(tr("Piano delle rate"), BBIcon.CalendarRange, color = c.swatchTeal) { DebtPlanList(model, debt, text) }
    }
}

/** DEBT-019. */
@Composable
private fun DebtChips(model: DebtsModel, debts: List<DebtView>, selected: String) {
    val c = BuddyBudgetTheme.colors
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        debts.forEach { debt ->
            val active = debt.id == selected
            BBText(debt.name, if (active) BBTextStyle.BodyStrong else BBTextStyle.Body,
                Modifier.height(30.dp).background(if (active) c.alphaPrimary10 else Color.Transparent, CircleShape)
                    .border(1.dp, if (active) c.primary else c.border, CircleShape)
                    .bbPressable({ model.select(debt.id) }, CircleShape, translate = false)
                    .padding(horizontal = BBSpacing.space3, vertical = 5.dp),
                color = if (active) c.primary else c.mutedForeground, maxLines = 1)
        }
    }
}

/** DEBT-018. */
@Composable
private fun DebtFacts(debt: DebtView, share: Double, currency: String, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val t = debt.totals
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            DebtRing(share, "${(share * 100).roundToInt()}%", tr("restituito"))
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                AmountText(t.residual, currency, style = BBStyles.hero.copy(fontSize = 36.sp, lineHeight = 40.sp), hero = true)
                BBText(text.residualCaption(debt), BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                Fact(tr("Rata"), if (t.finished) "—" else text.money(t.currentInstallment, currency, masked = hidden), Modifier.weight(1f))
                Fact(tr("Rate rimaste"), t.remainingInstallments.toString(), Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                Fact(tr("Tasso (TAN) · TAEG"), text.rates(debt), Modifier.weight(1f))
                Fact(tr("Interessi che restano"), text.money(t.interestRemaining, currency, 0, hidden), Modifier.weight(1f), c.neg)
            }
        }
    }
}

@Composable
private fun Fact(label: String, value: String, modifier: Modifier, color: Color = BuddyBudgetTheme.colors.foreground) {
    Column(modifier) {
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500), color = color, maxLines = 1)
    }
}

/** Progress ring with a label in the middle (112 dp, stroke 12). */
@Composable
fun DebtRing(fraction: Double, label: String, caption: String, size: Dp = 112.dp) {
    val c = BuddyBudgetTheme.colors
    Box(Modifier.size(size).semantics(mergeDescendants = true) { contentDescription = "$label $caption" }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val stroke = 12.dp.toPx()
            val inset = stroke / 2
            val arcSize = Size(this.size.width - inset * 2, this.size.height - inset * 2)
            drawArc(c.muted, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
            drawArc(c.primary, -90f, 360f * fraction.coerceIn(0.0, 1.0).toFloat(), false, Offset(inset, inset), arcSize,
                style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BBText(label, style = BBStyles.figure.copy(fontSize = (size.value * 0.2f).sp, lineHeight = (size.value * 0.24f).sp))
            BBText(caption, style = BBTextStyle.Caption.style.copy(fontSize = (size.value * 0.105f).sp, lineHeight = (size.value * 0.14f).sp),
                color = c.mutedForeground)
        }
    }
}

/** DEBT-020. */
@Composable
private fun DebtPendingBanner(text: String, busy: Boolean, onMarkAll: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                BBIconBadge(BBIcon.TriangleAlert, c.swatchAmber, 32.dp, 16.dp)
                BBText(text, BBTextStyle.Body)
            }
            BBButton(tr("Segna tutte come pagate"), onMarkAll, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm, isLoading = busy, enabled = !busy)
        }
    }
}

/** «E se…». */
@Composable
private fun DebtSimulationPanel(model: DebtsModel, debt: DebtView, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    var kind by remember { mutableStateOf(DebtSimulationKind.Extra) }
    PanelSection(tr("E se…"), BBIcon.Lightbulb, color = c.swatchViolet) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            SegmentedControl(DebtSimulationKind.entries.map { it to tr(it.label) }, kind, { kind = it },
                accessibilityLabel = tr("Ipotesi da simulare"), stretch = true)
            when (kind) {
                DebtSimulationKind.Extra -> DebtExtraSim(model, debt, text)
                DebtSimulationKind.Estinzione -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    BBText(tr("E se versassi una somma in più, una volta? Vedi quanto risparmi di interessi e se ti conviene ridurre la rata o la durata. Se l'hai già fatto, da qui puoi anche registrarla."),
                        BBTextStyle.Body)
                    BBButton(tr("Simula l'estinzione"), { model.earlyOpen = true }, icon = BBIcon.PiggyBank, enabled = !debt.finished)
                }
                DebtSimulationKind.Surroga -> DebtRefinanceSim(model, debt, text)
            }
        }
    }
}

/** DEBT-030. */
@Composable
private fun DebtExtraSim(model: DebtsModel, debt: DebtView, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    var extra by remember { mutableDoubleStateOf(DebtsRules.EXTRA_DEFAULT) }
    val sim = DebtsRules.extraSimulation(debt, extra, model.state.today)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        ExtraSlider(extra, { extra = it }, model.currency)
        val answer = sim?.let { text.extraResult(it, extra, model.currency, hidden) }
        if (answer != null) {
            io.buddybudget.app.designsystem.components.SimulationResult(answer.label, answer.value, caption = answer.caption)
        } else {
            BBText(tr("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi."), BBTextStyle.Body, color = c.mutedForeground)
        }
        BBText(tr("Stima semplificata: rata e tasso costanti, nessuna penale."), BBTextStyle.Caption, color = c.mutedForeground)
    }
}

/** DEBT-031. */
@Composable
private fun DebtRefinanceSim(model: DebtsModel, debt: DebtView, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    var rate by remember { mutableStateOf("") }
    var installments by remember { mutableStateOf("") }
    var costs by remember { mutableStateOf("") }
    var penalty by remember { mutableStateOf("") }
    val result = DebtsRules.refinance(debt, rate, installments, costs, penalty, model.state.today)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(tr("Un'altra banca offre un tasso migliore? Inserisci l'offerta e vedi se, spese incluse, conviene."), BBTextStyle.Body)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                DebtField(tr("Nuovo TAN (%)"), rate, { rate = it }, Modifier.weight(1f), placeholder = tr("es. 3,5"))
                DebtField(tr("Numero di rate"), installments, { installments = it }, Modifier.weight(1f),
                    placeholder = debt.totals.remainingInstallments.toString(), keyboard = BBKeyboard.Number)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                DebtField(tr("Spese della nuova offerta"), costs, { costs = it }, Modifier.weight(1f), placeholder = "0", hint = tr("Istruttoria, perizia, imposte"))
                DebtField(tr("Penale di estinzione"), penalty, { penalty = it }, Modifier.weight(1f), placeholder = "0", hint = tr("Quella sul finanziamento attuale"))
            }
        }
        if (result != null) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Side(tr("Resti dove sei"), listOf(
                    tr("Rata") to text.money(result.currentInstallment, model.currency, masked = hidden),
                    tr("Finisci") to BBFormat.formatMonthYear(result.currentEndDate, text.locale),
                    tr("Interessi che restano") to text.money(result.currentInterestRemaining, model.currency, masked = hidden),
                ))
                Side(tr("Cambi con la nuova offerta"), listOf(
                    tr("Rata") to text.money(result.newInstallment, model.currency, masked = hidden),
                    tr("Finisci") to BBFormat.formatMonthYear(result.newEndDate, text.locale),
                    tr("Interessi") to text.money(result.newInterest, model.currency, masked = hidden),
                    tr("Spese e penale") to text.money(result.switchCosts, model.currency, masked = hidden),
                ))
                val answer = text.refinanceResult(result, model.currency, hidden)
                io.buddybudget.app.designsystem.components.SimulationResult(answer.label, answer.value, Modifier.padding(top = BBSpacing.space1),
                    tone = if (answer.positive) io.buddybudget.app.designsystem.components.SimulationResultTone.Pos else io.buddybudget.app.designsystem.components.SimulationResultTone.Neg,
                    caption = answer.caption)
            }
        } else {
            BBText(tr("Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun Side(title: String, rows: List<Pair<String, String>>) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(title, BBTextStyle.BodyStrong)
        rows.forEach { (label, value) ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                BBText(label, BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground)
                BBText(value, style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
            }
        }
    }
}

/** Field of the Debiti forms (web `DebtFormField`): caption label above, input, hint below. */
@Composable
fun DebtField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboard: BBKeyboard = BBKeyboard.Amount,
    hint: String? = null,
) {
    val c = BuddyBudgetTheme.colors
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(label, BBTextStyle.Caption, color = c.mutedForeground)
        BBTextField(value, onChange, placeholder = placeholder, keyboard = keyboard)
        if (hint != null) BBText(hint, BBTextStyle.Caption, color = c.mutedForeground)
    }
}

/** DEBT-027. */
@Composable
private fun DebtEventsList(model: DebtsModel, debt: DebtView, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val events = DebtsRules.orderedEvents(debt).filter { it.id !in model.pendingEventRemovals }
    if (events.isEmpty()) {
        BBText(tr("Ancora nessun evento: segna una rata pagata o registra un cambio."), BBTextStyle.Body, color = c.mutedForeground)
        return
    }
    Column {
        events.forEachIndexed { index, event ->
            BBSwipeToDelete({ model.removeEvent(debt.id, event) }) {
                Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space1), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Column(Modifier.weight(1f)) {
                        BBText(text.event(event, model.currency, hidden), BBTextStyle.Body, maxLines = 1)
                        BBText(BBFormat.formatDateWithYear(event.date, text.locale), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    BBIconButton(BBIcon.Trash2, tr("Elimina evento"), color = c.mutedForeground) { model.removeEvent(debt.id, event) }
                }
            }
        }
    }
}

/** DEBT-021/022. */
@Composable
private fun DebtPlanList(model: DebtsModel, debt: DebtView, text: DebtsText) {
    var showAll by remember { mutableStateOf(false) }
    val rows = debt.plan.rows
    val range = DebtsRules.visibleRange(rows, model.state.today)
    val visible = if (showAll) rows else rows.slice(range)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Column {
            visible.forEachIndexed { index, row ->
                PlanRow(model, debt, row, text)
            }
        }
        if (rows.size > visible.size || showAll) {
            BBButton(text.planToggle(showAll, rows.size, rows.size - visible.size), { showAll = !showAll }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
        }
    }
}

@Composable
private fun PlanRow(model: DebtsModel, debt: DebtView, row: DebtPlanRow, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    val paid = row.status == DebtInstallmentStatus.PAGATA
    val tone = if (paid) c.mutedForeground else c.foreground
    Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            BBText("${tr("Rata")} ${row.number} · ${BBFormat.formatDateWithYear(row.dueDate, text.locale)}",
                style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"), color = tone, modifier = Modifier.weight(1f))
            BBText(text.money(row.payment?.amount ?: row.installment, model.currency, masked = hidden), style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500), color = tone)
        }
        BBText(text.rowBreakdown(row, model.currency, hidden), BBTextStyle.Caption, color = c.mutedForeground)
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalAlignment = Alignment.CenterVertically) {
            if (paid) StatusPill(row.status, text)
            else BBButton(tr("Segna pagata"), { model.paying = debt.id to row }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
            if (row.status != DebtInstallmentStatus.PAGATA && row.status != DebtInstallmentStatus.DA_PAGARE) StatusPill(row.status, text)
        }
    }
}

/** Installment status badge (`INSTALLMENT_STATUS_CLASS`). */
@Composable
fun StatusPill(status: DebtInstallmentStatus, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val (bg, fg, ring) = when (status) {
        DebtInstallmentStatus.PAGATA -> Triple(c.posSoft, c.pos, false)
        DebtInstallmentStatus.DA_PAGARE -> Triple(c.muted, c.mutedForeground, false)
        DebtInstallmentStatus.SCADUTA -> Triple(c.negSoft, c.neg, false)
        DebtInstallmentStatus.DA_CONFERMARE -> Triple(c.muted, c.foreground, true)
    }
    BBText(text.status(status), BBTextStyle.Caption,
        Modifier.background(bg, CircleShape).border(1.dp, if (ring) c.border else Color.Transparent, CircleShape)
            .padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space0_5), color = fg)
}
