import Foundation

// Port of lib/calc/costs.ts (domain/costs.md): recurring portfolio costs (user-entered TER + stamp duty) and their drag.

/// `CostPosition`.
public struct CostPosition: Hashable, Sendable {
    public let id: String
    public let name: String
    public let value: Double
    /// Yearly TER as a fraction (0.002 = 0.20%), nil when not entered.
    public let ter: Double?
    public let subjectToBollo: Bool
    public init(id: String, name: String, value: Double, ter: Double?, subjectToBollo: Bool) {
        self.id = id
        self.name = name
        self.value = value
        self.ter = ter
        self.subjectToBollo = subjectToBollo
    }
}

/// `CostRow`.
public struct CostRow: Hashable, Sendable {
    public let id: String
    public let name: String
    public let value: Double
    public let terCost: Double
    public let bolloCost: Double
    public let total: Double
    public let pct: Double
}

/// `CostSummary`.
public struct CostSummary: Hashable, Sendable {
    public let rows: [CostRow]
    public let totalValue: Double
    public let annualCost: Double
    public let annualPct: Double?
    public let missingTerValue: Double
}

/// `CostDragPoint`.
public struct CostDragPoint: Hashable, Sendable {
    public let year: Int
    public let withoutCosts: Double
    public let withCosts: Double
    public let lost: Double
}

public enum CostsError: Error, Equatable {
    case unsupportedCountry(String)
}

public enum CostsCalc {
    /// `financialCountry(country).investmentCosts.annualStampDutyRate` (IT 0.2%, DE 0).
    public static func annualStampDutyRate(_ productCountry: String) -> Double? {
        switch productCountry {
        case "IT": return 0.002
        case "DE": return 0
        default: return nil
        }
    }

    /// Yearly cost per position (TER × value + stamp duty) and total, rows by total descending (stable).
    public static func summarizeCosts(_ positions: [CostPosition], productCountry: String) throws -> CostSummary {
        guard let stampDuty = annualStampDutyRate(productCountry) else { throw CostsError.unsupportedCountry(productCountry) }
        let rows = positions
            .filter { $0.value > 0 }
            .map { p -> CostRow in
                let terCost = p.value * (p.ter ?? 0)
                let bolloCost = p.subjectToBollo ? p.value * stampDuty : 0
                let total = terCost + bolloCost
                return CostRow(id: p.id, name: p.name, value: p.value, terCost: terCost, bolloCost: bolloCost, total: total, pct: total / p.value)
            }
            .enumerated()
            .sorted { $0.element.total != $1.element.total ? $0.element.total > $1.element.total : $0.offset < $1.offset }
            .map(\.element)
        let totalValue = rows.reduce(0.0) { $0 + $1.value }
        let annualCost = rows.reduce(0.0) { $0 + $1.total }
        return CostSummary(
            rows: rows, totalValue: totalValue, annualCost: annualCost,
            annualPct: totalValue > 0 ? annualCost / totalValue : nil,
            missingTerValue: positions.filter { $0.value > 0 && $0.ter == nil }.reduce(0.0) { $0 + $1.value }
        )
    }

    /// How much costs erode wealth over `years` years (no contributions): same gross return with and without the cost.
    public static func costDrag(value: Double, grossReturn: Double, annualCostPct: Double, years: Int) -> [CostDragPoint] {
        guard years >= 0 else { return [] }
        return (0...years).map { year in
            let withoutCosts = value * pow(1 + grossReturn, Double(year))
            let withCosts = value * pow(1 + grossReturn - annualCostPct, Double(year))
            return CostDragPoint(year: year, withoutCosts: withoutCosts, withCosts: withCosts, lost: withoutCosts - withCosts)
        }
    }
}
