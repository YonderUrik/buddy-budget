import BuddyBudgetKit
import SwiftUI

/// Pensione frame (09-pension): title and subtitle, fund chips when there is more than one (PEN-003), the five tabs
/// as a scrollable segmented bar, the states (PEN-005, PEN-013) and the disclaimer under every tab (PEN-004).
/// IT only: DE never gets here (route policy, PEN-001); a 403 shows the country-unavailable state.
/// Twin of `PensionScreen` on Android.
struct PensionScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.pension
        let hasFund = model.state.view?.fund != nil
        // #427: with a fund the current tab is the title («Panoramica ⌄», views sheet); without one, title and subtitle.
        BBScreen(title: hasFund ? nil : L10n.lookup(italian: "Pensione"), onBack: back, onRefresh: { await model.load() }) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                if let view = model.state.view, view.fund != nil {
                    VStack(alignment: .leading, spacing: BBSpacing.space3) {
                        SectionViewsHeading(sectionTitle: L10n.lookup(italian: "Pensione"), items: PensionTab.allCases.map { tab in
                            SectionViewItem(id: tab.rawValue, label: L10n.lookup(italian: tab.title), description: L10n.lookup(italian: tab.description),
                                            icon: BBIcon.forKey(tab.iconKey), isActive: tab == model.state.tab) { model.select(tab) }
                        }) { EmptyView() }
                        .padding(.top, BBSpacing.space4)
                        if view.funds.count > 1 { FundChips(model: model, funds: view.funds) }
                    }
                } else {
                    BBText(L10n.lookup(italian: "Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà"),
                           style: BBTypography.body, color: .bbMutedForeground)
                        .padding(.top, -BBSpacing.space3)
                }
                PensionGateView(model: model)
            }
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.load() } }
        .formDialog(isPresented: Binding(get: { model.importOpen }, set: { model.importOpen = $0 })) {
            if let fund = model.state.fund { PensionImportView(model: model, fund: fund) }
        }
    }
}

/// PEN-003: fund selector (chip row).
private struct FundChips: View {
    let model: PensionModel
    let funds: [PensionView.FundSummary]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: BBSpacing.space2) {
                ForEach(funds) { fund in
                    let active = fund.id == model.state.fundId
                    Button { model.selectFund(fund.id) } label: {
                        BBText(fund.name, style: active ? BBTypography.bodyStrong : BBTypography.body,
                               color: active ? .bbPrimary : .bbMutedForeground, lineLimit: 1)
                            .padding(.horizontal, BBSpacing.space3)
                            .frame(height: 30)
                            .background(Capsule().fill(active ? Color.bbAlphaPrimary10 : .clear))
                            .overlay(Capsule().strokeBorder(active ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
                            .bbHitArea(height: 30)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            .padding(.horizontal, BBSpacing.space4)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -BBSpacing.space4)
        .accessibilityLabel(L10n.lookup(italian: "Fondo"))
    }
}

private struct PensionGateView: View {
    let model: PensionModel

    var body: some View {
        switch model.state.gate {
        case .loading:
            VStack(spacing: BBSpacing.space4) {
                BBSkeleton(height: 208, radius: BBRadius.xl)
                BBSkeleton(height: 128, radius: BBRadius.xl)
            }
            .accessibilityLabel(L10n.loading)
        case .failed:
            LoadError(message: L10n.lookup(italian: "Impossibile caricare i dati della pensione."), onRetry: { Task { await model.retry() } })
        case .unavailable:
CountryUnavailableState()
        case .empty:
            PanelSection(title: L10n.lookup(italian: "Aggiungi il tuo fondo pensione"), icon: .umbrella, color: .bbSwatchTeal,
                         description: L10n.lookup(italian: "Ti basta inserire, ogni tanto, i due numeri che vedi nell'area clienti del fondo: contributi netti e controvalore. Da lì calcoliamo rendimento, quanto ti resterebbe prelevando oggi, il confronto col TFR in azienda e dove arriverai.")) {
                AddFundForm(model: model)
            }
        case .content:
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                switch model.state.tab {
                case .overview: PensionOverviewTab(model: model)
                case .trend: PensionTrendTab(model: model)
                case .scenarios: PensionScenariosTab(model: model)
                case .projection: PensionProjectionTab(model: model)
                case .data: PensionDataTab(model: model)
                }
                BBText(L10n.lookup(italian: "Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista."),
                       style: BBTypography.caption, color: .bbText2)
            }
        }
    }
}

/// PEN-013: analysis tabs without snapshots.
struct PensionNoSnapshots: View {
    let model: PensionModel

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Mancano i valori del fondo"), icon: .database, color: .bbPrimary) {
            HStack(spacing: 0) {
                (Text(L10n.lookup(italian: "Inserisci contributi netti e controvalore dalla scheda")).foregroundColor(.bbText2)
                    + Text(" " + L10n.lookup(italian: "I tuoi dati")).fontWeight(.semibold).foregroundColor(.bbPrimary)
                    + Text(L10n.lookup(italian: ": al resto pensiamo noi.")).foregroundColor(.bbText2))
                    .bbTextStyle(BBTypography.body)
                    .onTapGesture { model.select(.data) }
                    .accessibilityAddTraits(.isLink)
            }
        }
    }
}

// MARK: - Panoramica (PEN-019…021)

private struct PensionOverviewTab: View {
    let model: PensionModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        if let view = model.state.view, let fund = view.fund, let perf = view.performance, model.state.hasSnapshots {
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if debugShows(0) { PensionHero(model: model, view: view, fund: fund, perf: perf, text: text) }
                PanelSection(title: L10n.lookup(italian: "Dove stai andando"), icon: .compass, color: .bbSwatchTeal) {
                    VStack(alignment: .leading, spacing: BBSpacing.space6) {
                        let beats = PensionRules.beatsTfr(view)
                        insight(eyebrow: "Fondo o TFR in azienda", caption: beats ? "Il fondo rende più della rivalutazione del TFR lasciato in azienda."
                                : "Il TFR in azienda si rivaluta più di quanto ha reso il fondo finora.", tab: .scenarios) {
                            (Text(perf.annualReturn.map { text.percent($0) } ?? "—").foregroundColor(beats ? .bbPos : .bbNeg)
                                + Text(" \(L10n.lookup(italian: "contro")) \(text.percent(view.tfr?.annualRate ?? 0))")
                                .font(BBTypography.bodyLarge.font).foregroundColor(.bbText2))
                                .bbTextStyle(BBTypography.amountLarge)
                        }
                        if let pension = view.scenarios.first {
                            insight(eyebrow: "Se prelevassi oggi", caption: "Netto stimato alla pensione, tasse comprese.", tab: .scenarios) {
                                (Text(text.money(pension.netLow, model.currency, masked: hidden)) + Text(" –").foregroundColor(.bbText2)
                                    + Text(text.money(pension.netHigh, model.currency, masked: hidden)))
                                    .bbTextStyle(BBTypography.amountLarge)
                            }
                        }
                        insight(eyebrow: L10n.lookup(italian: "Tra {0} anni", ["0": String(PensionRules.previewYears)]),
                                caption: "Scenario base, in euro di oggi: già al netto dell'inflazione.", tab: .projection) {
                            BBText(text.money(view.projection.preview?.base ?? 0, model.currency, masked: hidden), style: BBTypography.amountLarge)
                        }
                    }
                }
            }
        } else {
            PensionNoSnapshots(model: model)
        }
    }

    private func insight<Headline: View>(eyebrow: String, caption: String, tab: PensionTab, @ViewBuilder headline: () -> Headline) -> some View {
        Button { model.select(tab) } label: {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: eyebrow), style: BBTypography.body, color: .bbText2)
                headline().monospacedDigit()
                BBText(L10n.lookup(italian: caption), style: BBTypography.body, color: .bbText2)
                HStack(spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Vedi i dettagli"), style: .link, color: .bbPrimary)
                    BBIconView(.arrowRight, size: .md, color: .bbPrimary)
                }
                .padding(.top, BBSpacing.space1)
            }
            .padding(.top, BBSpacing.space4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct PensionHero: View {
    let model: PensionModel
    let view: PensionView
    let fund: PensionView.Fund
    let perf: PensionView.Performance
    let text: PensionText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let up = perf.gain >= 0
        let tone: Color = up ? .bbPos : .bbNeg
        VStack(alignment: .leading, spacing: 0) {
            BBText(text.heroEyebrow(name: fund.name, lastDate: perf.lastDate), style: BBTypography.bodyLarge, color: .bbText2)
            MoneyHero(value: perf.value, currency: model.currency)
            HStack(spacing: BBSpacing.space2) {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(up ? .trendingUp : .trendingDown, size: .md, color: tone)
                    BBText(text.signedMoney(perf.gain, model.currency, masked: hidden), style: BBTypography.mono.with(size: 14, lineHeight: 20, weight: 600), color: tone)
                }
                BBText(text.gainCaption(perf.gain), style: BBTypography.body, color: .bbText2)
            }
            .padding(.top, BBSpacing.space3)
            PensionTrendChart(model: model, snapshots: fund.snapshots, text: text)
                .padding(.top, BBSpacing.space2)
            Grid(alignment: .leading, horizontalSpacing: BBSpacing.space6, verticalSpacing: BBSpacing.space5) {
                GridRow {
                    measure(L10n.lookup(italian: "Versato"), text.money(perf.netContributions, model.currency, masked: hidden))
                    measure(L10n.lookup(italian: "Sui contributi"), perf.gainPct.map { text.signedPercent($0) } ?? "—", color: tone)
                }
                GridRow {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: BBSpacing.space1) {
                            BBText(text.annualReturnLabel(approximate: perf.approximate), style: BBTypography.body, color: .bbText2)
                            InfoHintButton(title: L10n.lookup(italian: "Come si calcola il rendimento annuo"),
                                           text: L10n.lookup(italian: "Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima."))
                        }
                        BBText(perf.annualReturn.map { text.signedPercent($0) } ?? "—", style: BBTextStyle.figure).monospacedDigit()
                    }
                    .gridCellColumns(2)
                }
            }
            .padding(.top, BBSpacing.space5)
        }
    }

    private func measure(_ label: String, _ value: String, color: Color = .bbForeground) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            BBText(value, style: BBTextStyle.figure, color: color).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// PEN-020: contributions (step area) and value (line) from the 2nd snapshot.
struct PensionTrendChart: View {
    let model: PensionModel
    let snapshots: [PensionSnapshot]
    let text: PensionText
    @State private var selection: Int?
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        if snapshots.count < PensionRules.minChartPoints {
            BBText(L10n.lookup(italian: "Il grafico compare dalla seconda fotografia del fondo."), style: BBTypography.body, color: .bbText2)
        } else {
            VStack(spacing: BBSpacing.space2) {
                InvestmentsChart(count: snapshots.count, series: [
                    InvestmentsSeries(id: "value", values: snapshots.map(\.value), color: .bbPrimary, style: .line, width: 2.6),
                    InvestmentsSeries(id: "contributions", values: snapshots.map(\.netContributions), color: .bbSwatchSlate, style: .areaStep),
                ], height: 260, zeroBased: true, accessibilitySummary: L10n.lookup(italian: "Andamento del fondo"), selection: $selection) { i in
                    let s = snapshots[i]
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(text.chartDate(s.date), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                        BBText("\(L10n.lookup(italian: "Controvalore")) \(text.money(s.value, model.currency, masked: hidden))", style: BBTypography.caption, lineLimit: 1)
                        BBText("\(L10n.lookup(italian: "Contributi netti")) \(text.money(s.netContributions, model.currency, masked: hidden))",
                               style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                    }
                }
                ChartAxisLabels(labels: snapshots.map { text.chartDate($0.date) })
                HStack(spacing: BBSpacing.space5) {
                    LegendDot(label: L10n.lookup(italian: "Controvalore"), color: .bbPrimary)
                    LegendDot(label: L10n.lookup(italian: "Contributi netti"), color: .bbMutedForeground.opacity(0.6))
                }
            }
        }
    }
}

/// First, middle and last x labels under a chart.
struct ChartAxisLabels: View {
    let labels: [String]

    var body: some View {
        let picks = labels.isEmpty ? [] : Array(Set([0, labels.count / 2, labels.count - 1])).sorted()
        HStack {
            ForEach(Array(picks.enumerated()), id: \.offset) { index, i in
                if index > 0 { Spacer(minLength: BBSpacing.space2) }
                BBText(labels[i], style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
            }
        }
        .padding(.horizontal, BBSpacing.space1)
        .accessibilityHidden(true)
    }
}

/// 8 pt dot + caption.
struct LegendDot: View {
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: BBSpacing.space1_5) {
            Circle().fill(color).frame(width: 8, height: 8)
            BBText(label, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
        }
    }
}

// MARK: - Andamento (PEN-020, PEN-022)

private struct PensionTrendTab: View {
    let model: PensionModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        if let view = model.state.view, let fund = view.fund, !fund.snapshots.isEmpty {
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if debugShows(0) {
                    PanelSection(title: L10n.lookup(italian: "Andamento del fondo"), icon: .chartLine, color: .bbPrimary,
                                 description: L10n.lookup(italian: "I contributi versati e il controvalore del fondo, fotografia dopo fotografia.")) {
                        PensionTrendChart(model: model, snapshots: fund.snapshots, text: text)
                    }
                }
                PanelSection(title: L10n.lookup(italian: "Anno per anno"), icon: .chartNoAxesColumn, color: .bbSwatchGreen,
                             description: L10n.lookup(italian: "Quanto hai versato e quanto ha reso il fondo in ogni anno, anche in percentuale: rendimento diviso per il valore a inizio anno più i versamenti. * anno in corso, non annualizzato.")) {
                    VStack(alignment: .leading, spacing: BBSpacing.space4) {
                        YearlyBars(years: view.yearly)
                        HStack(spacing: BBSpacing.space5) {
                            LegendDot(label: L10n.lookup(italian: "Versato"), color: .bbPrimary)
                            LegendDot(label: L10n.lookup(italian: "Rendimento"), color: .bbPos)
                            LegendDot(label: L10n.lookup(italian: "Perdita"), color: .bbNeg)
                        }
                        .frame(maxWidth: .infinity)
                        FlowRows(items: view.yearly.map { year in
                            (year.partial ? "\(year.year)*" : String(year.year), year.returnRate.map { text.signedPercent($0) } ?? L10n.lookup(italian: "n.d."),
                             year.returnRate == nil ? Color.bbText2 : year.gain < 0 ? .bbNeg : .bbPos)
                        })
                        .accessibilityLabel(L10n.lookup(italian: "Rendimento percentuale per anno"))
                        if let pair = PensionRules.bestAndWorst(view.yearly) {
                            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                                yearStat(L10n.lookup(italian: "Anno migliore"), pair.best, color: .bbPos, text: text)
                                yearStat(L10n.lookup(italian: "Anno peggiore"), pair.worst, color: pair.worst.gain < 0 ? .bbNeg : .bbForeground, text: text)
                            }
                        }
                    }
                }
            }
        } else {
            PensionNoSnapshots(model: model)
        }
    }

    private func yearStat(_ label: String, _ year: PensionView.Year, color: Color, text: PensionText) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            (Text("\(year.year) · \(text.signedMoney(year.gain, model.currency, masked: hidden))").foregroundColor(color)
                + Text(year.returnRate.map { " (\(text.signedPercent($0)))" } ?? "").font(BBTypography.body.font).foregroundColor(.bbText2))
                .bbTextStyle(BBTextStyle.figure)
                .monospacedDigit()
        }
        .padding(.top, BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Wrapping row of «label value» pairs (web `flex-wrap gap-x-5 gap-y-1.5`).
struct FlowRows: View {
    let items: [(String, String, Color)]

    var body: some View {
        FlowLayout(spacing: BBSpacing.space5, lineSpacing: BBSpacing.space1_5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(spacing: BBSpacing.space1_5) {
                    BBText(item.0, style: BBTypography.body, color: .bbText2)
                    BBText(item.1, style: BBTypography.body.with(weight: 600), color: item.2).monospacedDigit()
                }
                .fixedSize()
            }
        }
    }
}

/// PEN-022: stacked bars per year (contributions + gain above zero, loss below).
private struct YearlyBars: View {
    let years: [PensionView.Year]

    var body: some View {
        let top = max(years.map { $0.contributions + max(0, $0.gain) }.max() ?? 1, 1)
        let bottom = years.map { min(0, $0.gain) }.min() ?? 0
        let range = top - bottom
        VStack(spacing: BBSpacing.space2) {
            GeometryReader { proxy in
                let h = proxy.size.height
                let zeroY = h * top / range
                ZStack(alignment: .topLeading) {
                    Rectangle().fill(Color.bbBorder).frame(height: 1).offset(y: zeroY)
                    HStack(alignment: .top, spacing: 0) {
                        ForEach(Array(years.enumerated()), id: \.offset) { _, year in
                            let contrib = h * year.contributions / range
                            let gainUp = h * max(0, year.gain) / range
                            let gainDown = h * -min(0, year.gain) / range
                            VStack(spacing: 0) {
                                UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4).fill(Color.bbPos).frame(height: gainUp)
                                Rectangle().fill(Color.bbPrimary).frame(height: contrib)
                                UnevenRoundedRectangle(bottomLeadingRadius: 4, bottomTrailingRadius: 4).fill(Color.bbNeg).frame(height: gainDown)
                            }
                            .frame(width: min(48, proxy.size.width / CGFloat(max(1, years.count)) * 0.6))
                            .offset(y: zeroY - contrib - gainUp)
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .frame(height: 240)
            HStack(spacing: 0) {
                ForEach(Array(years.enumerated()), id: \.offset) { _, year in
                    BBText(year.partial ? "\(year.year)*" : String(year.year), style: BBTypography.caption, color: .bbMutedForeground)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
