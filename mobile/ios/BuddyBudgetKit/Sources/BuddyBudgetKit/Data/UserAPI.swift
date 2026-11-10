import Foundation

// Account, preferences and lifecycle (spec: api/endpoints/user.md). Same names on Android (`UserApi`).

public struct UserSettings: Decodable, Equatable, Sendable {
    public let name: String
    public let email: String
    public let image: String?
    public let productCountry: String
    public let language: String
    public let currency: String
    public let homePage: String
    public let hideAmounts: Bool
    public let legalAcceptedAt: String?
    public let legalAcceptedVersion: String?
    public let createdAt: String
    public let googleLinked: Bool
    public let recentLoginUntil: String
}

/// `PATCH /api/user/settings` (strict, at least one field). Nil fields are omitted.
public struct UserSettingsPatch: Encodable, Equatable, Sendable {
    public var name: String?
    public var productCountry: String?
    public var language: String?
    public var currency: String?
    public var hideAmounts: Bool?
    public var homePage: String?

    public init(name: String? = nil, productCountry: String? = nil, language: String? = nil, currency: String? = nil,
                hideAmounts: Bool? = nil, homePage: String? = nil) {
        self.name = name
        self.productCountry = productCountry
        self.language = language
        self.currency = currency
        self.hideAmounts = hideAmounts
        self.homePage = homePage
    }
}

public enum DigestFrequency: String, Codable, CaseIterable, Sendable {
    case settimanale, mensile
}

public struct NotificationPreferences: Codable, Equatable, Sendable {
    public var digestEnabled: Bool
    public var digestFrequency: DigestFrequency
    public var budgetAlertsEnabled: Bool
    public var deadlineAlertsEnabled: Bool
    public var goalAlertsEnabled: Bool

    /// Defaults: everything off, monthly digest (AUTH-036, SET-023).
    public static let defaults = NotificationPreferences(digestEnabled: false, digestFrequency: .mensile,
                                                         budgetAlertsEnabled: false, deadlineAlertsEnabled: false,
                                                         goalAlertsEnabled: false)

    public init(digestEnabled: Bool, digestFrequency: DigestFrequency, budgetAlertsEnabled: Bool,
                deadlineAlertsEnabled: Bool, goalAlertsEnabled: Bool) {
        self.digestEnabled = digestEnabled
        self.digestFrequency = digestFrequency
        self.budgetAlertsEnabled = budgetAlertsEnabled
        self.deadlineAlertsEnabled = deadlineAlertsEnabled
        self.goalAlertsEnabled = goalAlertsEnabled
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        digestEnabled = try c.decodeIfPresent(Bool.self, forKey: .digestEnabled) ?? false
        digestFrequency = (try? c.decodeIfPresent(DigestFrequency.self, forKey: .digestFrequency)) ?? .mensile
        budgetAlertsEnabled = try c.decodeIfPresent(Bool.self, forKey: .budgetAlertsEnabled) ?? false
        deadlineAlertsEnabled = try c.decodeIfPresent(Bool.self, forKey: .deadlineAlertsEnabled) ?? false
        goalAlertsEnabled = try c.decodeIfPresent(Bool.self, forKey: .goalAlertsEnabled) ?? false
    }
}

/// Partial update of the notification preferences (`PATCH /api/user/notifications`).
public struct NotificationPreferencesPatch: Encodable, Equatable, Sendable {
    public var digestEnabled: Bool?
    public var digestFrequency: DigestFrequency?
    public var budgetAlertsEnabled: Bool?
    public var deadlineAlertsEnabled: Bool?
    public var goalAlertsEnabled: Bool?

    public init(digestEnabled: Bool? = nil, digestFrequency: DigestFrequency? = nil, budgetAlertsEnabled: Bool? = nil,
                deadlineAlertsEnabled: Bool? = nil, goalAlertsEnabled: Bool? = nil) {
        self.digestEnabled = digestEnabled
        self.digestFrequency = digestFrequency
        self.budgetAlertsEnabled = budgetAlertsEnabled
        self.deadlineAlertsEnabled = deadlineAlertsEnabled
        self.goalAlertsEnabled = goalAlertsEnabled
    }
}

public struct AiCategorizationState: Decodable, Equatable, Sendable {
    public let enabled: Bool
    public let instructions: String
    public let available: Bool
    public let autoApply: Bool

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
        instructions = try c.decodeIfPresent(String.self, forKey: .instructions) ?? ""
        available = try c.decodeIfPresent(Bool.self, forKey: .available) ?? false
        autoApply = try c.decodeIfPresent(Bool.self, forKey: .autoApply) ?? false
    }

    enum CodingKeys: String, CodingKey { case enabled, instructions, available, autoApply }
}

public struct AiCategorizationPatch: Encodable, Equatable, Sendable {
    public var enabled: Bool?
    public var instructions: String?
    public var autoApply: Bool?

    public init(enabled: Bool? = nil, instructions: String? = nil, autoApply: Bool? = nil) {
        self.enabled = enabled
        self.instructions = instructions
        self.autoApply = autoApply
    }
}

public struct UserSessionView: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let device: String
    public let browser: String
    public let os: String
    public let mobile: Bool
    public let createdAt: String
    public let lastActiveAt: String
    public let expiresAt: String
    public let current: Bool
}

public struct UserDataSummary: Decodable, Equatable, Sendable {
    public let accounts: Int
    public let bankConnections: Int
    public let transactions: Int
    public let categories: Int
    public let rules: Int
    public let budgets: Int
    public let investmentOperations: Int
    public let debts: Int
    public let pensionFunds: Int
    public let netWorthDays: Int

    public init(accounts: Int, bankConnections: Int, transactions: Int, categories: Int, rules: Int, budgets: Int,
                investmentOperations: Int, debts: Int, pensionFunds: Int, netWorthDays: Int) {
        self.accounts = accounts
        self.bankConnections = bankConnections
        self.transactions = transactions
        self.categories = categories
        self.rules = rules
        self.budgets = budgets
        self.investmentOperations = investmentOperations
        self.debts = debts
        self.pensionFunds = pensionFunds
        self.netWorthDays = netWorthDays
    }
}

/// Category choice sent with onboarding (`categorySetupSchema`).
public struct CategorySetupItem: Codable, Equatable, Sendable {
    public let key: String?
    public let name: String
    public let type: String
    public let enabled: Bool

    public init(key: String?, name: String, type: String, enabled: Bool) {
        self.key = key
        self.name = name
        self.type = type
        self.enabled = enabled
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(key, forKey: .key) // explicit null for user-added categories
        try c.encode(name, forKey: .name)
        try c.encode(type, forKey: .type)
        try c.encode(enabled, forKey: .enabled)
    }

    enum CodingKeys: String, CodingKey { case key, name, type, enabled }
}

/// `POST /api/user/onboarding` body (AUTH-039).
public struct OnboardingRequest: Encodable, Equatable, Sendable {
    public let currency: String
    public let productCountry: String
    public let language: String
    public let legal: LegalAcceptance
    public let notifications: NotificationPreferences
    public let categories: [CategorySetupItem]?
    public let aiCategorization: Bool?
    /// AUTH-058: the «Interessi» answer (possibly empty), already filtered to the country's options.
    public let focus: [String]

    public init(currency: String, productCountry: String, language: String, legal: LegalAcceptance,
                notifications: NotificationPreferences, categories: [CategorySetupItem]?, aiCategorization: Bool?,
                focus: [String] = []) {
        self.focus = focus
        self.currency = currency
        self.productCountry = productCountry
        self.language = language
        self.legal = legal
        self.notifications = notifications
        self.categories = categories
        self.aiCategorization = aiCategorization
    }
}

/// A downloaded export archive.
public struct DataExport: Sendable {
    public let data: Data
    public let fileName: String
}

public struct UserAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    private struct Confirmation: Encodable { let confirmation: String }
    private struct EmailConfirmation: Encodable { let email: String }
    struct DeactivateResponse: Decodable { let deletionScheduledAt: String }
    struct RevokedResponse: Decodable { let revoked: Int }

    public func settings() async throws -> UserSettings { try await client.get("api/user/settings") }

    public func updateSettings(_ patch: UserSettingsPatch) async throws {
        try await client.sendNoContent("api/user/settings", method: "PATCH", body: patch)
    }

    public func completeOnboarding(_ request: OnboardingRequest) async throws {
        try await client.sendNoContent("api/user/onboarding", method: "POST", body: request)
    }

    public func acceptLegal(_ acceptance: LegalAcceptance) async throws {
        try await client.sendNoContent("api/user/legal-acceptance", method: "POST", body: acceptance)
    }

    public func notifications() async throws -> NotificationPreferences { try await client.get("api/user/notifications") }

    public func updateNotifications(_ patch: NotificationPreferencesPatch) async throws -> NotificationPreferences {
        try await client.patch("api/user/notifications", body: patch)
    }

    public func sendNotificationExample() async throws {
        try await client.sendNoContent("api/user/notifications/test", method: "POST", body: EmptyBody())
    }

    public func aiCategorization() async throws -> AiCategorizationState { try await client.get("api/user/ai-categorization") }

    public func updateAiCategorization(_ patch: AiCategorizationPatch) async throws -> AiCategorizationState {
        try await client.patch("api/user/ai-categorization", body: patch)
    }

    public func sessions() async throws -> [UserSessionView] { try await client.get("api/user/sessions") }

    public func revokeSession(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        try await client.sendNoContent("api/user/sessions/\(escaped)", method: "DELETE")
    }

    @discardableResult
    public func revokeOtherSessions() async throws -> Int {
        let response: RevokedResponse = try await client.delete("api/user/sessions")
        return response.revoked
    }

    public func dataSummary() async throws -> UserDataSummary { try await client.get("api/user/data-summary") }

    /// `GET /api/user/export` (ZIP, recent login). File name from `Content-Disposition`, else the web's pattern.
    public func export(today: CalendarDate) async throws -> DataExport {
        let response = try await client.send("api/user/export", method: "GET", accept: "application/zip")
        let name = UserAPI.fileName(contentDisposition: response.header("Content-Disposition"))
            ?? "buddybudget-export-\(today.iso).zip"
        return DataExport(data: response.data, fileName: name)
    }

    public func reset(confirmation: String) async throws {
        try await client.sendNoContent("api/user/reset", method: "POST", body: Confirmation(confirmation: confirmation))
    }

    /// Returns `deletionScheduledAt` (ISO).
    public func deactivate() async throws -> String {
        let response: DeactivateResponse = try await client.post("api/user/deactivate", body: EmptyBody())
        return response.deletionScheduledAt
    }

    public func reactivate() async throws {
        try await client.sendNoContent("api/user/reactivate", method: "POST", body: EmptyBody())
    }

    public func deleteAccount(email: String) async throws {
        try await client.sendNoContent("api/user/account", method: "DELETE", body: EmailConfirmation(email: email))
    }

    /// `attachment; filename="buddybudget-export-2026-10-18.zip"` → the file name.
    public static func fileName(contentDisposition: String?) -> String? {
        guard let value = contentDisposition, let range = value.range(of: "filename=") else { return nil }
        let name = value[range.upperBound...].split(separator: ";").first.map(String.init)?
            .trimmingCharacters(in: CharacterSet(charactersIn: "\" "))
        return name?.isEmpty == false ? name : nil
    }
}

/// `GET /api/transactions/attention` — only `uncategorizedCount` is used by the shell (SHELL-016).
public struct AttentionCounts: Decodable, Equatable, Sendable {
    public let newCount: Int
    public let uncategorizedCount: Int
    public let totalCount: Int
}

public struct AttentionAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func counts() async throws -> AttentionCounts { try await client.get("api/transactions/attention") }
}
