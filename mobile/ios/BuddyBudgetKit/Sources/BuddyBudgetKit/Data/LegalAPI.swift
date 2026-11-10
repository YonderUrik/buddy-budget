import Foundation

/// `GET /api/legal` (public): current legal version, clauses approved specifically, document links
/// (spec: api/endpoints/legal.md). Same shape as `LegalMeta` on Android.
public struct LegalMeta: Decodable, Equatable, Sendable {
    public struct Document: Decodable, Equatable, Sendable {
        public let id: String
        public let label: String
        public let url: String
    }

    public let version: String
    public let language: String
    public let specificClauseSections: [String]
    public let documents: [Document]
    public let privacyEmail: String

    public func document(_ id: String) -> Document? { documents.first { $0.id == id } }
}

public struct LegalAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func get(language: String) async throws -> LegalMeta {
        try await client.get("api/legal", query: ["language": language])
    }
}

/// The three declarations of onboarding and of the re-acceptance screen (`legalAcceptanceSchema`).
public struct LegalAcceptance: Codable, Equatable, Sendable {
    public let version: String
    public let ageConfirmed: Bool
    public let termsAccepted: Bool
    public let specificClausesAccepted: Bool

    public init(version: String, ageConfirmed: Bool = true, termsAccepted: Bool = true, specificClausesAccepted: Bool = true) {
        self.version = version
        self.ageConfirmed = ageConfirmed
        self.termsAccepted = termsAccepted
        self.specificClausesAccepted = specificClausesAccepted
    }
}

/// UI state of the three checkboxes (AUTH-038, AUTH-044): the payload exists only when all are ticked.
public struct LegalConsent: Equatable, Sendable {
    public var ageConfirmed = false
    public var termsAccepted = false
    public var specificClausesAccepted = false

    public init() {}

    public var isComplete: Bool { ageConfirmed && termsAccepted && specificClausesAccepted }

    public func payload(version: String) -> LegalAcceptance? {
        isComplete ? LegalAcceptance(version: version) : nil
    }
}
