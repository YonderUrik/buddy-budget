import Foundation

// «Dall'ultima visita» (SHELL-058…059, web #457; spec: api/endpoints/welcome.md). Same names on Android (`WelcomeApi`).

/// One counted item: `movements`, `price_alerts`, `price_rises` (happened) or `to_decide`, `subscriptions`, `import_review` (waiting).
public struct WelcomeItem: Decodable, Equatable, Sendable {
    public let kind: String
    public let count: Int
    public let jobId: String?

    public init(kind: String, count: Int, jobId: String? = nil) {
        self.kind = kind
        self.count = count
        self.jobId = jobId
    }
}

public struct WelcomeSummary: Decodable, Equatable, Sendable {
    public let since: String
    public let happened: [WelcomeItem]
    public let waiting: [WelcomeItem]

    public init(since: String, happened: [WelcomeItem] = [], waiting: [WelcomeItem] = []) {
        self.since = since
        self.happened = happened
        self.waiting = waiting
    }
}

/// `GET /api/welcome`: nil when there is nothing to say (first visit, already shown in this visit, nothing new).
public struct WelcomeResponse: Decodable, Equatable, Sendable {
    public let summary: WelcomeSummary?
}

public struct VisitResult: Decodable, Equatable, Sendable {
    public let newVisit: Bool
}

public struct WelcomeAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// SHELL-059: records the visit and returns the summary.
    public func summary() async throws -> WelcomeResponse {
        try await client.get("api/welcome")
    }

    /// SHELL-059: the toast appeared; not again until the next visit, on any device (best effort).
    public func markShown() async throws {
        struct Body: Encodable { let shown = true }
        try await client.sendNoContent("api/welcome", method: "PATCH", body: Body())
    }

    /// SHELL-058: heartbeat of the open app.
    public func heartbeat() async throws -> VisitResult {
        try await client.post("api/visits", body: EmptyBody())
    }
}
