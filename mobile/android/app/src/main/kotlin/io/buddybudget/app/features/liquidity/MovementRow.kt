package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.AutoOrigin
import io.buddybudget.app.designsystem.components.AutoOriginBadge
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.MerchantLogoSize
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.transactions.MovementKind

/**
 * Movement row (TX-023…027): avatar (merchant logo or category) that changes the category, description,
 * «categoria · origine · conto · diviso», signed effective amount; split rows add the full amount struck through,
 * transfers show the full amount neutral with «Escluso dai conteggi»; uncategorized rows are highlighted.
 * Tapping the row opens its detail (TX-064, web #455); a long press or the accessibility action opens its actions.
 * iOS: MovementRow.swift.
 */
@Composable
fun MovementRow(
    model: LiquidityModel,
    movement: Movement,
    showAccount: Boolean,
    onTap: () -> Unit,
    onCategory: () -> Unit,
    onActions: () -> Unit = onTap,
) {
    val c = BuddyBudgetTheme.colors
    val category = model.category(movement.categoryId)
    val kind = MovementKind.of(movement, category)
    val actionsLabel = l10n(R.string.more_actions_for_0_055633, movement.description)
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 60.dp)
                .bbPressable(onTap, RoundedCornerShape(BBRadius.xl),
                    background = if (kind == MovementKind.Uncategorized) c.alphaDestructive10 else Color.Transparent,
                    pressedBackground = c.alphaMuted50, translate = false, onLongClick = onActions)
                .semantics { customActions = listOf(CustomAccessibilityAction(actionsLabel) { onActions(); true }) }
                .padding(horizontal = BBSpacing.space1_5, vertical = BBSpacing.space2_5),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
        ) {
            Avatar(model, movement, category, onCategory)
            Column(Modifier.weight(1f)) {
                BBText(movement.description, style = BBStyles.rowTitle, maxLines = 1)
                Subtitle(model, movement, category, kind, showAccount)
            }
            Trailing(model, movement, kind)
        }
        if (movement.id in model.savingIds) {
            BBText(l10n(R.string.saving_f71782), BBTextStyle.Caption, Modifier.padding(start = 56.dp, bottom = 4.dp), color = c.text3)
        } else if (movement.id in model.failedIds) {
            BBText(l10n(R.string.save_failed_try_again_17edad), BBTextStyle.Caption, Modifier.padding(start = 56.dp, bottom = 4.dp), color = c.destructive)
        }
    }
}

@Composable
private fun Avatar(model: LiquidityModel, movement: Movement, category: MovementCategory?, onCategory: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val label = l10n(R.string.category_0_tap_to_change_it_0a70a2, category?.name ?: l10n(R.string.uncategorized_69f672))
    Box(
        Modifier.size(36.dp).bbPressable(onCategory, CircleShape, translate = false).clearAndSetSemantics { contentDescription = label },
        contentAlignment = Alignment.BottomEnd,
    ) {
        val logoPath = movement.logoPath
        if (logoPath != null) {
            // Web: the category avatar until (unless) the merchant logo arrives, then the category as a corner badge.
            var logoShown by remember(logoPath) { mutableStateOf(false) }
            MerchantLogo(movement.description, logoPath = logoPath, size = MerchantLogoSize.Sm, onRemoteLogo = {
                model.remoteLogoShown = true
                logoShown = true
            }, fallbackView = { CategoryAvatar(category) })
            if (logoShown) {
                Box(Modifier.offset(3.dp, 3.dp).border(1.5.dp, c.background, CircleShape).background(c.background, CircleShape)) {
                    CategoryAvatar(category, 16.dp)
                }
            }
        } else {
            CategoryAvatar(category)
        }
    }
}

@Composable
private fun Subtitle(model: LiquidityModel, movement: Movement, category: MovementCategory?, kind: MovementKind, showAccount: Boolean) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(
            category?.name ?: l10n(R.string.uncategorized_69f672), BBTextStyle.Body,
            color = if (kind == MovementKind.Uncategorized) c.neg else c.text2, maxLines = 1,
        )
        val origin = AutoOrigin.of(movement.categorySource)
        if (origin != null && kind != MovementKind.Uncategorized) AutoOriginBadge(origin, compact = true)
        val account = if (showAccount) model.account(movement.accountId) else null
        if (account != null) BBText("· ${account.name}", BBTextStyle.Body, color = c.text2, maxLines = 1)
        if (kind == MovementKind.Split) BBText(l10n(R.string.split_79d3ff), BBTextStyle.Body, color = c.text2, maxLines = 1)
    }
}

@Composable
private fun Trailing(model: LiquidityModel, movement: Movement, kind: MovementKind) {
    val c = BuddyBudgetTheme.colors
    Column(horizontalAlignment = Alignment.End) {
        when (kind) {
            MovementKind.Transfer -> {
                AmountText(movement.amount, model.currency, tone = AmountTone.Neutral, signed = true, style = BBStyles.rowAmount)
                BBText(l10n(R.string.excluded_from_totals_7570b0), BBTextStyle.Caption, color = c.text3, maxLines = 1)
            }
            MovementKind.Split -> {
                AmountText(movement.effectiveAmount, model.currency, tone = AmountTone.Signed, signed = true, style = BBStyles.rowAmount)
                val full = l10n(R.string.full_amount_a04796)
                BBText(
                    BBFormat.formatSignedCurrency(movement.amount, model.currency, LocalBBLocale.current, LocalHideAmounts.current),
                    Modifier.semantics { contentDescription = full },
                    BBTextStyle.Caption.style.copy(textDecoration = TextDecoration.LineThrough),
                    color = c.text3,
                )
            }
            else -> AmountText(movement.effectiveAmount, model.currency, tone = AmountTone.Signed, signed = true, style = BBStyles.rowAmount)
        }
    }
}
