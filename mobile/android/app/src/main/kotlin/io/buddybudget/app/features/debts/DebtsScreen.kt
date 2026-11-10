package io.buddybudget.app.features.debts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSlider
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.DebtsInsights
import io.buddybudget.core.data.DebtsViewData
import io.buddybudget.core.domain.debts.DebtsRules
import io.buddybudget.core.domain.debts.DebtsText
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.roundToInt

/**
 * Debiti overview «Priorità e azioni» (10-debts §1): hero, «Prossime rate», «I tuoi debiti», «Come uscirne prima»,
 * «Dove paghi di più» — phone order of the web. `Aggiungi` opens the add flow from every Debiti screen.
 * Twin of `DebtsScreen` on iOS.
 */
@Composable
fun DebtsScreen() {
    val shell = LocalShell.current
    val model = shell.debts
    LaunchedEffect(Unit) { model.start() }
    val version = remember { mutableStateOf(shell.dataVersion) }
    LaunchedEffect(shell.dataVersion) {
        if (version.value != shell.dataVersion) {
            version.value = shell.dataVersion
            model.load()
        }
    }
    BBScreen(tr("Debiti"), onBack = LocalShellBack.current, onRefresh = { model.load() }, actions = {
        BBButton(tr("Aggiungi"), { model.addOpen = true }, Modifier.padding(end = BBSpacing.space2), icon = BBIcon.Plus,
            variant = io.buddybudget.app.designsystem.components.BBButtonVariant.Sun, size = BBButtonSize.Lg)
    }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            BBText(tr("Cosa pagare, cosa pesa, come uscirne"), BBTextStyle.Body, Modifier.offset(y = -BBSpacing.space3),
                color = BuddyBudgetTheme.colors.mutedForeground)
            DebtsGateView(model) { DebtsOverviewContent(model) }
        }
    }
    DebtsDialogs(model)
}

@Composable
fun debtsText(): DebtsText {
    val strings = LocalStrings.current
    return DebtsText(LocalBBLocale.current) { strings.lookup(it) }
}

/** DEBT-008: loading, error with retry, empty state with «Aggiungi un finanziamento». */
@Composable
fun DebtsGateView(model: DebtsModel, content: @Composable () -> Unit) {
    when (model.state.gate) {
        io.buddybudget.core.domain.debts.DebtsGate.Loading -> { val loadingLabel = l10n(L10n.loading); Column(
            Modifier.semantics { contentDescription = loadingLabel }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space8),
        ) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 176.dp, radius = BBRadius.xl)
            BBSkeleton(Modifier.fillMaxWidth(), height = 256.dp, radius = BBRadius.xl)
        } }
        io.buddybudget.core.domain.debts.DebtsGate.Failed -> LoadError(tr("Impossibile caricare i debiti."), { model.retry() })
        io.buddybudget.core.domain.debts.DebtsGate.Empty -> EmptyState(
            BBIcon.Landmark, tr("Tieni d'occhio i tuoi debiti"),
            tr("Aggiungi un finanziamento, nuovo o già in corso: vedrai il piano rata per rata, quanto paghi di interessi e quando finisci."),
            primary = BBStateAction(tr("Aggiungi un finanziamento")) { model.addOpen = true },
        )
        io.buddybudget.core.domain.debts.DebtsGate.Content -> content()
    }
}

@Composable
private fun DebtsOverviewContent(model: DebtsModel) {
    val text = debtsText()
    val state = model.state
    val data = state.data ?: return
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) DebtsHero(data.overview.totalDebt, model.currency,
            text.heroSubtitle(DebtsRules.openCount(data.debts), DebtsRules.freeDate(data.debts)))
        if (debugShows(1) && data.overview.nextDue.isNotEmpty()) DebtsUpcomingSection(model, data, text)
        if (debugShows(2)) DebtsListSection(model, data, text)
        val plan = state.exitPlan
        if (debugShows(3) && plan != null) DebtsExitSection(model, plan, text)
        state.interest?.let { DebtsInterestSection(model, it) }
    }
}

/** DEBT-002. */
@Composable
private fun DebtsHero(total: Double, currency: String, subtitle: String) {
    val c = BuddyBudgetTheme.colors
    val label = tr("Debito totale")
    Column(Modifier.semantics(mergeDescendants = true) { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(tr("Ancora da restituire"), BBTextStyle.Body, color = c.mutedForeground)
        MoneyHero(total, currency)
        BBText(subtitle, BBTextStyle.Body, color = c.mutedForeground)
    }
}

/** DEBT-003/004. */
@Composable
private fun DebtsUpcomingSection(model: DebtsModel, data: DebtsViewData, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    PanelSection(tr("Prossime rate"), BBIcon.CalendarClock, color = c.neg) {
        Column {
            data.overview.nextDue.forEachIndexed { index, item ->
                val days = DebtsRules.daysBetween(model.state.today, item.date)
                val row = DebtsRules.dueRow(data.debt(item.debtId), item.date)
                Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space3), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    DateTile(item.date, highlight = index == 0 && !item.overdue, overdue = item.overdue)
                    Column(Modifier.weight(1f)) {
                        BBText(item.name, BBTextStyle.BodyStrong, maxLines = 1)
                        BBText(text.dueText(days), BBTextStyle.Caption, color = if (item.overdue) c.neg else c.mutedForeground)
                    }
                    AmountText(item.amount, model.currency, style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500))
                    val label = tr("Segna pagata la rata di {0}", mapOf("0" to item.name))
                    Box(
                        Modifier.size(36.dp).bbDisabled(row == null).border(2.dp, c.border, CircleShape).clip(CircleShape)
                            .bbPressable({ if (row != null) model.paying = item.debtId to row }, CircleShape, enabled = row != null)
                            .semantics { contentDescription = label },
                        contentAlignment = Alignment.Center,
                    ) {}
                }
            }
        }
    }
}

/** Day + abbreviated month tile. */
@Composable
fun DateTile(date: String, highlight: Boolean = false, overdue: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    val d = CalendarDate.parse(date)
    val fg = if (overdue) c.neg else if (highlight) c.primary else c.mutedForeground
    val bg = if (overdue) c.negSoft else if (highlight) c.alphaPrimary10 else Color.Transparent
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        Modifier.size(44.dp).background(bg, shape).border(1.dp, if (highlight || overdue) Color.Transparent else c.border, shape),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        BBText(d?.day?.toString() ?: "", style = BBTextStyle.CardTitle.style.copy(lineHeight = 18.sp), color = fg)
        BBText(d?.let { BBFormat.shortMonthLabel(it.month, LocalBBLocale.current) } ?: "", style = BBTextStyle.Micro.style.copy(fontWeight = FontWeight.W600), color = fg)
    }
}

/** DEBT-005. */
@Composable
private fun DebtsListSection(model: DebtsModel, data: DebtsViewData, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    PanelSection(tr("I tuoi debiti"), BBIcon.Landmark, color = c.primary) {
        Column {
            data.debts.forEachIndexed { index, debt ->
                Row(
                    Modifier.fillMaxWidth().bbPressable({ model.select(debt.id); shell.push(ShellRoute.DebtRoute(debt.id)) }, RoundedCornerShape(BBRadius.lg),
                        pressedBackground = c.alphaMuted50, translate = false).padding(vertical = BBSpacing.space3_5),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        BBText(debt.name, BBTextStyle.BodyStrong, maxLines = 1)
                        ShareBar(DebtsRules.repaidShare(debt, data.insights))
                        BBText(text.listDetail(debt), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    AmountText(debt.totals.residual, model.currency, maximumFractionDigits = 0, style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500))
                    BBIconView(BBIcon.ChevronRight, size = 16.dp, color = c.mutedForeground)
                }
            }
        }
    }
}

/** 6 dp progress bar (`--border` track, `--primary` fill). */
@Composable
fun ShareBar(fraction: Double, height: androidx.compose.ui.unit.Dp = 6.dp) {
    val c = BuddyBudgetTheme.colors
    Box(Modifier.fillMaxWidth().height(height).clip(CircleShape).background(c.border)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0.0, 1.0).toFloat()).fillMaxHeight().clip(CircleShape).background(c.primary))
    }
}

/** DEBT-006. */
@Composable
private fun DebtsExitSection(model: DebtsModel, plan: DebtsInsights.ExitPlan, text: DebtsText) {
    val c = BuddyBudgetTheme.colors
    PanelSection(tr("Come uscirne prima"), BBIcon.Route, color = c.pos,
        description = tr("Quanto potresti mettere in più ogni mese? Quell'extra e le rate dei debiti che chiudi vanno prima al tasso più alto.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            ExtraSlider(model.state.exitExtra, { model.setExitExtra(it) }, model.currency)
            Column {
                plan.steps.forEachIndexed { index, step ->
                    Box {
                        if (index < plan.steps.size - 1) {
                            Box(Modifier.padding(start = 8.dp, top = 32.dp).width(2.dp).height(40.dp).background(c.border))
                        }
                        Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space2_5), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            Box(Modifier.size(18.dp).border(2.dp, c.border, CircleShape).padding(2.dp).background(c.background, CircleShape).padding(3.dp)
                                .background(c.primary, CircleShape))
                            Column(Modifier.weight(1f)) {
                                BBText(step.name, BBTextStyle.BodyStrong, maxLines = 1)
                                BBText(text.exitStep(step), BBTextStyle.Caption, color = c.mutedForeground)
                            }
                            if (step.monthsSaved > 0) {
                                BBText("${BBFormat.MINUS_SIGN}${text.duration(step.monthsSaved)}", style = BBTextStyle.Badge.style.copy(fontWeight = FontWeight.W600),
                                    color = c.primary, modifier = Modifier.background(c.alphaPrimary10, CircleShape)
                                        .padding(horizontal = BBSpacing.space2_5, vertical = BBSpacing.space0_5))
                            }
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = BBSpacing.space2), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    BBText(tr("Libero da debiti"), style = BBTextStyle.Body.style.copy(fontWeight = FontWeight.W500), color = c.mutedForeground)
                    BBText(text.monthYear(plan.endDate), style = BBStyles.figure)
                }
                Column(horizontalAlignment = Alignment.End) {
                    BBText(tr("Interessi risparmiati"), style = BBTextStyle.Body.style.copy(fontWeight = FontWeight.W500), color = c.mutedForeground)
                    AmountText(plan.interestSaved, model.currency, tone = AmountTone.Auto, maximumFractionDigits = 0, style = BBStyles.figure)
                }
            }
            BBText(tr("Stima semplificata (rate e tassi costanti, nessuna penale): serve a confrontare, non a prevedere gli importi esatti."),
                BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** «Extra al mese» label + amount + slider 0–1000 step 50 (DEBT-006, DEBT-030). */
@Composable
fun ExtraSlider(value: Double, onChange: (Double) -> Unit, currency: String) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            BBText(tr("Extra al mese"), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500), color = c.mutedForeground, modifier = Modifier.weight(1f))
            AmountText(value, currency, maximumFractionDigits = 0, style = BBStyles.figure)
        }
        BBSlider(value, onChange, range = 0.0..DebtsRules.EXTRA_MAX, step = DebtsRules.EXTRA_STEP, accessibilityLabel = tr("Extra al mese"))
    }
}

/** DEBT-007. */
@Composable
private fun DebtsInterestSection(model: DebtsModel, interest: DebtsInsights.InterestShares) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val tones = listOf(1f, 0.7f, 0.45f, 0.25f)
    fun tone(i: Int) = c.primary.copy(alpha = tones[minOf(i, tones.size - 1)])
    PanelSection(tr("Dove paghi di più"), BBIcon.Coins, color = c.swatchAmber) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Column {
                AmountText(interest.total, model.currency, style = BBStyles.hero.copy(fontSize = 30.sp, lineHeight = 36.sp), hero = true)
                BBText(tr("di interessi in un anno, ai saldi e ai tassi di oggi"), BBTextStyle.Body, color = c.mutedForeground)
            }
            val summary = interest.items.joinToString(", ") { "${it.name} ${(it.share * 100).roundToInt()}%" }
            BoxWithConstraints(Modifier.fillMaxWidth().height(12.dp).clip(CircleShape).background(c.border).semantics { contentDescription = summary }) {
                val full = maxWidth
                Row {
                    interest.items.forEachIndexed { i, item -> Box(Modifier.width(full * item.share.toFloat()).fillMaxHeight().background(tone(i))) }
                }
            }
            Column {
                interest.items.forEachIndexed { index, item ->
                    Row(
                        Modifier.fillMaxWidth().bbPressable({ model.select(item.id); shell.push(ShellRoute.DebtRoute(item.id)) }, RoundedCornerShape(BBRadius.lg),
                            translate = false).padding(vertical = BBSpacing.space2_5),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                    ) {
                        Box(Modifier.size(12.dp).background(tone(index), RoundedCornerShape(BBRadius.sm)))
                        BBText(item.name, BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 1)
                        AmountText(item.yearly, model.currency, maximumFractionDigits = 0, style = BBStyles.rowAmount.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.W500))
                        BBText("${(item.share * 100).roundToInt()}%", style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum", textAlign = TextAlign.End),
                            color = c.mutedForeground, modifier = Modifier.width(40.dp))
                    }
                }
            }
        }
    }
}

/** The dialogs every Debiti screen can open: add flow, pay installment. */
@Composable
fun DebtsDialogs(model: DebtsModel) {
    io.buddybudget.app.designsystem.components.FormDialog(model.addOpen, { model.addOpen = false }) {
        if (model.addOpen) AddDebtFlow(model)
    }
    val paying = model.paying
    io.buddybudget.app.designsystem.components.FormDialog(paying != null, { model.paying = null }) {
        if (paying != null) PayInstallmentView(model, paying.first, paying.second)
    }
}
