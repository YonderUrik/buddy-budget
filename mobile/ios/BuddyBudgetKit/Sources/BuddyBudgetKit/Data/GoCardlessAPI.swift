import Foundation

// Bank linking and manual sync through GoCardless (spec: api/endpoints/gocardless.md, native flow R6).
// Same names on Android (`GoCardlessApi`, …).

/// Why a new bank cannot be linked (`GET /api/gocardless/capacity`).
public enum BankCapacityReason: String, Sendable {
    case userLimit = "user_limit"
    case userAttempts = "user_attempts"
    case globalLimit = "global_limit"
    case providerLimit = "provider_limit"
}

public struct BankCapacity: Decodable, Equatable, Sendable {
    public let canConnectNew: Bool
    public let reason: BankCapacityReason?
    public let renewableInstitutionIds: [String]

    public init(canConnectNew: Bool, reason: BankCapacityReason?, renewableInstitutionIds: [String] = []) {
        self.canConnectNew = canConnectNew
        self.reason = reason
        self.renewableInstitutionIds = renewableInstitutionIds
    }

    enum CodingKeys: String, CodingKey { case canConnectNew, reason, renewableInstitutionIds }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        canConnectNew = try c.decodeIfPresent(Bool.self, forKey: .canConnectNew) ?? false
        reason = (try c.decodeIfPresent(String.self, forKey: .reason)).flatMap(BankCapacityReason.init(rawValue:))
        renewableInstitutionIds = try c.decodeIfPresent([String].self, forKey: .renewableInstitutionIds) ?? []
    }
}

/// A bank of a country (`GET /api/gocardless/institutions`). `transactionTotalDays` is kept as sent (a number as string).
public struct Institution: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let transactionTotalDays: String
    public let logo: String?

    public init(id: String, name: String, transactionTotalDays: String, logo: String? = nil) {
        self.id = id
        self.name = name
        self.transactionTotalDays = transactionTotalDays
        self.logo = logo
    }

    enum CodingKeys: String, CodingKey {
        case id, name, logo
        case transactionTotalDays = "transaction_total_days"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        if let text = try? c.decodeIfPresent(String.self, forKey: .transactionTotalDays) {
            transactionTotalDays = text
        } else if let number = try? c.decodeIfPresent(Double.self, forKey: .transactionTotalDays) {
            transactionTotalDays = number.rounded() == number ? String(Int(number)) : String(number)
        } else {
            transactionTotalDays = ""
        }
        logo = try c.decodeIfPresent(String.self, forKey: .logo)
    }
}

/// `POST /api/gocardless/connections` answer: the consent link and the connection id (returned as `ref`).
public struct BankConnectionStart: Decodable, Equatable, Sendable {
    public let link: String
    public let connectionId: String?
}

/// A bank account the user shared during the consent.
public struct ExternalBankAccount: Decodable, Equatable, Identifiable, Sendable {
    public struct Details: Decodable, Equatable, Sendable {
        public let iban: String?
        public let name: String?
        public let product: String?

        public init(iban: String? = nil, name: String? = nil, product: String? = nil) {
            self.iban = iban
            self.name = name
            self.product = product
        }
    }

    public let externalAccountId: String
    public let details: Details
    public var id: String { externalAccountId }

    public init(externalAccountId: String, details: Details) {
        self.externalAccountId = externalAccountId
        self.details = details
    }
}

/// A linked account of the user that a shared bank account can be re-linked to (renewal).
public struct ExistingAutoAccount: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

/// `GET …/connections/{id}/accounts`, also embedded in the `…/complete` answer.
public struct ConnectionAccounts: Decodable, Equatable, Sendable {
    public let externalAccounts: [ExternalBankAccount]
    public let existingAutoAccounts: [ExistingAutoAccount]

    public init(externalAccounts: [ExternalBankAccount], existingAutoAccounts: [ExistingAutoAccount]) {
        self.externalAccounts = externalAccounts
        self.existingAutoAccounts = existingAutoAccounts
    }

    enum CodingKeys: String, CodingKey { case externalAccounts, existingAutoAccounts }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        externalAccounts = try c.decodeIfPresent([ExternalBankAccount].self, forKey: .externalAccounts) ?? []
        existingAutoAccounts = try c.decodeIfPresent([ExistingAutoAccount].self, forKey: .existingAutoAccounts) ?? []
    }
}

/// `POST …/connections/{id}/complete` (R6) → `linked` with the accounts to select.
public struct ConnectionCompletion: Decodable, Equatable, Sendable {
    public let connectionId: String
    public let status: String
    public let institutionName: String?
    public let accounts: ConnectionAccounts

    enum CodingKeys: String, CodingKey { case connectionId, status, institutionName }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        connectionId = try c.decodeIfPresent(String.self, forKey: .connectionId) ?? ""
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "linked"
        institutionName = try c.decodeIfPresent(String.self, forKey: .institutionName)
        accounts = try ConnectionAccounts(from: decoder)
    }
}

/// One line of `POST …/finalize` (ACC-026).
public struct FinalizeSelection: Encodable, Equatable, Sendable {
    public let externalAccountId: String
    public let name: String
    public let type: String
    public let mode: String
    public let existingAccountId: String?

    public init(externalAccountId: String, name: String, type: String, mode: String, existingAccountId: String? = nil) {
        self.externalAccountId = externalAccountId
        self.name = name
        self.type = type
        self.mode = mode
        self.existingAccountId = existingAccountId
    }
}

/// `{ jobId }` of a started import (201) or manual sync (202).
public struct SyncJobStarted: Decodable, Equatable, Sendable {
    public let jobId: String
}

public struct GoCardlessAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// Who completes the consent: the native return (`buddybudget://bank/return`) instead of the web callback.
    public static let nativeClient = "native"

    private struct StartBody: Encodable {
        let institutionId: String
        let institutionName: String
        let transactionTotalDays: Int
        let client: String
    }

    private struct FinalizeBody: Encodable { let selections: [FinalizeSelection] }

    public func capacity() async throws -> BankCapacity { try await client.get("api/gocardless/capacity") }

    public func institutions(country: String) async throws -> [Institution] {
        try await client.get("api/gocardless/institutions", query: ["country": country])
    }

    /// ACC-021: starts a native connection; open `link` in the auth browser session.
    public func startConnection(_ institution: Institution) async throws -> BankConnectionStart {
        let days = Int(JSNumber.parse(institution.transactionTotalDays) ?? 0)
        return try await client.post("api/gocardless/connections",
                                     body: StartBody(institutionId: institution.id, institutionName: institution.name,
                                                     transactionTotalDays: days, client: Self.nativeClient))
    }

    /// R6: checks the requisition after the browser came back and answers the accounts to select.
    public func complete(connectionId: String) async throws -> ConnectionCompletion {
        try await client.post("api/gocardless/connections/\(connectionId)/complete", body: EmptyBody())
    }

    public func connectionAccounts(connectionId: String) async throws -> ConnectionAccounts {
        try await client.get("api/gocardless/connections/\(connectionId)/accounts")
    }

    /// Not idempotent: never retried automatically.
    public func finalize(connectionId: String, selections: [FinalizeSelection]) async throws -> SyncJobStarted {
        try await client.post("api/gocardless/connections/\(connectionId)/finalize", body: FinalizeBody(selections: selections))
    }

    /// ACC-043: manual sync of one linked account (202 `{ jobId }`).
    public func syncAccount(id: String) async throws -> SyncJobStarted {
        try await client.post("api/gocardless/accounts/\(id)/sync", body: EmptyBody())
    }
}
