import Foundation

// «Il tuo quadro» modules in «Altro» (spec: api/endpoints/sidebar.md, features/00 SHELL-028…038).
// Same names on Android (`SidebarApi`).

/// `GET /api/sidebar/summary`.
public struct SidebarSummary: Decodable, Equatable, Sendable {
    public struct PensionPart: Decodable, Equatable, Sendable {
        @FlexibleDouble public var total: Double
        @FlexibleDoubleOrNil public var monthChange: Double?
    }

    public struct NetWorth: Decodable, Equatable, Sendable {
        @FlexibleDouble public var total: Double
        @FlexibleDoubleOrNil public var monthChange: Double?
        public let pension: PensionPart?
    }

    public struct Holding: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let label: String
        public let name: String
        @FlexibleDoubleOrNil public var value: Double?
        @FlexibleDoubleOrNil public var dayChangePct: Double?
        public let spark: [Double]
        public let triggeredAlerts: Int
    }

    public struct Portfolio: Decodable, Equatable, Sendable {
        @FlexibleDouble public var totalValue: Double
        @FlexibleDoubleOrNil public var dayChange: Double?
        @FlexibleDoubleOrNil public var dayChangePct: Double?
        @FlexibleDouble public var totalGain: Double
        @FlexibleDoubleOrNil public var totalGainPct: Double?
        public let holdings: [Holding]
    }

    public struct WatchItem: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let label: String
        public let name: String
        public let currency: String
        @FlexibleDoubleOrNil public var lastClose: Double?
        @FlexibleDoubleOrNil public var dayChangePct: Double?
        public let spark: [Double]
        public let triggeredAlerts: Int
    }

    public let currency: String
    public let netWorth: NetWorth?
    public let portfolio: Portfolio?
    public let watchlist: [WatchItem]
    public let triggeredAlerts: Int
}

/// `GET /api/sidebar/deadlines`.
public struct SidebarDeadlines: Decodable, Equatable, Sendable {
    public struct Item: Decodable, Equatable, Sendable {
        public let id: String
        public let kind: String
        public let label: String
        public let date: String
        @FlexibleDoubleOrNil public var amount: Double?
        public let overdue: Bool
        public let href: String
    }

    public let currency: String
    public let items: [Item]
}

/// `GET /api/sidebar/fire` (IT only; DE → 403).
public struct SidebarFire: Decodable, Equatable, Sendable {
    public let currency: String
    @FlexibleDouble public var wealth: Double
    @FlexibleDoubleOrNil public var target: Double?
    @FlexibleDoubleOrNil public var progress: Double?
    @FlexibleDoubleOrNil public var yearsToFire: Double?

    public init(currency: String, wealth: Double, target: Double?, progress: Double?, yearsToFire: Double?) {
        self.currency = currency
        self.wealth = wealth
        self.target = target
        self.progress = progress
        self.yearsToFire = yearsToFire
    }
}

public struct SidebarAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func summary() async throws -> SidebarSummary { try await client.get("api/sidebar/summary") }
    public func deadlines() async throws -> SidebarDeadlines { try await client.get("api/sidebar/deadlines") }
    public func fire() async throws -> SidebarFire { try await client.get("api/sidebar/fire") }
}
