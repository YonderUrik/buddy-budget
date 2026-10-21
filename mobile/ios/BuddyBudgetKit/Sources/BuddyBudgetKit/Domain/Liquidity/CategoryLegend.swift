import Foundation

/// Expense group of a category, in donut order (`EXPENSE_GROUP_KEYS` + `daCategorizzare`).
public enum LegendGroup: String, CaseIterable, Sendable {
    case dovuta, voluta, futuro, saltuaria, daCategorizzare
    var order: Int { Self.allCases.firstIndex(of: self)! }
}

/// `CategoryAmount` of `lib/calc/expenses.ts`.
public struct LegendCategoryAmount: Hashable, Sendable {
    public var categoryId: String
    public var name: String
    public var group: LegendGroup
    public var amount: Double
    public var color: String
    public var icon: String
    public init(categoryId: String, name: String, group: LegendGroup, amount: Double, color: String, icon: String) {
        self.categoryId = categoryId
        self.name = name
        self.group = group
        self.amount = amount
        self.color = color
        self.icon = icon
    }
}

public struct LegendBudgetStats: Hashable, Sendable {
    /// spent / budget × 100; nil when the budget is 0.
    public let saturazionePct: Double?
    /// spent / total spent × 100; nil when the total is 0.
    public let quotaPct: Double?
}

public struct LegendEntry: Hashable, Sendable {
    public var category: LegendCategoryAmount
    public var budgetAmount: Double
    public var saturazionePct: Double?
    public var quotaPct: Double?
    public init(category: LegendCategoryAmount, budgetAmount: Double, saturazionePct: Double?, quotaPct: Double?) {
        self.category = category
        self.budgetAmount = budgetAmount
        self.saturazionePct = saturazionePct
        self.quotaPct = quotaPct
    }
}

public enum LegendSortCriterion: String, CaseIterable, Sendable {
    case percentuale, valore, budget, nome
    /// `LEGEND_SORT_DEFAULT_DIRECTION`.
    public var defaultDirection: LegendSortDirection { self == .nome ? .asc : .desc }
}

public enum LegendSortDirection: String, Sendable { case asc, desc }

/// Category legend and budget saturation (`components/domain/expenses/category-breakdown-donut.utils.ts`).
public enum CategoryLegend {
    public static func computeBudgetStats(amount: Double, budgetAmount: Double, totalSpeso: Double) -> LegendBudgetStats {
        LegendBudgetStats(saturazionePct: budgetAmount > 0 ? (amount / budgetAmount) * 100 : nil,
                          quotaPct: totalSpeso > 0 ? (amount / totalSpeso) * 100 : nil)
    }

    /// Donut slices: by group (Dovute → Volute → Te futuro → Saltuarie → Da categorizzare), then amount descending. Stable.
    public static func sortCategoryAmounts(_ amounts: [LegendCategoryAmount]) -> [LegendCategoryAmount] {
        stableSorted(amounts) { a, b in
            if a.group != b.group { return Double(a.group.order - b.group.order) }
            return b.amount - a.amount
        }
    }

    /// Legend rows by the chosen criterion; nil percentages always go last whatever the direction. Stable.
    public static func sortLegendEntries(_ entries: [LegendEntry], criterion: LegendSortCriterion,
                                         direction: LegendSortDirection) -> [LegendEntry] {
        stableSorted(entries) { a, b in
            switch criterion {
            case .percentuale: return compareNullable(a.quotaPct, b.quotaPct, direction)
            case .budget: return compareNullable(a.saturazionePct, b.saturazionePct, direction)
            case .valore: return direction == .desc ? b.category.amount - a.category.amount : a.category.amount - b.category.amount
            case .nome:
                return direction == .desc ? localeCompareIt(b.category.name, a.category.name)
                    : localeCompareIt(a.category.name, b.category.name)
            }
        }
    }

    static func compareNullable(_ a: Double?, _ b: Double?, _ direction: LegendSortDirection) -> Double {
        switch (a, b) {
        case (nil, nil): return 0
        case (nil, _): return 1
        case (_, nil): return -1
        case let (x?, y?): return direction == .desc ? y - x : x - y
        }
    }

    /// `a.localeCompare(b, "it")` (ICU collation, tertiary strength).
    static let italian = Locale(identifier: "it_IT")
    static func localeCompareIt(_ a: String, _ b: String) -> Double {
        switch a.compare(b, options: [], range: nil, locale: italian) {
        case .orderedAscending: return -1
        case .orderedSame: return 0
        case .orderedDescending: return 1
        }
    }

    /// JS `Array.prototype.sort` with a numeric comparator: stable (original index breaks ties).
    static func stableSorted<T>(_ items: [T], _ compare: (T, T) -> Double) -> [T] {
        items.enumerated().sorted { l, r in
            let c = compare(l.element, r.element)
            return c < 0 || (!(c > 0) && l.offset < r.offset)
        }.map(\.element)
    }
}
