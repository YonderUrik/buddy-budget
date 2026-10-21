package io.buddybudget.app.designsystem.components

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSwatch
import io.buddybudget.app.generated.AppLanguage
import io.buddybudget.core.data.LogoLoader
import io.buddybudget.core.designsystem.AmountColorRole
import io.buddybudget.core.domain.format.BBLanguage
import io.buddybudget.core.domain.format.BBLocale

// Design system v1 foundations shared by every component (spec: design/components.md §0, §3.10;
// design/iconography-assets.md §1). Same names on iOS in DesignSystem/Components/BBFoundation.swift.

// ---------------------------------------------------------------- Locals: formatting locale, privacy, logos

/** Formatting locale for `BBFormat` (follows the account language, never the device). */
val LocalBBLocale = staticCompositionLocalOf { BBLocale.IT_IT }

/** Privacy mode (`hideAmounts`): every amount renders `••••`, charts blur and stop reacting to touch. */
val LocalHideAmounts = staticCompositionLocalOf { false }

/** Authenticated image loader used by `MerchantLogo`. */
val LocalLogoLoader = staticCompositionLocalOf<LogoLoader?> { null }

/** `BBFormat` locale of the account language. */
val AppLanguage.bbLocale: BBLocale
    get() = BBLocale.of(BBLanguage.entries.firstOrNull { it.code == code } ?: BBLanguage.IT)

/** Global privacy preference (server setting `hideAmounts`, components.md §3.10). */
@Stable
class PrivacyStore(hideAmounts: Boolean = false) {
    var hideAmounts by mutableStateOf(hideAmounts)
}

// ---------------------------------------------------------------- Extra text styles

private val Css = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

private fun style(family: FontFamily, size: TextUnit, lineHeight: TextUnit, weight: Int, tracking: Float = 0f, tabular: Boolean = false) =
    TextStyle(
        fontFamily = family,
        fontWeight = FontWeight(weight),
        fontSize = size,
        lineHeight = lineHeight,
        letterSpacing = tracking.em,
        lineHeightStyle = Css,
        fontFeatureSettings = if (tabular) "tnum" else null,
    )

/** Web classes not covered by the generated typography tokens (same values as iOS `BBTextStyle` extensions). */
object BBStyles {
    /** Page title (`PAGE_TITLE`): the condensed display face, light, 40 sp, leading 0.95 (#405). */
    val screenTitle = io.buddybudget.app.designsystem.generated.BBTextStyle.PageTitle.style

    /** The Panoramica greeting: display face, 44 sp (`text-[2.75rem]`). */
    val greetingTitle = io.buddybudget.app.designsystem.generated.BBTextStyle.PageTitle.style.copy(fontSize = 44.sp, lineHeight = 42.sp)

    /** Compact top-bar title: font-heading text-base font-medium. */
    val topBarTitle = style(BBFontFamilies.sans, 16.sp, 24.sp, 500)

    /** Section title (`SECTION_TITLE`): display face, light, 36 sp, no icon next to it (#411, #427). */
    val sectionHeading = io.buddybudget.app.designsystem.generated.BBTextStyle.SectionTitle.style

    /** A view title used as the section switcher on the phone («Movimenti ⌄»): 36 sp, 28 when long. */
    val viewTitleLong = io.buddybudget.app.designsystem.generated.BBTextStyle.SectionTitle.style.copy(fontSize = 28.sp, lineHeight = 27.sp)

    /** Brand name in the top bar: font-heading text-base font-bold. */
    val brandName = style(BBFontFamilies.sans, 16.sp, 24.sp, 700)

    /** A highlighted figure inside a block (font-heading text-xl font-medium tabular-nums): never the condensed face. */
    val figure = style(BBFontFamilies.sans, 20.sp, 28.sp, 500, tabular = true)

    /** Dialog and sheet titles, small block titles (font-heading text-lg font-medium). */
    val titleSmall = style(BBFontFamilies.sans, 18.sp, 28.sp, 500, tabular = true)

    /** List row primary line: font-semibold (text-base). */
    val rowTitle = style(BBFontFamilies.sans, 16.sp, 24.sp, 600)

    /** List row amount: font-heading font-semibold tabular-nums (text-base). */
    val rowAmount = style(BBFontFamilies.sans, 16.sp, 24.sp, 600, tabular = true)

    /** Hero amount (`MoneyHero`, phone): font-heading text-5xl font-medium tabular-nums. */
    val hero = style(BBFontFamilies.sans, 48.sp, 48.sp, 500, -0.025f, tabular = true)

    /** Small link/action label: text-sm font-semibold. */
    val link = style(BBFontFamilies.sans, 14.sp, 20.sp, 600)

    /** Chart tooltip value: text-xs font-medium tabular-nums (Hanken; mono is for literal codes only). */
    val tooltipValue = style(BBFontFamilies.sans, 12.sp, 16.sp, 500, tabular = true)

    /** Donut center amount: font-heading text-xl font-medium tabular-nums. */
    val amountMedium = style(BBFontFamilies.sans, 20.sp, 28.sp, 500, tabular = true)
}

/** Text in a BuddyBudget style and color. */
@Composable
fun BBText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = io.buddybudget.app.designsystem.generated.BBTextStyle.Body.style,
    color: Color = BuddyBudgetTheme.colors.foreground,
    maxLines: Int = Int.MAX_VALUE,
    uppercase: Boolean = false,
) {
    val locale = LocalBBLocale.current
    Text(
        text = if (uppercase) text.uppercase(java.util.Locale.forLanguageTag(locale.tag)) else text,
        modifier = modifier,
        style = style,
        color = color,
        maxLines = maxLines,
        overflow = if (maxLines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis,
    )
}

/** Text in a generated `BBTextStyle` (honours its `uppercase` flag). */
@Composable
fun BBText(
    text: String,
    token: io.buddybudget.app.designsystem.generated.BBTextStyle,
    modifier: Modifier = Modifier,
    color: Color = BuddyBudgetTheme.colors.foreground,
    maxLines: Int = Int.MAX_VALUE,
) = BBText(text, modifier, token.style, color, maxLines, token.uppercase)

// ---------------------------------------------------------------- Colors

fun AmountColorRole.color(c: BBColors): Color = when (this) {
    AmountColorRole.Foreground -> c.foreground
    AmountColorRole.Pos -> c.pos
    AmountColorRole.Neg -> c.neg
}

/** Swatch by stored key (`BBSwatch.order`); unknown keys fall back to `slate`. */
@Composable
fun bbSwatch(key: String): Color = BBSwatch.color(BuddyBudgetTheme.colors, key)

// ---------------------------------------------------------------- Icons

/** Icon sizes in use (iconography-assets.md §1.1). */
enum class BBIconSize(val dp: Dp) { Xs(12.dp), Sm(14.dp), Md(16.dp), Lg(20.dp), Xl(24.dp) }

/** A Lucide icon tinted with [color] (stroke scales with the size, like lucide-react). Decorative. */
@Composable
fun BBIconView(icon: BBIcon, modifier: Modifier = Modifier, size: Dp = BBIconSize.Md.dp, color: Color = BuddyBudgetTheme.colors.foreground) {
    Icon(painterResource(icon.drawable), contentDescription = null, modifier = modifier.size(size), tint = color)
}

/** `loader-circle` spinning 360° linear 1 s (Tailwind `animate-spin`). */
@Composable
fun BBSpinner(size: Dp = BBIconSize.Md.dp, color: Color = BuddyBudgetTheme.colors.foreground) {
    val angle by rememberInfiniteTransition(label = "spin").animateFloat(
        0f, 360f, infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart), label = "angle",
    )
    BBIconView(BBIcon.LoaderCircle, Modifier.rotate(angle), size, color)
}

/** Icon in a tinted circle (`SectionTitle`, `EmptyState`, avatars): fg = color, bg = color @ 16 %. */
@Composable
fun BBIconBadge(icon: BBIcon, color: Color = BuddyBudgetTheme.colors.swatchTeal, diameter: Dp = 36.dp, iconSize: Dp = 18.dp) {
    Box(Modifier.size(diameter).background(color.copy(alpha = 0.16f), CircleShape), contentAlignment = Alignment.Center) {
        BBIconView(icon, size = iconSize, color = color)
    }
}

// ---------------------------------------------------------------- Interaction

/**
 * Click without ripple (components.md §0.4: `indication = null` + custom pressed background), 1 dp downward shift
 * while pressed when [translate]. Compose already extends the touch target of small nodes to 48 dp
 * (`minimumTouchTargetSize`) without changing their layout, matching iOS `bbHitArea`.
 */
@Composable
fun Modifier.bbPressable(
    onClick: (() -> Unit)?,
    shape: Shape,
    background: Color = Color.Transparent,
    pressedBackground: Color = Color.Transparent,
    translate: Boolean = true,
    enabled: Boolean = true,
    role: Role = Role.Button,
    onClickLabel: String? = null,
    /** Long press (secondary actions, e.g. the movement actions sheet). */
    onLongClick: (() -> Unit)? = null,
): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val base = this.offset(y = if (pressed && translate) 1.dp else 0.dp)
        .background(if (pressed) pressedBackground else background, shape)
    if (onClick == null) return base
    if (onLongClick != null) {
        @OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
        return base.combinedClickable(
            interactionSource = source, indication = null, enabled = enabled, role = role, onClickLabel = onClickLabel,
            onLongClick = onLongClick, onClick = onClick,
        )
    }
    return base.clickable(
        interactionSource = source, indication = null, enabled = enabled, role = role, onClickLabel = onClickLabel, onClick = onClick,
    )
}

/** Disabled controls: 50 % opacity (components.md §0.4). */
fun Modifier.bbDisabled(disabled: Boolean): Modifier = alpha(if (disabled) 0.5f else 1f)

/** True when the system animator scale is 0 (Reduce Motion equivalent). */
@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
