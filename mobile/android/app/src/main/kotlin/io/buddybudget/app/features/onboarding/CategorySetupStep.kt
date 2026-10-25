package io.buddybudget.app.features.onboarding

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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBAvatar
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.domain.onboarding.CategoryProposalItem
import io.buddybudget.core.domain.onboarding.CategorySetup
import io.buddybudget.core.domain.onboarding.CategorySetupGroup

/** «Categorie» step (AUTH-030…034): enabled categories as chips per group, «Personalizza» opens the sheet. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategorySetupStep(model: OnboardingModel) {
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    val active = CategorySetup.activeCount(model.categories)
    StepHeading(
        l10n(R.string.categories_for_your_transactions_d40e27),
        if (model.customized) l10n(R.string.you_will_use_0_grouped_by_spending_type_64237f, active.toString())
        else l10n(R.string.we_prepared_0_grouped_by_spending_type_s_1ee5c0, active.toString()),
    )
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        CategorySetup.groups.forEach { group ->
            val items = model.categories.filter { it.enabled && it.type == group.type }
            if (items.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    GroupHeader(group, items.size)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        items.forEach { CategoryChip(it) }
                    }
                }
            }
        }
    }
    model.message(model.problem)?.let { BBErrorBox(it + " " + l10n(R.string.correct_it_in_customise_or_continue_with_8eb292)) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBButton(l10n(R.string.customise_0beadf), { open = true }, icon = BBIcon.SlidersHorizontal, variant = BBButtonVariant.Outline,
            size = BBButtonSize.Touch, fullWidth = true, enabled = !model.saving)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBIconView(BBIcon.Info, size = 14.dp, color = c.text3)
            BBText(l10n(R.string.find_and_change_them_anytime_in_cash_cat_e2f8eb), BBTextStyle.Caption, color = c.text3)
        }
    }
    BBSheet(open, { open = false }, l10n(R.string.customize_categories_acf465)) {
        CategorySetupSheetContent(model) { open = false }
    }
}

@Composable
private fun GroupHeader(group: CategorySetupGroup, count: Int? = null) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Box(Modifier.size(8.dp).background(categoryGroupColor(group.type, c), CircleShape))
        val style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500)
        BBText(tr(group.label), style = style, color = c.mutedForeground)
        if (count != null) BBText("·$count", style = style, color = c.text3)
    }
}

@Composable
private fun CategoryChip(item: CategoryProposalItem) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.background(c.card, CircleShape).border(1.dp, c.border, CircleShape)
            .padding(start = BBSpacing.space1, end = BBSpacing.space3, top = BBSpacing.space1, bottom = BBSpacing.space1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        BBIconBadge(BBIcon.category(item.icon), bbSwatch(item.color), 24.dp, 13.dp)
        BBText(item.name.trim(), BBTextStyle.Body, maxLines = 1)
    }
}

/** «Personalizza le categorie» (AUTH-031): per group, switch, tap the name to rename, «Aggiungi in <gruppo>». */
@Composable
private fun CategorySetupSheetContent(model: OnboardingModel, onDone: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    BBText(l10n(R.string.turn_off_those_you_don_t_use_and_tap_a_n_8992a8), BBTextStyle.Body, color = c.mutedForeground)
    CategorySetup.groups.forEach { group ->
        Column {
            Box(Modifier.padding(bottom = BBSpacing.space1)) { GroupHeader(group) }
            model.categories.forEachIndexed { index, item ->
                if (item.type == group.type) {
                    SetupRow(model, index)
                    BBSeparator()
                }
            }
            AddRow(model, group)
        }
    }
    model.message(model.problem)?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        BBButton(l10n(R.string.restore_2f4de6), model::resetCategories, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, enabled = model.customized)
        Spacer(Modifier.weight(1f))
        BBButton("${l10n(R.string.done_e1999f)} ${CategorySetup.activeCount(model.categories)} ${l10n(R.string.active_1e6385)}", onDone, size = BBButtonSize.Touch)
    }
}

@Composable
private fun SetupRow(model: OnboardingModel, index: Int) {
    val c = BuddyBudgetTheme.colors
    val item = model.categories[index]
    var editing by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    fun commit() {
        val trimmed = draft.trim()
        if (trimmed.isEmpty() || trimmed == model.categories[index].name) {
            editing = false
            return
        }
        val reason = model.rename(index, trimmed)
        if (reason != null) error = reason else editing = false
    }
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.alpha(if (item.enabled) 1f else 0.45f)) { BBAvatar(BBIcon.category(item.icon), bbSwatch(item.color)) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            if (editing) {
                BBTextField(draft, { draft = it }, error = error, onSubmit = ::commit, autofocus = true)
            } else {
                val renameLabel = "${l10n(R.string.rename_5ced82)} ${item.name}"
                Column(
                    Modifier.fillMaxWidth().alpha(if (item.enabled) 1f else 0.55f)
                        .bbPressable({ draft = item.name; error = null; editing = true }, RoundedCornerShape(0.dp), translate = false)
                        .semantics { contentDescription = renameLabel },
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(item.name, BBTextStyle.BodyStrong, maxLines = 1)
                        if (item.optional) {
                            BBText(
                                l10n(R.string.optional_d4c7b8),
                                Modifier.background(c.alphaPrimary10, CircleShape).padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space0_5),
                                BBTextStyle.Micro.style.copy(fontWeight = FontWeight.W400), color = c.primary,
                            )
                        }
                    }
                    item.description?.let { BBText(it, BBTextStyle.Caption, color = c.text3, maxLines = 1) }
                }
            }
        }
        BBSwitch(item.enabled, { model.toggle(index, it) }, accessibilityLabel = l10n(R.string.use_0_d4389a, item.name))
    }
}

@Composable
private fun AddRow(model: OnboardingModel, group: CategorySetupGroup) {
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    fun commit() {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) {
            open = false
            return
        }
        val reason = model.add(group.type, trimmed)
        if (reason != null) error = reason else {
            name = ""
            error = null
            open = false
        }
    }
    if (open) {
        Box(Modifier.padding(vertical = BBSpacing.space2)) {
            BBTextField(name, { name = it }, placeholder = l10n(R.string.name_then_enter_bf33f4), error = error, onSubmit = ::commit, autofocus = true)
        }
    } else {
        Row(
            Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                .bbPressable({ open = true }, RoundedCornerShape(0.dp), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBIconView(BBIcon.Plus, color = c.primary)
            BBText("${l10n(R.string.add_to_164a9f)} ${tr(group.label)}", BBTextStyle.Body, color = c.primary)
        }
    }
}
