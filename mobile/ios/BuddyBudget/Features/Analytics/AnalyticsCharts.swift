import BuddyBudgetKit
import SwiftUI

// Analitiche charts (design/charts.md §2.8): horizontal grid at 0.3 opacity, hidden Y axis, linear curves, X labels
// thinned with `minTickGap` (last kept), pinned popover tooltip on scrub. Custom Canvas on both platforms with the same
// geometry (Android: AnalyticsCharts.kt).

/// A line (optionally filled down to the domain bottom).
struct AnalyticsLine: Identifiable {
    let id: String
    let values: [Double?]
    let color: Color
    var width: CGFloat = 2
    var dash: [CGFloat] = []
    /// Fill under the line (`fillOpacity`), nil = no fill.
    var fill: Double?
}

/// A band between two series (Monte Carlo percentiles).
struct AnalyticsBand: Identifiable {
    let id: String
    let lower: [Double]
    let upper: [Double]
    let color: Color
    let opacity: Double
}

/// Horizontal reference line with a label inside the top-left (FIRE number).
struct AnalyticsReference {
    let value: Double
    let color: Color
    let label: String
}

private let plotTop: CGFloat = 5
private let plotSide: CGFloat = 5
private let axisHeight: CGFloat = 24

struct AnalyticsChart<Tooltip: View>: View {
    let count: Int
    var lines: [AnalyticsLine] = []
    var bands: [AnalyticsBand] = []
    let domain: ClosedRange<Double>
    var reference: AnalyticsReference?
    let xLabels: [String]
    var height: CGFloat = 224
    var minTickGap: CGFloat = 24
    var accessibilitySummary: String
    @ViewBuilder let tooltip: (Int) -> Tooltip

    @State private var selection: Int?
    @State private var gestureAxis: Bool?
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        GeometryReader { geo in
            let plot = CGRect(x: plotSide, y: plotTop, width: max(1, geo.size.width - plotSide * 2), height: max(1, geo.size.height - plotTop - plotSide - axisHeight))
            let active = hideAmounts ? nil : selection
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in draw(ctx, plot: plot, active: active) }
                ForEach(AnalyticsRules.visibleTicks(xLabels, plotWidth: plot.width, minTickGap: minTickGap), id: \.self) { i in
                    BBText(xLabels[i], style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                        .fixedSize()
                        .position(x: plot.minX + x(i, plot), y: plot.maxY + plotSide + 10)
                }
                if let reference {
                    BBText(reference.label, style: BBTypography.micro.with(weight: 400), color: reference.color, lineLimit: 1)
                        .fixedSize()
                        .offset(x: plot.minX + 4, y: y(reference.value, plot) + 3)
                }
                Rectangle().fill(Color.clear).contentShape(Rectangle())
                    .simultaneousGesture(scrub(plot: plot))
                if let active, active < count {
                    tooltip(active)
                        .padding(.horizontal, BBSpacing.space2_5)
                        .padding(.vertical, BBSpacing.space1_5)
                        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbPopover))
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                        .bbShadow(BBShadow.md)
                        .fixedSize()
                        .alignmentGuide(.leading) { d in d.width / 2 }
                        .offset(x: ChartScale.tooltipCenterX(plot.minX + x(active, plot), width: geo.size.width), y: -8)
                        .allowsHitTesting(false)
                }
            }
        }
        .frame(height: height)
        .transaction { $0.animation = nil }
        .blur(radius: hideAmounts ? 10 : 0)
        .allowsHitTesting(!hideAmounts)
        .accessibilityElement()
        .accessibilityLabel(accessibilitySummary)
    }

    private func x(_ i: Int, _ plot: CGRect) -> CGFloat { CGFloat(ChartScale.x(index: i, count: count, width: Double(plot.width))) }

    private func y(_ v: Double, _ plot: CGRect) -> CGFloat {
        CGFloat(ChartScale.y(v, domain: domain, top: Double(plot.minY), height: Double(plot.height)))
    }

    private func point(_ i: Int, _ v: Double, _ plot: CGRect) -> CGPoint { CGPoint(x: plot.minX + x(i, plot), y: y(v, plot)) }

    private func draw(_ ctx: GraphicsContext, plot: CGRect, active: Int?) {
        for g in AnalyticsRules.gridLines(domain) {
            var p = Path()
            p.move(to: CGPoint(x: plot.minX, y: y(g, plot)))
            p.addLine(to: CGPoint(x: plot.maxX, y: y(g, plot)))
            ctx.stroke(p, with: .color(Color.bbBorder.opacity(0.5 * 0.3)), lineWidth: 1)
        }
        for band in bands {
            var p = Path()
            for i in 0..<min(count, band.upper.count) {
                let pt = point(i, band.upper[i], plot)
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            for i in stride(from: min(count, band.lower.count) - 1, through: 0, by: -1) { p.addLine(to: point(i, band.lower[i], plot)) }
            p.closeSubpath()
            ctx.fill(p, with: .color(band.color.opacity(band.opacity)))
        }
        if let reference {
            var p = Path()
            p.move(to: CGPoint(x: plot.minX, y: y(reference.value, plot)))
            p.addLine(to: CGPoint(x: plot.maxX, y: y(reference.value, plot)))
            ctx.stroke(p, with: .color(reference.color), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        }
        for line in lines {
            var p = Path()
            var started = false
            var first: CGPoint?
            var last: CGPoint?
            for (i, v) in line.values.enumerated() where i < count {
                guard let v else { continue }
                let pt = point(i, v, plot)
                if started { p.addLine(to: pt) } else { p.move(to: pt); started = true; first = pt }
                last = pt
            }
            if let fill = line.fill, let first, let last {
                var area = p
                area.addLine(to: CGPoint(x: last.x, y: plot.maxY))
                area.addLine(to: CGPoint(x: first.x, y: plot.maxY))
                area.closeSubpath()
                ctx.fill(area, with: .color(line.color.opacity(fill)))
            }
            ctx.stroke(p, with: .color(line.color), style: StrokeStyle(lineWidth: line.width, lineCap: .round, lineJoin: .round, dash: line.dash))
        }
        if let active, active < count {
            var cross = Path()
            let cx = plot.minX + x(active, plot)
            cross.move(to: CGPoint(x: cx, y: plot.minY))
            cross.addLine(to: CGPoint(x: cx, y: plot.maxY))
            ctx.stroke(cross, with: .color(Color.bbBorder), lineWidth: 1)
            if let line = lines.last, active < line.values.count, let v = line.values[active] {
                let c = point(active, v, plot)
                let dot = Path(ellipseIn: CGRect(x: c.x - 4, y: c.y - 4, width: 8, height: 8))
                ctx.fill(dot, with: .color(line.color))
                ctx.stroke(dot, with: .color(Color.bbBackground), lineWidth: 2)
            }
        }
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
                selection = ChartScale.scrubIndex(x: Double(g.location.x - plot.minX), plotWidth: Double(plot.width), count: count)
            }
            .onEnded { _ in
                gestureAxis = nil
                selection = nil
            }
    }
}

/// Stacked bars with sign offset («Da dove arriva la crescita»): positives stack up from 0, negatives down.
struct AnalyticsStackedBars<Tooltip: View>: View {
    let labels: [String]
    /// Per bar, the segments bottom-up (value, color).
    let bars: [[(value: Double, color: Color)]]
    var height: CGFloat = 256
    var minTickGap: CGFloat = 16
    var accessibilitySummary: String
    @ViewBuilder let tooltip: (Int) -> Tooltip

    @State private var selection: Int?
    @State private var gestureAxis: Bool?
    @Environment(\.bbHideAmounts) private var hideAmounts

    private var domain: ClosedRange<Double> {
        let pos = bars.map { $0.map(\.value).filter { $0 > 0 }.reduce(0, +) }
        let neg = bars.map { $0.map(\.value).filter { $0 < 0 }.reduce(0, +) }
        return AnalyticsRules.autoDomain([0] + pos + neg)
    }

    var body: some View {
        GeometryReader { geo in
            let plot = CGRect(x: plotSide, y: plotTop, width: max(1, geo.size.width - plotSide * 2), height: max(1, geo.size.height - plotTop - plotSide - axisHeight))
            let active = hideAmounts ? nil : selection
            let band = plot.width / CGFloat(max(1, bars.count))
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in
                    let d = domain
                    func y(_ v: Double) -> CGFloat { CGFloat(ChartScale.y(v, domain: d, top: Double(plot.minY), height: Double(plot.height))) }
                    for g in AnalyticsRules.gridLines(d) {
                        var p = Path()
                        p.move(to: CGPoint(x: plot.minX, y: y(g)))
                        p.addLine(to: CGPoint(x: plot.maxX, y: y(g)))
                        ctx.stroke(p, with: .color(Color.bbBorder.opacity(0.5 * 0.3)), lineWidth: 1)
                    }
                    if let active {
                        ctx.fill(Path(CGRect(x: plot.minX + band * CGFloat(active), y: plot.minY, width: band, height: plot.height)),
                                 with: .color(Color.bbMuted.opacity(0.6)))
                    }
                    for (i, segments) in bars.enumerated() {
                        let left = plot.minX + band * CGFloat(i) + band * 0.1
                        var up = 0.0, down = 0.0
                        for s in segments where s.value != 0 {
                            let from = s.value > 0 ? up : down
                            let to = from + s.value
                            if s.value > 0 { up = to } else { down = to }
                            let top = min(y(from), y(to)), bottom = max(y(from), y(to))
                            ctx.fill(Path(CGRect(x: left, y: top, width: band * 0.8, height: bottom - top)), with: .color(s.color))
                        }
                    }
                }
                ForEach(AnalyticsRules.visibleTicks(labels, plotWidth: Double(plot.width - band), minTickGap: Double(minTickGap)), id: \.self) { i in
                    BBText(labels[i], style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                        .fixedSize()
                        .position(x: plot.minX + band * (CGFloat(i) + 0.5), y: plot.maxY + plotSide + 10)
                }
                Rectangle().fill(Color.clear).contentShape(Rectangle())
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { g in
                                let dx = g.translation.width, dy = g.translation.height
                                if gestureAxis == nil, abs(dx) > 10 || abs(dy) > 10 { gestureAxis = abs(dx) >= abs(dy) }
                                if gestureAxis == false { selection = nil; return }
                                selection = min(max(Int((g.location.x - plot.minX) / band), 0), bars.count - 1)
                            }
                            .onEnded { _ in gestureAxis = nil; selection = nil }
                    )
                if let active {
                    tooltip(active)
                        .padding(.horizontal, BBSpacing.space2_5)
                        .padding(.vertical, BBSpacing.space1_5)
                        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbPopover))
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                        .bbShadow(BBShadow.md)
                        .fixedSize()
                        .alignmentGuide(.leading) { d in d.width / 2 }
                        .offset(x: ChartScale.tooltipCenterX(plot.minX + band * (CGFloat(active) + 0.5), width: geo.size.width), y: -8)
                        .allowsHitTesting(false)
                }
            }
        }
        .frame(height: height)
        .blur(radius: hideAmounts ? 10 : 0)
        .allowsHitTesting(!hideAmounts)
        .accessibilityElement()
        .accessibilityLabel(accessibilitySummary)
    }
}

/// Tooltip rows: a bold title then plain «label value» rows.
struct AnalyticsTooltip: View {
    let title: String
    let rows: [(label: String, value: String, muted: Bool)]

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(title, style: BBTypography.caption.with(weight: 500), lineLimit: 1)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                BBText("\(row.label) \(row.value)", style: BBTypography.caption, color: row.muted ? .bbMutedForeground : .bbForeground, lineLimit: 1)
                    .monospacedDigit()
            }
        }
    }
}
