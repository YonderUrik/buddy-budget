import Foundation

/// Target weight of one instrument (`TargetInput`).
public struct AllocationTarget: Hashable, Sendable {
    public var instrumentId: String
    public var weight: Double
    public init(instrumentId: String, weight: Double) {
        self.instrumentId = instrumentId
        self.weight = weight
    }
}

public struct AllocationPosition: Hashable, Sendable {
    public var instrumentId: String
    /// nil = no price.
    public var value: Double?
    public init(instrumentId: String, value: Double?) {
        self.instrumentId = instrumentId
        self.value = value
    }
}

public enum AllocationStatus: String, Sendable {
    case inLinea = "in_linea", sotto, sopra
}

public struct AllocationRow: Hashable, Sendable {
    public let instrumentId: String
    public let value: Double
    public let currentWeight: Double
    public let targetWeight: Double
    /// current − target (positive = above target).
    public let drift: Double
    public let status: AllocationStatus
    /// false for held instruments without a target.
    public let inTarget: Bool
}

public struct AllocationAnalysis: Hashable, Sendable {
    /// Most under target first.
    public let rows: [AllocationRow]
    public let total: Double
    public let unpricedIds: [String]
    public let maxDrift: Double
    public init(rows: [AllocationRow], total: Double, unpricedIds: [String], maxDrift: Double) {
        self.rows = rows
        self.total = total
        self.unpricedIds = unpricedIds
        self.maxDrift = maxDrift
    }
}

/// Suggested buy for the next contribution.
public struct AllocationSuggestion: Hashable, Sendable {
    public let instrumentId: String
    public let amount: Double
    /// Weight after the buy (over total + contribution).
    public let weightAfter: Double
    public let targetWeight: Double
}

/// Target-allocation editor helpers (`lib/investments/allocation.ts`).
public enum AllocationTargets {
    public static let allocationTolerance = 0.05
    public static let minSuggestionShare = 0.1
    public static let targetSumTolerance = 0.0001

    static func statusFor(_ drift: Double) -> AllocationStatus {
        if abs(drift) <= allocationTolerance { return .inLinea }
        return drift < 0 ? .sotto : .sopra
    }

    /// Current weights (priced positions) against the target. The app normally gets this from
    /// `GET /api/investments/view`; ported because `suggestContribution` runs on it while editing.
    public static func analyzeAllocation(positions: [AllocationPosition], targets: [AllocationTarget]) -> AllocationAnalysis {
        var unpriced: [String] = []
        for p in positions where p.value == nil && !unpriced.contains(p.instrumentId) { unpriced.append(p.instrumentId) }
        var valueKeys: [String] = []
        var values: [String: Double] = [:]
        for p in positions {
            guard let v = p.value, v > 0 else { continue }
            if values[p.instrumentId] == nil { valueKeys.append(p.instrumentId) }
            values[p.instrumentId] = (values[p.instrumentId] ?? 0) + v
        }
        let total = valueKeys.reduce(0.0) { $0 + values[$1]! }
        var targetById: [String: Double] = [:]
        for t in targets { targetById[t.instrumentId] = t.weight }
        var ids: [String] = []
        for id in targets.map(\.instrumentId) + valueKeys where !ids.contains(id) { ids.append(id) }
        ids = ids.filter { !unpriced.contains($0) }
        let rows = ids.map { id -> AllocationRow in
            let value = values[id] ?? 0
            let currentWeight = total > 0 ? value / total : 0
            let targetWeight = targetById[id] ?? 0
            let drift = currentWeight - targetWeight
            return AllocationRow(instrumentId: id, value: value, currentWeight: currentWeight, targetWeight: targetWeight,
                                 drift: drift, status: statusFor(drift), inTarget: targetById[id] != nil)
        }
        let sorted = stableSorted(rows) { $0.drift - $1.drift }
        return AllocationAnalysis(rows: sorted, total: total, unpricedIds: unpriced,
                                  maxDrift: sorted.reduce(0.0) { jsMax($0, abs($1.drift)) })
    }

    struct Candidate { let instrumentId: String; let value: Double; let weight: Double }

    /// Water filling: level λ with Σ max(0, wᵢ·λ − vᵢ) = amount. Returns buys > 0 in fill order.
    static func waterFill(_ candidates: [Candidate], amount: Double) -> [(String, Double)] {
        let sorted = stableSorted(candidates) { $0.value / $0.weight - $1.value / $1.weight }
        var valueSum = 0.0, weightSum = 0.0, level = 0.0
        var count = 0
        for k in sorted.indices {
            valueSum += sorted[k].value
            weightSum += sorted[k].weight
            level = (amount + valueSum) / weightSum
            count = k + 1
            if k + 1 >= sorted.count || level <= sorted[k + 1].value / sorted[k + 1].weight { break }
        }
        var result: [(String, Double)] = []
        for c in sorted.prefix(count) {
            let buy = c.weight * level - c.value
            if buy > 0 { result.append((c.instrumentId, buy)) }
        }
        return result
    }

    /// Where to put the next contribution to approach the target without selling. Buys under
    /// `minSuggestionShare` of the amount are dropped and the amount redistributed.
    public static func suggestContribution(_ analysis: AllocationAnalysis, amount: Double) -> [AllocationSuggestion] {
        guard amount > 0 else { return [] }
        var candidates = analysis.rows.filter { $0.targetWeight > 0 }
            .map { Candidate(instrumentId: $0.instrumentId, value: $0.value, weight: $0.targetWeight) }
        var buys: [(String, Double)] = []
        while !candidates.isEmpty {
            buys = waterFill(candidates, amount: amount)
            guard let smallest = stableSorted(buys, { $0.1 - $1.1 }).first,
                  buys.count > 1, smallest.1 < amount * minSuggestionShare else { break }
            let bought = Set(buys.map(\.0))
            candidates = candidates.filter { $0.instrumentId != smallest.0 && bought.contains($0.instrumentId) }
        }
        var rowById: [String: AllocationRow] = [:]
        for r in analysis.rows { rowById[r.instrumentId] = r }
        let newTotal = analysis.total + amount
        let suggestions = buys.map { id, buy in
            AllocationSuggestion(instrumentId: id, amount: buy,
                                 weightAfter: newTotal > 0 ? ((rowById[id]?.value ?? 0) + buy) / newTotal : 0,
                                 targetWeight: rowById[id]?.targetWeight ?? 0)
        }
        return stableSorted(suggestions) { $1.amount - $0.amount }
    }

    /// Target weights summing to 100% (within tolerance)?
    public static func isCompleteTarget(_ targets: [AllocationTarget]) -> Bool {
        let sum = targets.reduce(0.0) { $0 + $1.weight }
        return !targets.isEmpty && abs(sum - 1) <= targetSumTolerance
    }

    static func jsMax(_ a: Double, _ b: Double) -> Double { a.isNaN || b.isNaN ? .nan : Swift.max(a, b) }

    /// JS `Array.prototype.sort` with a numeric comparator: stable.
    static func stableSorted<T>(_ items: [T], _ compare: (T, T) -> Double) -> [T] {
        items.enumerated().sorted { l, r in
            let c = compare(l.element, r.element)
            return c < 0 || (!(c > 0) && l.offset < r.offset)
        }.map(\.element)
    }
}
