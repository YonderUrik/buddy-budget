package io.buddybudget.app.designsystem.components

import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle

// Form controls added in Phase 1 (spec: design/components.md §1.4–1.6). iOS: BBForms.swift.

/** 16×16, radius 4, border `--input`; checked = `--primary` fill + white `check` 14 (§1.5). */
@Composable
fun BBCheckbox(checked: Boolean, onCheckedChange: (Boolean) -> Unit, modifier: Modifier = Modifier, accessibilityLabel: String = "", enabled: Boolean = true) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(4.dp)
    Box(
        modifier.size(16.dp)
            .bbDisabled(!enabled)
            .background(if (checked) c.primary else Color.Transparent, shape)
            .border(1.dp, if (checked) c.primary else c.input, shape)
            .bbPressable(if (enabled) ({ onCheckedChange(!checked) }) else null, shape, translate = false, role = Role.Checkbox)
            .semantics {
                contentDescription = accessibilityLabel
                stateDescription = if (checked) "1" else "0"
            },
        contentAlignment = Alignment.Center,
    ) {
        if (checked) BBIconView(BBIcon.Check, size = 14.dp, color = c.primaryForeground)
    }
}

/**
 * Select (§1.6): trigger like an input (h 32, or 44 on primary forms) with chevron-down; the options open in a
 * [BBSheet] list with a check on the selected one. Same parameters as `BBSelect` on iOS.
 */
@Composable
fun <T> BBSelect(
    options: List<Pair<T, String>>,
    selection: T,
    onChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    title: String? = null,
    height: Dp = BBLayout.inputHeight,
    enabled: Boolean = true,
    /** Optional leading view of an option (e.g. the country flag, web `<Flag/>` in `SelectItem`), also in the field. */
    leading: (@Composable (T) -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    var open by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.first == selection }?.second ?: ""
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (label != null) BBText(label, style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
        Row(
            Modifier.fillMaxWidth().height(height)
                .bbDisabled(!enabled)
                .background(if (dark) c.alphaInput30 else Color.Transparent, shape)
                .border(1.dp, c.input, shape)
                .bbPressable(if (enabled) ({ open = true }) else null, shape, translate = false)
                .semantics { contentDescription = (label ?: title ?: current) + ": " + current }
                .padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            if (leading != null && options.any { it.first == selection }) leading(selection)
            BBText(current, Modifier.weight(1f), BBTextStyle.Body.style, maxLines = 1)
            BBIconView(BBIcon.ChevronDown, color = c.mutedForeground)
        }
    }
    BBSheet(open, { open = false }, title ?: label) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            options.forEach { (value, text) ->
                val selected = value == selection
                Row(
                    Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable({
                            open = false
                            if (value != selection) onChange(value)
                        }, RoundedCornerShape(BBRadius.md), background = if (selected) c.accent else Color.Transparent,
                            pressedBackground = c.accent, translate = false)
                        .semantics { this.selected = selected }
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    leading?.invoke(value)
                    BBText(text, Modifier.weight(1f), BBTextStyle.BodyLarge.style)
                    if (selected) BBIconView(BBIcon.Check, color = c.primary)
                }
            }
        }
    }
}

/** Multiline input (§1.4): min height 64, grows with the text, padding 10×8, same borders as [BBTextField]. */
@Composable
fun BBTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    maxLength: Int? = null,
    enabled: Boolean = true,
    /** Minimum height (64 by default; the report form uses 112, 96 in the sheet). */
    minHeight: Dp = 64.dp,
    /** Called when the field loses focus (save-on-blur fields, e.g. the movement note, TX-070). */
    onBlur: (() -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val source = remember { MutableInteractionSource() }
    val focused by source.collectIsFocusedAsState()
    if (onBlur != null) {
        var wasFocused by remember { mutableStateOf(false) }
        LaunchedEffect(focused) {
            if (wasFocused && !focused) onBlur()
            wasFocused = focused
        }
    }
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (label != null) BBText(label, style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
        BasicTextField(
            value = value,
            onValueChange = { onValueChange(if (maxLength != null) it.take(maxLength) else it) },
            enabled = enabled,
            textStyle = BBTextStyle.BodyLarge.style.copy(color = c.foreground),
            cursorBrush = SolidColor(c.primary),
            interactionSource = source,
            minLines = 3,
            maxLines = 12,
            modifier = Modifier.fillMaxWidth().heightIn(min = minHeight)
                .bbDisabled(!enabled)
                .background(if (dark) c.alphaInput30 else Color.Transparent, shape)
                .border(1.dp, if (focused) c.ring else c.input, shape),
            decorationBox = { inner ->
                Box(Modifier.padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space2)) {
                    if (value.isEmpty()) BBText(placeholder, style = BBTextStyle.BodyLarge.style, color = c.mutedForeground)
                    inner()
                }
            },
        )
    }
}

/** A part of [BBLinkText]: plain fragment or underlined link. Fragments are already translated. */
sealed class BBLinkPart {
    data class Plain(val text: String) : BBLinkPart()
    data class Link(val text: String, val url: String) : BBLinkPart()
}

/** A paragraph made of plain fragments and underlined links (legal notes, consents). */
@Composable
fun BBLinkText(
    parts: List<BBLinkPart>,
    modifier: Modifier = Modifier,
    style: TextStyle = BBTextStyle.Caption.style,
    color: Color = BuddyBudgetTheme.colors.text3,
    textAlign: TextAlign = TextAlign.Start,
    /** Links in another colour / weight (e.g. `text-foreground font-medium` on the help page); default = like the text. */
    linkColor: Color? = null,
    linkWeight: androidx.compose.ui.text.font.FontWeight? = null,
) {
    val text = buildAnnotatedString {
        parts.forEach { part ->
            when (part) {
                is BBLinkPart.Plain -> append(part.text)
                is BBLinkPart.Link -> withLink(
                    LinkAnnotation.Url(part.url, TextLinkStyles(SpanStyle(color = linkColor ?: color, fontWeight = linkWeight, textDecoration = TextDecoration.Underline))),
                ) { append(part.text) }
            }
        }
    }
    Text(text, modifier, style = style.copy(color = color, textAlign = textAlign))
}

/** The «BB» logo mark (`public/brand/logo-mark.svg`, 24×29 in headers), fixed brand colours in both themes. */
@Composable
fun BBLogoMark(height: Dp = 29.dp, modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.brand_logo_mark), contentDescription = null, modifier = modifier.height(height).width(height * (378.1462f / 463.8719f)))
}

/**
 * Inline error box (web `rounded-lg bg-neg-soft p-3 text-sm text-neg`). With [reportArea], `Segnala questo problema`
 * follows the box (web `ErrorWithReport`, 16-help-support).
 */
@Composable
fun BBErrorBox(message: String, modifier: Modifier = Modifier, reportArea: io.buddybudget.core.domain.support.ReportErrorArea? = null) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth()) {
        BBText(
            message,
            Modifier.fillMaxWidth().background(c.negSoft, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
            BBTextStyle.Body.style,
            color = c.neg,
        )
        if (reportArea != null) io.buddybudget.app.features.help.ReportErrorLink(reportArea, message)
    }
}

/** Search box of lists (web `MovementsToolbar`): 44 high, radius xl, 1 dp `--input` border on `--card`, search icon. */
@Composable
fun SearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        modifier.fillMaxWidth().height(44.dp).background(c.card, shape).border(1.dp, if (focused) c.ring else c.input, shape)
            .padding(horizontal = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        BBIconView(BBIcon.Search, size = 16.dp, color = c.mutedForeground)
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) BBText(placeholder, io.buddybudget.app.designsystem.generated.BBTextStyle.BodyLarge, color = c.mutedForeground, maxLines = 1)
            androidx.compose.foundation.text.BasicTextField(
                value, onValueChange, Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
                singleLine = true,
                textStyle = io.buddybudget.app.designsystem.generated.BBTextStyle.BodyLarge.style.copy(color = c.foreground),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(c.primary),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search, autoCorrectEnabled = false),
            )
        }
    }
}

/**
 * Flag codes drawn by the app (web `Flag`, #397): English uses the British flag, matching the en-GB formats; `WORLD`
 * is a small globe in the muted colour for «Altro paese» (web #465).
 */
enum class BBFlagCode {
    IT, DE, GB, WORLD;

    companion object {
        /** Web `COUNTRY_FLAGS` from `LocaleRules.flagCode`. */
        fun of(code: String): BBFlagCode = entries.firstOrNull { it.name == code } ?: IT
    }
}

enum class BBFlagSize(val width: Dp, val height: Dp) { Sm(14.dp, 10.dp), Md(20.dp, 14.dp), Lg(24.dp, 16.dp) }

/**
 * Small 3:2 flag (web `Flag`): flag colours are part of the flag, not of the theme; a hairline ring keeps white
 * stripes visible. Drawn on a 30×20 box (`xMidYMid slice`), the Union Jack on a 60×30 grid scaled and cropped.
 */
@Composable
fun BBFlag(code: BBFlagCode, size: BBFlagSize = BBFlagSize.Md, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(3.dp)
    androidx.compose.foundation.Canvas(
        modifier.size(size.width, size.height).clip(shape).border(1.dp, c.foreground.copy(alpha = 0.15f), shape),
    ) {
        val s = maxOf(this.size.width / 30f, this.size.height / 20f)
        withTransform({
            translate((this@Canvas.size.width - 30f * s) / 2f, (this@Canvas.size.height - 20f * s) / 2f)
            scale(s, s, pivot = androidx.compose.ui.geometry.Offset.Zero)
        }) {
            when (code) {
                BBFlagCode.WORLD -> {
                    // Not a flag: a globe in the theme's muted colour, so it follows light and dark mode.
                    val muted = c.mutedForeground
                    val stroke = androidx.compose.ui.graphics.drawscope.Stroke(1.4f)
                    drawRect(muted.copy(alpha = 0.12f), size = androidx.compose.ui.geometry.Size(30f, 20f))
                    drawCircle(muted, radius = 7f, center = androidx.compose.ui.geometry.Offset(15f, 10f), style = stroke)
                    drawOval(muted, topLeft = androidx.compose.ui.geometry.Offset(12f, 3f), size = androidx.compose.ui.geometry.Size(6f, 14f), style = stroke)
                    drawLine(muted, androidx.compose.ui.geometry.Offset(8f, 10f), androidx.compose.ui.geometry.Offset(22f, 10f), strokeWidth = 1.4f)
                }
                BBFlagCode.IT -> listOf(0xFF009246, 0xFFFFFFFF, 0xFFCE2B37).forEachIndexed { i, col ->
                    drawRect(Color(col), topLeft = androidx.compose.ui.geometry.Offset(i * 10f, 0f), size = androidx.compose.ui.geometry.Size(10f, 20f))
                }
                BBFlagCode.DE -> listOf(0xFF000000, 0xFFDD0000, 0xFFFFCE00).forEachIndexed { i, col ->
                    drawRect(Color(col), topLeft = androidx.compose.ui.geometry.Offset(0f, i * 20f / 3f), size = androidx.compose.ui.geometry.Size(30f, 20f / 3f + 0.01f))
                }
                BBFlagCode.GB -> withTransform({
                    translate(-5f, 0f)
                    scale(0.6667f, 0.6667f, pivot = androidx.compose.ui.geometry.Offset.Zero)
                }) {
                    val red = Color(0xFFC8102E)
                    drawRect(Color(0xFF012169), size = androidx.compose.ui.geometry.Size(60f, 30f))
                    val diagonals = androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(60f, 30f); moveTo(60f, 0f); lineTo(0f, 30f) }
                    drawPath(diagonals, Color.White, style = androidx.compose.ui.graphics.drawscope.Stroke(6f))
                    val clip = androidx.compose.ui.graphics.Path().apply {
                        for (t in listOf(
                            listOf(30f to 15f, 60f to 15f, 60f to 30f), listOf(30f to 15f, 30f to 30f, 0f to 30f),
                            listOf(30f to 15f, 0f to 15f, 0f to 0f), listOf(30f to 15f, 30f to 0f, 60f to 0f),
                        )) {
                            moveTo(t[0].first, t[0].second); lineTo(t[1].first, t[1].second); lineTo(t[2].first, t[2].second); close()
                        }
                    }
                    clipPath(clip) { drawPath(diagonals, red, style = androidx.compose.ui.graphics.drawscope.Stroke(4f)) }
                    val cross = androidx.compose.ui.graphics.Path().apply { moveTo(30f, 0f); lineTo(30f, 30f); moveTo(0f, 15f); lineTo(60f, 15f) }
                    drawPath(cross, Color.White, style = androidx.compose.ui.graphics.drawscope.Stroke(10f))
                    drawPath(cross, red, style = androidx.compose.ui.graphics.drawscope.Stroke(6f))
                }
            }
        }
    }
}
