import Foundation

// Imports (14-imports, 07-investments §8–9): personal CSV/Excel jobs (`/api/personal-imports`, spec
// api/endpoints/personal-imports.md) and broker-file imports (`/api/investments/import*`, `/api/investments/statements`,
// spec api/endpoints/investments.md). Bearer requests without cookies pass the Origin check (auth.md R8).
// Same names on Android (`ImportsApi.kt`).

/// Failure of an import call with the server's (Italian) message when there is one.
public struct ImportAPIFailure: Error, Equatable, Sendable {
    public let message: String?
    public let status: Int?
    /// The server's `code` when it is not one of the shared ones (`already_imported`, IMP-062).
    public let code: String?

    /// IMP-062: the same file was already imported (409 `already_imported`): a notice, not a fault.
    public var alreadyImported: Bool { code == PersonalImportRules.alreadyImportedCode }

    /// From any thrown error: the server's `{ error }` text, else nil (callers fall back to a generic message).
    public init(_ error: Error) {
        if let api = error as? APIError {
            message = api.body?.message
            status = api.status
            if case .other(let raw) = api.body?.code { code = raw } else { code = nil }
        } else if let failure = error as? ImportAPIFailure {
            self = failure
            return
        } else {
            message = nil
            status = nil
            code = nil
        }
    }

    public init(message: String?, status: Int? = nil, code: String? = nil) {
        self.message = message
        self.status = status
        self.code = code
    }
}

public struct PersonalImportsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/personal-imports` (IMP-002).
    public func list() async throws -> PersonalImportListing {
        try await client.get("api/personal-imports")
    }

    /// `POST /api/personal-imports` → job id (IMP-023, IMP-049, INV-104).
    public func enqueue(csv: String, name: String, formatId: String? = nil, regenerate: Bool = false, brokerFallback: Bool = false,
                        correctionOf: String? = nil, feedback: String? = nil) async throws -> String {
        var body: [String: JSONNode] = [
            "csv": .string(csv), "name": .string(name), "consent": .bool(true),
            "consentVersion": .string(PersonalImportRules.consentVersion),
        ]
        if let formatId { body["formatId"] = .string(formatId) }
        if regenerate { body["regenerate"] = .bool(true) }
        if brokerFallback { body["brokerFallback"] = .bool(true) }
        if let correctionOf { body["correctionOf"] = .string(correctionOf) }
        if let feedback { body["feedback"] = .string(feedback) }
        let response = try await client.send("api/personal-imports", method: "POST", body: try Self.encode(.object(body)), timeout: 300)
        return (try InvestmentsAPI.decode(response.data) as JobId).id
    }

    /// `GET /api/personal-imports/{id}` (IMP-034).
    public func preview(_ id: String) async throws -> PersonalImportPreview {
        try await client.get("api/personal-imports/\(InvestmentsAPI.escape(id))")
    }

    /// `GET /api/personal-imports/{id}?correction=1` (IMP-050).
    public func correction(_ id: String) async throws -> PersonalImportCorrection {
        try await client.get("api/personal-imports/\(InvestmentsAPI.escape(id))", query: ["correction": "1"])
    }

    /// `GET /api/personal-imports/{id}?deletion=1` (INV-108).
    public func deletionSummary(_ id: String) async throws -> PersonalImportDeletion {
        try await client.get("api/personal-imports/\(InvestmentsAPI.escape(id))", query: ["deletion": "1"])
    }

    /// `POST /api/personal-imports/{id}` `{action}`: `import_skipping_errors`, `replace_import`, `discard_correction`
    /// (IMP-037, IMP-051, IMP-052).
    public func act(_ id: String, action: String) async throws {
        _ = try await client.send("api/personal-imports/\(InvestmentsAPI.escape(id))", method: "POST",
                                  body: try Self.encode(.object(["action": .string(action)])), timeout: 120)
    }

    /// `reanalyze` → the new job id (IMP-039).
    public func reanalyze(_ id: String) async throws -> String {
        let body: JSONNode = .object(["action": .string("reanalyze"), "consent": .bool(true),
                                      "consentVersion": .string(PersonalImportRules.consentVersion)])
        let response = try await client.send("api/personal-imports/\(InvestmentsAPI.escape(id))", method: "POST", body: try Self.encode(body))
        return (try InvestmentsAPI.decode(response.data) as JobId).id
    }

    /// `DELETE /api/personal-imports/{id}` `{token}` (INV-108).
    public func delete(_ id: String, token: String) async throws {
        _ = try await client.send("api/personal-imports/\(InvestmentsAPI.escape(id))", method: "DELETE",
                                  body: try Self.encode(.object(["token": .string(token)])), timeout: 120)
    }

    struct JobId: Decodable { let id: String }

    static func encode(_ node: JSONNode) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(node)
    }
}

public struct BrokerImportAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `POST /api/investments/import/parse` with the raw CSV (INV-096).
    public func parse(_ csv: String) async throws -> ActivityStatement {
        let response = try await client.send("api/investments/import/parse", method: "POST", body: Data(csv.utf8),
                                             contentType: "text/csv; charset=utf-8", timeout: 120)
        return try InvestmentsAPI.decode(response.data)
    }

    /// `POST /api/investments/import/resolve` (INV-099; slow: one provider search at a time).
    public func resolve(_ identities: [ImportIdentity]) async throws -> [String: ImportMatch] {
        let list: [JSONNode] = identities.map { i in
            var o: [String: JSONNode] = [
                "key": .string(i.key), "symbol": i.symbol.map(JSONNode.string) ?? .null, "isin": i.isin.map(JSONNode.string) ?? .null,
                "name": i.name.map(JSONNode.string) ?? .null, "currency": i.currency.map(JSONNode.string) ?? .null,
                "symbolIsYahoo": .bool(i.symbolIsYahoo),
            ]
            if let type = i.type { o["type"] = .string(type) }
            return .object(o)
        }
        let response = try await client.send("api/investments/import/resolve", method: "POST",
                                             body: try PersonalImportsAPI.encode(.object(["identities": .array(list)])), timeout: 150)
        let decoded: ResolveResponse = try InvestmentsAPI.decode(response.data)
        var out: [String: ImportMatch] = [:]
        for result in decoded.results { out[result.key] = result.match.value }
        return out
    }

    /// `POST /api/investments/import` (INV-100/101): 400/422 bodies with `rows` are results, not transport errors.
    public func run(_ request: RunImportRequest) async throws -> ImportRunResult {
        do {
            let response = try await client.send("api/investments/import", method: "POST", body: try PersonalImportsAPI.encode(request.json()),
                                                 timeout: 320)
            return try InvestmentsAPI.decode(response.data)
        } catch let APIError.http(body) where body.status == 400 || body.status == 422 {
            if let result = try? JSONDecoder().decode(ImportRunResult.self, from: body.data) { return result }
            throw APIError.http(body)
        }
    }

    /// `GET /api/investments/statements` (INV-106).
    public func statements() async throws -> [BrokerStatementRecord] {
        let response: StatementsResponse = try await client.get("api/investments/statements")
        return response.statements
    }

    /// `DELETE /api/investments/statements/{id}` `{confirmedIds}` (INV-107).
    public func deleteStatement(_ id: String, confirmedIds: [String]) async throws {
        _ = try await client.send("api/investments/statements/\(InvestmentsAPI.escape(id))", method: "DELETE",
                                  body: try PersonalImportsAPI.encode(.object(["confirmedIds": .array(confirmedIds.map(JSONNode.string))])),
                                  timeout: 120)
    }

    /// `GET /api/investments/import/reset` (INV-109).
    public func resetPreview() async throws -> InvestmentResetPreview {
        try await client.get("api/investments/import/reset")
    }

    /// `DELETE /api/investments/import/reset` (INV-109/110).
    public func reset(revision: String) async throws {
        _ = try await client.send("api/investments/import/reset", method: "DELETE",
                                  body: try PersonalImportsAPI.encode(.object(["revision": .string(revision),
                                                                               "confirmation": .string(ImportHistory.resetConfirmation)])),
                                  timeout: 120)
    }

    /// Portfolios for the DEGIRO destination (INV-097), from `GET /api/investments/overview?period=1mese`.
    public func portfolios() async throws -> [Portfolio] {
        let response: PortfoliosResponse = try await client.get("api/investments/overview", query: ["period": "1mese"])
        return response.portfolios
    }

    public struct Portfolio: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let name: String
    }

    struct PortfoliosResponse: Decodable { let portfolios: [Portfolio] }

    struct StatementsResponse: Decodable { let statements: [BrokerStatementRecord] }

    struct ResolveResponse: Decodable {
        struct Result: Decodable {
            let key: String
            let match: MatchDTO
        }

        let results: [Result]
    }

    struct MatchDTO: Decodable {
        let value: ImportMatch

        enum Keys: String, CodingKey { case kind, instrument, input, label, detail, type, confidence, reason }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            switch try c.decode(String.self, forKey: .kind) {
            case "known":
                value = .known(try c.decode(Instrument.self, forKey: .instrument))
            case "proposal":
                let input = try c.decode(JSONNode.self, forKey: .input)
                value = .proposal(input: input, label: try c.decode(String.self, forKey: .label),
                                  detail: try c.decodeIfPresent(String.self, forKey: .detail) ?? "",
                                  type: try c.decodeIfPresent(String.self, forKey: .type) ?? "etf",
                                  confidence: try c.decodeIfPresent(String.self, forKey: .confidence) ?? "exact",
                                  source: input["source"]?.string ?? "")
            default:
                value = .none(reason: try c.decodeIfPresent(String.self, forKey: .reason) ?? "not_found")
            }
        }
    }
}
