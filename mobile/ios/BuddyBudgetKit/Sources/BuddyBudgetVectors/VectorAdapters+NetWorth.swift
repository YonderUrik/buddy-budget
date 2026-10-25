import BuddyBudgetKit
import Foundation

extension VectorSuite {
    /// Series input: inline array, or "<vector id>.expected" pointing at another net-worth.json vector.
    fileprivate static func netWorthSeriesJSON(_ v: JSONValue) throws -> [JSONValue] {
        if case .array(let a) = v { return a }
        let ref = try str(v)
        guard ref.hasSuffix(".expected") else { throw AdapterError("series ref \(ref)") }
        let id = String(ref.dropLast(".expected".count))
        guard let target = try load("net-worth.json").first(where: { $0.id == id }), case .array(let a) = target.expected else {
            throw AdapterError("series ref \(ref)")
        }
        return a
    }

    fileprivate static func netWorthPoints(_ items: [JSONValue]) throws -> [NetWorthSeriesPoint] {
        try items.map { p in
            var byClass: [String: Double] = [:]
            if case .object(let o) = p["byClass"] { for (k, v) in o { byClass[k] = try num(v) } }
            return NetWorthSeriesPoint(date: p["date"].string ?? "", label: p["label"].string ?? "", value: try num(p["value"]),
                                       byClass: byClass, isEstimated: p["isEstimated"] == .bool(true))
        }
    }

    /// The input points with `value` replaced (`{...point, value}`).
    fileprivate static func withValues(_ items: [JSONValue], _ points: [NetWorthSeriesPoint]) -> JSONValue {
        .array(zip(items, points).map { item, point in
            guard case .object(var o) = item else { return item }
            o["value"] = .number(point.value)
            return .object(o)
        })
    }

    static let netWorthHandlers: [String: Handler] = [
        "computeNetWorthChange": { i in
            let c = NetWorthToggles.computeNetWorthChange(try netWorthPoints(try netWorthSeriesJSON(i["series"])))
            return .object(["start": .number(c.start), "end": .number(c.end), "delta": .number(c.delta),
                            "deltaPct": c.deltaPct.map(JSONValue.number) ?? .null])
        },
        "excludeClassFromSeries": { i in
            let items = try netWorthSeriesJSON(i["series"])
            return withValues(items, NetWorthToggles.excludeClassFromSeries(try netWorthPoints(items), classKey: try str(i["classKey"])))
        },
        "restrictSeriesToClasses": { i in
            let items = try netWorthSeriesJSON(i["series"])
            guard case .array(let keys) = i["classKeys"] else { throw AdapterError("classKeys") }
            return withValues(items, NetWorthToggles.restrictSeriesToClasses(try netWorthPoints(items), classKeys: try keys.map(str)))
        },
    ]
}
