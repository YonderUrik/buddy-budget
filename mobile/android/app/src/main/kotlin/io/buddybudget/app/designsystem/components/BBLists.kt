package io.buddybudget.app.designsystem.components

import android.graphics.BitmapFactory
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.designsystem.MerchantInitial
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

// Lists, states and logos (spec: design/components.md §3.7–3.9, decisions/0003). iOS: BBLists.swift.

/**
 * Standard row (MovementRow geometry, §3.9): min height 60, gap 14, padding 6×10; leading avatar (36),
 * title (font-semibold, 1 line) + subtitle (text-sm `--text-2`), trailing slot (amount) and optional chevron.
 */
@Composable
fun BBListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    subtitleColor: Color = BuddyBudgetTheme.colors.text2,
    showsChevron: Boolean = false,
    onClick: (() -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    Row(
        modifier.fillMaxWidth()
            .bbPressable(onClick, RoundedCornerShape(BBRadius.xl), pressedBackground = c.alphaMuted50, translate = false)
            .heightIn(min = 60.dp)
            .padding(horizontal = BBSpacing.space1_5, vertical = BBSpacing.space2_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
    ) {
        leading?.invoke()
        Column(Modifier.weight(1f)) {
            BBText(title, style = BBStyles.rowTitle, maxLines = 1)
            if (subtitle != null) BBText(subtitle, BBTextStyle.Body, color = subtitleColor, maxLines = 1)
        }
        trailing?.invoke(this)
        if (showsChevron) BBIconView(BBIcon.ChevronRight, color = c.text3)
    }
}

/** Category/account avatar: 36 circle, swatch color @ 16 % fill, icon 16 in the swatch color (§3.7). */
@Composable
fun BBAvatar(icon: BBIcon, color: Color = BuddyBudgetTheme.colors.swatchSlate) = BBIconBadge(icon, color, 36.dp, 16.dp)

/**
 * Swipe left to delete, for lists where the web deletes immediately. The row slides out and [onDelete] runs; the
 * caller removes the item locally and shows `ToastCenter.showUndo` (5 s) before sending the API call.
 * Threshold: 40 % of the width, or a fast fling. Only horizontal drags are captured; vertical scrolling still works.
 */
@Composable
fun BBSwipeToDelete(
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    deleteLabel: String = l10n(R.string.delete_6b177b),
    previewFraction: Float = 0f,
    content: @Composable () -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val scope = rememberCoroutineScope()
    var width by remember { mutableFloatStateOf(0f) }
    val offset = remember { Animatable(0f) }
    LaunchedEffect(width, previewFraction) { if (previewFraction > 0 && width > 0) offset.snapTo(-previewFraction * width) }
    Box(
        modifier.fillMaxWidth()
            .onSizeChanged { width = it.width.toFloat() }
            .clipToBounds()
            .semantics { customActions = listOf(CustomAccessibilityAction(deleteLabel) { onDelete(); true }) }
            .pointerInput(Unit) {
                val tracker = VelocityTracker()
                detectHorizontalDragGestures(
                    onDragStart = { tracker.resetTracking() },
                    onDragEnd = {
                        val velocity = tracker.calculateVelocity().x
                        val fling = offset.value + velocity * 0.2f < -width * 0.8f
                        scope.launch {
                            if (-offset.value > width * 0.4f || fling) {
                                offset.animateTo(-width, tween(BBMotion.durationSheetExit, easing = BBMotion.easingIn))
                                onDelete()
                                offset.snapTo(0f)
                            } else {
                                offset.animateTo(0f, BBMotion.springSheetSnapBack.spec())
                            }
                        }
                    },
                    onDragCancel = { scope.launch { offset.animateTo(0f, BBMotion.springSheetSnapBack.spec()) } },
                ) { change, dx ->
                    change.consume()
                    tracker.addPosition(change.uptimeMillis, change.position)
                    scope.launch { offset.snapTo((offset.value + dx).coerceAtMost(0f)) }
                }
            },
    ) {
        Box(
            Modifier.matchParentSize()
                .alpha(if (offset.value < 0) 1f else 0f)
                .background(if (dark) c.alphaDestructive20 else c.alphaDestructive10, RoundedCornerShape(BBRadius.xl))
                .padding(end = BBSpacing.space5),
            contentAlignment = Alignment.CenterEnd,
        ) { BBIconView(BBIcon.Trash2, size = BBIconSize.Lg.dp, color = c.destructive) }
        Box(Modifier.offset { IntOffset(offset.value.roundToInt(), 0) }.background(c.background)) { content() }
    }
}

/** An EmptyState / error action. */
data class BBStateAction(val label: String, val onClick: () -> Unit)

enum class BBStateAlign { Start, Center }

/**
 * No card around it: 44 circle with a tinted icon 20, title (font-heading text-xl), description (text-sm
 * `--text-2`, max 448), actions 44 high (primary = default, secondary = ghost) (§3.8).
 */
@Composable
fun EmptyState(
    icon: BBIcon,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    primary: BBStateAction? = null,
    secondary: BBStateAction? = null,
    color: Color = BuddyBudgetTheme.colors.swatchTeal,
    align: BBStateAlign = BBStateAlign.Start,
) {
    val c = BuddyBudgetTheme.colors
    val center = align == BBStateAlign.Center
    val h = if (center) Alignment.CenterHorizontally else Alignment.Start
    val textAlign = if (center) TextAlign.Center else TextAlign.Start
    Column(
        modifier.fillMaxWidth().padding(vertical = BBSpacing.space2),
        horizontalAlignment = h,
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBIconBadge(icon, color, 44.dp, 20.dp)
        Column(Modifier.widthIn(max = 448.dp), horizontalAlignment = h, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(title, style = BBTextStyle.SectionTitle.style.copy(textAlign = textAlign))
            BBText(description, style = BBTextStyle.Body.style.copy(textAlign = textAlign), color = c.text2)
        }
        if (primary != null || secondary != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                if (primary != null) BBButton(primary.label, primary.onClick, size = BBButtonSize.Touch)
                if (secondary != null) BBButton(secondary.label, secondary.onClick, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch)
            }
        }
    }
}

/**
 * Alert box: radius xl, 1 dp `--destructive @ 30%`, fill `--destructive @ 5%`, text-sm `--destructive`, then
 * `Segnala questo problema` (inside the signed-in shell) and an outline sm "Riprova" button (§3.8, web `LoadError`).
 */
@Composable
fun LoadError(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    /** Operation attached when the user reports the error (default: loading the page). */
    reportArea: io.buddybudget.core.domain.support.ReportErrorArea = io.buddybudget.core.domain.support.ReportErrorArea.Caricamento,
) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    val box = modifier.fillMaxWidth()
        .background(c.destructive.copy(alpha = 0.05f), shape)
        .border(1.dp, c.destructive.copy(alpha = 0.3f), shape)
        .padding(BBSpacing.space4)
    if (io.buddybudget.app.features.help.LocalQuickReport.current == null) {
        Row(box, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(message, Modifier.weight(1f), BBTextStyle.Body.style, color = c.destructive)
            BBButton(l10n(L10n.retry), onRetry, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
    } else {
        Column(box, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(message, Modifier.fillMaxWidth(), BBTextStyle.Body.style, color = c.destructive)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                io.buddybudget.app.features.help.ReportErrorLink(reportArea, message)
                BBButton(l10n(L10n.retry), onRetry, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
            }
        }
    }
}

/** Full-page error for unrecoverable screen errors: title, description, error code (server request id), retry. */
@Composable
fun PageError(title: String, description: String, onRetry: () -> Unit, modifier: Modifier = Modifier, code: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBText(title, style = BBStyles.screenTitle)
        BBText(description, BBTextStyle.Body, color = c.text2)
        if (code != null) BBText(code, BBTextStyle.Mono, color = c.text3)
        BBButton(l10n(L10n.retry), onRetry, size = BBButtonSize.Touch)
    }
}

/** `--muted` block pulsing opacity 1 → 0.5 → 1 over 2 s (`animate-pulse`); no shimmer gradient (§3.8). */
@Composable
fun BBSkeleton(modifier: Modifier = Modifier, width: Dp? = null, height: Dp, radius: Dp = BBRadius.md) {
    val c = BuddyBudgetTheme.colors
    val reduce = rememberReduceMotion()
    val pulse = rememberInfiniteTransition(label = "pulse").animateFloat(
        1f, if (reduce) 1f else 0.5f,
        infiniteRepeatable(tween(1000, easing = androidx.compose.animation.core.CubicBezierEasing(0.4f, 0f, 0.6f, 1f)), RepeatMode.Reverse),
        label = "alpha",
    )
    Box(
        modifier.then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .height(height)
            // Read in the draw layer: the pulse redraws the block without recomposing it every frame.
            .graphicsLayer { alpha = pulse.value }
            .background(c.muted, RoundedCornerShape(radius)),
    )
}

/** Skeleton of [rows] list rows with the exact `BBListRow` geometry (avatar 36, two lines, trailing amount). */
@Composable
fun BBSkeletonRows(rows: Int = 4) {
    val loading = l10n(L10n.loading)
    Column(Modifier.clearAndSetSemantics { contentDescription = loading }) {
        repeat(rows) {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 60.dp).padding(horizontal = BBSpacing.space1_5, vertical = BBSpacing.space2_5),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
            ) {
                BBSkeleton(width = 36.dp, height = 36.dp, radius = 18.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    BBSkeleton(width = 140.dp, height = 16.dp)
                    BBSkeleton(width = 96.dp, height = 12.dp)
                }
                BBSkeleton(width = 64.dp, height = 16.dp)
            }
        }
    }
}

/** Generic page skeleton (§3.8): title 32×192, subtitle 16×288, hero block 176, two 256 blocks. */
@Composable
fun BBPageSkeleton() {
    val loading = l10n(L10n.loading)
    Column(Modifier.clearAndSetSemantics { contentDescription = loading }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBSkeleton(width = 192.dp, height = 32.dp)
        BBSkeleton(width = 288.dp, height = 16.dp)
        BBSkeleton(height = 176.dp, radius = BBRadius.xl)
        BBSkeleton(height = 256.dp, radius = BBRadius.xl)
        BBSkeleton(height = 256.dp, radius = BBRadius.xl)
    }
}

enum class MerchantLogoSize(val diameter: Dp, val inset: Dp, val textSize: Int, val lineHeight: Int) {
    Sm(36.dp, 6.dp, 14, 20), Md(44.dp, 8.dp, 16, 24), Lg(56.dp, 10.dp, 20, 28),
}

/**
 * Merchant/bank logo (§3.7): circle; while loading or without a logo, the initial (or [fallback] icon) on
 * `--foreground @ 6%` in `--text-2`; once loaded, a white tile in both themes with a 1 dp `--border` ring.
 * Images come from `LogoLoader` (authenticated, cached). Decorative: the name is always written next to it.
 */
@Composable
fun MerchantLogo(
    name: String,
    modifier: Modifier = Modifier,
    logoPath: String? = null,
    size: MerchantLogoSize = MerchantLogoSize.Sm,
    fallback: BBIcon? = null,
    onRemoteLogo: (() -> Unit)? = null,
    /** Coloured-initial fallback (subscriptions): the initial in this color on the color @ 16 % instead of the neutral tile. */
    initialColor: Color? = null,
    /** A whole view shown instead of the initial while loading or without a logo (the movement's category avatar, web
     *  `fallback={categoryAvatar(…)}`). */
    fallbackView: (@Composable () -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    val loader = LocalLogoLoader.current
    var image by remember(logoPath) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(logoPath, loader) {
        if (logoPath == null || loader == null) return@LaunchedEffect
        val bytes = loader.data(logoPath) ?: return@LaunchedEffect
        val decoded = withContext(Dispatchers.Default) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }
        if (decoded != null) {
            image = decoded
            onRemoteLogo?.invoke()
        }
    }
    Box(modifier.size(size.diameter).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
        val img = image
        if (img != null) {
            Box(Modifier.matchParentSize().background(Color.White, CircleShape))
            Image(img, null, Modifier.matchParentSize().padding(size.inset).clip(CircleShape), contentScale = ContentScale.Fit)
            Box(Modifier.matchParentSize().border(1.dp, c.border, CircleShape))
        } else if (fallbackView != null) {
            fallbackView()
        } else {
            Box(Modifier.matchParentSize().background(initialColor?.copy(alpha = 0.16f) ?: c.foreground.copy(alpha = 0.06f), CircleShape))
            if (fallback != null) {
                BBIconView(fallback, color = initialColor ?: c.text2)
            } else {
                BBText(
                    MerchantInitial.of(name),
                    style = TextStyle(
                        fontFamily = BBFontFamilies.sans,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.W600,
                        fontSize = size.textSize.sp,
                        lineHeight = size.lineHeight.sp,
                    ),
                    color = initialColor ?: c.text2,
                )
            }
        }
    }
}

/** "Loghi forniti da Logo.dev" under any list that showed a remote logo (Logo.dev free-plan condition). */
@Composable
fun LogoCredit() {
    val uri = LocalUriHandler.current
    BBText(
        "${l10n(R.string.logos_provided_by_131210)} Logo.dev",
        Modifier.bbPressable({ uri.openUri("https://logo.dev") }, RoundedCornerShape(BBRadius.md), translate = false),
        BBTextStyle.Caption.style,
        color = BuddyBudgetTheme.colors.mutedForeground,
    )
}

/**
 * A row on a soft fill instead of a rule or a box (web `SoftRow`, #417/#427): radius 2xl, `--foreground @ 4%`,
 * min height 56, padding 12×16, title semibold, optional hint (text-sm `--text-2`), optional leading and trailing.
 */
@Composable
fun BBSoftRow(
    title: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: @Composable () -> Unit = {},
) {
    val c = BuddyBudgetTheme.colors
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp)
            .background(c.foreground.copy(alpha = 0.04f), RoundedCornerShape(BBRadius.radius2xl))
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
    ) {
        leading?.invoke()
        Column(Modifier.weight(1f)) {
            BBText(title, style = io.buddybudget.app.designsystem.generated.BBTextStyle.BodyLarge.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600))
            if (hint != null) BBText(hint, io.buddybudget.app.designsystem.generated.BBTextStyle.Body, color = c.text2)
        }
        trailing()
    }
}
