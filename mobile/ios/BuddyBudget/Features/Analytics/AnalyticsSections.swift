import BuddyBudgetKit
import SwiftUI

// The four questions of «Risposte» with their «Per esperti» panels (web components/domain/analytics/{journey,timeline,
// lasting,costs}-section.tsx and {growth,fire,simulation,withdrawal,risk,costs}-tab.tsx). Android: AnalyticsSections.kt.

struct AnalyticsQuestionView: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let saved: FirePlan
    let text: AnalyticsText
    let costs: CostSummary
    let lasting: AnalyticsLastingAnswer?

    var body: some View {
        let q = model.state.selected
        let open = model.state.expertOpen.contains(q)
        switch q {
        case .doveSono:
            AnalyticsQuestionSection(hint: "da dove arriva la crescita, mese per mese", expertOpen: open, onToggle: { model.toggleExpert(q) }) {
                JourneyAnswer(view: view, plan: plan, assumptions: assumptions, text: text)
            } expert: { GrowthExpert(view: view, text: text) }
        case .quando:
            AnalyticsQuestionSection(hint: plan.target == nil ? "sensibilità, Coast FIRE" : "sensibilità alle ipotesi, Coast FIRE, lean FIRE",
                                     expertOpen: open, onToggle: { model.toggleExpert(q) }) {
                TimelineAnswer(model: model, view: view, plan: plan, assumptions: assumptions, saved: saved, text: text)
            } expert: { FireExpert(model: model, view: view, plan: plan, assumptions: assumptions, text: text) }
        case .reggera:
            AnalyticsQuestionSection(hint: "probabilità di successo, regole di prelievo, rischio del portafoglio", expertOpen: open,
                                     onToggle: { model.toggleExpert(q) }) {
                LastingAnswer(model: model, view: view, plan: plan, assumptions: assumptions, text: text, answer: lasting)
            } expert: {
                VStack(alignment: .leading, spacing: BBSpacing.space6) {
                    if debugShows(4) { SimulationExpert(model: model, view: view, plan: plan, assumptions: assumptions, text: text) }
                    if debugShows(5) { WithdrawalExpert(model: model, view: view, plan: plan, assumptions: assumptions, text: text) }
                    RiskExpert(view: view, assumedVolatility: assumptions.volatility, text: text)
                }
            }
        case .costi:
            AnalyticsQuestionSection(hint: "costo di ogni fondo (TER), erosione, imposte", expertOpen: open, onToggle: { model.toggleExpert(q) }) {
                CostsAnswer(view: view, plan: plan, assumptions: assumptions, text: text, costs: costs, taxes: model.taxes)
            } expert: { CostsExpert(model: model, view: view, plan: plan, assumptions: assumptions, text: text, costs: costs) }
        }
    }
}

// MARK: - 1. Strada fatta (ANA-021, ANA-027)

private struct JourneyAnswer: View {
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText

    var body: some View {
        let currency = view.currency
        let split = FireCalc.splitGrowth(view.base.splitPoints)
        let sentences = text.journeySentences(plan: plan, split: split.rows.count >= 2 ? split : nil, currency: currency, withdrawalRate: assumptions.withdrawalRate)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                ForEach(sentences, id: \.self) { GlossedText(text.glossed($0)) }
            }
            if let target = plan.target {
                VStack(spacing: BBSpacing.space2) {
                    AnalyticsProgress(value: min(plan.progress ?? 0, 1))
                        .accessibilityLabel(L10n.lookup(italian: "Avanzamento verso il numero FIRE"))
                    HStack {
                        BBText("0", style: BBTypography.caption, color: .bbMutedForeground)
                        Spacer()
                        BBText(text.money(target, currency), style: BBTypography.caption, color: .bbMutedForeground).monospacedDigit()
                    }
                }
            }
            VStack(spacing: BBSpacing.space3) {
                AnalyticsMetric(label: L10n.lookup(italian: "Il tuo patrimonio"), value: text.money(plan.wealth, currency))
                AnalyticsMetric(label: L10n.lookup(italian: "Numero FIRE"), value: plan.target.map { text.money($0, currency) } ?? "—",
                                sub: plan.taxShare > 0 ? plan.fireNumberGross.map { L10n.lookup(italian: "{0} prima delle imposte", ["0": text.money($0, currency)]) } : nil,
                                term: "numero-fire")
                AnalyticsMetric(label: L10n.lookup(italian: "Ti mancano"), value: plan.target.map { text.money(max($0 - plan.wealth, 0), currency) } ?? "—",
                                sub: plan.progress.map { L10n.lookup(italian: "hai fatto il {0}", ["0": text.pct(min($0, 9.99), 0)]) },
                                tone: plan.target.map { plan.wealth >= $0 ? .pos : .default } ?? .default)
            }
        }
    }
}

private struct GrowthExpert: View {
    let view: AnalyticsView
    let text: AnalyticsText

    var body: some View {
        let currency = view.currency
        let split = FireCalc.splitGrowth(view.base.splitPoints)
        if split.rows.count < 2 {
            AnalyticsMissing(text: L10n.lookup(italian: "Servono almeno due mesi di storico del patrimonio e dei movimenti. Con i conti collegati o qualche mese di uso la scheda si riempie da sola."))
        } else {
            AnalyticsBlock(title: L10n.lookup(italian: "Da dove arriva la crescita"), explainer: "growth") {
                VStack(spacing: BBSpacing.space3) {
                    AnalyticsMetric(label: L10n.lookup(italian: "Variazione del patrimonio"), value: text.money(split.totalDelta, currency),
                                    sub: L10n.lookup(italian: "liquidità + investimenti, ultimi 12 mesi"), tone: split.totalDelta >= 0 ? .pos : .neg)
                    AnalyticsMetric(label: L10n.lookup(italian: "Dal tuo risparmio"), value: text.money(split.totalFromSavings, currency),
                                    sub: split.savingsShare.map { L10n.lookup(italian: "{0} della crescita", ["0": text.pct($0, 0)]) })
                    AnalyticsMetric(label: L10n.lookup(italian: "Da mercato e altro"), value: text.money(split.totalFromMarket, currency),
                                    sub: L10n.lookup(italian: "per differenza"), tone: split.totalFromMarket >= 0 ? .pos : .neg)
                }
                let labels = split.rows.map { text.shortMonth($0.month) }
                AnalyticsStackedBars(labels: labels, bars: split.rows.map { [($0.fromSavings, Color.bbPrimary), ($0.fromMarket, Color.bbSwatchTeal)] },
                                     accessibilitySummary: L10n.lookup(italian: "Da dove arriva la crescita")) { i in
                    let r = split.rows[i]
                    AnalyticsTooltip(title: labels[i], rows: [
                        (L10n.lookup(italian: "Dal risparmio:"), text.money(r.fromSavings, currency), false),
                        (L10n.lookup(italian: "Da mercato e altro:"), text.money(r.fromMarket, currency), false),
                        (L10n.lookup(italian: "Variazione totale:"), text.money(r.delta, currency), false),
                    ])
                }
                HStack(spacing: BBSpacing.space5) {
                    LegendDot(label: L10n.lookup(italian: "Dal risparmio"), color: .bbPrimary)
                    LegendDot(label: L10n.lookup(italian: "Da mercato e altro"), color: .bbSwatchTeal)
                }
            }
        }
    }
}

// MARK: - 2. Arrivo (ANA-022, ANA-028)

private struct TimelineAnswer: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let saved: FirePlan
    let text: AnalyticsText

    var body: some View {
        let currency = view.currency
        if let target = plan.target, plan.spending != nil {
            let scenario = model.state.hasScenario
            let series = AnalyticsRules.timelineSeries(plan, assumptions)
            let baseline = scenario ? AnalyticsRules.timelineSeries(saved, view.assumptions) : nil
            let year = model.todayYear
            let maxValue = max((series.map(\.wealth) + (baseline?.map(\.wealth) ?? [])).max() ?? 0, target) * 1.05
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                GlossedText(text.timelineSentence(savings: plan.savings, expectedReturn: assumptions.expectedReturn, currency: currency, baseline: scenario))
                AnalyticsChart(count: series.count,
                               lines: (baseline.map { b in [AnalyticsLine(id: "baseline", values: (0..<series.count).map { $0 < b.count ? b[$0].wealth : nil },
                                                                           color: .bbMutedForeground, width: 1.8, dash: [4, 4])] } ?? [])
                                   + [AnalyticsLine(id: "wealth", values: series.map(\.wealth), color: .bbPrimary, width: 2.5, fill: 0.12)],
                               domain: 0...max(maxValue, 1),
                               reference: AnalyticsReference(value: target, color: .bbPos,
                                                             label: "\(L10n.lookup(italian: "Numero FIRE")) \(text.money(target, currency))"),
                               xLabels: series.map { String(year + $0.year) }, height: 224, minTickGap: 32,
                               accessibilitySummary: L10n.lookup(italian: "Patrimonio previsto")) { i in
                    AnalyticsTooltip(title: String(year + series[i].year), rows: [
                        (L10n.lookup(italian: "Patrimonio:"), text.money(series[i].wealth, currency), false),
                    ] + (baseline.flatMap { i < $0.count ? [(L10n.lookup(italian: "Ipotesi salvate:"), text.money($0[i].wealth, currency), true)] : nil } ?? []))
                }
            }
        } else {
            AnalyticsMissing(text: L10n.lookup(italian: "Per stimare quando arrivi serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti e la ricavo da lì."))
        }
    }
}

private struct FireExpert: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText

    var body: some View {
        let currency = view.currency
        let a = assumptions
        if let target = plan.target, let spending = plan.spending {
            let savings = plan.savings ?? 0
            let lean = AnalyticsRules.leanNumber(view.base, a)
            let finishYear = plan.yearsToFire.map { model.todayYear + Int($0.rounded(.up)) }
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                if debugShows(4) { AnalyticsBlock(title: L10n.lookup(italian: "Il tuo numero FIRE"), explainer: "fire-number") {
                    VStack(spacing: BBSpacing.space3) {
                        AnalyticsMetric(label: L10n.lookup(italian: "Numero FIRE"), value: text.money(target, currency),
                                        sub: plan.taxShare > 0
                                            ? L10n.lookup(italian: "{0} prima delle imposte", ["0": text.money(plan.fireNumberGross ?? target, currency)])
                                            : L10n.lookup(italian: "spesa {0} ÷ {1}", ["0": text.money(spending, currency), "1": text.pct(a.withdrawalRate)]))
                        AnalyticsMetric(label: L10n.lookup(italian: "Il tuo patrimonio"), value: text.money(plan.wealth, currency),
                                        sub: L10n.lookup(italian: "{0} del traguardo", ["0": text.pct(min(plan.progress ?? 0, 9.99), 0)]))
                        AnalyticsMetric(label: L10n.lookup(italian: "Anni al traguardo"), value: text.formatYears(plan.yearsToFire),
                                        sub: finishYear.map { L10n.lookup(italian: "intorno al {0}", ["0": String($0)]) }
                                            ?? (savings <= 0 ? L10n.lookup(italian: "con risparmio nullo non ci arrivi") : nil))
                    }
                    AnalyticsProgress(value: min(plan.progress ?? 0, 1), height: 8)
                    BBText(L10n.lookup(italian: "Con un risparmio di") + " " + text.money(savings, currency) + " " + L10n.lookup(italian: "l'anno e un rendimento reale del")
                        + " " + text.pct(a.expectedReturn) + ". " + (plan.spendingSource == .dati ? L10n.lookup(italian: "La spesa viene dai tuoi movimenti del periodo scelto. ") : "")
                        + (lean.map { L10n.lookup(italian: "Se vivessi solo con le spese Dovute e Saltuarie il numero scenderebbe a {0} («lean FIRE»).", ["0": text.money($0, currency)]) } ?? ""),
                           style: BBTypography.body, color: .bbMutedForeground)
                } }
                if debugShows(5) { AnalyticsBlock(title: L10n.lookup(italian: "Coast FIRE"), explainer: "coast") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: BBSpacing.space3, alignment: .topLeading), GridItem(.flexible(), spacing: BBSpacing.space3, alignment: .topLeading)],
                              alignment: .leading, spacing: BBSpacing.space3) {
                        ForEach(plan.coast, id: \.years) { c in
                            let reached = plan.wealth >= c.number
                            AnalyticsMetric(label: L10n.lookup(italian: "Fra {0} anni", ["0": AnalyticsRules.intText(c.years)]), value: text.money(c.number, currency),
                                            sub: reached ? L10n.lookup(italian: "già raggiunto") : nil, tone: reached ? .pos : .default)
                        }
                    }
                } }
                AnalyticsBlock(title: L10n.lookup(italian: "Sensibilità alle ipotesi"), explainer: "sensitivity") {
                    if let rate = AnalyticsRules.rateSensitivity(plan, a, text: text) {
                        SensitivityTable(table: rate, rowLabel: L10n.lookup(italian: "tasso di prelievo"), columnLabel: L10n.lookup(italian: "rendimento reale"), text: text)
                    }
                    if let spend = AnalyticsRules.spendingSensitivity(plan, a, text: text) {
                        SensitivityTable(table: spend, rowLabel: L10n.lookup(italian: "spesa"), columnLabel: L10n.lookup(italian: "risparmio"), text: text)
                    }
                    BBText(L10n.lookup(italian: "Anni al numero FIRE. «—» = oltre 80 anni o mai; «ok» = già raggiunto. La cella evidenziata è la tua ipotesi."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        } else {
            AnalyticsMissing(text: L10n.lookup(italian: "Per calcolare il numero FIRE serve la tua spesa annua. Scrivila nelle ipotesi qui sopra, oppure registra almeno 3 mesi di movimenti e la ricavo da lì."))
        }
    }
}

/// Years-to-FIRE grid (scrolls horizontally inside its block; the user's cell highlighted).
private struct SensitivityTable: View {
    let table: AnalyticsSensitivityTable
    let rowLabel: String
    let columnLabel: String
    let text: AnalyticsText

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(L10n.lookup(italian: "Righe:") + " " + rowLabel + " " + L10n.lookup(italian: "· Colonne:") + " " + columnLabel,
                   style: BBTypography.caption, color: .bbMutedForeground)
            ScrollView(.horizontal) {
                Grid(alignment: .trailing, horizontalSpacing: 0, verticalSpacing: 0) {
                    GridRow {
                        Color.clear.frame(width: 52, height: 1)
                        ForEach(table.columns, id: \.self) { c in cell(c, header: true) }
                    }
                    ForEach(Array(table.cells.enumerated()), id: \.offset) { i, row in
                        GridRow {
                            BBText(table.rows[i], style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
                                .frame(width: 52, alignment: .leading).padding(.vertical, 6)
                            ForEach(Array(row.enumerated()), id: \.offset) { j, c in
                                cell(AnalyticsRules.cellText(c, text: text), header: false, highlight: i == 2 && j == 2)
                            }
                        }
                    }
                }
                .frame(minWidth: 400)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func cell(_ value: String, header: Bool, highlight: Bool = false) -> some View {
        BBText(value, style: header ? BBTypography.caption.with(weight: 500) : (highlight ? BBTypography.bodyStrong : BBTypography.body),
               color: header ? .bbMutedForeground : .bbForeground, lineLimit: 1)
            .monospacedDigit()
            .padding(.vertical, 6)
            .padding(.horizontal, 6)
            .frame(minWidth: 66, alignment: .trailing)
            .background(RoundedRectangle.bb(4).fill(highlight ? Color.bbAlphaPrimary10 : .clear))
    }
}

// MARK: - 3. Regge (ANA-023, ANA-029, ANA-030)

private struct LastingAnswer: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText
    let answer: AnalyticsLastingAnswer?

    var body: some View {
        if model.state.simulationInput == nil {
            AnalyticsMissing(text: L10n.lookup(italian: "Per simulare serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        } else if let answer, let results = model.results {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    GlossedText(text.glossed(answer.headline), style: BBTextStyle.figure, color: .bbForeground)
                    BBText(answer.verdict.text + ".", style: BBTypography.bodyLarge, color: .bbMutedForeground)
                    if let better = answer.better {
                        BBText(L10n.lookup(italian: "Cambiando il modo di prelevare la situazione cambia: con la regola «") + better.label
                            + L10n.lookup(italian: "» il patrimonio regge nel") + " " + text.pct(better.success, 0) + " " + L10n.lookup(italian: "dei casi."),
                               style: BBTypography.bodyLarge, color: .bbMutedForeground)
                    }
                }
                RuleChips(rules: answer.rules, text: text)
                if let current = results.first(where: { $0.rule == assumptions.rule }) {
                    AnalyticsBlock(title: L10n.lookup(italian: "3.000 futuri possibili del tuo patrimonio")) {
                        FanChart(result: current, retireYear: 0, currency: view.currency, text: text)
                        FanCaption(result: current, retireYear: 0, savings: 0, currency: view.currency, text: text)
                    }
                }
            }
        } else {
            BBSkeleton(height: 256, radius: BBRadius.xl)
        }
    }
}

/// Success chips per rule (≥ 90% positive, ≥ 75% neutral, else negative).
private struct RuleChips: View {
    let rules: [AnalyticsLastingAnswer.Rule]
    let text: AnalyticsText
    @Environment(\.analyticsTerm) private var openTerm

    var body: some View {
        FlowLayout(spacing: BBSpacing.space2) {
            ForEach(rules, id: \.rule) { r in
                let fg: Color = r.success >= 0.9 ? .bbPos : r.success >= 0.75 ? .bbForeground : .bbNeg
                let bg: Color = r.success >= 0.9 ? .bbPosSoft : r.success >= 0.75 ? .bbMuted : .bbNegSoft
                Button { openTerm(AnalyticsRules.ruleTerm(r.rule)) } label: {
                    (Text(r.label).underline(pattern: .dot) + Text(" · " + text.pct(r.success, 0)))
                        .bbTextStyle(BBTypography.caption.with(weight: 600))
                        .foregroundStyle(fg)
                        .padding(.horizontal, BBSpacing.space3)
                        .padding(.vertical, BBSpacing.space1)
                        .background(Capsule().fill(bg))
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityLabel(L10n.lookup(italian: "Probabilità di successo per regola di prelievo"))
    }
}

/// Monte Carlo percentile fan: bands 10–90 (0.12) and 25–75 (0.20), median line.
private struct FanChart: View {
    let result: MonteCarloResult
    let retireYear: Int
    let currency: String
    let text: AnalyticsText

    var body: some View {
        let w = result.wealth
        AnalyticsChart(count: w.count,
                       lines: [AnalyticsLine(id: "p50", values: w.map(\.p50), color: .bbPrimary, width: 2)],
                       bands: [AnalyticsBand(id: "80", lower: w.map(\.p10), upper: w.map(\.p90), color: .bbPrimary, opacity: 0.12),
                               AnalyticsBand(id: "50", lower: w.map(\.p25), upper: w.map(\.p75), color: .bbPrimary, opacity: 0.20)],
                       domain: AnalyticsRules.zeroAutoDomain(w.map(\.p90)), xLabels: w.map { "\($0.year)a" }, height: 256, minTickGap: 24,
                       accessibilitySummary: L10n.lookup(italian: "Probabilità che il patrimonio duri")) { i in
            AnalyticsTooltip(title: L10n.lookup(italian: "Anno") + " " + String(w[i].year) + (w[i].year == retireYear ? L10n.lookup(italian: " · inizio pensione") : ""),
                             rows: [(L10n.lookup(italian: "Sfortunato (10°):"), text.money(w[i].p10, currency), false),
                                    (L10n.lookup(italian: "Tipico (mediana):"), text.money(w[i].p50, currency), false),
                                    (L10n.lookup(italian: "Fortunato (90°):"), text.money(w[i].p90, currency), false)])
        }
    }
}

private struct FanCaption: View {
    let result: MonteCarloResult
    let retireYear: Int
    let savings: Double
    let currency: String
    let text: AnalyticsText

    var body: some View {
        BBText(BBFormat.formatNumber(Double(result.paths), maximumFractionDigits: 0, locale: text.locale) + " "
            + L10n.lookup(italian: "scenari. Asse orizzontale: anni da oggi")
            + (retireYear > 0 ? L10n.lookup(italian: "; la pensione inizia dopo {0} anni, versando {1} l'anno", ["0": String(retireYear), "1": text.money(savings, currency)]) : "")
            + L10n.lookup(italian: ". Tutto in euro di oggi."), style: BBTypography.caption, color: .bbMutedForeground)
    }
}

private struct SimulationExpert: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText

    var body: some View {
        if let input = model.state.expertSimulationInput {
            AnalyticsBlock(title: L10n.lookup(italian: "Probabilità che il patrimonio duri"), explainer: "montecarlo") {
                SegmentedControl(options: [(FireRetireAt.oggi, L10n.lookup(italian: "Smetto oggi")), (FireRetireAt.fire, L10n.lookup(italian: "Smetto al traguardo FIRE"))],
                                 selection: Binding(get: { model.state.retireAt }, set: { model.setRetireAt($0) }),
                                 accessibilityLabel: L10n.lookup(italian: "Quando inizia la pensione"), stretch: true)
                if model.state.retireAt == .fire, plan.yearsToFire == nil {
                    BBText(L10n.lookup(italian: "Con queste ipotesi il traguardo FIRE non si raggiunge entro 80 anni: la simulazione parte da oggi."),
                           style: BBTypography.body, color: .bbMutedForeground)
                }
                if let result = model.expertResult {
                    let v = text.successVerdict(result.successRate)
                    VStack(spacing: BBSpacing.space3) {
                        AnalyticsMetric(label: L10n.lookup(italian: "Probabilità di successo"), value: text.pct(result.successRate, 0), sub: v.text, tone: v.tone)
                        AnalyticsMetric(label: L10n.lookup(italian: "Patrimonio finale (caso tipico)"), value: text.money(result.endingWealth.p50, view.currency),
                                        sub: L10n.lookup(italian: "caso sfortunato {0}", ["0": text.money(result.endingWealth.p10, view.currency)]))
                        AnalyticsMetric(label: L10n.lookup(italian: "Spesa annua"), value: text.money(input.annualSpending, view.currency),
                                        sub: L10n.lookup(italian: "regola: {0} · {1} anni", ["0": text.ruleShortName(input.rule), "1": AnalyticsRules.intText(input.retirementYears)]))
                    }
                    FanChart(result: result, retireYear: Int(input.accumulationYears), currency: view.currency, text: text)
                    FanCaption(result: result, retireYear: Int(input.accumulationYears), savings: input.annualSavings, currency: view.currency, text: text)
                } else {
                    BBSkeleton(height: 256, radius: BBRadius.xl)
                }
            }
        } else {
            AnalyticsMissing(text: L10n.lookup(italian: "Per simulare serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        }
    }
}

private struct WithdrawalExpert: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText

    var body: some View {
        if let results = model.results {
            let selected = model.state.withdrawalRule ?? assumptions.rule
            let best = results.map(\.successRate).max() ?? 0
            let current = results.first { $0.rule == selected } ?? results[0]
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                AnalyticsBlock(title: L10n.lookup(italian: "Quattro regole a confronto"), explainer: "rules") {
                    BBText(L10n.lookup(italian: "Si parte da oggi con") + " " + text.money(plan.wealth, view.currency) + L10n.lookup(italian: ", spendendo") + " "
                        + text.money(plan.spending ?? 0, view.currency) + " " + L10n.lookup(italian: "l'anno per") + " " + AnalyticsRules.intText(assumptions.retirementYears)
                        + " " + L10n.lookup(italian: "anni. Tocca una riga per vedere la sua spesa nel tempo."), style: BBTypography.body, color: .bbMutedForeground)
                    VStack(spacing: 0) {
                        ForEach(WithdrawalRule.allCases, id: \.self) { rule in
                            if let r = results.first(where: { $0.rule == rule }) {
                                Button { model.selectRule(rule) } label: {
                                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                                        BBText(text.ruleLabel(rule), style: BBTypography.bodyStrong)
                                        ruleRow(L10n.lookup(italian: "Successo"), text.pct(r.successRate, 0), color: r.successRate == best ? .bbPos : .bbForeground)
                                        ruleRow(L10n.lookup(italian: "Taglio massimo tipico"), text.pct(r.maxCut.median, 0))
                                        ruleRow(L10n.lookup(italian: "Taglio nel 10% dei casi peggiori"), text.pct(r.maxCut.p90, 0))
                                        ruleRow(L10n.lookup(italian: "Patrimonio finale tipico"), text.money(r.endingWealth.p50, view.currency))
                                    }
                                    .padding(BBSpacing.space2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(RoundedRectangle.bb(BBRadius.md).fill(selected == rule ? Color.bbAlphaPrimary10 : .clear))
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(selected == rule ? .isSelected : [])
                            }
                        }
                    }
                    BBText(L10n.lookup(italian: "«Taglio massimo» = di quanto la spesa scende, nel punto peggiore, rispetto a quella del primo anno. Più il taglio è alto, più la regola ti chiede sacrifici quando il mercato va male."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
                AnalyticsBlock(title: L10n.lookup(italian: "Spesa nel tempo · {0}", ["0": (text.ruleLabel(selected).components(separatedBy: " (").first ?? "").lowercased()])) {
                    let s = current.spending
                    AnalyticsChart(count: s.count,
                                   lines: [AnalyticsLine(id: "p90", values: s.map(\.p90), color: .bbSwatchTeal, width: 1.5),
                                           AnalyticsLine(id: "p10", values: s.map(\.p10), color: .bbNeg, width: 1.5),
                                           AnalyticsLine(id: "p50", values: s.map(\.p50), color: .bbPrimary, width: 2)],
                                   domain: AnalyticsRules.zeroAutoDomain(s.map(\.p90)), xLabels: s.map { "\($0.year + 1)a" }, height: 224, minTickGap: 24,
                                   accessibilitySummary: L10n.lookup(italian: "Spesa nel tempo")) { i in
                        AnalyticsTooltip(title: L10n.lookup(italian: "Anno di pensione") + " " + String(s[i].year + 1),
                                         rows: [(L10n.lookup(italian: "Sfortunato (10°):"), text.money(s[i].p10, view.currency), false),
                                                (L10n.lookup(italian: "Tipico:"), text.money(s[i].p50, view.currency), false),
                                                (L10n.lookup(italian: "Fortunato (90°):"), text.money(s[i].p90, view.currency), false)])
                    }
                    BBText(L10n.lookup(italian: "Spesa annua effettivamente sostenuta (comprende la pensione pubblica se l'hai indicata), in euro di oggi."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        } else if model.state.simulationInput == nil {
            AnalyticsMissing(text: L10n.lookup(italian: "Per confrontare le regole serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti."))
        }
    }

    private func ruleRow(_ label: String, _ value: String, color: Color = .bbForeground) -> some View {
        HStack {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            Spacer(minLength: BBSpacing.space2)
            BBText(value, style: BBTypography.body, color: color).monospacedDigit()
        }
    }
}

private struct RiskExpert: View {
    let view: AnalyticsView
    let assumedVolatility: Double
    let text: AnalyticsText

    var body: some View {
        if let risk = view.base.risk {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                AnalyticsBlock(title: L10n.lookup(italian: "Rischio del portafoglio"), explainer: "risk") {
                    if risk.fewData {
                        BBText(L10n.lookup(italian: "Meno di un anno di dati: i numeri sono indicativi."), style: BBTypography.body, color: .bbNeg)
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: BBSpacing.space3, alignment: .topLeading), GridItem(.flexible(), spacing: BBSpacing.space3, alignment: .topLeading)],
                              alignment: .leading, spacing: BBSpacing.space3) {
                        AnalyticsMetric(label: L10n.lookup(italian: "Volatilità annua"), value: risk.volatility.map { text.pct($0) } ?? "—",
                                        sub: L10n.lookup(italian: "ipotizzata {0}", ["0": text.pct(assumedVolatility)]), term: "volatilita")
                        AnalyticsMetric(label: L10n.lookup(italian: "Peggior calo"), value: risk.maxDrawdown.map { BBFormat.minusSign + text.pct($0) } ?? "—",
                                        sub: L10n.lookup(italian: "dal picco al minimo"), tone: .neg, term: "peggior-calo")
                        AnalyticsMetric(label: L10n.lookup(italian: "Sharpe"), value: risk.sharpe.map { text.num($0) } ?? "—",
                                        sub: L10n.lookup(italian: "rendimento per unità di rischio"), term: "sharpe")
                        AnalyticsMetric(label: L10n.lookup(italian: "Sortino"), value: risk.sortino.map { text.num($0) } ?? "—",
                                        sub: L10n.lookup(italian: "conta solo i ribassi"), term: "sortino")
                        AnalyticsMetric(label: L10n.lookup(italian: "Calmar"), value: risk.calmar.map { text.num($0) } ?? "—",
                                        sub: risk.annualReturn.map { L10n.lookup(italian: "rendimento annuo {0}", ["0": text.pct($0)]) }, term: "calmar")
                        AnalyticsMetric(label: L10n.lookup(italian: "VaR 95% (giorno)"), value: risk.tail.map { BBFormat.minusSign + text.pct($0.var) } ?? "—",
                                        sub: L10n.lookup(italian: "nel 5% dei giorni peggiori si perde almeno"), tone: .neg, term: "var")
                        AnalyticsMetric(label: L10n.lookup(italian: "CVaR 95% (giorno)"), value: risk.tail.map { BBFormat.minusSign + text.pct($0.cvar) } ?? "—",
                                        sub: L10n.lookup(italian: "perdita media in quei giorni"), tone: .neg, term: "cvar")
                        AnalyticsMetric(label: L10n.lookup(italian: "Posizioni effettive"), value: risk.concentration.map { text.num($0.effectiveN, 1) } ?? "—",
                                        sub: L10n.lookup(italian: "1 = tutto su un titolo"), term: "posizioni-effettive")
                    }
                    if let vol = risk.volatility, abs(vol - assumedVolatility) > 0.05 {
                        BBText(L10n.lookup(italian: "La volatilità osservata (") + text.pct(vol, 0) + L10n.lookup(italian: ") è lontana da quella che hai ipotizzato (")
                            + text.pct(assumedVolatility, 0)
                            + L10n.lookup(italian: "): se la tua vera tolleranza è quella osservata, aggiorna l'ipotesi per rendere la simulazione più realistica."),
                               style: BBTypography.body, color: .bbMutedForeground)
                    }
                }
                AnalyticsBlock(title: L10n.lookup(italian: "Quanto ogni posizione pesa sul rischio")) {
                    if let contributions = view.base.riskContribution {
                        VStack(spacing: BBSpacing.space2) {
                            ForEach(contributions.sorted { $0.riskShare > $1.riskShare }, id: \.id) { c in
                                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                                    HStack(alignment: .firstTextBaseline) {
                                        BBText(view.base.names[c.id] ?? c.id, style: BBTypography.bodyStrong, lineLimit: 1)
                                        Spacer(minLength: BBSpacing.space3)
                                        BBText(text.pct(c.riskShare, 0) + " " + L10n.lookup(italian: "del rischio ·") + " " + text.pct(c.weight, 0) + " " + L10n.lookup(italian: "del valore"),
                                               style: BBTypography.body, color: .bbMutedForeground, lineLimit: 1).monospacedDigit()
                                    }
                                    GeometryReader { geo in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(Color.bbMuted)
                                            Capsule().fill(Color.bbPrimary).frame(width: geo.size.width * min(c.riskShare, 1))
                                            Rectangle().fill(Color.bbForeground.opacity(0.6)).frame(width: 2, height: 12)
                                                .offset(x: geo.size.width * min(c.weight, 1) - 1)
                                        }
                                    }
                                    .frame(height: 8)
                                }
                            }
                        }
                    } else {
                        AnalyticsMissing(text: L10n.lookup(italian: "Servono almeno due posizioni con 60 giorni di prezzi in comune."))
                    }
                    BBText(L10n.lookup(italian: "La barra piena è il peso sul rischio, il trattino il peso sul valore: se la barra supera il trattino, quella posizione pesa sul rischio più di quanto pesi sul valore."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        } else {
            AnalyticsMissing(text: L10n.lookup(italian: "Servono operazioni di investimento e almeno qualche settimana di prezzi per misurare il rischio del portafoglio."))
        }
    }
}

// MARK: - 4. Costi (ANA-024, ANA-031)

private struct CostsAnswer: View {
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText
    let costs: CostSummary
    var taxes = true

    var body: some View {
        let currency = view.currency
        let drag = AnalyticsRules.drag(costs, expectedReturn: assumptions.expectedReturn)
        let sentences = text.costsSentences(costs, lostAfterYears: drag.last?.lost, years: AnalyticsRules.costDragYears, liquidation: plan.liquidation, currency: currency)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                ForEach(sentences, id: \.self) { GlossedText(text.glossed($0)) }
            }
            if costs.totalValue > 0 {
                VStack(spacing: BBSpacing.space3) {
                    AnalyticsMetric(label: L10n.lookup(italian: "Costo annuo"), value: text.money(costs.annualCost, currency),
                                    sub: costs.annualPct.map { L10n.lookup(italian: "{0} del portafoglio", ["0": text.pct($0, 2)]) }, term: "ter")
                    AnalyticsMetric(label: L10n.lookup(italian: "Persi in {0} anni", ["0": String(AnalyticsRules.costDragYears)]),
                                    value: drag.last.map { text.money($0.lost, currency) } ?? "—", sub: L10n.lookup(italian: "a parità di rendimento"),
                                    tone: .neg, term: "erosione")
                    if taxes {
                        AnalyticsMetric(label: L10n.lookup(italian: "Imposte se vendessi tutto"), value: text.money(plan.liquidation.latentTax, currency),
                                        sub: plan.liquidation.taxRatio.map { L10n.lookup(italian: "{0} del valore", ["0": text.pct($0)]) }, term: "imposte-latenti")
                    }
                }
            }
        }
    }
}

private struct CostsExpert: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    let assumptions: FireAssumptions
    let text: AnalyticsText
    let costs: CostSummary

    var body: some View {
        let currency = view.currency
        if view.base.positions.isEmpty {
            AnalyticsMissing(text: L10n.lookup(italian: "Servono posizioni di investimento aperte per calcolare costi e imposte."))
        } else {
            let drag = AnalyticsRules.drag(costs, expectedReturn: assumptions.expectedReturn)
            let liquidation = plan.liquidation
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                if debugShows(4) { AnalyticsBlock(title: L10n.lookup(italian: "Costi del portafoglio"), explainer: "costs") {
                    VStack(spacing: BBSpacing.space3) {
                        AnalyticsMetric(label: L10n.lookup(italian: "Costo annuo"), value: text.money(costs.annualCost, currency),
                                        sub: costs.annualPct.map { L10n.lookup(italian: "{0} del portafoglio", ["0": text.pct($0, 2)]) })
                        AnalyticsMetric(label: L10n.lookup(italian: "Persi in {0} anni", ["0": String(AnalyticsRules.costDragYears)]),
                                        value: drag.last.map { text.money($0.lost, currency) } ?? "—",
                                        sub: L10n.lookup(italian: "rispetto allo stesso portafoglio senza costi"), tone: .neg)
                        AnalyticsMetric(label: L10n.lookup(italian: "Senza costo inserito"), value: text.money(costs.missingTerValue, currency),
                                        sub: L10n.lookup(italian: "valore delle posizioni senza costo inserito"))
                    }
                    VStack(spacing: 0) {
                        ForEach(view.base.positions, id: \.id) { p in
                            let row = costs.rows.first { $0.id == p.id }
                            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                                HStack(alignment: .firstTextBaseline) {
                                    BBText(p.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                    Spacer(minLength: BBSpacing.space2)
                                    BBText(text.money(p.value, currency), style: BBTypography.body, color: .bbMutedForeground).monospacedDigit()
                                }
                                HStack(spacing: BBSpacing.space3) {
                                    BBTextField(text: Binding(get: { model.terDrafts[p.id] ?? "" }, set: { model.terDrafts[p.id] = $0 }),
                                                placeholder: L10n.lookup(italian: "es. 0,20"), keyboard: .amount)
                                        .frame(width: 96)
                                        .accessibilityLabel(L10n.lookup(italian: "Costo annuo di {0}", ["0": p.name]))
                                    BBText(L10n.lookup(italian: "Costo annuo fondo (TER, %)"), style: BBTypography.caption, color: .bbMutedForeground)
                                    Spacer(minLength: 0)
                                    BBText(row.map { text.money($0.total, currency) } ?? "—", style: BBTypography.body).monospacedDigit()
                                }
                            }
                            .padding(.vertical, BBSpacing.space2)
                        }
                    }
                    BBText(costs.stampDuty ? L10n.lookup(italian: "Il TER lo trovi nel KID/scheda del fondo (per un ETF globale di solito 0,1-0,4%). Il bollo (0,2%) è incluso per i titoli in deposito; è escluso per le crypto.")
                           : L10n.lookup(italian: "Il TER lo trovi nel KID/scheda del fondo (per un ETF globale di solito 0,1-0,4%)."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                    if let error = model.terError ?? model.state.saveError {
                        BBText(error, style: BBTypography.body, color: .bbNeg)
                    }
                    BBButton(model.state.saving ? L10n.lookup(italian: "Salvo…") : L10n.lookup(italian: "Salva costi"), isDisabled: model.state.saving) {
                        Task { await model.saveTers() }
                    }
                    if !drag.isEmpty {
                        AnalyticsChart(count: drag.count,
                                       lines: [AnalyticsLine(id: "without", values: drag.map(\.withoutCosts), color: .bbSwatchTeal, width: 2, dash: [4, 3]),
                                               AnalyticsLine(id: "with", values: drag.map(\.withCosts), color: .bbPrimary, width: 2)],
                                       domain: AnalyticsRules.autoDomain(drag.map(\.withoutCosts) + drag.map(\.withCosts)), xLabels: drag.map { "\($0.year)a" },
                                       height: 224, minTickGap: 24, accessibilitySummary: L10n.lookup(italian: "Costi del portafoglio")) { i in
                            let p = drag[i]
                            AnalyticsTooltip(title: L10n.lookup(italian: "Tra") + " " + String(p.year) + " " + L10n.lookup(italian: "anni"),
                                             rows: [(L10n.lookup(italian: "Senza costi:"), text.money(p.withoutCosts, currency), false),
                                                    (L10n.lookup(italian: "Con costi:"), text.money(p.withCosts, currency), false),
                                                    (L10n.lookup(italian: "Persi:"), text.money(p.lost, currency), false)])
                        }
                        HStack(spacing: BBSpacing.space5) {
                            ChartLegendItem(label: L10n.lookup(italian: "Senza costi"), color: .bbSwatchTeal, dashed: true)
                            ChartLegendItem(label: L10n.lookup(italian: "Con i tuoi costi"), color: .bbPrimary)
                        }
                    }
                } }
                // ANA-036: no «sell everything today» card where the country has no capital gains rules.
                if model.taxes { AnalyticsBlock(title: L10n.lookup(italian: "Se vendessi tutto oggi"), explainer: "liquidation") {
                    VStack(spacing: BBSpacing.space3) {
                        AnalyticsMetric(label: L10n.lookup(italian: "Valore di mercato"), value: text.money(liquidation.grossValue, currency))
                        AnalyticsMetric(label: L10n.lookup(italian: "Imposta sulle plusvalenze"), value: text.money(liquidation.latentTax, currency),
                                        sub: liquidation.taxRatio.map { L10n.lookup(italian: "{0} del valore", ["0": text.pct($0)]) }, tone: .neg)
                        AnalyticsMetric(label: L10n.lookup(italian: "Netto dopo le imposte"), value: text.money(liquidation.netValue, currency))
                    }
                    if liquidation.byPosition.isEmpty {
                        BBText(L10n.lookup(italian: "Nessuna plusvalenza non realizzata: nessuna imposta latente."), style: BBTypography.body, color: .bbMutedForeground)
                    } else {
                        VStack(spacing: BBSpacing.space1) {
                            ForEach(liquidation.byPosition.prefix(6), id: \.id) { p in
                                HStack {
                                    BBText(p.name, style: BBTypography.body, lineLimit: 1)
                                    Spacer(minLength: BBSpacing.space3)
                                    BBText(text.money(p.tax, currency), style: BBTypography.body, color: .bbMutedForeground).monospacedDigit()
                                }
                                .padding(.top, BBSpacing.space1)
                            }
                        }
                    }
                } }
            }
        }
    }
}
