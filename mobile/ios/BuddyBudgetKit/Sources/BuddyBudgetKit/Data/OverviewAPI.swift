import Foundation

// Overview (spec: api/endpoints/overview.md, features/02-overview.md). The server computes everything; the app only
// renders it. Same names on Android (`OverviewApi`, `OverviewView`).

/// Chart window of `GET /api/overview` (OV-009). Raw values are the API's.
public enum OverviewPeriod: String, CaseIterable, Sendable {
    case oneMonth = "1mese"
    case threeMonths = "3mesi"
    case oneYear = "1anno"
    case max

    /// OV-009: `3M` on every visit.
    public static let `default`: OverviewPeriod = .threeMonths

    /// Segmented-control label (Italian source).
    public var label: String {
        switch self {
        case .oneMonth: "1M"
        case .threeMonths: "3M"
        case .oneYear: "1A"
        case .max: "Max"
        }
    }

    /// OV-012: phrase after the change line (Italian source).
    public var changePhrase: String {
        switch self {
        case .oneMonth: "nell'ultimo mese"
        case .threeMonths: "negli ultimi 3 mesi"
        case .oneYear: "nell'ultimo anno"
        case .max: "dall'inizio"
        }
    }
}

/// `GET /api/overview` → `OverviewView` (amounts are numbers; debts negative everywhere).
public struct OverviewView: Decodable, Equatable, Sendable {
    public struct SeriesPoint: Decodable, Equatable, Sendable {
        public let date: String
        @FlexibleDouble public var value: Double
        public let byClass: [String: Double]
        public let isEstimated: Bool

        public init(date: String, value: Double, byClass: [String: Double], isEstimated: Bool = false) {
            self.date = date
            self.value = value
            self.byClass = byClass
            self.isEstimated = isEstimated
        }
    }

    public struct Change: Decodable, Equatable, Sendable {
        @FlexibleDouble public var start: Double
        @FlexibleDouble public var end: Double
        @FlexibleDouble public var delta: Double
        @FlexibleDoubleOrNil public var deltaPct: Double?

        public init(start: Double, end: Double, delta: Double, deltaPct: Double?) {
            self.start = start
            self.end = end
            self.delta = delta
            self.deltaPct = deltaPct
        }
    }

    public struct Highlight: Decodable, Equatable, Sendable {
        @FlexibleDouble public var amount: Double
        @FlexibleDoubleOrNil public var ratio: Double?
        public let label: String
    }

    public struct CompositionItem: Decodable, Equatable, Sendable {
        public let key: String
        public let label: String
        public let detail: String
        @FlexibleDouble public var amount: Double
        @FlexibleDouble public var share: Double
        public let isLiability: Bool
        public let highlight: Highlight?
    }

    public struct MonthPace: Decodable, Equatable, Sendable {
        @FlexibleDouble public var spentSoFar: Double
        @FlexibleDoubleOrNil public var typicalSoFar: Double?
        @FlexibleDouble public var income: Double
        @FlexibleDoubleOrNil public var budgetTotal: Double?
        @FlexibleDouble public var budgetSpent: Double
        public let dayOfMonth: Int
        public let daysInMonth: Int
        public let current: [Double]
        public let typical: [Double]?
    }

    public struct VoiceSegment: Decodable, Equatable, Sendable {
        public let text: String
        public let strong: Bool

        enum CodingKeys: String, CodingKey { case text, strong }

        public init(text: String, strong: Bool = false) {
            self.text = text
            self.strong = strong
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            text = try c.decode(String.self, forKey: .text)
            strong = try c.decodeIfPresent(Bool.self, forKey: .strong) ?? false
        }
    }

    public struct VoiceLine: Decodable, Equatable, Sendable {
        public let key: String
        public let segments: [VoiceSegment]
    }

    public struct Investments: Decodable, Equatable, Sendable {
        @FlexibleDouble public var value: Double
        public let positions: Int
        @FlexibleDouble public var paid: Double
        @FlexibleDouble public var marketGain: Double
    }

    public struct Pension: Decodable, Equatable, Sendable {
        @FlexibleDouble public var value: Double
        public let funds: Int
        public let included: Bool
    }

    public struct NextDue: Decodable, Equatable, Sendable {
        public let debtId: String
        public let name: String
        public let date: String
        @FlexibleDouble public var amount: Double
        public let overdue: Bool
    }

    public struct Debts: Decodable, Equatable, Sendable {
        @FlexibleDouble public var total: Double
        public let count: Int
        public let debtFreeDate: String?
        public let nextDue: [NextDue]
    }

    public struct RenewalAlert: Decodable, Equatable, Sendable {
        public let connectionId: String
        public let institutionName: String
        public let state: String
        public let daysLeft: Int?
        public let message: String
    }

    public let currency: String
    public let today: String
    public let period: String
    public let includePension: Bool
    public let isEmpty: Bool
    public let todayByClass: [String: Double]
    public let series: [SeriesPoint]
    public let change: Change
    public let composition: [CompositionItem]
    public let monthLabel: String
    public let monthPace: MonthPace
    public let voice: [VoiceLine]
    public let investments: Investments?
    public let pension: Pension?
    public let debts: Debts?
    public let renewalAlerts: [RenewalAlert]
}

public struct OverviewAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/overview?period=&includePension=&today=` — `today` is the device's local day (`YYYY-MM-DD`).
    public func view(period: OverviewPeriod, includePension: Bool, today: String) async throws -> OverviewView {
        try await client.get("api/overview", query: OverviewAPI.query(period: period, includePension: includePension, today: today))
    }

    public static func query(period: OverviewPeriod, includePension: Bool, today: String) -> [String: String] {
        ["period": period.rawValue, "includePension": includePension ? "1" : "0", "today": today]
    }
}
