package io.buddybudget.app.features.analytics

import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbShadow
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.domain.analytics.AnalyticsRules
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Analitiche charts (design/charts.md §2.8): horizontal grid at 0.3 opacity, hidden Y axis, linear curves, X labels
// thinned with `minTickGap` (last kept), pinned popover tooltip on scrub. Custom Canvas on both platforms with the same
// geometry (iOS: AnalyticsCharts.swift).

/** A line (optionally filled down to the domain bottom). */
data class AnalyticsLine(
    val id: String,
    val values: List<Double?>,
    val color: Color,
    val width: Dp = 2.dp,
    val dash: List<Float> = emptyList(),
    val fill: Float? = null,
)

/** A band between two series (Monte Carlo percentiles). */
data class AnalyticsBand(val id: String, val lower: List<Double>, val upper: List<Double>, val color: Color, val opacity: Float)

/** Horizontal reference line with a label inside the top-left (FIRE number). */
data class AnalyticsReference(val value: Double, val color: Color, val label: String)

private const val PLOT_TOP = 5.0
private const val PLOT_SIDE = 5.0
private const val AXIS_HEIGHT = 24.0

@Composable
private fun Scrub(count: Int, enabled: Boolean, plotLeft: Double, plotWidth: Double, indexOf: (Double) -> Int, onSelection: (Int?) -> Unit): Modifier =
    Modifier.pointerInput(count, enabled, plotWidth) {
        if (!enabled) return@pointerInput
        val slop = viewConfiguration.touchSlop
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            var horizontal: Boolean? = null
            var total = Offset.Zero
            while (true) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                if (!change.pressed) break
                total += change.positionChange()
                if (horizontal == null && (abs(total.x) > slop || abs(total.y) > slop)) horizontal = abs(total.x) >= abs(total.y)
                if (horizontal == false) break
                if (horizontal == true) {
                    change.consume()
                    onSelection(indexOf(change.position.x / density - plotLeft))
                }
            }
            onSelection(null)
        }
    }

@Composable
fun AnalyticsChart(
    count: Int,
    domain: ClosedFloatingPointRange<Double>,
    xLabels: List<String>,
    accessibilitySummary: String,
    lines: List<AnalyticsLine> = emptyList(),
    bands: List<AnalyticsBand> = emptyList(),
    reference: AnalyticsReference? = null,
    height: Dp = 224.dp,
    minTickGap: Double = 24.0,
    tooltip: @Composable ColumnScope.(Int) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val dens = LocalDensity.current
    var selection by remember { mutableStateOf<Int?>(null) }
    val active = if (hide) null else selection?.takeIf { it in 0 until count }
    BoxWithConstraints(Modifier.fillMaxWidth().height(height).semantics { contentDescription = accessibilitySummary }) {
        val w = maxWidth.value.toDouble()
        val plotW = max(1.0, w - PLOT_SIDE * 2)
        val plotH = max(1.0, height.value - PLOT_TOP - PLOT_SIDE - AXIS_HEIGHT)
        fun x(i: Int) = PLOT_SIDE + ChartScale.x(i, count, 0.0, plotW)
        fun y(v: Double) = ChartScale.y(v, domain, PLOT_TOP, plotH)
        val blurred = hide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        Canvas(
            Modifier.fillMaxSize().then(if (blurred) Modifier.blur(10.dp) else Modifier)
                .then(Scrub(count, !hide, PLOT_SIDE, plotW, { px -> ChartScale.scrubIndex(px, plotW, count) }) { selection = it }),
        ) {
            val s = dens.density
            fun o(xx: Double, yy: Double) = Offset((xx * s).toFloat(), (yy * s).toFloat())
            for (g in AnalyticsRules.gridLines(domain)) {
                drawLine(c.border.copy(alpha = 0.5f * 0.3f), o(PLOT_SIDE, y(g)), o(PLOT_SIDE + plotW, y(g)), 1.dp.toPx())
            }
            for (band in bands) {
                val n = min(count, min(band.upper.size, band.lower.size))
                if (n == 0) continue
                val p = Path()
                for (i in 0 until n) { val pt = o(x(i), y(band.upper[i])); if (i == 0) p.moveTo(pt.x, pt.y) else p.lineTo(pt.x, pt.y) }
                for (i in n - 1 downTo 0) { val pt = o(x(i), y(band.lower[i])); p.lineTo(pt.x, pt.y) }
                p.close()
                drawPath(p, band.color.copy(alpha = band.opacity))
            }
            if (reference != null) {
                drawLine(reference.color, o(PLOT_SIDE, y(reference.value)), o(PLOT_SIDE + plotW, y(reference.value)), 1.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())))
            }
            for (line in lines) {
                val p = Path()
                var first: Offset? = null
                var last: Offset? = null
                line.values.forEachIndexed { i, v ->
                    if (v == null || i >= count) return@forEachIndexed
                    val pt = o(x(i), y(v))
                    if (first == null) { p.moveTo(pt.x, pt.y); first = pt } else p.lineTo(pt.x, pt.y)
                    last = pt
                }
                val f = first
                val l = last
                if (line.fill != null && f != null && l != null) {
                    val area = Path().apply { addPath(p); lineTo(l.x, ((PLOT_TOP + plotH) * s).toFloat()); lineTo(f.x, ((PLOT_TOP + plotH) * s).toFloat()); close() }
                    drawPath(area, line.color.copy(alpha = line.fill))
                }
                drawPath(p, line.color, style = Stroke(line.width.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round,
                    pathEffect = if (line.dash.isEmpty()) null else PathEffect.dashPathEffect(line.dash.map { it.dp.toPx() }.toFloatArray())))
            }
            if (active != null) {
                drawLine(c.border, o(x(active), PLOT_TOP), o(x(active), PLOT_TOP + plotH), 1.dp.toPx())
                val line = lines.lastOrNull()
                val v = line?.values?.getOrNull(active)
                if (line != null && v != null) {
                    val center = o(x(active), y(v))
                    drawCircle(line.color, 4.dp.toPx(), center)
                    drawCircle(c.background, 4.dp.toPx(), center, style = Stroke(2.dp.toPx()))
                }
            }
        }
        for (i in AnalyticsRules.visibleTicks(xLabels, plotW, minTickGap)) {
            CenteredLabel(xLabels[i], x(i), PLOT_TOP + plotH + PLOT_SIDE + 10)
        }
        if (reference != null) {
            BBText(reference.label, Modifier.offset((PLOT_SIDE + 4).dp, (y(reference.value) + 3).dp),
                BBTextStyle.Micro.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W400), color = reference.color, maxLines = 1)
        }
        if (active != null) ChartTooltipBox(ChartScale.tooltipCenterX(x(active), w)) { tooltip(active) }
    }
}

/** Stacked bars with sign offset («Da dove arriva la crescita»): positives stack up from 0, negatives down. */
@Composable
fun AnalyticsStackedBars(
    labels: List<String>,
    bars: List<List<Pair<Double, Color>>>,
    accessibilitySummary: String,
    height: Dp = 256.dp,
    minTickGap: Double = 16.0,
    tooltip: @Composable ColumnScope.(Int) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val dens = LocalDensity.current
    var selection by remember { mutableStateOf<Int?>(null) }
    val active = if (hide) null else selection
    val pos = bars.map { b -> b.map { it.first }.filter { it > 0 }.sum() }
    val neg = bars.map { b -> b.map { it.first }.filter { it < 0 }.sum() }
    val domain = AnalyticsRules.autoDomain(listOf(0.0) + pos + neg)
    BoxWithConstraints(Modifier.fillMaxWidth().height(height).semantics { contentDescription = accessibilitySummary }) {
        val w = maxWidth.value.toDouble()
        val plotW = max(1.0, w - PLOT_SIDE * 2)
        val plotH = max(1.0, height.value - PLOT_TOP - PLOT_SIDE - AXIS_HEIGHT)
        val band = plotW / max(1, bars.size)
        fun y(v: Double) = ChartScale.y(v, domain, PLOT_TOP, plotH)
        val blurred = hide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        Canvas(
            Modifier.fillMaxSize().then(if (blurred) Modifier.blur(10.dp) else Modifier)
                .then(Scrub(bars.size, !hide, PLOT_SIDE, plotW, { px -> min(max((px / band).toInt(), 0), bars.size - 1) }) { selection = it }),
        ) {
            val s = dens.density
            for (g in AnalyticsRules.gridLines(domain)) {
                drawLine(c.border.copy(alpha = 0.5f * 0.3f), Offset((PLOT_SIDE * s).toFloat(), (y(g) * s).toFloat()),
                    Offset(((PLOT_SIDE + plotW) * s).toFloat(), (y(g) * s).toFloat()), 1.dp.toPx())
            }
            if (active != null) {
                drawRect(c.muted.copy(alpha = 0.6f), Offset(((PLOT_SIDE + band * active) * s).toFloat(), (PLOT_TOP * s).toFloat()),
                    Size((band * s).toFloat(), (plotH * s).toFloat()))
            }
            bars.forEachIndexed { i, segments ->
                val left = PLOT_SIDE + band * i + band * 0.1
                var up = 0.0
                var down = 0.0
                for ((value, color) in segments) {
                    if (value == 0.0) continue
                    val from = if (value > 0) up else down
                    val to = from + value
                    if (value > 0) up = to else down = to
                    val top = min(y(from), y(to))
                    val bottom = max(y(from), y(to))
                    drawRect(color, Offset((left * s).toFloat(), (top * s).toFloat()), Size((band * 0.8 * s).toFloat(), ((bottom - top) * s).toFloat()))
                }
            }
        }
        for (i in AnalyticsRules.visibleTicks(labels, plotW - band, minTickGap)) {
            CenteredLabel(labels[i], PLOT_SIDE + band * (i + 0.5), PLOT_TOP + plotH + PLOT_SIDE + 10)
        }
        if (active != null) ChartTooltipBox(ChartScale.tooltipCenterX(PLOT_SIDE + band * (active + 0.5), w)) { tooltip(active) }
    }
}

@Composable
private fun CenteredLabel(text: String, centerX: Double, centerY: Double) {
    var size by remember { mutableStateOf(androidx.compose.ui.unit.IntSize.Zero) }
    val dens = LocalDensity.current
    BBText(
        text,
        Modifier.onSizeChanged { size = it }.offset {
            with(dens) { IntOffset((centerX.dp.toPx() - size.width / 2f).roundToInt(), (centerY.dp.toPx() - size.height / 2f).roundToInt()) }
        },
        BBTextStyle.Caption.style, color = BuddyBudgetTheme.colors.mutedForeground, maxLines = 1,
    )
}

@Composable
private fun ChartTooltipBox(centerX: Double, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    val dens = LocalDensity.current
    var tipWidth by remember { mutableIntStateOf(0) }
    val centerPx = with(dens) { centerX.dp.toPx() }
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(
        Modifier.offset { IntOffset((centerPx - tipWidth / 2f).roundToInt(), with(dens) { (-8).dp.roundToPx() }) }
            .onSizeChanged { tipWidth = it.width }
            .bbShadow(BBShadow.md, shape)
            .background(c.popover, shape)
            .border(1.dp, c.border, shape)
            .padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space1_5),
        verticalArrangement = Arrangement.spacedBy(2.dp),
        content = content,
    )
}

/** Tooltip rows: a bold title then plain «label value» rows. */
@Composable
fun AnalyticsTooltip(title: String, rows: List<Triple<String, String, Boolean>>) {
    val c = BuddyBudgetTheme.colors
    BBText(title, style = BBTextStyle.Caption.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), maxLines = 1)
    for ((label, value, muted) in rows) {
        BBText("$label $value", style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = if (muted) c.mutedForeground else c.foreground, maxLines = 1)
    }
}
