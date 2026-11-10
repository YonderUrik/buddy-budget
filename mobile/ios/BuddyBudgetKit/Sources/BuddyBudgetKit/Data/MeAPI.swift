import Foundation

/// Gate the backend asks the app to show (`bootstrap.gate`, spec: api/endpoints/me.md). `nil` = app usable.
public enum AccountGate: String, Codable, Sendable {
    case accountDeactivated = "account_deactivated"
    case legalAcceptanceRequired = "legal_acceptance_required"
    case onboardingRequired = "onboarding_required"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = AccountGate(rawValue: raw) ?? .unknown
    }
}

/// `GET /api/me/bootstrap`: everything the app needs at launch to route the signed-in user. Same shape as
/// `MeBootstrap` on Android.
public struct MeBootstrap: Decodable, Equatable, Sendable {
    public struct User: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let email: String
        public let image: String?
    }

    public struct Profile: Decodable, Equatable, Sendable {
        public let productCountry: String
        public let language: String
        public let availableLanguages: [String]
        public let currency: String
        public let homePage: String
        public let hideAmounts: Bool
    }

    public struct Onboarding: Decodable, Equatable, Sendable {
        public let completed: Bool
    }

    public struct Legal: Decodable, Equatable, Sendable {
        public let currentVersion: String
        public let acceptedVersion: String?
        public let acceptedAt: String?
        public let needsAcceptance: Bool
    }

    public struct Account: Decodable, Equatable, Sendable {
        public let deactivated: Bool
        public let deletionScheduledAt: String?
        public let readOnlyDemo: Bool
    }

    public struct Features: Decodable, Equatable, Sendable {
        public let taxes: Bool
        public let pension: Bool
        public let retirement: Bool
        public let incomeForecasts: Bool
        public let inflation: Bool
    }

    /// `isCountryPathAvailable(country, path)` evaluated by the server: what to show and call.
    public struct Sections: Decodable, Equatable, Sendable {
        public let pension: Bool
        public let analytics: Bool
        public let goals: Bool
        public let investmentTaxes: Bool
        public let investmentIncome: Bool
        public let fire: Bool
        public let financialPlanning: Bool

        public init(pension: Bool = true, analytics: Bool = true, goals: Bool = true, investmentTaxes: Bool = true,
                    investmentIncome: Bool = true, fire: Bool = true, financialPlanning: Bool = true) {
            self.pension = pension
            self.analytics = analytics
            self.goals = goals
            self.investmentTaxes = investmentTaxes
            self.investmentIncome = investmentIncome
            self.fire = fire
            self.financialPlanning = financialPlanning
        }
    }

    public struct Capabilities: Decodable, Equatable, Sendable {
        public let features: Features
        public let sections: Sections
    }

    public struct Session: Decodable, Equatable, Sendable {
        public let createdAt: String
        public let expiresAt: String
        public let recentLoginUntil: String
    }

    public let user: User
    public let profile: Profile
    public let onboarding: Onboarding
    public let legal: Legal
    public let account: Account
    public let gate: AccountGate?
    public let capabilities: Capabilities
    public let session: Session
}

public struct MeAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func bootstrap() async throws -> MeBootstrap {
        try await client.get("api/me/bootstrap")
    }
}
