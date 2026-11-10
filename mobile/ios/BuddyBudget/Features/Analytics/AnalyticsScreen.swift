import BuddyBudgetKit
import SwiftUI

/// Analitiche frame (11-analytics, 12-goals): title, subtitle of the view, «Risposte | Obiettivi», `Guida` (Risposte)
/// or `+` (Obiettivi), the states and the disclaimer. IT only: DE never gets here (route policy, ANA-001 / GOAL-002); a
/// 403 shows the country-unavailable state. Twin of `AnalyticsScreen` on Android.
struct AnalyticsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.analytics
        BBScreen(title: nil, onBack: back, onRefresh: { await model.refresh() }) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                // #427: «Risposte ⌄» / «Obiettivi ⌄» open the views sheet; `Guida` (outline) or the yellow `+` beside it.
                SectionViewsHeading(sectionTitle: L10n.lookup(italian: "Analitiche"), items: AnalyticsTab.allCases.map { tab in
                    SectionViewItem(id: tab.rawValue, label: L10n.lookup(italian: tab.title), description: L10n.lookup(italian: tab.viewDescription),
                                    icon: tab.icon, isActive: tab == model.tab) {
                        model.tab = tab
                        if tab == .obiettivi { Task { await model.loadGoals() } }
                    }
                }) {
                    if model.tab == .risposte {
                        BBButton(L10n.lookup(italian: "Guida"), icon: .circleQuestionMark, variant: .outline, size: .sm) { model.openWalkthrough() }
                    } else {
                        BBSunIconButton(accessibilityLabel: L10n.lookup(italian: "Nuovo obiettivo")) { model.openGoalForm(GoalFormRequest()) }
                    }
                }
                .padding(.top, BBSpacing.space4)
                if model.tab == .risposte {
                    AnalyticsGateView(model: model)
                } else {
                    GoalsListView(model: model)
                }
            }
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.load() } }
        .environment(\.analyticsTerm, { model.termId = $0 })
        .modifier(AnalyticsDialogs(model: model))
        .modifier(GoalFormPresenter(model: model))
    }
}

private struct AnalyticsGateView: View {
    let model: AnalyticsModel

    var body: some View {
        switch model.state.gate {
        case .loading:
            VStack(spacing: BBSpacing.space4) {
                BBSkeleton(height: 160, radius: BBRadius.xl)
                BBSkeleton(height: 256, radius: BBRadius.xl)
            }
            .accessibilityLabel(L10n.loading)
        case .failed:
            LoadError(message: L10n.lookup(italian: "Impossibile caricare i dati di Analitiche."), onRetry: { Task { await model.retry() } })
        case .unavailable:
CountryUnavailableState()
        case .content:
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                RisposteView(model: model)
                AnalyticsDisclaimer()
            }
        }
    }
}

/// ANA-004 / GOAL page footer.
struct AnalyticsDisclaimer: View {
    var body: some View {
        BBText(L10n.lookup(italian: "Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti."),
               style: BBTypography.caption, color: .bbMutedForeground)
    }
}

// MARK: - Risposte

private struct RisposteView: View {
    let model: AnalyticsModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let text = AnalyticsText(locale: locale, masked: hidden, translate: { L10n.lookup(italian: $0) })
        if let view = model.state.view, let saved = model.state.savedPlan, let plan = model.state.scenarioPlan, let a = model.state.scenarioAssumptions {
            let costs = AnalyticsRules.costs(view.base, ter: view.assumptions.terByInstrument, country: model.env.session.country)
            let lasting = model.results.flatMap { text.lastingAnswer($0, selected: a.rule, retirementYears: a.retirementYears) }
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                if debugShows(0) { HeadlineView(headline: text.headline(plan: plan, baseline: saved, todayYear: model.todayYear)) }
                if debugShows(1) { PeriodPicker(model: model, view: view, text: text) }
                if debugShows(2) { SlidersView(model: model, view: view, plan: saved, text: text) }
                if let error = model.state.saveError, !model.assumptionsOpen {
                    BBText(error, style: BBTypography.body, color: .bbNeg)
                }
                VStack(alignment: .leading, spacing: BBSpacing.space6) {
                    if debugShows(3) { AnswerTiles(model: model, tiles: text.tiles(plan: plan, scenario: model.state.hasScenario, todayYear: model.todayYear, lasting: lasting,
                                                                retirementYears: a.retirementYears, costs: costs, currency: view.currency, simulating: model.simulating)) }
                    AnalyticsQuestionView(model: model, view: view, plan: plan, assumptions: a, saved: saved, text: text, costs: costs, lasting: lasting)
                }
            }
        }
    }
}

/// ANA-009 / ANA-010.
private struct HeadlineView: View {
    let headline: AnalyticsHeadline

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(headline.lead, style: BBTypography.bodyLarge, color: .bbMutedForeground)
            if headline.missing {
                BBText(headline.big, style: BBTypography.amountLarge.with(weight: 500))
                if let sub = headline.sub { BBText(sub, style: BBTypography.body, color: .bbMutedForeground) }
            } else {
                // Web: the figure and «tra 12,3 anni» share the baseline, the latter wrapping under it when it does not fit.
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                        BBText(headline.big, style: BBTextStyle.hero).monospacedDigit().fixedSize()
                        if let sub = headline.sub { BBText(sub, style: BBTypography.bodyLarge.with(size: 18, lineHeight: 28), color: .bbMutedForeground).fixedSize() }
                    }
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        BBText(headline.big, style: BBTextStyle.hero).monospacedDigit()
                        if let sub = headline.sub { BBText(sub, style: BBTypography.bodyLarge.with(size: 18, lineHeight: 28), color: .bbMutedForeground) }
                    }
                }
                if let comparison = headline.comparison {
                    BBText(comparison, style: BBTypography.bodyLarge.with(size: 18, lineHeight: 28, weight: 600), color: headline.positive ? .bbPos : .bbNeg)
                }
            }
        }
    }
}

/// ANA-011…013: «I tuoi dati di» + the shared `PeriodSelector` (12 mesi, 24 mesi, month calendar), then the range used.
private struct PeriodPicker: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let text: AnalyticsText

    var body: some View {
        let state = model.state
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(spacing: BBSpacing.space4) {
                BBText(L10n.lookup(italian: "I tuoi dati di"), style: BBTypography.body, color: .bbMutedForeground)
                PeriodSelector(options: [(AnalyticsPeriodChoice.twelve, L10n.lookup(italian: "12 mesi")),
                                         (AnalyticsPeriodChoice.twentyFour, L10n.lookup(italian: "24 mesi"))],
                               selection: Binding(get: { AnalyticsPeriodChoice(state.period) }, set: { choice in
                                   if choice != .custom { model.choosePeriod(choice) }
                               }),
                               accessibilityLabel: L10n.lookup(italian: "Periodo dei tuoi dati"),
                               custom: PeriodCustom(value: .custom, granularity: .month, range: state.customPeriodRange,
                                                    min: state.customPeriodMin, max: state.customPeriodMax,
                                                    validate: { range in
                                                        AnalyticsRules.customPeriodError(from: range.from, to: range.to, today: state.today)
                                                            .map { L10n.lookup(italian: $0.source, $0.values) }
                                                    },
                                                    showCaption: false,
                                                    onApply: { range in
                                                        guard !state.saving else { return }
                                                        Task { await model.applyCustomPeriod(range) }
                                                    }))
            }
            HStack(spacing: 2) {
                BBText(model.updatingPeriod ? L10n.lookup(italian: "Aggiorno le cifre…") : text.rangeText(view.base.cashflow.fromKey, view.base.cashflow.toKey),
                       style: BBTypography.caption, color: .bbMutedForeground)
                AnalyticsInfoButton(label: L10n.lookup(italian: "Cosa cambia il periodo"),
                                    text: L10n.lookup(italian: "Risparmio, spesa e rendimento vengono dai tuoi movimenti e investimenti di questi mesi. Il mese in corso non conta perché non è finito. Una cifra scritta a mano resta la tua."))
            }
        }
    }
}

/// ANA-014…019: the four «e se…» sliders, the other assumptions and the save/reset row.
private struct SlidersView: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let text: AnalyticsText

    var body: some View {
        let a = view.assumptions
        let overrides = model.state.overrides
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                ForEach(FireScenarioField.allCases, id: \.self) { field in row(field, a: a, overrides: overrides) }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(text.otherAssumptions(a, taxes: model.taxes), style: BBTypography.body, color: .bbMutedForeground)
                BBButton(L10n.lookup(italian: "Tutte le ipotesi"), icon: .slidersHorizontal, variant: .ghost, size: .sm) { model.assumptionsOpen = true }
                    .padding(.leading, -BBSpacing.space2_5)
                if model.state.hasScenario {
                    HStack(spacing: BBSpacing.space2) {
                        BBButton(L10n.lookup(italian: "Ripristina"), icon: .rotateCcw, variant: .ghost, size: .sm) { model.resetScenario() }
                        BBButton(model.state.saving ? L10n.lookup(italian: "Salvo…") : L10n.lookup(italian: "Salva queste ipotesi"), size: .sm,
                                 isDisabled: model.state.saving) { Task { await model.saveScenario() } }
                    }
                }
            }
        }
    }

    private func label(_ field: FireScenarioField) -> String {
        switch field {
        case .annualSavings: "Risparmio annuo"
        case .annualSpending: "Spesa annua"
        case .expectedReturn: "Rendimento reale"
        case .withdrawalRate: "Tasso di prelievo"
        }
    }

    private func term(_ field: FireScenarioField) -> String? {
        switch field {
        case .expectedReturn: "rendimento-reale"
        case .withdrawalRate: "tasso-prelievo"
        default: nil
        }
    }

    private func format(_ field: FireScenarioField, _ v: Double) -> String {
        field == .annualSavings || field == .annualSpending ? text.money(v, view.currency) : text.pct(v)
    }

    @ViewBuilder
    private func row(_ field: FireScenarioField, a: FireAssumptions, overrides: FireScenarioOverrides) -> some View {
        let baseline = AnalyticsRules.baseline(field, plan: plan, assumptions: a)
        let spec = FirePlanning.scenarioSlider(field, baseline: baseline)
        let override = AnalyticsRules.value(overrides, field)
        let value = override ?? baseline
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                if let term = term(field) {
                    GlossedText([.term(id: term, text: L10n.lookup(italian: label(field)))], style: BBTypography.body)
                } else {
                    BBText(L10n.lookup(italian: label(field)), style: BBTypography.body, color: .bbMutedForeground)
                }
                Spacer(minLength: 0)
                BBText(value.map { format(field, $0) } ?? "—", style: BBTypography.cardTitle).monospacedDigit()
            }
            if let spec, let value {
                BBSlider(value: Binding(get: { min(max(value, spec.min), spec.max) }, set: { model.move(field, to: $0) }),
                         range: spec.min...spec.max, step: spec.step, accessibilityLabel: L10n.lookup(italian: label(field)))
                    .frame(height: 20)
            } else {
                HStack(spacing: 2) {
                    BBText(L10n.lookup(italian: "Non nota"), style: BBTypography.caption, color: .bbMutedForeground)
                    AnalyticsInfoButton(label: L10n.lookup(italian: "Perché manca"), text: text.notKnownHint)
                }
            }
            note(field, override: override, value: value, spec: spec, a: a)
            if override != nil, field == .expectedReturn, (overrides.expectedReturn ?? 0) > FirePlanning.highReturnWarning {
                BBText(L10n.lookup(italian: "Stima ottimistica"), style: BBTypography.caption, color: .bbRisk3)
            }
        }
    }

    @ViewBuilder
    private func note(_ field: FireScenarioField, override: Double?, value: Double?, spec: FireSliderSpec?, a: FireAssumptions) -> some View {
        if let override {
            let delta = text.deltaText(base: plan.yearsToFire, next: AnalyticsRules.yearsWithField(field, value: override, plan: plan, assumptions: a))
            BBText(delta ?? L10n.lookup(italian: "stesso traguardo"), style: BBTypography.caption.with(weight: delta != nil ? 600 : 400),
                   color: delta != nil ? .bbPos : .bbMutedForeground)
        } else if value != nil, spec != nil {
            switch field {
            case .expectedReturn:
                ReturnSourceNote(model: model, view: view, value: value ?? 0, text: text)
            case .annualSavings, .annualSpending:
                cashflowNote(field)
            case .withdrawalRate:
                BBText(L10n.lookup(italian: "ipotesi di partenza"), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    @ViewBuilder
    private func cashflowNote(_ field: FireScenarioField) -> some View {
        let source = field == .annualSavings ? plan.savingsSource : plan.spendingSource
        let data = FirePlanning.cashflowFromData(view.base.planBase)
        let dataValue = field == .annualSavings ? data.savings : data.spending
        switch source {
        case .manca:
            EmptyView()
        case .dati:
            HStack(spacing: 2) {
                BBText(L10n.lookup(italian: "Dai tuoi dati"), style: BBTypography.caption, color: .bbMutedForeground)
                AnalyticsInfoButton(label: L10n.lookup(italian: "Da dove viene questa cifra"),
                                    text: text.cashflowAverageText(periodPhrase: text.periodPhrase(view.assumptions.dataPeriod, fromKey: view.base.cashflow.fromKey, toKey: view.base.cashflow.toKey),
                                                                   coveredMonths: view.base.cashflow.coveredMonths, periodMonths: view.base.cashflow.months.count))
            }
        case .ipotesi:
            HStack(spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Scritta a mano"), style: BBTypography.caption, color: .bbMutedForeground)
                if let dataValue {
                    Button { Task { await model.useData(field) } } label: {
                        BBText(L10n.lookup(italian: "Usa i tuoi dati (") + text.money(dataValue, view.currency) + ")", style: BBTypography.caption.with(weight: 500))
                            .underline()
                    }
                    .buttonStyle(.plain)
                    .bbDisabled(model.state.saving)
                }
            }
        }
    }
}

/// Source of the return in use, «Usa il tuo (x%)» and the optimistic warning (`ReturnSourceNote`).
private struct ReturnSourceNote: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let value: Double
    let text: AnalyticsText

    var body: some View {
        let info = view.returnInfo
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            HStack(spacing: BBSpacing.space1_5) {
                HStack(spacing: 2) {
                    BBText(text.returnSourceLabel(info), style: BBTypography.caption, color: .bbMutedForeground)
                    if info.source != .manuale {
                        AnalyticsInfoButton(label: L10n.lookup(italian: "Da dove viene il rendimento"),
                                            text: text.returnSourceText(info, currency: view.currency, period: view.assumptions.dataPeriod))
                    }
                }
                if let offer = AnalyticsRules.historyOffer(info) {
                    Button { Task { await model.useHistoryReturn() } } label: {
                        BBText(L10n.lookup(italian: "Usa il tuo (") + text.pct(offer) + ")", style: BBTypography.caption.with(weight: 500)).underline()
                    }
                    .buttonStyle(.plain)
                    .bbDisabled(model.state.saving)
                }
            }
            if value > FirePlanning.highReturnWarning {
                HStack(spacing: BBSpacing.space1) {
                    BBIconView(.triangleAlert, points: 14, color: .bbRisk3)
                    BBText(L10n.lookup(italian: "Stima ottimistica"), style: BBTypography.caption, color: .bbRisk3)
                    AnalyticsInfoButton(label: L10n.lookup(italian: "Perché è ottimistica"), text: text.highReturnText)
                }
            }
        }
    }
}

/// ANA-020: the four answers as a 2×2 grid of figure tiles (mobile adaptation).
private struct AnswerTiles: View {
    let model: AnalyticsModel
    let tiles: [AnalyticsAnswerTile]

    var body: some View {
        let columns = [GridItem(.flexible(), spacing: 0), GridItem(.flexible(), spacing: 0)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 0) {
            ForEach(tiles, id: \.question) { tile in
                let on = tile.question == model.state.selected
                Button { model.select(tile.question) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        // #427: no icons beside the labels.
                        BBText(L10n.lookup(italian: tile.question.label), style: BBTypography.body, color: .bbMutedForeground, lineLimit: 1)
                        if tile.loading {
                            // Monte Carlo still running: placeholders of the value and the note.
                            VStack(alignment: .leading, spacing: 6) {
                                BBSkeleton(width: 56, height: 24).padding(.vertical, 4)
                                BBSkeleton(width: 96, height: 12)
                            }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(L10n.loading)
                        } else {
                            BBText(tile.value, style: BBTypography.amountLarge, lineLimit: 1).monospacedDigit()
                                .minimumScaleFactor(0.7)
                            BBText(tile.note, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
                    .padding(.vertical, BBSpacing.space3)
                    .padding(.trailing, BBSpacing.space3)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(on ? Color.bbPrimary : Color.clear).frame(height: 2)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .accessibilityLabel(L10n.lookup(italian: "Le quattro risposte"))
    }
}
