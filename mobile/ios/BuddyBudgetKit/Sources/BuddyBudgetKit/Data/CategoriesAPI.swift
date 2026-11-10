import Foundation

// Categories and categorization rules (spec: api/endpoints/categories.md, categorization-rules.md).
// Same names on Android (`CategoriesApi`, `CategorizationRulesApi`).

/// `CategoryType` verbatim, with an `unknown` fallback for legacy values (shown under «Altre»).
public enum CategoryType: String, Codable, CaseIterable, Sendable {
    case dovuta, voluta, futuro, saltuaria, entrata, trasferimento, unknown

    public init(from decoder: Decoder) throws {
        self = CategoryType(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }

    /// The four spending groups, in display order.
    public static let expenseGroups: [CategoryType] = [.dovuta, .voluta, .futuro, .saltuaria]
    /// The six types the user can pick (CAT-018), in display order.
    public static let selectable: [CategoryType] = [.dovuta, .voluta, .futuro, .saltuaria, .entrata, .trasferimento]

    public var isExpenseGroup: Bool { CategoryType.expenseGroups.contains(self) }

    /// Italian label (`CATEGORY_TYPE_LABELS`); translate through the catalog.
    public var label: String {
        switch self {
        case .dovuta: "Dovute"
        case .voluta: "Volute"
        case .futuro: "Te futuro"
        case .saltuaria: "Saltuarie"
        case .entrata: "Entrata"
        case .trasferimento: "Trasferimenti tra conti"
        case .unknown: "Altre"
        }
    }

    /// Short group description (`EXPENSE_GROUPS.shortDescription`); nil for non-expense types.
    public var groupDescription: String? {
        switch self {
        case .dovuta: "Necessarie per vivere: senza queste avresti problemi pratici o legali."
        case .voluta: "Migliorano la qualità della vita, ma potresti farne a meno."
        case .futuro: "Risparmio e investimenti come spesa prioritaria, non come avanzo."
        case .saltuaria: "Necessarie ma non mensili: tasse annuali, manutenzioni, regali."
        default: nil
        }
    }
}

public struct MovementCategory: Decodable, Equatable, Identifiable, Hashable, Sendable {
    public let id: String
    /// Display name, already localized by the server for default categories (G11): show as is.
    public let name: String
    public let defaultKey: String?
    public let type: CategoryType
    public let color: String
    public let icon: String
    public let description: String?
    public let isFallback: Bool
    public let createdAt: String

    public init(id: String, name: String, defaultKey: String? = nil, type: CategoryType, color: String = "slate",
                icon: String = "package", description: String? = nil, isFallback: Bool = false, createdAt: String = "") {
        self.id = id
        self.name = name
        self.defaultKey = defaultKey
        self.type = type
        self.color = color
        self.icon = icon
        self.description = description
        self.isFallback = isFallback
        self.createdAt = createdAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        defaultKey = try c.decodeIfPresent(String.self, forKey: .defaultKey)
        type = try c.decodeIfPresent(CategoryType.self, forKey: .type) ?? .unknown
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "slate"
        icon = try c.decodeIfPresent(String.self, forKey: .icon) ?? "package"
        description = try c.decodeIfPresent(String.self, forKey: .description)
        isFallback = try c.decodeIfPresent(Bool.self, forKey: .isFallback) ?? false
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    }

    enum CodingKeys: String, CodingKey { case id, name, defaultKey, type, color, icon, description, isFallback, createdAt }

    public var isTransfer: Bool { !isFallback && type == .trasferimento }

    public func with(name: String? = nil, type: CategoryType? = nil, color: String? = nil, icon: String? = nil,
                     description: String?? = nil) -> MovementCategory {
        MovementCategory(id: id, name: name ?? self.name, defaultKey: defaultKey, type: type ?? self.type, color: color ?? self.color,
                 icon: icon ?? self.icon, description: description ?? self.description, isFallback: isFallback, createdAt: createdAt)
    }
}

public struct CategoryCreateBody: Encodable, Equatable, Sendable {
    public let name: String
    public let type: CategoryType
    public init(name: String, type: CategoryType) {
        self.name = name
        self.type = type
    }
}

/// `PATCH /api/categories/{id}`; nil fields omitted, `description: ""` clears it.
public struct CategoryPatch: Encodable, Equatable, Sendable {
    public var name: String?
    public var type: CategoryType?
    public var color: String?
    public var icon: String?
    public var description: String?

    public init(name: String? = nil, type: CategoryType? = nil, color: String? = nil, icon: String? = nil, description: String? = nil) {
        self.name = name
        self.type = type
        self.color = color
        self.icon = icon
        self.description = description
    }
}

public struct CategoriesAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func list() async throws -> [MovementCategory] { try await client.get("api/categories") }

    /// Movements per category id in the last 365 days (CAT-008).
    public func usage() async throws -> [String: Int] { try await client.get("api/categories/usage") }

    public func create(_ body: CategoryCreateBody) async throws -> MovementCategory { try await client.post("api/categories", body: body) }

    public func update(id: String, _ patch: CategoryPatch) async throws -> MovementCategory {
        try await client.patch("api/categories/\(id)", body: patch)
    }

    public func delete(id: String) async throws { try await client.sendNoContent("api/categories/\(id)", method: "DELETE") }

    public func distributeColors() async throws {
        try await client.sendNoContent("api/categories/distribute-colors", method: "POST", body: EmptyBody())
    }
}

// MARK: - Rules

public enum RuleMatchType: String, Codable, CaseIterable, Sendable {
    /// Exact match on the normalized merchant key («Esatta»).
    case merchant
    /// Substring of the key («Contiene»).
    case contains

    public var label: String { self == .merchant ? "Esatta" : "Contiene" }
}

public struct CategorizationRule: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let matchType: RuleMatchType
    public let pattern: String
    public let categoryId: String
    public let splitPercentage: Double?
    /// `appresa` | `manuale`.
    public let source: String
    public let hitCount: Int
    public let categoryName: String?
    public let logoPath: String?

    public init(id: String, matchType: RuleMatchType, pattern: String, categoryId: String, splitPercentage: Double? = nil,
                source: String = "manuale", hitCount: Int = 0, categoryName: String? = nil, logoPath: String? = nil) {
        self.id = id
        self.matchType = matchType
        self.pattern = pattern
        self.categoryId = categoryId
        self.splitPercentage = splitPercentage
        self.source = source
        self.hitCount = hitCount
        self.categoryName = categoryName
        self.logoPath = logoPath
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        matchType = (try? c.decode(RuleMatchType.self, forKey: .matchType)) ?? .contains
        pattern = try c.decode(String.self, forKey: .pattern)
        categoryId = try c.decode(String.self, forKey: .categoryId)
        splitPercentage = try c.bbDecodeAmountIfPresent(.splitPercentage)
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? "manuale"
        hitCount = try c.decodeIfPresent(Int.self, forKey: .hitCount) ?? 0
        categoryName = try c.decodeIfPresent(String.self, forKey: .categoryName)
        logoPath = try c.decodeIfPresent(String.self, forKey: .logoPath)
    }

    enum CodingKeys: String, CodingKey { case id, matchType, pattern, categoryId, splitPercentage, source, hitCount, categoryName, logoPath }

    public var isLearned: Bool { source == "appresa" }
}

/// POST/PATCH response: the rule plus how many movements it categorized now and how many past ones it would change.
public struct RuleSaveResult: Decodable, Equatable, Sendable {
    public let id: String
    public let applied: Int
    public let pastMatches: Int

    public init(id: String, applied: Int, pastMatches: Int) {
        self.id = id
        self.applied = applied
        self.pastMatches = pastMatches
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        applied = try c.decodeIfPresent(Int.self, forKey: .applied) ?? 0
        pastMatches = try c.decodeIfPresent(Int.self, forKey: .pastMatches) ?? 0
    }

    enum CodingKeys: String, CodingKey { case id, applied, pastMatches }
}

public struct RuleCreateBody: Encodable, Equatable, Sendable {
    public let matchType: RuleMatchType
    public let pattern: String
    public let categoryId: String
    public let replaceExisting: Bool?

    public init(matchType: RuleMatchType, pattern: String, categoryId: String, replaceExisting: Bool? = nil) {
        self.matchType = matchType
        self.pattern = pattern
        self.categoryId = categoryId
        self.replaceExisting = replaceExisting
    }
}

public struct RulePatch: Encodable, Equatable, Sendable {
    public var matchType: RuleMatchType?
    public var pattern: String?
    public var categoryId: String?

    public init(matchType: RuleMatchType? = nil, pattern: String? = nil, categoryId: String? = nil) {
        self.matchType = matchType
        self.pattern = pattern
        self.categoryId = categoryId
    }
}

public struct CategorizationRulesAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func list() async throws -> [CategorizationRule] { try await client.get("api/categorization-rules") }

    public func create(_ body: RuleCreateBody) async throws -> RuleSaveResult { try await client.post("api/categorization-rules", body: body) }

    public func update(id: String, _ patch: RulePatch) async throws -> RuleSaveResult {
        try await client.patch("api/categorization-rules/\(id)", body: patch)
    }

    public func delete(id: String) async throws { try await client.sendNoContent("api/categorization-rules/\(id)", method: "DELETE") }
}

// MARK: - Budgets (CAT-099…101, web #432; api/endpoints/budgets.md)

/// A monthly budget of one category (`monthlyAmount` arrives as a decimal string).
public struct Budget: Decodable, Equatable, Sendable {
    public let id: String
    public let categoryId: String
    public let monthlyAmount: Double

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        categoryId = try c.decode(String.self, forKey: .categoryId)
        monthlyAmount = try c.bbDecodeAmount(.monthlyAmount)
    }

    enum CodingKeys: String, CodingKey { case id, categoryId, monthlyAmount }
}

public struct BudgetsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func list() async throws -> [Budget] {
        try await client.get("api/budgets")
    }

    /// `PUT /api/budgets/{categoryId}` (upsert).
    public func upsert(categoryId: String, monthlyAmount: Double) async throws -> Budget {
        struct Body: Encodable { let monthlyAmount: Double }
        return try await client.put("api/budgets/\(categoryId)", body: Body(monthlyAmount: monthlyAmount))
    }

    /// `DELETE /api/budgets/{categoryId}` → 204 (idempotent).
    public func remove(categoryId: String) async throws {
        try await client.sendNoContent("api/budgets/\(categoryId)", method: "DELETE")
    }
}
