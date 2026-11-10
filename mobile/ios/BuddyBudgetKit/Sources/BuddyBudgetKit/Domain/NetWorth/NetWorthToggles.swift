import Foundation

/// One point of the net-worth chart series (served by `GET /api/overview`).
public struct NetWorthSeriesPoint: Hashable, Sendable {
    public var date: String
    public var label: String
    public var value: Double
    public var byClass: [String: Double]
    public var isEstimated: Bool
    public init(date: String = "", label: String = "", value: Double, byClass: [String: Double], isEstimated: Bool = false) {
        self.date = date
        self.label = label
        self.value = value
        self.byClass = byClass
        self.isEstimated = isEstimated
    }
}

/// Change between the first and the last point; `deltaPct` is a ratio (0.5 = +50%).
public struct NetWorthChange: Hashable, Sendable {
    public let start: Double
    public let end: Double
    public let delta: Double
    public let deltaPct: Double?
}

/// Net-worth class toggles (`lib/calc/net-worth.ts`): plain sums over the served series.
public enum NetWorthToggles {
    /// Total minus one class (`byClass` untouched).
    public static func excludeClassFromSeries(_ series: [NetWorthSeriesPoint], classKey: String) -> [NetWorthSeriesPoint] {
        series.map { point in
            var p = point
            p.value = point.value - (point.byClass[classKey] ?? 0)
            return p
        }
    }

    /// Total recomputed over the given classes only (in `classKeys` order); `byClass` untouched.
    public static func restrictSeriesToClasses(_ series: [NetWorthSeriesPoint], classKeys: [String]) -> [NetWorthSeriesPoint] {
        series.map { point in
            var p = point
            p.value = classKeys.reduce(0.0) { $0 + (point.byClass[$1] ?? 0) }
            return p
        }
    }

    public static func computeNetWorthChange(_ series: [NetWorthSeriesPoint]) -> NetWorthChange {
        guard let first = series.first, let last = series.last else {
            return NetWorthChange(start: 0, end: 0, delta: 0, deltaPct: nil)
        }
        let delta = last.value - first.value
        let deltaPct: Double? = series.count >= 2 && first.value != 0 ? delta / abs(first.value) : nil
        return NetWorthChange(start: first.value, end: last.value, delta: delta, deltaPct: deltaPct)
    }
}
