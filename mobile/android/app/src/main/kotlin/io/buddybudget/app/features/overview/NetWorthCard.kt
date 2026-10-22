package io.buddybudget.app.features.overview

import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.draw.alpha
import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.layout.layout
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBSwitchSize
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbShadow
import io.buddybudget.app.designsystem.components.chartPath
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.ChartPoint
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.overview.AssetClass
import io.buddybudget.core.domain.overview.NetWorthChartState
import io.buddybudget.core.domain.overview.NetWorthChartView
import io.buddybudget.core.domain.overview.NetWorthStack
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * «Patrimonio netto» (OV-008…021, charts.md §2.1): headline with the change, view toggle, pension switch, the chart
 * (Totale area or stacked classes, press-and-drag detail), period selector, legend chips and notes.
 * Twin of `NetWorthCard` on iOS.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NetWorthCard(model: OverviewModel, view: OverviewView) {
    val state = model.chartState ?: return
    val c = BuddyBudgetTheme.colors
    val (value, change) = state.headline(model.scrubIndex)
    // OV-044: imported data on its way into the history.
    val shell = io.buddybudget.app.features.shell.LocalShell.current
    val refresh = shell.chartRefresh(model.viewUpdatedAt, model.fetchingView)
    androidx.compose.runtime.LaunchedEffect(model.viewUpdatedAt, model.fetchingView) { shell.settleChart(model.viewUpdatedAt, model.fetchingView) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr("Patrimonio netto"), Modifier.semantics { heading() }, BBTextStyle.BodyLarge.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), color = c.mutedForeground)
            AnimatedHero(value, view.currency, instant = model.scrubIndex != null)
            if (state.isPartial) {
                val labels = state.hiddenClasses.map { tr(AssetClass.label(it)).lowercase() }.joinToString(", ")
                BBText(tr("Totale parziale") + tr(", nascosto:") + " " + labels, BBTextStyle.BodyStrong, color = c.mutedForeground)
            }
            if (state.hasHistory) ChangeLine(change, view.currency, model.period)
            else BBText(tr(refresh?.message ?: "L'andamento comparirà nei prossimi giorni."), BBTextStyle.Body, color = c.mutedForeground)
        }
        if (state.showsViewToggle) {
            SegmentedControl(
                NetWorthChartView.entries.map { it to tr(it.label) }, model.chartView, model::selectChartView,
                accessibilityLabel = tr("Vista del grafico"),
            )
        }
        if (state.showsPensionSwitch) {
            Row(Modifier.heightIn(min = 24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                val label = tr("Includi la previdenza nel totale")
                BBSwitch(model.includePension, model::setIncludePension, size = BBSwitchSize.Sm, accessibilityLabel = label)
                BBText(label, BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        if (state.hasHistory) {
            Box {
                Box(Modifier.alpha(if (refresh != null) 0.5f else 1f)) {
                    NetWorthChart(model, state, OverviewPeriod.entries.firstOrNull { it.raw == view.period } ?: model.period, view.currency)
                }
                if (refresh != null) ChartRefreshNote(refresh, Modifier.align(Alignment.TopCenter).padding(top = BBSpacing.space2))
            }
            // #408: the shared period selector (presets 44 dp, one line).
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                io.buddybudget.app.designsystem.components.PeriodSelector(
                    OverviewPeriod.entries.map { it to tr(it.label) }, model.period, model::selectPeriod,
                    accessibilityLabel = tr("Periodo del grafico"),
                )
            }
            if (state.showsLegend || state.notes.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    if (state.showsLegend) {
                        val legendLabel = tr("Voci del grafico: tocca per mostrarle o nasconderle")
                        FlowRow(
                            Modifier.semantics { contentDescription = legendLabel },
                            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                        ) {
                            state.legend.forEach { item -> LegendChip(item, view.currency) { model.toggleClass(item.key) } }
                            if (state.isPartial) {
                                Box(
                                    Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable(model::showAllClasses, CircleShape, translate = false)
                                        .padding(horizontal = BBSpacing.space3),
                                    contentAlignment = Alignment.Center,
                                ) { BBText(tr("Mostra tutto"), BBTextStyle.BodyStrong, color = c.primary) }
                            }
                        }
                    }
                    if (state.notes.isNotEmpty()) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                            state.notes.forEach { BBText(tr(it), BBTextStyle.Body, color = c.mutedForeground) }
                        }
                    }
                }
            }
        }
    }
}

/** `MoneyHero` with the animated count (OV-012): 600 ms ease-out between values, instant while scrubbing / reduce motion. */
@Composable
private fun AnimatedHero(target: Double, currency: String, instant: Boolean) {
    val reduceMotion = rememberReduceMotion()
    var shown by remember { mutableDoubleStateOf(target) }
    val progress = remember { Animatable(1f) }
    var from by remember { mutableDoubleStateOf(target) }
    LaunchedEffect(target, instant) {
        if (instant || reduceMotion) {
            shown = target
            return@LaunchedEffect
        }
        from = shown
        progress.snapTo(0f)
        progress.animateTo(1f, tween(600, easing = CubicBezierEasing(0f, 0f, 0.58f, 1f))) {
            shown = from + (target - from) * this.value
        }
        shown = target
    }
    MoneyHero(shown, currency)
}

/** OV-012: arrow, ±amount (no decimals), (±x%) and the period phrase; green ≥ 0, red < 0. */
@Composable
private fun ChangeLine(change: OverviewView.Change, currency: String, period: OverviewPeriod) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val negative = change.delta < 0
    val sign = if (negative) "−" else "+"
    val amount = BBFormat.formatCurrency(abs(change.delta), currency, locale, maximumFractionDigits = 0, masked = hide)
    val pct = change.deltaPct?.let { " ($sign${BBFormat.formatPct(abs(it), locale)})" } ?: ""
    val color = if (negative) c.neg else c.pos
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBIconView(if (negative) BBIcon.TrendingDown else BBIcon.TrendingUp, size = 16.dp, color = color)
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontFamily = BBFontFamilies.sans, color = color, fontFeatureSettings = "tnum")) { append("$sign$amount$pct ") }
                withStyle(SpanStyle(fontFamily = BBFontFamilies.sans, color = c.mutedForeground)) { append(tr(period.changePhrase)) }
            },
            style = BBTextStyle.Body.style,
        )
    }
}

/** Legend toggle chip: color dot (hollow when hidden), label (struck through when hidden), latest value 0 dp. */
@Composable
private fun LegendChip(item: NetWorthChartState.LegendItem, currency: String, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val color = overviewTokenColor(c, AssetClass.colorToken(item.key))
    val dash = with(LocalDensity.current) { PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx())) }
    Row(
        Modifier.heightIn(min = BBLayout.minTouchTarget)
            .semantics { selected = item.visible }
            .bbPressable(onClick, CircleShape, pressedBackground = c.muted, translate = false)
            .then(
                Modifier.drawBehindBorder(c.border, if (item.visible) null else dash),
            )
            .padding(horizontal = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        Box(Modifier.size(10.dp).background(if (item.visible) color else Color.Transparent, CircleShape).border(1.dp, color, CircleShape))
        BBText(
            tr(AssetClass.label(item.key)),
            style = BBTextStyle.Body.style.copy(textDecoration = if (item.visible) null else TextDecoration.LineThrough),
            color = if (item.visible) c.foreground else c.mutedForeground,
        )
        BBText(
            BBFormat.formatCurrency(item.latest, currency, locale, maximumFractionDigits = 0, masked = hide),
            style = BBStyles.titleSmall.copy(fontSize = 14.sp, lineHeight = 20.sp, fontFeatureSettings = "tnum"),
        )
    }
}

/** Capsule border, dashed when [dash] is set. */
private fun Modifier.drawBehindBorder(color: Color, dash: PathEffect?): Modifier = this.then(
    Modifier.drawBehind {
        val r = size.height / 2
        drawRoundRect(
            color, topLeft = Offset(0.5.dp.toPx(), 0.5.dp.toPx()),
            size = androidx.compose.ui.geometry.Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(r, r), style = Stroke(1.dp.toPx(), pathEffect = dash),
        )
    },
)

// ---------------------------------------------------------------- Chart

/** Plot geometry for one width: Totale (margin top 8, hero domain) or Per classe (margins 5, x-axis 30, nice domain). */
private class ChartLayout(state: NetWorthChartState, val width: Double, val height: Double) {
    val count = state.shownSeries.size
    val left: Double
    val right: Double
    val plotTop: Double
    val plotBottom: Double
    val domain: ClosedFloatingPointRange<Double>
    val bands: List<NetWorthStack.Band>
    val ticks: List<Double>

    init {
        if (state.view == NetWorthChartView.Total) {
            left = 0.0; right = width; plotTop = 8.0; plotBottom = height
            domain = ChartScale.heroDomain(state.shownSeries.map { it.value })
            bands = emptyList(); ticks = emptyList()
        } else {
            left = 5.0; right = width - 5; plotTop = 5.0; plotBottom = height - 5 - 30
            bands = NetWorthStack.bands(state.shownSeries, state.visibleClasses)
            domain = NetWorthStack.domain(bands, if (state.showsNetLine) state.shownSeries.map { it.value } else null)
            ticks = ChartScale.niceTicks(domain.start, domain.endInclusive)
        }
    }

    fun x(i: Int): Double = left + ChartScale.x(i, count, 0.0, right - left)
    fun y(v: Double): Double = ChartScale.y(v, domain, plotTop, plotBottom - plotTop)
    fun index(x: Double): Int = ChartScale.scrubIndex(x - left, right - left, count)
}

/**
 * The net-worth plot, drawn with the shared geometry on both platforms: `Totale` = one area (hero domain, margin
 * top 8); `Per classe` = stacked bands (margins 5, x labels 13, dashed grid) and the dark net line.
 * Press and drag shows the point detail pinned at the top and moves the headline (mobile adaptation of OV-020).
 */
@Composable
private fun NetWorthChart(model: OverviewModel, state: NetWorthChartState, period: OverviewPeriod, currency: String) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val locale = LocalBBLocale.current
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current.density
    val summary = tr(
        "Patrimonio netto {0}: da {1} a {2}.",
        mapOf(
            "0" to tr(period.changePhrase),
            "1" to BBFormat.formatCurrency(state.change.start, currency, locale, maximumFractionDigits = 0, masked = hide),
            "2" to BBFormat.formatCurrency(state.change.end, currency, locale, maximumFractionDigits = 0, masked = hide),
        ),
    )
    // Full-bleed: undo the 16 dp screen gutter.
    BoxWithConstraints(
        Modifier.layout { measurable, constraints ->
            val extra = (BBSpacing.space4 * 2).roundToPx()
            val placeable = measurable.measure(constraints.copy(minWidth = constraints.maxWidth + extra, maxWidth = constraints.maxWidth + extra))
            layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
        }.fillMaxWidth().height(240.dp).semantics { contentDescription = summary },
    ) {
        val layout = ChartLayout(state, maxWidth.value.toDouble(), 240.0)
        val blur = hide && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        Canvas(
            Modifier.fillMaxSize().then(if (blur) Modifier.blur(10.dp) else Modifier).pointerInput(state, hide) {
                if (hide) return@pointerInput
                val slop = viewConfiguration.touchSlop
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    fun pick(x: Float) {
                        val next = layout.index(x / density.toDouble())
                        if (next != model.scrubIndex) {
                            model.scrubIndex = next
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        }
                    }
                    pick(down.position.x)
                    var horizontal: Boolean? = null
                    var total = Offset.Zero
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed || change.isConsumed) break
                        total += change.positionChange()
                        if (horizontal == null && (abs(total.x) > slop || abs(total.y) > slop)) horizontal = abs(total.x) >= abs(total.y)
                        if (horizontal == false) break
                        if (horizontal == true) change.consume()
                        pick(change.position.x)
                    }
                    model.scrubIndex = null
                }
            },
        ) {
            if (hide && !blur) {
                drawRoundRect(c.muted, cornerRadius = androidx.compose.ui.geometry.CornerRadius(BBRadius.xl.toPx()))
                return@Canvas
            }
            drawNetWorth(layout, state, model.scrubIndex.takeIf { !hide }, c, density)
        }
        if (!hide && state.view == NetWorthChartView.ByClass) AxisLabels(layout, state, period)
        val index = model.scrubIndex
        val detail = if (!hide && index != null) state.detail(index) else null
        if (detail != null && index != null) {
            var w by remember { mutableIntStateOf(0) }
            val centerPx = with(LocalDensity.current) { ChartScale.tooltipCenterX(layout.x(index), layout.width).dp.toPx() }
            Box(Modifier.offset { IntOffset((centerPx - w / 2f).roundToInt(), (-8 * density).roundToInt()) }.onSizeChanged { w = it.width }) {
                PointDetailCard(detail, currency)
            }
        }
    }
}

private fun DrawScope.drawNetWorth(layout: ChartLayout, state: NetWorthChartState, scrub: Int?, c: io.buddybudget.app.designsystem.generated.BBColors, density: Float) {
    val n = state.shownSeries.size
    if (n == 0) return
    fun pts(values: List<Double>) = values.mapIndexed { i, v -> ChartPoint(layout.x(i), layout.y(v)) }
    if (state.view == NetWorthChartView.Total) {
        val points = pts(state.shownSeries.map { it.value })
        val top = points.minOf { it.y }
        drawPath(
            chartPath(ChartPaths.area(points, ChartCurve.Monotone, layout.height), density),
            c.primary.copy(alpha = 0.12f),
        )
        drawPath(chartPath(ChartPaths.line(points, ChartCurve.Monotone), density), c.primary, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawCursor(layout, points, scrub, c.primary, c, density)
        return
    }
    for (tick in layout.ticks) {
        val y = (layout.y(tick) * density).toFloat()
        drawLine(c.border, Offset((layout.left * density).toFloat(), y), Offset((layout.right * density).toFloat(), y), 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 4.dp.toPx())))
    }
    var topBand: List<ChartPoint>? = null
    for (band in layout.bands) {
        val upper = pts(band.upper)
        val lower = pts(band.lower)
        topBand = upper
        val color = overviewTokenColor(c, AssetClass.colorToken(band.key))
        val excluded = band.key == AssetClass.PENSION && state.pensionExcluded
        val top = upper.minOf { it.y }
        drawPath(
            chartPath(NetWorthStack.bandPath(upper, lower), density),
            color.copy(alpha = if (excluded) 0.1f else 0.22f),
        )
        drawPath(
            chartPath(ChartPaths.line(upper, ChartCurve.Monotone), density), color,
            style = Stroke(1.5.dp.toPx(), pathEffect = if (excluded) PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 3.dp.toPx())) else null),
        )
    }
    val net = pts(state.shownSeries.map { it.value })
    if (state.showsNetLine) {
        drawPath(chartPath(ChartPaths.line(net, ChartCurve.Monotone), density), c.foreground, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
    drawCursor(layout, if (state.showsNetLine) net else topBand ?: net, scrub, if (state.showsNetLine) c.foreground else c.primary, c, density)
}

private fun DrawScope.drawCursor(layout: ChartLayout, points: List<ChartPoint>, scrub: Int?, color: Color, c: io.buddybudget.app.designsystem.generated.BBColors, density: Float) {
    val p = scrub?.let { points.getOrNull(it) } ?: return
    val x = (p.x * density).toFloat()
    drawLine(c.border, Offset(x, (layout.plotTop * density).toFloat()), Offset(x, (layout.plotBottom * density).toFloat()), 1.dp.toPx())
    val center = Offset(x, (p.y * density).toFloat())
    drawCircle(c.background, 5.dp.toPx(), center)
    drawCircle(color, 3.dp.toPx(), center)
}

@Composable
private fun AxisLabels(layout: ChartLayout, state: NetWorthChartState, period: OverviewPeriod) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val labels = state.shownSeries.map { NetWorthChartState.axisLabel(it.date, period, locale) }
    val kept = NetWorthStack.thinLabels(labels.indices.map { layout.x(it) }, labels.map { it.length * 7.0 }, plotWidth = layout.width)
    kept.forEach { i ->
        var w by remember(i) { mutableIntStateOf(0) }
        val density = LocalDensity.current.density
        val anchor = if (i == labels.size - 1) w.toFloat() else w / 2f
        BBText(
            labels[i],
            Modifier.offset { IntOffset((layout.x(i) * density - anchor).roundToInt(), ((layout.plotBottom + 8) * density).roundToInt()) }
                .onSizeChanged { w = it.width }.wrapContentWidth(unbounded = true),
            BBTextStyle.Body.style.copy(fontSize = 13.sp, lineHeight = 16.sp),
            color = c.mutedForeground, maxLines = 1,
        )
    }
}

/** OV-020 detail: date (· stimato), one row per class top-down, total row. */
@Composable
private fun PointDetailCard(detail: NetWorthChartState.PointDetail, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    fun money(v: Double) = BBFormat.formatCurrency(v, currency, locale)
    Column(
        Modifier.width(IntrinsicSize.Max).widthIn(min = 176.dp)
            .bbShadow(BBShadow.sm, RoundedCornerShape(BBRadius.lg))
            .background(c.background, RoundedCornerShape(BBRadius.lg))
            .border(1.dp, c.border, RoundedCornerShape(BBRadius.lg))
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        val date = CalendarDate.parse(detail.date)?.let { BBFormat.formatLongDate(it, locale) } ?: detail.date
        BBText(date + if (detail.isEstimated) " · " + tr("stimato") else "", BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
        if (detail.rows.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                detail.rows.forEach { row ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                        Row( verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                            Box(Modifier.size(8.dp).background(overviewTokenColor(c, AssetClass.colorToken(row.key)), CircleShape))
                            BBText(tr(row.label), BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                        }
                        Spacer(Modifier.weight(1f))
                        BBText(money(row.value), style = BBStyles.tooltipValue.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W400), maxLines = 1)
                    }
                }
            }
            BBSeparator()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                BBText(tr(detail.totalLabel), BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                Spacer(Modifier.weight(1f))
                BBText(money(detail.total), style = BBStyles.tooltipValue, maxLines = 1)
            }
        } else {
            BBText(money(detail.total), style = BBStyles.tooltipValue, maxLines = 1)
        }
    }
}

/** OV-044 / TX-076: the line floating over a history chart while imported data is on its way. */
@Composable
fun ChartRefreshNote(state: io.buddybudget.core.domain.networth.ChartRefresh.State, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    BBText(
        tr(state.message),
        modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }
            .background(c.background.copy(alpha = 0.9f), androidx.compose.foundation.shape.CircleShape)
            .border(1.dp, c.border, androidx.compose.foundation.shape.CircleShape)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space1_5),
        BBTextStyle.Body.style.copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = c.text2,
    )
}
