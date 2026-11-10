package io.buddybudget.app.features.overview

import io.buddybudget.app.designsystem.components.BBStyles
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.chartPath
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.SettingsSection
import io.buddybudget.app.features.settings.SettingsSwitchRow
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.MoreRowTitle
import io.buddybudget.app.features.shell.MoreSectionTitle
import io.buddybudget.app.tr
import io.buddybudget.core.data.SidebarDeadlines
import io.buddybudget.core.data.SidebarFire
import io.buddybudget.core.data.SidebarSummary
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.SparklineGeometry
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.overview.InAppLinks
import io.buddybudget.core.domain.overview.SidebarInsights
import io.buddybudget.core.domain.overview.SidebarModuleId
import io.buddybudget.core.domain.shell.AppDestination
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * «Il tuo quadro» in «Altro» (SHELL-018, SHELL-020, SHELL-028…038): a collapsible row that, once opened, shows the
 * enabled modules Oggi, Prossime scadenze, Obiettivo FIRE, Portafoglio and Watchlist. Twin of `InsightsSection` on iOS.
 */
/** DEBUG `--es bbQuadro top`: the section opened at the top of «Altro» for screenshots; always false in release. */
object InsightsDebug {
    val onTop: Boolean get() = DebugLaunch.value("bbQuadro") == "top"
}

@Composable
fun InsightsSection() {
    val c = BuddyBudgetTheme.colors
    val model = LocalShell.current.insights
    Column {
        MoreSectionTitle(tr("Il tuo quadro"))
        val hint = tr(if (model.isOpen) "Tocca per chiudere" else "Tocca per aprire il riepilogo")
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp)
                .bbPressable(model::toggleOpen, RoundedCornerShape(BBRadius.xl), pressedBackground = c.muted, translate = false)
                .semantics { stateDescription = hint }
                .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            Column(Modifier.weight(1f)) {
                BBText(tr("Patrimonio, scadenze e obiettivo"), style = MoreRowTitle)
                BBText(hint, BBTextStyle.Caption, color = c.text2)
            }
            BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (model.isOpen) 180f else 0f), color = c.text3)
        }
        if (model.isOpen) {
            Column(Modifier.padding(start = BBSpacing.space1, end = BBSpacing.space1, top = BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                InsightModules(model)
            }
        }
    }
}

@Composable
private fun InsightModules(model: InsightsModel) {
    val modules = model.modules
    fun hasContent(m: SidebarModuleId): Boolean = when (m) {
        SidebarModuleId.Oggi -> model.summary.valueOrNull?.netWorth != null
        SidebarModuleId.Portafoglio -> model.summary.valueOrNull?.portfolio != null
        SidebarModuleId.Watchlist -> model.summary.valueOrNull?.watchlist?.isNotEmpty() == true
        SidebarModuleId.Scadenze -> model.deadlines.valueOrNull?.items?.isNotEmpty() == true
        SidebarModuleId.Fire -> model.fire.valueOrNull != null
    }
    val firstVisible = modules.firstOrNull(::hasContent)
    val firstSummary = modules.firstOrNull { it == SidebarModuleId.Oggi || it == SidebarModuleId.Portafoglio || it == SidebarModuleId.Watchlist }
    modules.forEach { module ->
        val eye = module == firstVisible && module != SidebarModuleId.Scadenze && module != SidebarModuleId.Fire
        when (module) {
            SidebarModuleId.Oggi, SidebarModuleId.Portafoglio, SidebarModuleId.Watchlist -> {
                val summary = model.summary
                if (summary.isLoading) {
                    if (module == firstSummary) {
                        Column(Modifier.padding(top = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                            BBSkeleton(width = 96.dp, height = 16.dp, radius = BBRadius.sm)
                            BBSkeleton(height = 64.dp, radius = BBRadius.lg)
                        }
                    }
                } else summary.valueOrNull?.let { SummaryModule(model, module, it, eye) }
            }
            SidebarModuleId.Scadenze -> {
                val d = model.deadlines
                if (d.isLoading) BBSkeleton(height = 56.dp, radius = BBRadius.lg)
                else d.valueOrNull?.takeIf { it.items.isNotEmpty() }?.let { DeadlinesModule(model, it) }
            }
            SidebarModuleId.Fire -> {
                val f = model.fire
                if (f.isLoading) BBSkeleton(height = 64.dp, radius = BBRadius.lg)
                else f.valueOrNull?.takeIf { SidebarInsights.fireState(it) != SidebarInsights.FireState.Hidden }?.let { FireModule(model, it) }
            }
        }
    }
}

private val TitleCaps = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.025.em)
private val RowLabel = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 13.sp, lineHeight = 16.sp)
private val Micro = BBTextStyle.Micro.style.copy(fontWeight = FontWeight.W400)

@Composable
private fun toneColor(value: Double?): Color {
    val c = BuddyBudgetTheme.colors
    return when (SidebarInsights.tone(value)) {
        AmountTone.Neg -> c.neg
        AmountTone.Pos -> c.pos
        else -> c.mutedForeground
    }
}

@Composable
private fun SummaryModule(model: InsightsModel, module: SidebarModuleId, summary: SidebarSummary, eye: Boolean) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val currency = summary.currency
    fun amount(v: Double, cur: String = currency) = BBFormat.formatCurrency(v, cur, locale, maximumFractionDigits = 0, masked = hide)
    fun signed(v: Double) = if (hide) SidebarInsights.MASK else (if (v < 0) "−" else "+") + amount(abs(v))
    when (module) {
        SidebarModuleId.Oggi -> summary.netWorth?.let { netWorth ->
            val (total, change) = SidebarInsights.today(netWorth, model.includePension)
            InsightCollapsible(model, module, amount(total), eye) {
                Column(Modifier.padding(start = BBSpacing.space1_5, end = BBSpacing.space1_5, bottom = BBSpacing.space1)) {
                    BBText(amount(total), style = BBStyles.figure.copy(fontWeight = FontWeight.W600))
                    val changeColor = toneColor(change)
                    Text(
                        buildAnnotatedString {
                            withStyle(SpanStyle(color = c.mutedForeground)) { append(tr("Patrimonio netto")) }
                            if (change != null) {
                                withStyle(SpanStyle(color = c.mutedForeground)) { append(" · ") }
                                withStyle(SpanStyle(color = changeColor, fontWeight = FontWeight.W500)) { append(signed(change)) }
                                withStyle(SpanStyle(color = c.mutedForeground)) { append(" " + tr("in 30 giorni")) }
                            }
                        },
                        style = Micro,
                    )
                }
            }
        }
        SidebarModuleId.Portafoglio -> summary.portfolio?.let { p ->
            InsightCollapsible(model, module, amount(p.totalValue), eye, badge = { ChangeChip(p.dayChangePct) }) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    Column(Modifier.padding(horizontal = BBSpacing.space1_5)) {
                        BBText(amount(p.totalValue), style = BBStyles.figure.copy(fontWeight = FontWeight.W600))
                        val gainColor = toneColor(p.totalGain)
                        Text(
                            buildAnnotatedString {
                                withStyle(SpanStyle(color = gainColor, fontWeight = FontWeight.W500)) { append(signed(p.totalGain)) }
                                p.totalGainPct?.let { withStyle(SpanStyle(color = c.mutedForeground)) { append(tr(" · {0} in totale", mapOf("0" to BBFormat.formatSignedPct(it, locale)))) } }
                            },
                            style = Micro,
                        )
                    }
                    p.holdings.take(SidebarInsights.MAX_HOLDINGS).forEach { h ->
                        InsightRow(tr(h.label), h.name, h.value?.let { amount(it) } ?: "—", h.dayChangePct, h.spark, h.triggeredAlerts > 0) {
                            shell.open(InAppLinks.securityPath(h.instrumentId))
                        }
                    }
                    if (p.holdings.size > SidebarInsights.MAX_HOLDINGS) ShowAll(p.holdings.size)
                }
            }
        }
        SidebarModuleId.Watchlist -> summary.watchlist.takeIf { it.isNotEmpty() }?.let { list ->
            val alerts = list.sumOf { it.triggeredAlerts }
            InsightCollapsible(
                model, module, "${list.size} ${tr(SidebarInsights.watchlistSummary(list.size))}", eye,
                badge = if (alerts > 0) ({ SoftBadge("$alerts ${tr(SidebarInsights.alertsWord(alerts))}") }) else null,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    list.take(SidebarInsights.MAX_WATCHLIST).forEach { w ->
                        InsightRow(
                            tr(w.label), w.name, w.lastClose?.let { BBFormat.formatCurrency(it, w.currency, locale, masked = hide) } ?: "—",
                            w.dayChangePct, w.spark, w.triggeredAlerts > 0,
                        ) { shell.open(InAppLinks.securityPath(w.instrumentId)) }
                    }
                    if (list.size > SidebarInsights.MAX_WATCHLIST) ShowAll(list.size)
                }
            }
        }
        else -> Unit
    }
}

@Composable
private fun DeadlinesModule(model: InsightsModel, data: SidebarDeadlines) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val overdue = SidebarInsights.overdueCount(data.items)
    val first = data.items.firstOrNull()?.let { SidebarInsights.deadlineDay(it.date, locale) }
    val badgeWord = SidebarInsights.overdueBadge(overdue)
    InsightCollapsible(
        model, SidebarModuleId.Scadenze, first?.let { "${it.first} ${it.second}" } ?: "", false,
        badge = if (badgeWord != null) ({ SoftBadge("$overdue ${tr(badgeWord)}") }) else null,
    ) {
        Column {
            data.items.forEach { item ->
                val (day, month) = SidebarInsights.deadlineDay(item.date, locale)
                Row(
                    Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable({ shell.open(InAppLinks.deadlinePath(item)) }, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                        .padding(horizontal = BBSpacing.space1_5),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
                ) {
                    val fg = if (item.overdue) c.neg else c.foreground
                    Column(
                        Modifier.width(36.dp).background(if (item.overdue) c.negSoft else c.muted, RoundedCornerShape(BBRadius.md)).padding(vertical = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        BBText(month.uppercase(), style = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 9.sp, lineHeight = 11.sp, letterSpacing = 0.025.em), color = fg.copy(alpha = 0.7f))
                        BBText(day, style = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 14.sp, lineHeight = 18.sp, fontFeatureSettings = "tnum"), color = fg)
                    }
                    BBText(tr(item.label), Modifier.weight(1f), BBTextStyle.Body.style.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.W600), maxLines = 1)
                    item.amount?.let {
                        BBText(
                            BBFormat.formatCurrency(it, data.currency, locale, maximumFractionDigits = 0, masked = hide),
                            style = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 13.sp, lineHeight = 18.sp, fontFeatureSettings = "tnum"),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FireModule(model: InsightsModel, fire: SidebarFire) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val state = SidebarInsights.fireState(fire)
    val summary = when (state) {
        SidebarInsights.FireState.Invite, SidebarInsights.FireState.Hidden -> ""
        is SidebarInsights.FireState.Reached -> SidebarInsights.fireProgressText(state.progress)
        is SidebarInsights.FireState.Progress -> SidebarInsights.fireProgressText(state.progress)
    }
    InsightCollapsible(model, SidebarModuleId.Fire, summary, false) {
        Column(
            Modifier.fillMaxWidth()
                .bbPressable({ shell.open(AppDestination.Analytics) }, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                .padding(horizontal = BBSpacing.space1_5, vertical = BBSpacing.space1),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            val progress = when (state) {
                is SidebarInsights.FireState.Reached -> state.progress
                is SidebarInsights.FireState.Progress -> state.progress
                SidebarInsights.FireState.Invite, SidebarInsights.FireState.Hidden -> null
            }
            if (progress == null) {
                BBText(tr("Indica la spesa annua in pensione in Analitiche per stimare il tuo numero FIRE."), style = Micro, color = c.mutedForeground)
            } else {
                val label = tr("Avanzamento verso il numero FIRE")
                Box(Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(c.muted).semantics { contentDescription = label }) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(SidebarInsights.fireFraction(progress).toFloat()).background(c.primary, CircleShape))
                }
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 14.sp, fontFeatureSettings = "tnum")) {
                            append(SidebarInsights.fireProgressText(progress))
                        }
                        withStyle(SpanStyle(fontSize = 12.sp, color = c.mutedForeground)) { append(" " + tr("del numero FIRE")) }
                    },
                    style = BBTextStyle.Caption.style.copy(color = c.foreground, lineHeight = 20.sp),
                )
                val line = when (state) {
                    is SidebarInsights.FireState.Reached -> tr("Obiettivo raggiunto")
                    is SidebarInsights.FireState.Progress -> tr(
                        "Mancano {0}{1}",
                        mapOf(
                            "0" to BBFormat.formatCurrency(state.remaining, fire.currency, locale, maximumFractionDigits = 0, masked = hide),
                            "1" to (state.years?.let { " · " + tr(it.source, it.values) } ?: ""),
                        ),
                    )
                    else -> ""
                }
                BBText(line, style = Micro, color = c.mutedForeground)
            }
        }
    }
}

/**
 * `CollapsibleSection`: top border, header (chevron rotating 90°, uppercase 11 title, badge, one-line summary when
 * closed) and an optional eye toggle; open state remembered per device (SHELL-029).
 */
@Composable
private fun InsightCollapsible(
    model: InsightsModel,
    module: SidebarModuleId,
    summary: String,
    eye: Boolean,
    badge: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val env = LocalEnv.current
    val scope = rememberCoroutineScope()
    val open = model.isSectionOpen(module)
    Column(Modifier.padding(top = BBSpacing.space1)) {
        BBSeparator()
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            Row(
                Modifier.weight(1f).heightIn(min = BBLayout.minTouchTarget)
                    .bbPressable({ model.toggleSection(module) }, RoundedCornerShape(BBRadius.md), translate = false)
                    .semantics { heading(); if (!open) stateDescription = summary }
                    .padding(horizontal = BBSpacing.space1_5),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
            ) {
                BBIconView(BBIcon.ChevronRight, Modifier.rotate(if (open) 90f else 0f), size = 12.dp, color = c.mutedForeground)
                BBText(tr(module.title), style = TitleCaps, color = c.mutedForeground, maxLines = 1, uppercase = true)
                badge?.invoke()
                Spacer(Modifier.weight(1f))
                if (!open && summary.isNotEmpty()) BBText(summary, style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500), maxLines = 1)
            }
            if (eye) {
                val hidden = env.privacy.hideAmounts
                val label = tr(if (hidden) "Mostra gli importi" else "Nascondi gli importi")
                Box(
                    Modifier.size(BBLayout.minTouchTarget)
                        .bbPressable({ scope.launch { env.session.setHideAmounts(!hidden) } }, CircleShape, translate = false)
                        .semantics { contentDescription = label },
                    contentAlignment = Alignment.Center,
                ) { BBIconView(if (hidden) BBIcon.EyeOff else BBIcon.Eye, size = 14.dp, color = c.mutedForeground) }
            }
        }
        if (open) Box(Modifier.padding(bottom = BBSpacing.space1)) { content() }
    }
}

/** Compact security row (`InsightRow`): label (+ alert dot), name, 36-wide mini line, value and day change. */
@Composable
private fun InsightRow(label: String, name: String, value: String, change: Double?, spark: List<Double>, alert: Boolean, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val alertLabel = tr("Avviso di prezzo scattato")
    Row(
        Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space1_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(label, style = RowLabel, maxLines = 1)
                if (alert) Box(Modifier.size(6.dp).background(c.primary, CircleShape).semantics { contentDescription = alertLabel })
            }
            BBText(name, style = Micro.copy(lineHeight = 14.sp), color = c.mutedForeground, maxLines = 1)
        }
        TitleSparkline(spark)
        Column(Modifier.width(76.dp), horizontalAlignment = Alignment.End) {
            BBText(value, style = RowLabel.copy(fontFeatureSettings = "tnum"), maxLines = 1)
            BBText(change?.let { BBFormat.formatSignedPct(it, locale) } ?: "—", style = Micro.copy(lineHeight = 14.sp), color = toneColor(change))
        }
    }
}

/** `TitleSparkline` (charts.md §3): polyline 1.5 round, `--pos` when up else `--neg`; < 2 values → empty space. */
@Composable
private fun TitleSparkline(values: List<Double>) {
    val c = BuddyBudgetTheme.colors
    val up = (values.lastOrNull() ?: 0.0) >= (values.firstOrNull() ?: 0.0)
    Canvas(Modifier.size(36.dp, 24.dp).alpha(if (values.size < 2) 0f else 1f)) {
        drawPath(
            chartPath(ChartPaths.line(SparklineGeometry.points(values, 36.0, 24.0), ChartCurve.Linear), density),
            if (up) c.pos else c.neg, style = Stroke(1.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

@Composable
private fun ShowAll(count: Int) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    Box(
        Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable({ shell.open(AppDestination.Investments) }, RoundedCornerShape(BBRadius.md), translate = false)
            .padding(horizontal = BBSpacing.space1_5),
        contentAlignment = Alignment.CenterStart,
    ) { BBText(tr("Mostra tutti (") + "$count) →", style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W600), color = c.primary) }
}

@Composable
private fun ChangeChip(value: Double?) {
    value ?: return
    val c = BuddyBudgetTheme.colors
    BBText(
        BBFormat.formatSignedPct(value, LocalBBLocale.current),
        Modifier.background(if (value < 0) c.negSoft else c.posSoft, CircleShape).padding(horizontal = BBSpacing.space1_5, vertical = 2.dp),
        TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 11.sp, lineHeight = 14.sp, fontFeatureSettings = "tnum"),
        color = toneColor(value),
    )
}

@Composable
private fun SoftBadge(text: String) {
    val c = BuddyBudgetTheme.colors
    BBText(
        text,
        Modifier.background(c.negSoft, CircleShape).padding(horizontal = BBSpacing.space1_5, vertical = 2.dp),
        TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 10.sp, lineHeight = 12.sp),
        color = c.neg,
    )
}

// ---------------------------------------------------------------- Settings (SET-020, SET-021)

/** Per-device module switches, in Impostazioni › Aspetto e uso (the web's «Barra laterale» adapted to «Il tuo quadro»). */
@Composable
fun InsightsModulesSettingsSection() {
    val model = LocalShell.current.insights
    SettingsSection(
        tr("Il tuo quadro"), BBIcon.LayoutDashboard,
        description = tr("Scegli cosa vedere in «Il tuo quadro», nel menu Altro. Vale per questo dispositivo."),
    ) {
        SidebarModuleId.settingsOrder(model.retirement).forEachIndexed { index, module ->
            SettingsSwitchRow(
                tr(module.settingsLabel), model.isEnabled(module), { model.setEnabled(module, it) },
                hint = tr(module.settingsHint), first = index == 0,
            )
        }
    }
}
