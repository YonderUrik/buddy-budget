import Foundation

// Transactions, categorize and recategorize (spec: api/endpoints/transactions.md). Same names on Android (`TransactionsApi`).

// MARK: - Lenient money decoding

extension KeyedDecodingContainer {
    /// Money arrives as a decimal string (`"-42.90"`) or a JSON number (api/README.md); both decode to `Double`
    /// with JS `Number(...)` semantics. Missing or unparsable → `fallback`.
    func bbDecodeAmount(_ key: Key, fallback: Double = 0) throws -> Double {
        try bbDecodeAmountIfPresent(key) ?? fallback
    }

    func bbDecodeAmountIfPresent(_ key: Key) throws -> Double? {
        if let number = try? decodeIfPresent(Double.self, forKey: key) { return number }
        if let text = try? decodeIfPresent(String.self, forKey: key) { return JSNumber.parse(text) }
        return nil
    }
}

// MARK: - Movement

/// `categorySource`: who set the category. `nil` = legacy or still on the fallback.
public enum CategorySource: String, Codable, Sendable {
    case regola, storico, assistente, utente, banca, unknown

    public init(from decoder: Decoder) throws {
        self = CategorySource(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }

    /// The automatic origins (rule, past choices, assistant, bank category from an imported file — web #456).
    public var isAutomatic: Bool { self == .regola || self == .storico || self == .assistente || self == .banca }
}

/// `manuale` = entered by hand or imported from a file; `auto` = bank sync (read-only fields).
public enum TransactionOrigin: String, Codable, Sendable {
    case manuale, auto, unknown

    public init(from decoder: Decoder) throws {
        self = TransactionOrigin(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

/// A movement as listed by `GET /api/transactions` (`ListedTransaction`). Amounts are signed (expense < 0).
public struct Movement: Decodable, Equatable, Identifiable, Sendable, MovementFields {
    public let id: String
    public let accountId: String?
    public let categoryId: String?
    public let description: String
    public let rawDescription: String?
    public let note: String?
    public let amount: Double
    public let excludedAmount: Double
    public let categorySource: CategorySource?
    public let categoryConfidence: Double?
    /// `YYYY-MM-DD`.
    public let date: String
    public let source: TransactionOrigin
    public let logoPath: String?
    /// The bank's own category label read from an imported file (origin `banca`, web #456).
    public let bankCategory: String?
    /// Merchant category code from the bank (TX-069).
    public let merchantCategoryCode: String?
    /// ISO timestamp the movement was recorded (`Registrato il`, TX-069).
    public let createdAt: String?

    public init(id: String, accountId: String?, categoryId: String?, description: String, rawDescription: String? = nil,
                note: String? = nil, amount: Double, excludedAmount: Double = 0, categorySource: CategorySource? = nil,
                categoryConfidence: Double? = nil, date: String, source: TransactionOrigin = .manuale, logoPath: String? = nil,
                bankCategory: String? = nil, merchantCategoryCode: String? = nil, createdAt: String? = nil) {
        self.id = id
        self.accountId = accountId
        self.categoryId = categoryId
        self.description = description
        self.rawDescription = rawDescription
        self.note = note
        self.amount = amount
        self.excludedAmount = excludedAmount
        self.categorySource = categorySource
        self.categoryConfidence = categoryConfidence
        self.date = date
        self.source = source
        self.logoPath = logoPath
        self.bankCategory = bankCategory
        self.merchantCategoryCode = merchantCategoryCode
        self.createdAt = createdAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId)
        categoryId = try c.decodeIfPresent(String.self, forKey: .categoryId)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        rawDescription = try c.decodeIfPresent(String.self, forKey: .rawDescription)
        note = try c.decodeIfPresent(String.self, forKey: .note)
        amount = try c.bbDecodeAmount(.amount)
        excludedAmount = try c.bbDecodeAmount(.excludedAmount)
        categorySource = try c.decodeIfPresent(CategorySource.self, forKey: .categorySource)
        categoryConfidence = try c.bbDecodeAmountIfPresent(.categoryConfidence)
        date = try c.decode(String.self, forKey: .date)
        source = try c.decodeIfPresent(TransactionOrigin.self, forKey: .source) ?? .manuale
        logoPath = try c.decodeIfPresent(String.self, forKey: .logoPath)
        bankCategory = try c.decodeIfPresent(String.self, forKey: .bankCategory)
        merchantCategoryCode = try c.decodeIfPresent(String.self, forKey: .merchantCategoryCode)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }

    enum CodingKeys: String, CodingKey {
        case id, accountId, categoryId, description, rawDescription, note, amount, excludedAmount, categorySource,
             categoryConfidence, date, source, logoPath, bankCategory, merchantCategoryCode, createdAt
    }

    /// `amount − excludedAmount`: what counts in every total (TX-061).
    public var effectiveAmount: Double { JSNumber.round2(amount - excludedAmount) }
    public var isManual: Bool { source != .auto }

    /// Copy with a few fields replaced (optimistic updates).
    public func with(categoryId: String? = nil, excludedAmount: Double? = nil, note: String?? = nil,
                     categorySource: CategorySource?? = nil, description: String? = nil, amount: Double? = nil,
                     date: String? = nil) -> Movement {
        Movement(id: id, accountId: accountId, categoryId: categoryId ?? self.categoryId, description: description ?? self.description,
                    rawDescription: rawDescription, note: note ?? self.note, amount: amount ?? self.amount,
                    excludedAmount: excludedAmount ?? self.excludedAmount, categorySource: categorySource ?? self.categorySource,
                    categoryConfidence: categoryConfidence, date: date ?? self.date, source: source, logoPath: logoPath,
                    bankCategory: bankCategory, merchantCategoryCode: merchantCategoryCode, createdAt: createdAt)
    }

    /// The same movement with another logo (a PATCH response has none: keep the one already shown).
    public func with(logoPath: String?) -> Movement {
        Movement(id: id, accountId: accountId, categoryId: categoryId, description: description, rawDescription: rawDescription,
                 note: note, amount: amount, excludedAmount: excludedAmount, categorySource: categorySource,
                 categoryConfidence: categoryConfidence, date: date, source: source, logoPath: logoPath,
                 bankCategory: bankCategory, merchantCategoryCode: merchantCategoryCode, createdAt: createdAt)
    }
}

/// Paged response (`limit`/`cursor`).
public struct MovementPage: Decodable, Equatable, Sendable {
    public let items: [Movement]
    public let nextCursor: String?

    public init(items: [Movement], nextCursor: String?) {
        self.items = items
        self.nextCursor = nextCursor
    }
}

/// `type` filter of the feed (TX-015).
public enum MovementType: String, CaseIterable, Sendable {
    case tutte, uscita, entrata
}

/// The Movimenti filters (TX-013…017), sent to the paged endpoint. Filters combine with AND.
public struct TransactionQuery: Equatable, Sendable {
    public var type: MovementType = .tutte
    public var accountId: String?
    public var categoryId: String?
    public var search: String = ""
    public var uncategorized = false
    public var limit = 50
    /// First day (`YYYY-MM-DD`, inclusive); nil = all history.
    public var from: String?

    public init(type: MovementType = .tutte, accountId: String? = nil, categoryId: String? = nil, search: String = "",
                uncategorized: Bool = false, limit: Int = 50) {
        self.type = type
        self.accountId = accountId
        self.categoryId = categoryId
        self.search = search
        self.uncategorized = uncategorized
        self.limit = limit
    }

    /// True when any filter beyond the defaults is active (empty-state choice, TX-021/022).
    public var hasFilters: Bool {
        type != .tutte || accountId != nil || categoryId != nil || !JSNumber.trim(search).isEmpty || uncategorized
    }

    public func queryItems(cursor: String?) -> [String: String] {
        var q: [String: String] = ["limit": String(limit), "type": type.rawValue]
        if let accountId { q["accountId"] = accountId }
        if let categoryId { q["categoryId"] = categoryId }
        let trimmed = JSNumber.trim(search)
        if !trimmed.isEmpty { q["q"] = trimmed }
        if uncategorized { q["uncategorized"] = "1" }
        if let from { q["from"] = from }
        if let cursor { q["cursor"] = cursor }
        return q
    }
}

/// `POST /api/transactions` (TX-042…048). `amount` is the positive magnitude.
public struct CreateTransactionBody: Encodable, Equatable, Sendable {
    public let accountId: String
    public let description: String
    public let categoryId: String
    public let amount: Double
    public let direction: String
    public let date: String

    public init(accountId: String, description: String, categoryId: String, amount: Double, direction: String, date: String) {
        self.accountId = accountId
        self.description = description
        self.categoryId = categoryId
        self.amount = amount
        self.direction = direction
        self.date = date
    }
}

/// `PATCH /api/transactions/{id}`; nil fields are omitted. `note: ""` clears the note.
public struct TransactionPatch: Encodable, Equatable, Sendable {
    public var description: String?
    public var categoryId: String?
    public var amount: Double?
    public var date: String?
    public var excludedAmount: Double?
    public var note: String?

    public init(description: String? = nil, categoryId: String? = nil, amount: Double? = nil, date: String? = nil,
                excludedAmount: Double? = nil, note: String? = nil) {
        self.description = description
        self.categoryId = categoryId
        self.amount = amount
        self.date = date
        self.excludedAmount = excludedAmount
        self.note = note
    }
}

// MARK: - Categorize

public struct CategorizeSuggestion: Decodable, Equatable, Sendable {
    public struct History: Decodable, Equatable, Sendable {
        public let agreeing: Int
        public let total: Int
        public init(agreeing: Int, total: Int) {
            self.agreeing = agreeing
            self.total = total
        }
    }

    public let suggestedCategoryId: String
    public let source: CategorySource
    public let confidence: Double
    public let suggestedSplitPercentage: Double?
    public let history: History?
    public let rulePattern: String?

    public init(suggestedCategoryId: String, source: CategorySource, confidence: Double, suggestedSplitPercentage: Double? = nil,
                history: History? = nil, rulePattern: String? = nil) {
        self.suggestedCategoryId = suggestedCategoryId
        self.source = source
        self.confidence = confidence
        self.suggestedSplitPercentage = suggestedSplitPercentage
        self.history = history
        self.rulePattern = rulePattern
    }
}

/// Fallback movements of one merchant and direction (`SuggestionGroup`).
public struct SuggestionGroup: Decodable, Equatable, Identifiable, Sendable {
    public let groupKey: String
    public let merchantKey: String
    public let label: String
    public let transactionIds: [String]
    public let transactionDescriptions: [String]
    public let transactionDates: [String]
    public let transactionAmounts: [Double]
    public let totalAmount: Double
    public let suggestion: CategorizeSuggestion?
    public let hasDivergentSuggestions: Bool
    public let logoPath: String?

    public var id: String { groupKey }
    public var isIncome: Bool { groupKey.hasSuffix("::entrata") }

    public init(groupKey: String, merchantKey: String, label: String, transactionIds: [String], transactionDescriptions: [String],
                transactionDates: [String], transactionAmounts: [Double], totalAmount: Double, suggestion: CategorizeSuggestion?,
                hasDivergentSuggestions: Bool = false, logoPath: String? = nil) {
        self.groupKey = groupKey
        self.merchantKey = merchantKey
        self.label = label
        self.transactionIds = transactionIds
        self.transactionDescriptions = transactionDescriptions
        self.transactionDates = transactionDates
        self.transactionAmounts = transactionAmounts
        self.totalAmount = totalAmount
        self.suggestion = suggestion
        self.hasDivergentSuggestions = hasDivergentSuggestions
        self.logoPath = logoPath
    }
}

public struct CategorizeSuggestionsResponse: Decodable, Equatable, Sendable {
    public struct AutoApply: Decodable, Equatable, Sendable {
        public let enabled: Bool
        public let ready: Int
        public let readyKeys: [String]
    }

    public let groups: [SuggestionGroup]
    public let autoApply: AutoApply
}

public struct CategorizeAutoResult: Decodable, Equatable, Sendable {
    public let applied: Int
    public let groups: Int
}

/// One group of `POST /api/transactions/categorize-apply`.
public struct CategorizeApplyGroup: Encodable, Equatable, Sendable {
    public let transactionIds: [String]
    public let categoryId: String
    public let excludedPercentage: Double
    public let createRule: Bool
    public let merchantKey: String

    public init(transactionIds: [String], categoryId: String, excludedPercentage: Double, createRule: Bool, merchantKey: String) {
        self.transactionIds = transactionIds
        self.categoryId = categoryId
        self.excludedPercentage = excludedPercentage
        self.createRule = createRule
        self.merchantKey = merchantKey
    }
}

public struct CategorizeApplyResult: Decodable, Equatable, Sendable {
    public let applied: Int
    public let rulesCreated: Int
}

/// «Messe dall'app» group (merchant + direction + category + origin).
public struct AutoCategorizedGroup: Decodable, Equatable, Identifiable, Sendable {
    public let groupKey: String
    public let merchantKey: String
    public let label: String
    public let categoryId: String
    public let source: CategorySource
    public let confidence: Double?
    public let transactionIds: [String]
    public let transactionDescriptions: [String]
    public let transactionDates: [String]
    public let transactionAmounts: [Double]
    public let totalAmount: Double
    public let lastCategorizedAt: String
    public let logoPath: String?
    /// Label the bank wrote in the imported file, for origin `banca`.
    public let bankCategory: String?

    public var id: String { groupKey }
}

/// `GET /api/transactions/auto-categorized`: the last 30 days (web #456: a history, nothing to confirm).
public struct AutoCategorizedResponse: Decodable, Equatable, Sendable {
    public let groups: [AutoCategorizedGroup]
    public let total: Int
}

// MARK: - Movement detail (TX-064…073, web #455)

/// Where a movement came from (`TransactionOrigin` of `lib/transactions/detail.ts`).
public struct MovementOrigin: Decodable, Equatable, Sendable {
    public let kind: String
    public let institution: String?
    public let format: String?
    public let broker: String?

    public init(kind: String, institution: String? = nil, format: String? = nil, broker: String? = nil) {
        self.kind = kind
        self.institution = institution
        self.format = format
        self.broker = broker
    }
}

/// The rule that set the category, when it still points to the same category.
public struct DetailRule: Decodable, Equatable, Sendable {
    public let id: String
    public let matchType: String
    public let pattern: String

    public init(id: String, matchType: String, pattern: String) {
        self.id = id
        self.matchType = matchType
        self.pattern = pattern
    }
}

public struct MerchantMovement: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let date: String
    public let amount: Double

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        date = try c.decode(String.self, forKey: .date)
        amount = try c.bbDecodeAmount(.amount)
    }

    enum CodingKeys: String, CodingKey { case id, date, amount }
}

/// The same merchant over the last year.
public struct MerchantSummary: Decodable, Equatable, Sendable {
    public let count: Int
    public let total: Double
    public let recent: [MerchantMovement]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        total = try c.bbDecodeAmount(.total)
        recent = try c.decodeIfPresent([MerchantMovement].self, forKey: .recent) ?? []
    }

    enum CodingKeys: String, CodingKey { case count, total, recent }
}

/// `GET /api/transactions/{id}`.
public struct MovementDetail: Decodable, Equatable, Sendable {
    public struct Account: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
    }

    public var transaction: Movement
    public let account: Account?
    public let origin: MovementOrigin
    public let rule: DetailRule?
    public let merchant: MerchantSummary?

    /// The row a list already has, shown while the rest arrives.
    public init(placeholder: Movement) {
        transaction = placeholder
        account = nil
        origin = MovementOrigin(kind: "manuale")
        rule = nil
        merchant = nil
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        transaction = try c.decode(Movement.self, forKey: .transaction)
        account = try c.decodeIfPresent(Account.self, forKey: .account)
        origin = try c.decodeIfPresent(MovementOrigin.self, forKey: .origin) ?? MovementOrigin(kind: "manuale")
        rule = try c.decodeIfPresent(DetailRule.self, forKey: .rule)
        merchant = try c.decodeIfPresent(MerchantSummary.self, forKey: .merchant)
    }

    enum CodingKeys: String, CodingKey { case transaction, account, origin, rule, merchant }
}

/// `POST /api/transactions/{id}/ai-suggestion`: `ok` (with category and confidence), `disabled`, `no_key`, `blocked`, `limited`, `failed`.
public struct SingleSuggestion: Decodable, Equatable, Sendable {
    public let status: String
    public let categoryId: String?
    public let confidence: Double

    public init(status: String, categoryId: String? = nil, confidence: Double = 0) {
        self.status = status
        self.categoryId = categoryId
        self.confidence = confidence
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "failed"
        categoryId = try c.decodeIfPresent(String.self, forKey: .categoryId)
        confidence = try c.decodeIfPresent(Double.self, forKey: .confidence) ?? 0
    }

    enum CodingKeys: String, CodingKey { case status, categoryId, confidence }
}

public struct RecategorizeGroup: Decodable, Equatable, Identifiable, Sendable {
    public let key: String
    public let label: String
    public let fromCategoryId: String
    public let toCategoryId: String
    public let source: CategorySource
    public let confidence: Double?
    public let count: Int
    public let legacyCount: Int
    public let firstDate: String
    public let lastDate: String
    public let totalAmount: Double
    public let logoPath: String?

    public var id: String { key }
}

public struct RecategorizePreview: Decodable, Equatable, Sendable {
    public struct LastRun: Decodable, Equatable, Sendable {
        public let id: String
        public let changed: Int
        public let createdAt: String
    }

    public let groups: [RecategorizeGroup]
    public let changes: Int
    public let legacyChanges: Int
    public let autoApply: Bool
    public let lastRun: LastRun?
}

public struct RecategorizeBody: Encodable, Equatable, Sendable {
    public let scope: String
    public let includeLegacy: Bool?
    public let ruleId: String?
    public let groupKeys: [String]?

    public init(scope: String, includeLegacy: Bool? = nil, ruleId: String? = nil, groupKeys: [String]? = nil) {
        self.scope = scope
        self.includeLegacy = includeLegacy
        self.ruleId = ruleId
        self.groupKeys = groupKeys
    }
}

public struct RecategorizeResult: Decodable, Equatable, Sendable {
    public let runId: String?
    public let changed: Int
}

// MARK: - API

public struct TransactionsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    private struct Status: Decodable { let status: String }
    private struct Restored: Decodable { let restored: Int }
    private struct ApplyBody: Encodable { let groups: [CategorizeApplyGroup] }
    private struct UndoBody: Encodable { let runId: String }

    /// `GET /api/transactions?limit&cursor&…` (paged mode, TX-007 mobile).
    public func page(_ query: TransactionQuery, cursor: String? = nil) async throws -> MovementPage {
        try await client.get("api/transactions", query: query.queryItems(cursor: cursor))
    }

    public func create(_ body: CreateTransactionBody) async throws -> Movement {
        try await client.post("api/transactions", body: body)
    }

    public func update(id: String, _ patch: TransactionPatch) async throws -> Movement {
        try await client.patch("api/transactions/\(id)", body: patch)
    }

    public func delete(id: String) async throws {
        try await client.sendNoContent("api/transactions/\(id)", method: "DELETE")
    }

    /// TX-004: best effort, the caller ignores failures.
    public func markSeen() async throws {
        try await client.sendNoContent("api/transactions/attention/seen", method: "POST", body: EmptyBody())
    }

    public func suggestions() async throws -> CategorizeSuggestionsResponse {
        try await client.get("api/transactions/categorize-suggestions")
    }

    public func categorizeAuto() async throws -> CategorizeAutoResult {
        try await client.post("api/transactions/categorize-auto", body: EmptyBody())
    }

    public func categorizeApply(_ groups: [CategorizeApplyGroup]) async throws -> CategorizeApplyResult {
        try await client.post("api/transactions/categorize-apply", body: ApplyBody(groups: groups))
    }

    /// `started` | `disabled` | `no_key`.
    public func generateSuggestions() async throws -> String {
        let status: Status = try await client.post("api/transactions/categorize-suggestions/generate", body: EmptyBody())
        return status.status
    }

    public func autoCategorized() async throws -> AutoCategorizedResponse {
        try await client.get("api/transactions/auto-categorized")
    }

    /// TX-064: one movement with origin, account, rule and merchant summary; `APIError.http` 404 when it no longer exists.
    public func detail(id: String) async throws -> MovementDetail {
        try await client.get("api/transactions/\(id)")
    }

    /// TX-068: «Chiedi all'AI», writes nothing.
    public func aiSuggestion(id: String) async throws -> SingleSuggestion {
        try await client.post("api/transactions/\(id)/ai-suggestion", body: EmptyBody())
    }

    public func recategorizePreview(scope: String = "tutto", ruleId: String? = nil, legacy: Bool = true) async throws -> RecategorizePreview {
        var query: [String: String] = [:]
        if scope == "regola" {
            query["scope"] = "regola"
            if let ruleId { query["ruleId"] = ruleId }
        } else if legacy {
            query["legacy"] = "1"
        }
        return try await client.get("api/transactions/recategorize", query: query)
    }

    public func recategorize(_ body: RecategorizeBody) async throws -> RecategorizeResult {
        try await client.post("api/transactions/recategorize", body: body)
    }

    public func undoRecategorize(runId: String) async throws -> Int {
        let result: Restored = try await client.post("api/transactions/recategorize/undo", body: UndoBody(runId: runId))
        return result.restored
    }
}
