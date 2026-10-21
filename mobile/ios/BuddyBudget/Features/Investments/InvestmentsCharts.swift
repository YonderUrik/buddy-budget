import BuddyBudgetKit
import Charts
import SwiftUI

/// One plotted series of `InvestmentsChart`.
struct InvestmentsSeries: Identifiable {
    enum Style {
        case area, line, dashedStep, dashed
        /// Step-after area with its line (pension contributions).
        case areaStep
        /// Gradient fill only, no stroke (projection band).
        case fill
    }

    let id: String
    let values: [Double?]
    let color: Color
    var style: Style = .line
    var width: CGFloat = 2
}

/// Multi-series chart of Investimenti (portfolio value vs invested, cumulative TWR vs benchmark, drawdown, security
/// price): hidden axes, hero domain (or symmetric around 0), monotone curves, scrub with crosshair and a pinned
/// tooltip, horizontal drag scrubs / vertical scrolls. Android: InvestmentsChart in InvestmentsCharts.kt.
struct InvestmentsChart<Tooltip: View>: View {
    let count: Int
    let series: [InvestmentsSeries]
    var height: CGFloat = 240
    /// Include 0 in the domain (returns, drawdown) instead of the hero `[min × 0.9, max × 1.01]`.
    var zeroBased = false
    /// Horizontal reference line (security average price).
    var reference: Double?
    /// Dots on these indices of the first series (security purchases).
    var markers: [Int] = []
    var accessibilitySummary: String
    @Binding var selection: Int?
    @ViewBuilder let tooltip: (Int) -> Tooltip

    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var gestureAxis: Bool?

    private var domain: ClosedRange<Double> {
        var all = series.flatMap { $0.values.compactMap { $0 } }
        if let reference { all.append(reference) }
        if zeroBased {
            let lo = min(all.min() ?? 0, 0), hi = max(all.max() ?? 0, 0)
            let pad = max((hi - lo) * 0.08, 0.0001)
            return (lo - (lo < 0 ? pad : 0))...(hi + pad)
        }
        return ChartScale.heroDomain(all)
    }

    var body: some View {
        let domain = self.domain
        let active = hideAmounts ? nil : selection.flatMap { $0 < count ? $0 : nil }
        Chart {
            ForEach(series) { s in
                ForEach(Array(s.values.enumerated()), id: \.offset) { i, value in
                    if let value {
                        switch s.style {
                        case .area:
                            AreaMark(x: .value("x", i), yStart: .value("y", zeroBased ? 0 : domain.lowerBound), yEnd: .value("y", value),
                                     series: .value("s", s.id + "-area"))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(s.color.opacity(0.12))
                            LineMark(x: .value("x", i), y: .value("y", value), series: .value("s", s.id))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(s.color)
                                .lineStyle(StrokeStyle(lineWidth: s.width, lineCap: .round, lineJoin: .round))
                        case .line:
                            LineMark(x: .value("x", i), y: .value("y", value), series: .value("s", s.id))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(s.color)
                                .lineStyle(StrokeStyle(lineWidth: s.width, lineCap: .round, lineJoin: .round))
                        case .dashedStep:
                            LineMark(x: .value("x", i), y: .value("y", value), series: .value("s", s.id))
                                .interpolationMethod(.stepEnd)
                                .foregroundStyle(s.color)
                                .lineStyle(StrokeStyle(lineWidth: s.width, dash: [4, 4]))
                        case .dashed:
                            LineMark(x: .value("x", i), y: .value("y", value), series: .value("s", s.id))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(s.color)
                                .lineStyle(StrokeStyle(lineWidth: s.width, dash: [4, 4]))
                        case .areaStep:
                            AreaMark(x: .value("x", i), yStart: .value("y", zeroBased ? 0 : domain.lowerBound), yEnd: .value("y", value),
                                     series: .value("s", s.id + "-area"))
                                .interpolationMethod(.stepEnd)
                                .foregroundStyle(s.color.opacity(0.12))
                            LineMark(x: .value("x", i), y: .value("y", value), series: .value("s", s.id))
                                .interpolationMethod(.stepEnd)
                                .foregroundStyle(s.color)
                                .lineStyle(StrokeStyle(lineWidth: s.width))
                        case .fill:
                            AreaMark(x: .value("x", i), yStart: .value("y", zeroBased ? 0 : domain.lowerBound), yEnd: .value("y", value),
                                     series: .value("s", s.id + "-area"))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(s.color.opacity(0.12))
                        }
                    }
                }
            }
            if let reference {
                RuleMark(y: .value("ref", reference))
                    .foregroundStyle(Color.bbMutedForeground)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            }
            if let first = series.first {
                ForEach(markers, id: \.self) { i in
                    if i < first.values.count, let v = first.values[i] {
                        PointMark(x: .value("x", i), y: .value("y", v))
                            .symbol { Circle().fill(Color.bbForeground).frame(width: 8, height: 8).overlay(Circle().stroke(Color.bbBackground, lineWidth: 2)) }
                    }
                }
            }
            if let active {
                RuleMark(x: .value("x", active))
                    .foregroundStyle(Color.bbBorder)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                if let first = series.first, active < first.values.count, let v = first.values[active] {
                    PointMark(x: .value("x", active), y: .value("y", v))
                        .symbol { Circle().fill(first.color).frame(width: 8, height: 8).overlay(Circle().stroke(Color.bbBackground, lineWidth: 2)) }
                }
            }
        }
        .chartXScale(domain: 0...Double(max(1, count - 1)))
        .chartYScale(domain: domain)
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartOverlay { proxy in
            GeometryReader { geo in
                let plot = proxy.plotFrame.map { geo[$0] } ?? geo.frame(in: .local)
                ZStack(alignment: .topLeading) {
                    Rectangle().fill(Color.clear).contentShape(Rectangle())
                        .simultaneousGesture(scrub(plot: plot))
                    if let active, let x = proxy.position(forX: Double(active)) {
                        tooltip(active)
                            .padding(.horizontal, BBSpacing.space2_5)
                            .padding(.vertical, BBSpacing.space1_5)
                            .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbBackground))
                            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbAlphaBorder50, lineWidth: 1))
                            .bbShadow(BBShadow.xl)
                            .fixedSize()
                            .alignmentGuide(.leading) { d in d.width / 2 }
                            .offset(x: ChartScale.tooltipCenterX(plot.minX + x, width: geo.size.width), y: -8)
                            .allowsHitTesting(false)
                    }
                }
            }
        }
        .padding(.top, 8)
        .frame(height: height)
        .transaction { $0.animation = nil }
        .blur(radius: hideAmounts ? 10 : 0)
        .allowsHitTesting(!hideAmounts)
        .accessibilityElement()
        .accessibilityLabel(accessibilitySummary)
    }

    private func scrub(plot: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { g in
                let dx = g.translation.width, dy = g.translation.height
                if gestureAxis == nil, abs(dx) > 10 || abs(dy) > 10 { gestureAxis = abs(dx) >= abs(dy) }
                if gestureAxis == false {
                    selection = nil
                    return
                }
                selection = ChartScale.scrubIndex(x: g.location.x - plot.minX, plotWidth: plot.width, count: count)
            }
            .onEnded { _ in
                gestureAxis = nil
                selection = nil
            }
    }
}

/// Legend line under a chart: a short swatch (solid or dashed) + label.
struct ChartLegendItem: View {
    let label: String
    let color: Color
    var dashed = false

    var body: some View {
        HStack(spacing: BBSpacing.space1_5) {
            if dashed {
                Rectangle().fill(Color.clear).frame(width: 16, height: 1)
                    .overlay(Path { p in p.move(to: .zero); p.addLine(to: CGPoint(x: 16, y: 0)) }
                        .stroke(color, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
            } else {
                Capsule().fill(color).frame(width: 16, height: 2)
            }
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
        }
    }
}
