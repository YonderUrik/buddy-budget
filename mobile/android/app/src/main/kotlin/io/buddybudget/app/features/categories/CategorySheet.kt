package io.buddybudget.app.features.categories

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.domain.transactions.CategoryPicker

/** Category avatar from a category's stored icon and color (CAT-008). */
@Composable
fun CategoryAvatar(category: MovementCategory?, diameter: Dp = 36.dp) =
    BBIconBadge(BBIcon.category(category?.icon), bbSwatch(category?.color ?: "slate"), diameter, if (diameter >= 36.dp) 16.dp else 14.dp)

/** Color of a spending group (`GROUP_DISPLAY`). */
@Composable
fun bbGroup(key: String): Color {
    val c = BuddyBudgetTheme.colors
    return when (key) {
        "dovuta" -> c.categoryGroupDovuta
        "voluta" -> c.categoryGroupVoluta
        "futuro" -> c.categoryGroupFuturo
        "saltuaria" -> c.categoryGroupSaltuaria
        else -> c.categoryGroupUncategorized
    }
}

/**
 * «Scegli la categoria» content (CAT-090…092, TX-028), shown inside a `BBSheet`: search (empty on every open, not
 * auto-focused), a most-used row, then a 4-column icon grid per group in alphabetical order. One tap picks.
 * iOS: CategorySheetContent in CategorySheet.swift.
 */
@Composable
fun CategorySheetContent(
    categories: List<MovementCategory>,
    usage: Map<String, Int>,
    onPick: (MovementCategory) -> Unit,
    selectedId: String? = null,
    description: String? = null,
    searchPlaceholder: String = l10n(R.string.search_categories_236af4),
    mostUsedLabel: String = l10n(R.string.for_you_4d36bb),
    mostUsedLimit: Int = CategoryPicker.MOST_USED_LIMIT,
    footer: @Composable () -> Unit = {},
) {
    val c = BuddyBudgetTheme.colors
    var query by remember { mutableStateOf("") }
    val sections = CategoryPicker.sections(categories, usage, query, mostUsedLimit)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground, maxLines = 2)
        BBTextField(
            query, { query = it }, placeholder = searchPlaceholder, height = 44.dp, imeAction = ImeAction.Search,
            onSubmit = { sections.firstOrNull()?.categories?.firstOrNull()?.let(onPick) },
        )
        if (sections.isEmpty()) {
            BBText(l10n(R.string.no_categories_found_86c922), BBTextStyle.Body, Modifier.padding(vertical = BBSpacing.space4), color = c.mutedForeground)
        }
        for (section in sections) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                section.label?.let { label ->
                    BBText(if (section.key == "most-used") mostUsedLabel else tr(label), BBTextStyle.Overline, color = c.text3)
                }
                for (row in section.categories.chunked(4)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        for (category in row) CategoryTile(category, category.id == selectedId, Modifier.weight(1f)) { onPick(category) }
                        repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        footer()
    }
}

@Composable
private fun CategoryTile(category: MovementCategory, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(
        modifier.heightIn(min = 84.dp)
            .bbPressable(onClick, shape, background = if (selected) c.alphaPrimary10 else Color.Transparent, pressedBackground = c.muted, translate = false)
            .border(1.5.dp, if (selected) c.primary else Color.Transparent, shape)
            .semantics { this.selected = selected }
            .padding(vertical = BBSpacing.space2, horizontal = BBSpacing.space1),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        CategoryAvatar(category, 40.dp)
        BBText(category.name, style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), maxLines = 2)
    }
}

/** A switch row used as sheet footer («Ricordala…», «Usa sempre questa categoria…»). */
@Composable
fun BBSwitchRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
            .bbPressable({ onCheckedChange(!checked) }, RoundedCornerShape(BBRadius.md), translate = false),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBText(label, BBTextStyle.Body, Modifier.weight(1f), maxLines = 2)
        BBSwitch(checked, onCheckedChange, accessibilityLabel = label)
    }
}
