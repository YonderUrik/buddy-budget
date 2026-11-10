import Foundation

// Port of lib/calc/fire.ts, lib/calc/growth-split.ts and lib/calc/liquidation.ts (domain/fire-and-simulations.md).
// All values are real (today's euros). Same names and operation order as the web.

/// Growth with constant yearly savings, in real terms (`GrowthInput`).
public struct FireGrowthInput: Hashable, Sendable {
    public var current: Double
    public var annualSaving: Double
    public var realReturn: Double
    public init(current: Double, annualSaving: Double, realReturn: Double) {
        self.current = current
        self.annualSaving = annualSaving
        self.realReturn = realReturn
    }
}

/// One cell of a sensitivity table (`SensitivityCell`).
public struct FireSensitivityCell: Hashable, Sendable {
    public let rowValue: Double
    public let columnValue: Double
    public let years: Double?
}

/// `GrowthSplitPoint`: month-end net worth and the month's savings (income − expenses).
public struct FireGrowthSplitPoint: Hashable, Sendable {
    public let month: String
    public let netWorth: Double
    public let savings: Double
    public init(month: String, netWorth: Double, savings: Double) {
        self.month = month
        self.netWorth = netWorth
        self.savings = savings
    }
}

public struct FireGrowthSplitRow: Hashable, Sendable {
    public let month: String
    public let netWorth: Double
    public let savings: Double
    public let delta: Double
    public let fromSavings: Double
    public let fromMarket: Double
}

public struct FireGrowthSplit: Hashable, Sendable {
    public let rows: [FireGrowthSplitRow]
    public let totalDelta: Double
    public let totalFromSavings: Double
    public let totalFromMarket: Double
    /// nil when total growth is zero or negative.
    public let savingsShare: Double?
}

/// `LiquidationPosition`.
public struct FireLiquidationPosition: Hashable, Sendable {
    public let id: String
    public let name: String
    public let value: Double
    public let unrealizedGain: Double
    /// Effective rate (0.26 or 0.125).
    public let taxRate: Double
    public init(id: String, name: String, value: Double, unrealizedGain: Double, taxRate: Double) {
        self.id = id
        self.name = name
        self.value = value
        self.unrealizedGain = unrealizedGain
        self.taxRate = taxRate
    }
}

public struct FireLiquidationTax: Hashable, Sendable {
    public let id: String
    public let name: String
    public let tax: Double
}

/// `LiquidationResult`.
public struct FireLiquidationResult: Hashable, Sendable {
    public let latentTax: Double
    public let grossValue: Double
    public let netValue: Double
    public let taxRatio: Double?
    public let byPosition: [FireLiquidationTax]
}

public enum FireCalc {
    /// `MAX_PLANNING_YEARS`: beyond this the result is "never".
    public static let maxPlanningYears: Double = 80

    /// Capital needed so that withdrawing `withdrawalRate` per year covers the yearly spending.
    public static func fireNumber(annualSpending: Double, withdrawalRate: Double) -> Double? {
        if !(annualSpending >= 0) || !(withdrawalRate > 0) { return nil }
        return annualSpending / withdrawalRate
    }

    /// FIRE number grossed up for the tax share of every withdrawn euro.
    public static func fireNumberAfterTax(grossNumber: Double, taxShare: Double) -> Double? {
        if !(taxShare >= 0) || taxShare >= 1 { return nil }
        return grossNumber / (1 - taxShare)
    }

    /// Wealth after `years` years, savings paid at year end.
    public static func wealthAfterYears(_ input: FireGrowthInput, years: Double) -> Double {
        if years <= 0 { return input.current }
        if abs(input.realReturn) < 1e-12 { return input.current + input.annualSaving * years }
        let growth = pow(1 + input.realReturn, years)
        return input.current * growth + (input.annualSaving * (growth - 1)) / input.realReturn
    }

    /// Years (fractional) to reach `target`; 0 if already there, nil if never or beyond `maxPlanningYears`.
    public static func yearsToTarget(_ input: FireGrowthInput, target: Double) -> Double? {
        let current = input.current, annualSaving = input.annualSaving, realReturn = input.realReturn
        if current >= target { return 0 }
        let years: Double
        if abs(realReturn) < 1e-12 {
            if annualSaving <= 0 { return nil }
            years = (target - current) / annualSaving
        } else {
            let top = target * realReturn + annualSaving
            let bottom = current * realReturn + annualSaving
            if !(top > 0) || !(bottom > 0) { return nil }
            years = log(top / bottom) / log(1 + realReturn)
        }
        if !years.isFinite || years < 0 || years > maxPlanningYears { return nil }
        return years
    }

    /// Wealth that today reaches `target` in `years` years with the real return only.
    public static func coastNumber(target: Double, realReturn: Double, years: Double) -> Double {
        if years <= 0 { return target }
        return target / pow(1 + realReturn, years)
    }

    /// Lean spending: required (Dovute) + occasional (Saltuarie).
    public static func leanSpending(dovuta: Double, saltuaria: Double) -> Double { dovuta + saltuaria }

    /// Years to FIRE by withdrawal rate (rows) × real return (columns).
    public static func sensitivityByRateAndReturn(
        annualSpending: Double, current: Double, annualSaving: Double, withdrawalRates: [Double], realReturns: [Double]
    ) -> [[FireSensitivityCell]] {
        withdrawalRates.map { rate in
            realReturns.map { realReturn in
                let target = fireNumber(annualSpending: annualSpending, withdrawalRate: rate)
                return FireSensitivityCell(
                    rowValue: rate, columnValue: realReturn,
                    years: target.flatMap {
                        yearsToTarget(FireGrowthInput(current: current, annualSaving: annualSaving, realReturn: realReturn), target: $0)
                    }
                )
            }
        }
    }

    /// Years to FIRE by relative spending change (rows) × relative saving change (columns).
    public static func sensitivityBySpendingAndSaving(
        annualSpending: Double, withdrawalRate: Double, realReturn: Double, current: Double, annualSaving: Double,
        spendingChanges: [Double], savingChanges: [Double]
    ) -> [[FireSensitivityCell]] {
        spendingChanges.map { spendingChange in
            savingChanges.map { savingChange in
                let spending = annualSpending * (1 + spendingChange)
                let target = fireNumber(annualSpending: spending, withdrawalRate: withdrawalRate)
                let saving = annualSaving * (1 + savingChange) - (spending - annualSpending)
                return FireSensitivityCell(
                    rowValue: spendingChange, columnValue: savingChange,
                    years: target.flatMap {
                        yearsToTarget(FireGrowthInput(current: current, annualSaving: saving, realReturn: realReturn), target: $0)
                    }
                )
            }
        }
    }

    /// Share of income not spent; nil without income.
    public static func savingsRate(income: Double, expenses: Double) -> Double? {
        income > 0 ? (income - expenses) / income : nil
    }

    /// Months of spending covered by `amount`; nil when monthly spending is zero.
    public static func monthsOfCoverage(amount: Double, monthlySpending: Double) -> Double? {
        monthlySpending > 0 ? amount / monthlySpending : nil
    }

    /// Splits each month's net-worth change into savings and market/other. The first point is the start.
    public static func splitGrowth(_ points: [FireGrowthSplitPoint]) -> FireGrowthSplit {
        var rows: [FireGrowthSplitRow] = []
        if points.count > 1 {
            for i in 1..<points.count {
                let delta = points[i].netWorth - points[i - 1].netWorth
                rows.append(FireGrowthSplitRow(
                    month: points[i].month, netWorth: points[i].netWorth, savings: points[i].savings,
                    delta: delta, fromSavings: points[i].savings, fromMarket: delta - points[i].savings
                ))
            }
        }
        let totalDelta = rows.reduce(0.0) { $0 + $1.delta }
        let totalFromSavings = rows.reduce(0.0) { $0 + $1.fromSavings }
        return FireGrowthSplit(
            rows: rows, totalDelta: totalDelta, totalFromSavings: totalFromSavings,
            totalFromMarket: totalDelta - totalFromSavings,
            savingsShare: totalDelta > 0 ? totalFromSavings / totalDelta : nil
        )
    }

    /// Latent tax if everything were sold today (gains only), sorted by tax descending (stable).
    public static func computeLiquidation(_ positions: [FireLiquidationPosition]) -> FireLiquidationResult {
        let byPosition = positions
            .map { FireLiquidationTax(id: $0.id, name: $0.name, tax: max(0, $0.unrealizedGain) * $0.taxRate) }
            .filter { $0.tax > 0 }
            .enumerated()
            .sorted { $0.element.tax != $1.element.tax ? $0.element.tax > $1.element.tax : $0.offset < $1.offset }
            .map(\.element)
        let latentTax = byPosition.reduce(0.0) { $0 + $1.tax }
        let grossValue = positions.reduce(0.0) { $0 + $1.value }
        return FireLiquidationResult(
            latentTax: latentTax, grossValue: grossValue, netValue: grossValue - latentTax,
            taxRatio: grossValue > 0 ? latentTax / grossValue : nil, byPosition: byPosition
        )
    }
}
