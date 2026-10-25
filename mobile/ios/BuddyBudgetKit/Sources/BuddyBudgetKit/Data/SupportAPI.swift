import Foundation

// Help & support endpoints (api/endpoints/support.md, client-errors.md). Same names on Android (`SupportApi`,
// `ClientErrorsApi`).

/// Why sending a report failed: the server's message (validation, 429, 502) or none (network, unknown).
public struct ReportSendError: Error, Equatable, Sendable {
    /// Server text as returned (Italian source when the catalog has it; translate before showing).
    public let serverMessage: String?

    public init(serverMessage: String?) { self.serverMessage = serverMessage }

    /// SUP-015: the message shown above `Puoi anche scrivere a support@buddybudget.io.` (Italian source).
    public var message: String { serverMessage ?? Support.sendFailed }
}

public struct SupportAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    private struct Reply: Decodable { let reference: String? }

    /// SUP-013: `POST /api/support` → the `SUP-XXXXXX` reference. A 2xx without `reference` is a failure (open question 8).
    public func send(_ input: ReportInput) async throws(ReportSendError) -> String {
        do {
            let reply: Reply = try await client.post("api/support", body: input)
            guard let reference = reply.reference, !reference.isEmpty else { throw ReportSendError(serverMessage: nil) }
            return reference
        } catch let error as ReportSendError {
            throw error
        } catch let error as APIError {
            throw ReportSendError(serverMessage: error.body?.message)
        } catch {
            throw ReportSendError(serverMessage: nil)
        }
    }
}

public struct ClientErrorsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// SUP-024 / SUP-025: best effort and silent — every failure is swallowed.
    public func report(_ report: ClientErrorReport) async {
        _ = try? await client.send("api/client-errors", method: "POST", body: try? JSONEncoder().encode(report))
    }
}

/// Sends each distinct crash report once per app run (the web's boundary sends once per error), then stays silent.
public actor ClientErrorReporter {
    private let api: ClientErrorsAPI
    private var sent: Set<String> = []

    public init(api: ClientErrorsAPI) { self.api = api }

    /// Returns true when the report was sent (first time for this area/name/message).
    @discardableResult
    public func report(_ report: ClientErrorReport) async -> Bool {
        let key = "\(report.area.rawValue)|\(report.name ?? "")|\(report.message)"
        guard !sent.contains(key) else { return false }
        sent.insert(key)
        await api.report(report)
        return true
    }
}
