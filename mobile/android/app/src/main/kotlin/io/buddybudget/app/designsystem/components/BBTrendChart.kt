package io.buddybudget.app.designsystem.components

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.designsystem.TrendGeometry
import kotlin.math.roundToInt

/**
 * Hand-drawn `TrendChart` (charts.md §3): smooth line 2.6 with an area gradient 0.26 → 0, optional dashed reference
 * series («Di solito», `--text-3` 2, dash 2 7). Touch-and-drag scrubs: vertical line `--foreground @ 20%`, 14 dp dot
 * with a 2 dp `--background` ring and a tooltip pinned at the top. Fewer than 2 points → a muted placeholder of the
 * same height. Privacy: blurred and inert. iOS: BBTrendChart.swift.
 */
@Composable
fun BBTrendChart(
    values: List<Double>,
    formatValue: (Double) -> String,
    modifier: Modifier = Modifier,
    reference: List<Double>? = null,
    labels: List<String> = emptyList(),
    height: Dp = 200.dp,
    color: Color = BuddyBudgetTheme.colors.primary,
    referenceLabel: String = "",
    accessibilitySummary: String = "",
) {
    val c = BuddyBudgetTheme.colors
    if (values.size < 2) {
        Box(modifier.fillMaxWidth().height(height).background(c.muted.copy(alpha = 0.5f), RoundedCornerShape(BBRadius.xl)))
        return
    }
    val hide = LocalHideAmounts.current
    val density = LocalDensity.current
    var selection by remember { mutableStateOf<Int?>(null) }
    BoxWithConstraints(
        modifier.fillMaxWidth().height(height).semantics { contentDescription = accessibilitySummary }
            .then(if (hide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Modifier.blur(10.dp) else Modifier),
    ) {
        val widthDp = maxWidth.value.toDouble()
        val layout = TrendGeometry.layout(values, reference, widthDp, height.value.toDouble())
        val scale = density.density
        Canvas(
            Modifier.fillMaxSize().pointerInput(values, hide) {
                if (hide) return@pointerInput
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    selection = TrendGeometry.index(down.position.x / scale.toDouble(), widthDp, layout.columns)
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        selection = TrendGeometry.index(change.position.x / scale.toDouble(), widthDp, layout.columns)
                    }
                    selection = null
                }
            },
        ) {
            drawPath(
                chartPath(ChartPaths.area(layout.line, ChartCurve.Smooth, height.value.toDouble()), scale),
                color.copy(alpha = 0.12f),
            )
            if (layout.reference.isNotEmpty()) {
                drawPath(
                    chartPath(ChartPaths.line(layout.reference, ChartCurve.Smooth), scale), c.text3,
                    style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 7.dp.toPx()))),
                )
            }
            drawPath(
                chartPath(ChartPaths.line(layout.line, ChartCurve.Smooth), scale), color,
                style = Stroke(2.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
            val i = selection
            if (i != null && !hide) {
                val step = if (layout.columns > 1) widthDp / (layout.columns - 1) else 0.0
                val x = (i * step * scale).toFloat()
                drawLine(c.foreground.copy(alpha = 0.2f), Offset(x, 0f), Offset(x, size.height), 1.dp.toPx())
                layout.line.getOrNull(i)?.let { p ->
                    val center = Offset(x, (p.y * scale).toFloat())
                    drawCircle(c.background, 9.dp.toPx(), center)
                    drawCircle(color, 7.dp.toPx(), center)
                }
            }
        }
        val i = selection
        if (i != null && !hide) {
            var tipWidth by remember { mutableIntStateOf(0) }
            val step = if (layout.columns > 1) widthDp / (layout.columns - 1) else 0.0
            val centerPx = with(density) { ChartScale.tooltipCenterX(i * step, widthDp).dp.toPx() }
            Column(
                Modifier.offset { IntOffset((centerPx - tipWidth / 2f).roundToInt(), (-8).dp.roundToPx()) }
                    .onSizeChanged { tipWidth = it.width }
                    .bbShadow(BBShadow.xl, RoundedCornerShape(BBRadius.lg))
                    .background(c.background, RoundedCornerShape(BBRadius.lg))
                    .border(1.dp, c.alphaBorder50, RoundedCornerShape(BBRadius.lg))
                    .padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space1_5),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
            ) {
                labels.getOrNull(i)?.let { BBText(it, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1) }
                values.getOrNull(i)?.let { BBText(formatValue(it), style = BBTextStyle.BodyStrong.style, maxLines = 1) }
                val ref = reference?.getOrNull(i)
                if (ref != null && referenceLabel.isNotEmpty()) BBText("$referenceLabel: ${formatValue(ref)}", BBTextStyle.Caption, color = c.text2, maxLines = 1)
            }
        }
    }
}
