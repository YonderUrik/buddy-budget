package io.buddybudget.app.features.overview

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDonut
import io.buddybudget.app.designsystem.components.BBDonutSlice
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.chartPath
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.tr
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.overview.AssetClass
import io.buddybudget.core.domain.overview.CompositionDisplay
import io.buddybudget.core.domain.overview.GoalsTile
import io.buddybudget.core.domain.overview.InvestmentsPulse
import io.buddybudget.core.domain.overview.MonthPaceDisplay
import io.buddybudget.core.domain.overview.MonthPaceGeometry
import io.buddybudget.core.domain.overview.UpcomingDues
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.AppDestination
import kotlin.math.abs
import kotlin.math.roundToInt

// Panoramica blocks under the chart: composition (OV-022…025), month pace (OV-026), upcoming dues (OV-027),
// goals (OV-030…032) and the investments pulse (OV-028). Twins of OverviewSections.swift on iOS.

// ---------------------------------------------------------------- «Dove sta il patrimonio»

@Composable
fun CompositionSection(model: OverviewModel, view: OverviewView) {
    val items = view.composition
    if (items.isEmpty()) return
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val slices = CompositionDisplay.donutItems(items)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr("Dove sta il patrimonio"), Modifier.semantics { heading() }, BBStyles.sectionHeading)
            CompositionDisplay.sentence(items)?.let { BBText(tr(it.source, it.values), BBTextStyle.Body) }
        }
        if (CompositionDisplay.showsDonut(items)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                BBDonut(
                    slices.mapIndexed { i, item -> BBDonutSlice(i, item.label, item.share, overviewTokenColor(c, AssetClass.colorToken(item.key))) },
                    view.currency, model.selectedSlice, { model.selectedSlice = it },
                    size = 192.dp,
                    accessibilitySummary = tr(
                        "Composizione del patrimonio: {0}.",
                        mapOf("0" to slices.joinToString(", ") { "${it.label} ${CompositionDisplay.percent(it.share)}" }),
                    ),
                    centerContent = { focused -> DonutCenter(focused?.let { slices.getOrNull(it) }, items, view.currency) },
                    innerRadius = 62.dp, outerRadius = 90.dp,
                )
            }
        }
        Column {
            val focusedKey = model.selectedSlice?.let { slices.getOrNull(it)?.key }
            items.forEachIndexed { index, item ->
                CompositionRow(item, items, view.currency, focusedKey == item.key) { shell.open(AssetClass.path(item.key)) }
            }
        }
    }
}

@Composable
private fun DonutCenter(item: OverviewView.CompositionItem?, items: List<OverviewView.CompositionItem>, currency: String) {
    val c = BuddyBudgetTheme.colors
    val center = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (item != null) {
            BBText(item.label, style = center, color = c.mutedForeground, maxLines = 1)
            AmountText(item.amount, currency, maximumFractionDigits = 0, style = BBStyles.titleSmall)
            BBText("${CompositionDisplay.percent(item.share)} ${tr("del totale")}", style = center, color = c.mutedForeground)
        } else {
            CompositionDisplay.investedShare(items)?.let { share ->
                BBText(CompositionDisplay.percent(share), BBTextStyle.AmountLarge)
                BBText(tr("investito"), style = center, color = c.mutedForeground)
            }
        }
    }
}

/** OV-022 row → its area; first tap on the row navigates (the donut slice highlights, mobile adaptation). */
@Composable
private fun CompositionRow(item: OverviewView.CompositionItem, items: List<OverviewView.CompositionItem>, currency: String, focused: Boolean, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val shape = RoundedCornerShape(BBRadius.lg)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp)
            .background(if (focused) c.alphaMuted60 else Color.Transparent, shape)
            .border(1.dp, if (focused) c.ring else Color.Transparent, shape)
            .bbPressable(onClick, shape, pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space2_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.size(8.dp).background(overviewTokenColor(c, AssetClass.colorToken(item.key)), CircleShape))
        Column(Modifier.weight(1f)) {
            BBText(item.label, BBTextStyle.BodyStrong)
            BBText(
                item.detail + if (CompositionDisplay.showsShare(item, items)) " · ${CompositionDisplay.percent(item.share)}" else "",
                BBTextStyle.Caption, color = c.mutedForeground,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            AmountText(item.amount, currency, maximumFractionDigits = 0, style = BBTextStyle.BodyStrong.style)
            item.highlight?.let { h ->
                val negative = h.amount < 0
                val pct = h.ratio?.let { " (${BBFormat.formatSignedPct(it, locale)})" } ?: ""
                BBText(
                    (if (negative) "−" else "+") + BBFormat.formatCurrency(abs(h.amount), currency, locale, maximumFractionDigits = 0, masked = hide) + pct,
                    BBTextStyle.Caption, color = if (negative) c.neg else c.pos, maxLines = 1,
                )
            }
        }
        BBIconView(BBIcon.ChevronRight, size = 16.dp, color = c.mutedForeground.copy(alpha = 0.5f))
    }
}

// ---------------------------------------------------------------- «Il mese di …»

@Composable
fun MonthPaceSection(view: OverviewView) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val pace = view.monthPace
    fun money(v: Double) = BBFormat.formatCurrency(v, view.currency, locale, maximumFractionDigits = 0, masked = hide)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        OverviewSectionHeading(BBIcon.Wallet, tr("Il mese di {0}", mapOf("0" to view.monthLabel)), c.swatchTeal, tr("Movimenti")) {
            shell.open("/liquidita/analisi")
        }
        MonthPaceChart(pace, view.currency)
        Column {
            Row(Modifier.padding(top = BBSpacing.space2), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                Column(Modifier.weight(1f)) {
                    BBText(tr("Entrate ricevute"), BBTextStyle.Body, color = c.mutedForeground)
                    AmountText(pace.income, view.currency, tone = AmountTone.Pos, maximumFractionDigits = 0, style = BBStyles.titleSmall)
                }
                val budget = MonthPaceDisplay.budgetText(pace)
                val used = MonthPaceDisplay.budgetUsed(pace)
                if (budget != null && used != null) {
                    val label = tr("Budget usato: {0}% di {1}", mapOf("0" to (used * 100).roundToInt().toString(), "1" to money(pace.budgetTotal ?: 0.0)))
                    Column(Modifier.weight(1f)) {
                        BBText(tr("Budget"), BBTextStyle.Body, color = c.mutedForeground)
                        BBText(tr(budget.first, mapOf("0" to money(budget.second))), style = BBStyles.titleSmall.copy(fontFeatureSettings = "tnum"))
                        Box(
                            Modifier.padding(top = BBSpacing.space1_5).fillMaxWidth().height(8.dp).clip(CircleShape).background(c.muted)
                                .clearAndSetSemantics { contentDescription = label },
                        ) {
                            Box(Modifier.fillMaxHeight().fillMaxWidth(used.toFloat()).background(if (MonthPaceDisplay.isOverBudget(pace)) c.neg else c.primary, CircleShape))
                        }
                    }
                }
            }
        }
    }
}

/**
 * Hand-drawn cumulative spending (charts.md §3 `MonthPaceChart`): dashed usual curve with end labels, solid «you»
 * line drawn once on open (900 ms, skipped with reduce motion), today's dot and value, ticks 1 / mid / last.
 */
@Composable
private fun MonthPaceChart(pace: OverviewView.MonthPace, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val reduceMotion = rememberReduceMotion()
    val drawn = remember { Animatable(if (reduceMotion) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (drawn.value < 1f) drawn.animateTo(1f, tween(900, delayMillis = 150, easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)))
    }
    fun money(v: Double) = BBFormat.formatCurrency(v, currency, locale, maximumFractionDigits = 0, masked = hide)
    val summary = pace.typical?.lastOrNull()?.let { end ->
        val today = pace.typical!!.getOrNull(pace.dayOfMonth - 1) ?: 0.0
        tr(
            "Spesa cumulata del mese: {0} al giorno {1}, contro {2} di solito; a fine mese il solito arriva a {3}.",
            mapOf("0" to money(pace.spentSoFar), "1" to pace.dayOfMonth.toString(), "2" to money(today), "3" to money(end)),
        )
    } ?: tr("Spesa cumulata del mese: {0} al giorno {1}.", mapOf("0" to money(pace.spentSoFar), "1" to pace.dayOfMonth.toString()))
    BoxWithConstraints(Modifier.fillMaxWidth().height(MonthPaceGeometry.HEIGHT.dp).semantics { contentDescription = summary }) {
        val g = MonthPaceGeometry(pace, maxWidth.value.toDouble())
        val density = LocalDensity.current.density
        Box(Modifier.fillMaxSize().then(if (hide) Modifier.blur(10.dp) else Modifier)) {
            Canvas(Modifier.fillMaxSize()) {
                fun px(v: Double) = (v * density).toFloat()
                drawLine(c.border, Offset(px(MonthPaceGeometry.PAD_LEFT), px(g.baselineY)), Offset(px(g.width - MonthPaceGeometry.PAD_RIGHT), px(g.baselineY)), 1.dp.toPx())
                pace.typical?.let { typical ->
                    drawPath(
                        chartPath(ChartPaths.line(g.points(typical), ChartCurve.Linear), density), c.text3,
                        style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 5.dp.toPx()))),
                    )
                }
                val path = chartPath(ChartPaths.line(g.points(pace.current), ChartCurve.Linear), density)
                val measure = PathMeasure().apply { setPath(path, false) }
                val length = measure.length
                drawPath(
                    path, c.primary,
                    style = Stroke(
                        3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round,
                        pathEffect = if (drawn.value < 1f && length > 0) PathEffect.dashPathEffect(floatArrayOf(length * drawn.value, length)) else null,
                    ),
                )
                val today = Offset(px(g.x(pace.dayOfMonth)), px(g.y(pace.spentSoFar)))
                drawCircle(c.card, 6.dp.toPx(), today)
                drawCircle(c.primary, 4.dp.toPx(), today)
            }
            pace.typical?.lastOrNull()?.let { end ->
                PlacedLabel(money(end), g.x(pace.daysInMonth) + 6, g.y(end) + 4 - 12, BBTextStyle.Body.style.copy(fontSize = 13.sp, lineHeight = 16.sp), c.text2)
                PlacedLabel(tr("di solito"), g.x(pace.daysInMonth) + 6, g.y(end) + 19 - 12, BBTextStyle.Caption.style, c.text3)
            }
            PlacedLabel(
                money(pace.spentSoFar), g.x(pace.dayOfMonth), g.y(pace.spentSoFar) - 12 - 12,
                BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600, lineHeight = 16.sp, fontFeatureSettings = "tnum"), c.foreground, anchor = 0.5f,
            )
            g.ticks.forEachIndexed { i, day ->
                PlacedLabel(day.toString(), g.x(day), MonthPaceGeometry.HEIGHT - 8 - 12, BBTextStyle.Caption.style, c.text3, anchor = when (i) { 0 -> 0f; 1 -> 0.5f; else -> 1f })
            }
        }
    }
}

/** Text placed at (x, y) dp with its leading edge, center (0.5) or trailing edge (1) on x. */
@Composable
private fun PlacedLabel(text: String, x: Double, y: Double, style: androidx.compose.ui.text.TextStyle, color: Color, anchor: Float = 0f) {
    var w by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current.density
    BBText(
        text,
        Modifier.offset { IntOffset((x * density - w * anchor).roundToInt(), (y * density).roundToInt()) }.onSizeChanged { w = it.width }.wrapContentWidth(unbounded = true),
        style, color = color, maxLines = 1,
    )
}

// ---------------------------------------------------------------- «Prossime rate»

@Composable
fun UpcomingDuesSection(view: OverviewView) {
    val dues = UpcomingDues.shown(view.debts)
    if (dues.isEmpty()) return
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        OverviewSectionHeading(BBIcon.CalendarClock, tr("Prossime rate"), c.neg, tr("Debiti")) { shell.open(AppDestination.Debts) }
        // #427: rows separated by space, not rules.
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            dues.forEach { due -> DueRow(due, view.currency) }
        }
        view.debts?.let { debts ->
            val total = BBFormat.formatCurrency(debts.total, view.currency, locale, maximumFractionDigits = 0, masked = hide)
            val last = debts.debtFreeDate?.let { tr(", ultima rata il {0}", mapOf("0" to BBFormat.formatDateWithYear(it, locale))) } ?: ""
            BBText(tr("Residuo dei debiti: {0}{1}", mapOf("0" to total, "1" to last)), BBTextStyle.Body, color = c.mutedForeground)
        }
    }
}

@Composable
private fun DueRow(due: OverviewView.NextDue, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val date = CalendarDate.parse(due.date)
    Row(
        Modifier.padding(vertical = BBSpacing.space2_5).semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Column(
            Modifier.width(44.dp).background(c.muted, RoundedCornerShape(BBRadius.lg)).padding(vertical = BBSpacing.space1),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BBText(date?.day?.toString() ?: "", style = BBStyles.titleSmall.copy(lineHeight = 22.sp))
            BBText((date?.let { BBFormat.monthNameShort(it.month, locale) } ?: "").replace(".", ""), BBTextStyle.Caption, color = c.mutedForeground)
        }
        Column(Modifier.weight(1f)) {
            BBText(due.name, BBTextStyle.BodyStrong, maxLines = 1)
            if (due.overdue) BBText(tr("Scaduta"), BBTextStyle.Body, color = c.neg)
        }
        AmountText(due.amount, currency, maximumFractionDigits = 0, style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500))
    }
}

// ---------------------------------------------------------------- Goals

@Composable
fun GoalsSection(model: OverviewModel) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    when (val mode = model.goalsMode) {
        GoalsTile.Mode.Hidden -> Unit
        GoalsTile.Mode.Invite -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Box(Modifier.weight(1f)) { OverviewSectionHeading(BBIcon.Target, tr("Novità: obiettivi di risparmio"), c.swatchAmber) }
                Box(Modifier.offset(x = BBSpacing.space2)) { BBIconButton(BBIcon.X, tr("Non ora")) { model.dismissGoalsInvite() } }
            }
            BBText(
                tr("Dai un nome ai tuoi risparmi: un viaggio, la casa, un fondo per gli imprevisti. Scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi e cosa cambia per il giorno in cui smetti di lavorare."),
                BBTextStyle.Body, color = c.text2,
            )
            BBButton(tr("Crea il primo obiettivo"), { shell.open("/analitiche/obiettivi?nuovo=1&da=panoramica") }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
        }
        is GoalsTile.Mode.List -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            OverviewSectionHeading(BBIcon.Target, tr("I tuoi obiettivi"), c.swatchAmber, tr("Tutti")) { shell.open("/analitiche/obiettivi") }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                mode.goals.forEach { goal ->
                    GoalRow(goal, model.goals?.currency ?: "EUR") { shell.open("/analitiche/obiettivi/${goal.id}") }
                }
            }
        }
    }
}

@Composable
private fun GoalRow(goal: GoalView, currency: String, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    fun money(v: Double) = BBFormat.formatCurrency(v, currency, locale, maximumFractionDigits = 0, masked = hide)
    val (parts, capitalize) = GoalsTile.statusSentence(goal, ::money) { BBFormat.formatMonthLabel(it.take(7), locale) }
    val texts = parts.map { tr(it.source, it.values) }.toMutableList()
    if (capitalize && texts.isNotEmpty()) texts[0] = BBFormat.capitalize(texts[0])
    val label = GoalsTile.statusLabel(goal.status)?.let { tr(it) }
    val labelColor = if (goal.status == "in_ritardo") c.swatchAmberDark else c.pos
    val progressLabel = tr("Avanzamento di {0}", mapOf("0" to goal.name))
    Row(
        Modifier.fillMaxWidth().bbPressable(onClick, RoundedCornerShape(0.dp), translate = false).padding(vertical = BBSpacing.space3),
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBIconBadge(BBIcon.forKey(GoalsTile.iconKey(goal.kind)) ?: BBIcon.Sparkles, overviewTokenColor(c, GoalsTile.colorToken(goal.kind)), 32.dp, 16.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(goal.name, Modifier.weight(1f), BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500), maxLines = 1)
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W500, fontSize = 16.sp, color = c.foreground, fontFeatureSettings = "tnum")) {
                            append(money(goal.current))
                        }
                        withStyle(SpanStyle(color = c.text3)) { append(" " + tr("di {0}", mapOf("0" to money(goal.target)))) }
                    },
                    style = BBTextStyle.Body.style, maxLines = 1,
                )
            }
            Box(Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(c.muted).clearAndSetSemantics { contentDescription = progressLabel }) {
                Box(Modifier.fillMaxHeight().fillMaxWidth(goal.progress.coerceIn(0.0, 1.0).toFloat()).background(overviewTokenColor(c, GoalsTile.progressToken(goal.status)), CircleShape))
            }
            Text(
                buildAnnotatedString {
                    if (label != null) withStyle(SpanStyle(fontWeight = FontWeight.W500, color = labelColor)) { append("$label · ") }
                    append(texts.joinToString(""))
                },
                style = BBTextStyle.Body.style.copy(color = c.text2),
            )
        }
    }
}

// ---------------------------------------------------------------- «Investimenti» pulse

@Composable
fun InvestmentsPulseSection(pulse: InvestmentsPulse, currency: String) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    fun money(v: Double) = BBFormat.formatCurrency(v, currency, locale, maximumFractionDigits = 0, masked = hide)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        OverviewSectionHeading(if (pulse.isLoss) BBIcon.TrendingDown else BBIcon.TrendingUp, tr("Investimenti"), c.primary, tr("Portafoglio")) {
            shell.open(AppDestination.Investments)
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(pulse.sign + money(abs(pulse.marketGain)), BBTextStyle.StatValue, color = if (pulse.isLoss) c.neg else c.pos)
            val ratio = pulse.ratioText(locale)
            BBText(tr(ratio.source, ratio.values), Modifier.padding(bottom = 4.dp), BBTextStyle.Body.style, color = c.mutedForeground)
        }
        val barLabel = tr(
            "Portafoglio da {0}: {1} versati e {2} {3} dal mercato",
            mapOf("0" to money(pulse.value), "1" to money(minOf(pulse.paid, pulse.value)), "2" to money(abs(pulse.marketGain)), "3" to tr(if (pulse.isLoss) "persi" else "guadagnati")),
        )
        Row(
            Modifier.fillMaxWidth().height(12.dp).clip(CircleShape).background(c.muted)
                .then(if (hide) Modifier.blur(10.dp) else Modifier)
                .clearAndSetSemantics { contentDescription = barLabel },
        ) {
            if (pulse.paidShare > 0) Box(Modifier.fillMaxHeight().weight(pulse.paidShare.toFloat()).background(c.primary))
            if (!pulse.isLoss && pulse.paidShare < 1) Box(Modifier.fillMaxHeight().weight((1 - pulse.paidShare).toFloat()).background(c.pos))
            if (pulse.isLoss && pulse.paidShare < 1) Spacer(Modifier.weight((1 - pulse.paidShare).toFloat()))
        }
        Row {
            val positions = pulse.positionsText
            BBText("${tr(positions.source, positions.values)} ${tr("· versati")} ${money(pulse.paid)}", Modifier.weight(1f), BBTextStyle.Body.style, color = c.mutedForeground)
            BBText(money(pulse.value), BBTextStyle.BodyStrong)
        }
    }
}
