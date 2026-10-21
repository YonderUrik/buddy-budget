import Foundation

// Background bank imports / syncs (spec: api/endpoints/sync-jobs.md). Same names on Android (`SyncJobsApi`, …).

public enum SyncJobKind: String, Sendable {
    case initialImport = "initial-import"
    case manualSync = "manual-sync"
}

public enum SyncJobStatus: String, Sendable {
    case running, done, failed
}

public enum SyncAccountPhase: String, Sendable {
    case queued, balance, fetching, saving, done, limited, expired, error

    /// `FINAL_PHASES`: the account will not change any more.
    public var isFinal: Bool { [.done, .limited, .expired, .error].contains(self) }
}

public struct SyncJobAccount: Decodable, Equatable, Sendable {
    public let accountId: String
    public let name: String
    public let phase: SyncAccountPhase
    public let total: Int?
    public let processed: Int
    public let inserted: Int
    public let categorized: Int
    public let uncategorized: Int
    /// `already-running` when another sync held the account's lock.
    public let errorReason: String?

    public init(accountId: String, name: String, phase: SyncAccountPhase, total: Int? = nil, processed: Int = 0,
                inserted: Int = 0, categorized: Int = 0, uncategorized: Int = 0, errorReason: String? = nil) {
        self.accountId = accountId
        self.name = name
        self.phase = phase
        self.total = total
        self.processed = processed
        self.inserted = inserted
        self.categorized = categorized
        self.uncategorized = uncategorized
        self.errorReason = errorReason
    }

    enum CodingKeys: String, CodingKey { case accountId, name, phase, total, processed, inserted, categorized, uncategorized, errorReason }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accountId = try c.decode(String.self, forKey: .accountId)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        phase = SyncAccountPhase(rawValue: try c.decodeIfPresent(String.self, forKey: .phase) ?? "") ?? .error
        total = try c.decodeIfPresent(Int.self, forKey: .total)
        processed = try c.decodeIfPresent(Int.self, forKey: .processed) ?? 0
        inserted = try c.decodeIfPresent(Int.self, forKey: .inserted) ?? 0
        categorized = try c.decodeIfPresent(Int.self, forKey: .categorized) ?? 0
        uncategorized = try c.decodeIfPresent(Int.self, forKey: .uncategorized) ?? 0
        errorReason = try c.decodeIfPresent(String.self, forKey: .errorReason)
    }
}

public struct SyncJob: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let kind: SyncJobKind
    public let status: SyncJobStatus
    public let startedAt: String
    public let updatedAt: String
    /// Running without a heartbeat for more than 60 s (evaluated by the server, ACC-048).
    public let interrupted: Bool
    public let accounts: [SyncJobAccount]

    public init(id: String, kind: SyncJobKind = .manualSync, status: SyncJobStatus, startedAt: String = "", updatedAt: String = "",
                interrupted: Bool = false, accounts: [SyncJobAccount]) {
        self.id = id
        self.kind = kind
        self.status = status
        self.startedAt = startedAt
        self.updatedAt = updatedAt
        self.interrupted = interrupted
        self.accounts = accounts
    }

    enum CodingKeys: String, CodingKey { case id, kind, status, startedAt, updatedAt, interrupted, accounts }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = SyncJobKind(rawValue: try c.decodeIfPresent(String.self, forKey: .kind) ?? "") ?? .manualSync
        status = SyncJobStatus(rawValue: try c.decodeIfPresent(String.self, forKey: .status) ?? "") ?? .running
        startedAt = try c.decodeIfPresent(String.self, forKey: .startedAt) ?? ""
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
        interrupted = try c.decodeIfPresent(Bool.self, forKey: .interrupted) ?? false
        accounts = try c.decodeIfPresent([SyncJobAccount].self, forKey: .accounts) ?? []
    }
}

public struct SyncJobsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// Non-dismissed jobs of the last 24 h, newest first.
    public func list() async throws -> [SyncJob] { try await client.get("api/sync-jobs") }

    /// ACC-049: hides the summary on every device.
    public func dismiss(id: String) async throws {
        try await client.sendNoContent("api/sync-jobs/\(id)/dismiss", method: "POST", body: EmptyBody())
    }
}
