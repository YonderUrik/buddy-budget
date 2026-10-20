package io.buddybudget.app.features.analytics

import io.buddybudget.app.designsystem.components.bbSwatch
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.overview.overviewTokenColor
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.goals.GoalConstants
import io.buddybudget.core.domain.goals.GoalKind
import io.buddybudget.core.domain.goals.GoalsCapacityHeader
import io.buddybudget.core.domain.goals.GoalsGate
import io.buddybudget.core.domain.goals.GoalsRules
import io.buddybudget.core.domain.goals.GoalsText
import io.buddybudget.core.domain.goals.colorToken
import io.buddybudget.core.domain.goals.iconKey

// Obiettivi (12-goals): list with capacity header, priority list with arrows, FIRE row, «La strada», «Raggiunti»;
// empty state with the emergency-fund suggestion; goal detail. iOS: GoalsViews.swift.

/** Goal colours: swatches, `muted-foreground`, `neg`, `pos`. */
fun goalTokenColor(c: BBColors, token: String): Color = if (token == "muted-foreground") c.mutedForeground else overviewTokenColor(c, token)

@Composable
fun goalsText(currency: String): GoalsText {
    val strings = LocalStrings.current
    return GoalsText(LocalBBLocale.current, currency, LocalHideAmounts.current) { strings.lookup(it) }
}

/** Round tinted icon (`GoalIcon`): sm 32/16, md 40/20, lg 56/28. */
@Composable
fun GoalIcon(iconKey: String, colorToken: String, diameter: Dp = 40.dp) {
    BBIconBadge(BBIcon.forKey(iconKey) ?: BBIcon.Sparkles, goalTokenColor(BuddyBudgetTheme.colors, colorToken), diameter, diameter / 2)
}

/** Section heading of the goals screens (tinted 36 icon + font-heading text-lg). */
@Composable
fun GoalSectionHeading(icon: BBIcon, title: String, color: Color) {
    // #427: the display face with no icon (`icon`/`color` are kept for the call sites).
    BBText(title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
}

/** Progress of a goal: amber when late, green when reached, else primary. */
@Composable
fun GoalProgressBar(progress: Double, status: String, height: Dp = 6.dp) {
    val c = BuddyBudgetTheme.colors
    AnalyticsProgress(progress, height = height, color = when (status) { "in_ritardo" -> c.swatchAmber; "raggiunto" -> c.pos; else -> c.primary })
}

/** `GoalNote`: info icon + text-sm `--text-2`. */
@Composable
fun GoalNote(text: String) {
    val c = BuddyBudgetTheme.colors
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBIconView(BBIcon.Info, Modifier.padding(top = 2.dp), color = c.text3)
        BBText(text, BBTextStyle.Body, color = c.text2)
    }
}

@Composable
fun GoalsListView(model: AnalyticsModel) {
    LaunchedEffect(Unit) { model.loadGoals() }
    when (model.goals.gate) {
        GoalsGate.LOADING -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBSkeleton(height = 112.dp, radius = BBRadius.xl)
            BBSkeleton(height = 288.dp, radius = BBRadius.xl)
        }
        GoalsGate.FAILED -> LoadError(tr("Impossibile caricare gli obiettivi."), { model.retryGoals() })
        GoalsGate.UNAVAILABLE -> EmptyState(
            BBIcon.TriangleAlert, l10n(io.buddybudget.app.R.string.this_feature_is_not_available_for_german_1f0522),
            l10n(io.buddybudget.app.R.string.for_germany_tax_estimates_pensions_divid_952d6e), color = BuddyBudgetTheme.colors.swatchAmber,
        )
        GoalsGate.EMPTY -> model.goals.view?.let { view ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
                GoalsEmptyView(model, view)
                AnalyticsDisclaimer()
            }
        }
        GoalsGate.CONTENT -> model.goals.view?.let { view ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
                GoalsOverviewView(model, view)
                AnalyticsDisclaimer()
            }
        }
    }
}

/** GOAL-005 / GOAL-006. */
@Composable
private fun GoalsEmptyView(model: AnalyticsModel, view: GoalsView) {
    val c = BuddyBudgetTheme.colors
    val text = goalsText(view.currency)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        EmptyState(BBIcon.Target, tr("Dai un nome ai tuoi risparmi"),
            tr("Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve e da dove arrivano i soldi (conti o investimenti). Ti diciamo quando ci arrivi, se il risparmio basta per tutto e di quanto ogni obiettivo sposta il giorno in cui puoi smettere di lavorare."),
            primary = BBStateAction(tr("Nuovo obiettivo")) { model.openGoalForm(GoalFormRequest()) }, color = c.swatchAmber)
        GoalsRules.emergencySuggestion(view)?.let { (target, free) ->
            Column {
                Row(Modifier.padding(top = BBSpacing.space6), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    GoalIcon("shield-check", "swatch-teal")
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(tr("Da dove partire: un fondo di emergenza"), style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500))
                        BBText(tr(GoalsRules.emergencySuggestionSource(view),
                            mapOf("0" to GoalConstants.DEFAULT_EMERGENCY_MONTHS.toString(), "1" to text.money(target), "2" to text.money(free))), BBTextStyle.Body, color = c.text2)
                        BBButton(tr("Crea il fondo di emergenza"), { model.openGoalForm(GoalFormRequest(presetKind = GoalKind.EMERGENZA)) },
                            variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
                    }
                }
            }
        }
    }
}

@Composable
private fun GoalsOverviewView(model: AnalyticsModel, view: GoalsView) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val text = goalsText(view.currency)
    val open = GoalsRules.openGoals(view)
    val done = GoalsRules.doneGoals(view)
    val header = text.capacityHeader(view)
    var barSheet by remember { mutableStateOf(false) }
    // GOAL-036: the «⋯» menu of a row (the detail's actions).
    var menuGoal by remember { mutableStateOf<GoalView?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        if (debugShows(0)) Capacity(header, text) { barSheet = true }
        if (debugShows(1)) Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            GoalSectionHeading(BBIcon.ListOrdered, tr("In ordine di priorità"), c.swatchAmber)
            Column {
                open.forEachIndexed { i, goal ->
                    GoalRow(goal, text, compact = false, onOpen = { shell.push(ShellRoute.GoalRoute(goal.id)) }, onMenu = { menuGoal = goal },
                        onUp = if (i > 0 && !model.goals.reordering) ({ model.moveGoal(i, -1) }) else null,
                        onDown = if (i < open.size - 1 && !model.goals.reordering) ({ model.moveGoal(i, 1) }) else null)
                }
                view.fire?.let { FireGoalRow(it, text) { model.tab = AnalyticsTab.Risposte } }
            }
        }
        val stops = text.road(view)
        if (stops.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                GoalSectionHeading(BBIcon.Flag, tr("La strada"), c.swatchBlue)
                Box(Modifier.horizontalScroll(rememberScrollState())) {
                    Box(Modifier.matchParentSize()) { Box(Modifier.padding(top = 16.dp).fillMaxWidth().height(1.dp).background(c.border)) }
                    Row(Modifier.padding(bottom = BBSpacing.space2), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                        stops.forEach { s ->
                            Column(Modifier.widthIn(min = 96.dp, max = 120.dp), horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                                Box(Modifier.background(c.background, CircleShape)) { GoalIcon(s.iconKey, s.colorToken, 32.dp) }
                                BBText(s.`when`, style = BBTextStyle.BodyStrong.style.copy(textAlign = TextAlign.Center))
                                BBText(s.label, style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text3, maxLines = 2)
                            }
                        }
                    }
                }
                BBText(tr("Date al ritmo di oggi, senza contare la crescita degli investimenti assegnati."), BBTextStyle.Caption, color = c.text3)
            }
        }
        if (done.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                GoalSectionHeading(BBIcon.Trophy, tr("Raggiunti"), c.pos)
                Column {
                    done.forEachIndexed { i, goal ->
                        GoalRow(goal, text, compact = true, onOpen = { shell.push(ShellRoute.GoalRoute(goal.id)) }, onUp = null, onDown = null, onMenu = { menuGoal = goal })
                    }
                }
            }
        }
    }
    GoalActionsSheet(model, menuGoal, text) { menuGoal = null }
    BBSheet(barSheet, { barSheet = false }, title = header.title) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            header.segments.forEach { s ->
                Row(Modifier.heightIn(min = 32.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Box(Modifier.size(10.dp).background(goalTokenColor(c, s.colorToken), CircleShape))
                    BBText(s.label, BBTextStyle.Body, Modifier.weight(1f))
                    BBText((if (s.dashed) "−" else "") + text.money(s.value), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
                }
            }
        }
    }
}

/** GOAL-007: capacity header and the stacked bar (tap = segment list). */
@Composable
private fun Capacity(header: GoalsCapacityHeader, text: GoalsText, onBar: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        val title = buildAnnotatedString {
            withStyle(SpanStyle(color = c.foreground)) { append(header.title) }
            header.requested?.let { withStyle(SpanStyle(color = c.text2)) { append("\n" + it) } }
        }
        // Web `PAGE_TITLE_FACE` text-[2rem]: the condensed display face, light.
        BasicText(title, style = BBStyles.sectionHeading.copy(fontSize = 32.sp, lineHeight = 36.sp))
        BBText(header.explanation, BBTextStyle.Body, color = c.text2)
        val total = header.segments.sumOf { it.value }
        if (total > 0) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                val label = header.segments.joinToString(", ") { "${it.label} ${text.money(it.value)}" }
                BoxWithConstraints(Modifier.fillMaxWidth().height(32.dp).clip(RoundedCornerShape(BBRadius.lg))
                    .bbPressable(onBar, RoundedCornerShape(BBRadius.lg), translate = false).semantics { contentDescription = label }) {
                    val gaps = (header.segments.size - 1).coerceAtLeast(0) * 2
                    val barWidth = this.maxWidth.value
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        header.segments.forEach { s ->
                            val color = goalTokenColor(c, s.colorToken)
                            val w = ((barWidth - gaps) * (s.value / total).toFloat()).coerceAtLeast(0f).dp
                            Box(
                                Modifier.width(w).height(32.dp)
                                    .then(if (s.dashed) Modifier.drawBehind {
                                        drawRect(color, style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
                                    } else Modifier.background(color))
                                    .padding(horizontal = BBSpacing.space2),
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                BBText(text.segmentText(s), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W600), color = if (s.dashed) color else c.background,
                                    maxLines = 1)
                            }
                        }
                    }
                }
                Row {
                    BBText("0", BBTextStyle.Caption, color = c.text3)
                    Spacer(Modifier.weight(1f))
                    BBText(text.money(header.scaleMax), BBTextStyle.Caption, color = c.text3)
                }
            }
        }
    }
}

/** GOAL-008: one goal of the priority list (compact in «Raggiunti»). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GoalRow(goal: GoalView, text: GoalsText, compact: Boolean, onOpen: () -> Unit, onUp: (() -> Unit)?, onDown: (() -> Unit)?, onMenu: (() -> Unit)? = null) {
    val c = BuddyBudgetTheme.colors
    val kind = GoalKind.fromKey(goal.kind) ?: GoalKind.ALTRO
    val label = text.statusLabel(goal)
    val shift = if (compact) null else text.fireShift(goal)
    val labelColor = if (goal.status == "in_ritardo") c.swatchAmberDark else c.pos
    Row(Modifier.padding(vertical = if (compact) BBSpacing.space3 else BBSpacing.space4), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(Modifier.weight(1f).bbPressable(onOpen, RoundedCornerShape(BBRadius.md), translate = false), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            GoalIcon(kind.iconKey, kind.colorToken, if (compact) 32.dp else 40.dp)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                // `flex-wrap justify-between`: the amount moves under the name when both do not fit.
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText(goal.name, Modifier.padding(end = BBSpacing.space3), BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500), maxLines = 1)
                    AmountOf(text.money(goal.current), text.tr("di {0}", mapOf("0" to text.money(goal.target))), if (compact) 16 else 18)
                }
                GoalProgressBar(goal.progress, goal.status)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val sentence = buildAnnotatedString {
                        if (label != null) withStyle(SpanStyle(color = labelColor, fontWeight = FontWeight.W500)) { append("$label · ") }
                        withStyle(SpanStyle(color = c.text2)) { append(text.statusSentence(goal)) }
                    }
                    BasicText(sentence, style = BBTextStyle.Body.style)
                    if (shift != null) BBText(BBFormat.capitalize(shift) + ".", BBTextStyle.Body, color = c.text3)
                }
                if (!compact && goal.sources.isNotEmpty()) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        goal.sources.forEach { s ->
                            Row(Modifier.background(c.muted, CircleShape).padding(start = BBSpacing.space1, end = BBSpacing.space2_5, top = BBSpacing.space1, bottom = BBSpacing.space1),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                                GoalSourceIcon(s.kind, s.refId, s.name, s.accountColor, s.accountIcon, s.instrumentType, 20.dp)
                                BBText("${s.name} ${text.money(s.counted)}", BBTextStyle.Caption, color = c.text2, maxLines = 1)
                            }
                        }
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            if (onMenu != null) Arrow(BBIcon.Ellipsis, text.tr("Azioni per {0}", mapOf("0" to goal.name)), onMenu)
            if (!compact && (onUp != null || onDown != null)) {
                Arrow(BBIcon.ArrowUp, text.tr("Sposta {0} più in alto", mapOf("0" to goal.name)), onUp)
                Arrow(BBIcon.ArrowDown, text.tr("Sposta {0} più in basso", mapOf("0" to goal.name)), onDown)
            }
        }
    }
}

@Composable
private fun AmountOf(amount: String, of: String, size: Int) {
    val c = BuddyBudgetTheme.colors
    val t = buildAnnotatedString {
        withStyle(BBTextStyle.CardTitle.style.copy(fontSize = size.sp, lineHeight = 28.sp, color = c.foreground, fontFeatureSettings = "tnum").toSpanStyle()) { append(amount) }
        withStyle(BBTextStyle.Body.style.copy(color = c.text3).toSpanStyle()) { append(" $of") }
    }
    BasicText(t, maxLines = 1)
}

@Composable
private fun Arrow(icon: BBIcon, label: String, action: (() -> Unit)?) {
    Box(Modifier.size(36.dp).bbDisabled(action == null).bbPressable(action, RoundedCornerShape(BBRadius.md), pressedBackground = BuddyBudgetTheme.colors.muted,
        translate = false).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        BBIconView(icon, color = BuddyBudgetTheme.colors.foreground)
    }
}

/**
 * GOAL-037 (web #382): a source's icon — the account's own avatar, or the instrument's icon with its logo when there is
 * one; without data, nothing.
 */
@Composable
fun GoalSourceIcon(
    kind: String, refId: String, name: String, accountColor: String?, accountIcon: String?, instrumentType: String?, size: androidx.compose.ui.unit.Dp,
    /** Lists (32 dp) fall back to the group icon; chips show nothing. */
    fallback: Boolean = false,
) {
    val c = BuddyBudgetTheme.colors
    if (kind == "account") {
        if (accountColor != null && accountIcon != null) BBIconBadge(BBIcon.account(accountIcon), bbSwatch(accountColor), size, size * 0.5f)
        else if (fallback) BBIconBadge(BBIcon.Landmark, c.swatchTeal, size, size * 0.5f)
        return
    }
    if (instrumentType != null) {
        io.buddybudget.app.features.investments.InstrumentIconView(io.buddybudget.core.data.Instrument(id = refId, name = name, type = instrumentType), size)
    } else if (fallback) {
        BBIconBadge(BBIcon.TrendingUp, c.swatchBlue, size, size * 0.5f)
    }
}

/** GOAL-036 (web #382): the «⋯» actions of a row, as a sheet: the same as the detail's buttons. */
@Composable
private fun GoalActionsSheet(model: AnalyticsModel, goal: GoalView?, text: GoalsText, onClose: () -> Unit) {
    var shown by remember { mutableStateOf(goal) }
    if (goal != null) shown = goal
    BBSheet(goal != null, onClose, title = shown?.name) {
        val g = shown ?: return@BBSheet
        Column {
            io.buddybudget.app.features.liquidity.SheetActionRow(BBIcon.Pencil, text.tr("Modifica")) {
                onClose()
                model.openGoalForm(GoalFormRequest(g.id, io.buddybudget.core.domain.goals.GoalFormStep.TIPO))
            }
            if (g.achievedAt == null) {
                io.buddybudget.app.features.liquidity.SheetActionRow(BBIcon.PiggyBank, text.tr("Aggiorna i soldi da parte")) {
                    onClose()
                    model.openGoalForm(GoalFormRequest(g.id, io.buddybudget.core.domain.goals.GoalFormStep.FONTI))
                }
            }
            io.buddybudget.app.features.liquidity.SheetActionRow(
                if (g.achievedAt != null) BBIcon.RotateCcw else BBIcon.CircleCheck,
                if (g.achievedAt != null) text.tr("Riapri") else text.tr("Segna come raggiunto"),
            ) {
                onClose()
                model.toggleAchieved(g)
            }
            io.buddybudget.app.features.liquidity.SheetActionRow(BBIcon.Trash2, text.tr("Elimina"), destructive = true) {
                onClose()
                model.deleteError = null
                model.confirmDeleteGoal = g.id
            }
        }
    }
    val deleting = model.confirmDeleteGoal?.let { id -> model.goals.view?.goal(id) }
    BBAlertSheet(
        deleting != null && model.confirmDeleteGoal != null && goal == null,
        text.tr("Eliminare «{0}»?", mapOf("0" to (deleting?.name ?: ""))),
        text.tr("L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere."),
        text.tr("Elimina"),
        onConfirm = {
            val id = model.confirmDeleteGoal ?: return@BBAlertSheet
            model.launch {
                if (!model.deleteGoal(id)) model.deleteError?.let { model.env.toasts.show(io.buddybudget.app.designsystem.components.BBToastKind.Error, it) }
            }
        },
        onDismiss = { model.confirmDeleteGoal = null },
    )
}

/** GOAL-011: «Smettere di lavorare» → Risposte. */
@Composable
private fun FireGoalRow(fire: GoalsView.Fire, text: GoalsText, onOpen: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(Modifier.fillMaxWidth().bbPressable(onOpen, RoundedCornerShape(BBRadius.md), translate = false).padding(vertical = BBSpacing.space4),
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        GoalIcon(GoalsRules.FIRE_ICON_KEY, GoalsRules.FIRE_COLOR_TOKEN)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(text.tr("Smettere di lavorare"), Modifier.weight(1f), BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500), maxLines = 1)
                AmountOf(text.money(fire.wealth), text.tr("di {0}", mapOf("0" to text.money(fire.target))), 18)
            }
            AnalyticsProgress(fire.progress.coerceIn(0.0, 1.0), height = 6.dp, color = goalTokenColor(c, GoalsRules.FIRE_COLOR_TOKEN))
            BBText(text.fireSentence(fire), BBTextStyle.Body, color = c.text2)
        }
    }
}

// ---------------------------------------------------------------- Detail (GOAL-027…033)

@Composable
fun GoalDetailScreen(goalId: String) {
    val shell = LocalShell.current
    val model = shell.analytics
    val back = LocalShellBack.current
    LaunchedEffect(Unit) { model.loadGoals() }
    BBScreen(null, onBack = back, onRefresh = { model.loadGoals(force = true) }) {
        val view = model.goals.view
        when {
            view != null -> {
                val goal = view.goal(goalId)
                if (goal != null) GoalDetailContent(model, view, goal, goalsText(view.currency))
                else EmptyState(BBIcon.Target, tr("Obiettivo non trovato"), tr("Forse è stato eliminato."), Modifier.padding(top = BBSpacing.space4),
                    primary = BBStateAction(tr("Torna agli obiettivi")) { back?.invoke() }, color = BuddyBudgetTheme.colors.swatchAmber)
            }
            model.goals.failed -> LoadError(tr("Impossibile caricare l'obiettivo."), { model.retryGoals() })
            else -> BBSkeleton(height = 288.dp, radius = BBRadius.xl)
        }
    }
    GoalFormPresenter(model)
    BBAlertSheet(
        model.confirmDeleteGoal == goalId,
        tr("Eliminare «{0}»?", mapOf("0" to (model.goals.view?.goal(goalId)?.name ?: ""))),
        tr("L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere."),
        tr("Elimina"),
        onConfirm = {
            model.launch {
                if (model.deleteGoal(goalId)) back?.invoke()
                else model.deleteError?.let { model.env.toasts.show(io.buddybudget.app.designsystem.components.BBToastKind.Error, it) }
            }
        },
        onDismiss = { model.confirmDeleteGoal = null },
    )
}

@Composable
private fun GoalDetailContent(model: AnalyticsModel, view: GoalsView, goal: GoalView, text: GoalsText) {
    val c = BuddyBudgetTheme.colors
    val kind = GoalKind.fromKey(goal.kind) ?: GoalKind.ALTRO
    val label = text.statusLabel(goal)
    val tax = goal.sources.sumOf { it.tax }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                GoalIcon(kind.iconKey, kind.colorToken, 56.dp)
                BBText(goal.name, Modifier.semantics { heading() }, BBTextStyle.PageTitle.style)
            }
            io.buddybudget.app.designsystem.components.MoneyHero(goal.current, text.currency)
            BBText(text.targetLine(goal), BBTextStyle.BodyLarge, color = c.text2)
            GoalProgressBar(goal.progress, goal.status, 8.dp)
            if (label != null) BBText("$label.", style = BBStyles.sectionHeading)
            BBText(text.statusSentence(goal), BBTextStyle.BodyLarge, color = c.text2)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            GoalSectionHeading(BBIcon.ArrowLeftRight, text.tr("Da dove arrivano i soldi"), c.swatchBlue)
            if (goal.sources.isEmpty()) {
                BBText(text.tr("Nessun conto o titolo assegnato: l'obiettivo cresce solo con la quota del mese, quando aggiorni quanto hai messo da parte."),
                    BBTextStyle.Body, color = c.text2)
            }
            listOf(Triple("account", "Liquidità", BBIcon.Landmark to c.swatchTeal), Triple("instrument", "Investimenti", BBIcon.TrendingUp to c.swatchBlue)).forEach { (k, title, ic) ->
                val items = goal.sources.filter { it.kind == k }
                if (items.isNotEmpty()) Column {
                    BBText(text.tr(title), BBTextStyle.Overline, Modifier.padding(bottom = BBSpacing.space1_5), color = c.text3)
                    items.forEachIndexed { i, s ->
                        Row(Modifier.padding(vertical = BBSpacing.space3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            // GOAL-037: the account's avatar or the instrument's icon.
                            GoalSourceIcon(s.kind, s.refId, s.name, s.accountColor, s.accountIcon, s.instrumentType, 32.dp, fallback = true)
                            Column(Modifier.weight(1f)) {
                                BBText(s.name, style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500), maxLines = 1)
                                BBText(text.sourceDetail(s), BBTextStyle.Body, color = c.text3)
                            }
                            BBText(text.money(s.counted), style = BBTextStyle.CardTitle.style.copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
            }
            if (tax > 0) GoalNote(text.tr("Per i titoli contiamo il valore al netto dell'imposta stimata se vendessi oggi, con l'aliquota del titolo e senza le minusvalenze da compensare: la scheda Tasse fa il calcolo completo."))
        }
        if (goal.status != "raggiunto") {
            val (value, caption) = text.wealthImpact(goal)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                GoalSectionHeading(BBIcon.Flag, text.tr("Cosa cambia quando lo raggiungi"), c.swatchAmber)
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                    ImpactCell(text.tr("Patrimonio"), value, caption)
                    ImpactCell(text.tr("Smetti di lavorare"), view.fire?.withGoalsYear?.toString() ?: "—",
                        text.fireShift(goal) ?: text.tr("serve sapere spesa e risparmio nelle Risposte"))
                }
            }
        }
        // Web: the actions wrap as pills, «Elimina» as a quiet red text button.
        GoalActionsFlow {
            BBButton(text.tr("Aggiorna i soldi da parte"), { model.openGoalForm(GoalFormRequest(goal.id, io.buddybudget.core.domain.goals.GoalFormStep.FONTI)) },
                size = BBButtonSize.Touch, enabled = !model.goalBusy)
            BBButton(text.tr("Modifica"), { model.openGoalForm(GoalFormRequest(goal.id, io.buddybudget.core.domain.goals.GoalFormStep.TIPO)) },
                variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !model.goalBusy)
            BBButton(if (goal.achievedAt != null) text.tr("Riapri") else text.tr("Segna come raggiunto"), { model.toggleAchieved(goal) },
                variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !model.goalBusy)
            val c = BuddyBudgetTheme.colors
            Box(Modifier.height(BBLayout.minTouchTarget).bbPressable({
                if (!model.goalBusy) {
                    model.deleteError = null
                    model.confirmDeleteGoal = goal.id
                }
            }, CircleShape, pressedBackground = c.muted, translate = false).padding(horizontal = BBSpacing.space4), contentAlignment = Alignment.Center) {
                BBText(text.tr("Elimina"), style = BBTextStyle.Button.style, color = c.neg)
            }
        }
        AnalyticsDisclaimer()
    }
}

@Composable
private fun ImpactCell(label: String, value: String, caption: String) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(label, BBTextStyle.Body, color = c.text2)
            BBText(value, style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"))
            BBText(caption, BBTextStyle.Body, color = c.text3)
        }
    }
}

/** Wrapping row of the goal actions. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun GoalActionsFlow(content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) { content() }
}
