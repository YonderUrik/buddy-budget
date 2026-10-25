package io.buddybudget.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.AnalyticsView
import io.buddybudget.core.domain.analytics.AnalyticsAssumptionsDraft
import io.buddybudget.core.domain.analytics.AnalyticsContent
import io.buddybudget.core.domain.analytics.AnalyticsGoalDraft
import io.buddybudget.core.domain.analytics.AnalyticsMessage
import io.buddybudget.core.domain.analytics.AnalyticsRules
import io.buddybudget.core.domain.analytics.AnalyticsValidation
import io.buddybudget.core.data.AnalyticsAssumptionsPatch
import io.buddybudget.core.domain.fire.FireFigureSource
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.WithdrawalRule

// Dialogs of «Risposte»: walkthrough (ANA-005/006), «Tutte le ipotesi» (ANA-033/034, full screen), «Il tuo traguardo»
// (ANA-007/008) and the glossary sheet (ANA-032). iOS: AnalyticsDialogs.swift.

@Composable
fun AnalyticsDialogs(model: AnalyticsModel) {
    BBSheet(model.walkthroughOpen, { model.closeWalkthrough() }) { WalkthroughView(model) }
    val term = model.termId?.let(AnalyticsContent::term)
    BBSheet(model.termId != null, { model.termId = null }, title = term?.let { tr(it.title) }) {
        if (term != null) BBText(tr(term.text), BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
    }
    val view = model.state.view
    val plan = model.state.savedPlan
    BBSheet(model.targetDialogOpen, { model.targetDialogOpen = false }, title = tr("Il tuo traguardo")) {
        if (view != null && plan != null && model.targetDialogOpen) TargetForm(model, view, plan)
    }
    FormDialog(model.assumptionsOpen, { model.assumptionsOpen = false }) {
        if (view != null && plan != null && model.assumptionsOpen) AssumptionsForm(model, view, plan)
    }
}

/** ANA-005: six steps, «Salta» / «Indietro», «Avanti» / «Inizia», dots. */
@Composable
private fun WalkthroughView(model: AnalyticsModel) {
    val c = BuddyBudgetTheme.colors
    val steps = AnalyticsContent.walkthrough
    val index = model.walkthroughStep.coerceIn(0, steps.size - 1)
    val step = steps[index]
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Passo") + " ${index + 1} " + tr("di") + " ${steps.size}", BBTextStyle.Body, color = c.mutedForeground)
            BBText(tr(step.title), Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) { step.body.forEach { BBText(tr(it), BBTextStyle.Body, color = c.mutedForeground) } }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                steps.indices.forEach { i -> Box(Modifier.size(6.dp).background(if (i == index) c.primary else c.mutedForeground.copy(alpha = 0.3f), CircleShape)) }
            }
            Spacer(Modifier.weight(1f))
            if (index > 0) BBButton(tr("Indietro"), { model.walkthroughStep = index - 1 }, variant = BBButtonVariant.Outline)
            else BBButton(tr("Salta"), { model.closeWalkthrough() }, variant = BBButtonVariant.Ghost)
            if (index == steps.size - 1) BBButton(tr("Inizia"), { model.closeWalkthrough() })
            else BBButton(tr("Avanti"), { model.walkthroughStep = index + 1 })
        }
    }
}

/** ANA-008: one figure, live preview, saved as data-linked when equal to the data. */
@Composable
private fun TargetForm(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan) {
    val c = BuddyBudgetTheme.colors
    val text = analyticsText()
    var draft by remember { mutableStateOf(AnalyticsGoalDraft.of(plan)) }
    var localError by remember { mutableStateOf<String?>(null) }
    val missing = tr("Scrivi quanto ti serve in un anno, per esempio 24.000.")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        BBText(tr("Il traguardo è il patrimonio che ti permette di vivere dei tuoi soldi: ogni anno ne prelevi una piccola parte e ti basta per le spese. Ti serve una sola cifra."),
            BBTextStyle.Body, color = c.mutedForeground)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBTextField(draft.text, { draft = draft.copy(text = it) }, label = tr("Quanto ti serve in un anno"), placeholder = tr("Per esempio 24.000"), height = 44.dp)
            BBText(draft.dataSpending?.let { tr("Dai tuoi movimenti spendi circa {0} l'anno: puoi tenerla o scrivere la cifra con cui vorresti vivere.", mapOf("0" to text.money(it, view.currency))) }
                ?: tr("Tutte le spese di un anno: casa, spesa, svago. Se non la sai, parti da 12 volte quello che spendi in un mese."), BBTextStyle.Caption, color = c.mutedForeground)
        }
        val preview = draft.preview(view.base, view.assumptions)
        val target = preview?.target
        if (preview != null && target != null) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr("Il tuo traguardo"), BBTextStyle.Body, color = c.mutedForeground)
                BBText(text.money(target, view.currency), style = BBTextStyle.StatValue.style)
                BBText(tr("Prelevandone il") + " " + text.pct(view.assumptions.withdrawalRate) + " " + tr("ogni anno ricavi quello che ti serve.") + " " +
                    text.goalPreviewWhen(preview, model.todayYear), BBTextStyle.Body, color = c.text2)
                BBText(tr("Rendimento, prelievo e il resto si cambiano dopo, da «Tutte le ipotesi»."), BBTextStyle.Caption, color = c.mutedForeground)
            }
        } else {
            BBText(tr("Scrivi la cifra: qui compare il patrimonio che ti serve."), BBTextStyle.Body, color = c.mutedForeground)
        }
        (localError ?: model.state.saveError)?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(if (model.state.saving) tr("Salvo…") else tr("Salva il traguardo"), {
                val patch = draft.patch
                if (patch == null) {
                    localError = missing
                } else {
                    localError = null
                    model.launch { if (model.save(patch)) model.targetDialogOpen = false }
                }
            }, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.state.saving)
            BBButton(l10n(L10n.cancel), { model.targetDialogOpen = false }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

/** ANA-033 / ANA-034: «Tutte le ipotesi» as a full-screen form. */
@Composable
private fun AssumptionsForm(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan) {
    val c = BuddyBudgetTheme.colors
    val text = analyticsText()
    var d by remember { mutableStateOf(AnalyticsAssumptionsDraft.of(view.assumptions)) }
    var localError by remember { mutableStateOf<String?>(null) }
    val info = view.returnInfo
    val offer = AnalyticsRules.historyOffer(info)
    val phrase = text.periodPhrase(view.assumptions.dataPeriod, view.base.cashflow.fromKey, view.base.cashflow.toKey)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Column(Modifier.padding(end = BBSpacing.space10), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Tutte le ipotesi"), Modifier.semantics { heading() }, BBStyles.sectionHeading)
            BBText(tr("Quelle che cambi raramente. Si applicano a tutta la pagina e restano salvate."), BBTextStyle.Body, color = c.mutedForeground)
        }
        BBText(tr("Tutti i calcoli partono da queste ipotesi: sono tue assunzioni, non previsioni. Cambiale e guarda come si muovono i risultati."),
            BBTextStyle.Body, color = c.mutedForeground)
        AnalyticsAssumptionsDraft.PercentField.entries.forEach { field ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBTextField(d.percents[field] ?: "", { d = d.set(field, it) }, label = tr(field.label) + " (%)", keyboard = BBKeyboard.Amount)
                if (field == AnalyticsAssumptionsDraft.PercentField.EXPECTED_RETURN && offer != null && !d.returnAuto) {
                    BBText(tr("Usa il tuo rendimento (") + text.pct(offer) + ")",
                        Modifier.bbPressable({ d = d.useHistory(offer) }, RoundedCornerShape(4.dp), translate = false), BBStyles.link, color = c.primary)
                }
                BBText(
                    if (field == AnalyticsAssumptionsDraft.PercentField.EXPECTED_RETURN) {
                        (if (d.returnAuto) tr("Torna a seguire il tuo storico al salvataggio.") else text.returnSourceText(info, view.currency, view.assumptions.dataPeriod)) +
                            " " + tr(field.hint)
                    } else tr(field.hint),
                    BBTextStyle.Caption, color = c.mutedForeground,
                )
            }
        }
        Field(tr("Anni di pensione da coprire"), d.years, BBKeyboard.Number, hint = tr("Quanto deve durare il patrimonio. Per smettere a 45 anni e arrivare a 90, circa 45; più è lungo, più il tasso di prelievo sicuro scende.")) { d = d.copy(years = it) }
        Field(tr("Spesa annua in pensione ({0})", mapOf("0" to view.currency)), d.spending, BBKeyboard.Number, tr("Dai tuoi dati"),
            if (plan.spendingSource == FireFigureSource.DATI && plan.spending != null)
                tr("Vuoto = uso le tue uscite {0}, riportate a un anno: {1}. Scrivi una cifra se in pensione spenderai diversamente.", mapOf("0" to phrase, "1" to text.money(plan.spending ?: 0.0, view.currency)))
            else tr("Vuoto = uso le tue uscite {0}, riportate a un anno (servono almeno 3 mesi di movimenti).", mapOf("0" to phrase))) { d = d.copy(spending = it) }
        Field(tr("Risparmio annuo ({0})", mapOf("0" to view.currency)), d.savings, BBKeyboard.Number, tr("Dai tuoi dati"),
            if (plan.savingsSource == FireFigureSource.DATI && plan.savings != null)
                tr("Vuoto = uso quanto hai messo da parte {0}, riportato a un anno: {1}.", mapOf("0" to phrase, "1" to text.money(plan.savings ?: 0.0, view.currency)))
            else tr("Vuoto = uso entrate meno uscite {0}, riportate a un anno. Scrivi 0 se non versi più nulla.", mapOf("0" to phrase))) { d = d.copy(savings = it) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBSelect(WithdrawalRule.entries.map { it to text.ruleLabel(it) }, d.rule, { d = d.copy(rule = it) }, label = tr("Regola di prelievo"))
            BBText(tr("Come decidi quanto prelevare ogni anno in pensione. La scheda Prelievi le confronta."), BBTextStyle.Caption, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Pensione pubblica attesa (facoltativa)"), style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
            BBTextField(d.pensionAnnual, { d = d.copy(pensionAnnual = it) }, placeholder = tr("Importo annuo ({0})", mapOf("0" to view.currency)), keyboard = BBKeyboard.Number)
            BBTextField(d.pensionAfter, { d = d.copy(pensionAfter = it) }, placeholder = tr("Dopo quanti anni di pensione FIRE"), keyboard = BBKeyboard.Number)
            BBText(tr("Se andrai in pensione presto, la pensione pubblica arriverà più tardi e ridurrà quanto devi prelevare da allora. Scrivi l'importo in euro di oggi e fra quanti anni dall'inizio la riceverai; lascia vuoto per ignorarla (scelta prudente)."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
        if (model.taxes) Toggle(tr("Conta le imposte sulle plusvalenze"),
            tr("Il patrimonio che spendi è quello dopo le tasse: il numero FIRE sale di conseguenza. Stimate:") + " " + text.money(plan.liquidation.latentTax, view.currency) +
                " " + tr("se vendessi tutto oggi."), d.includeTax) { d = d.copy(includeTax = it) }
        Toggle(tr("Includi la previdenza complementare"),
            (if (view.base.wealth.pension > 0) tr("Valore attuale {0}. ", mapOf("0" to text.money(view.base.wealth.pension, view.currency))) else "") +
                tr("Di solito non è prelevabile prima dell'età pensionabile, quindi è escluso di default."), d.includePension) { d = d.copy(includePension = it) }
        (localError ?: model.state.saveError)?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(if (model.state.saving) tr("Salvo…") else tr("Salva ipotesi"), {
                when (val r = d.submit(text)) {
                    is AnalyticsValidation.Error<*> -> localError = (r.error as AnalyticsMessage).text
                    is AnalyticsValidation.Ok<AnalyticsAssumptionsPatch> -> {
                        localError = null
                        model.launch { if (model.save(r.value)) model.assumptionsOpen = false }
                    }
                }
            }, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.state.saving)
            BBButton(tr("Ripristina i valori consigliati"), { d = d.resetToDefaults(info) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch,
                fullWidth = true, enabled = !model.state.saving)
        }
    }
}

@Composable
private fun Field(label: String, value: String, keyboard: BBKeyboard, placeholder: String = "", hint: String, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBTextField(value, onChange, label = label, placeholder = placeholder, keyboard = keyboard)
        BBText(hint, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

@Composable
private fun Toggle(title: String, hint: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(title, BBTextStyle.BodyStrong)
            BBText(hint, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        }
        BBSwitch(checked, onChange, accessibilityLabel = title)
    }
}
