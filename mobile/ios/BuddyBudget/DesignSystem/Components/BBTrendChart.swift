import BuddyBudgetKit
import SwiftUI

/// Hand-drawn `TrendChart` (charts.md §3): smooth line 2.6 with an area gradient 0.26 → 0, optional dashed
/// reference series («Di solito», `--text-3` 2, dash 2 7). Touch-and-drag scrubs: vertical line `--foreground @ 20%`,
/// 14 pt dot with a 2 pt `--background` ring and a tooltip pinned at the top. Fewer than 2 points → a muted
/// placeholder of the same height. Privacy: blurred and inert. Android: BBTrendChart.kt.
struct BBTrendChart: View {
    let values: [Double]
    var reference: [Double]?
    /// Tooltip title per index (e.g. a long date).
    var labels: [String] = []
    var height: CGFloat = 200
    var color: Color = .bbPrimary
    var referenceLabel: String = ""
    var formatValue: (Double) -> String
    var accessibilitySummary: String = ""

    @State private var selection: Int?
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        if values.count < 2 {
            RoundedRectangle.bb(BBRadius.xl).fill(Color.bbMuted.opacity(0.5)).frame(height: height)
        } else {
            GeometryReader { proxy in
                let width = Double(proxy.size.width)
                let layout = TrendGeometry.layout(values: values, reference: reference, width: width, height: Double(height))
                ZStack(alignment: .topLeading) {
                    Path(ChartPaths.area(layout.line, curve: .smooth, baselineY: Double(height)))
                        .fill(color.opacity(0.12))
                    if !layout.reference.isEmpty {
                        Path(ChartPaths.line(layout.reference, curve: .smooth))
                            .stroke(Color.bbText3, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 7]))
                    }
                    Path(ChartPaths.line(layout.line, curve: .smooth))
                        .stroke(color, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
                    if let i = selection, !hideAmounts {
                        let x = CGFloat(Double(i) * (layout.columns > 1 ? width / Double(layout.columns - 1) : 0))
                        Rectangle().fill(Color.bbForeground.opacity(0.2)).frame(width: 1, height: height).offset(x: x)
                        if i < layout.line.count {
                            Circle().fill(color).frame(width: 14, height: 14)
                                .overlay(Circle().stroke(Color.bbBackground, lineWidth: 2))
                                .offset(x: x - 7, y: CGFloat(layout.line[i].y) - 7)
                        }
                        tooltip(i)
                            .fixedSize()
                            .alignmentGuide(.leading) { d in d.width / 2 }
                            .offset(x: CGFloat(ChartScale.tooltipCenterX(Double(x), width: width)), y: -8)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { g in
                            guard !hideAmounts else { return }
                            selection = TrendGeometry.index(x: Double(g.location.x), width: width, columns: layout.columns)
                        }
                        .onEnded { _ in selection = nil }
                )
            }
            .frame(height: height)
            .blur(radius: hideAmounts ? 10 : 0)
            .allowsHitTesting(!hideAmounts)
            .accessibilityElement()
            .accessibilityLabel(accessibilitySummary)
        }
    }

    @ViewBuilder private func tooltip(_ i: Int) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            if i < labels.count { BBText(labels[i], style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1) }
            if i < values.count { BBText(formatValue(values[i]), style: BBTypography.bodyStrong.with(weight: 500), lineLimit: 1) }
            if let reference, i < reference.count, !referenceLabel.isEmpty {
                BBText("\(referenceLabel): \(formatValue(reference[i]))", style: BBTypography.caption, color: .bbText2, lineLimit: 1)
            }
        }
        .padding(.horizontal, BBSpacing.space2_5)
        .padding(.vertical, BBSpacing.space1_5)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbBackground))
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbAlphaBorder50, lineWidth: 1))
        .bbShadow(BBShadow.xl)
    }
}
