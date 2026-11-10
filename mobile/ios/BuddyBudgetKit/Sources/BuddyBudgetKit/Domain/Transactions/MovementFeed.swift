import Foundation

/// The Movimenti feed over the paged API (TX-018/019): pages are appended in server order (date desc, id desc),
/// duplicates dropped, and grouped by day with `MovementList.groupByDay`. While more pages exist the last day may
/// be incomplete, so it is held back until the next page arrives (its total would otherwise be wrong).
public struct MovementFeed: Equatable, Sendable {
    public private(set) var items: [Movement] = []
    public private(set) var nextCursor: String?
    public private(set) var loadedFirstPage = false

    public init() {}

    public var hasMore: Bool { nextCursor != nil }
    public var isEmpty: Bool { items.isEmpty }

    public mutating func reset(with page: MovementPage) {
        items = []
        nextCursor = nil
        loadedFirstPage = true
        append(page)
    }

    public mutating func append(_ page: MovementPage) {
        var seen = Set(items.map(\.id))
        for item in page.items where !seen.contains(item.id) {
            items.append(item)
            seen.insert(item.id)
        }
        nextCursor = page.nextCursor
    }

    public mutating func replace(_ movement: Movement) {
        if let i = items.firstIndex(where: { $0.id == movement.id }) { items[i] = movement }
    }

    public mutating func remove(id: String) {
        items.removeAll { $0.id == id }
    }

    public mutating func insert(_ movement: Movement, at index: Int) {
        items.insert(movement, at: min(max(0, index), items.count))
    }

    public func index(of id: String) -> Int? { items.firstIndex { $0.id == id } }

    /// Day groups to render. With more pages, the trailing day is hidden unless it is the only one.
    public func groups(today: CalendarDate, locale: BBLocale) -> [MovementDayGroup<Movement>] {
        let all = MovementList.groupByDay(items, today: today, locale: locale)
        guard hasMore, all.count > 1 else { return all }
        return Array(all.dropLast())
    }
}
