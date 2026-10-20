package io.buddybudget.app.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.designsystem.AmountDisplay
import io.buddybudget.core.designsystem.AmountTone
import kotlin.math.roundToInt

// Text & numbers (spec: design/components.md §1.2, §3.1–3.2, §3.6, §3.10). iOS: BBTextComponents.swift.

/**
 * An amount formatted through `BBFormat` (via `AmountDisplay`): tone coloring, tabular digits, privacy mask
 * (`hideAmounts` → `••••`) and the hero layout (`splitMoney`: decimals and trailing symbol at 0.55 em, muted).
 */
@Composable
fun AmountText(
    value: Double,
    currency: String,
    modifier: Modifier = Modifier,
    tone: AmountTone = AmountTone.Neutral,
    signed: Boolean = false,
    maximumFractionDigits: Int = 2,
    style: TextStyle = BBStyles.rowAmount,
    hero: Boolean = false,
) {
    val c = BuddyBudgetTheme.colors
    val d = AmountDisplay.make(value, currency, LocalBBLocale.current, tone, signed, maximumFractionDigits, hero, LocalHideAmounts.current)
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = d.role.color(c))) { append(d.main) }
        if (d.tail.isNotEmpty()) {
            withStyle(SpanStyle(color = c.mutedForeground, fontSize = (style.fontSize.value * 0.55f).roundToInt().sp)) { append(d.tail) }
        }
    }
    Text(
        text,
        modifier.clearAndSetSemantics { contentDescription = d.text },
        style = style.copy(fontFeatureSettings = "tnum"),
        maxLines = 1,
        overflow = TextOverflow.Clip,
    )
}

/** Hero amount (net worth, portfolio, liquidity): 48 sp on phone with a muted tail; `••••` when hidden. */
@Composable
fun MoneyHero(value: Double, currency: String, modifier: Modifier = Modifier, tone: AmountTone = AmountTone.Neutral) =
    AmountText(value, currency, modifier, tone, style = BBStyles.hero, hero = true)

/** `Soft`: primary @10% with primary text (the «Usa l'AI» tag). */
enum class BBBadgeVariant { Default, Secondary, Destructive, Outline, Ghost, Soft }

/** Height 20, capsule, padding 8, text-xs medium, icon 12 (components.md §1.2). */
@Composable
fun BBBadge(text: String, modifier: Modifier = Modifier, variant: BBBadgeVariant = BBBadgeVariant.Default, icon: BBIcon? = null) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val (bg, fg) = when (variant) {
        BBBadgeVariant.Default -> c.primary to c.primaryForeground
        BBBadgeVariant.Secondary -> c.secondary to c.secondaryForeground
        BBBadgeVariant.Destructive -> (if (dark) c.alphaDestructive20 else c.alphaDestructive10) to c.destructive
        BBBadgeVariant.Outline -> Color.Transparent to c.foreground
        BBBadgeVariant.Ghost -> Color.Transparent to c.foreground
        BBBadgeVariant.Soft -> c.alphaPrimary10 to c.primary
    }
    Row(
        modifier.height(BBLayout.badgeHeight)
            .background(bg, CircleShape)
            .then(if (variant == BBBadgeVariant.Outline) Modifier.border(1.dp, c.border, CircleShape) else Modifier)
            .padding(horizontal = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
    ) {
        if (icon != null) BBIconView(icon, size = BBIconSize.Xs.dp, color = fg)
        BBText(text, BBTextStyle.Badge, color = fg, maxLines = 1)
    }
}

/** "Manuale": category set by hand. Shown in the transaction detail only (hidden in phone rows, §1.2). */
@Composable
fun ManualBadge() = BBBadge(l10n(R.string.manual_58ab84), variant = BBBadgeVariant.Outline)

/** Where an automatic category came from (§3.6): rule, the user's past choices, or the assistant. */
enum class AutoOrigin(val icon: BBIcon, val label: Int) {
    Regola(BBIcon.BookmarkCheck, R.string.rule_3619fc),
    Storico(BBIcon.History, R.string.your_choices_36dcf4),
    Assistente(BBIcon.Sparkles, R.string.ai_560040),
    /** The bank's category from an imported file (CAT-047, web #456). */
    Banca(BBIcon.Landmark, R.string.bank_4daf5d);

    companion object {
        /** The badge of an automatic category origin; null for the user's choice and legacy rows. */
        fun of(source: io.buddybudget.core.data.CategorySource?): AutoOrigin? = when (source) {
            io.buddybudget.core.data.CategorySource.regola -> Regola
            io.buddybudget.core.data.CategorySource.storico -> Storico
            io.buddybudget.core.data.CategorySource.assistente -> Assistente
            io.buddybudget.core.data.CategorySource.banca -> Banca
            else -> null
        }
    }
}

/** "Auto" source badge: icon 14 + label, text-xs `--text-2`; `compact` = icon only (movement rows). */
@Composable
fun AutoOriginBadge(source: AutoOrigin, compact: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    val label = l10n(source.label)
    Row(
        Modifier.clearAndSetSemantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
    ) {
        BBIconView(source.icon, size = BBIconSize.Sm.dp, color = c.text2)
        if (!compact) BBText(label, BBTextStyle.Caption, color = c.text2, maxLines = 1)
    }
}

/**
 * Selectable chip (filters, account chips): capsule, height 36 (48 dp touch target), text-sm medium.
 * Active: `--primary` border + `--primary @ 10%` fill; inactive: `--foreground @ 4%` fill.
 */
@Composable
fun BBChip(label: String, modifier: Modifier = Modifier, icon: BBIcon? = null, isSelected: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        modifier.height(36.dp)
            .bbPressable(onClick, CircleShape, background = if (isSelected) c.alphaPrimary10 else c.foreground.copy(alpha = 0.04f), translate = false, role = Role.Tab)
            .border(1.5.dp, if (isSelected) c.primary else Color.Transparent, CircleShape)
            .semantics { selected = isSelected }
            .padding(horizontal = BBSpacing.space3_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        if (icon != null) BBIconView(icon, color = if (isSelected) c.primary else c.text2)
        BBText(label, BBTextStyle.BodyStrong, color = if (isSelected) c.primary else c.foreground, maxLines = 1)
    }
}
