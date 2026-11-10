import Foundation

// Liquidità month and analysis views (spec: api/endpoints/liquidity.md). Same names on Android (`LiquidityApi`).

/// A sentence from the server's voice engine: plain and strong (bold) segments.
public struct VoiceSegment: Decodable, Equatable, Sendable {
    public let text: String
    public let strong: Bool

    public init(text: String, strong: Bool = false) {
        self.text = text
        self.strong = strong
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = try c.decode(String.self, forKey: .text)
        strong = try c.decodeIfPresent(Bool.self, forKey: .strong) ?? false
    }

    enum CodingKeys: String, CodingKey { case text, strong }
}

/// `GET /api/liquidity/month` (TX-008, TX-049…051): month figures, pace, groups and budgets for Movimenti.
public struct LiquidityMonth: Decodable, Equatable, Sendable {
    public struct Month: Decodable, Equatable, Sendable {
        public let from: String
        public let to: String
        public let label: String
    }

    public struct Accounts: Decodable, Equatable, Sendable {
        public let total: Double
        public let count: Int
    }

    public struct Pace: Decodable, Equatable, Sendable {
        public let spentSoFar: Double
        /// «Di solito a questo punto»; nil when there is no history.
        public let typicalSoFar: Double?
        public let dayOfMonth: Int
        public let daysInMonth: Int
    }

    public struct Group: Decodable, Equatable, Identifiable, Sendable {
        public let key: String
        public let label: String
        public let amount: Double
        public var id: String { key }
    }

    public struct BudgetTotal: Decodable, Equatable, Sendable {
        public let total: Double
        public let spent: Double
        public let remaining: Double
    }

    public struct CategoryBudget: Decodable, Equatable, Identifiable, Sendable {
        public let categoryId: String
        public let name: String
        public let color: String
        public let icon: String
        public let budget: Double
        public let spent: Double
        public let remaining: Double
        public let progress: Double
        public var id: String { categoryId }
    }

    public struct VoiceLine: Decodable, Equatable, Sendable {
        public let key: String
        public let segments: [VoiceSegment]
    }

    public let currency: String
    public let today: String
    public let month: Month
    public let accountId: String?
    public let accounts: Accounts
    public let spent: Double
    public let income: Double
    public let pace: Pace
    public let groups: [Group]
    public let uncategorizedSpent: Double
    public let budget: BudgetTotal?
    public let budgets: [CategoryBudget]
    public let toFix: Int
    public let voice: [VoiceLine]

    /// «Avanzo finora» = entrate − spese (TX-049).
    public var surplus: Double { JSNumber.round2(income - spent) }
}

/// `GET /api/liquidity/analysis` (TX-052…061): everything Analisi shows for one period.
public struct LiquidityAnalysis: Decodable, Equatable, Sendable {
    public struct Range: Decodable, Equatable, Sendable {
        public let from: String
        public let to: String
    }

    public struct CurvePoint: Decodable, Equatable, Sendable {
        public let date: String
        public let value: Double
    }

    public struct GroupCategory: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let color: String
        public let icon: String
        public let amount: Double
        public let budget: Double?
    }

    public struct Group: Decodable, Equatable, Identifiable, Sendable {
        public let key: String
        public let label: String
        public let amount: Double
        public let categories: [GroupCategory]
        public var id: String { key }
    }

    public struct IncomeSource: Decodable, Equatable, Identifiable, Sendable {
        public let categoryId: String
        public let name: String
        public let color: String
        public let icon: String
        public let amount: Double
        public let quotaPct: Double?
        public var id: String { categoryId }
    }

    public struct SavingsPoint: Decodable, Equatable, Sendable {
        public let month: String
        public let cumulative: Double
    }

    public let currency: String
    public let today: String
    public let period: String
    public let accountId: String?
    public let range: Range
    public let previousRange: Range
    public let isCurrentMonth: Bool
    public let spent: Double
    public let spentBefore: Double
    public let delta: Double
    public let curve: [CurvePoint]
    public let typical: [Double]?
    public let groups: [Group]
    public let hasBudgets: Bool
    public let incomeSources: [IncomeSource]
    public let savings: [SavingsPoint]
    public let saved: Double
    public let sentence: String
}

extension Account {
    /// Manual movements can be added only to manual accounts (TX-044).
    public var isManual: Bool { !isLinked }
}

public struct LiquidityAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func month(accountId: String?, today: CalendarDate) async throws -> LiquidityMonth {
        var query = ["today": today.iso]
        if let accountId { query["accountId"] = accountId }
        return try await client.get("api/liquidity/month", query: query)
    }

    /// `period`: `mese` | `3mesi` | `anno` (| `settimana`).
    public func analysis(period: String, ref: CalendarDate, accountId: String?, today: CalendarDate) async throws -> LiquidityAnalysis {
        var query = ["period": period, "ref": ref.iso, "today": today.iso]
        if let accountId { query["accountId"] = accountId }
        return try await client.get("api/liquidity/analysis", query: query)
    }
}
