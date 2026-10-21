package io.buddybudget.app.designsystem.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.flow.drop

// Full-screen form dialog and date field (spec: design/components.md §0.2, §1.4, §1.7). iOS: BBFormDialog.swift.

/**
 * `FormDialogContent` on phone: full-screen `--popover` modal, no handle, close `x` (20) in a 44 circle at
 * top 12 / right 12, scrolling content with gap 20, optional [footer] pinned at the bottom (actions).
 * Enter: slide up 24 dp + fade, 200 ms; exit reversed.
 */
@Composable
fun FormDialog(
    visible: Boolean,
    onDismiss: () -> Unit,
    closeLabel: String = l10n(L10n.close),
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    var mounted by remember { mutableStateOf(visible) }
    val progress = remember { Animatable(0f) }
    val reduceMotion = rememberReduceMotion()
    LaunchedEffect(visible) {
        if (visible) {
            mounted = true
            progress.animateTo(1f, tween(BBMotion.durationBase))
        } else if (mounted) {
            progress.animateTo(0f, tween(BBMotion.durationBase))
            mounted = false
        }
    }
    if (!mounted) return
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect {
            window?.setDimAmount(0f)
            window?.setWindowAnimations(0)
        }
        Box(
            Modifier.fillMaxSize()
                .offset(y = if (reduceMotion) 0.dp else (24 * (1f - progress.value)).dp)
                .alpha(progress.value)
                .background(c.popover),
        ) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
                Column(
                    Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                        .padding(start = BBSpacing.space4, end = BBSpacing.space4, top = BBSpacing.space4, bottom = BBSpacing.space6),
                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space5),
                    content = content,
                )
                if (footer != null) {
                    BBSeparator()
                    Column(
                        Modifier.fillMaxWidth().background(c.popover).padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
                        content = footer,
                    )
                }
            }
            Box(
                Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = BBSpacing.space1, end = BBSpacing.space1)
                    .size(BBLayout.minTouchTarget)
                    .bbPressable(onDismiss, CircleShape, pressedBackground = c.muted, translate = false)
                    .semantics { contentDescription = closeLabel },
                contentAlignment = Alignment.Center,
            ) {
                BBIconView(BBIcon.X, size = BBIconSize.Lg.dp, color = c.mutedForeground)
            }
        }
    }
}

/**
 * Header of a form dialog (`PanelDialogHeader`): tinted 40 circle with a 20 icon, title (font-heading text-lg),
 * description (text-sm `--muted-foreground`). Leaves room for the close button.
 */
@Composable
fun FormDialogHeader(icon: BBIcon, title: String, description: String? = null, color: Color = BuddyBudgetTheme.colors.primary) {
    Row(Modifier.fillMaxWidth().padding(end = BBSpacing.space10), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBIconBadge(icon, color, 40.dp, 20.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(title, Modifier.semantics { heading() }, BBStyles.titleSmall.copy(lineHeight = 22.sp))
            if (description != null) BBText(description, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
        }
    }
}

/**
 * Sub-section of a form dialog (`DialogSection`): optional tinted 28 icon + text-sm semibold title, optional muted
 * description, then the content (gap 12).
 */
@Composable
fun FormDialogSection(
    title: String,
    icon: BBIcon? = null,
    description: String? = null,
    color: Color = BuddyBudgetTheme.colors.primary,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (icon != null) BBIconBadge(icon, color, 28.dp, 14.dp)
            BBText(title, Modifier.semantics { heading() }, BBTextStyle.Body.style.copy(fontWeight = FontWeight.W600))
        }
        if (description != null) BBText(description, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
        content()
    }
}

/**
 * Date input (§1.4): looks like [BBSelect] (label, 32/44 dp field with the date and a calendar icon); tapping opens the
 * Material date picker, which closes on selection. [date] is ISO `YYYY-MM-DD`. Same parameters as `BBDateField` on iOS.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BBDateField(date: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, label: String? = null, height: Dp = BBLayout.inputHeight) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(BBRadius.lg)
    val formatted = BBFormat.formatDateWithYear(date, locale)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (label != null) BBText(label, style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
        Row(
            Modifier.fillMaxWidth().height(height)
                .background(if (BuddyBudgetTheme.isDark) c.alphaInput30 else Color.Transparent, shape)
                .border(1.dp, c.input, shape)
                .bbPressable({ open = true }, shape, translate = false)
                .semantics { contentDescription = (label ?: "") + ": " + formatted }
                .padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBText(formatted, Modifier.weight(1f), BBTextStyle.Body.style, maxLines = 1)
            BBIconView(BBIcon.CalendarDays, color = c.mutedForeground)
        }
    }
    if (open) {
        val initial = CalendarDate.parse(date)?.epochDay?.toLong()?.times(86_400_000L)
        val state = rememberDatePickerState(initialSelectedDateMillis = initial)
        LaunchedEffect(state) {
            snapshotFlow { state.selectedDateMillis }.drop(1).collect { millis ->
                if (millis != null) {
                    onChange(CalendarDate.ofEpochDay(Math.floorDiv(millis, 86_400_000L).toInt()).iso)
                    open = false
                }
            }
        }
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {},
            colors = DatePickerDefaults.colors(containerColor = c.popover),
        ) {
            DatePicker(
                state,
                title = null,
                headline = null,
                showModeToggle = false,
                colors = DatePickerDefaults.colors(
                    containerColor = c.popover,
                    selectedDayContainerColor = c.primary,
                    selectedDayContentColor = c.primaryForeground,
                    todayDateBorderColor = c.primary,
                    todayContentColor = c.primary,
                    dayContentColor = c.foreground,
                    weekdayContentColor = c.mutedForeground,
                    subheadContentColor = c.mutedForeground,
                    navigationContentColor = c.foreground,
                    yearContentColor = c.foreground,
                    selectedYearContainerColor = c.primary,
                    selectedYearContentColor = c.primaryForeground,
                ),
            )
        }
    }
}
