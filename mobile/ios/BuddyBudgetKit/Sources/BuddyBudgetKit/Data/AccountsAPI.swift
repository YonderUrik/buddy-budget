import Foundation

// Accounts (spec: api/endpoints/accounts.md). Same names on Android (`AccountsApi`, `Account`, …).

/// `manuale`: kept by the user; `auto`: linked to a bank through GoCardless.
public enum AccountSource: String, Sendable {
    case manuale, auto
}

/// Tone of the status line under an account name (`AccountExtras.status.tone`).
public enum AccountStatusTone: String, Sendable {
    case ok, warning, progress, neutral
}

/// Localized status line computed by the server (`include=health`), e.g. «Aggiornato 3 ore fa», «Da riconnettere».
public struct AccountStatusLine: Equatable, Sendable {
    public let tone: AccountStatusTone
    public let label: String

    public init(tone: AccountStatusTone, label: String) {
        self.tone = tone
        self.label = label
    }
}

/// Bank-connection health of a linked account (`AccountExtras.health`): consent state and manual-sync availability.
public struct AccountHealth: Equatable, Sendable {
    public let connectionId: String
    public let institutionName: String
    public let state: ConnectionHealthState
    public let needsRenewal: Bool
    public let daysLeft: Int?
    public let consentExpiresAt: String?
    public let lastSyncedAt: String?
    public let syncing: Bool
    public let eligible: Bool
    public let nextEligibleAt: String?
    public let syncsRemainingToday: Int

    public init(connectionId: String, institutionName: String, state: ConnectionHealthState, needsRenewal: Bool,
                daysLeft: Int? = nil, consentExpiresAt: String? = nil, lastSyncedAt: String? = nil, syncing: Bool = false,
                eligible: Bool = false, nextEligibleAt: String? = nil, syncsRemainingToday: Int = 0) {
        self.connectionId = connectionId
        self.institutionName = institutionName
        self.state = state
        self.needsRenewal = needsRenewal
        self.daysLeft = daysLeft
        self.consentExpiresAt = consentExpiresAt
        self.lastSyncedAt = lastSyncedAt
        self.syncing = syncing
        self.eligible = eligible
        self.nextEligibleAt = nextEligibleAt
        self.syncsRemainingToday = syncsRemainingToday
    }
}

/// An account row (`Account & AccountExtras` with `include=trend,health`). `balance` arrives as a decimal string.
public struct Account: Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let balance: Double
    public let color: String
    public let icon: String
    public let source: AccountSource
    public let isDemo: Bool
    public let createdAt: String
    public let updatedAt: String
    /// Institution of a linked account; nil for manual ones (and linked ones without a connection).
    public let bankName: String?
    /// 31 end-of-day balances (oldest first), linked accounts only.
    public let trend: [Double]?
    public let health: AccountHealth?
    public let status: AccountStatusLine?
    /// The balance moves with the transactions (linked bank or file import, web #447); nil when the server omits it.
    public let followsTransactions: Bool?

    public var isLinked: Bool { source == .auto }

    public init(id: String, name: String, type: String, balance: Double, color: String = "slate", icon: String = "wallet",
                source: AccountSource = .manuale, isDemo: Bool = false, createdAt: String = "", updatedAt: String = "",
                bankName: String? = nil, trend: [Double]? = nil, health: AccountHealth? = nil, status: AccountStatusLine? = nil,
                followsTransactions: Bool? = nil) {
        self.id = id
        self.name = name
        self.type = type
        self.balance = balance
        self.color = color
        self.icon = icon
        self.source = source
        self.isDemo = isDemo
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.bankName = bankName
        self.trend = trend
        self.health = health
        self.status = status
        self.followsTransactions = followsTransactions
    }
}

extension Account: Decodable {
    enum CodingKeys: String, CodingKey {
        case id, name, type, balance, color, icon, source, isDemo, createdAt, updatedAt, bankName, trend, health, status, followsTransactions
    }

    struct StatusRaw: Decodable {
        let tone: String
        let label: String
    }

    struct HealthRaw: Decodable {
        let connectionId: String
        let institutionName: String
        let state: String
        let needsRenewal: Bool?
        let daysLeft: Int?
        let consentExpiresAt: String?
        let lastSyncedAt: String?
        let syncing: Bool?
        let eligible: Bool?
        let nextEligibleAt: String?
        let syncsRemainingToday: Int?
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? ""
        balance = try c.decodeMoney(.balance)
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "slate"
        icon = try c.decodeIfPresent(String.self, forKey: .icon) ?? "wallet"
        source = AccountSource(rawValue: try c.decodeIfPresent(String.self, forKey: .source) ?? "") ?? .manuale
        isDemo = try c.decodeIfPresent(Bool.self, forKey: .isDemo) ?? false
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
        bankName = try c.decodeIfPresent(String.self, forKey: .bankName)
        trend = try c.decodeIfPresent([MoneyValue].self, forKey: .trend)?.map(\.value)
        followsTransactions = try c.decodeIfPresent(Bool.self, forKey: .followsTransactions)
        health = try c.decodeIfPresent(HealthRaw.self, forKey: .health).map { h in
            AccountHealth(connectionId: h.connectionId, institutionName: h.institutionName,
                          state: ConnectionHealthState(rawValue: h.state) ?? .ok, needsRenewal: h.needsRenewal ?? false,
                          daysLeft: h.daysLeft, consentExpiresAt: h.consentExpiresAt, lastSyncedAt: h.lastSyncedAt,
                          syncing: h.syncing ?? false, eligible: h.eligible ?? false, nextEligibleAt: h.nextEligibleAt,
                          syncsRemainingToday: h.syncsRemainingToday ?? 0)
        }
        status = try c.decodeIfPresent(StatusRaw.self, forKey: .status).map {
            AccountStatusLine(tone: AccountStatusTone(rawValue: $0.tone) ?? .neutral, label: $0.label)
        }
    }
}

/// A JSON money value sent as a number or a decimal string ("1234.50").
struct MoneyValue: Decodable {
    let value: Double

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let number = try? c.decode(Double.self) {
            value = number
        } else {
            let text = try c.decode(String.self)
            guard let parsed = Double(text.trimmingCharacters(in: .whitespaces)) else {
                throw DecodingError.dataCorruptedError(in: c, debugDescription: "Not a money value: \(text)")
            }
            value = parsed
        }
    }
}

extension KeyedDecodingContainer {
    func decodeMoney(_ key: Key) throws -> Double { try decode(MoneyValue.self, forKey: key).value }
}

/// `POST /api/accounts` (ACC-030). `balance` is a JSON number.
public struct NewAccountRequest: Encodable, Equatable, Sendable {
    public let name: String
    public let type: String
    public let balance: Double
    public let color: String?
    public let icon: String?

    public init(name: String, type: String, balance: Double, color: String?, icon: String?) {
        self.name = name
        self.type = type
        self.balance = balance
        self.color = color
        self.icon = icon
    }
}

/// `PATCH /api/accounts/{id}`: only the set fields are sent (linked accounts must never send `type`/`balance`, ACC-035).
public struct AccountPatch: Encodable, Equatable, Sendable {
    public var name: String?
    public var type: String?
    public var balance: Double?
    public var color: String?
    public var icon: String?

    public init(name: String? = nil, type: String? = nil, balance: Double? = nil, color: String? = nil, icon: String? = nil) {
        self.name = name
        self.type = type
        self.balance = balance
        self.color = color
        self.icon = icon
    }
}

public struct AccountsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/accounts?include=trend,health&today=<device day>` (ACC-001…004).
    public func list(today: CalendarDate) async throws -> [Account] {
        try await client.get("api/accounts", query: ["include": "trend,health", "today": today.iso])
    }

    public func create(_ request: NewAccountRequest) async throws -> Account {
        try await client.post("api/accounts", body: request)
    }

    public func update(id: String, _ patch: AccountPatch) async throws -> Account {
        try await client.patch("api/accounts/\(id)", body: patch)
    }

    /// Deletes a manual account or unlinks a bank one, with all its movements (ACC-041).
    public func delete(id: String) async throws {
        try await client.sendNoContent("api/accounts/\(id)", method: "DELETE")
    }
}
