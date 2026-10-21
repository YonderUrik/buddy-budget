package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBChip
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSlider
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.BBSwitchRow
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.features.categories.CategorySheetContent
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.TransactionPatch
import io.buddybudget.core.data.TransactionOrigin
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.liquidity.SplitShare
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.LocaleRules
import io.buddybudget.core.domain.transactions.AmountInputText
import io.buddybudget.core.domain.transactions.CategoryRules
import io.buddybudget.core.domain.transactions.MovementEdit
import io.buddybudget.core.domain.transactions.MovementKind
import io.buddybudget.core.domain.transactions.SplitForm
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset

/** The sheet open over Movimenti: one presenter whose content switches (actions → split/note/edit/category). */
sealed class MovementSheet {
    abstract val movement: Movement
    data class Actions(override val movement: Movement) : MovementSheet()
    data class Category(override val movement: Movement) : MovementSheet()
    data class Split(override val movement: Movement) : MovementSheet()
    data class Note(override val movement: Movement) : MovementSheet()
    data class Edit(override val movement: Movement) : MovementSheet()
}

/** The movement sheets and the delete confirmation (TX-027…041). */
@Composable
fun MovementSheets(
    model: LiquidityModel,
    sheet: MovementSheet?,
    onSheet: (MovementSheet?) -> Unit,
    deleting: Movement?,
    onDeleting: (Movement?) -> Unit,
) {
    // Keep the last content while the sheet animates out.
    var shown by remember { mutableStateOf(sheet) }
    if (sheet != null) shown = sheet
    val title = when (val s = sheet ?: shown) {
        is MovementSheet.Split -> l10n(R.string.split_0_680cbf, s.movement.description)
        is MovementSheet.Note -> l10n(R.string.note_1a6b7b)
        is MovementSheet.Edit -> l10n(R.string.edit_transaction_e51824)
        is MovementSheet.Category -> l10n(R.string.choose_category_bf34fc)
        else -> null
    }
    BBSheet(sheet != null, { onSheet(null) }, title) {
        val close = { onSheet(null) }
        when (val s = shown) {
            is MovementSheet.Actions -> MovementActionsSheet(model, s.movement, onSheet, onDeleting)
            is MovementSheet.Category -> MovementCategorySheet(model, s.movement, close)
            is MovementSheet.Split -> androidx.compose.runtime.key(s.movement.id) { MovementSplitPanel(s.movement, model.currency, { model.saveSplit(s.movement, it) }, close) }
            is MovementSheet.Note -> androidx.compose.runtime.key(s.movement.id) { NoteSheet(model, s.movement, close) }
            is MovementSheet.Edit -> androidx.compose.runtime.key(s.movement.id) { MovementEditPanel(s.movement, model.currency, model.today, { model.saveEdit(s.movement, it) }, close) }
            null -> Unit
        }
    }
    var lastDeleting by remember { mutableStateOf(deleting) }
    if (deleting != null) lastDeleting = deleting
    BBAlertSheet(
        deleting != null,
        l10n(R.string.delete_this_transaction_13a3c1),
        l10n(R.string.s_0_will_be_permanently_deleted_c71e7f, lastDeleting?.description ?: ""),
        l10n(R.string.delete_6b177b),
        onConfirm = { lastDeleting?.let { m -> model.launch { model.delete(m) } } },
        onDismiss = { onDeleting(null) },
        icon = BBIcon.Trash2,
    )
}

/**
 * Mobile «⋯» actions (mobile notes): header with description, raw bank text and amount; Categoria, Dividi (not
 * transfers), Nota, and for manual movements Modifica and Elimina (TX-027).
 */
@Composable
private fun MovementActionsSheet(model: LiquidityModel, movement: Movement, onSheet: (MovementSheet?) -> Unit, onDeleting: (Movement?) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    val category = model.category(movement.categoryId)
    val kind = MovementKind.of(movement, category)
    val meta = listOfNotNull(
        CalendarDate.parse(movement.date)?.let { BBFormat.formatLongDate(it, locale) },
        model.account(movement.accountId)?.name,
    ).joinToString(" · ")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            CategoryAvatar(category)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(movement.description, style = BBStyles.rowTitle, maxLines = 2)
                val raw = movement.rawDescription
                if (raw != null && raw != movement.description) BBText(raw, BBTextStyle.Caption, color = c.text3, maxLines = 3)
                BBText(meta, BBTextStyle.Caption, color = c.text2, maxLines = 1)
            }
            AmountText(
                if (kind == MovementKind.Transfer) movement.amount else movement.effectiveAmount, model.currency,
                tone = if (kind == MovementKind.Transfer) AmountTone.Neutral else AmountTone.Signed, signed = true, style = BBStyles.rowAmount,
            )
        }
        val note = movement.note
        if (!note.isNullOrEmpty()) BBText(note, BBTextStyle.Body, color = c.text2)
        Column {
            SheetActionRow(BBIcon.Tags, l10n(R.string.change_category_48467e)) { onSheet(MovementSheet.Category(movement)) }
            if (kind != MovementKind.Transfer) SheetActionRow(BBIcon.Split, l10n(R.string.split_d28d0e)) { onSheet(MovementSheet.Split(movement)) }
            SheetActionRow(BBIcon.NotebookPen, if (note.isNullOrEmpty()) l10n(R.string.add_note_2de704) else l10n(R.string.edit_note_0ce77c)) {
                onSheet(MovementSheet.Note(movement))
            }
            if (movement.isManual) {
                SheetActionRow(BBIcon.Pencil, l10n(R.string.edit_8fc593)) { onSheet(MovementSheet.Edit(movement)) }
                SheetActionRow(BBIcon.Trash2, l10n(R.string.delete_6b177b), destructive = true) {
                    onSheet(null)
                    scope.launch {
                        delay(BBMotion.durationSheetExit.toLong() + 50)
                        onDeleting(movement)
                    }
                }
            }
        }
    }
}

/** TX-028…031: category picker with «Ricordala per i prossimi «…»» (only for uncategorized or bank movements). */
@Composable
private fun MovementCategorySheet(model: LiquidityModel, movement: Movement, onClose: () -> Unit) {
    var remember by remember { mutableStateOf(true) }
    val current = model.category(movement.categoryId)
    val offersRemember = (current?.isFallback ?: true) || movement.source == TransactionOrigin.auto
    CategorySheetContent(
        CategoryRules.pickerCategories(model.categories, movement.amount), model.usage,
        onPick = { picked ->
            onClose()
            if (picked.id != movement.categoryId) model.launch { model.changeCategory(movement, picked, offersRemember && remember) }
        },
        selectedId = movement.categoryId, description = movement.description,
        searchPlaceholder = l10n(R.string.find_a_category_2cdfb3), mostUsedLabel = l10n(R.string.most_used_ed5f44), mostUsedLimit = 6,
    ) {
        if (offersRemember) BBSwitchRow(l10n(R.string.remember_it_for_future_0_6e7405, movement.description), remember) { remember = it }
    }
}

/**
 * «Dividi» (TX-034…036): shortcuts, amount field and slider bounded to [0, full], live own/excluded shares. Shared by the
 * Movimenti sheet and the movement detail (TX-066); [onSave] sends `excludedAmount` and says whether it succeeded.
 */
@Composable
fun MovementSplitPanel(movement: Movement, currency: String, onSave: suspend (Double) -> Boolean, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var form by remember { mutableStateOf(SplitForm.of(movement)) }
    var text by remember { mutableStateOf(AmountInputText.input(form.ownShare, locale)) }
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val isIncome = movement.amount > 0
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BBText(
                if (isIncome) l10n(R.string.how_much_of_this_income_is_yours_975baf) else l10n(R.string.how_much_of_this_expense_is_yours_55f23b),
                BBTextStyle.Body, Modifier.weight(1f), color = c.text2,
            )
            AmountText(form.total, currency, style = BBStyles.rowAmount)
        }
        val shortcuts = l10n(R.string.shortcuts_431434)
        Row(Modifier.semantics { contentDescription = shortcuts }, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            for (preset in SplitShare.presets) {
                BBChip(tr(preset.label), isSelected = form.matchingPreset?.key == preset.key) {
                    form = form.applyPreset(preset)
                    text = AmountInputText.input(form.ownShare, locale)
                }
            }
        }
        BBTextField(
            text, { new ->
                text = new
                BBFormat.parseAmount(new)?.let { form = form.withOwnShare(it) }
            },
            label = l10n(R.string.amount_da6661), keyboard = BBKeyboard.Amount, prefix = LocaleRules.currencySymbol(currency), height = 44.dp,
        )
        BBSlider(
            form.ownShare, { v ->
                form = form.withOwnShare(v)
                text = AmountInputText.input(form.ownShare, locale)
            },
            range = 0.0..maxOf(form.total, 0.01), step = 0.01, accessibilityLabel = l10n(R.string.amount_da6661),
        )
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BBText(
                    if (isIncome) l10n(R.string.count_as_your_income_5695ca) else l10n(R.string.count_as_your_expense_d51f08),
                    BBTextStyle.Body, Modifier.weight(1f), color = c.text2,
                )
                AmountText(form.ownShare, currency, style = BBStyles.rowAmount)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                BBText(l10n(R.string.excluded_from_totals_898ddc), BBTextStyle.Body, Modifier.weight(1f), color = c.text2)
                AmountText(form.excluded, currency, style = BBStyles.rowAmount)
            }
        }
        if (failed) BBText(l10n(R.string.save_failed_try_again_17edad), BBTextStyle.Body, color = c.destructive)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(
                if (saving) l10n(R.string.saving_f71782) else l10n(R.string.save_c5965d), {
                    form = form.withOwnShare(text)
                    saving = true
                    failed = false
                    scope.launch {
                        val ok = onSave(form.excluded)
                        saving = false
                        if (ok) onClose() else failed = true
                    }
                },
                size = BBButtonSize.Touch, fullWidth = true, isLoading = saving,
            )
            BBButton(l10n(R.string.cancel_6c3de5), onClose, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

/** TX-038: note up to 500 characters, saved on «Fatto» only if changed; empty removes it. */
@Composable
private fun NoteSheet(model: LiquidityModel, movement: Movement, onClose: () -> Unit) {
    var text by remember { mutableStateOf(movement.note ?: "") }
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBTextArea(text, { text = it }, placeholder = l10n(R.string.add_a_note_e_g_what_this_expense_was_for_38aca2), maxLength = 500)
        if (failed) BBText(l10n(R.string.could_not_save_note_try_again_484354), BBTextStyle.Body, color = BuddyBudgetTheme.colors.destructive)
        BBButton(l10n(R.string.done_33cad7), {
            saving = true
            failed = false
            model.launch {
                val ok = model.saveNote(movement, text)
                saving = false
                if (ok) onClose() else failed = true
            }
        }, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving)
    }
}

/** TX-039: description, date and amount of a manual movement; changed valid fields are saved on «Fatto». Shared with the detail (TX-066). */
@Composable
fun MovementEditPanel(movement: Movement, currency: String, today: CalendarDate, onSave: suspend (TransactionPatch) -> Boolean, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var description by remember { mutableStateOf(movement.description) }
    var date by remember { mutableStateOf(CalendarDate.parse(movement.date) ?: LiquidityModel.today()) }
    var amount by remember { mutableStateOf(AmountInputText.input(movement.amount, locale)) }
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBTextField(description, { description = it }, label = l10n(R.string.description_07dfa3), height = 44.dp)
        DateField(l10n(R.string.date_e5e429), date, { date = it }, today)
        BBTextField(
            amount, { amount = it },
            label = if (movement.amount > 0) l10n(R.string.income_amount_abc85a) else l10n(R.string.expense_amount_3e7ed4),
            keyboard = BBKeyboard.Amount, prefix = LocaleRules.currencySymbol(currency), height = 44.dp,
        )
        if (saving || failed) {
            BBText(
                if (saving) l10n(R.string.saving_762bad) else l10n(R.string.save_failed_try_again_17edad),
                BBTextStyle.Caption, color = if (failed) c.destructive else c.text3,
            )
        }
        BBButton(l10n(R.string.done_33cad7), {
            val patch = MovementEdit.patch(movement, description, date, amount)
            if (patch == null) {
                onClose()
            } else {
                saving = true
                failed = false
                scope.launch {
                    val ok = onSave(patch)
                    saving = false
                    if (ok) onClose() else failed = true
                }
            }
        }, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving)
    }
}

/** Date with the quick choices `Oggi` / `Ieri` and the native date picker (mobile notes). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, date: CalendarDate, onChange: (CalendarDate) -> Unit, today: CalendarDate, error: String? = null) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var picking by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(label, style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBChip(l10n(R.string.today_6ca109), isSelected = date == today) { onChange(today) }
            BBChip(l10n(R.string.yesterday_b057ff), isSelected = date == today.plusDays(-1)) { onChange(today.plusDays(-1)) }
            Spacer(Modifier.weight(1f))
            BBButton(BBFormat.formatDateWithYear(date.iso, locale), { picking = true },
                variant = BBButtonVariant.Outline, size = BBButtonSize.Default)
        }
        if (error != null) BBText(error, BBTextStyle.Body, color = c.destructive)
    }
    if (picking) {
        val todayMillis = today.epochDay * 86_400_000L
        val state = rememberDatePickerState(
            initialSelectedDateMillis = date.epochDay * 86_400_000L,
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis <= todayMillis
            },
        )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                BBButton(l10n(R.string.done_33cad7), {
                    state.selectedDateMillis?.let { onChange(CalendarDate.of(Instant.ofEpochMilli(it), ZoneOffset.UTC)) }
                    picking = false
                }, variant = BBButtonVariant.Ghost)
            },
            dismissButton = { BBButton(l10n(R.string.cancel_6c3de5), { picking = false }, variant = BBButtonVariant.Ghost) },
        ) { DatePicker(state) }
    }
}

