import BuddyBudgetKit
import SwiftUI

// Pensione «Scenari» (PEN-023…026) and «Proiezione» (PEN-027/028). The exit-tax chip indexes the server's per-year
// timeline; the projection sliders run `PensionCalc.projectPension` on the device. Android: PensionScenarios.kt.

struct PensionScenariosTab: View {
    let model: PensionModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        if let view = model.state.view, let last = view.last, let perf = view.performance, let tfr = view.tfr {
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if debugShows(0) { WithdrawalSection(model: model, view: view, value: last.value, text: text) }
                if debugShows(1) { TfrSection(model: model, view: view, fundValue: last.value, annualReturn: perf.annualReturn, tfr: tfr, text: text) }
                if let fund = view.fund {
                    TaxSection(model: model, view: view, adhesionDate: fund.adhesionDate, text: text)
                }
            }
        } else {
            PensionNoSnapshots(model: model)
        }
    }
}

/// PEN-023 (+ the simulated delta of PEN-025).
private struct WithdrawalSection: View {
    let model: PensionModel
    let view: PensionView
    let value: Double
    let text: PensionText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let simulating = model.state.isSimulating
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(L10n.lookup(italian: "Se prelevassi oggi"), style: .sectionHeading).accessibilityAddTraits(.isHeader)
            HStack(alignment: .center, spacing: BBSpacing.space1) {
                ((simulating ? Text(L10n.lookup(italian: "Simulazione dell'aliquota in corso (vedi «Quando l'aliquota scende»).") + " ")
                    .fontWeight(.medium).foregroundColor(.bbForeground) : Text(""))
                    + Text(L10n.lookup(italian: "Quanto ti resterebbe al netto delle tasse, in tre ipotesi. È una stima, non consulenza fiscale."))
                    .foregroundColor(.bbText2))
                    .bbTextStyle(BBTypography.body)
                InfoHintButton(title: L10n.lookup(italian: "Come si stima il netto"),
                               text: L10n.lookup(italian: "Il valore alto presuppone che l'imposta si applichi solo ai contributi (i rendimenti hanno già pagato il 20% mentre maturavano). Il valore basso applica l'aliquota a tutto il controvalore. Quale sia giusto per te va confermato da un commercialista; non sono incluse eventuali penali del prodotto."))
            }
            VStack(alignment: .leading, spacing: BBSpacing.space6) {
                ForEach(model.state.scenarios, id: \.reason) { scenario in
                    let total = max(value, 1)
                    let baseline = view.scenarios.first { $0.reason == scenario.reason }?.netLow ?? scenario.netLow
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        HStack(alignment: .firstTextBaseline) {
                            BBText(text.reasonTitle(scenario.reason), style: BBTypography.bodyLarge.with(weight: 600))
                            Spacer(minLength: BBSpacing.space3)
                            (Text(text.money(scenario.netLow, model.currency, masked: hidden)) + Text(" – ").foregroundColor(.bbText2)
                                + Text(text.money(scenario.netHigh, model.currency, masked: hidden)))
                                .bbTextStyle(BBTextStyle.figure)
                                .monospacedDigit()
                        }
                        GeometryReader { proxy in
                            HStack(spacing: 0) {
                                Rectangle().fill(Color.bbPrimary).frame(width: proxy.size.width * max(0, scenario.netLow / total))
                                Rectangle().fill(Color.bbAlphaPrimary45).frame(width: proxy.size.width * max(0, (scenario.netHigh - scenario.netLow) / total))
                                Spacer(minLength: 0)
                            }
                        }
                        .frame(height: 14)
                        .background(Color.bbNeg.opacity(0.25))
                        .clipShape(Capsule())
                        .accessibilityElement()
                        .accessibilityLabel(L10n.lookup(italian: "Netto tra {0} e {1} su {2}", [
                            "0": text.money(scenario.netLow, model.currency), "1": text.money(scenario.netHigh, model.currency), "2": text.money(value, model.currency),
                        ]))
                        RunsText(runs: text.scenarioDetail(scenario, delta: simulating ? scenario.netLow - baseline : 0, currency: model.currency, masked: hidden),
                                 style: BBTypography.body)
                    }
                }
                HStack(spacing: BBSpacing.space4) {
                    LegendDot(label: L10n.lookup(italian: "Netto sicuro"), color: .bbPrimary)
                    LegendDot(label: L10n.lookup(italian: "Netto possibile"), color: .bbAlphaPrimary45)
                    LegendDot(label: L10n.lookup(italian: "Tasse"), color: .bbNeg.opacity(0.4))
                }
            }
            .padding(.top, BBSpacing.space1)
        }
    }
}

/// PEN-024.
private struct TfrSection: View {
    let model: PensionModel
    let view: PensionView
    let fundValue: Double
    let annualReturn: Double?
    let tfr: PensionView.Tfr
    let text: PensionText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let top = max(fundValue, tfr.net, 1)
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(L10n.lookup(italian: "Fondo o TFR in azienda?"), style: .sectionHeading).accessibilityAddTraits(.isHeader)
            HStack(alignment: .center, spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: "Gli stessi versamenti, in due posti diversi."), style: BBTypography.body, color: .bbText2)
                InfoHintButton(title: L10n.lookup(italian: "Come funziona il confronto"),
                               text: L10n.lookup(italian: "In azienda il TFR si rivaluta ogni anno dell'1,5% più il 75% dell'inflazione, con un'imposta sostitutiva sulla rivalutazione. Il confronto usa un'inflazione costante e non include le tasse all'uscita (diverse nei due casi). Regole da validare con un professionista."))
            }
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                bar(L10n.lookup(italian: "Nel fondo"), fundValue, rate: annualReturn, color: .bbPrimary, top: top)
                bar(L10n.lookup(italian: "In azienda, rivalutato"), tfr.net, rate: tfr.annualRate, color: .bbMutedForeground.opacity(0.5), top: top)
            }
            .padding(.top, BBSpacing.space1)
            RunsText(runs: text.tfrConclusion(fundValue: fundValue, tfr: tfr, inflation: view.assumedInflation, currency: model.currency, masked: hidden),
                     style: BBTypography.body)
                .padding(.top, BBSpacing.space1)
        }
    }

    private func bar(_ label: String, _ value: Double, rate: Double?, color: Color, top: Double) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            HStack(alignment: .firstTextBaseline) {
                BBText(label, style: BBTypography.bodyLarge.with(weight: 600))
                Spacer(minLength: BBSpacing.space3)
                BBText(text.money(value, model.currency, masked: hidden), style: BBTextStyle.figure).monospacedDigit()
            }
            GeometryReader { proxy in
                Capsule().fill(color).frame(width: proxy.size.width * value / top)
            }
            .frame(height: 14)
            .background(Color.bbAlphaForeground10.opacity(0.6))
            .clipShape(Capsule())
            BBText(rate.map { L10n.lookup(italian: "{0} l'anno", ["0": text.percent($0)]) } ?? L10n.lookup(italian: "rendimento non calcolabile"),
                   style: BBTypography.body, color: .bbText2)
        }
    }
}

/// PEN-025/026: the exit-tax timeline with the draggable chip.
private struct TaxSection: View {
    let model: PensionModel
    let view: PensionView
    let adhesionDate: String
    let text: PensionText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let state = model.state
        PanelSection(title: L10n.lookup(italian: "Quando l'aliquota scende"), icon: .percent, color: .bbSwatchPurple,
                     description: L10n.lookup(italian: "Sui contributi dal 2007 l'imposta in uscita è il 15%, ridotta di 0,30 punti per ogni anno oltre il quindicesimo di partecipazione, fino al 9%. Conta dalla prima adesione.")) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                TaxTimeline(model: model, view: view, adhesionDate: adhesionDate, text: text)
                RunsText(runs: text.taxSimulation(state: state, adhesionDate: adhesionDate, currency: model.currency, masked: hidden), style: BBTypography.body)
                if state.isSimulating {
                    BBButton(L10n.lookup(italian: "Torna a oggi"), variant: .outline, size: .sm) { model.setSimulatedYears(nil) }
                }
            }
        }
    }
}

private struct TaxTimeline: View {
    let model: PensionModel
    let view: PensionView
    let adhesionDate: String
    let text: PensionText

    var body: some View {
        let maxYears = Double(view.exitTax.maxYears)
        let shown = model.state.shownYears
        let real = min(view.exitTax.maxYears, view.exitTax.realYears)
        let flat = Double(PensionRules.flatYears) / maxYears
        let rate = text.percent(PensionCalc.exitTaxRate(Double(shown)))
        let milestones = PensionCalc.exitTaxMilestones(adhesionDate)
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            GeometryReader { proxy in
                let w = proxy.size.width
                ZStack(alignment: .topLeading) {
                    HStack(spacing: 0) {
                        Rectangle().fill(Color.bbNeg.opacity(0.7)).frame(width: w * flat)
                        Rectangle().fill(Color.bbPos.opacity(0.7))
                    }
                    .frame(height: 12)
                    .clipShape(Capsule())
                    .offset(y: 26)
                    if shown != real {
                        Capsule().fill(Color.bbForeground.opacity(0.4)).frame(width: 2, height: 12)
                            .offset(x: w * Double(real) / maxYears - 1, y: 26)
                    }
                    VStack(spacing: 0) {
                        BBText(rate, style: BBTypography.caption.with(weight: 500), color: .bbBackground)
                            .monospacedDigit()
                            .padding(.horizontal, BBSpacing.space1_5)
                            .padding(.vertical, BBSpacing.space0_5)
                            .background(RoundedRectangle.bb(BBRadius.md).fill(Color.bbForeground))
                        Rectangle().fill(Color.bbForeground).frame(width: 1, height: 14)
                    }
                    .fixedSize()
                    .position(x: w * Double(shown) / maxYears, y: 18)
                }
                .frame(width: w, height: 38, alignment: .topLeading)
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        let years = Int((min(max(g.location.x / max(w, 1), 0), 1) * maxYears).rounded())
                        if years != model.state.shownYears { model.setSimulatedYears(years) }
                    }
)
            }
            .frame(height: 38)
            .accessibilityElement()
            .accessibilityLabel(L10n.lookup(italian: "Anni di partecipazione al fondo, per simulare l'aliquota in uscita"))
            .accessibilityValue("\(shown) · \(rate)")
            .accessibilityAdjustableAction { direction in
                model.setSimulatedYears(min(view.exitTax.maxYears, max(0, shown + (direction == .increment ? 1 : -1))))
            }
            GeometryReader { proxy in
                let w = proxy.size.width
                ZStack(alignment: .topLeading) {
                    mark(String(adhesionDate.prefix(4)), L10n.lookup(italian: "Adesione"), alignment: .leading)
                        .frame(width: w, alignment: .leading)
                    mark(String(milestones.reductionStartsOn.prefix(4)), L10n.lookup(italian: "Inizia a scendere"), alignment: .center)
                        .fixedSize()
                        .position(x: w * flat, y: 16)
                    mark(String(milestones.minRateOn.prefix(4)), L10n.lookup(italian: "Minimo"), alignment: .trailing)
                        .frame(width: w, alignment: .trailing)
                }
                .frame(width: w, height: 36, alignment: .topLeading)
            }
            .frame(height: 36)
        }
    }

    private func mark(_ title: String, _ caption: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 0) {
            BBText(title, style: BBTypography.caption.with(weight: 500)).monospacedDigit()
            BBText(caption, style: BBTypography.caption, color: .bbText2)
        }
    }
}

// MARK: - Proiezione (PEN-027, PEN-028)

struct PensionProjectionTab: View {
    let model: PensionModel
    @State private var selection: Int?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        if let view = model.state.view, let last = view.last {
            let state = model.state
            let rates = view.projection.rates
            let points = PensionRules.projection(startValue: last.value, quarterly: state.quarterly, years: state.years, rates: rates)
            let end = points.last!
            let paidIn = state.quarterly * 4 * Double(state.years)
            PanelSection(title: L10n.lookup(italian: "Proiezione a pensione"), icon: .hourglass, color: .bbSwatchTeal,
                         description: L10n.lookup(italian: "In euro di oggi, quindi già al netto dell'inflazione. Una stima, non una promessa.")) {
                VStack(alignment: .leading, spacing: BBSpacing.space6) {
                    if debugShows(0) { VStack(alignment: .leading, spacing: BBSpacing.space4) {
                        scenario("Prudente", rates.prudent, end.prudent, color: .bbSwatchSlate, start: last.value, paidIn: paidIn, years: state.years, text: text)
                        scenario("Base", rates.base, end.base, color: .bbPrimary, start: last.value, paidIn: paidIn, years: state.years, text: text, strong: true)
                        scenario("Ottimistico", rates.optimistic, end.optimistic, color: .bbSwatchTeal, start: last.value, paidIn: paidIn, years: state.years, text: text)
                    } }
                    VStack(spacing: BBSpacing.space2) {
                        InvestmentsChart(count: points.count, series: [
                            InvestmentsSeries(id: "base", values: points.map(\.base), color: .bbPrimary, style: .line, width: 2.6),
                            InvestmentsSeries(id: "band", values: points.map(\.optimistic), color: .bbPrimary, style: .fill),
                            InvestmentsSeries(id: "optimistic", values: points.map(\.optimistic), color: .bbSwatchTeal, style: .dashed, width: 1.5),
                            InvestmentsSeries(id: "prudent", values: points.map(\.prudent), color: .bbSwatchSlate, style: .dashed, width: 1.5),
                        ], height: 240, zeroBased: true, accessibilitySummary: L10n.lookup(italian: "Proiezione a pensione"), selection: $selection) { i in
                            let p = points[i]
                            VStack(alignment: .leading, spacing: 2) {
                                BBText(L10n.lookup(italian: "Tra {0} anni", ["0": String(p.year)]), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                                BBText("\(L10n.lookup(italian: "Ottimistico")) \(text.money(p.optimistic, model.currency, masked: hidden))", style: BBTypography.caption, lineLimit: 1)
                                BBText("\(L10n.lookup(italian: "Base")) \(text.money(p.base, model.currency, masked: hidden))", style: BBTypography.caption, lineLimit: 1)
                                BBText("\(L10n.lookup(italian: "Prudente")) \(text.money(p.prudent, model.currency, masked: hidden))", style: BBTypography.caption, lineLimit: 1)
                            }
                        }
                        ChartAxisLabels(labels: points.map { "\($0.year)a" })
                    }
                    VStack(alignment: .leading, spacing: BBSpacing.space6) {
                        slider(L10n.lookup(italian: "Anni alla pensione"), value: String(state.years),
                               binding: Binding(get: { Double(state.years) }, set: { model.setProjection(years: Int($0)) }),
                               range: view.projection.sliders.years.min...view.projection.sliders.years.max, step: 1)
                        slider(L10n.lookup(italian: "Versamento ogni trimestre"), value: text.money(state.quarterly, model.currency, masked: hidden),
                               binding: Binding(get: { state.quarterly }, set: { model.setProjection(quarterly: $0) }),
                               range: view.projection.sliders.quarterlyContribution.min...view.projection.sliders.quarterlyContribution.max,
                               step: view.projection.sliders.quarterlyContribution.step, accessibility: L10n.lookup(italian: "Versamento trimestrale"))
                    }
                    RunsText(runs: text.paidInSentence(paidIn, currency: model.currency, masked: hidden), style: BBTypography.body)
                }
            }
        } else {
            PensionNoSnapshots(model: model)
        }
    }

    private func scenario(_ label: String, _ rate: Double, _ value: Double, color: Color, start: Double, paidIn: Double, years: Int,
                          text: PensionText, strong: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            HStack(spacing: BBSpacing.space2) {
                Circle().fill(color).frame(width: 10, height: 10)
                (Text(L10n.lookup(italian: label)).fontWeight(strong ? .semibold : .regular).foregroundColor(strong ? .bbForeground : .bbText2)
                    + Text(" \(L10n.lookup(italian: "· rendimento reale")) \(text.percent(rate, digits: 0))").foregroundColor(.bbText2))
                    .bbTextStyle(BBTypography.body)
            }
            BBText(text.money(value, model.currency, masked: hidden), style: BBTypography.statValue).monospacedDigit()
            BBText(text.projectionCaption(years: years, gain: value - start - paidIn, currency: model.currency, masked: hidden),
                   style: BBTypography.body, color: .bbText2)
        }
        .padding(.top, BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func slider(_ label: String, value: String, binding: Binding<Double>, range: ClosedRange<Double>, step: Double,
                        accessibility: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(alignment: .firstTextBaseline) {
                BBText(label, style: BBTypography.body, color: .bbText2)
                Spacer(minLength: BBSpacing.space3)
                BBText(value, style: BBTypography.cardTitle.with(size: 18, lineHeight: 28)).monospacedDigit()
            }
            BBSlider(value: binding, range: range, step: step, accessibilityLabel: accessibility ?? label)
        }
    }
}
