package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.layout.layout
import io.buddybudget.core.domain.shell.LiquiditySegment
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBDonut
import io.buddybudget.app.designsystem.components.BBDonutSlice
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBListRow
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBSection
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTrendChart
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.bbGroup
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.LiquidityAnalysis
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.ExpensePeriod
import io.buddybudget.core.domain.periods.Periods
import io.buddybudget.core.domain.transactions.VoiceText

/**
 * Liquidità · Analisi (TX-052…061): period stepper, spend of the period with the cumulative curve and the dashed
 * «Di solito» line, «Dove vanno i soldi» (donut + expandable groups), «Da dove arrivano», «Risparmio accumulato».
 * Data: `GET /api/liquidity/analysis`. iOS: AnalysisScreen in AnalysisView.swift.
 */
@Composable
fun AnalysisScreen() {
    val model = LocalShell.current.liquidity
    val segment = LocalLiquiditySegment.current
    val locale = LocalBBLocale.current
    DisposableEffect(Unit) {
        model.analysisActive = true
        model.launch { model.loadAnalysis() }
        onDispose { model.analysisActive = false }
    }
    LiquidityChrome(model) {
        if (io.buddybudget.core.domain.shell.LiquidityNoAccounts.applies(model.accounts?.size)) {
            LiquidityNoAccountsState(io.buddybudget.core.domain.shell.LiquiditySegment.Analysis)
            return@LiquidityChrome
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            // Web `PeriodStepper`: arrows around the label (font-heading text-lg medium, min width 144).
            Row(Modifier.offset(x = -BBSpacing.space3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBIconButton(BBIcon.ChevronLeft, l10n(R.string.previous_period_239d85), color = BuddyBudgetTheme.colors.text2) { model.shiftPeriod(-1) }
                BBText(
                    Periods.formatPeriodLabel(model.period, model.periodRange, locale), Modifier.widthIn(min = 144.dp),
                    BBStyles.titleSmall.copy(textAlign = TextAlign.Center), maxLines = 1,
                )
                Box(Modifier.bbDisabled(!model.canGoForward)) {
                    BBIconButton(BBIcon.ChevronRight, l10n(R.string.next_period_bc59a9), color = BuddyBudgetTheme.colors.text2) { model.shiftPeriod(1) }
                }
            }
            SegmentedControl(
                listOf(
                    ExpensePeriod.MESE to l10n(R.string.month_b333e2), ExpensePeriod.TRE_MESI to l10n(R.string.s_3_months_f38291),
                    ExpensePeriod.ANNO to l10n(R.string.year_191852),
                ),
                model.period, { model.updatePeriod(it) }, accessibilityLabel = l10n(R.string.period_length_74744e),
            )
        }
        when (val a = model.analysis) {
            Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                BBSkeleton(height = 280.dp, radius = BBRadius.xl)
                BBSkeleton(height = 240.dp, radius = BBRadius.xl)
            }
            Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_analysis_data_429190), { model.launch { model.loadAnalysis() } })
            is Loadable.Loaded -> {
                if (debugShows(0)) SpendCard(a.value, model.currency)
                if (debugShows(1)) {
                    SpendByGroup(a.value, model.currency) { category ->
                        model.showCategory(category.id, category.name)
                        segment?.select(LiquiditySegment.Movements)
                    }
                }
                IncomeSources(a.value, model.currency)
                SavingsRow(a.value, model.currency)
            }
        }
    }
}

/** «Spese del periodo» (TX-053/054). */
@Composable
private fun SpendCard(analysis: LiquidityAnalysis, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    // No card around it (#417): the sentence, the figure as a hero and the chart edge to edge.
    Column {
        BBText(
            if (analysis.spent <= 0) l10n(R.string.there_are_no_expenses_in_this_period_yet_79d290)
            else if (hide) VoiceText.masked(analysis.sentence) else analysis.sentence,
            style = MonthVoice, color = c.text2,
        )
        Column(Modifier.padding(top = BBSpacing.space6), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(l10n(R.string.period_expenses_4ce576), BBTextStyle.BodyLarge, color = c.text2)
            io.buddybudget.app.designsystem.components.MoneyHero(analysis.spent, currency)
            if (analysis.spentBefore > 0) {
                val up = analysis.delta > 0
                Row(Modifier.padding(top = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    BBText(if (up) "▲" else "▼", BBTextStyle.BodyStrong, color = if (up) c.neg else c.pos)
                    AmountText(analysis.delta, currency, tone = if (up) AmountTone.Neg else AmountTone.Pos, signed = true, maximumFractionDigits = 0, style = BBTextStyle.BodyStrong.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600))
                    BBText(l10n(R.string.compared_with_the_previous_period_93751e), BBTextStyle.Body, color = c.text2, maxLines = 1)
                }
            }
        }
        val typical = if (analysis.isCurrentMonth) analysis.typical else null
        BBTrendChart(
            analysis.curve.map { it.value },
            { BBFormat.formatCurrency(it, currency, locale, maximumFractionDigits = 0) },
            reference = typical,
            labels = analysis.curve.map { p -> CalendarDate.parse(p.date)?.let { BBFormat.formatLongDate(it, locale) } ?: p.date },
            height = 220.dp, referenceLabel = l10n(R.string.usually_53a865), accessibilitySummary = l10n(R.string.period_expenses_4ce576),
            modifier = Modifier.padding(top = BBSpacing.space2).fullBleedChart(),
        )
        if (typical != null) BBText(l10n(R.string.the_dashed_line_is_your_average_spending_7a8f2e), BBTextStyle.Body, Modifier.padding(top = BBSpacing.space2), color = c.text2)
    }
}

/** «Dove vanno i soldi» (TX-055…057): donut by group, blocks sorted by amount with the top 5 categories. */
@Composable
private fun SpendByGroup(analysis: LiquidityAnalysis, currency: String, onCategory: (LiquidityAnalysis.GroupCategory) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val groups = analysis.groups.filter { it.amount > 0 }
    val total = groups.sumOf { it.amount }
    var selected by remember { mutableStateOf<Int?>(null) }
    var expanded by remember { mutableStateOf(setOf<String>()) }
    var showAll by remember { mutableStateOf(setOf<String>()) }
    // TX-074: link to Categorie, where the monthly budgets are set.
    val shell = io.buddybudget.app.features.shell.LocalShell.current
    BBSection(
        l10n(R.string.where_the_money_goes_e95a9b),
        actionLabel = if (analysis.hasBudgets) l10n(R.string.edit_budgets_b19bc2) else l10n(R.string.set_a_budget_b4f1af),
        onAction = { shell.push(io.buddybudget.app.features.shell.ShellRoute.Destination(io.buddybudget.core.domain.shell.AppDestination.Categories)) },
    ) {
        if (groups.isEmpty()) {
            BBText(l10n(R.string.no_expenses_to_display_for_this_period_a7888a), BBTextStyle.Body, color = c.mutedForeground)
            return@BBSection
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                BBDonut(
                    groups.mapIndexed { i, g -> BBDonutSlice(i, g.label, g.amount, bbGroup(g.key)) }, currency, selected,
                    { next ->
                        selected = next
                        if (next != null) groups.getOrNull(next)?.let { expanded = expanded + it.key }
                    },
                    centerLabel = l10n(R.string.in_expenses_23b28f), accessibilitySummary = l10n(R.string.where_the_money_goes_e95a9b),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                groups.forEachIndexed { index, group ->
                    GroupBlock(
                        group, total, currency, isOpen = group.key in expanded, showingAll = group.key in showAll,
                        dimmed = selected != null && selected != index,
                        onToggle = { expanded = if (group.key in expanded) expanded - group.key else expanded + group.key },
                        onToggleAll = { showAll = if (group.key in showAll) showAll - group.key else showAll + group.key },
                        onCategory = onCategory,
                    )
                }
            }
        }
    }
}

@Composable
private fun GroupBlock(
    group: LiquidityAnalysis.Group,
    total: Double,
    currency: String,
    isOpen: Boolean,
    showingAll: Boolean,
    dimmed: Boolean,
    onToggle: () -> Unit,
    onToggleAll: () -> Unit,
    onCategory: (LiquidityAnalysis.GroupCategory) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    val share = if (total > 0) group.amount / total else 0.0
    val count = group.categories.size
    val countLabel = if (count == 1) l10n(R.string.s_1_category_bc0141) else l10n(R.string.s_0_categories_aefb1d, count.toString())
    val visible = if (showingAll) group.categories else group.categories.take(5)
    Column(Modifier.fillMaxWidth().background(c.foreground.copy(alpha = 0.04f), shape)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).alpha(if (dimmed) 0.35f else 1f)
                .bbPressable(onToggle, shape, translate = false)
                .padding(vertical = BBSpacing.space3, horizontal = BBSpacing.space4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            Box(Modifier.size(10.dp).background(bbGroup(group.key), CircleShape))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(group.label, style = BBTextStyle.BodyLarge.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600), maxLines = 1)
                BBText(
                    l10n(R.string.s_0_of_spending_1_c8cd33, BBFormat.formatNumber(JSNumber.round(share * 100), locale, maximumFractionDigits = 0), countLabel),
                    BBTextStyle.Caption, color = c.text2, maxLines = 1,
                )
            }
            AmountText(group.amount, currency, style = BBStyles.rowAmount)
            BBIconView(if (isOpen) BBIcon.ChevronUp else BBIcon.ChevronDown, color = c.text3)
        }
        if (isOpen) {
            Column(Modifier.padding(bottom = BBSpacing.space2)) {
                for (category in visible) {
                    Row(
                        Modifier.fillMaxWidth()
                            .bbPressable({ onCategory(category) }, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                            .padding(vertical = BBSpacing.space2, horizontal = BBSpacing.space3),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                    ) {
                        BBIconBadge(BBIcon.category(category.icon), bbSwatch(category.color), 28.dp, 14.dp)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                            BBText(category.name, BBTextStyle.Body, maxLines = 1)
                            CategoryBar(category, group, currency)
                        }
                        AmountText(category.amount, currency, style = BBTextStyle.BodyStrong.style)
                    }
                }
                if (group.categories.size > 5) {
                    BBButton(
                        if (showingAll) l10n(R.string.show_less_e2935f) else l10n(R.string.show_all_0_b99f52, group.categories.size.toString()),
                        onToggleAll, Modifier.padding(horizontal = BBSpacing.space1), variant = BBButtonVariant.Link, size = BBButtonSize.Sm,
                    )
                }
            }
        }
    }
}

/**
 * TX-074 (web #432): with a budget the bar fills up to the budget (primary, negative once over) and says what is left;
 * without one it shows the category's share of its group.
 */
@Composable
private fun CategoryBar(category: LiquidityAnalysis.GroupCategory, group: LiquidityAnalysis.Group, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = io.buddybudget.app.designsystem.components.LocalHideAmounts.current
    val budget = category.budget
    if (budget == null || budget <= 0) {
        ProgressBar(BBProgressState.Determinate(category.amount, group.amount), label = category.name, color = bbSwatch(category.color))
        return
    }
    val over = category.amount > budget
    fun money(v: Double) = BBFormat.formatCurrency(v, currency, locale, maximumFractionDigits = 0, masked = hide)
    val used = l10n(R.string.budget_used_0_of_1_3ddce3, BBFormat.formatNumber(JSNumber.round(category.amount / budget * 100), locale, maximumFractionDigits = 0), money(budget))
    ProgressBar(BBProgressState.Determinate(minOf(category.amount, budget), budget), label = used, color = if (over) c.neg else c.primary)
    BBText(
        if (over) l10n(R.string.s_0_over_the_1_budget_094f52, money(category.amount - budget), money(budget))
        else l10n(R.string.s_0_left_of_the_1_budget_d15655, money(budget - category.amount), money(budget)),
        BBTextStyle.Caption, color = if (over) c.neg else c.text2,
    )
}

/** «Da dove arrivano» (TX-058). */
@Composable
private fun IncomeSources(analysis: LiquidityAnalysis, currency: String) {
    val locale = LocalBBLocale.current
    BBSection(l10n(R.string.where_it_comes_from_f0ecc5)) {
        if (analysis.incomeSources.isEmpty()) {
            BBText(l10n(R.string.no_income_in_this_period_f3c5d0), BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                for (source in analysis.incomeSources) {
                    io.buddybudget.app.designsystem.components.BBSoftRow(
                        source.name,
                        hint = source.quotaPct?.let { l10n(R.string.s_0_of_income_e6c33e, BBFormat.formatNumber(JSNumber.round(it), locale, maximumFractionDigits = 0)) },
                        leading = { BBIconBadge(BBIcon.category(source.icon), bbSwatch(source.color), 36.dp, 16.dp) },
                    ) { AmountText(source.amount, currency, tone = AmountTone.Pos, signed = true, style = BBStyles.rowAmount) }
                }
            }
        }
    }
}

/** «Risparmio accumulato» (TX-059). */
@Composable
private fun SavingsRow(analysis: LiquidityAnalysis, currency: String) {
    BBSection(l10n(R.string.accumulated_savings_c7ec24)) {
        io.buddybudget.app.designsystem.components.BBSoftRow(
            if (analysis.saved >= 0) l10n(R.string.saved_642b8a) else l10n(R.string.less_f85735),
            hint = l10n(R.string.income_minus_spending_month_by_month_ove_812adc),
        ) { AmountText(analysis.saved, currency, tone = AmountTone.Signed, signed = true, style = BBStyles.rowAmount) }
    }
}

/** Cancels the 16 dp screen gutter so a chart runs edge to edge. */
private fun Modifier.fullBleedChart(): Modifier = layout { measurable, constraints ->
    val extra = (BBSpacing.space4 * 2).roundToPx()
    val placeable = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.minWidth + extra))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}
