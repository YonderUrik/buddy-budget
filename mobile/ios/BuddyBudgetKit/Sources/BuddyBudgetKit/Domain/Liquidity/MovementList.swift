import Foundation

/// The fields of a movement (transaction) the list helpers read. Amounts are the API decimal strings parsed
/// with `Double(_:)` (= JS `Number(...)`).
public protocol MovementFields {
    /// `YYYY-MM-DD`.
    var date: String { get }
    var description: String { get }
    var note: String? { get }
    var categoryId: String? { get }
    var accountId: String? { get }
    var amount: Double { get }
    var excludedAmount: Double { get }
}

/// `TransactionFilter` of `lib/calc/expenses.ts`.
public struct MovementFilter: Hashable, Sendable {
    /// nil = every category; otherwise exact match.
    public var categoryId: String?
    public var searchText: String
    /// nil or empty = every account.
    public var accountId: String?
    public init(categoryId: String? = nil, searchText: String = "", accountId: String? = nil) {
        self.categoryId = categoryId
        self.searchText = searchText
        self.accountId = accountId
    }
}

/// One day of the movement list (`DayGroup` of `lib/liquidity/day-groups.ts`).
public struct MovementDayGroup<T> {
    /// `YYYY-MM-DD`.
    public let date: String
    /// "Oggi", "Ieri" (catalog keys) or the localized long weekday date.
    public let label: String
    /// Sum of the effective amounts of the day, JS `round2`.
    public let total: Double
    public let items: [T]
}

/// Movement list helpers: search/filter (`filterTransactions`) and day grouping (`groupByDay`).
public enum MovementList {
    /// `Number(amount) - Number(excludedAmount)`.
    public static func effectiveAmount(_ t: some MovementFields) -> Double { t.amount - t.excludedAmount }

    /// Exact category and/or account, then a case-insensitive substring of description or note, all in AND.
    public static func filterTransactions<T: MovementFields>(_ transactions: [T], filter: MovementFilter) -> [T] {
        let normalizedSearch = Array(JSNumber.trim(filter.searchText).lowercased().utf16)
        return transactions.filter { t in
            if let categoryId = filter.categoryId, t.categoryId != categoryId { return false }
            if let accountId = filter.accountId, !accountId.isEmpty, t.accountId != accountId { return false }
            if normalizedSearch.isEmpty { return true }
            let descriptionMatch = includes(Array(t.description.lowercased().utf16), normalizedSearch)
            let noteMatch = includes(Array((t.note ?? "").lowercased().utf16), normalizedSearch)
            return descriptionMatch || noteMatch
        }
    }

    /// Groups by date, most recent day first; inside a day the received order is kept.
    public static func groupByDay<T: MovementFields>(_ transactions: [T], today: CalendarDate, locale: BBLocale) -> [MovementDayGroup<T>] {
        var order: [String] = []
        var byDate: [String: [T]] = [:]
        for t in transactions {
            if byDate[t.date] == nil { order.append(t.date) }
            byDate[t.date, default: []].append(t)
        }
        // Keys are unique, so the code-unit descending sort needs no tie-breaker.
        let dates = order.sorted { $1.utf16.lexicographicallyPrecedes($0.utf16) }
        return dates.map { date in
            let items = byDate[date]!
            let label = CalendarDate(iso: date).map { BBFormat.dayLabel($0, today: today, locale: locale) } ?? date
            let sum = items.reduce(0.0) { $0 + effectiveAmount($1) }
            return MovementDayGroup(date: date, label: label, total: JSNumber.round(sum * 100) / 100, items: items)
        }
    }

    /// JS `String.prototype.includes` on UTF-16 code units.
    static func includes(_ haystack: [UInt16], _ needle: [UInt16]) -> Bool {
        if needle.isEmpty { return true }
        if needle.count > haystack.count { return false }
        for start in 0...(haystack.count - needle.count) where haystack[start] == needle[0] {
            if Array(haystack[start..<(start + needle.count)]) == needle { return true }
        }
        return false
    }
}
