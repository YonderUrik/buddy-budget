import Foundation

// Subscriptions / Abbonamenti (spec: api/endpoints/subscriptions.md, features/06-subscriptions.md).
// Same names on Android (`SubscriptionsApi` and the models in `core/data/SubscriptionsApi.kt`).

// MARK: - Enums (unknown server values never break decoding)

/// What the user decided (`SubscriptionDecision` view type); `daConfermare` = detected without a saved choice.
public enum SubscriptionDecision: String, Sendable, CaseIterable {
    case daConfermare = "da-confermare"
    case confermato, escluso, terminato
    case unknown

    public init(raw: String) { self = SubscriptionDecision(rawValue: raw) ?? .unknown }
}

/// Stored status sent with POST/PATCH.
public enum SubscriptionStatus: String, Sendable, CaseIterable {
    case confermato, escluso, terminato

    public var decision: SubscriptionDecision { SubscriptionDecision(raw: rawValue) }
}

/// `fermo` = the expected charge was missed beyond the cadence's grace days.
public enum SubscriptionActivity: String, Sendable {
    case attivo, fermo, unknown

    public init(raw: String) { self = SubscriptionActivity(rawValue: raw) ?? .unknown }
}

public enum SubscriptionOrigin: String, Sendable {
    case rilevato, manuale, unknown

    public init(raw: String) { self = SubscriptionOrigin(rawValue: raw) ?? .unknown }
}

// MARK: - GET /api/subscriptions

public struct SubscriptionPriceChange: Equatable, Sendable {
    public let from: Double
    public let to: Double
    public let since: String

    public init(from: Double, to: Double, since: String) {
        self.from = from
        self.to = to
        self.since = since
    }
}

public struct SubscriptionCharge: Equatable, Sendable {
    public let id: String
    public let date: String
    public let amount: Double

    public init(id: String, date: String, amount: Double) {
        self.id = id
        self.date = date
        self.amount = amount
    }
}

/// Why detection proposes an item (explanation bullets of the detail).
public enum SubscriptionReason: Equatable, Sendable {
    case count(Int)
    case cadence(SubscriptionCadence, skipped: Bool)
    /// `constant` = `costante`, otherwise `variabile-lieve`.
    case amount(constant: Bool)
    case priceChange(from: Double, to: Double, since: String)
    case day(Int)
    case unknown
}

public struct SubscriptionItem: Equatable, Sendable {
    public var key: String
    /// Saved row id; nil until the user decides.
    public var id: String?
    public var name: String
    public var origin: SubscriptionOrigin
    public var decision: SubscriptionDecision
    public var activity: SubscriptionActivity
    /// Nil when unknown (also for a cadence value this app version does not know).
    public var cadence: SubscriptionCadence?
    public var amount: Double?
    public var monthly: Double?
    public var lastDate: String?
    public var nextDate: String?
    public var overdueDays: Int
    public var priceChange: SubscriptionPriceChange?
    public var charges: [SubscriptionCharge]
    public var reasons: [SubscriptionReason]
    public var confidence: Double?
    public var categoryId: String?
    public var logoPath: String?

    public init(key: String, id: String? = nil, name: String, origin: SubscriptionOrigin = .rilevato,
                decision: SubscriptionDecision = .daConfermare, activity: SubscriptionActivity = .attivo,
                cadence: SubscriptionCadence? = .mensile, amount: Double? = nil, monthly: Double? = nil,
                lastDate: String? = nil, nextDate: String? = nil, overdueDays: Int = 0,
                priceChange: SubscriptionPriceChange? = nil, charges: [SubscriptionCharge] = [],
                reasons: [SubscriptionReason] = [], confidence: Double? = nil, categoryId: String? = nil,
                logoPath: String? = nil) {
        self.key = key
        self.id = id
        self.name = name
        self.origin = origin
        self.decision = decision
        self.activity = activity
        self.cadence = cadence
        self.amount = amount
        self.monthly = monthly
        self.lastDate = lastDate
        self.nextDate = nextDate
        self.overdueDays = overdueDays
        self.priceChange = priceChange
        self.charges = charges
        self.reasons = reasons
        self.confidence = confidence
        self.categoryId = categoryId
        self.logoPath = logoPath
    }

    public var isManual: Bool { origin == .manuale }
}

public struct SubscriptionTotals: Equatable, Sendable {
    public var count: Int
    public var monthly: Double
    public var yearly: Double
    public var pendingCount: Int
    public var pendingMonthly: Double

    public init(count: Int = 0, monthly: Double = 0, yearly: Double = 0, pendingCount: Int = 0, pendingMonthly: Double = 0) {
        self.count = count
        self.monthly = monthly
        self.yearly = yearly
        self.pendingCount = pendingCount
        self.pendingMonthly = pendingMonthly
    }
}

public struct SubscriptionsResponse: Equatable, Sendable {
    public var items: [SubscriptionItem]
    public var totals: SubscriptionTotals
    public var currency: String
    /// Server date `YYYY-MM-DD`, used for every relative date (SUB-001).
    public var today: String

    public init(items: [SubscriptionItem], totals: SubscriptionTotals, currency: String, today: String) {
        self.items = items
        self.totals = totals
        self.currency = currency
        self.today = today
    }
}

/// An expense category for the subscription picker (SUB-025). Deliberately small and subscriptions-scoped: the full
/// categories API lives elsewhere.
public struct SubscriptionCategory: Equatable, Sendable, Decodable {
    public let id: String
    public let name: String
    public let type: String
    public let color: String?
    public let icon: String?

    public init(id: String, name: String, type: String, color: String? = nil, icon: String? = nil) {
        self.id = id
        self.name = name
        self.type = type
        self.color = color
        self.icon = icon
    }

    /// Income (`entrata`) and transfer (`trasferimento`) categories are not offered (SUB-025). Server order kept.
    public static func expenseOnly(_ categories: [SubscriptionCategory]) -> [SubscriptionCategory] {
        categories.filter { $0.type != "entrata" && $0.type != "trasferimento" }
    }
}

// MARK: - Writes

/// `POST /api/subscriptions` with `origin: "rilevato"`: a decision on a detected item (snapshot of what the user saw).
public struct SubscriptionDecisionInput: Equatable, Sendable {
    public var key: String
    public var status: SubscriptionStatus
    public var name: String
    public var amount: Double
    public var cadence: SubscriptionCadence
    public var categoryId: String?

    public init(key: String, status: SubscriptionStatus, name: String, amount: Double, cadence: SubscriptionCadence,
                categoryId: String?) {
        self.key = key
        self.status = status
        self.name = name
        self.amount = amount
        self.cadence = cadence
        self.categoryId = categoryId
    }

    public var json: [String: Any] {
        ["origin": "rilevato", "key": key, "status": status.rawValue, "name": name, "amount": jsonNumber(amount),
         "cadence": cadence.rawValue, "categoryId": categoryId.map { $0 as Any } ?? NSNull()]
    }
}

/// `POST /api/subscriptions` with `origin: "manuale"` (SUB-023).
public struct ManualSubscriptionInput: Equatable, Sendable {
    public var name: String
    public var amount: Double
    public var cadence: SubscriptionCadence
    public var nextDate: String
    public var categoryId: String?

    public init(name: String, amount: Double, cadence: SubscriptionCadence, nextDate: String, categoryId: String?) {
        self.name = name
        self.amount = amount
        self.cadence = cadence
        self.nextDate = nextDate
        self.categoryId = categoryId
    }

    public var json: [String: Any] {
        ["origin": "manuale", "name": name, "amount": jsonNumber(amount), "cadence": cadence.rawValue, "nextDate": nextDate,
         "categoryId": categoryId.map { $0 as Any } ?? NSNull()]
    }
}

/// `PATCH /api/subscriptions/{id}`: nil fields are omitted; `categoryId` is `.some(nil)` to clear it.
public struct SubscriptionPatch: Equatable, Sendable {
    public var status: SubscriptionStatus?
    public var name: String?
    public var amount: Double?
    public var cadence: SubscriptionCadence?
    public var nextDate: String?
    public var categoryId: String??

    public init(status: SubscriptionStatus? = nil, name: String? = nil, amount: Double? = nil,
                cadence: SubscriptionCadence? = nil, nextDate: String? = nil, categoryId: String?? = nil) {
        self.status = status
        self.name = name
        self.amount = amount
        self.cadence = cadence
        self.nextDate = nextDate
        self.categoryId = categoryId
    }

    public var json: [String: Any] {
        var out: [String: Any] = [:]
        if let status { out["status"] = status.rawValue }
        if let name { out["name"] = name }
        if let amount { out["amount"] = jsonNumber(amount) }
        if let cadence { out["cadence"] = cadence.rawValue }
        if let nextDate { out["nextDate"] = nextDate }
        if let categoryId { out["categoryId"] = categoryId.map { $0 as Any } ?? NSNull() }
        return out
    }
}

/// A Double written with its shortest representation (JSONSerialization would print 39.899999999999999).
private func jsonNumber(_ value: Double) -> Any { Decimal(string: String(value)).map { NSDecimalNumber(decimal: $0) } ?? value }

// MARK: - API

public struct SubscriptionsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/subscriptions`.
    public func list() async throws -> SubscriptionsResponse {
        let response = try await client.send("api/subscriptions", method: "GET")
        do {
            return try SubscriptionsResponse.decode(response.data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    /// Decision on a detected item (upsert by key, 200).
    public func decide(_ input: SubscriptionDecisionInput) async throws {
        _ = try await client.send("api/subscriptions", method: "POST", body: try Self.body(input.json))
    }

    /// Manual subscription (201; 409 when the name's key already exists).
    public func addManual(_ input: ManualSubscriptionInput) async throws {
        _ = try await client.send("api/subscriptions", method: "POST", body: try Self.body(input.json))
    }

    public func update(id: String, _ patch: SubscriptionPatch) async throws {
        _ = try await client.send("api/subscriptions/\(Self.escape(id))", method: "PATCH", body: try Self.body(patch.json))
    }

    /// Detected: removes the choice (back to «da confermare»). Manual: deletes the subscription.
    public func delete(id: String) async throws {
        _ = try await client.send("api/subscriptions/\(Self.escape(id))", method: "DELETE")
    }

    /// `GET /api/categories` reduced to the expense categories of the picker (SUB-025).
    public func expenseCategories() async throws -> [SubscriptionCategory] {
        let all: [SubscriptionCategory] = try await client.get("api/categories")
        return SubscriptionCategory.expenseOnly(all)
    }

    static func body(_ json: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }

    private static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}

// MARK: - Decoding (tolerant: money as number or string, unknown enum values, missing optionals)

extension SubscriptionsResponse {
    public static func decode(_ data: Data) throws -> SubscriptionsResponse {
        try JSONDecoder().decode(Wire.self, from: data).value
    }

    private struct Wire: Decodable {
        let value: SubscriptionsResponse

        enum Keys: String, CodingKey { case items, totals, currency, today }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            let items = try c.decodeIfPresent([WireItem].self, forKey: .items) ?? []
            let totals = try c.decodeIfPresent(WireTotals.self, forKey: .totals)?.value ?? SubscriptionTotals()
            value = SubscriptionsResponse(items: items.map(\.value), totals: totals,
                                          currency: try c.decodeIfPresent(String.self, forKey: .currency) ?? "EUR",
                                          today: try c.decode(String.self, forKey: .today))
        }
    }

    private struct WireTotals: Decodable {
        let value: SubscriptionTotals
        enum Keys: String, CodingKey { case count, monthly, yearly, pendingCount, pendingMonthly }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            value = SubscriptionTotals(count: Int(c.money(.count) ?? 0), monthly: c.money(.monthly) ?? 0,
                                       yearly: c.money(.yearly) ?? 0, pendingCount: Int(c.money(.pendingCount) ?? 0),
                                       pendingMonthly: c.money(.pendingMonthly) ?? 0)
        }
    }

    private struct WireCharge: Decodable {
        let value: SubscriptionCharge
        enum Keys: String, CodingKey { case id, date, amount }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            value = SubscriptionCharge(id: try c.decodeIfPresent(String.self, forKey: .id) ?? "",
                                       date: try c.decode(String.self, forKey: .date), amount: c.money(.amount) ?? 0)
        }
    }

    private struct WirePriceChange: Decodable {
        let value: SubscriptionPriceChange
        enum Keys: String, CodingKey { case from, to, since }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            value = SubscriptionPriceChange(from: c.money(.from) ?? 0, to: c.money(.to) ?? 0,
                                            since: try c.decode(String.self, forKey: .since))
        }
    }

    private struct WireReason: Decodable {
        let value: SubscriptionReason
        enum Keys: String, CodingKey { case kind, count, cadence, skipped, mode, from, to, since, day }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            let kind = (try? c.decode(String.self, forKey: .kind)) ?? ""
            switch kind {
            case "count":
                value = .count(Int(c.money(.count) ?? 0))
            case "cadence":
                if let cadence = (try? c.decode(String.self, forKey: .cadence)).flatMap(SubscriptionCadence.init(rawValue:)) {
                    value = .cadence(cadence, skipped: (try? c.decode(Bool.self, forKey: .skipped)) ?? false)
                } else {
                    value = .unknown
                }
            case "amount":
                value = .amount(constant: (try? c.decode(String.self, forKey: .mode)) == "costante")
            case "price-change":
                value = .priceChange(from: c.money(.from) ?? 0, to: c.money(.to) ?? 0,
                                     since: (try? c.decode(String.self, forKey: .since)) ?? "")
            case "day":
                value = .day(Int(c.money(.day) ?? 0))
            default:
                value = .unknown
            }
        }
    }

    private struct WireItem: Decodable {
        let value: SubscriptionItem
        enum Keys: String, CodingKey {
            case key, id, name, origin, decision, activity, cadence, amount, monthly, lastDate, nextDate, overdueDays,
                 priceChange, charges, reasons, confidence, categoryId, logoPath
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            let key = try c.decode(String.self, forKey: .key)
            value = SubscriptionItem(
                key: key,
                id: try c.decodeIfPresent(String.self, forKey: .id),
                name: try c.decodeIfPresent(String.self, forKey: .name) ?? key,
                origin: SubscriptionOrigin(raw: (try? c.decode(String.self, forKey: .origin)) ?? ""),
                decision: SubscriptionDecision(raw: (try? c.decode(String.self, forKey: .decision)) ?? ""),
                activity: SubscriptionActivity(raw: (try? c.decode(String.self, forKey: .activity)) ?? ""),
                cadence: (try? c.decodeIfPresent(String.self, forKey: .cadence)).flatMap { $0 }
                    .flatMap(SubscriptionCadence.init(rawValue:)),
                amount: c.money(.amount),
                monthly: c.money(.monthly),
                lastDate: try c.decodeIfPresent(String.self, forKey: .lastDate),
                nextDate: try c.decodeIfPresent(String.self, forKey: .nextDate),
                overdueDays: Int(c.money(.overdueDays) ?? 0),
                priceChange: try c.decodeIfPresent(WirePriceChange.self, forKey: .priceChange)?.value,
                charges: (try c.decodeIfPresent([WireCharge].self, forKey: .charges) ?? []).map(\.value),
                reasons: (try c.decodeIfPresent([WireReason].self, forKey: .reasons) ?? []).map(\.value),
                confidence: c.money(.confidence),
                categoryId: try c.decodeIfPresent(String.self, forKey: .categoryId),
                logoPath: try c.decodeIfPresent(String.self, forKey: .logoPath))
        }
    }
}

private extension KeyedDecodingContainer {
    /// A JSON number, or a numeric string (Drizzle numerics); nil when missing, null or not numeric.
    func money(_ key: Key) -> Double? {
        if let number = try? decodeIfPresent(Double.self, forKey: key) { return number }
        if let text = try? decodeIfPresent(String.self, forKey: key) { return JSNumber.parse(text) }
        return nil
    }
}
