import Foundation

/// Geometry of the hand-drawn `TrendChart` (charts.md §3: Liquidità hero and Analisi curve). Same on Android.
public enum TrendGeometry {
    public struct Layout: Equatable, Sendable {
        public let line: [ChartPoint]
        public let reference: [ChartPoint]
        public let columns: Int
    }

    /// x evenly spaced over `max(points, reference) − 1` columns; y padded 12 % top and bottom:
    /// `toY(v) = h×0.88 − (v−low)/span × h×0.76`, with low/high over both series and `span = 1` when flat.
    public static func layout(values: [Double], reference: [Double]?, width: Double, height: Double) -> Layout {
        let ref = reference ?? []
        let all = values + ref
        let low = all.min() ?? 0
        let high = all.max() ?? 0
        let span = high - low == 0 ? 1 : high - low
        let columns = max(values.count, ref.count)
        let step = columns > 1 ? width / Double(columns - 1) : 0
        func y(_ v: Double) -> Double { height * 0.88 - (v - low) / span * height * 0.76 }
        return Layout(line: values.enumerated().map { ChartPoint(x: Double($0.offset) * step, y: y($0.element)) },
                      reference: ref.enumerated().map { ChartPoint(x: Double($0.offset) * step, y: y($0.element)) },
                      columns: columns)
    }

    /// Nearest column for a touch at `x` (0…width).
    public static func index(x: Double, width: Double, columns: Int) -> Int {
        guard columns > 1, width > 0 else { return 0 }
        return min(columns - 1, max(0, Int((x / width * Double(columns - 1)).rounded())))
    }
}
