package io.buddybudget.app.designsystem.components

import android.os.Build
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.core.designsystem.AmountDisplay
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPathCommand
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.ChartPoint
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.designsystem.DonutGeometry
import io.buddybudget.core.designsystem.SparklineGeometry
import io.buddybudget.core.domain.format.BBFormat
import kotlin.math.abs
import kotlin.math.roundToInt

// Data viz basics (spec: design/charts.md §0–1, §2.1, §2.3, §3, §4; components.md §3.1, §3.8). Geometry, scales and
// gesture math come from :core (`ChartPaths`, `ChartScale`, `DonutGeometry`), shared with iOS. Custom Canvas
// chart kit (charts.md §5 recommendation for Android).

/** Builds a Compose path from the shared chart commands (screen coordinates, clockwise-positive arcs). */
fun chartPath(commands: List<ChartPathCommand>, scale: Float = 1f): Path = Path().apply {
    fun x(v: Double) = (v * scale).toFloat()
    for (cmd in commands) when (cmd) {
        is ChartPathCommand.Move -> moveTo(x(cmd.p.x), x(cmd.p.y))
        is ChartPathCommand.Line -> lineTo(x(cmd.p.x), x(cmd.p.y))
        is ChartPathCommand.Cubic -> cubicTo(x(cmd.c1.x), x(cmd.c1.y), x(cmd.c2.x), x(cmd.c2.y), x(cmd.to.x), x(cmd.to.y))
        is ChartPathCommand.Arc -> arcTo(
            Rect(Offset(x(cmd.center.x), x(cmd.center.y)), x(cmd.radius)),
            cmd.startDegrees.toFloat(), cmd.sweepDegrees.toFloat(), false,
        )
        ChartPathCommand.Close -> close()
    }
}

/** Privacy mode for charts (§0 rule 2): blur 10 and no interaction; Android < 12 draws a `--muted` placeholder. */
@Composable
private fun ChartPrivacy(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val hide = LocalHideAmounts.current
    if (hide && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        Box(modifier.background(BuddyBudgetTheme.colors.muted, RoundedCornerShape(BBRadius.xl)))
    } else {
        Box(modifier.then(if (hide) Modifier.blur(10.dp) else Modifier)) { content() }
    }
}

// ---------------------------------------------------------------- StatCard

/**
 * Canonical `StatCard` (§3.1): card, overline label, value font-heading text-3xl tabular 0 decimals colored by tone
 * (`Auto`: negative → `--neg`, else `--pos`), optional subtitle 4 dp below.
 */
@Composable
fun StatCard(
    label: String,
    value: Double,
    currency: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    tone: AmountTone = AmountTone.Auto,
    valueOverride: (@Composable () -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    BBCard(modifier) {
        Column {
            BBText(label, BBTextStyle.Overline, Modifier.padding(bottom = BBSpacing.space2), color = c.mutedForeground)
            if (valueOverride != null) {
                androidx.compose.material3.ProvideTextStyle(
                    BBTextStyle.StatValue.style.copy(color = AmountDisplay.role(value, tone).color(c)),
                ) { valueOverride() }
            } else {
                AmountText(value, currency, tone = tone, maximumFractionDigits = 0, style = BBTextStyle.StatValue.style)
            }
            if (subtitle != null) BBText(subtitle, BBTextStyle.Body, Modifier.padding(top = BBSpacing.space1), color = c.mutedForeground)
        }
    }
}

// ---------------------------------------------------------------- ProgressBar

sealed interface BBProgressState {
    data object None : BBProgressState
    data object Indeterminate : BBProgressState
    data class Determinate(val value: Double, val max: Double) : BBProgressState
}

/**
 * 6 dp bar, radius full, track `--muted`, fill `--primary` (width animates 300 ms); indeterminate = full bar
 * `--primary @ 50%` pulsing (§3.8).
 */
@Composable
fun ProgressBar(state: BBProgressState, modifier: Modifier = Modifier, label: String = "", color: Color = BuddyBudgetTheme.colors.primary) {
    val c = BuddyBudgetTheme.colors
    val fraction = (state as? BBProgressState.Determinate)?.let { if (it.max > 0) (it.value / it.max).coerceIn(0.0, 1.0).toFloat() else 0f } ?: 0f
    val animated by animateFloatAsState(fraction, tween(BBMotion.durationSlow), label = "progress")
    Box(
        modifier.fillMaxWidth().height(6.dp).background(c.muted, CircleShape).semantics {
            contentDescription = label
            if (state is BBProgressState.Determinate) stateDescription = "${(fraction * 100).roundToInt()}%"
        },
    ) {
        when (state) {
            BBProgressState.None -> Unit
            BBProgressState.Indeterminate -> {
                val a by rememberInfiniteTransition(label = "pulse").animateFloat(
                    1f, 0.5f, infiniteRepeatable(tween(1000, easing = androidx.compose.animation.core.CubicBezierEasing(0.4f, 0f, 0.6f, 1f)), RepeatMode.Reverse), label = "a",
                )
                Box(Modifier.fillMaxSize().alpha(a).background(color.copy(alpha = 0.5f), CircleShape))
            }
            is BBProgressState.Determinate -> Box(Modifier.fillMaxWidth(animated).height(6.dp).background(color, CircleShape))
        }
    }
}

// ---------------------------------------------------------------- Sparkline

/** 84×30 `smoothPath`, stroke 2 round cap, default `--swatch-teal`; fewer than 2 values → nothing (§3). */
@Composable
fun Sparkline(values: List<Double>, modifier: Modifier = Modifier, width: Dp = 84.dp, height: Dp = 30.dp, color: Color = BuddyBudgetTheme.colors.swatchTeal) {
    val points = SparklineGeometry.points(values, width.value.toDouble(), height.value.toDouble())
    // SHELL-052 (web #448): an account's trend is the user's money too, obscured while amounts are hidden.
    ChartPrivacy(modifier.size(width, height)) {
        Canvas(Modifier.size(width, height).clearAndSetSemantics {}) {
            if (points.isEmpty()) return@Canvas
            drawPath(chartPath(ChartPaths.line(points, ChartCurve.Smooth), density), color, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
        }
    }
}

// ---------------------------------------------------------------- BBLineChart

data class BBChartPoint(val id: Int, val label: String, val value: Double)

/**
 * Hero line/area chart (net worth "Totale", portfolio): hidden axes, Y domain `[min×0.9, max×1.01]`, margin top 8,
 * stroke 2 + gradient 0.30 → 0, no entry animation. Touch: crosshair (1 dp `--border`), active dot r 4 with a 2 dp
 * `--background` ring and a tooltip pinned at the top, clamped to 14–86 % of the width; horizontal drag scrubs,
 * vertical drag scrolls the page, lift hides (charts.md §1). Privacy: blurred and inert.
 */
@Composable
fun BBLineChart(
    points: List<BBChartPoint>,
    accessibilitySummary: String,
    formatValue: (Double) -> String,
    selection: Int?,
    onSelectionChange: (Int?) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 240.dp,
    color: Color = BuddyBudgetTheme.colors.primary,
    curve: ChartCurve = ChartCurve.Monotone,
    showsArea: Boolean = true,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val dens = LocalDensity.current
    val scale = dens.density
    val domain = ChartScale.heroDomain(points.map { it.value })
    val active = if (hide) null else selection?.let { points.getOrNull(it) }
    BoxWithConstraints(modifier.fillMaxWidth().height(height).semantics { contentDescription = accessibilitySummary }) {
        val widthDp = maxWidth.value.toDouble()
        val top = 8.0
        val plotH = height.value.toDouble() - top
        val geo = points.mapIndexed { i, p -> ChartPoint(ChartScale.x(i, points.size, 0.0, widthDp), ChartScale.y(p.value, domain, top, plotH)) }
        ChartPrivacy(Modifier.fillMaxSize()) {
            Canvas(
                Modifier.fillMaxSize().pointerInput(points.size, hide) {
                    if (hide) return@pointerInput
                    val slop = viewConfiguration.touchSlop
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        val w = size.width.toDouble()
                        onSelectionChange(ChartScale.scrubIndex(down.position.x.toDouble(), w, points.size))
                        var horizontal: Boolean? = null
                        var total = Offset.Zero
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (!change.pressed) break
                            if (change.isConsumed) break // a parent scroll took over
                            total += change.positionChange()
                            if (horizontal == null && (abs(total.x) > slop || abs(total.y) > slop)) horizontal = abs(total.x) >= abs(total.y)
                            if (horizontal == false) break
                            if (horizontal == true) change.consume()
                            onSelectionChange(ChartScale.scrubIndex(change.position.x.toDouble(), w, points.size))
                        }
                        onSelectionChange(null)
                    }
                },
            ) {
                if (geo.isEmpty()) return@Canvas
                val baseline = top + plotH
                if (showsArea) {
                    val minY = geo.minOf { it.y }
                    drawPath(
                        chartPath(ChartPaths.area(geo, curve, baseline), scale),
                        color.copy(alpha = 0.12f),
                    )
                }
                drawPath(
                    chartPath(ChartPaths.line(geo, curve), scale), color,
                    style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
                if (active != null) {
                    val p = geo[active.id]
                    val x = (p.x * scale).toFloat()
                    drawLine(c.border, Offset(x, (top * scale).toFloat()), Offset(x, size.height), 1.dp.toPx())
                    val center = Offset(x, (p.y * scale).toFloat())
                    drawCircle(c.background, 5.dp.toPx(), center)
                    drawCircle(color, 3.dp.toPx(), center)
                }
            }
        }
        if (active != null) {
            var tipWidth by remember { mutableIntStateOf(0) }
            val centerPx = with(dens) { ChartScale.tooltipCenterX(geo[active.id].x, widthDp).dp.toPx() }
            Column(
                Modifier.offset { IntOffset((centerPx - tipWidth / 2f).roundToInt(), 0) }
                    .onSizeChanged { tipWidth = it.width }
                    .widthIn(min = 128.dp)
                    .bbShadow(BBShadow.xl, RoundedCornerShape(BBRadius.lg))
                    .background(c.background, RoundedCornerShape(BBRadius.lg))
                    .border(1.dp, c.alphaBorder50, RoundedCornerShape(BBRadius.lg))
                    .padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space1_5),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
            ) {
                BBText(active.label, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                BBText(formatValue(active.value), style = BBStyles.tooltipValue, color = c.foreground, maxLines = 1)
            }
        }
    }
}

// ---------------------------------------------------------------- BBDonut

data class BBDonutSlice(val id: Int, val label: String, val value: Double, val color: Color)

/**
 * Donut (`CategoryDonut` / composition, charts.md §2.2–2.3): custom path on both platforms, Recharts geometry —
 * start at 3 o'clock, counter-clockwise, paddingAngle 2°, cornerRadius 4, no stroke. Tap locks a slice (others at
 * 0.35 opacity) and the center shows its name, amount and share; tap it again or outside the ring to unlock.
 */
@Composable
fun BBDonut(
    slices: List<BBDonutSlice>,
    currency: String,
    selection: Int?,
    onSelectionChange: (Int?) -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 192.dp,
    centerLabel: String = "",
    accessibilitySummary: String = "",
    /** Custom center for the focused slice index (null = nothing focused); replaces the default total / slice summary. */
    centerContent: (@Composable (Int?) -> Unit)? = null,
    /** Explicit radii (composition donut: 62 / 90 at 192, charts.md §2.2); default `CategoryDonut` proportions. */
    innerRadius: Dp? = null,
    outerRadius: Dp? = null,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val locale = LocalBBLocale.current
    val outer = outerRadius?.value?.toDouble() ?: (size.value * 0.5 * 0.9)
    val inner = innerRadius?.value?.toDouble() ?: (size.value * 0.69 * 0.5)
    val angles = DonutGeometry.slices(slices.map { it.value }, paddingAngle = 2.0)
    val focused = if (hide) null else selection
    val currentSelection = selection
    val cxDp = size.value / 2.0
    Box(
        modifier.size(size)
            .semantics { contentDescription = accessibilitySummary }
            .pointerInput(slices, hide, currentSelection) {
                detectTapGestures { pos ->
                    if (hide) return@detectTapGestures
                    val hit = DonutGeometry.hitTest(pos.x / density.toDouble(), pos.y / density.toDouble(), cxDp, cxDp, inner, outer, angles)
                    onSelectionChange(if (hit == null || hit == currentSelection) null else hit)
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        ChartPrivacy(Modifier.fillMaxSize()) {
            Canvas(Modifier.fillMaxSize()) {
                val cx = cxDp
                slices.forEachIndexed { i, slice ->
                    val a = angles.getOrNull(i) ?: return@forEachIndexed
                    val path = chartPath(DonutGeometry.sectorPath(cx, cx, inner, outer, a.startAngle, a.endAngle, 4.0), density)
                    val dim = focused != null && focused != i
                    drawPath(path, slice.color.copy(alpha = slice.color.alpha * if (dim) 0.35f else 1f))
                }
            }
        }
        val total = slices.sumOf { maxOf(0.0, it.value) }
        if (centerContent != null) {
            Box(Modifier.width((inner * 2 - 16).dp), contentAlignment = Alignment.Center) { centerContent(focused) }
        } else Column(Modifier.width((inner * 2 - 16).dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val f = focused?.let { slices.getOrNull(it) }
            if (f != null) {
                BBText(f.label, style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text2, maxLines = 1)
                AmountText(f.value, currency, maximumFractionDigits = 0, style = BBStyles.amountMedium)
                BBText(
                    BBFormat.formatPct(if (total > 0) f.value / total else 0.0, locale),
                    style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text2,
                )
            } else {
                AmountText(total, currency, maximumFractionDigits = 0, style = BBStyles.amountMedium)
                if (centerLabel.isNotEmpty()) BBText(centerLabel, style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text2, maxLines = 1)
            }
        }
    }
}
