import Foundation

public struct HealthStatus: Decodable, Equatable, Sendable {
    public let status: String
}

/// `GET /api/health` — used by the app shell to tell "offline" from "server down".
public struct HealthAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func check() async throws -> HealthStatus {
        try await client.get("api/health")
    }
}
