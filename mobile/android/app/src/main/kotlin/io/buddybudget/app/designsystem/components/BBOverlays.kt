package io.buddybudget.app.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.abs
import kotlin.math.roundToInt

// Overlays (spec: design/components.md §1.7–1.8, tokens.md §6.3, decisions/0003). iOS: BBOverlays.swift.
//
// BBSheet is a custom presenter on both platforms (the "choose one approach" of §1.7): a window-level layer
// (Android: a full-screen `Dialog` without platform dim/animation; iOS: an animation-free `fullScreenCover`) that
// draws the 40 % scrim and a bottom panel: top corners 16, `--popover`, 36×4 handle, enter 280 ms
// cubic-bezier(0.32, 0.72, 0, 1), exit 180 ms ease-in, swipe down > 80 dp or > 0.6 dp/ms dismisses, otherwise it
// snaps back with the `sheetSnapBack` spring. Max height 85 % of the screen; taller content scrolls inside.

private val SheetEnter = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)

/** Bottom sheet with drag handle. [title] uses font-heading text-base medium. */
@Composable
fun BBSheet(visible: Boolean, onDismiss: () -> Unit, title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    BBSheetLayer(visible, onDismiss, BuddyBudgetTheme.colors.scrimDialog) {
        if (title != null) BBText(title, Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(lineHeight = 24.sp))
        content()
    }
}

/**
 * Confirmation as a bottom sheet (AlertDialog on phone): optional icon, title, description, actions stacked with the
 * confirm button on top; lighter 10 % scrim. Use for every destructive confirmation.
 */
@Composable
fun BBAlertSheet(
    visible: Boolean,
    title: String,
    description: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    confirmVariant: BBButtonVariant = BBButtonVariant.Destructive,
    cancelLabel: String = l10n(L10n.cancel),
    icon: BBIcon? = null,
) {
    val c = BuddyBudgetTheme.colors
    BBSheetLayer(visible, onDismiss, c.scrimAlert) {
        if (icon != null) BBIconBadge(icon, if (confirmVariant == BBButtonVariant.Destructive) c.destructive else c.primary, 44.dp, 20.dp)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(title, Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(lineHeight = 24.sp))
            BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(confirmLabel, { onDismiss(); onConfirm() }, variant = confirmVariant, size = BBButtonSize.Touch, fullWidth = true)
            BBButton(cancelLabel, onDismiss, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

@Composable
private fun BBSheetLayer(visible: Boolean, onDismiss: () -> Unit, scrim: Color, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    var mounted by remember { mutableStateOf(visible) }
    val progress = remember { Animatable(0f) }
    var drag by remember { mutableFloatStateOf(0f) }
    val reduceMotion = rememberReduceMotion()
    LaunchedEffect(visible) {
        if (visible) {
            mounted = true
            drag = 0f
            progress.animateTo(1f, tween(if (reduceMotion) 150 else 280, easing = SheetEnter))
        } else if (mounted) {
            progress.animateTo(0f, tween(BBMotion.durationSheetExit, easing = BBMotion.easingIn))
            mounted = false
        }
    }
    if (!mounted) return
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false),
    ) {
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect {
            window?.setDimAmount(0f)
            window?.setWindowAnimations(0)
        }
        val density = LocalDensity.current
        val scope = rememberCoroutineScope()
        // The dialog is edge to edge: lift the sheet above the keyboard (iOS sheets move with it).
        BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
            val screenPx = with(density) { maxHeight.toPx() }
            Box(
                Modifier.fillMaxSize()
                    .background(scrim.copy(alpha = scrim.alpha * progress.value))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
            )
            val shape = RoundedCornerShape(topStart = BBRadius.xl, topEnd = BBRadius.xl)
            val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
            Column(
                Modifier.align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .heightIn(max = maxHeight * BBLayout.sheetMaxHeightFraction.toFloat())
                    .offset { IntOffset(0, ((1f - progress.value) * screenPx + drag).roundToInt()) }
                    .bbShadow(BBShadow.lg, shape)
                    .background(c.popover, shape)
                    .border(1.dp, c.alphaForeground10, shape)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .draggable(
                        orientation = Orientation.Vertical,
                        state = rememberDraggableState { dy -> drag = (drag + dy).coerceAtLeast(0f) },
                        onDragStopped = { velocity ->
                            val dpPerMs = with(density) { velocity.toDp().value } / 1000f
                            if (with(density) { drag.toDp() } > BBLayout.sheetCloseDistance || dpPerMs > BBLayout.sheetCloseVelocity) {
                                onDismiss()
                            } else {
                                scope.launch {
                                    val anim = Animatable(drag)
                                    anim.animateTo(0f, BBMotion.springSheetSnapBack.spec()) { drag = value }
                                }
                            }
                        },
                    ),
            ) {
                // Handle: 36×4 capsule 10 from the top inside a 28 dp strip.
                Box(Modifier.fillMaxWidth().height(28.dp), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.padding(top = 10.dp).size(36.dp, 4.dp).background(c.border, CircleShape))
                }
                Column(
                    Modifier.verticalScroll(rememberScrollState())
                        .padding(start = BBSpacing.space4, end = BBSpacing.space4, bottom = max(BBSpacing.space5, bottomInset))
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space4),
                    content = content,
                )
            }
        }
    }
}

// ---------------------------------------------------------------- Toasts

enum class BBToastKind { Plain, Success, Info, Warning, Error, Loading }

data class BBToast(
    val kind: BBToastKind,
    val message: String,
    val actionLabel: String? = null,
    val onAction: (() -> Unit)? = null,
    /** Runs when the toast goes away without its action (timeout, swipe, pushed out of the stack). */
    val onDismiss: (() -> Unit)? = null,
    val durationMs: Long = 4000,
    val id: String = UUID.randomUUID().toString(),
)

/**
 * One global queue of toasts (sonner): bottom-center, auto-dismiss 4 s, at most 3 visible, swipe to dismiss,
 * optional action. Same API on iOS (`ToastCenter.show`).
 */
class ToastCenter {
    val toasts = mutableStateListOf<BBToast>()
    /** Set by the app: the `Segnala` action of error toasts (`showError`, SUP-023) and its label in the account language. */
    var reportAction: ((io.buddybudget.core.domain.support.ReportError) -> Unit)? = null
    var reportLabel: () -> String = { "" }
    private val scope = MainScope()

    fun show(
        kind: BBToastKind,
        message: String,
        actionLabel: String? = null,
        onAction: (() -> Unit)? = null,
        onDismiss: (() -> Unit)? = null,
        durationMs: Long = 4000,
    ) {
        val toast = BBToast(kind, message, actionLabel, onAction, onDismiss, durationMs)
        toasts += toast
        while (toasts.size > MAX_VISIBLE) dismiss(toasts.first().id)
        if (kind != BBToastKind.Loading) scope.launch {
            delay(durationMs)
            dismiss(toast.id)
        }
    }

    /**
     * Delete with Undo (decision 0003): the caller already removed the item locally. [onUndo] restores it;
     * [onCommit] (after 5 s, a swipe, or when pushed out) sends the API call.
     */
    fun showUndo(message: String, undoLabel: String, onUndo: () -> Unit, onCommit: () -> Unit) =
        show(BBToastKind.Plain, message, undoLabel, onUndo, onCommit, 5000)

    fun dismiss(id: String) {
        val index = toasts.indexOfFirst { it.id == id }
        if (index < 0) return
        toasts.removeAt(index).onDismiss?.invoke()
    }

    fun performAction(id: String) {
        val index = toasts.indexOfFirst { it.id == id }
        if (index < 0) return
        toasts.removeAt(index).onAction?.invoke()
    }

    companion object {
        const val MAX_VISIBLE = 3
    }
}

/** Hosts the toast stack above [content] (put it at the app root). */
@Composable
fun BBToastHost(center: ToastCenter, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize()) {
        content()
        Column(
            Modifier.align(Alignment.BottomCenter).navigationBarsPadding()
                .padding(start = BBSpacing.space4, end = BBSpacing.space4, bottom = BBSpacing.space4),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            for (toast in center.toasts) {
                androidx.compose.runtime.key(toast.id) {
                    var shown by remember { mutableStateOf(false) }
                    LaunchedEffect(Unit) { shown = true }
                    AnimatedVisibility(shown, enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut()) {
                        BBToastView(toast, onAction = { center.performAction(toast.id) }, onClose = { center.dismiss(toast.id) })
                    }
                }
            }
        }
    }
}

/** Toast card: `--popover`, 1 dp `--border`, radius lg, padding 16, icon 16, text-sm; action = default sm button. */
@Composable
fun BBToastView(toast: BBToast, onAction: () -> Unit = {}, onClose: () -> Unit = {}) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.lg)
    var dx by remember { mutableFloatStateOf(0f) }
    var dy by remember { mutableFloatStateOf(0f) }
    val density = LocalDensity.current
    Row(
        Modifier.fillMaxWidth()
            .offset { IntOffset(dx.roundToInt(), dy.coerceAtLeast(0f).roundToInt()) }
            .pointerInput(toast.id) {
                detectDragGestures(onDragEnd = {
                    val far = with(density) { abs(dx).toDp() > 80.dp || dy.toDp() > 40.dp }
                    if (far) onClose()
                    dx = 0f
                    dy = 0f
                }) { change, amount ->
                    change.consume()
                    dx += amount.x
                    dy += amount.y
                }
            }
            .heightIn(min = 52.dp)
            .bbShadow(BBShadow.lg, shape)
            .background(c.popover, shape)
            .border(1.dp, c.border, shape)
            .padding(horizontal = BBSpacing.space4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        val fg = c.popoverForeground
        when (toast.kind) {
            BBToastKind.Plain -> Unit
            BBToastKind.Success -> BBIconView(BBIcon.CircleCheck, color = fg)
            BBToastKind.Info -> BBIconView(BBIcon.Info, color = fg)
            BBToastKind.Warning -> BBIconView(BBIcon.TriangleAlert, color = fg)
            BBToastKind.Error -> BBIconView(BBIcon.OctagonX, color = fg)
            BBToastKind.Loading -> BBSpinner(color = fg)
        }
        BBText(toast.message, Modifier.weight(1f), BBTextStyle.Body.style, color = fg)
        if (toast.actionLabel != null) BBButton(toast.actionLabel, onAction, size = BBButtonSize.Sm)
    }
}
