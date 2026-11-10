package io.buddybudget.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.accounts.StepProgressBar
import io.buddybudget.app.features.accounts.StepTitle
import io.buddybudget.app.tr
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.goals.GoalConstants
import io.buddybudget.core.domain.goals.GoalDraft
import io.buddybudget.core.domain.goals.GoalDraftSource
import io.buddybudget.core.domain.goals.GoalFormStep
import io.buddybudget.core.domain.goals.GoalKind
import io.buddybudget.core.domain.goals.GoalSourceKind
import io.buddybudget.core.domain.goals.GoalWizard
import io.buddybudget.core.domain.goals.GoalsRules
import io.buddybudget.core.domain.goals.GoalsText
import io.buddybudget.core.domain.goals.colorToken
import io.buddybudget.core.domain.goals.hint
import io.buddybudget.core.domain.goals.iconKey
import io.buddybudget.core.domain.goals.label
import io.buddybudget.core.domain.periods.Periods
import io.buddybudget.core.domain.shell.LocaleRules
import io.buddybudget.core.domain.transactions.AmountInputText

// «Nuovo obiettivo» / «Modifica obiettivo» (GOAL-014…026): five steps in a full-screen form, `Indietro` and the primary
// button, enabled only when the step is valid (`GoalWizard.canAdvance`). iOS: GoalForm.swift.

@Composable
fun GoalFormPresenter(model: AnalyticsModel) {
    val request = model.goalForm
    val view = model.goals.view
    FormDialog(request != null, { model.goalForm = null }) {
        if (request != null && view != null) key(request) { GoalFormView(model, view, request) }
    }
}

@Composable
private fun GoalFormView(model: AnalyticsModel, view: GoalsView, request: GoalFormRequest) {
    val goal = request.goalId?.let(view::goal)
    val steps = GoalFormStep.entries
    val initialIndex = if (goal != null) steps.indexOf(request.startStep).coerceAtLeast(0) else model.debugStartStep?.let(steps::indexOf)?.coerceAtLeast(0) ?: 0
    var index by remember { mutableIntStateOf(initialIndex) }
    var draft by remember { mutableStateOf(debugDraft(model, view, request, GoalsRules.initialDraft(view, goal, request.presetKind))) }
    var remind by remember { mutableStateOf(true) }
    val text = goalsText(view.currency)
    val step = steps[index]
    val ok = GoalWizard.canAdvance(step, draft, view.todayKey)
    val last = index == steps.size - 1
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.Target, text.tr(if (goal == null) "Nuovo obiettivo" else "Modifica obiettivo"),
            goal?.name ?: text.tr("Una cosa per cui mettere da parte: il risparmio del mese la raggiunge nell'ordine che scegli."), BuddyBudgetTheme.colors.swatchAmber)
        StepProgressBar(index, steps.size, text.tr("Passi del nuovo obiettivo"))
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            when (step) {
                GoalFormStep.TIPO -> KindStep(draft, view.essentialMonthly) { draft = it }
                GoalFormStep.QUANTO -> AmountStep(draft, view, goal, text) { draft = it }
                GoalFormStep.FONTI -> SourcesStep(draft, view, goal, text) { draft = it }
                GoalFormStep.RITMO -> PaceStep(draft, view, goal, text) { draft = it }
                GoalFormStep.RIEPILOGO -> SummaryStep(draft, view, goal, text, model.offerReminders && goal == null, remind) { remind = it }
            }
        }
        model.goalFormError?.let { BBErrorBox(it, reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Obiettivo) }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (index > 0) BBButton(text.tr("Indietro"), { index -= 1 }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !model.goalSaving)
            BBButton(
                if (last) (if (model.goalSaving) text.tr("Salvataggio…") else text.tr(if (goal == null) "Crea obiettivo" else "Salva")) else text.tr("Avanti"),
                {
                    if (ok) {
                        if (last) model.launch { model.submitGoal(draft, remind) } else index += 1
                    }
                },
                Modifier.weight(1f), size = BBButtonSize.Touch, fullWidth = true, isLoading = model.goalSaving, enabled = ok,
            )
        }
    }
}

/** DEBUG: a filled draft for screenshots of later steps. */
private fun debugDraft(model: AnalyticsModel, view: GoalsView, request: GoalFormRequest, draft: GoalDraft): GoalDraft {
    val step = model.debugStartStep
    if (request.goalId != null || step == null || step == GoalFormStep.TIPO) return draft
    val first = view.sources.firstOrNull { it.kind == "account" }
    return GoalWizard.withKind(draft, GoalKind.VIAGGIO, view.essentialMonthly).copy(
        name = "Viaggio in Giappone", target = 4500.0, targetMonth = Periods.addMonthsKey(view.todayKey, 10), monthly = 200.0,
        sources = if (first != null) listOf(GoalDraftSource("account:${first.id}", 1000.0)) else emptyList(),
    )
}

/** Pill choice (`GoalChoice`): rounded-full, h 44 on phone, primary tint when selected. */
@Composable
private fun GoalChoice(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Box(
        Modifier.heightIn(min = 44.dp).background(if (selected) c.alphaPrimary10 else Color.Transparent, CircleShape)
            .border(1.dp, if (selected) c.primary else c.border, CircleShape).bbPressable(onClick, CircleShape, translate = false)
            .padding(horizontal = BBSpacing.space4),
        contentAlignment = Alignment.Center,
    ) { BBText(label, BBTextStyle.BodyStrong, color = if (selected) c.primary else c.foreground, maxLines = 1) }
}

/** Currency field holding its own text (decimal keypad, locale separator); reports null when empty. */
@Composable
private fun GoalAmountField(value: Double?, currency: String, modifier: Modifier = Modifier, label: String? = null, onChange: (Double?) -> Unit) {
    val locale = LocalBBLocale.current
    var text by remember { mutableStateOf(value?.let { AmountInputText.input(it, locale) } ?: "") }
    BBTextField(text, { new ->
        text = new
        onChange(if (new.isEmpty()) null else new.replace(",", ".").toDoubleOrNull())
    }, modifier, label = label, keyboard = BBKeyboard.Amount, prefix = LocaleRules.currencySymbol(currency), height = 44.dp)
}

// ---------------------------------------------------------------- Steps

@Composable
private fun KindStep(draft: GoalDraft, essential: Double?, set: (GoalDraft) -> Unit) {
    val c = BuddyBudgetTheme.colors
    StepTitle(tr("Che cosa vuoi raggiungere?"))
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        GoalKind.entries.forEach { kind ->
            val selected = draft.kind == kind
            val shape = RoundedCornerShape(BBRadius.xl)
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp).background(if (selected) c.primary.copy(alpha = 0.05f) else Color.Transparent, shape)
                    .border(1.dp, if (selected) c.primary else c.border, shape).bbPressable({ set(GoalWizard.withKind(draft, kind, essential)) }, shape, translate = false)
                    .padding(BBSpacing.space3),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                GoalIcon(kind.iconKey, kind.colorToken, 32.dp)
                Column {
                    BBText(tr(kind.label), BBTextStyle.BodyStrong)
                    BBText(tr(kind.hint), BBTextStyle.Caption, color = c.text3)
                }
            }
        }
    }
    if (draft.kind != null) {
        BBTextField(draft.name, { set(draft.copy(name = it.take(80))) }, label = tr("Nome"), placeholder = tr("es. Viaggio in Giappone"), height = 44.dp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AmountStep(draft: GoalDraft, view: GoalsView, goal: GoalView?, text: GoalsText, set: (GoalDraft) -> Unit) {
    val c = BuddyBudgetTheme.colors
    var monthPicker by remember { mutableStateOf(false) }
    val emergency = draft.kind == GoalKind.EMERGENZA
    StepTitle(text.tr(if (emergency) "Quanti mesi di spese vuoi coprire?" else "Quanto ti serve, ed entro quando?"),
        text.tr("La data è facoltativa: senza, ti diciamo solo quando ci arrivi al ritmo di oggi."))
    val essential = view.essentialMonthly
    // GOAL-017 (web #382): months × monthly spending, the spending computed from the movements and editable.
    if (emergency) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                GoalConstants.EMERGENCY_MONTH_CHOICES.forEach { months ->
                    GoalChoice(text.tr("{0} mesi", mapOf("0" to months.toString())), draft.emergencyMonths == months) {
                        set(GoalWizard.withEmergencyMonths(draft, months, essential))
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                GoalAmountField(GoalWizard.emergencySpend(draft, essential), view.currency, label = text.tr("Spese al mese")) { value ->
                    set(GoalWizard.withMonthlySpend(draft, value))
                }
                BBText(text.tr(GoalWizard.spendNote(draft, view.essentialBasis)), BBTextStyle.Caption, color = c.text3)
            }
        }
    }
    key(draft.emergencyMonths, draft.monthlySpend) {
        GoalAmountField(draft.target, view.currency, label = text.tr("Quanto ti serve")) { set(draft.copy(target = it, emergencyMonths = null)) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(text.tr("Entro quando"), BBTextStyle.Body, color = c.text2)
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            GoalChoice(text.tr("Nessuna data"), draft.targetMonth == null) { set(draft.copy(targetMonth = null)) }
            GoalChoice(draft.targetMonth?.let(text::month) ?: text.tr("Mese entro cui arrivarci"), draft.targetMonth != null) { monthPicker = true }
        }
    }
    text.requiredNote(draft, view.todayKey, GoalsRules.formCapacity(view, goal))?.let { GoalNote(it) }
    BBSheet(monthPicker, { monthPicker = false }, title = text.tr("Mese entro cui arrivarci")) {
        MonthPicker(Periods.addMonthsKey(view.todayKey, 1), draft.targetMonth) {
            set(draft.copy(targetMonth = it))
            monthPicker = false
        }
    }
}

/** Native month + year choice with a minimum (GOAL-016, mobile adaptation of `type="month"`). */
@Composable
private fun MonthPicker(minKey: String, value: String?, onPick: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val minYear = minKey.take(4).toIntOrNull() ?: 2026
    val minMonth = minKey.drop(5).take(2).toIntOrNull() ?: 1
    var year by remember { mutableIntStateOf(value?.take(4)?.toIntOrNull() ?: minYear) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.bbDisabled(year <= minYear)) { BBIconButton(BBIcon.ChevronLeft, tr("Anno precedente")) { year = maxOf(minYear, year - 1) } }
            Spacer(Modifier.weight(1f))
            BBText(year.toString(), BBTextStyle.CardTitle)
            Spacer(Modifier.weight(1f))
            BBIconButton(BBIcon.ChevronRight, tr("Anno successivo")) { year += 1 }
        }
        (1..12).chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                row.forEach { m ->
                    val key = "%04d-%02d".format(year, m)
                    val disabled = year < minYear || (year == minYear && m < minMonth)
                    val selected = value == key
                    val shape = RoundedCornerShape(BBRadius.md)
                    Box(
                        Modifier.weight(1f).heightIn(min = 44.dp).bbDisabled(disabled).background(if (selected) c.primary else c.muted.copy(alpha = 0.5f), shape)
                            .bbPressable(if (disabled) null else ({ onPick(key) }), shape, translate = false),
                        contentAlignment = Alignment.Center,
                    ) { BBText(BBFormat.capitalize(BBFormat.monthName(m, locale)), BBTextStyle.BodyStrong, color = if (selected) c.primaryForeground else c.foreground, maxLines = 1) }
                }
            }
        }
    }
}

@Composable
private fun SourcesStep(draft: GoalDraft, view: GoalsView, goal: GoalView?, text: GoalsText, set: (GoalDraft) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val sources = GoalsRules.formSources(view, goal)
    StepTitle(text.tr("Da dove arrivano i soldi?"), text.tr("Scegli cosa è già per questo obiettivo. Puoi anche partire da zero."))
    if (sources.isEmpty()) BBText(text.tr("Non hai ancora conti né investimenti: l'obiettivo parte da zero e cresce con la quota del mese."), BBTextStyle.Body, color = c.text2)
    listOf(Triple(GoalSourceKind.ACCOUNT, "Liquidità", BBIcon.Landmark to c.swatchTeal), Triple(GoalSourceKind.INSTRUMENT, "Investimenti", BBIcon.TrendingUp to c.swatchBlue))
        .forEach { (kind, title, ic) ->
            val items = sources.filter { it.kind == kind }
            if (items.isNotEmpty()) Column {
                BBText(text.tr(title), BBTextStyle.Overline, Modifier.padding(bottom = BBSpacing.space1_5), color = c.text3)
                items.forEachIndexed { i, source ->
                    val key = GoalWizard.sourceKey(source.kind, source.id)
                    val amount = draft.sources.firstOrNull { it.key == key }?.amount
                    Row(Modifier.padding(vertical = BBSpacing.space2_5), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        Row(Modifier.weight(1f).heightIn(min = 44.dp).bbPressable({ set(GoalsRules.toggleSource(draft, source)) }, RoundedCornerShape(BBRadius.md), translate = false),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            val icon = view.sources.firstOrNull { it.id == source.id && it.kind == source.kind.key }
                            GoalSourceIcon(source.kind.key, source.id, source.name, icon?.accountColor, icon?.accountIcon, icon?.instrumentType, 32.dp, fallback = true)
                            Column {
                                BBText(source.name, BBTextStyle.BodyStrong, color = if (amount != null) c.primary else c.foreground, maxLines = 1)
                                BBText(text.tr("{0} · {1} liberi", mapOf("0" to text.money(source.total), "1" to text.money(source.free))), BBTextStyle.Caption, color = c.text3)
                            }
                        }
                        if (amount != null) {
                            val label = text.tr("Parte di {0} per questo obiettivo", mapOf("0" to source.name))
                            GoalAmountField(amount, view.currency, Modifier.width(120.dp).semantics { contentDescription = label }) { v ->
                                set(draft.setSource(key, maxOf(0.0, v ?: 0.0)))
                            }
                        } else {
                            BBText(text.tr("Scegli"), BBTextStyle.Body, color = c.text3)
                        }
                    }
                }
            }
        }
    GoalNote(text.tr("Assegnati {0} di {1}. Dove li tieni non cambia il saldo dei conti: è solo un'etichetta. Per i titoli contiamo il valore al netto dell'imposta stimata se li vendessi oggi.",
        mapOf("0" to text.money(GoalWizard.assignedTotal(draft)), "1" to text.money(draft.target ?: 0.0))))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PaceStep(draft: GoalDraft, view: GoalsView, goal: GoalView?, text: GoalsText, set: (GoalDraft) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val required = GoalWizard.requiredMonthly(draft, view.todayKey)
    val capacity = GoalsRules.formCapacity(view, goal)
    val free = GoalsRules.freeCapacity(capacity)
    val others = GoalsRules.positionChoices(view, goal)
    StepTitle(text.tr("Quanto ogni mese?"), text.tr("È la quota del tuo risparmio che va a questo obiettivo. La puoi cambiare quando vuoi."))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (required != null) GoalChoice(text.tr("Quanto serve: {0}", mapOf("0" to text.money(required))), draft.monthly == required) { set(draft.copy(monthly = required)) }
        if (free != null && free > 0 && free != required) GoalChoice(text.tr("Quanto avanza: {0}", mapOf("0" to text.money(free))), draft.monthly == free) { set(draft.copy(monthly = free)) }
    }
    key(draft.monthly, required) {
        GoalAmountField(draft.monthly, view.currency, label = text.tr("Quota al mese")) { set(draft.copy(monthly = it?.let { v -> maxOf(0.0, v) })) }
    }
    if (others.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(text.tr("Chi riceve per primo il risparmio del mese?"), BBTextStyle.Body, color = c.text2)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                GoalChoice(text.tr("Prima di tutti"), draft.priority == 0) { set(draft.copy(priority = 0)) }
                others.forEachIndexed { i, g ->
                    GoalChoice(if (i == others.size - 1) text.tr("In fondo, dopo {0}", mapOf("0" to g.name)) else text.tr("Dopo {0}", mapOf("0" to g.name)),
                        draft.priority == i + 1) { set(draft.copy(priority = i + 1)) }
                }
            }
        }
    }
    if (GoalWizard.isCovered(draft)) GoalNote(text.tr("Con i soldi che hai già assegnato l'obiettivo è coperto: la quota può restare a zero."))
    val monthly = draft.monthly
    if (free != null && monthly != null && monthly > free + 0.5) {
        GoalNote(text.tr("Oggi ne avanzano {0} al mese: chi sta più in basso nella lista riceverà meno.", mapOf("0" to text.money(free))))
    }
}

@Composable
private fun SummaryStep(draft: GoalDraft, view: GoalsView, goal: GoalView?, text: GoalsText, offer: Boolean, remind: Boolean, onRemind: (Boolean) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val kind = draft.kind ?: GoalKind.ALTRO
    val names = GoalsRules.sourceNames(GoalsRules.formSources(view, goal))
    StepTitle(text.tr("Tutto giusto?"))
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        GoalIcon(kind.iconKey, kind.colorToken)
        BBText(draft.name, style = BBStyles.sectionHeading)
    }
    Column {
        val rows = text.summaryRows(draft)
        rows.forEachIndexed { i, (label, value) ->
            Row(Modifier.padding(vertical = BBSpacing.space2_5), verticalAlignment = Alignment.CenterVertically) {
                BBText(label, BBTextStyle.Body, color = c.text2)
                Spacer(Modifier.weight(1f))
                BBText(value, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            }
        }
    }
    text.summarySources(draft, names)?.let { BBText(it, BBTextStyle.Body, color = c.text2) }
    if (offer) {
        Column {
            Row(Modifier.padding(top = BBSpacing.space3).bbPressable({ onRemind(!remind) }, RoundedCornerShape(BBRadius.md), translate = false),
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBCheckbox(remind, onRemind, Modifier.padding(top = 2.dp), accessibilityLabel = text.tr("Ricordamelo per email"))
                Column {
                    BBText(text.tr("Ricordamelo per email"), BBTextStyle.BodyStrong)
                    BBText(text.tr("A inizio mese a che punto sei, e un avviso quando lo raggiungi o la data si avvicina. Si spegne da Impostazioni o dal link in ogni email."),
                        BBTextStyle.Body, color = c.text3)
                }
            }
        }
    }
}
