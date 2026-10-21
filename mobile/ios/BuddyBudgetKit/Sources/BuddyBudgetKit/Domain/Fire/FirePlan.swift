import Foundation

// Port of lib/analitiche/{assumptions (constants), plan, scenario, simulation, historical-return (resolveExpectedReturn)}.ts.
// The assumptions are stored and merged by the server (GET/PATCH /api/analytics/assumptions); the base comes from
// GET /api/analytics/base. Mobile re-runs the plan on every slider move.

/// `AnalyticsAssumptions`. Ratios are fractions (0.04 = 4%); nil amounts = derive from the user's data.
public struct FireAssumptions: Hashable, Sendable {
    public var withdrawalRate: Double
    public var dataPeriod: DataPeriod
    public var annualSpending: Double?
    public var annualSavings: Double?
    public var expectedReturn: Double
    public var expectedReturnAuto: Bool
    public var volatility: Double
    public var inflation: Double
    public var retirementYears: Double
    public var rule: WithdrawalRule
    public var includePensionFunds: Bool
    public var includeLatentTax: Bool
    public var publicPension: MonteCarloPublicPension?
    public var terByInstrument: [String: Double]

    public init(
        withdrawalRate: Double, dataPeriod: DataPeriod, annualSpending: Double?, annualSavings: Double?, expectedReturn: Double,
        expectedReturnAuto: Bool, volatility: Double, inflation: Double, retirementYears: Double, rule: WithdrawalRule,
        includePensionFunds: Bool, includeLatentTax: Bool, publicPension: MonteCarloPublicPension?, terByInstrument: [String: Double]
    ) {
        self.withdrawalRate = withdrawalRate
        self.dataPeriod = dataPeriod
        self.annualSpending = annualSpending
        self.annualSavings = annualSavings
        self.expectedReturn = expectedReturn
        self.expectedReturnAuto = expectedReturnAuto
        self.volatility = volatility
        self.inflation = inflation
        self.retirementYears = retirementYears
        self.rule = rule
        self.includePensionFunds = includePensionFunds
        self.includeLatentTax = includeLatentTax
        self.publicPension = publicPension
        self.terByInstrument = terByInstrument
    }

    /// `DEFAULT_ASSUMPTIONS`.
    public static let defaults = FireAssumptions(
        withdrawalRate: 0.035, dataPeriod: .ultimi(months: 12), annualSpending: nil, annualSavings: nil, expectedReturn: 0.04,
        expectedReturnAuto: true, volatility: 0.12, inflation: 0.02, retirementYears: 40, rule: .fissa,
        includePensionFunds: false, includeLatentTax: true, publicPension: nil, terByInstrument: [:]
    )
}

/// `ASSUMPTION_LIMITS` (min/max of each assumption).
public enum FireAssumptionLimits {
    public static let withdrawalRate = (min: 0.01, max: 0.1)
    public static let expectedReturn = (min: -0.02, max: 0.5)
    public static let volatility = (min: 0.0, max: 0.6)
    public static let inflation = (min: -0.02, max: 0.15)
    public static let retirementYears = (min: 5.0, max: 70.0)
    public static let amount = (min: 0.0, max: 1e8)
    public static let ter = (min: 0.0, max: 0.05)
}

/// The part of `AnalyticsBase` (GET /api/analytics/base) that `resolvePlan` reads.
public struct FirePlanBase: Hashable, Sendable {
    public struct Wealth: Hashable, Sendable {
        public var liquidity: Double, investments: Double, pension: Double, debts: Double
        public init(liquidity: Double, investments: Double, pension: Double, debts: Double) {
            self.liquidity = liquidity
            self.investments = investments
            self.pension = pension
            self.debts = debts
        }
    }

    public struct Cashflow: Hashable, Sendable {
        public var annualSpending: Double, annualSavings: Double, monthsWithData: Int
        public init(annualSpending: Double, annualSavings: Double, monthsWithData: Int) {
            self.annualSpending = annualSpending
            self.annualSavings = annualSavings
            self.monthsWithData = monthsWithData
        }
    }

    public var wealth: Wealth
    public var cashflow: Cashflow
    public var positions: [FireLiquidationPosition]
    public init(wealth: Wealth, cashflow: Cashflow, positions: [FireLiquidationPosition]) {
        self.wealth = wealth
        self.cashflow = cashflow
        self.positions = positions
    }
}

/// Where a figure comes from (`FigureSource`).
public enum FireFigureSource: String, Sendable {
    case ipotesi, dati, manca
}

public struct FireCoastPoint: Hashable, Sendable {
    public let years: Double
    public let number: Double
}

/// `AnalyticsPlan`.
public struct FirePlan: Hashable, Sendable {
    public let spending: Double?
    public let spendingSource: FireFigureSource
    public let savings: Double?
    public let savingsSource: FireFigureSource
    public let wealth: Double
    public let liquidation: FireLiquidationResult
    public let taxShare: Double
    public let fireNumberGross: Double?
    public let target: Double?
    public let progress: Double?
    public let yearsToFire: Double?
    public let coast: [FireCoastPoint]
}

/// The four assumptions moved by the "e se…" sliders (`ScenarioField`).
public enum FireScenarioField: String, CaseIterable, Sendable {
    case annualSavings, annualSpending, expectedReturn, withdrawalRate
}

/// Slider values being tried (`ScenarioOverrides`); nil = untouched.
public struct FireScenarioOverrides: Hashable, Sendable {
    public var annualSavings: Double?
    public var annualSpending: Double?
    public var expectedReturn: Double?
    public var withdrawalRate: Double?
    public init(annualSavings: Double? = nil, annualSpending: Double? = nil, expectedReturn: Double? = nil, withdrawalRate: Double? = nil) {
        self.annualSavings = annualSavings
        self.annualSpending = annualSpending
        self.expectedReturn = expectedReturn
        self.withdrawalRate = withdrawalRate
    }
}

/// Slider bounds and step (`SliderSpec`).
public struct FireSliderSpec: Hashable, Sendable {
    public let min: Double
    public let max: Double
    public let step: Double
}

/// When retirement starts in the simulation (`RetireAt`).
public enum FireRetireAt: String, Sendable {
    case oggi, fire
}

/// `HistoricalReturn` / `HistoricalReturnResult` (computed by the server, input of `resolveExpectedReturn`).
public enum FireHistoricalReturnResult: Hashable, Sendable {
    case ok(months: Int, shorterThanPeriod: Bool, fromKey: String, toKey: String, nominal: Double, real: Double?)
    /// `reason`: nessun-investimento | storico-breve | periodo-breve | patrimonio-basso | prezzi-mancanti.
    case manca(reason: String)
}

/// `ReturnSource`.
public enum FireReturnSource: String, Sendable {
    case storico, prudente, manuale
}

/// `ExpectedReturnInfo`.
public struct FireExpectedReturnInfo: Hashable, Sendable {
    public let value: Double
    public let source: FireReturnSource
    public let history: FireHistoricalReturnResult
    public let historyReal: Double?
    public let clamped: Bool
    public let high: Bool
}

public enum FirePlanning {
    /// `COAST_HORIZONS`.
    public static let coastHorizons: [Double] = [10, 15, 20, 25, 30]
    /// `MIN_MONTHS_FOR_CASHFLOW`.
    public static let minMonthsForCashflow = 3
    /// `HIGH_RETURN_WARNING`.
    public static let highReturnWarning = 0.08
    private static let maxAccumulationYears = 40.0
    private static let moneyStep = 100.0
    private static let moneyMinCeiling = 12_000.0
    private static let percentStep = 0.001
    private static let withdrawalRange = (min: 0.02, max: 0.06)

    /// Yearly spending and savings from the period's movements; nil when too few months have data.
    public static func cashflowFromData(_ base: FirePlanBase) -> (spending: Double?, savings: Double?) {
        let enough = base.cashflow.monthsWithData >= minMonthsForCashflow
        return (
            enough && base.cashflow.annualSpending > 0 ? base.cashflow.annualSpending : nil,
            enough ? base.cashflow.annualSavings : nil
        )
    }

    /// Applies the assumptions to the data.
    public static func resolvePlan(_ base: FirePlanBase, _ a: FireAssumptions) -> FirePlan {
        let (dataSpending, dataSavings) = cashflowFromData(base)
        let spending = a.annualSpending ?? dataSpending
        let savings = a.annualSavings ?? dataSavings

        let wealth = base.wealth.liquidity + base.wealth.investments + (a.includePensionFunds ? base.wealth.pension : 0)
        let liquidation = FireCalc.computeLiquidation(base.positions)
        let taxShare = a.includeLatentTax && wealth > 0 ? min(liquidation.latentTax / wealth, 0.99) : 0

        let gross = spending.flatMap { FireCalc.fireNumber(annualSpending: $0, withdrawalRate: a.withdrawalRate) }
        let target = gross.flatMap { FireCalc.fireNumberAfterTax(grossNumber: $0, taxShare: taxShare) }
        let growth = FireGrowthInput(current: wealth, annualSaving: savings ?? 0, realReturn: a.expectedReturn)
        return FirePlan(
            spending: spending,
            spendingSource: a.annualSpending != nil ? .ipotesi : dataSpending != nil ? .dati : .manca,
            savings: savings,
            savingsSource: a.annualSavings != nil ? .ipotesi : dataSavings != nil ? .dati : .manca,
            wealth: wealth,
            liquidation: liquidation,
            taxShare: taxShare,
            fireNumberGross: gross,
            target: target,
            progress: target.flatMap { $0 > 0 ? wealth / $0 : nil },
            yearsToFire: target.flatMap { FireCalc.yearsToTarget(growth, target: $0) },
            coast: target.map { t in
                coastHorizons.map { FireCoastPoint(years: $0, number: FireCalc.coastNumber(target: t, realReturn: a.expectedReturn, years: $0)) }
            } ?? []
        )
    }

    private static func roundUp(_ v: Double, _ to: Double) -> Double { (v / to).rounded(.up) * to }
    private static func roundDown(_ v: Double, _ to: Double) -> Double { (v / to).rounded(.down) * to }

    /// Slider of an assumption given its starting value; nil when the figure is missing.
    public static func scenarioSlider(_ field: FireScenarioField, baseline: Double?) -> FireSliderSpec? {
        switch field {
        case .expectedReturn:
            return FireSliderSpec(min: FireAssumptionLimits.expectedReturn.min, max: FireAssumptionLimits.expectedReturn.max, step: percentStep)
        case .withdrawalRate:
            return FireSliderSpec(min: withdrawalRange.min, max: withdrawalRange.max, step: percentStep)
        case .annualSpending:
            guard let baseline else { return nil }
            return FireSliderSpec(min: 0, max: roundUp(max(baseline * 2, moneyMinCeiling), moneyStep * 5), step: moneyStep)
        case .annualSavings:
            guard let baseline else { return nil }
            return FireSliderSpec(
                min: baseline < 0 ? roundDown(baseline * 2, moneyStep * 5) : 0,
                max: roundUp(max(abs(baseline) * 2, moneyMinCeiling), moneyStep * 5),
                step: moneyStep
            )
        }
    }

    /// Assumptions with the slider values on top.
    public static func applyScenario(_ assumptions: FireAssumptions, _ overrides: FireScenarioOverrides) -> FireAssumptions {
        var a = assumptions
        if let v = overrides.annualSavings { a.annualSavings = v }
        if let v = overrides.annualSpending { a.annualSpending = v }
        if let v = overrides.expectedReturn { a.expectedReturn = v }
        if let v = overrides.withdrawalRate { a.withdrawalRate = v }
        return a
    }

    /// True when at least one slider moved.
    public static func hasScenario(_ overrides: FireScenarioOverrides) -> Bool {
        overrides.annualSavings != nil || overrides.annualSpending != nil || overrides.expectedReturn != nil || overrides.withdrawalRate != nil
    }

    /// Years to FIRE with some assumptions changed, wealth and latent tax share unchanged.
    public static func yearsToFireWith(_ plan: FirePlan, _ assumptions: FireAssumptions, _ overrides: FireScenarioOverrides) -> Double? {
        guard let spending = overrides.annualSpending ?? plan.spending else { return nil }
        let gross = FireCalc.fireNumber(annualSpending: spending, withdrawalRate: overrides.withdrawalRate ?? assumptions.withdrawalRate)
        guard let target = gross.flatMap({ FireCalc.fireNumberAfterTax(grossNumber: $0, taxShare: plan.taxShare) }) else { return nil }
        return FireCalc.yearsToTarget(
            FireGrowthInput(current: plan.wealth, annualSaving: overrides.annualSavings ?? plan.savings ?? 0,
                            realReturn: overrides.expectedReturn ?? assumptions.expectedReturn),
            target: target
        )
    }

    /// Simulation input from the assumptions and the plan; nil when spending is missing.
    public static func buildSimulationInput(
        _ plan: FirePlan, _ a: FireAssumptions, retireAt: FireRetireAt, rule: WithdrawalRule? = nil
    ) -> MonteCarloInput? {
        guard let spending = plan.spending, spending > 0 else { return nil }
        let accumulationYears = retireAt == .fire && plan.yearsToFire != nil
            ? min(plan.yearsToFire!.rounded(.up), maxAccumulationYears) : 0
        return MonteCarloInput(
            startingWealth: max(0, plan.wealth), annualSavings: max(0, plan.savings ?? 0), accumulationYears: accumulationYears,
            retirementYears: a.retirementYears, annualSpending: spending, expectedReturn: a.expectedReturn,
            volatility: a.volatility, inflation: a.inflation, rule: rule ?? a.rule, publicPension: a.publicPension
        )
    }

    /// Real yearly return of the history: observed inflation if any, otherwise the assumed one.
    public static func historyRealReturn(nominal: Double, real: Double?, assumedInflation: Double) -> Double {
        real ?? ((1 + nominal) / (1 + assumedInflation) - 1)
    }

    /// Return to use: the user's, or (auto) the clamped real return of the history, else the prudent default.
    public static func resolveExpectedReturn(_ a: FireAssumptions, _ history: FireHistoricalReturnResult) -> FireExpectedReturnInfo {
        let lim = FireAssumptionLimits.expectedReturn
        var historyReal: Double?
        if case let .ok(_, _, _, _, nominal, real) = history {
            historyReal = historyRealReturn(nominal: nominal, real: real, assumedInflation: a.inflation)
        }
        let fromHistory = historyReal.map { min(max($0, lim.min), lim.max) }
        let value: Double, source: FireReturnSource
        var clamped = false
        if !a.expectedReturnAuto {
            value = a.expectedReturn
            source = .manuale
        } else if let fromHistory {
            value = JSNumber.round(fromHistory * 1000) / 1000
            source = .storico
            clamped = fromHistory != historyReal
        } else {
            value = FireAssumptions.defaults.expectedReturn
            source = .prudente
        }
        return FireExpectedReturnInfo(value: value, source: source, history: history, historyReal: historyReal, clamped: clamped,
                                      high: value > highReturnWarning)
    }

    /// Assumptions with the return actually used.
    public static func withExpectedReturn(_ a: FireAssumptions, _ info: FireExpectedReturnInfo) -> FireAssumptions {
        if info.value == a.expectedReturn { return a }
        var copy = a
        copy.expectedReturn = info.value
        return copy
    }
}
