import Foundation

// Debiti (spec: api/endpoints/debts.md, features/10-debts.md). Amounts are JSON numbers.
// Same names on Android (`DebtsApi` and the models in `core/data/DebtsApi.kt`).

// MARK: - GET /api/debts?include=insights

/// `DebtsViewData`: every loan with its server-computed plan, the totals and the overview readings (DEBT-001).
public struct DebtsViewData: Decodable, Equatable, Sendable {
    public let debts: [DebtView]
    public let overview: DebtsOverview
    /// `?include=insights` (gaps.md G12): interest shares, repaid shares, exit plan per slider step.
    public let insights: DebtsInsights?

    public init(debts: [DebtView], overview: DebtsOverview, insights: DebtsInsights?) {
        self.debts = debts
        self.overview = overview
        self.insights = insights
    }

    public func debt(_ id: String) -> DebtView? { debts.first { $0.id == id } }
}

public struct DebtCostData: Codable, Equatable, Sendable {
    public let label: String
    public let amount: Double
    /// `una_tantum` | `per_rata`.
    public let kind: String
}

public struct DebtView: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    /// Raw `nuovo` | `origine` | `fotografia`.
    public let startModeRaw: String
    public let principal: Double
    public let annualRate: Double
    public let installments: Int
    public let firstInstallmentDate: String
    public let declaredInstallment: Double?
    public let anchorDate: String?
    public let costs: [DebtCostData]
    public let plan: DebtPlanData
    /// TAEG %, nil when not computable.
    public let apr: Double?
    /// Sorted by date ascending.
    public let events: [DebtEventView]

    enum CodingKeys: String, CodingKey {
        case id, name, principal, annualRate, installments, firstInstallmentDate, declaredInstallment, anchorDate, costs, plan, apr, events
        case startModeRaw = "startMode"
    }

    public var startMode: DebtStartMode { DebtStartMode(rawValue: startModeRaw) ?? .nuovo }
    public var totals: DebtPlanTotals { plan.totals }
    public var finished: Bool { plan.totals.finished }
}

public struct DebtPlanData: Decodable, Equatable, Sendable {
    public let rows: [DebtPlanRow]
    public let totals: DebtPlanTotals
}

public struct DebtPlanRow: Decodable, Equatable, Identifiable, Sendable {
    public struct Payment: Decodable, Equatable, Sendable {
        public let date: String
        public let amount: Double
        public let transactionId: String?
    }

    public let number: Int
    public let dueDate: String
    public let installment: Double
    public let interest: Double
    public let capital: Double
    /// Residual after this installment.
    public let residual: Double
    public let statusRaw: String
    public let payment: Payment?

    enum CodingKeys: String, CodingKey {
        case number, dueDate, installment, interest, capital, residual, payment
        case statusRaw = "status"
    }

    public var id: Int { number }
    /// Unknown future values read as «Da pagare».
    public var status: DebtInstallmentStatus { DebtInstallmentStatus(rawValue: statusRaw) ?? .daPagare }

    public init(number: Int, dueDate: String, installment: Double, interest: Double, capital: Double, residual: Double,
                status: DebtInstallmentStatus, payment: Payment? = nil) {
        self.number = number
        self.dueDate = dueDate
        self.installment = installment
        self.interest = interest
        self.capital = capital
        self.residual = residual
        statusRaw = status.rawValue
        self.payment = payment
    }
}

public struct DebtPlanTotals: Decodable, Equatable, Sendable {
    public let residual: Double
    public let currentInstallment: Double
    public let interestToDate: Double
    public let interestRemaining: Double
    public let paidTotal: Double
    public let remainingInstallments: Int
    public let endDate: String
    public let nextDueDate: String?
    public let overdueCount: Int
    public let unconfirmedCount: Int
    public let finished: Bool
    public let closedOn: String?
}

public struct DebtEventView: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    /// `payment` | `rate_change` | `balance_correction` | `early_repayment` (legacy kinds are ignored by the UI).
    public let type: String
    public let date: String
    public let amount: Double?
    public let installmentNumber: Int?
    public let rate: Double?
    public let penalty: Double?
    public let effect: String?
    public let transactionId: String?

    public init(id: String, type: String, date: String, amount: Double? = nil, installmentNumber: Int? = nil, rate: Double? = nil,
                penalty: Double? = nil, effect: String? = nil, transactionId: String? = nil) {
        self.id = id
        self.type = type
        self.date = date
        self.amount = amount
        self.installmentNumber = installmentNumber
        self.rate = rate
        self.penalty = penalty
        self.effect = effect
        self.transactionId = transactionId
    }
}

public struct DebtsOverview: Decodable, Equatable, Sendable {
    public struct Due: Decodable, Equatable, Sendable {
        public let debtId: String
        public let name: String
        public let date: String
        public let amount: Double
        public let overdue: Bool
    }

    public let totalResidual: Double
    public let totalDebt: Double
    public let monthlyPayment: Double
    public let debtFreeDate: String?
    public let openCount: Int
    /// Max 5, by date ascending (DEBT-003).
    public let nextDue: [Due]
}

public struct DebtsInsights: Decodable, Equatable, Sendable {
    public struct InterestShare: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let yearly: Double
        public let share: Double
    }

    public struct InterestShares: Decodable, Equatable, Sendable {
        public let items: [InterestShare]
        public let total: Double
    }

    public struct Repaid: Decodable, Equatable, Sendable {
        public let debtId: String
        public let share: Double
    }

    public struct Slider: Decodable, Equatable, Sendable {
        public let min: Double
        public let max: Double
        public let step: Double
        public let `default`: Double
    }

    public struct ExitStep: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let endDate: String
        public let baselineEndDate: String
        public let monthsSaved: Int
    }

    public struct ExitPlan: Decodable, Equatable, Sendable {
        public let steps: [ExitStep]
        public let endDate: String
        public let baselineEndDate: String
        public let interestSaved: Double
    }

    public struct Exit: Decodable, Equatable, Sendable {
        public let slider: Slider
        public let extras: [Double]
        /// `plans[i]` = plan with `extras[i]` per month (nil without open loans).
        public let plans: [ExitPlan?]
    }

    public let interestShares: InterestShares
    public let repaid: [Repaid]
    public let exit: Exit
}

// MARK: - Requests

/// `POST /api/debts/{id}/events` body (discriminated on `type`).
public enum DebtEventInput: Equatable, Sendable {
    case payment(installmentNumber: Int, date: String, amount: Double, transactionId: String?)
    case rateChange(date: String, rate: Double)
    case balanceCorrection(date: String, amount: Double)
    case earlyRepayment(date: String, amount: Double, penalty: Double, effect: DebtEarlyRepaymentEffect)

    var json: [String: Any] {
        switch self {
        case let .payment(number, date, amount, transactionId):
            var body: [String: Any] = ["type": "payment", "installmentNumber": number, "date": date, "amount": amount]
            if let transactionId { body["transactionId"] = transactionId }
            return body
        case let .rateChange(date, rate):
            return ["type": "rate_change", "date": date, "rate": rate]
        case let .balanceCorrection(date, amount):
            return ["type": "balance_correction", "date": date, "amount": amount]
        case let .earlyRepayment(date, amount, penalty, effect):
            return ["type": "early_repayment", "date": date, "amount": amount, "penalty": penalty, "effect": effect.rawValue]
        }
    }
}

extension DebtCreateInput {
    /// DEBT-017: `installment` only when typed, `anchorDate` only for `fotografia`.
    var json: [String: Any] {
        var body: [String: Any] = [
            "name": name, "startMode": startMode.rawValue, "principal": principal, "annualRate": annualRate,
            "installments": installments, "firstInstallmentDate": firstInstallmentDate,
            "costs": costs.map { ["label": $0.label, "amount": $0.amount, "kind": $0.kind.rawValue] },
        ]
        if let installment { body["installment"] = installment }
        if let anchorDate { body["anchorDate"] = anchorDate }
        return body
    }
}

// MARK: - API

public struct DebtsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// DEBT-001: one request for every Debiti screen (`?include=insights`).
    public func view() async throws -> DebtsViewData {
        try await client.get("api/debts", query: ["include": "insights"])
    }

    /// DEBT-016 (201 `{ id }`).
    @discardableResult
    public func create(_ input: DebtCreateInput) async throws -> String {
        let response = try await client.send("api/debts", method: "POST", body: try Self.body(input.json))
        return Self.id(response.data)
    }

    /// DEBT-028 (204).
    public func delete(id: String) async throws {
        try await client.sendNoContent("api/debts/\(id)", method: "DELETE")
    }

    /// DEBT-023/025/026/034 (201 `{ id }`).
    public func addEvent(debtId: String, _ input: DebtEventInput) async throws {
        _ = try await client.send("api/debts/\(debtId)/events", method: "POST", body: try Self.body(input.json))
    }

    /// DEBT-027 (204).
    public func deleteEvent(debtId: String, eventId: String) async throws {
        try await client.sendNoContent("api/debts/\(debtId)/events/\(eventId)", method: "DELETE")
    }

    /// DEBT-020: marks every past unsettled installment up to `upTo` (201 `{ count }`).
    public func bulkPay(debtId: String, upTo: Int) async throws -> Int {
        struct Count: Decodable { let count: Int }
        struct Body: Encodable { let upToInstallment: Int }
        let result: Count = try await client.post("api/debts/\(debtId)/payments/bulk", body: Body(upToInstallment: upTo))
        return result.count
    }

    /// DEBT-024: expenses within ±`DebtsRules.candidateWindowDays` of the due date (paged endpoint, one page of 200).
    public func candidates(dueDate: String) async throws -> [Movement] {
        guard let due = CalendarDate(iso: dueDate) else { return [] }
        let query = [
            "from": due.adding(days: -DebtsRules.candidateWindowDays).iso, "to": due.adding(days: DebtsRules.candidateWindowDays).iso,
            "type": MovementType.uscita.rawValue, "limit": "200",
        ]
        let page: MovementPage = try await client.get("api/transactions", query: query)
        return page.items
    }

    static func body(_ json: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }

    static func id(_ data: Data) -> String {
        struct Created: Decodable { let id: String }
        return (try? JSONDecoder().decode(Created.self, from: data))?.id ?? ""
    }
}
