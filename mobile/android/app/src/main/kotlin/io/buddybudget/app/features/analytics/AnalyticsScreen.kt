package io.buddybudget.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSlider
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import io.buddybudget.app.tr
import io.buddybudget.core.data.AnalyticsView
import io.buddybudget.core.domain.analytics.AnalyticsAnswerTile
import io.buddybudget.core.domain.analytics.AnalyticsGate
import io.buddybudget.core.domain.analytics.AnalyticsHeadline
import io.buddybudget.core.domain.analytics.AnalyticsPeriodChoice
import io.buddybudget.core.domain.analytics.AnalyticsRules
import io.buddybudget.core.domain.analytics.AnalyticsText
import io.buddybudget.core.domain.analytics.AnalyticsTextPart
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireFigureSource
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.FirePlanning
import io.buddybudget.core.domain.fire.FireReturnSource
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.format.BBFormat

@Composable
fun analyticsText(): AnalyticsText {
    val strings = LocalStrings.current
    return AnalyticsText(LocalBBLocale.current, LocalHideAmounts.current) { strings.lookup(it) }
}

/**
 * Analitiche frame (11-analytics, 12-goals): title, subtitle of the view, «Risposte | Obiettivi», `Guida` (Risposte) or
 * `+` (Obiettivi), the states and the disclaimer. IT only: DE never gets here (route policy, ANA-001 / GOAL-002); a 403
 * shows the country-unavailable state. Twin of `AnalyticsScreen` on iOS.
 */
@Composable
fun AnalyticsScreen() {
    val shell = LocalShell.current
    val model = shell.analytics
    val c = BuddyBudgetTheme.colors
    LaunchedEffect(Unit) { model.start() }
    val version = remember { mutableStateOf(shell.dataVersion) }
    LaunchedEffect(shell.dataVersion) {
        if (version.value != shell.dataVersion) {
            version.value = shell.dataVersion
            model.load()
        }
    }
    CompositionLocalProvider(LocalAnalyticsTerm provides { model.termId = it }) {
        BBScreen(null, onBack = LocalShellBack.current, onRefresh = { model.refresh().join() }) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
                // #427: «Risposte ⌄» / «Obiettivi ⌄» open the views sheet; `Guida` (outline) or the yellow `+` beside it.
                io.buddybudget.app.designsystem.components.SectionViewsHeading(
                    tr("Analitiche"),
                    AnalyticsTab.entries.map { tab ->
                        io.buddybudget.app.designsystem.components.SectionViewItem(tab.name, tr(tab.title), tr(tab.viewDescription), BBIcon.forKey(tab.iconKey), tab == model.tab) {
                            model.tab = tab
                            if (tab == AnalyticsTab.Obiettivi) model.loadGoalsAsync()
                        }
                    },
                    Modifier.padding(top = BBSpacing.space4),
                ) {
                    if (model.tab == AnalyticsTab.Risposte) {
                        BBButton(tr("Guida"), { model.openWalkthrough() }, icon = BBIcon.CircleQuestionMark, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                    } else {
                        io.buddybudget.app.designsystem.components.BBSunIconButton(tr("Nuovo obiettivo")) { model.openGoalForm(GoalFormRequest()) }
                    }
                }
                if (model.tab == AnalyticsTab.Risposte) AnalyticsGateView(model) else GoalsListView(model)
            }
        }
        AnalyticsDialogs(model)
        GoalFormPresenter(model)
    }
}

@Composable
private fun AnalyticsGateView(model: AnalyticsModel) {
    when (model.state.gate) {
        AnalyticsGate.LOADING -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBSkeleton(height = 160.dp, radius = BBRadius.xl)
            BBSkeleton(height = 256.dp, radius = BBRadius.xl)
        }
        AnalyticsGate.FAILED -> LoadError(tr("Impossibile caricare i dati di Analitiche."), { model.retry() })
        AnalyticsGate.UNAVAILABLE -> io.buddybudget.app.features.shell.CountryUnavailableState()
        AnalyticsGate.CONTENT -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            RisposteView(model)
            AnalyticsDisclaimer()
        }
    }
}

/** ANA-004 / GOAL page footer. */
@Composable
fun AnalyticsDisclaimer() {
    BBText(
        tr("Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti."),
        BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground,
    )
}

// ---------------------------------------------------------------------------------------------- Risposte

@Composable
private fun RisposteView(model: AnalyticsModel) {
    val text = analyticsText()
    val c = BuddyBudgetTheme.colors
    val view = model.state.view ?: return
    val saved = model.state.savedPlan ?: return
    val plan = model.state.scenarioPlan ?: return
    val a = model.state.scenarioAssumptions ?: return
    val costs = AnalyticsRules.costs(view.base, view.assumptions.terByInstrument, model.env.session.country)
    val lasting = model.results?.let { text.lastingAnswer(it, a.rule, a.retirementYears) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        if (debugShows(0)) HeadlineView(text.headline(plan, saved, model.todayYear))
        if (debugShows(1)) PeriodPicker(model, view, text)
        if (debugShows(2)) SlidersView(model, view, saved, text)
        val error = model.state.saveError
        if (error != null && !model.assumptionsOpen) BBText(error, BBTextStyle.Body, color = c.neg)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            if (debugShows(3)) AnswerTiles(model, text.tiles(plan, model.state.hasScenario, model.todayYear, lasting, a.retirementYears, costs, view.currency, model.simulating))
            AnalyticsQuestionView(model, view, plan, a, saved, text, costs, lasting)
        }
    }
}

/** ANA-009 / ANA-010. */
@Composable
private fun HeadlineView(h: AnalyticsHeadline) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(h.lead, BBTextStyle.BodyLarge, color = c.mutedForeground)
        if (h.missing) {
            BBText(h.big, BBTextStyle.AmountLarge)
            h.sub?.let { BBText(it, BBTextStyle.Body, color = c.mutedForeground) }
        } else {
            // Web: the figure and «tra 12,3 anni» share the baseline.
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(h.big, Modifier.alignByBaseline(), style = BBStyles.hero)
                h.sub?.let { BBText(it, Modifier.alignByBaseline().weight(1f, fill = false), style = BBTextStyle.BodyLarge.style.copy(fontSize = 18.sp, lineHeight = 28.sp), color = c.mutedForeground) }
            }
            h.comparison?.let {
                BBText(it, style = BBTextStyle.BodyLarge.style.copy(fontSize = 18.sp, lineHeight = 28.sp, fontWeight = FontWeight.W600),
                    color = if (h.positive) c.pos else c.neg)
            }
        }
    }
}

/** ANA-011…013: «I tuoi dati di» + the shared `PeriodSelector` (12 mesi, 24 mesi, month calendar), then the range used. */
@Composable
private fun PeriodPicker(model: AnalyticsModel, view: AnalyticsView, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val state = model.state
    val strings = io.buddybudget.app.generated.LocalStrings.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBText(tr("I tuoi dati di"), BBTextStyle.Body, color = c.mutedForeground)
            io.buddybudget.app.designsystem.components.PeriodSelector(
                listOf(AnalyticsPeriodChoice.TWELVE to tr("12 mesi"), AnalyticsPeriodChoice.TWENTY_FOUR to tr("24 mesi")),
                AnalyticsPeriodChoice.of(state.period),
                { if (it != AnalyticsPeriodChoice.CUSTOM) model.choosePeriod(it) },
                accessibilityLabel = tr("Periodo dei tuoi dati"),
                custom = io.buddybudget.app.designsystem.components.PeriodCustom(
                    AnalyticsPeriodChoice.CUSTOM, state.customPeriodRange, io.buddybudget.core.domain.periods.RangeGranularity.Month,
                    min = state.customPeriodMin, max = state.customPeriodMax,
                    validate = { r -> AnalyticsRules.customPeriodError(r.from, r.to, state.today)?.let { strings.lookup(it.source, it.values) } },
                    showCaption = false,
                    onApply = { r -> if (!state.saving) model.applyCustomPeriod(r) },
                ),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(if (model.updatingPeriod) tr("Aggiorno le cifre…") else text.rangeText(view.base.cashflow.fromKey, view.base.cashflow.toKey),
                BBTextStyle.Caption, color = c.mutedForeground)
            AnalyticsInfoButton(tr("Cosa cambia il periodo"),
                tr("Risparmio, spesa e rendimento vengono dai tuoi movimenti e investimenti di questi mesi. Il mese in corso non conta perché non è finito. Una cifra scritta a mano resta la tua."))
        }
    }
}

private fun sliderLabel(field: FireScenarioField) = when (field) {
    FireScenarioField.ANNUAL_SAVINGS -> "Risparmio annuo"
    FireScenarioField.ANNUAL_SPENDING -> "Spesa annua"
    FireScenarioField.EXPECTED_RETURN -> "Rendimento reale"
    FireScenarioField.WITHDRAWAL_RATE -> "Tasso di prelievo"
}

private fun sliderTerm(field: FireScenarioField) = when (field) {
    FireScenarioField.EXPECTED_RETURN -> "rendimento-reale"
    FireScenarioField.WITHDRAWAL_RATE -> "tasso-prelievo"
    else -> null
}

/** ANA-014…019: the four «e se…» sliders, the other assumptions and the save/reset row. */
@Composable
private fun SlidersView(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val a = view.assumptions
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            FireScenarioField.entries.forEach { SliderRow(model, view, plan, text, it, a, model.state.overrides) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(text.otherAssumptions(a, model.taxes), BBTextStyle.Body, color = c.mutedForeground)
            BBButton(tr("Tutte le ipotesi"), { model.assumptionsOpen = true }, Modifier.offset(x = -BBSpacing.space2_5), icon = BBIcon.SlidersHorizontal,
                variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            if (model.state.hasScenario) {
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBButton(tr("Ripristina"), { model.resetScenario() }, icon = BBIcon.RotateCcw, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                    BBButton(if (model.state.saving) tr("Salvo…") else tr("Salva queste ipotesi"), { model.saveScenario() }, size = BBButtonSize.Sm,
                        enabled = !model.state.saving)
                }
            }
        }
    }
}

@Composable
private fun SliderRow(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, text: AnalyticsText, field: FireScenarioField, a: FireAssumptions,
                      overrides: FireScenarioOverrides) {
    val c = BuddyBudgetTheme.colors
    val baseline = AnalyticsRules.baseline(field, plan, a)
    val spec = FirePlanning.scenarioSlider(field, baseline)
    val override = AnalyticsRules.value(overrides, field)
    val value = override ?: baseline
    fun format(v: Double) = if (field == FireScenarioField.ANNUAL_SAVINGS || field == FireScenarioField.ANNUAL_SPENDING) text.money(v, view.currency) else text.pct(v)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val term = sliderTerm(field)
            if (term != null) GlossedText(listOf(AnalyticsTextPart.Term(term, tr(sliderLabel(field)))), BBTextStyle.Body.style)
            else BBText(tr(sliderLabel(field)), BBTextStyle.Body, color = c.mutedForeground)
            Spacer(Modifier.weight(1f))
            BBText(value?.let(::format) ?: "—", style = BBTextStyle.CardTitle.style.copy(fontFeatureSettings = "tnum"))
        }
        if (spec != null && value != null) {
            BBSlider(value.coerceIn(spec.min, spec.max), { model.move(field, it) }, Modifier.fillMaxWidth().height(20.dp), spec.min..spec.max, spec.step,
                accessibilityLabel = tr(sliderLabel(field)))
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(tr("Non nota"), BBTextStyle.Caption, color = c.mutedForeground)
                AnalyticsInfoButton(tr("Perché manca"), text.notKnownHint)
            }
        }
        if (override != null) {
            val delta = text.deltaText(plan.yearsToFire, AnalyticsRules.yearsWithField(field, override, plan, a))
            BBText(delta ?: tr("stesso traguardo"), style = BBTextStyle.Caption.style.copy(fontWeight = if (delta != null) FontWeight.W600 else FontWeight.W400),
                color = if (delta != null) c.pos else c.mutedForeground)
        } else if (value != null && spec != null) {
            when (field) {
                FireScenarioField.EXPECTED_RETURN -> ReturnSourceNote(model, view, value, text)
                FireScenarioField.WITHDRAWAL_RATE -> BBText(tr("ipotesi di partenza"), BBTextStyle.Caption, color = c.mutedForeground)
                else -> CashflowNote(model, view, plan, text, field)
            }
        }
        if (override != null && field == FireScenarioField.EXPECTED_RETURN && (overrides.expectedReturn ?: 0.0) > FirePlanning.highReturnWarning) {
            BBText(tr("Stima ottimistica"), BBTextStyle.Caption, color = c.risk3)
        }
    }
}

@Composable
private fun CashflowNote(model: AnalyticsModel, view: AnalyticsView, plan: FirePlan, text: AnalyticsText, field: FireScenarioField) {
    val c = BuddyBudgetTheme.colors
    val source = if (field == FireScenarioField.ANNUAL_SAVINGS) plan.savingsSource else plan.spendingSource
    val data = FirePlanning.cashflowFromData(view.base.planBase)
    val dataValue = if (field == FireScenarioField.ANNUAL_SAVINGS) data.second else data.first
    when (source) {
        FireFigureSource.MANCA -> Unit
        FireFigureSource.DATI -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(tr("Dai tuoi dati"), BBTextStyle.Caption, color = c.mutedForeground)
            AnalyticsInfoButton(tr("Da dove viene questa cifra"),
                text.cashflowAverageText(text.periodPhrase(view.assumptions.dataPeriod, view.base.cashflow.fromKey, view.base.cashflow.toKey),
                    view.base.cashflow.coveredMonths, view.base.cashflow.months.size))
        }
        FireFigureSource.IPOTESI -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Scritta a mano"), BBTextStyle.Caption, color = c.mutedForeground)
            if (dataValue != null) {
                BBText(tr("Usa i tuoi dati (") + text.money(dataValue, view.currency) + ")",
                    Modifier.bbDisabled(model.state.saving).bbPressable({ model.useData(field) }, RoundedCornerShape(4.dp), translate = false),
                    BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500, textDecoration = TextDecoration.Underline))
            }
        }
    }
}

/** Source of the return in use, «Usa il tuo (x%)» and the optimistic warning (`ReturnSourceNote`). */
@Composable
private fun ReturnSourceNote(model: AnalyticsModel, view: AnalyticsView, value: Double, text: AnalyticsText) {
    val c = BuddyBudgetTheme.colors
    val info = view.returnInfo
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(text.returnSourceLabel(info), BBTextStyle.Caption, color = c.mutedForeground)
                if (info.source != FireReturnSource.MANUALE) {
                    AnalyticsInfoButton(tr("Da dove viene il rendimento"), text.returnSourceText(info, view.currency, view.assumptions.dataPeriod))
                }
            }
            AnalyticsRules.historyOffer(info)?.let { offer ->
                BBText(tr("Usa il tuo (") + text.pct(offer) + ")",
                    Modifier.bbDisabled(model.state.saving).bbPressable({ model.useHistoryReturn() }, RoundedCornerShape(4.dp), translate = false),
                    BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500, textDecoration = TextDecoration.Underline))
            }
        }
        if (value > FirePlanning.highReturnWarning) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBIconView(BBIcon.TriangleAlert, size = 14.dp, color = c.risk3)
                BBText(tr("Stima ottimistica"), BBTextStyle.Caption, color = c.risk3)
                AnalyticsInfoButton(tr("Perché è ottimistica"), text.highReturnText)
            }
        }
    }
}

/** ANA-020: the four answers as a 2×2 grid of figure tiles (mobile adaptation). */
@Composable
private fun AnswerTiles(model: AnalyticsModel, tiles: List<AnalyticsAnswerTile>) {
    val c = BuddyBudgetTheme.colors
    Column {
        tiles.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { tile ->
                    val on = tile.question == model.state.selected
                    Box(Modifier.weight(1f).bbPressable({ model.select(tile.question) }, RoundedCornerShape(0.dp), translate = false)) {
                        Column(Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(top = BBSpacing.space3, bottom = BBSpacing.space3, end = BBSpacing.space3),
                            verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            // #427: no icons beside the labels.
                            BBText(tr(tile.question.label), BBTextStyle.Body, color = c.mutedForeground, maxLines = 1)
                            if (tile.loading) {
                                // Monte Carlo still running: placeholders of the value and the note.
                                val loading = l10n(L10n.loading)
                                Column(Modifier.semantics { contentDescription = loading }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    BBSkeleton(Modifier.padding(vertical = 4.dp), width = 56.dp, height = 24.dp)
                                    BBSkeleton(width = 96.dp, height = 12.dp)
                                }
                            } else {
                                BBText(tile.value, style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"), maxLines = 1)
                                BBText(tile.note, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 2)
                            }
                        }
                        Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(2.dp)
                            .then(if (on) Modifier.background(c.primary) else Modifier))
                    }
                }
            }
        }
    }
}
