import Foundation

// «Primi passi» and sample data (spec: api/endpoints/start.md) and «Novità» (api/endpoints/meta.md).
// Same names on Android (`StartApi`, `WhatsNewApi`).

/// `GET /api/start` (OV-033…048, web #444/#452).
public struct StartStatus: Decodable, Equatable, Sendable {
    public struct Steps: Decodable, Equatable, Sendable {
        public let conto: Bool
        public let `import`: Bool
        public let investimento: Bool
        public let debito: Bool
        public let pensione: Bool
        public let obiettivo: Bool

        public init(conto: Bool = false, import: Bool = false, investimento: Bool = false, debito: Bool = false,
                    pensione: Bool = false, obiettivo: Bool = false) {
            self.conto = conto
            self.import = `import`
            self.investimento = investimento
            self.debito = debito
            self.pensione = pensione
            self.obiettivo = obiettivo
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            conto = try c.decodeIfPresent(Bool.self, forKey: .conto) ?? false
            `import` = try c.decodeIfPresent(Bool.self, forKey: .import) ?? false
            investimento = try c.decodeIfPresent(Bool.self, forKey: .investimento) ?? false
            debito = try c.decodeIfPresent(Bool.self, forKey: .debito) ?? false
            pensione = try c.decodeIfPresent(Bool.self, forKey: .pensione) ?? false
            obiettivo = try c.decodeIfPresent(Bool.self, forKey: .obiettivo) ?? false
        }

        enum CodingKeys: String, CodingKey { case conto, `import`, investimento, debito, pensione, obiettivo }

        public func isDone(_ step: StartStepId) -> Bool {
            switch step {
            case .conto: conto
            case .import: self.import
            case .investimento: investimento
            case .debito: debito
            case .pensione: pensione
            case .obiettivo: obiettivo
            }
        }
    }

    public let steps: Steps
    /// The steps this user is asked for, in order (`startStepsFor`); empty from an older server → the default four.
    public let stepIds: [String]
    /// What the user chose to keep an eye on; nil = never chosen.
    public let focus: [String]?
    /// Steps skipped with «Non mi serve».
    public let skipped: [String]
    public let dismissed: Bool
    public let completed: Bool
    public let demoActive: Bool
    public let justCompleted: Bool?

    public init(steps: Steps, stepIds: [String] = [], focus: [String]? = nil, skipped: [String] = [], dismissed: Bool = false,
                completed: Bool = false, demoActive: Bool = false, justCompleted: Bool? = nil) {
        self.steps = steps
        self.stepIds = stepIds
        self.focus = focus
        self.skipped = skipped
        self.dismissed = dismissed
        self.completed = completed
        self.demoActive = demoActive
        self.justCompleted = justCompleted
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        steps = try c.decode(Steps.self, forKey: .steps)
        stepIds = try c.decodeIfPresent([String].self, forKey: .stepIds) ?? []
        focus = try c.decodeIfPresent([String].self, forKey: .focus)
        skipped = try c.decodeIfPresent([String].self, forKey: .skipped) ?? []
        dismissed = try c.decodeIfPresent(Bool.self, forKey: .dismissed) ?? false
        completed = try c.decodeIfPresent(Bool.self, forKey: .completed) ?? false
        demoActive = try c.decodeIfPresent(Bool.self, forKey: .demoActive) ?? false
        justCompleted = try c.decodeIfPresent(Bool.self, forKey: .justCompleted)
    }

    enum CodingKeys: String, CodingKey { case steps, stepIds, focus, skipped, dismissed, completed, demoActive, justCompleted }

    /// The steps asked, in order (default four when the server sent none).
    public var askedSteps: [StartStepId] {
        let asked = stepIds.compactMap(StartStepId.init(rawValue:))
        return asked.isEmpty ? StartStepId.defaults : asked
    }

    public var skippedSteps: [StartStepId] { skipped.compactMap(StartStepId.init(rawValue:)) }

    public func with(dismissed: Bool) -> StartStatus {
        StartStatus(steps: steps, stepIds: stepIds, focus: focus, skipped: skipped, dismissed: dismissed, completed: completed,
                    demoActive: demoActive, justCompleted: nil)
    }
}

/// `POST /api/start/demo` → `201 { accounts, transactions }`.
public struct DemoStartResult: Decodable, Equatable, Sendable {
    public let accounts: Int
    public let transactions: Int
}

public struct StartAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func status() async throws -> StartStatus {
        try await client.get("api/start")
    }

    /// OV-036: `PATCH /api/start {dismissed}` → 204.
    public func setDismissed(_ dismissed: Bool) async throws {
        struct Body: Encodable { let dismissed: Bool }
        try await client.sendNoContent("api/start", method: "PATCH", body: Body(dismissed: dismissed))
    }

    /// OV-046: `PATCH /api/start {step, skipped}` → 204 («Non mi serve» / «Rimetti»; never for `conto`).
    public func setSkipped(_ step: StartStepId, skipped: Bool) async throws {
        struct Body: Encodable { let step: String; let skipped: Bool }
        try await client.sendNoContent("api/start", method: "PATCH", body: Body(step: step.rawValue, skipped: skipped))
    }

    /// OV-047: `PATCH /api/start {focus}` → 204.
    public func setFocus(_ focus: [String]) async throws {
        struct Body: Encodable { let focus: [String] }
        try await client.sendNoContent("api/start", method: "PATCH", body: Body(focus: focus))
    }

    /// OV-039: creates the sample data (409 with a message when not allowed, OV-040).
    @discardableResult
    public func startDemo() async throws -> DemoStartResult {
        try decodeDemo(try await client.send("api/start/demo", method: "POST"))
    }

    /// OV-042: removes the sample data → 204.
    public func clearDemo() async throws {
        try await client.sendNoContent("api/start/demo", method: "DELETE")
    }

    private func decodeDemo(_ response: APIResponse) throws -> DemoStartResult {
        (try? JSONDecoder().decode(DemoStartResult.self, from: response.data)) ?? DemoStartResult(accounts: 0, transactions: 0)
    }
}

// MARK: - «Novità»

public struct WhatsNewEntry: Decodable, Equatable, Hashable, Sendable {
    public let id: String
    public let date: String
    public let title: String
    public let summary: String
    public let href: String
    public let ctaLabel: String

    public init(id: String, date: String, title: String, summary: String, href: String, ctaLabel: String) {
        self.id = id
        self.date = date
        self.title = title
        self.summary = summary
        self.href = href
        self.ctaLabel = ctaLabel
    }
}

/// `GET /api/whats-new` (SHELL-049): fresh entries for the user's country, newest first; `current` = newest not dismissed.
public struct WhatsNew: Decodable, Equatable, Sendable {
    public let maxAgeDays: Int
    public let entries: [WhatsNewEntry]
    public let current: WhatsNewEntry?
}

public struct WhatsNewAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `dismissed` = ids closed on this device (`bb:whats-new-dismissed`), at most 100 sent.
    public func get(dismissed: [String]) async throws -> WhatsNew {
        let ids = Array(dismissed.prefix(100))
        return try await client.get("api/whats-new", query: ids.isEmpty ? [:] : ["dismissed": ids.joined(separator: ",")])
    }
}
