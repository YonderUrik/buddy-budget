package io.buddybudget.app.features.investments

import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import io.buddybudget.app.designsystem.components.chartPath
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.ChartPoint
import io.buddybudget.core.designsystem.ChartScale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** One plotted series of [InvestmentsChart]. */
data class InvestmentsSeries(
    val id: String,
    val values: List<Double?>,
    val color: Color,
    val style: Style = Style.Line,
    val width: Dp = 2.dp,
) {
    /** `AreaStep`: step-after area with its line (pension contributions); `Fill`: gradient only (projection band). */
    enum class Style { Area, Line, DashedStep, Dashed, AreaStep, Fill }
}

/**
 * Multi-series chart of Investimenti (portfolio value vs invested, cumulative TWR vs benchmark, drawdown, security price):
 * hidden axes, hero domain (or including 0), monotone curves, scrub with crosshair and a pinned tooltip. Same look as
 * `InvestmentsChart` on iOS.
 */
@Composable
fun InvestmentsChart(
    count: Int,
    series: List<InvestmentsSeries>,
    accessibilitySummary: String,
    selection: Int?,
    onSelectionChange: (Int?) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 240.dp,
    zeroBased: Boolean = false,
    reference: Double? = null,
    markers: List<Int> = emptyList(),
    tooltip: @Composable ColumnScope.(Int) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val dens = LocalDensity.current
    val scale = dens.density
    val all = series.flatMap { s -> s.values.filterNotNull() } + listOfNotNull(reference)
    val domain = if (zeroBased) {
        val lo = min(all.minOrNull() ?: 0.0, 0.0)
        val hi = max(all.maxOrNull() ?: 0.0, 0.0)
        val pad = max((hi - lo) * 0.08, 0.0001)
        (lo - if (lo < 0) pad else 0.0)..(hi + pad)
    } else {
        ChartScale.heroDomain(all)
    }
    val active = if (hide) null else selection?.takeIf { it in 0 until count }
    BoxWithConstraints(modifier.fillMaxWidth().height(height).semantics { contentDescription = accessibilitySummary }) {
        val widthDp = maxWidth.value.toDouble()
        val top = 8.0
        val plotH = height.value.toDouble() - top
        fun x(i: Int) = ChartScale.x(i, count, 0.0, widthDp)
        fun y(v: Double) = ChartScale.y(v, domain, top, plotH)
        val blurred = hide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        Canvas(
            Modifier.fillMaxSize().then(if (blurred) Modifier.blur(10.dp) else Modifier).pointerInput(count, hide) {
                if (hide) return@pointerInput
                val slop = viewConfiguration.touchSlop
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val w = size.width.toDouble()
                    onSelectionChange(ChartScale.scrubIndex(down.position.x.toDouble(), w, count))
                    var horizontal: Boolean? = null
                    var total = Offset.Zero
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        if (change.isConsumed) break
                        total += change.positionChange()
                        if (horizontal == null && (abs(total.x) > slop || abs(total.y) > slop)) horizontal = abs(total.x) >= abs(total.y)
                        if (horizontal == false) break
                        if (horizontal == true) change.consume()
                        onSelectionChange(ChartScale.scrubIndex(change.position.x.toDouble(), w, count))
                    }
                    onSelectionChange(null)
                }
            },
        ) {
            val baseline = if (zeroBased) y(0.0) else top + plotH
            for (s in series) {
                // Contiguous runs of non-null values.
                val runs = mutableListOf<MutableList<ChartPoint>>()
                var current: MutableList<ChartPoint>? = null
                s.values.forEachIndexed { i, v ->
                    if (v == null) {
                        current = null
                    } else {
                        if (current == null) current = mutableListOf<ChartPoint>().also { runs += it }
                        current!!.add(ChartPoint(x(i), y(v)))
                    }
                }
                for (geo in runs) {
                    if (geo.isEmpty()) continue
                    when (s.style) {
                        InvestmentsSeries.Style.Area -> {
                            val minY = geo.minOf { it.y }
                            drawPath(
                                chartPath(ChartPaths.area(geo, ChartCurve.Monotone, baseline), scale),
                                s.color.copy(alpha = 0.12f),
                            )
                            drawPath(chartPath(ChartPaths.line(geo, ChartCurve.Monotone), scale), s.color,
                                style = Stroke(s.width.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                        }
                        InvestmentsSeries.Style.Line -> drawPath(chartPath(ChartPaths.line(geo, ChartCurve.Monotone), scale), s.color,
                            style = Stroke(s.width.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                        InvestmentsSeries.Style.DashedStep -> drawPath(chartPath(ChartPaths.line(geo, ChartCurve.StepAfter), scale), s.color,
                            style = Stroke(s.width.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))))
                        InvestmentsSeries.Style.Dashed -> drawPath(chartPath(ChartPaths.line(geo, ChartCurve.Monotone), scale), s.color,
                            style = Stroke(s.width.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))))
                        InvestmentsSeries.Style.AreaStep -> {
                            val minY = geo.minOf { it.y }
                            drawPath(
                                chartPath(ChartPaths.area(geo, ChartCurve.StepAfter, baseline), scale),
                                s.color.copy(alpha = 0.12f),
                            )
                            drawPath(chartPath(ChartPaths.line(geo, ChartCurve.StepAfter), scale), s.color, style = Stroke(s.width.toPx()))
                        }
                        InvestmentsSeries.Style.Fill -> {
                            val minY = geo.minOf { it.y }
                            drawPath(
                                chartPath(ChartPaths.area(geo, ChartCurve.Monotone, baseline), scale),
                                s.color.copy(alpha = 0.12f),
                            )
                        }
                    }
                }
            }
            if (reference != null) {
                val ry = (y(reference) * scale).toFloat()
                drawLine(c.mutedForeground, Offset(0f, ry), Offset(size.width, ry), 1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())))
            }
            val first = series.firstOrNull()
            if (first != null) {
                for (i in markers) {
                    val v = first.values.getOrNull(i) ?: continue
                    val center = Offset((x(i) * scale).toFloat(), (y(v) * scale).toFloat())
                    drawCircle(c.background, 5.dp.toPx(), center)
                    drawCircle(c.foreground, 3.dp.toPx(), center)
                }
            }
            if (active != null) {
                val px = (x(active) * scale).toFloat()
                drawLine(c.border, Offset(px, (top * scale).toFloat()), Offset(px, size.height), 1.dp.toPx())
                val v = first?.values?.getOrNull(active)
                if (v != null) {
                    val center = Offset(px, (y(v) * scale).toFloat())
                    drawCircle(c.background, 5.dp.toPx(), center)
                    drawCircle(first.color, 3.dp.toPx(), center)
                }
            }
        }
        if (active != null) {
            var tipWidth by remember { mutableIntStateOf(0) }
            val centerPx = with(dens) { ChartScale.tooltipCenterX(x(active), widthDp).dp.toPx() }
            Column(
                Modifier.offset { IntOffset((centerPx - tipWidth / 2f).roundToInt(), 0) }
                    .onSizeChanged { tipWidth = it.width }
                    .bbShadow(BBShadow.xl, RoundedCornerShape(BBRadius.lg))
                    .background(c.background, RoundedCornerShape(BBRadius.lg))
                    .border(1.dp, c.alphaBorder50, RoundedCornerShape(BBRadius.lg))
                    .padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space1_5),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) { tooltip(active) }
        }
    }
}

/** Legend item: a short swatch (solid or dashed) + label. */
@Composable
fun ChartLegendItem(label: String, color: Color, dashed: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        if (dashed) {
            Canvas(Modifier.width(16.dp).height(2.dp)) {
                drawLine(color, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), 1.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.dp.toPx())))
            }
        } else {
            Box(Modifier.width(16.dp).height(2.dp).background(color, CircleShape))
        }
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground, maxLines = 1)
    }
}

