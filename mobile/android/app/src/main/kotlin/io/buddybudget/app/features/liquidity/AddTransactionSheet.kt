package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.features.categories.CategorySheetContent
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.Account
import io.buddybudget.core.data.isManual
import io.buddybudget.core.domain.shell.LocaleRules
import io.buddybudget.core.domain.transactions.AddTransactionField
import io.buddybudget.core.domain.transactions.AddTransactionForm

/**
 * «Nuovo movimento» (TX-042…048): step 1 direction + amount, step 2 description, category and the collapsible
 * date/account summary; «Aggiungi e inserisci un altro» keeps date, account and direction. iOS: AddTransactionSheet.swift.
 */
@Composable
fun AddTransactionSheet(model: LiquidityModel, onClose: () -> Unit, onAddAccount: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    var form by remember { mutableStateOf(AddTransactionForm(LiquidityModel.today())) }
    var pickingCategory by remember { mutableStateOf(false) }
    var showDetails by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf<String?>(null) }

    fun submit(keepOpen: Boolean) {
        formError = null
        val (next, body) = form.body(model.categories, model.usage, model.accounts.orEmpty())
        form = next
        if (body == null) return
        submitting = true
        model.launch {
            val error = model.create(body)
            submitting = false
            if (error != null) {
                formError = error
            } else if (keepOpen) {
                form = form.didAddAndContinue()
            } else {
                onClose()
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        BBText(l10n(R.string.an_expense_or_income_on_a_manual_account_32e77b), BBTextStyle.Body, color = c.mutedForeground)
        StepBars(form.step, 2, l10n(R.string.new_transaction_steps_77b627))
        when {
            pickingCategory -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBButton(l10n(R.string.back_83c968), { pickingCategory = false }, icon = BBIcon.ChevronLeft, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                CategorySheetContent(
                    form.availableCategories(model.categories), model.usage,
                    onPick = { picked ->
                        form = form.copy(categoryOverride = picked.id)
                        pickingCategory = false
                    },
                    selectedId = form.categoryId(model.categories, model.usage),
                    searchPlaceholder = l10n(R.string.find_a_category_2cdfb3), mostUsedLabel = l10n(R.string.most_used_ed5f44), mostUsedLimit = 6,
                )
            }
            form.step == 0 -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                BBText(l10n(R.string.how_much_was_it_87632b), BBTextStyle.SectionTitle)
                SegmentedControl(
                    listOf(false to l10n(R.string.expense_0ff262), true to l10n(R.string.income_91651a)),
                    form.isIncome, { form = form.withDirection(it) },
                    accessibilityLabel = l10n(R.string.transaction_type_2b7af3), stretch = true,
                )
                BBTextField(
                    form.amountText, { form = form.copy(amountText = it) }, label = l10n(R.string.amount_da6661),
                    error = form.errors[AddTransactionField.Amount]?.let { tr(it) }, keyboard = BBKeyboard.Amount,
                    prefix = LocaleRules.currencySymbol(model.currency), height = 44.dp, autofocus = true,
                )
                if (form.added > 0) {
                    val first = if (form.added == 1) l10n(R.string.transaction_added_e132d5) else l10n(R.string.s_0_transactions_added_56b6e8, form.added.toString())
                    BBText("$first ${l10n(R.string.you_can_add_another_37cbaf)}", BBTextStyle.Body, color = c.pos)
                }
                BBButton(l10n(R.string.continue_08ccec), {
                    form = form.next(model.categories, model.usage, model.accounts.orEmpty())
                }, size = BBButtonSize.Touch, fullWidth = true)
            }
            else -> StepTwo(model, form, { form = it }, showDetails, { showDetails = true }, { pickingCategory = true }, submitting, formError, onAddAccount, ::submit)
        }
    }
}

@Composable
private fun StepTwo(
    model: LiquidityModel,
    form: AddTransactionForm,
    onForm: (AddTransactionForm) -> Unit,
    showDetails: Boolean,
    onShowDetails: () -> Unit,
    onPickCategory: () -> Unit,
    submitting: Boolean,
    formError: String?,
    onAddAccount: () -> Unit,
    submit: (Boolean) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val categoryId = form.categoryId(model.categories, model.usage)
    val category = model.category(categoryId)
    val available = form.availableCategories(model.categories)
    val manual = model.manualAccounts
    val noAccount = manual.isEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(if (form.isIncome) l10n(R.string.where_is_it_from_837d8b) else l10n(R.string.what_is_it_for_6992db), BBTextStyle.SectionTitle)
        BBTextField(
            form.description, { onForm(form.copy(description = it)) }, label = l10n(R.string.description_07dfa3),
            placeholder = if (form.isIncome) l10n(R.string.e_g_october_salary_2ac448) else l10n(R.string.e_g_supermarket_shopping_c9dd86),
            error = form.errors[AddTransactionField.Description]?.let { tr(it) }, height = 44.dp, autofocus = true,
        )
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(l10n(R.string.category_5966b0), style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
            if (available.isEmpty()) {
                BBText(
                    if (form.isIncome) l10n(R.string.no_income_category_available_add_one_und_ae0d92) else l10n(R.string.no_categories_available_add_one_before_r_5435f7),
                    BBTextStyle.Body, color = c.destructive,
                )
            } else {
                val shape = RoundedCornerShape(BBRadius.lg)
                Row(
                    Modifier.fillMaxWidth().height(44.dp)
                        .border(1.dp, if (form.errors[AddTransactionField.Category] != null) c.destructive else c.input, shape)
                        .bbPressable(onPickCategory, shape, translate = false)
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    CategoryAvatar(category, 28.dp)
                    BBText(category?.name ?: l10n(R.string.choose_a_category_d79b33), BBTextStyle.BodyLarge, Modifier.weight(1f), maxLines = 1)
                    BBIconView(BBIcon.ChevronDown, color = c.mutedForeground)
                }
            }
            form.errors[AddTransactionField.Category]?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
        }
        when {
            noAccount -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.transactions_are_recorded_in_manual_acco_aed2e3), BBTextStyle.Body, color = c.text2)
                BBButton(l10n(R.string.add_an_account_053139), onAddAccount, icon = BBIcon.Plus, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
            }
            showDetails || form.errors[AddTransactionField.Account] != null -> {
                DateField(l10n(R.string.date_e5e429), form.date, { onForm(form.copy(date = it)) }, model.today)
                BBSelect(
                    manual.map { it.id to it.name }, form.accountId(manual) ?: "", { onForm(form.copy(accountOverride = it)) },
                    label = l10n(R.string.account_9f27c0), title = l10n(R.string.account_9f27c0), height = 44.dp,
                )
            }
            else -> Row(verticalAlignment = Alignment.CenterVertically) {
                BBText(summary(model, form, manual), BBTextStyle.Body, Modifier.weight(1f), color = c.text2, maxLines = 1)
                BBButton(l10n(R.string.change_68f742), onShowDetails, variant = BBButtonVariant.Link, size = BBButtonSize.Sm)
            }
        }
        if (formError != null) io.buddybudget.app.features.help.ErrorWithReport(io.buddybudget.core.domain.support.ReportErrorArea.Movimento, formError)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBButton(l10n(R.string.back_83c968), { onForm(form.back()) }, Modifier.weight(1f), variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
                BBButton(
                    if (submitting) l10n(R.string.adding_5b1f1e) else l10n(R.string.add_83f510), { submit(false) }, Modifier.weight(1f),
                    size = BBButtonSize.Touch, fullWidth = true, isLoading = submitting, enabled = !noAccount,
                )
            }
            BBButton(
                l10n(R.string.add_and_enter_another_2f392e), { submit(true) }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch,
                fullWidth = true, enabled = !noAccount && !submitting,
            )
        }
    }
}

@Composable
private fun summary(model: LiquidityModel, form: AddTransactionForm, manual: List<Account>): String {
    val day = when (form.date) {
        model.today -> l10n(R.string.today_6ca109)
        model.today.plusDays(-1) -> l10n(R.string.yesterday_b057ff)
        else -> form.date.iso
    }
    val account = manual.firstOrNull { it.id == form.accountId(manual) }?.name ?: ""
    return "$day · $account"
}

/** Step progress of a two-step form: one capsule per step, filled up to the current one. */
@Composable
fun StepBars(index: Int, count: Int, label: String) {
    val c = BuddyBudgetTheme.colors
    val step = io.buddybudget.app.tr("Passo {0} di {1}", mapOf("0" to (index + 1).toString(), "1" to count.toString()))
    // Web `StepProgress`: «Passo N di M» over one capsule per step.
    Column(
        Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = step
        },
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        BBText(step, style = io.buddybudget.app.designsystem.generated.BBTextStyle.Caption.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), color = c.mutedForeground)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            repeat(count) { i -> Box(Modifier.weight(1f).height(4.dp).background(if (i <= index) c.primary else c.border, CircleShape)) }
        }
    }
}
