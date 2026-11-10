import BuddyBudgetKit
import SwiftUI
import UIKit

/// «Patrimonio netto» (OV-008…021, charts.md §2.1): headline with the change, view toggle, pension switch, the chart
/// (Totale area or stacked classes, press-and-drag detail), period selector, legend chips and notes.
/// Twin of `NetWorthCard` on Android.
struct NetWorthCard: View {
    let model: OverviewModel
    let view: OverviewView
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(ShellModel.self) private var shell

    var body: some View {
        if let state = model.chartState {
            let headline = state.headline(scrub: model.scrubIndex)
            // OV-044: imported data on its way into the history.
            let refresh = shell.chartRefresh(dataUpdatedAt: model.viewUpdatedAt, isFetching: model.fetchingView)
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Patrimonio netto"), style: BBTypography.bodyLarge.with(weight: 500), color: .bbMutedForeground)
                        .accessibilityAddTraits(.isHeader)
                    MoneyHero(value: headline.value, currency: view.currency)
                        .contentTransition(.numericText(value: headline.value))
                        .animation(model.scrubIndex != nil || reduceMotion ? nil : .easeOut(duration: 0.6), value: headline.value)
                    if state.isPartial {
                        BBText(partialLine(state), style: BBTypography.bodyStrong, color: .bbMutedForeground)
                    }
                    if state.hasHistory {
                        changeLine(headline.change)
                    } else {
                        BBText(L10n.lookup(italian: refresh?.message ?? "L'andamento comparirà nei prossimi giorni."), style: BBTypography.body,
                               color: .bbMutedForeground)
                    }
                }
                if state.showsViewToggle {
                    SegmentedControl(options: NetWorthChartView.allCases.map { ($0, L10n.lookup(italian: $0.label)) },
                                     selection: Binding(get: { model.chartView }, set: { model.setChartView($0) }),
                                     accessibilityLabel: L10n.lookup(italian: "Vista del grafico"))
                }
                if state.showsPensionSwitch {
                    HStack(spacing: BBSpacing.space2) {
                        BBSwitch(isOn: Binding(get: { model.includePension }, set: { model.setIncludePension($0) }), size: .sm,
                                 accessibilityLabel: L10n.lookup(italian: "Includi la previdenza nel totale"))
                        BBText(L10n.lookup(italian: "Includi la previdenza nel totale"), style: BBTypography.body, color: .bbMutedForeground)
                    }
                    .frame(minHeight: 24)
                }
                if state.hasHistory {
                    NetWorthChart(model: model, state: state, period: OverviewPeriod(rawValue: view.period) ?? model.period,
                                  currency: view.currency)
                        .opacity(refresh != nil ? 0.5 : 1)
                        .overlay(alignment: .top) {
                            if let refresh { ChartRefreshNote(state: refresh).padding(.top, BBSpacing.space2) }
                        }
                        .padding(.horizontal, -BBSpacing.space4)
                    // #408: the shared period selector (presets 44 pt, one line).
                    PeriodSelector(options: OverviewPeriod.allCases.map { ($0, L10n.lookup(italian: $0.label)) },
                                   selection: Binding(get: { model.period }, set: { model.setPeriod($0) }),
                                   accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"))
                        .frame(maxWidth: .infinity)
                    if state.showsLegend || !state.notes.isEmpty {
                        legend(state)
                    }
                }
            }
            .onChange(of: model.viewUpdatedAt) { _, at in shell.settleChart(dataUpdatedAt: at, isFetching: model.fetchingView) }
            .onChange(of: model.fetchingView) { _, fetching in shell.settleChart(dataUpdatedAt: model.viewUpdatedAt, isFetching: fetching) }
        }
    }

    /// OV-012: arrow, ±amount (no decimals), (±x%) and the period phrase; green ≥ 0, red < 0.
    private func changeLine(_ change: OverviewView.Change) -> some View {
        let negative = change.delta < 0
        let sign = negative ? "−" : "+"
        let amount = BBFormat.formatCurrency(abs(change.delta), currency: view.currency, locale: locale, maximumFractionDigits: 0,
                                             masked: hideAmounts)
        let pct = change.deltaPct.map { " (\(sign)\(BBFormat.formatPct(abs($0), locale: locale)))" } ?? ""
        let color: Color = negative ? .bbNeg : .bbPos
        let phrase = L10n.lookup(italian: model.period.changePhrase)
        let mono = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 400, letterSpacingEm: 0, tabularNums: true, uppercase: false,
                               anchor: .subheadline)
        return HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space1) {
            BBIconView(negative ? .trendingDown : .trendingUp, size: .md, color: color)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
            (Text(verbatim: "\(sign)\(amount)\(pct) ").font(mono.font).foregroundColor(color)
                + Text(verbatim: phrase).font(BBTypography.body.font).foregroundColor(.bbMutedForeground))
        }
    }

    private func partialLine(_ state: NetWorthChartState) -> String {
        let labels = state.hiddenClasses.map { L10n.lookup(italian: AssetClass.label($0)).lowercased() }.joined(separator: ", ")
        return L10n.lookup(italian: "Totale parziale") + L10n.lookup(italian: ", nascosto:") + " " + labels
    }

    /// OV-016 / OV-017 legend chips with `Mostra tutto`, then the notes (OV-015, OV-019).
    private func legend(_ state: NetWorthChartState) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if state.showsLegend {
                FlowRow(spacing: BBSpacing.space2, lineSpacing: BBSpacing.space2) {
                    ForEach(state.legend, id: \.key) { item in
                        LegendChip(item: item, currency: view.currency) { model.toggleClass(item.key) }
                    }
                    if state.isPartial {
                        Button { model.showAllClasses() } label: {
                            BBText(L10n.lookup(italian: "Mostra tutto"), style: BBTypography.bodyStrong, color: .bbPrimary)
                                .padding(.horizontal, BBSpacing.space3)
                                .frame(minHeight: BBLayout.minTouchTarget)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel(L10n.lookup(italian: "Voci del grafico: tocca per mostrarle o nasconderle"))
            }
            if !state.notes.isEmpty {
                FlowRow(spacing: BBSpacing.space4, lineSpacing: BBSpacing.space1) {
                    ForEach(state.notes, id: \.self) { BBText(L10n.lookup(italian: $0), style: BBTypography.body, color: .bbMutedForeground) }
                }
            }
        }
    }
}

/// Legend toggle chip: color dot (hollow when hidden), label (struck through when hidden), latest value 0 dp.
private struct LegendChip: View {
    let item: NetWorthChartState.LegendItem
    let currency: String
    let action: () -> Void
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let color = Color.bbOverviewToken(AssetClass.colorToken(item.key))
        Button(action: action) {
            HStack(spacing: BBSpacing.space1_5) {
                Circle().fill(item.visible ? color : .clear)
                    .overlay(Circle().strokeBorder(color, lineWidth: 1))
                    .frame(width: 10, height: 10)
                BBText(L10n.lookup(italian: AssetClass.label(item.key)), style: BBTypography.body,
                       color: item.visible ? .bbForeground : .bbMutedForeground)
                    .strikethrough(!item.visible, color: .bbMutedForeground)
                BBText(BBFormat.formatCurrency(item.latest, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts),
                       style: BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 500, letterSpacingEm: 0, tabularNums: true,
                                          uppercase: false, anchor: .subheadline))
            }
            .padding(.horizontal, BBSpacing.space3)
            .frame(minHeight: BBLayout.minTouchTarget)
            .overlay(
                Capsule().strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: item.visible ? [] : [3, 3]))
            )
            .contentShape(Capsule())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(Capsule()), translate: false))
        .accessibilityAddTraits(item.visible ? .isSelected : [])
    }
}

// MARK: - Chart

/// The net-worth plot, drawn with the shared geometry on both platforms: `Totale` = one area (hero domain, margin
/// top 8); `Per classe` = stacked bands (margins 5, x labels 13 pt, dashed grid) and the dark net line.
/// Press and drag shows the point detail pinned at the top and moves the headline (mobile adaptation of OV-020).
struct NetWorthChart: View {
    let model: OverviewModel
    let state: NetWorthChartState
    let period: OverviewPeriod
    let currency: String

    static let height: CGFloat = 240
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var gestureAxis: Bool?
    @State private var haptics = UISelectionFeedbackGenerator()

    var body: some View {
        GeometryReader { geo in
            let layout = ChartLayout(state: state, width: geo.size.width, height: Self.height)
            ZStack(alignment: .topLeading) {
                Canvas { context, _ in draw(layout, in: &context) }
                    .blur(radius: hideAmounts ? 10 : 0)
                if !hideAmounts, state.view == .byClass {
                    axisLabels(layout)
                }
                if !hideAmounts, let index = model.scrubIndex, let detail = state.detail(at: index) {
                    let x = layout.x(index)
                    PointDetailCard(detail: detail, currency: currency)
                        .chartAnchored(x: ChartScale.tooltipCenterX(x, width: geo.size.width), y: -BBSpacing.space2, anchor: 0.5)
                        .allowsHitTesting(false)
                }
            }
            .contentShape(Rectangle())
            .gesture(scrub(layout), including: hideAmounts ? .none : .all)
        }
        .frame(height: Self.height)
        .accessibilityElement()
        .accessibilityLabel(summary)
    }

    private var summary: String {
        L10n.lookup(italian: "Patrimonio netto {0}: da {1} a {2}.", [
            "0": L10n.lookup(italian: period.changePhrase),
            "1": BBFormat.formatCurrency(state.change.start, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts),
            "2": BBFormat.formatCurrency(state.change.end, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts),
        ])
    }

    private func scrub(_ layout: ChartLayout) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { g in
                let dx = g.translation.width, dy = g.translation.height
                if gestureAxis == nil, abs(dx) > 10 || abs(dy) > 10 { gestureAxis = abs(dx) >= abs(dy) }
                if gestureAxis == false {
                    model.scrubIndex = nil
                    return
                }
                let next = layout.index(atX: g.location.x)
                if next != model.scrubIndex {
                    model.scrubIndex = next
                    haptics.selectionChanged()
                }
            }
            .onEnded { _ in
                gestureAxis = nil
                model.scrubIndex = nil
            }
    }

    private func axisLabels(_ layout: ChartLayout) -> some View {
        let labels = state.shownSeries.map { NetWorthChartState.axisLabel($0.date, period: period, locale: locale) }
        let widths = labels.map { Double($0.count) * 7 }
        let kept = NetWorthStack.thinLabels(centers: labels.indices.map { Double(layout.x($0)) }, widths: widths,
                                            plotWidth: Double(layout.width))
        return ForEach(kept, id: \.self) { i in
            BBText(labels[i], style: BBTypography.body.with(size: 13, lineHeight: 16), color: .bbMutedForeground, lineLimit: 1)
                .chartAnchored(x: layout.x(i), y: layout.plotBottom + 8, anchor: i == labels.count - 1 ? 1 : 0.5)
        }
    }

    private func draw(_ layout: ChartLayout, in context: inout GraphicsContext) {
        let n = state.shownSeries.count
        guard n > 0 else { return }
        if state.view == .total {
            let points = (0..<n).map { ChartPoint(x: Double(layout.x($0)), y: Double(layout.y(state.shownSeries[$0].value))) }
            context.fill(Path(ChartPaths.area(points, curve: .monotone, baselineY: Double(layout.height))),
                         with: .color(Color.bbPrimary.opacity(0.12)))  // flat fill, no gradient (#417)
            context.stroke(Path(ChartPaths.line(points, curve: .monotone)), with: .color(.bbPrimary),
                           style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            drawCursor(layout, points: points, color: .bbPrimary, in: &context)
            return
        }
        for tick in layout.ticks {
            var line = Path()
            let y = layout.y(tick)
            line.move(to: CGPoint(x: layout.left, y: y))
            line.addLine(to: CGPoint(x: layout.right, y: y))
            context.stroke(line, with: .color(.bbBorder), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
        }
        for band in layout.bands {
            let upper = band.upper.enumerated().map { ChartPoint(x: Double(layout.x($0.offset)), y: Double(layout.y($0.element))) }
            let lower = band.lower.enumerated().map { ChartPoint(x: Double(layout.x($0.offset)), y: Double(layout.y($0.element))) }
            let color = Color.bbOverviewToken(AssetClass.colorToken(band.key))
            let excluded = band.key == AssetClass.pension && state.pensionExcluded
            context.fill(Path(NetWorthStack.bandPath(upper: upper, lower: lower)),
                         with: .color(color.opacity(excluded ? 0.1 : 0.22)))  // web fillOpacity, flat (#417)
            context.stroke(Path(ChartPaths.line(upper, curve: .monotone)), with: .color(color),
                           style: StrokeStyle(lineWidth: 1.5, dash: excluded ? [2, 3] : []))
        }
        let net = (0..<n).map { ChartPoint(x: Double(layout.x($0)), y: Double(layout.y(state.shownSeries[$0].value))) }
        if state.showsNetLine {
            context.stroke(Path(ChartPaths.line(net, curve: .monotone)), with: .color(.bbForeground),
                           style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        }
        let topBand = layout.bands.last.map { band in
            band.upper.enumerated().map { ChartPoint(x: Double(layout.x($0.offset)), y: Double(layout.y($0.element))) }
        } ?? net
        drawCursor(layout, points: state.showsNetLine ? net : topBand, color: state.showsNetLine ? .bbForeground : .bbPrimary, in: &context)
    }

    private func drawCursor(_ layout: ChartLayout, points: [ChartPoint], color: Color, in context: inout GraphicsContext) {
        guard !hideAmounts, let i = model.scrubIndex, points.indices.contains(i) else { return }
        let p = CGPoint(x: points[i].x, y: points[i].y)
        var line = Path()
        line.move(to: CGPoint(x: p.x, y: layout.plotTop))
        line.addLine(to: CGPoint(x: p.x, y: layout.plotBottom))
        context.stroke(line, with: .color(.bbBorder), lineWidth: 1)
        context.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)), with: .color(.bbBackground))
        context.fill(Path(ellipseIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)), with: .color(color))
    }
}

/// Plot geometry for one width: Totale (margin top 8, hero domain) or Per classe (margins 5, x-axis 30, nice domain).
private struct ChartLayout {
    let width: CGFloat
    let height: CGFloat
    let left: CGFloat
    let right: CGFloat
    let plotTop: CGFloat
    let plotBottom: CGFloat
    let domain: ClosedRange<Double>
    let bands: [NetWorthStack.Band]
    let ticks: [Double]
    let count: Int

    init(state: NetWorthChartState, width: CGFloat, height: CGFloat) {
        self.width = width
        self.height = height
        count = state.shownSeries.count
        if state.view == .total {
            left = 0
            right = width
            plotTop = 8
            plotBottom = height
            domain = ChartScale.heroDomain(state.shownSeries.map(\.value))
            bands = []
            ticks = []
        } else {
            left = 5
            right = width - 5
            plotTop = 5
            plotBottom = height - 5 - 30
            let bands = NetWorthStack.bands(state.shownSeries, classes: state.visibleClasses)
            self.bands = bands
            domain = NetWorthStack.domain(bands: bands, netLine: state.showsNetLine ? state.shownSeries.map(\.value) : nil)
            ticks = ChartScale.niceTicks(min: domain.lowerBound, max: domain.upperBound)
        }
    }

    func x(_ i: Int) -> CGFloat {
        left + CGFloat(ChartScale.x(index: i, count: count, left: 0, width: Double(right - left)))
    }

    func y(_ value: Double) -> CGFloat {
        CGFloat(ChartScale.y(value, domain: domain, top: Double(plotTop), height: Double(plotBottom - plotTop)))
    }

    func index(atX x: CGFloat) -> Int {
        ChartScale.scrubIndex(x: Double(x - left), plotWidth: Double(right - left), count: count)
    }
}

/// OV-020 detail: date (· stimato), one row per class top-down, total row.
private struct PointDetailCard: View {
    let detail: NetWorthChartState.PointDetail
    let currency: String
    @Environment(\.bbLocale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            let date = CalendarDate(iso: detail.date).map { BBFormat.formatLongDate($0, locale: locale) } ?? detail.date
            BBText(date + (detail.isEstimated ? " · " + L10n.lookup(italian: "stimato") : ""), style: BBTypography.caption,
                   color: .bbMutedForeground, lineLimit: 1)
            if !detail.rows.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    ForEach(detail.rows, id: \.key) { row in
                        HStack(spacing: BBSpacing.space4) {
                            HStack(spacing: BBSpacing.space1_5) {
                                Circle().fill(Color.bbOverviewToken(AssetClass.colorToken(row.key))).frame(width: 8, height: 8)
                                BBText(L10n.lookup(italian: row.label), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                            }
                            Spacer(minLength: 0)
                            BBText(money(row.value), style: .tooltipValue.with(weight: 400), color: .bbForeground, lineLimit: 1)
                        }
                    }
                }
                BBSeparator()
                HStack(spacing: BBSpacing.space4) {
                    BBText(L10n.lookup(italian: detail.totalLabel), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                    Spacer(minLength: 0)
                    BBText(money(detail.total), style: .tooltipValue, color: .bbForeground, lineLimit: 1)
                }
            } else {
                BBText(money(detail.total), style: .tooltipValue, color: .bbForeground, lineLimit: 1)
            }
        }
        .padding(.horizontal, BBSpacing.space3)
        .padding(.vertical, BBSpacing.space2)
        .frame(minWidth: 176, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbBackground))
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
        .bbShadow(BBShadow.sm)
    }

    private func money(_ value: Double) -> String { BBFormat.formatCurrency(value, currency: currency, locale: locale) }
}

extension View {
    /// Places a view at (x, y) inside a top-leading chart overlay, its leading edge (0), center (0.5) or trailing
    /// edge (1) on x, without affecting the container's layout (zero-size anchor).
    func chartAnchored(x: CGFloat, y: CGFloat, anchor: CGFloat) -> some View {
        Color.clear.frame(width: 0, height: 0)
            .overlay(alignment: .topLeading) {
                fixedSize().alignmentGuide(.leading) { $0.width * anchor }.alignmentGuide(.top) { _ in 0 }
            }
            .offset(x: x, y: y)
    }
}

/// OV-044 / TX-076: the line floating over a history chart while imported data is on its way.
struct ChartRefreshNote: View {
    let state: ChartRefresh.State

    var body: some View {
        BBText(L10n.lookup(italian: state.message), style: BBTypography.body, color: .bbText2)
            .multilineTextAlignment(.center)
            .padding(.horizontal, BBSpacing.space3)
            .padding(.vertical, BBSpacing.space1_5)
            .background(Capsule().fill(Color.bbBackground.opacity(0.9)))
            .overlay(Capsule().strokeBorder(Color.bbBorder, lineWidth: 1))
            .accessibilityAddTraits(.updatesFrequently)
    }
}
