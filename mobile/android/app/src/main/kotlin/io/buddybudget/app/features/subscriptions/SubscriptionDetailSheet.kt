package io.buddybudget.app.features.subscriptions

import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.components.bbPressable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.FormDialogSection
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.SubscriptionCategory
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionStatus
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.subscriptions.SubscriptionAllowedActions
import io.buddybudget.core.domain.subscriptions.SubscriptionCadence
import io.buddybudget.core.domain.subscriptions.SubscriptionForm
import io.buddybudget.core.domain.subscriptions.SubscriptionText
import io.buddybudget.core.domain.subscriptions.SubscriptionsView

/** Field height of the subscription forms on phone (web `h-11`). */
val SubscriptionFieldHeight = 44.dp

private val DetailAmountStyle = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W500, fontSize = 30.sp, lineHeight = 36.sp, fontFeatureSettings = "tnum")
private val HistoryAmountStyle = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W400, fontSize = 14.sp, lineHeight = 20.sp, fontFeatureSettings = "tnum")

/**
 * Detail of a subscription (SUB-016…022), body of the full-screen form dialog. The decision actions are pinned in the
 * footer ([SubscriptionDetailActions]). Twin of `SubscriptionDetailBody` on iOS.
 */
@Composable
fun ColumnScope.SubscriptionDetailBody(model: SubscriptionsModel, item: SubscriptionItem, text: SubscriptionText) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val currency = model.state.currency
    var name by rememberSaveable(item.key) { mutableStateOf(item.name) }
    var amountText by rememberSaveable(item.key) { mutableStateOf(SubscriptionForm.amountText(item.amount, locale)) }
    var cadence by remember(item.key) { mutableStateOf(item.cadence ?: SubscriptionCadence.MENSILE) }
    var nextDate by rememberSaveable(item.key) { mutableStateOf(item.nextDate ?: model.state.today) }
    var categoryId by rememberSaveable(item.key) { mutableStateOf(item.categoryId) }

    FormDialogHeader(BBIcon.Repeat, item.name, tr(if (item.isManual) "Aggiunto da te" else "Trovato nei tuoi movimenti"))

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        val amount = item.amount
        if (amount != null) AmountText(amount, currency, style = DetailAmountStyle) else BBText("—", style = DetailAmountStyle)
        BBText(text.hint(item, model.state.today), BBTextStyle.Body, color = c.text2)
        val monthly = item.monthly
        if (monthly != null && item.cadence != SubscriptionCadence.MENSILE) {
            BBText(text.monthlyWeight(monthly, currency, hide), BBTextStyle.Body, color = c.text2)
        }
    }

    val reasons = item.reasons.mapNotNull { text.reason(it, currency, hide) }
    val history = SubscriptionsView.history(item)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        if (reasons.isNotEmpty()) {
            FormDialogSection(
                tr("Perché lo vediamo qui"), BBIcon.Info,
                tr("Il riconoscimento è un calcolo sui tuoi movimenti, senza AI: la decisione resta tua."),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    reasons.forEach { sentence ->
                        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                            BBIconView(BBIcon.Check, Modifier.padding(top = 2.dp), color = c.pos)
                            BBText(sentence, BBTextStyle.Body)
                        }
                    }
                }
            }
        }
        if (history.isNotEmpty()) {
            if (reasons.isNotEmpty()) BBSeparator()
            FormDialogSection(tr("Ultimi addebiti"), BBIcon.History) {
                val shell = io.buddybudget.app.features.shell.LocalShell.current
                Column {
                    history.forEachIndexed { index, charge ->
                        if (index > 0) BBSeparator(Modifier.alpha(0.6f))
                        // SUB-016 / TX-064: each charge opens its movement's detail.
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 44.dp)
                                .bbPressable({ shell.openMovement(charge.id) }, RoundedCornerShape(BBRadius.xl), translate = false),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            BBText(BBFormat.formatDateWithYear(charge.date, locale), BBTextStyle.Body, color = c.text2)
                            Spacer(Modifier.weight(1f).width(BBSpacing.space3))
                            AmountText(charge.amount, currency, style = HistoryAmountStyle)
                            BBIconView(BBIcon.ChevronRight, Modifier.padding(start = BBSpacing.space2), size = 16.dp, color = c.text3)
                        }
                    }
                }
            }
        }
        if (item.id != null) {
            if (reasons.isNotEmpty() || history.isNotEmpty()) BBSeparator()
            FormDialogSection(tr("Modifica"), BBIcon.Repeat) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                    BBTextField(name, { name = SubscriptionForm.clampName(it) }, label = tr("Nome"), height = SubscriptionFieldHeight)
                    if (item.isManual) {
                        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            BBTextField(amountText, { amountText = it }, Modifier.weight(1f), label = tr("Importo"),
                                keyboard = BBKeyboard.Amount, height = SubscriptionFieldHeight)
                            CadencePicker(cadence, { cadence = it }, text, Modifier.weight(1f))
                        }
                        BBDateField(nextDate, { nextDate = it }, label = tr("Prossimo addebito"), height = SubscriptionFieldHeight)
                    }
                    SubscriptionCategoryPicker(model.categories, categoryId) { categoryId = it }
                    BBButton(
                        tr("Salva le modifiche"),
                        { model.saveEdits(item, name, amountText, cadence, nextDate, categoryId) },
                        variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !model.detailBusy,
                    )
                }
            }
        }
    }

    model.detailError?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
}

/** Pinned footer of the detail (SUB-017, SUB-020, SUB-021): only the allowed actions, primary on top, full width. */
@Composable
fun SubscriptionDetailActions(model: SubscriptionsModel, item: SubscriptionItem) {
    val allowed = SubscriptionsView.allowedActions(item)
    val enabled = !model.detailBusy
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        allowed.confirm?.let { confirm ->
            BBButton(
                tr(if (confirm == SubscriptionAllowedActions.ConfirmLabel.PutBack) "Rimettilo tra i miei" else "Sì, è un abbonamento"),
                { model.decide(item, SubscriptionStatus.Confermato) },
                icon = BBIcon.Check, size = BBButtonSize.Touch, fullWidth = true, enabled = enabled,
            )
        }
        if (allowed.terminate) {
            BBButton(tr("È terminato"), { model.decide(item, SubscriptionStatus.Terminato) },
                variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true, enabled = enabled)
        }
        if (allowed.exclude) {
            BBButton(tr("Non è un abbonamento"), { model.decide(item, SubscriptionStatus.Escluso) }, icon = BBIcon.X,
                variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true, enabled = enabled)
        }
        allowed.removal?.let { removal ->
            val delete = removal == SubscriptionAllowedActions.Removal.Delete
            BBButton(tr(if (delete) "Elimina" else "Ripristina com'era"), { model.remove(item) },
                icon = if (delete) BBIcon.Trash2 else BBIcon.Undo, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch,
                fullWidth = true, enabled = enabled)
        }
    }
}

/** `Ogni quanto` select with the capitalized cadence labels; monthly by default. */
@Composable
fun CadencePicker(cadence: SubscriptionCadence, onChange: (SubscriptionCadence) -> Unit, text: SubscriptionText, modifier: Modifier = Modifier) {
    BBSelect(
        SubscriptionCadence.entries.map { it to text.cadenceOption(it) }, cadence, onChange, modifier,
        label = tr("Ogni quanto"), height = SubscriptionFieldHeight,
    )
}

/** `Categoria` select over expense categories (SUB-025), clearable with `Nessuna categoria`. */
@Composable
fun SubscriptionCategoryPicker(categories: List<SubscriptionCategory>, categoryId: String?, onChange: (String?) -> Unit) {
    val options: List<Pair<String?, String>> = listOf<Pair<String?, String>>(null to tr("Nessuna categoria")) + categories.map { it.id to it.name }
    BBSelect(options, categoryId, onChange, label = tr("Categoria"), height = SubscriptionFieldHeight)
}

/** `Aggiungi un abbonamento` (SUB-023…025), body of a full-screen form dialog. Twin of `AddSubscriptionBody` on iOS. */
@Composable
fun ColumnScope.AddSubscriptionBody(model: SubscriptionsModel, text: SubscriptionText) {
    val locale = LocalBBLocale.current
    var name by rememberSaveable { mutableStateOf("") }
    var amountText by rememberSaveable { mutableStateOf("") }
    var cadence by remember { mutableStateOf(SubscriptionCadence.MENSILE) }
    var nextDate by rememberSaveable { mutableStateOf(model.state.today) }
    var categoryId by rememberSaveable { mutableStateOf<String?>(null) }

    FormDialogHeader(
        BBIcon.Repeat, tr("Aggiungi un abbonamento"),
        tr("Se compare tra i movimenti lo collegheremo da soli e ne seguiremo gli addebiti."),
    )
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBTextField(name, { name = SubscriptionForm.clampName(it) }, label = tr("Nome"),
            placeholder = tr("Es. Palestra, Assicurazione casa"), height = SubscriptionFieldHeight)
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBTextField(amountText, { amountText = it }, Modifier.weight(1f), label = tr("Importo di ogni addebito"),
                placeholder = BBFormat.formatNumber(0.0, locale, 2, 2), keyboard = BBKeyboard.Amount, height = SubscriptionFieldHeight)
            CadencePicker(cadence, { cadence = it }, text, Modifier.weight(1f))
        }
        BBDateField(nextDate, { nextDate = it }, label = tr("Prossimo addebito"), height = SubscriptionFieldHeight)
        SubscriptionCategoryPicker(model.categories, categoryId) { categoryId = it }
        model.addError?.let { BBErrorBox(it, reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Abbonamento) }
        BBButton(
            if (model.addBusy) tr("Salvo…") else tr("Aggiungi"),
            { model.add(name, amountText, cadence, nextDate, categoryId) },
            size = BBButtonSize.Touch, fullWidth = true, enabled = !model.addBusy,
        )
    }
}
