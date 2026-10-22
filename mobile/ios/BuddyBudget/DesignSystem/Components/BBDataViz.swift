import BuddyBudgetKit
import Charts
import SwiftUI

// Data viz basics (spec: design/charts.md §0–1, §2.1, §2.3, §3, §4; components.md §3.1, §3.8). Geometry, scales and
// gesture math come from BuddyBudgetKit (`ChartPaths`, `ChartScale`, `DonutGeometry`), shared with Android.
// Cartesian charts use Swift Charts (charts.md §5 recommendation); donut and sparkline are custom paths.

extension Path {
    /// Builds a path from the shared chart commands (screen coordinates, clockwise-positive arcs).
    init(_ commands: [ChartPathCommand]) {
        self.init()
        for command in commands {
            switch command {
            case .move(let p): move(to: CGPoint(x: p.x, y: p.y))
            case .line(let p): addLine(to: CGPoint(x: p.x, y: p.y))
            case .cubic(let c1, let c2, let to):
                addCurve(to: CGPoint(x: to.x, y: to.y), control1: CGPoint(x: c1.x, y: c1.y), control2: CGPoint(x: c2.x, y: c2.y))
            case .arc(let c, let r, let start, let sweep):
                addRelativeArc(center: CGPoint(x: c.x, y: c.y), radius: r, startAngle: .degrees(start), delta: .degrees(sweep))
            case .close: closeSubpath()
            }
        }
    }
}

/// Privacy mode for charts (§0 rule 2): blur 10 and no interaction.
private struct BBChartPrivacy: ViewModifier {
    @Environment(\.bbHideAmounts) private var hide
    func body(content: Content) -> some View {
        content.blur(radius: hide ? 10 : 0).allowsHitTesting(!hide)
    }
}

// MARK: - StatCard

/// Canonical `StatCard` (§3.1): card, overline label, value font-heading text-3xl tabular 0 decimals colored by tone
/// (`auto`: negative → `--neg`, else `--pos`), optional subtitle 4 pt below.
struct StatCard<Override: View>: View {
    let label: String
    let value: Double
    let currency: String
    var subtitle: String?
    var tone: AmountTone = .auto
    let valueOverride: Override?

    init(label: String, value: Double, currency: String, subtitle: String? = nil, tone: AmountTone = .auto,
         @ViewBuilder valueOverride: () -> Override) {
        self.label = label
        self.value = value
        self.currency = currency
        self.subtitle = subtitle
        self.tone = tone
        self.valueOverride = valueOverride()
    }

    var body: some View {
        BBCard {
            VStack(alignment: .leading, spacing: 0) {
                BBText(label, style: BBTypography.overline, color: .bbMutedForeground)
                    .padding(.bottom, BBSpacing.space2)
                if let valueOverride {
                    valueOverride
                        .bbTextStyle(BBTypography.statValue)
                        .foregroundStyle(AmountDisplay.role(for: value, tone: tone).color)
                } else {
                    AmountText(value: value, currency: currency, tone: tone, maximumFractionDigits: 0, style: BBTypography.statValue)
                }
                if let subtitle {
                    BBText(subtitle, style: BBTypography.body, color: .bbMutedForeground)
                        .padding(.top, BBSpacing.space1)
                }
            }
        }
    }
}

extension StatCard where Override == EmptyView {
    init(label: String, value: Double, currency: String, subtitle: String? = nil, tone: AmountTone = .auto) {
        self.label = label
        self.value = value
        self.currency = currency
        self.subtitle = subtitle
        self.tone = tone
        self.valueOverride = nil
    }
}

// MARK: - ProgressBar

enum BBProgressState: Equatable, Sendable {
    case none
    case indeterminate
    case determinate(value: Double, max: Double)
}

/// 6 pt bar, radius full, track `--muted`, fill `--primary` (width animates 300 ms); indeterminate = full bar
/// `--primary @ 50%` pulsing (§3.8).
struct ProgressBar: View {
    let state: BBProgressState
    var label: String = ""
    var color: Color = .bbPrimary

    @State private var pulse = false

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.bbMuted)
                switch state {
                case .none:
                    EmptyView()
                case .indeterminate:
                    Capsule().fill(color.opacity(0.5))
                        .opacity(pulse ? 0.5 : 1)
                        .onAppear {
                            withAnimation(.timingCurve(0.4, 0, 0.6, 1, duration: 1).repeatForever(autoreverses: true)) { pulse = true }
                        }
                case .determinate(let value, let max):
                    let fraction = max > 0 ? min(1, Swift.max(0, value / max)) : 0
                    Capsule().fill(color)
                        .frame(width: proxy.size.width * fraction)
                        .animation(.easeInOut(duration: BBMotion.durationSlow), value: fraction)
                }
            }
        }
        .frame(height: 6)
        .accessibilityElement()
        .accessibilityLabel(label)
        .accessibilityValue(accessibilityValue)
    }

    private var accessibilityValue: String {
        if case .determinate(let value, let max) = state, max > 0 { return "\(Int((value / max * 100).rounded()))%" }
        return ""
    }
}

// MARK: - Sparkline

/// 84×30 `smoothPath`, stroke 2 round cap, default `--swatch-teal`; fewer than 2 values → nothing (§3).
struct Sparkline: View {
    let values: [Double]
    var width: CGFloat = 84
    var height: CGFloat = 30
    var color: Color = .bbSwatchTeal

    var body: some View {
        let points = SparklineGeometry.points(values, width: width, height: height)
        Path(ChartPaths.line(points, curve: .smooth))
            .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            .frame(width: width, height: height)
            // SHELL-052 (web #448): an account's trend is the user's money too, obscured while amounts are hidden.
            .modifier(BBChartPrivacy())
            .accessibilityHidden(true)
    }
}

// MARK: - BBLineChart

struct BBChartPoint: Identifiable, Sendable {
    let id: Int
    /// Tooltip title (already formatted, e.g. "3 marzo 2026").
    let label: String
    let value: Double
}

/// Hero line/area chart (net worth "Totale", portfolio): hidden axes, Y domain `[min×0.9, max×1.01]`, margin top 8,
/// stroke 2 + gradient 0.30 → 0, no entry animation. Touch: crosshair (1 pt `--border`), active dot r 4 with a 2 pt
/// `--background` ring and a tooltip pinned at the top, clamped to 14–86 % of the width; horizontal drag scrubs,
/// vertical drag scrolls the page, lift hides (charts.md §1). Privacy: blurred and inert.
struct BBLineChart: View {
    let points: [BBChartPoint]
    var height: CGFloat = 240
    var color: Color = .bbPrimary
    var curve: ChartCurve = .monotone
    var showsArea = true
    var accessibilitySummary: String
    /// Tooltip value text (2 decimals currency by default at the call site).
    var formatValue: (Double) -> String
    @Binding var selection: Int?

    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var gestureAxis: Bool? = nil

    private var interpolation: InterpolationMethod {
        switch curve {
        case .monotone: .monotone
        case .linear: .linear
        case .smooth: .catmullRom
        case .stepAfter: .stepEnd
        }
    }

    var body: some View {
        let domain = ChartScale.heroDomain(points.map(\.value))
        let active = hideAmounts ? nil : selection.flatMap { i in points.indices.contains(i) ? points[i] : nil }
        Chart {
            ForEach(points) { p in
                if showsArea {
                    AreaMark(x: .value("x", p.id), yStart: .value("y", domain.lowerBound), yEnd: .value("y", p.value))
                        .interpolationMethod(interpolation)
                        .foregroundStyle(color.opacity(0.12))
                }
                LineMark(x: .value("x", p.id), y: .value("y", p.value))
                    .interpolationMethod(interpolation)
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
            if let active {
                RuleMark(x: .value("x", active.id))
                    .foregroundStyle(Color.bbBorder)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                PointMark(x: .value("x", active.id), y: .value("y", active.value))
                    .symbol {
                        Circle().fill(color).frame(width: 8, height: 8)
                            .overlay(Circle().stroke(Color.bbBackground, lineWidth: 2))
                    }
            }
        }
        .chartXScale(domain: 0...Double(max(1, points.count - 1)))
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
                    if let active, let x = proxy.position(forX: Double(active.id)) {
                        tooltip(for: active)
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
        .modifier(BBChartPrivacy())
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
                selection = ChartScale.scrubIndex(x: g.location.x - plot.minX, plotWidth: plot.width, count: points.count)
            }
            .onEnded { _ in
                gestureAxis = nil
                selection = nil
            }
    }

    private func tooltip(for point: BBChartPoint) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(point.label, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
            BBText(formatValue(point.value), style: .tooltipValue, color: .bbForeground, lineLimit: 1)
        }
        .padding(.horizontal, BBSpacing.space2_5)
        .padding(.vertical, BBSpacing.space1_5)
        .frame(minWidth: 128, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbBackground))
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbAlphaBorder50, lineWidth: 1))
        .bbShadow(BBShadow.xl)
    }
}

// MARK: - BBDonut

struct BBDonutSlice: Identifiable, Sendable {
    let id: Int
    let label: String
    let value: Double
    let color: Color
}

/// Donut (`CategoryDonut` / composition, charts.md §2.2–2.3): custom path on both platforms, Recharts geometry —
/// start at 3 o'clock, counter-clockwise, paddingAngle 2°, cornerRadius 4, no stroke. Tap locks a slice (others at
/// 0.35 opacity) and the center shows its name, amount and share; tap it again or outside the ring to unlock.
struct BBDonut: View {
    let slices: [BBDonutSlice]
    let currency: String
    var size: CGFloat = 192
    /// Center caption under the total when nothing is selected.
    var centerLabel: String = ""
    @Binding var selection: Int?
    var accessibilitySummary: String = ""
    /// Custom center for the focused slice index (nil = nothing focused); replaces the default total / slice summary.
    var centerContent: ((Int?) -> AnyView)? = nil
    /// Explicit radii (composition donut: 62 / 90 at 192, charts.md §2.2); default `CategoryDonut` proportions.
    var innerRadius: CGFloat? = nil
    var outerRadius: CGFloat? = nil

    @Environment(\.bbHideAmounts) private var hideAmounts
    @Environment(\.bbLocale) private var locale

    private var outer: CGFloat { outerRadius ?? size * 0.5 * 0.9 }
    private var inner: CGFloat { innerRadius ?? size * 0.69 * 0.5 }

    var body: some View {
        let angles = DonutGeometry.slices(slices.map(\.value), paddingAngle: 2)
        let focused = hideAmounts ? nil : selection
        ZStack {
            Canvas { context, canvas in
                let c = Double(canvas.width / 2)
                for (i, slice) in slices.enumerated() where i < angles.count {
                    let a = angles[i]
                    let path = Path(DonutGeometry.sectorPath(cx: c, cy: c, innerRadius: Double(inner), outerRadius: Double(outer),
                                                             startAngle: a.startAngle, endAngle: a.endAngle, cornerRadius: 4))
                    let dim = focused != nil && focused != i
                    context.fill(path, with: .color(slice.color.opacity(dim ? 0.35 : 1)))
                }
            }
            .modifier(BBChartPrivacy())
            Group {
                if let centerContent { centerContent(focused) } else { center(focused: focused) }
            }
            .frame(width: inner * 2 - 16)
        }
        .frame(width: size, height: size)
        .contentShape(Rectangle())
        .onTapGesture(coordinateSpace: .local) { location in
            guard !hideAmounts else { return }
            let c = Double(size / 2)
            let hit = DonutGeometry.hitTest(x: location.x, y: location.y, cx: c, cy: c, innerRadius: Double(inner),
                                            outerRadius: Double(outer), slices: angles)
            selection = (hit == nil || hit == selection) ? nil : hit
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    @ViewBuilder private func center(focused: Int?) -> some View {
        let total = slices.reduce(0) { $0 + max(0, $1.value) }
        VStack(spacing: 2) {
            if let i = focused, slices.indices.contains(i) {
                BBText(slices[i].label, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                AmountText(value: slices[i].value, currency: currency, maximumFractionDigits: 0,
                           style: BBTypography.amountLarge.with(size: 20, lineHeight: 28))
                BBText(BBFormat.formatPct(total > 0 ? slices[i].value / total : 0, locale: locale),
                       style: BBTypography.caption, color: .bbText2)
            } else {
                AmountText(value: total, currency: currency, maximumFractionDigits: 0, style: BBTypography.amountLarge.with(size: 20, lineHeight: 28))
                if !centerLabel.isEmpty {
                    BBText(centerLabel, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                }
            }
        }
        .multilineTextAlignment(.center)
    }
}
