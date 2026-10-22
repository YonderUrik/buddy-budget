import Foundation

// German financial planning (13-planning-de): the plan document with its revision (`GET/PUT /api/financial-planning`),
// the server-computed results (`?include=results`, `POST /api/financial-planning/results`) and the instrument names /
// fund sales the screens label them with (`GET /api/investments/overview`). Spec: api/endpoints/financial-planning.md.
// Same names on Android (`FinancialPlanningApi.kt`).

/// A JSON tree kept verbatim: the plan document is stored and sent back as received, so fields the app does not edit
/// (hidden sections, future keys) survive a save (PLAN-014). Numbers are doubles, as in JavaScript.
public indirect enum JSONNode: Codable, Equatable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONNode])
    case object([String: JSONNode])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONNode].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONNode].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n):
            // Integral values are written without a fraction (2026, not 2026.0), like JSON.stringify.
            if n.rounded() == n, abs(n) < 1e15 { try c.encode(Int64(n)) } else { try c.encode(n) }
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    public subscript(key: String) -> JSONNode? {
        if case .object(let o) = self { return o[key] }
        return nil
    }

    public var object: [String: JSONNode]? { if case .object(let o) = self { return o } else { return nil } }
    public var array: [JSONNode]? { if case .array(let a) = self { return a } else { return nil } }
    public var double: Double? { if case .number(let n) = self { return n } else { return nil } }
    public var bool: Bool? { if case .bool(let b) = self { return b } else { return nil } }
    public var string: String? { if case .string(let s) = self { return s } else { return nil } }
    public var isNull: Bool { self == .null }
}

/// `GET /api/financial-planning[?include=results]` and `PUT` responses.
public struct PlanningEnvelope: Decodable, Equatable, Sendable {
    public let plan: JSONNode
    public let revision: Int
    /// Only with `?include=results`.
    public let results: PlanningResults?

    public init(plan: JSONNode, revision: Int, results: PlanningResults? = nil) {
        self.plan = plan
        self.revision = revision
        self.results = results
    }
}

/// `PlanningResults` (`lib/views/financial-planning.ts`): what the Tax and Income sections compute from the plan and
/// all investment data, for the sections the rollout switches enable.
public struct PlanningResults: Decodable, Equatable, Sendable {
    public struct Sections: Decodable, Equatable, Sendable {
        public let tax, income, pension, retirement, simulations: Bool
        public init(tax: Bool = true, income: Bool = true, pension: Bool = false, retirement: Bool = false, simulations: Bool = false) {
            self.tax = tax; self.income = income; self.pension = pension; self.retirement = retirement; self.simulations = simulations
        }
    }

    public struct TaxEvent: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let instrumentId: String
        public let date: String
        @FlexibleDouble public var gain: Double
        @FlexibleDouble public var taxable: Double
        /// `shares` | `general`.
        public let basket: String
    }

    public struct TaxIssue: Decodable, Equatable, Hashable, Sendable {
        /// "" for portfolio-wide issues (currency, history).
        public let instrumentId: String
        /// `currency` | `history` | `classification` | `fund-history` | `legacy` | `unsupported` | `missing-lots` | `invalid`.
        public let reason: String
        public init(instrumentId: String, reason: String) { self.instrumentId = instrumentId; self.reason = reason }
    }

    public struct TaxEstimate: Decodable, Equatable, Sendable {
        @FlexibleDouble public var taxable: Double
        @FlexibleDouble public var foreignCredit: Double
        @FlexibleDouble public var usedAllowance: Double
        @FlexibleDouble public var remainingAllowance: Double
        @FlexibleDouble public var capitalTax: Double
        @FlexibleDouble public var solidarity: Double
        @FlexibleDouble public var church: Double
        @FlexibleDouble public var total: Double
        @FlexibleDouble public var remainingShareLosses: Double
        @FlexibleDouble public var remainingGeneralLosses: Double
    }

    public struct TaxReport: Decodable, Equatable, Sendable {
        public let events: [TaxEvent]
        public let issues: [TaxIssue]
        @FlexibleDouble public var recordedTaxes: Double
        @FlexibleDouble public var shareGains: Double
        @FlexibleDouble public var generalIncome: Double
        /// nil while any issue exists (PLAN-016, PLAN-022).
        public let estimate: TaxEstimate?
    }

    public struct Tax: Decodable, Equatable, Sendable {
        public let report: TaxReport
        /// Funds / ETFs with operations to classify (`plan.tax.fundKinds`).
        public let fundInstrumentIds: [String]
        /// 2026 fund sales that take prior advances (`plan.tax.priorAdvancesBySale`).
        public let fundSaleIds: [String]
    }

    public struct IncomeEvent: Decodable, Equatable, Sendable {
        public let instrumentId: String
        /// `dividendo` | `cedola`.
        public let kind: String
        public let date: String
        @FlexibleDouble public var gross: Double
        /// nil = «More information needed» (PLAN-029).
        @FlexibleDoubleOrNil public var net: Double?
        /// Row computed with unchanged 2026 rules (only with simulations).
        public let benchmark: Bool

        enum CodingKeys: String, CodingKey { case instrumentId, kind, date, gross, net, benchmark }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            instrumentId = try c.decode(String.self, forKey: .instrumentId)
            kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "dividendo"
            date = try c.decode(String.self, forKey: .date)
            _gross = try c.decode(FlexibleDouble.self, forKey: .gross)
            _net = try c.decode(FlexibleDoubleOrNil.self, forKey: .net)
            benchmark = try c.decodeIfPresent(Bool.self, forKey: .benchmark) ?? false
        }
    }

    public struct IncomeYear: Decodable, Equatable, Sendable {
        public let year: Int
        @FlexibleDouble public var gross: Double
        @FlexibleDouble public var withheld: Double
        @FlexibleDouble public var net: Double
    }

    public struct Income: Decodable, Equatable, Sendable {
        public let events: [IncomeEvent]
        @FlexibleDouble public var totalGross: Double
        public let bondsWithoutTerms: [String]
        public let history: [IncomeYear]
    }

    public let currency: String
    /// false when the account currency is not EUR (PLAN-009): `tax` and `income` are nil.
    public let supported: Bool
    public let sections: Sections
    public let tax: Tax?
    public let income: Income?
}

/// The parts of `GET /api/investments/overview` the planning screens label results with (PLAN-008): instrument names
/// and the operations behind fund rows. Prices are not needed (the server computes), so the app asks for the shortest
/// price window; instruments and operations are always complete.
public struct PlanningPortfolio: Decodable, Equatable, Sendable {
    public struct InstrumentRef: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let type: String
        public init(id: String, name: String, type: String) { self.id = id; self.name = name; self.type = type }
    }

    public struct Operation: Decodable, Equatable, Sendable {
        public let id: String
        public let instrumentId: String
        public let type: String
        public let date: String
        public init(id: String, instrumentId: String, type: String, date: String) {
            self.id = id; self.instrumentId = instrumentId; self.type = type; self.date = date
        }
    }

    public let currency: String
    public let instruments: [InstrumentRef]
    public let transactions: [Operation]

    public init(currency: String = "EUR", instruments: [InstrumentRef], transactions: [Operation]) {
        self.currency = currency
        self.instruments = instruments
        self.transactions = transactions
    }

    public func name(_ instrumentId: String) -> String? { instruments.first { $0.id == instrumentId }?.name }
    public func operation(_ id: String) -> Operation? { transactions.first { $0.id == id } }
}

public struct FinancialPlanningAPI: Sendable {
    let client: APIClient

    public init(client: APIClient) { self.client = client }

    private struct PutBody: Encodable { let plan: JSONNode; let revision: Int }
    private struct ResultsBody: Encodable { let plan: JSONNode }

    /// PLAN-007: the saved plan (defaults with revision 0 when nothing is saved) and the results of the saved plan.
    public func load() async throws -> PlanningEnvelope {
        try await client.get("api/financial-planning", query: ["include": "results"])
    }

    /// PLAN-012: saves the whole document with the revision last loaded. 409 `plan_changed` when stale (PLAN-013).
    public func save(plan: JSONNode, revision: Int) async throws -> PlanningEnvelope {
        try await client.put("api/financial-planning", body: PutBody(plan: plan, revision: revision))
    }

    /// Results of an unsaved plan (pure, nothing saved): called debounced while the user edits the tax profile.
    public func preview(plan: JSONNode) async throws -> PlanningResults {
        try await client.post("api/financial-planning/results", body: ResultsBody(plan: plan))
    }

    /// PLAN-008: instruments and operations (`period=1mese` keeps the price arrays short; operations are all of them).
    public func portfolio() async throws -> PlanningPortfolio {
        try await client.get("api/investments/overview", query: ["period": "1mese"])
    }
}
