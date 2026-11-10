import Foundation

/// MovementCategory rules shared by Movimenti, the add form and Categorizza (`lib/categorization/match-rule.ts`,
/// `lib/categories/picker.ts`). Same names on Android.
public enum CategoryRules {
    /// CAT-004 (`isDirectionCompatible`): fallback and transfers accept both signs, `entrata` only income,
    /// every other type only expenses.
    public static func isDirectionCompatible(_ type: CategoryType, isIncome: Bool, isFallback: Bool) -> Bool {
        if isFallback || type == .trasferimento { return true }
        return (type == .entrata) == isIncome
    }

    /// TX-028: categories offered when changing a movement's category: the fallback, every transfer category and
    /// the categories of the movement's direction (income → `entrata`; expense → any non-`entrata` type).
    public static func pickerCategories(_ categories: [MovementCategory], amount: Double) -> [MovementCategory] {
        let isIncome = amount > 0
        return categories.filter { c in
            if c.isFallback || c.type == .trasferimento { return true }
            return isIncome ? c.type == .entrata : c.type != .entrata
        }
    }

    /// Add form (web `availableCategories`): transfer categories plus the direction's categories.
    public static func addFormCategories(_ categories: [MovementCategory], isIncome: Bool) -> [MovementCategory] {
        categories.filter { c in
            c.type == .trasferimento || (isIncome ? c.type == .entrata : c.type != .entrata)
        }
    }

    /// Categorizza card sheet (CAT-059): non-fallback, same direction, without the proposed one.
    public static func categorizeCategories(_ categories: [MovementCategory], isIncome: Bool, excluding: String?) -> [MovementCategory] {
        categories.filter { c in
            !c.isFallback && c.id != excluding && c.type != .trasferimento
                && isDirectionCompatible(c.type, isIncome: isIncome, isFallback: false)
        }
    }

    /// TX-043 (`pickDefaultCategoryId`): the most used, else the first by name; never the fallback if an
    /// alternative exists. Empty list → nil.
    public static func pickDefaultCategoryId(_ categories: [MovementCategory], usage: [String: Int]) -> String? {
        let regular = categories.filter { !$0.isFallback }
        let pool = regular.isEmpty ? categories : regular
        return CategoryPicker.sortedByUsageThenName(pool, usage: usage).first?.id
    }
}

/// How a movement row looks (TX-023…026).
public enum MovementKind: Equatable, Sendable {
    /// MovementCategory type `trasferimento`: full amount in neutral colour + «Escluso dai conteggi»; no «Dividi».
    case transfer
    /// On the fallback category: highlighted row, category name in the negative colour.
    case uncategorized
    /// Part excluded with «Dividi»: effective amount + the full amount struck through.
    case split
    case plain

    public static func of(_ movement: Movement, category: MovementCategory?) -> MovementKind {
        if let category, category.isTransfer { return .transfer }
        if category?.isFallback ?? false { return .uncategorized }
        if movement.excludedAmount != 0 { return .split }
        return .plain
    }
}
