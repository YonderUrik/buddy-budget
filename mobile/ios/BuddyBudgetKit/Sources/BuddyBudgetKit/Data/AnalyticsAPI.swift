import Foundation

// Analitiche (11-analytics): `GET /api/analytics/base` (one call with the saved assumptions, the data base and the
// plan), `PUT /api/analytics/assumptions` (partial update) and `POST /api/analytics/walkthrough`. Spec:
// api/endpoints/analytics.md. The «e se…» sliders, Monte Carlo, sensitivity and costs run on the device from `base`
// with the ported FireCalc / FirePlanning / MonteCarlo / CostsCalc. Same names on Android (`AnalyticsApi.kt`).

/// `AnalyticsView` (G9).
public struct AnalyticsView: Decodable, Equatable, Sendable {
    public let currency: String
    public let today: String
    public let walkthroughSeen: Bool
    /// As saved: what `PUT /api/analytics/assumptions` edits.
    public let storedAssumptions: FireAssumptions
    /// In use: `expectedReturn` from history when `expectedReturnAuto`.
    public let assumptions: FireAssumptions
    public let returnInfo: FireExpectedReturnInfo
    public let base: AnalyticsBase
}

/// `AnalyticsBase`: what the plan, the growth split, risk and costs read.
public struct AnalyticsBase: Decodable, Equatable, Sendable {
    public struct CashflowMonth: Decodable, Equatable, Sendable {
        public let year: Int
        public let month: Int
        public let label: String
        @FlexibleDouble public var entrate: Double
        @FlexibleDouble public var uscite: Double
    }

    public struct Cashflow: Decodable, Equatable, Sendable {
        public let months: [CashflowMonth]
        public let fromKey: String
        public let toKey: String
        public let coveredMonths: Int
        @FlexibleDouble public var annualIncome: Double
        @FlexibleDouble public var annualSpending: Double
        @FlexibleDouble public var annualSavings: Double
        @FlexibleDoubleOrNil public var savingsRate: Double?
        @FlexibleDoubleOrNil public var leanSpending: Double?
        public let monthsWithData: Int
    }

    public struct Position: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        @FlexibleDouble public var value: Double
        @FlexibleDoubleOrNil public var ter: Double?
        public let subjectToBollo: Bool
        @FlexibleDouble public var unrealizedGain: Double
        @FlexibleDouble public var taxRate: Double
    }

    public struct GrowthPoint: Decodable, Equatable, Sendable {
        public let month: String
        @FlexibleDouble public var netWorth: Double
        @FlexibleDouble public var savings: Double
    }

    public struct Tail: Decodable, Equatable, Sendable {
        @FlexibleDouble public var `var`: Double
        @FlexibleDouble public var cvar: Double
    }

    public struct Concentration: Decodable, Equatable, Sendable {
        @FlexibleDouble public var hhi: Double
        @FlexibleDouble public var effectiveN: Double
    }

    /// `AnalyticsRisk` (nil without enough price data).
    public struct Risk: Decodable, Equatable, Sendable {
        public let observations: Int
        public let fewData: Bool
        @FlexibleDoubleOrNil public var volatility: Double?
        @FlexibleDoubleOrNil public var maxDrawdown: Double?
        @FlexibleDoubleOrNil public var sharpe: Double?
        @FlexibleDoubleOrNil public var sortino: Double?
        @FlexibleDoubleOrNil public var calmar: Double?
        @FlexibleDoubleOrNil public var annualReturn: Double?
        public let tail: Tail?
        public let concentration: Concentration?
    }

    public struct RiskContribution: Decodable, Equatable, Sendable {
        public let id: String
        @FlexibleDouble public var weight: Double
        @FlexibleDouble public var riskShare: Double
    }

    public let currency: String
    public let wealth: FirePlanBase.Wealth
    public let cashflow: Cashflow
    public let positions: [Position]
    public let growthPoints: [GrowthPoint]
    public let risk: Risk?
    public let riskContribution: [RiskContribution]?
    public let names: [String: String]
    public let historicalReturn: FireHistoricalReturnResult

    /// What `FirePlanning.resolvePlan` reads.
    public var planBase: FirePlanBase {
        FirePlanBase(
            wealth: wealth,
            cashflow: .init(annualSpending: cashflow.annualSpending, annualSavings: cashflow.annualSavings, monthsWithData: cashflow.monthsWithData),
            positions: positions.map { FireLiquidationPosition(id: $0.id, name: $0.name, value: $0.value, unrealizedGain: $0.unrealizedGain, taxRate: $0.taxRate) }
        )
    }

    /// Growth split points («Da dove arriva la crescita»).
    public var splitPoints: [FireGrowthSplitPoint] {
        growthPoints.map { FireGrowthSplitPoint(month: $0.month, netWorth: $0.netWorth, savings: $0.savings) }
    }

    /// Positions with the user's TERs (`summarizeCosts` input).
    public func costPositions(ter: [String: Double]) -> [CostPosition] {
        positions.map { CostPosition(id: $0.id, name: $0.name, value: $0.value, ter: ter[$0.id], subjectToBollo: $0.subjectToBollo) }
    }
}

// MARK: - Decoding of the ported domain types

extension FirePlanBase.Wealth: Decodable {
    enum CodingKeys: String, CodingKey { case liquidity, investments, pension, debts }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(liquidity: try c.decode(FlexibleDouble.self, forKey: .liquidity).wrappedValue,
                  investments: try c.decode(FlexibleDouble.self, forKey: .investments).wrappedValue,
                  pension: try c.decode(FlexibleDouble.self, forKey: .pension).wrappedValue,
                  debts: try c.decode(FlexibleDouble.self, forKey: .debts).wrappedValue)
    }
}

extension DataPeriod: Decodable {
    enum CodingKeys: String, CodingKey { case kind, months, from, to }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if try c.decode(String.self, forKey: .kind) == "personalizzato" {
            self = .personalizzato(from: try c.decode(String.self, forKey: .from), to: try c.decode(String.self, forKey: .to))
        } else {
            self = .ultimi(months: try c.decodeIfPresent(Int.self, forKey: .months) ?? 12)
        }
    }

    /// JSON body value (`dataPeriod`).
    public var json: [String: Any] {
        switch self {
        case .ultimi(let months): ["kind": "ultimi", "months": months]
        case .personalizzato(let from, let to): ["kind": "personalizzato", "from": from, "to": to]
        }
    }
}

extension FireAssumptions: Decodable {
    enum CodingKeys: String, CodingKey {
        case withdrawalRate, dataPeriod, annualSpending, annualSavings, expectedReturn, expectedReturnAuto, volatility, inflation,
             retirementYears, rule, includePensionFunds, includeLatentTax, publicPension, terByInstrument
    }

    struct Pension: Decodable {
        @FlexibleDouble var annual: Double
        @FlexibleDouble var startsAfterYears: Double
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = FireAssumptions.defaults
        let pension = try c.decodeIfPresent(Pension.self, forKey: .publicPension)
        let ter = try c.decodeIfPresent([String: FlexibleDouble].self, forKey: .terByInstrument) ?? [:]
        self.init(
            withdrawalRate: try c.decodeIfPresent(FlexibleDouble.self, forKey: .withdrawalRate)?.wrappedValue ?? d.withdrawalRate,
            dataPeriod: try c.decodeIfPresent(DataPeriod.self, forKey: .dataPeriod) ?? d.dataPeriod,
            annualSpending: try c.decode(FlexibleDoubleOrNil.self, forKey: .annualSpending).wrappedValue,
            annualSavings: try c.decode(FlexibleDoubleOrNil.self, forKey: .annualSavings).wrappedValue,
            expectedReturn: try c.decodeIfPresent(FlexibleDouble.self, forKey: .expectedReturn)?.wrappedValue ?? d.expectedReturn,
            expectedReturnAuto: try c.decodeIfPresent(Bool.self, forKey: .expectedReturnAuto) ?? d.expectedReturnAuto,
            volatility: try c.decodeIfPresent(FlexibleDouble.self, forKey: .volatility)?.wrappedValue ?? d.volatility,
            inflation: try c.decodeIfPresent(FlexibleDouble.self, forKey: .inflation)?.wrappedValue ?? d.inflation,
            retirementYears: try c.decodeIfPresent(FlexibleDouble.self, forKey: .retirementYears)?.wrappedValue ?? d.retirementYears,
            rule: (try c.decodeIfPresent(String.self, forKey: .rule)).flatMap(WithdrawalRule.init(rawValue:)) ?? d.rule,
            includePensionFunds: try c.decodeIfPresent(Bool.self, forKey: .includePensionFunds) ?? d.includePensionFunds,
            includeLatentTax: try c.decodeIfPresent(Bool.self, forKey: .includeLatentTax) ?? d.includeLatentTax,
            publicPension: pension.map { MonteCarloPublicPension(annual: $0.annual, startsAfterYears: $0.startsAfterYears) },
            terByInstrument: ter.mapValues(\.wrappedValue)
        )
    }
}

extension FireHistoricalReturnResult: Decodable {
    enum CodingKeys: String, CodingKey { case status, months, shorterThanPeriod, fromKey, toKey, nominal, real, reason }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if try c.decode(String.self, forKey: .status) == "ok" {
            self = .ok(months: try c.decode(Int.self, forKey: .months), shorterThanPeriod: try c.decodeIfPresent(Bool.self, forKey: .shorterThanPeriod) ?? false,
                       fromKey: try c.decode(String.self, forKey: .fromKey), toKey: try c.decode(String.self, forKey: .toKey),
                       nominal: try c.decode(FlexibleDouble.self, forKey: .nominal).wrappedValue,
                       real: try c.decode(FlexibleDoubleOrNil.self, forKey: .real).wrappedValue)
        } else {
            self = .manca(reason: try c.decodeIfPresent(String.self, forKey: .reason) ?? "nessun-investimento")
        }
    }
}

extension FireExpectedReturnInfo: Decodable {
    enum CodingKeys: String, CodingKey { case value, source, history, historyReal, clamped, high }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(value: try c.decode(FlexibleDouble.self, forKey: .value).wrappedValue,
                  source: FireReturnSource(rawValue: try c.decode(String.self, forKey: .source)) ?? .prudente,
                  history: try c.decode(FireHistoricalReturnResult.self, forKey: .history),
                  historyReal: try c.decode(FlexibleDoubleOrNil.self, forKey: .historyReal).wrappedValue,
                  clamped: try c.decodeIfPresent(Bool.self, forKey: .clamped) ?? false,
                  high: try c.decodeIfPresent(Bool.self, forKey: .high) ?? false)
    }
}

// MARK: - Partial update

/// Body of `PUT /api/analytics/assumptions`: only the fields being changed, `nil` = JSON `null` (back to the data).
/// Same builders on Android (`AnalyticsAssumptionsPatch`).
public struct AnalyticsAssumptionsPatch: Equatable, Sendable {
    public enum Value: Equatable, Sendable {
        case number(Double)
        case null
        case bool(Bool)
        case text(String)
        case period(DataPeriod)
        case pension(MonteCarloPublicPension?)
        case ters([String: Double])
    }

    public private(set) var values: [String: Value] = [:]

    public init() {}

    public subscript(key: String) -> Value? {
        get { values[key] }
        set { values[key] = newValue }
    }

    public var isEmpty: Bool { values.isEmpty }
    public var keys: [String] { values.keys.sorted() }

    /// JSON object for the request body.
    public var json: [String: Any] {
        values.mapValues { value -> Any in
            switch value {
            case .number(let n): n
            case .null: NSNull()
            case .bool(let b): b
            case .text(let s): s
            case .period(let p): p.json
            case .pension(let p): p.map { ["annual": $0.annual, "startsAfterYears": $0.startsAfterYears] as [String: Any] } ?? NSNull()
            case .ters(let t): t
            }
        }
    }

    /// ANA-019: the slider values tried («Salva queste ipotesi»).
    public static func scenario(_ overrides: FireScenarioOverrides) -> AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        if let v = overrides.annualSavings { p["annualSavings"] = .number(v) }
        if let v = overrides.annualSpending { p["annualSpending"] = .number(v) }
        if let v = overrides.expectedReturn { p["expectedReturn"] = .number(v) }
        if let v = overrides.withdrawalRate { p["withdrawalRate"] = .number(v) }
        return p
    }

    /// ANA-016: back to the figure derived from the data (`annualSavings: null` / `annualSpending: null`).
    public static func useData(_ field: FireScenarioField) -> AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        p[field.rawValue] = .null
        return p
    }

    /// ANA-016: the return goes back to the history (`expectedReturnAuto: true`).
    public static var useHistoryReturn: AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        p["expectedReturnAuto"] = .bool(true)
        return p
    }

    /// ANA-011.
    public static func period(_ period: DataPeriod) -> AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        p["dataPeriod"] = .period(period)
        return p
    }

    /// ANA-031.
    public static func ters(_ ters: [String: Double]) -> AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        p["terByInstrument"] = .ters(ters)
        return p
    }

    /// ANA-008: «Il tuo traguardo» (nil = linked to the data).
    public static func annualSpending(_ value: Double?) -> AnalyticsAssumptionsPatch {
        var p = AnalyticsAssumptionsPatch()
        p["annualSpending"] = value.map { .number($0) } ?? .null
        return p
    }
}

public struct AnalyticsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// ANA-002: `GET /api/analytics/base?today=` (403 `country_feature_unavailable` for DE, ANA-001).
    public func base(today: String) async throws -> AnalyticsView {
        try await client.get("api/analytics/base", query: ["today": today])
    }

    /// `PUT /api/analytics/assumptions` (partial); refetch the base afterwards.
    public func update(_ patch: AnalyticsAssumptionsPatch) async throws {
        _ = try await client.send("api/analytics/assumptions", method: "PUT",
                                  body: try JSONSerialization.data(withJSONObject: patch.json, options: [.sortedKeys]))
    }

    /// ANA-005: `POST /api/analytics/walkthrough` (204).
    public func markWalkthroughSeen() async throws {
        try await client.sendNoContent("api/analytics/walkthrough", method: "POST")
    }
}
