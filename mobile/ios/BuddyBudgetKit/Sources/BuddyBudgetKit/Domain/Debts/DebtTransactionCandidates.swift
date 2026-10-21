import Foundation

/// Which filters were active when the user picked a transaction (`CandidateFilterUsage`).
public enum DebtCandidateFilterUsage: String, Sendable {
    case nessuno, testo, categoria, entrambi
}

/// Port of `lib/debts/transaction-candidates.ts` (picker of the transaction linked to an installment).
extension DebtCalc {
    /// Filters by text/category (AND, `filterTransactions`) and ranks by closeness to the installment: exact amount
    /// (within one cent) first, then by days from the due date; stable on ties.
    public static func rankInstallmentCandidates<T: MovementFields>(
        _ transactions: [T], filter: MovementFilter, dueDate: String, expectedAmount: Double
    ) -> [T] {
        func isExact(_ t: T) -> Bool { abs(abs(t.amount) - expectedAmount) < 0.01 }
        let filtered = MovementList.filterTransactions(transactions, filter: filter)
        let indexed = filtered.enumerated().map { (index: $0.offset, t: $0.element, exact: isExact($0.element),
                                                   distance: dayDistance($0.element.date, dueDate)) }
        return indexed.sorted { a, b in
            if a.exact != b.exact { return a.exact }
            let d = a.distance - b.distance
            // JS: NaN and 0 are falsy, so both fall through to the index.
            if !d.isNaN, d != 0 { return d < 0 }
            return a.index < b.index
        }.map(\.t)
    }

    public static func describeFilterUsage(_ filter: MovementFilter) -> DebtCandidateFilterUsage {
        let text = !JSNumber.trim(filter.searchText).isEmpty
        let category = filter.categoryId != nil
        if text && category { return .entrambi }
        if text { return .testo }
        if category { return .categoria }
        return .nessuno
    }

    /// `|Date.parse(a) − Date.parse(b)| / 86 400 000` for `YYYY-MM-DD` keys (UTC midnight); NaN if unparseable.
    static func dayDistance(_ a: String, _ b: String) -> Double {
        guard a.count == 10, b.count == 10, let x = CalendarDate(iso: a), let y = CalendarDate(iso: b) else { return .nan }
        return Double(abs(x.epochDay - y.epochDay))
    }
}
