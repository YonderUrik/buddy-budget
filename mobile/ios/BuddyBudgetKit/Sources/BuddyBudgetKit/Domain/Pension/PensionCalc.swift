import Foundation

/// Fiscal parameters of the Italian supplementary pension (web `PENSION_TAX_RULES`, lib/calc/pension.ts).
public enum PensionTaxRules {
    public static let validFromYear = 2026
    public static let exitBaseRate = 0.15
    public static let exitReductionAfterYears = 15
    public static let exitReductionPerYear = 0.003
    public static let exitMinRate = 0.09
    public static let exitOtherReasonsRate = 0.23
}

public enum PensionWithdrawalReason: String, Sendable, CaseIterable {
    case pensionamento, sanitarie, altri
}

public struct PensionWithdrawalScenario: Hashable, Sendable {
    public let reason: PensionWithdrawalReason
    public let rate: Double
    /// Prudent net: tax on the whole value.
    public let netLow: Double
    /// Expected net: tax on contributions only.
    public let netHigh: Double
}

public struct PensionExitTaxMilestones: Hashable, Sendable {
    public let reductionStartsOn: String
    public let minRateOn: String
}

public struct PensionProjectionRates: Hashable, Sendable {
    public var prudent: Double
    public var base: Double
    public var optimistic: Double
    public init(prudent: Double, base: Double, optimistic: Double) {
        self.prudent = prudent
        self.base = base
        self.optimistic = optimistic
    }
}

public struct PensionProjectionPoint: Hashable, Sendable {
    public let year: Int
    public let prudent: Double
    public let base: Double
    public let optimistic: Double
}

/// Client-side pension maths (exit-tax slider, projection sliders), ported 1:1 from lib/calc/pension.ts.
public enum PensionCalc {
    /// Years after which the exit rate reaches its floor (end of the timeline).
    public static let exitTaxTimelineYears = 35
    static let monthsPerYear = 12
    static let quartersPerYear = 4

    /// Pension `addMonths`: clamped month arithmetic on `YYYY-MM-DD`.
    public static func addMonths(_ key: String, _ months: Int) -> String {
        guard let d = CalendarDate(iso: key) else { return key }
        return d.addingMonthsClamped(months).iso
    }

    /// Exit tax rate (contributions since 2007) after `years` years of participation.
    public static func exitTaxRate(_ years: Double) -> Double {
        let r = PensionTaxRules.self
        let reduction = max(0, years - Double(r.exitReductionAfterYears)) * r.exitReductionPerYear
        return max(r.exitMinRate, r.exitBaseRate - reduction)
    }

    public static func exitTaxMilestones(_ adhesionDate: String) -> PensionExitTaxMilestones {
        let r = PensionTaxRules.self
        let yearsToMin = r.exitReductionAfterYears
            + Int(JSNumber.round((r.exitBaseRate - r.exitMinRate) / r.exitReductionPerYear))
        return PensionExitTaxMilestones(
            reductionStartsOn: addMonths(adhesionDate, r.exitReductionAfterYears * monthsPerYear),
            minRateOn: addMonths(adhesionDate, yearsToMin * monthsPerYear)
        )
    }

    /// Estimated net if withdrawn today in three scenarios; `yearsOverride` drives the rate-simulation slider.
    public static func withdrawalScenarios(value: Double, netContributions: Double, adhesionDate: String?, today: String,
                                           yearsOverride: Double? = nil) -> [PensionWithdrawalScenario] {
        let years = yearsOverride ?? (adhesionDate.map { Double(Periods.wholeYearsBetween($0, today)) } ?? 0)
        let reduced = exitTaxRate(years)
        let base = min(value, max(0, netContributions))
        func make(_ reason: PensionWithdrawalReason, _ rate: Double) -> PensionWithdrawalScenario {
            PensionWithdrawalScenario(reason: reason, rate: rate, netLow: value - rate * max(0, value), netHigh: value - rate * base)
        }
        return [make(.pensionamento, reduced), make(.sanitarie, reduced), make(.altri, PensionTaxRules.exitOtherReasonsRate)]
    }

    /// Projection in today's euros: start value plus a constant quarterly contribution, real returns in 3 scenarios.
    public static func projectPension(startValue: Double, quarterlyContribution: Double, years: Double,
                                      rates: PensionProjectionRates) -> [PensionProjectionPoint] {
        let total = Int(max(0, JSNumber.round(years)))
        var prudent = startValue, base = startValue, optimistic = startValue
        var points = [PensionProjectionPoint(year: 0, prudent: prudent, base: base, optimistic: optimistic)]
        if total >= 1 {
            for year in 1...total {
                for _ in 0..<quartersPerYear {
                    prudent = prudent * pow(1 + rates.prudent, 1.0 / Double(quartersPerYear)) + quarterlyContribution
                    base = base * pow(1 + rates.base, 1.0 / Double(quartersPerYear)) + quarterlyContribution
                    optimistic = optimistic * pow(1 + rates.optimistic, 1.0 / Double(quartersPerYear)) + quarterlyContribution
                }
                points.append(PensionProjectionPoint(year: year, prudent: prudent, base: base, optimistic: optimistic))
            }
        }
        return points
    }
}
