package io.buddybudget.app.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadowLayer
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.core.designsystem.AmountInput

// Controls (spec: design/components.md §0.4, §1.1, §1.4, §1.5, §3.3). iOS: BBControls.swift.

/** CSS box-shadow layers (tokens.md §5) with `dropShadow` (radius = CSS blur, spread kept). */
fun Modifier.bbShadow(layers: List<BBShadowLayer>, shape: Shape): Modifier =
    layers.fold(this) { m, l -> m.dropShadow(shape, Shadow(radius = l.blur, color = l.color, spread = l.spread, offset = DpOffset(l.x, l.y))) }

// ---------------------------------------------------------------- BBButton

/** `Sun`: the brand yellow, for the page's main action (#405). `Outline` is filled like `Secondary` (#427). */
enum class BBButtonVariant { Default, Sun, Outline, Secondary, Ghost, Destructive, Link }

enum class BBButtonSize(val height: Dp, val horizontalPadding: Dp, val radius: Dp, val iconSize: Dp, val isIcon: Boolean = false) {
    Xs(24.dp, 8.dp, BBRadius.md, 12.dp),
    Sm(28.dp, 10.dp, BBRadius.md, 14.dp),
    Default(32.dp, 10.dp, BBRadius.lg, 16.dp),
    Lg(36.dp, 10.dp, BBRadius.lg, 16.dp),

    /** 44 dp, padding 16: EmptyState actions, primary form actions on phone (§1.1). */
    Touch(44.dp, 16.dp, BBRadius.lg, 16.dp),
    Icon(32.dp, 0.dp, BBRadius.lg, 16.dp, true),
    IconSm(28.dp, 0.dp, BBRadius.md, 16.dp, true),
    IconLg(36.dp, 0.dp, BBRadius.lg, 16.dp, true),
    IconTouch(44.dp, 0.dp, BBRadius.lg, 16.dp, true),
    ;

    val textStyle: TextStyle
        get() = when (this) {
            Xs -> BBTextStyle.Button.style.copy(fontSize = 12.sp, lineHeight = 16.sp)
            Sm -> BBTextStyle.Button.style.copy(fontSize = 12.8.sp, lineHeight = 16.sp)
            else -> BBTextStyle.Button.style
        }
}

data class BBButtonColors(val background: Color, val foreground: Color, val pressed: Color, val border: Color?) {
    companion object {
        fun of(variant: BBButtonVariant, c: BBColors, dark: Boolean): BBButtonColors = when (variant) {
            BBButtonVariant.Default -> BBButtonColors(c.primary, c.primaryForeground, c.alphaPrimary80, null)
            BBButtonVariant.Sun -> BBButtonColors(c.sun, c.onSun, c.sunHover, null)
            BBButtonVariant.Outline -> BBButtonColors(c.secondary, c.secondaryForeground, c.stateSecondaryHover, null)
            BBButtonVariant.Secondary -> BBButtonColors(c.secondary, c.secondaryForeground, c.stateSecondaryHover, null)
            BBButtonVariant.Ghost -> BBButtonColors(Color.Transparent, c.foreground, if (dark) c.alphaMuted50 else c.muted, null)
            BBButtonVariant.Destructive -> BBButtonColors(
                if (dark) c.alphaDestructive20 else c.alphaDestructive10, c.destructive,
                if (dark) c.destructive.copy(alpha = 0.3f) else c.alphaDestructive20, null,
            )
            BBButtonVariant.Link -> BBButtonColors(Color.Transparent, c.primary, Color.Transparent, null)
        }
    }
}

/**
 * Button with the web variants and sizes. Visual size from the tokens, touch target ≥ 48 dp. [isLoading] shows the
 * spinner in the icon slot and blocks taps; disabled = 50 % opacity.
 */
@Composable
fun BBButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: BBIcon? = null,
    iconTrailing: Boolean = false,
    variant: BBButtonVariant = BBButtonVariant.Default,
    size: BBButtonSize = BBButtonSize.Default,
    fullWidth: Boolean = false,
    isLoading: Boolean = false,
    enabled: Boolean = true,
) {
    val colors = BBButtonColors.of(variant, BuddyBudgetTheme.colors, BuddyBudgetTheme.isDark)
    // Every button is a pill (#427).
    val shape = CircleShape
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val active = enabled && !isLoading
    Row(
        modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(size.height)
            .then(if (size.isIcon) Modifier.width(size.height) else Modifier)
            .bbDisabled(!active)
            .offset(y = if (pressed) 1.dp else 0.dp)
            .background(if (pressed) colors.pressed else colors.background, shape)
            .then(if (colors.border != null) Modifier.border(1.dp, colors.border, shape) else Modifier)
            .then(
                if (active) {
                    Modifier.clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
                } else {
                    Modifier
                },
            )
            .semantics { contentDescription = text }
            .padding(horizontal = size.horizontalPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5, Alignment.CenterHorizontally),
    ) {
        if (isLoading) {
            BBSpinner(size = if (size.iconSize <= 12.dp) 12.dp else if (size.iconSize <= 14.dp) 14.dp else 16.dp, color = colors.foreground)
        } else if (icon != null && !iconTrailing) {
            BBIconView(icon, size = size.iconSize, color = colors.foreground)
        }
        if (!size.isIcon) {
            val style = if (variant == BBButtonVariant.Link && pressed) size.textStyle.copy(textDecoration = TextDecoration.Underline) else size.textStyle
            BBText(text, style = style, color = colors.foreground, maxLines = 1)
        }
        if (icon != null && iconTrailing && !isLoading) BBIconView(icon, size = size.iconSize, color = colors.foreground)
    }
}

// ---------------------------------------------------------------- BBTextField

/** Autofill semantics of a field (Android `ContentType`, iOS `textContentType`). */
enum class BBContentType(val type: ContentType) {
    Email(ContentType.EmailAddress),
    Name(ContentType.PersonFullName),
    OneTimeCode(ContentType.SmsOtpCode),
}

enum class BBKeyboard {
    Text, Email, Number,

    /** Decimal pad; both "," and "." are accepted and normalized to the locale's decimal separator (§1.4). */
    Amount,

    /** Like [Amount], but the value may be negative (a keyboard with "-", e.g. today's balance of an account). */
    SignedAmount,
}

/**
 * Label (text-sm medium) + 32 dp input (radius lg, 1 dp `--input` border, text 16) + error message.
 * Focus: `--ring` border + 3 dp `--ring @ 50%` ring; invalid: `--destructive` border + ring `@ 20%` (dark 40%).
 */
@Composable
fun BBTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    error: String? = null,
    keyboard: BBKeyboard = BBKeyboard.Text,
    prefix: String? = null,
    enabled: Boolean = true,
    /** Visual height: 32 (default, web `h-8`) or 44 for primary phone forms (web `h-11`, login). */
    height: Dp = BBLayout.inputHeight,
    /** Autofill hint (email, name, one-time code). */
    contentType: BBContentType? = null,
    imeAction: ImeAction = ImeAction.Done,
    onSubmit: (() -> Unit)? = null,
    /** Focus the field when it appears. */
    autofocus: Boolean = false,
    capitalization: KeyboardCapitalization? = null,
    /** Called when the field loses focus (save-on-exit fields). */
    onBlur: (() -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val locale = LocalBBLocale.current
    val focusRequester = remember { FocusRequester() }
    if (autofocus) LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }
    val source = remember { MutableInteractionSource() }
    val focused by source.collectIsFocusedAsState()
    var wasFocused by remember { mutableStateOf(false) }
    LaunchedEffect(focused) {
        if (wasFocused && !focused) onBlur?.invoke()
        wasFocused = focused
    }
    val shape = RoundedCornerShape(BBRadius.lg)
    val border = when {
        error != null -> c.destructive
        focused -> c.ring
        else -> c.input
    }
    val ring = when {
        error != null -> c.destructive.copy(alpha = if (dark) 0.4f else 0.2f)
        focused -> c.alphaRing50
        else -> Color.Transparent
    }
    val fill = when {
        !enabled -> if (dark) c.alphaInput80 else c.alphaInput50
        dark -> c.alphaInput30
        else -> Color.Transparent
    }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (label != null) BBText(label, style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
        BasicTextField(
            value = value,
            onValueChange = { onValueChange(if (keyboard == BBKeyboard.Amount || keyboard == BBKeyboard.SignedAmount) AmountInput.normalize(it, locale) else it) },
            enabled = enabled,
            singleLine = true,
            textStyle = BBTextStyle.BodyLarge.style.copy(color = c.foreground),
            cursorBrush = SolidColor(c.primary),
            interactionSource = source,
            keyboardOptions = KeyboardOptions(
                keyboardType = when (keyboard) {
                    BBKeyboard.Text -> KeyboardType.Text
                    BBKeyboard.Email -> KeyboardType.Email
                    BBKeyboard.Number -> KeyboardType.Number
                    BBKeyboard.Amount -> KeyboardType.Decimal
                    BBKeyboard.SignedAmount -> KeyboardType.Number
                },
                capitalization = capitalization ?: if (keyboard == BBKeyboard.Text) KeyboardCapitalization.Sentences else KeyboardCapitalization.None,
                autoCorrectEnabled = keyboard == BBKeyboard.Text,
                imeAction = imeAction,
            ),
            keyboardActions = KeyboardActions(onAny = { onSubmit?.invoke() }),
            modifier = Modifier.fillMaxWidth()
                .focusRequester(focusRequester)
                .then(if (contentType != null) Modifier.semantics { this.contentType = contentType.type } else Modifier)
                .bbDisabled(!enabled)
                .drawBehind {
                    val w = 3.dp.toPx()
                    val r = (BBRadius.lg + 3.dp).toPx() - w / 2
                    drawRoundRect(ring, Offset(-w / 2 - 0.5f, -w / 2 - 0.5f), Size(size.width + w + 1f, size.height + w + 1f), CornerRadius(r), style = Stroke(w))
                }
                .height(height)
                .background(fill, shape)
                .border(1.dp, border, shape),
            decorationBox = { inner ->
                Row(
                    Modifier.padding(horizontal = if (height > BBLayout.inputHeight) BBSpacing.space3_5 else BBSpacing.space2_5),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
                ) {
                    if (prefix != null) BBText(prefix, BBTextStyle.Caption, color = c.mutedForeground)
                    Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) BBText(placeholder, style = BBTextStyle.BodyLarge.style, color = c.mutedForeground, maxLines = 1)
                        inner()
                    }
                }
            },
        )
        if (error != null) BBText(error, BBTextStyle.Body, color = c.destructive)
    }
}

// ---------------------------------------------------------------- BBSwitch

enum class BBSwitchSize { Default, Sm }

/** Custom switch (not the platform one): track 32×18.4 (sm 24×14), thumb 16 (sm 12), 150 ms (§1.5). */
@Composable
fun BBSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    size: BBSwitchSize = BBSwitchSize.Default,
    accessibilityLabel: String = "",
    enabled: Boolean = true,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val (w, h, thumb) = if (size == BBSwitchSize.Sm) Triple(24.dp, 14.dp, 12.dp) else Triple(32.dp, 18.4.dp, 16.dp)
    val inset = (h - thumb) / 2
    val x by animateDpAsState(if (checked) w - thumb - inset else inset, tween(BBMotion.durationFast), label = "thumb")
    val track by animateColorAsState(if (checked) c.primary else if (dark) c.alphaInput80 else c.input, tween(BBMotion.durationFast), label = "track")
    val thumbColor = if (!dark) c.background else if (checked) c.primaryForeground else c.foreground
    Box(
        modifier.size(w, h)
            .bbDisabled(!enabled)
            .background(track, CircleShape)
            .bbPressable(if (enabled) ({ onCheckedChange(!checked) }) else null, CircleShape, translate = false, role = Role.Switch)
            .semantics {
                contentDescription = accessibilityLabel
                stateDescription = if (checked) "1" else "0"
            },
    ) {
        Box(Modifier.offset(x = x, y = inset).size(thumb).background(thumbColor, CircleShape))
    }
}

// ---------------------------------------------------------------- BBSlider

/**
 * Track 4 (radius full, `--muted`), filled part `--primary`, thumb 12 circle `--background` with a 1 dp `--ring`
 * border, edge-aligned; 3 dp ring `--ring @ 50%` while dragging; value updates continuously (§1.5).
 */
@Composable
fun BBSlider(
    value: Double,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    range: ClosedFloatingPointRange<Double> = 0.0..1.0,
    step: Double = 0.0,
    accessibilityLabel: String = "",
) {
    val c = BuddyBudgetTheme.colors
    var dragging by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    BoxWithConstraints(
        modifier.fillMaxWidth().height(BBLayout.minTouchTarget).semantics {
            contentDescription = accessibilityLabel
            stateDescription = value.toString()
        },
        contentAlignment = Alignment.CenterStart,
    ) {
        val widthPx = with(density) { maxWidth.toPx() }
        val thumbPx = with(density) { 12.dp.toPx() }
        fun update(x: Float) {
            val usable = (widthPx - thumbPx).coerceAtLeast(1f)
            val fraction = ((x - thumbPx / 2) / usable).coerceIn(0f, 1f)
            var v = range.start + fraction * (range.endInclusive - range.start)
            if (step > 0) v = Math.round(v / step) * step
            onValueChange(v.coerceIn(range.start, range.endInclusive))
        }
        val span = range.endInclusive - range.start
        val fraction = if (span > 0) ((value - range.start) / span).toFloat() else 0f
        val x = (maxWidth - 12.dp) * fraction
        Box(
            Modifier.fillMaxWidth().height(BBLayout.minTouchTarget)
                .pointerInput(widthPx, range, step) {
                    detectTapGestures(onPress = { dragging = true; update(it.x); tryAwaitRelease(); dragging = false })
                }
                .pointerInput(widthPx, range, step) {
                    detectDragGestures(
                        onDragStart = { dragging = true; update(it.x) },
                        onDragEnd = { dragging = false },
                        onDragCancel = { dragging = false },
                    ) { change, _ -> change.consume(); update(change.position.x) }
                },
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(Modifier.fillMaxWidth().height(4.dp).background(c.muted, CircleShape))
            Box(Modifier.width(x + 6.dp).height(4.dp).background(c.primary, CircleShape))
            Box(
                Modifier.offset(x = x).size(12.dp)
                    .drawBehind { if (dragging) drawCircle(c.alphaRing50, radius = size.minDimension / 2 + 1.5.dp.toPx(), style = Stroke(3.dp.toPx())) }
                    .background(c.background, CircleShape)
                    .border(1.dp, c.ring, CircleShape),
            )
        }
    }
}

// ---------------------------------------------------------------- SegmentedControl

/**
 * [SegmentedControl] that scrolls horizontally when its options don't fit (section tabs, years, periods). The selected
 * option is scrolled into view on first appearance (e.g. a deep link to the fifth tab) and whenever the selection
 * changes. Twin of `ScrollableSegmentedControl` on iOS.
 */
@Composable
fun <T> ScrollableSegmentedControl(
    options: List<Pair<T, String>>,
    selection: T,
    onSelectionChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String = "",
) = SegmentedControl(options, selection, onSelectionChange, modifier, accessibilityLabel, scrollState = rememberScrollState())

/**
 * Single choice among a few options (view toggles, §3.3): `--muted` pill container, padding 4, gap 4; segments
 * min 36, text-sm medium; the active pill (`--background`, no shadow, #427) slides with the bouncy spring.
 */
@Composable
fun <T> SegmentedControl(
    options: List<Pair<T, String>>,
    selection: T,
    onSelectionChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String = "",
    stretch: Boolean = false,
    scrollState: ScrollState? = null,
) {
    val c = BuddyBudgetTheme.colors
    val density = LocalDensity.current
    val reduceMotion = rememberReduceMotion()
    val bounds = remember { mutableStateMapOf<Int, Pair<Dp, Dp>>() }
    val activeIndex = options.indexOfFirst { it.first == selection }
    val target = bounds[activeIndex]
    val spec = if (reduceMotion) tween<Dp>(150) else BBMotion.springBouncy.spec()
    val pillX by animateDpAsState(target?.first ?: 0.dp, spec, label = "pillX")
    val pillW by animateDpAsState(target?.second ?: 0.dp, spec, label = "pillW")
    if (scrollState != null) {
        // Keep the selected option in view: instantly on first appearance (deep link to a later tab), animated after.
        var settled by remember { mutableStateOf(false) }
        LaunchedEffect(activeIndex, target, scrollState.viewportSize) {
            val bound = target ?: return@LaunchedEffect
            if (scrollState.viewportSize == 0) return@LaunchedEffect
            val center = with(density) { (BBSpacing.space1 + bound.first + bound.second / 2).toPx() }
            val goal = (center - scrollState.viewportSize / 2f).toInt().coerceIn(0, scrollState.maxValue)
            if (!settled || reduceMotion) scrollState.scrollTo(goal) else scrollState.animateScrollTo(goal)
            settled = true
        }
    }
    Box(
        modifier.then(if (scrollState != null) Modifier.horizontalScroll(scrollState) else Modifier)
            .then(if (stretch) Modifier.fillMaxWidth() else Modifier)
            .background(c.muted, CircleShape)
            .padding(BBSpacing.space1)
            .semantics { contentDescription = accessibilityLabel },
    ) {
        if (target != null) {
            Box(Modifier.offset(x = pillX).width(pillW).height(36.dp).background(c.background, CircleShape))
        }
        Row(
            if (stretch) Modifier.fillMaxWidth() else Modifier,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
        ) {
            options.forEachIndexed { i, (value, label) ->
                val active = i == activeIndex
                Box(
                    Modifier.then(if (stretch) Modifier.weight(1f) else Modifier)
                        .heightIn(min = 36.dp)
                        .onGloballyPositioned { coords ->
                            with(density) { bounds[i] = coords.positionInParent().x.toDp() to coords.size.width.toDp() }
                        }
                        .bbPressable({ onSelectionChange(value) }, CircleShape, translate = false, role = Role.Tab)
                        .semantics { selected = active }
                        .padding(horizontal = if (stretch) BBSpacing.space2 else BBSpacing.space3),
                    contentAlignment = Alignment.Center,
                ) {
                    BBText(label, BBTextStyle.BodyStrong, color = if (active) c.foreground else c.mutedForeground, maxLines = 1)
                }
            }
        }
    }
}
