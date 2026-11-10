import Foundation

// Obiettivi (12-goals): `GET /api/goals` (the whole view: plan rows, sources, free balances, FIRE comparison) and the
// goal mutations. Also read by the Overview tile (OV-030…032). Spec: api/endpoints/goals.md. Same names on Android.

/// `GET /api/goals` (IT only, `capabilities.sections.goals`).
public struct GoalsView: Decodable, Equatable, Sendable {
    /// Analitiche FIRE target as the "last goal"; nil when spending or savings are unknown.
    public struct Fire: Decodable, Equatable, Sendable {
        @FlexibleDouble public var target: Double
        @FlexibleDouble public var wealth: Double
        @FlexibleDouble public var progress: Double
        public let baseYear: Int?
        public let withGoalsYear: Int?

        public init(target: Double, wealth: Double, progress: Double, baseYear: Int?, withGoalsYear: Int?) {
            self.target = target
            self.wealth = wealth
            self.progress = progress
            self.baseYear = baseYear
            self.withGoalsYear = withGoalsYear
        }
    }

    public let currency: String
    public let todayKey: String
    /// Average monthly savings; nil if unknown.
    @FlexibleDoubleOrNil public var capacity: Double?
    @FlexibleDouble public var requested: Double
    @FlexibleDouble public var allocated: Double
    @FlexibleDouble public var gap: Double
    public let goals: [GoalView]
    public let fire: Fire?
    public let sources: [GoalFreeSourceView]
    @FlexibleDoubleOrNil public var essentialMonthly: Double?
    /// Where `essentialMonthly` comes from (web #382): `dovute` (Dovute + Saltuarie) or `tutte` (every expense).
    public let essentialBasis: String?

    enum CodingKeys: String, CodingKey { case currency, todayKey, capacity, requested, allocated, gap, goals, fire, sources, essentialMonthly, essentialBasis }

    public init(currency: String, todayKey: String = "", capacity: Double? = nil, requested: Double = 0, allocated: Double = 0, gap: Double = 0,
                goals: [GoalView], fire: Fire? = nil, sources: [GoalFreeSourceView] = [], essentialMonthly: Double? = nil,
                essentialBasis: String? = nil) {
        self.currency = currency
        self.todayKey = todayKey
        self.capacity = capacity
        self.requested = requested
        self.allocated = allocated
        self.gap = gap
        self.goals = goals
        self.fire = fire
        self.sources = sources
        self.essentialMonthly = essentialMonthly
        self.essentialBasis = essentialBasis
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currency = try c.decodeIfPresent(String.self, forKey: .currency) ?? "EUR"
        todayKey = try c.decodeIfPresent(String.self, forKey: .todayKey) ?? ""
        _capacity = try c.decode(FlexibleDoubleOrNil.self, forKey: .capacity)
        _requested = try c.decodeIfPresent(FlexibleDouble.self, forKey: .requested) ?? FlexibleDouble(wrappedValue: 0)
        _allocated = try c.decodeIfPresent(FlexibleDouble.self, forKey: .allocated) ?? FlexibleDouble(wrappedValue: 0)
        _gap = try c.decodeIfPresent(FlexibleDouble.self, forKey: .gap) ?? FlexibleDouble(wrappedValue: 0)
        goals = try c.decodeIfPresent([GoalView].self, forKey: .goals) ?? []
        fire = try c.decodeIfPresent(Fire.self, forKey: .fire)
        sources = try c.decodeIfPresent([GoalFreeSourceView].self, forKey: .sources) ?? []
        _essentialMonthly = try c.decode(FlexibleDoubleOrNil.self, forKey: .essentialMonthly)
        essentialBasis = try c.decodeIfPresent(String.self, forKey: .essentialBasis)
    }

    public func goal(_ id: String) -> GoalView? { goals.first { $0.id == id } }
}

/// `GoalSourceView`: a part of an account or a position assigned to a goal.
public struct GoalSourceView: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    /// `account` | `instrument`.
    public let kind: String
    public let refId: String
    public let name: String
    @FlexibleDouble public var amount: Double
    @FlexibleDouble public var counted: Double
    @FlexibleDouble public var tax: Double
    @FlexibleDouble public var total: Double
    public let short: Bool
    /// GOAL-037 (web #382): the account's avatar or the instrument type, for the source icon.
    public let accountColor: String?
    public let accountIcon: String?
    public let instrumentType: String?

    public init(id: String, kind: String, refId: String, name: String, amount: Double, counted: Double, tax: Double = 0, total: Double,
                short: Bool = false, accountColor: String? = nil, accountIcon: String? = nil, instrumentType: String? = nil) {
        self.accountColor = accountColor
        self.accountIcon = accountIcon
        self.instrumentType = instrumentType
        self.id = id
        self.kind = kind
        self.refId = refId
        self.name = name
        self.amount = amount
        self.counted = counted
        self.tax = tax
        self.total = total
        self.short = short
    }
}

/// `FreeSource`: the free (unassigned) part of an account or position.
public struct GoalFreeSourceView: Decodable, Equatable, Sendable {
    public let kind: String
    public let id: String
    public let name: String
    @FlexibleDouble public var total: Double
    @FlexibleDouble public var free: Double
    @FlexibleDouble public var taxPerEuro: Double
    public let accountColor: String?
    public let accountIcon: String?
    public let instrumentType: String?

    public init(kind: String, id: String, name: String, total: Double, free: Double, taxPerEuro: Double = 0,
                accountColor: String? = nil, accountIcon: String? = nil, instrumentType: String? = nil) {
        self.accountColor = accountColor
        self.accountIcon = accountIcon
        self.instrumentType = instrumentType
        self.kind = kind
        self.id = id
        self.name = name
        self.total = total
        self.free = free
        self.taxPerEuro = taxPerEuro
    }
}

public struct GoalView: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let kind: String
    @FlexibleDouble public var target: Double
    public let targetDate: String?
    @FlexibleDouble public var monthly: Double
    public let priority: Int
    public let achievedAt: String?
    public let sources: [GoalSourceView]
    @FlexibleDouble public var current: Double
    @FlexibleDouble public var progress: Double
    @FlexibleDouble public var funded: Double
    @FlexibleDoubleOrNil public var required: Double?
    public let etaMonth: String?
    public let monthsToGo: Int?
    public let status: String
    public let fireShiftMonths: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, kind, target, targetDate, monthly, priority, achievedAt, sources, current, progress, funded, required, etaMonth, monthsToGo,
             status, fireShiftMonths
    }

    public init(id: String, name: String, kind: String = "altro", target: Double, targetDate: String? = nil, monthly: Double = 0,
                achievedAt: String? = nil, current: Double = 0, progress: Double, funded: Double = 0, required: Double? = nil,
                etaMonth: String? = nil, monthsToGo: Int?, status: String, priority: Int = 0, sources: [GoalSourceView] = [],
                fireShiftMonths: Int? = nil) {
        self.id = id
        self.name = name
        self.kind = kind
        self.target = target
        self.targetDate = targetDate
        self.monthly = monthly
        self.priority = priority
        self.achievedAt = achievedAt
        self.sources = sources
        self.current = current
        self.progress = progress
        self.funded = funded
        self.required = required
        self.etaMonth = etaMonth
        self.monthsToGo = monthsToGo
        self.status = status
        self.fireShiftMonths = fireShiftMonths
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "altro"
        _target = try c.decode(FlexibleDouble.self, forKey: .target)
        targetDate = try c.decodeIfPresent(String.self, forKey: .targetDate)
        _monthly = try c.decodeIfPresent(FlexibleDouble.self, forKey: .monthly) ?? FlexibleDouble(wrappedValue: 0)
        priority = try c.decodeIfPresent(Int.self, forKey: .priority) ?? 0
        achievedAt = try c.decodeIfPresent(String.self, forKey: .achievedAt)
        sources = try c.decodeIfPresent([GoalSourceView].self, forKey: .sources) ?? []
        _current = try c.decodeIfPresent(FlexibleDouble.self, forKey: .current) ?? FlexibleDouble(wrappedValue: 0)
        _progress = try c.decode(FlexibleDouble.self, forKey: .progress)
        _funded = try c.decodeIfPresent(FlexibleDouble.self, forKey: .funded) ?? FlexibleDouble(wrappedValue: 0)
        _required = try c.decode(FlexibleDoubleOrNil.self, forKey: .required)
        etaMonth = try c.decodeIfPresent(String.self, forKey: .etaMonth)
        monthsToGo = try c.decodeIfPresent(Int.self, forKey: .monthsToGo)
        status = try c.decode(String.self, forKey: .status)
        fireShiftMonths = try c.decodeIfPresent(Int.self, forKey: .fireShiftMonths)
    }
}

public struct GoalsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// GOAL-004.
    public func list() async throws -> GoalsView { try await client.get("api/goals") }

    /// GOAL-024: `POST /api/goals` → `{ id }`.
    @discardableResult
    public func create(_ payload: GoalPayload) async throws -> String {
        struct Created: Decodable { let id: String }
        let response = try await client.send("api/goals", method: "POST", body: try body(GoalsAPI.json(payload, includePriority: true)))
        return (try? JSONDecoder().decode(Created.self, from: response.data))?.id ?? ""
    }

    /// GOAL-025: every field except the priority; the sources replace the existing ones.
    public func update(id: String, _ payload: GoalPayload) async throws {
        _ = try await client.send("api/goals/\(InvestmentsAPI.escape(id))", method: "PATCH",
                                  body: try body(GoalsAPI.json(payload, includePriority: false)))
    }

    /// GOAL-031: `PATCH {achieved}`.
    public func setAchieved(id: String, _ achieved: Bool) async throws {
        _ = try await client.send("api/goals/\(InvestmentsAPI.escape(id))", method: "PATCH", body: try body(["achieved": achieved]))
    }

    /// GOAL-032.
    public func delete(id: String) async throws {
        _ = try await client.send("api/goals/\(InvestmentsAPI.escape(id))", method: "DELETE")
    }

    /// GOAL-009: the full id order (409 when stale, GOAL-010).
    public func reorder(_ ids: [String]) async throws {
        _ = try await client.send("api/goals/reorder", method: "POST", body: try body(["ids": ids]))
    }

    private func body(_ json: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }

    /// Request body of create / edit (`toPayload`).
    public static func json(_ payload: GoalPayload, includePriority: Bool) -> [String: Any] {
        var json: [String: Any] = [
            "name": payload.name,
            "kind": payload.kind.rawValue,
            "targetAmount": payload.targetAmount,
            "targetDate": payload.targetDate.map { $0 as Any } ?? NSNull(),
            "monthlyAmount": payload.monthlyAmount,
            "sources": payload.sources.map { s -> [String: Any] in
                var item: [String: Any] = ["amount": s.amount]
                if let id = s.accountId { item["accountId"] = id }
                if let id = s.instrumentId { item["instrumentId"] = id }
                return item
            },
        ]
        if includePriority { json["priority"] = payload.priority }
        return json
    }
}
