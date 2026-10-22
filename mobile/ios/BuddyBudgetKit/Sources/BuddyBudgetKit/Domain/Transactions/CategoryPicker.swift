import Foundation

/// One section of the category sheet / picker (`CategoryPickerSection`).
public struct CategoryPickerSection: Equatable, Sendable {
    /// `most-used`, `type-<type>`, `type-other`, `fallback`, `results`.
    public let key: String
    /// Italian label (translate through the catalog); nil = no header (search results, fallback).
    public let label: String?
    public let categories: [MovementCategory]
}

/// MovementCategory picker logic, ported 1:1 from `lib/categories/picker.ts` (CAT-090…092, TX-028).
public enum CategoryPicker {
    /// "Più usate" / «Per te» size in the sheet.
    public static let mostUsedLimit = 5
    /// Under this many categories the most-used section is not shown.
    public static let mostUsedMinTotal = 8

    /// Lower case, no accents, trimmed: "Caffè " → "caffe" (`normalizeForSearch`).
    public static func normalizeForSearch(_ value: String) -> String {
        JSNumber.trim(value.decomposedStringWithCanonicalMapping
            .unicodeScalars.filter { !(0x0300...0x036F).contains($0.value) }
            .map(String.init).joined().lowercased())
    }

    static func sortedByUsageThenName(_ categories: [MovementCategory], usage: [String: Int]) -> [MovementCategory] {
        CategoryLegend.stableSorted(categories) { a, b in
            let diff = Double((usage[b.id] ?? 0) - (usage[a.id] ?? 0))
            return diff != 0 ? diff : CategoryLegend.localeCompareIt(a.name, b.name)
        }
    }

    /// Relevance of a category for a query (lower = better), nil when it does not match (CAT-091).
    static func searchRank(_ category: MovementCategory, _ normalizedQuery: String) -> Int? {
        let name = normalizeForSearch(category.name)
        let terms = normalizedQuery.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        if terms.allSatisfy({ name.contains($0) }) {
            if name.hasPrefix(normalizedQuery) { return 0 }
            let words = name.split(whereSeparator: { !($0.isASCII && ($0.isLetter || $0.isNumber)) }).map(String.init)
            if terms.allSatisfy({ term in words.contains { $0.hasPrefix(term) } }) { return 1 }
            return 2
        }
        if category.isFallback { return nil }
        let group = category.type == .unknown ? "" : normalizeForSearch(category.type.label)
        if !group.isEmpty && group.hasPrefix(normalizedQuery) { return 3 }
        return nil
    }

    /// Sections to show (`buildCategoryPickerSections`). With a query: one unnamed section ranked by relevance,
    /// then usage, then name. Without: most-used (when ≥ 8 categories and some usage), one section per group in
    /// alphabetical order, unknown types under «Altre», the fallback last without a header.
    public static func sections(_ categories: [MovementCategory], usage: [String: Int], query: String,
                                mostUsedLimit: Int = CategoryPicker.mostUsedLimit) -> [CategoryPickerSection] {
        let normalizedQuery = normalizeForSearch(query)
        if !normalizedQuery.isEmpty {
            let ranked = categories.compactMap { c in searchRank(c, normalizedQuery).map { (c, $0) } }
            let sorted = CategoryLegend.stableSorted(ranked) { a, b in
                if a.1 != b.1 { return Double(a.1 - b.1) }
                let diff = Double((usage[b.0.id] ?? 0) - (usage[a.0.id] ?? 0))
                return diff != 0 ? diff : CategoryLegend.localeCompareIt(a.0.name, b.0.name)
            }.map(\.0)
            return sorted.isEmpty ? [] : [CategoryPickerSection(key: "results", label: nil, categories: sorted)]
        }
        var sections: [CategoryPickerSection] = []
        let regular = categories.filter { !$0.isFallback }
        if categories.count >= mostUsedMinTotal {
            let mostUsed = Array(sortedByUsageThenName(regular.filter { (usage[$0.id] ?? 0) > 0 }, usage: usage).prefix(mostUsedLimit))
            if !mostUsed.isEmpty { sections.append(CategoryPickerSection(key: "most-used", label: "Più usate", categories: mostUsed)) }
        }
        let alphabetical = CategoryLegend.stableSorted(regular) { CategoryLegend.localeCompareIt($0.name, $1.name) }
        let groupTypes: [CategoryType] = CategoryType.expenseGroups + [.entrata, .trasferimento]
        for type in groupTypes {
            let inGroup = alphabetical.filter { $0.type == type }
            if inGroup.isEmpty { continue }
            let label = type == .entrata ? "Entrate" : (type == .trasferimento ? "Esclusi da entrate e spese" : type.label)
            sections.append(CategoryPickerSection(key: "type-\(type.rawValue)", label: label, categories: inGroup))
        }
        let unknown = alphabetical.filter { !groupTypes.contains($0.type) }
        if !unknown.isEmpty { sections.append(CategoryPickerSection(key: "type-other", label: "Altre", categories: unknown)) }
        let fallback = categories.filter(\.isFallback)
        if !fallback.isEmpty { sections.append(CategoryPickerSection(key: "fallback", label: nil, categories: fallback)) }
        return sections
    }
}

/// One section of the Categorie board (`groupCategoriesByType`, CAT-006/007).
public struct CategoryBoardSection: Equatable, Sendable, Identifiable {
    /// `dovuta` … `saltuaria`, `entrata`, `trasferimento`, `fallback`.
    public let key: String
    /// Type given to categories added in this section; nil for «Da categorizzare» (no add, no moves).
    public let addType: CategoryType?
    public let categories: [MovementCategory]
    public var id: String { key }
}

public enum CategoryBoard {
    /// Four expense groups (always, even empty), then Entrate and Trasferimenti tra conti (always), then
    /// «Da categorizzare» only when it holds the fallback. Creation order is kept inside each section.
    public static func sections(_ categories: [MovementCategory]) -> [CategoryBoardSection] {
        var groups: [CategoryType: [MovementCategory]] = [:]
        var income: [MovementCategory] = []
        var transfers: [MovementCategory] = []
        var uncategorized: [MovementCategory] = []
        for c in categories {
            if c.isFallback || !(c.type.isExpenseGroup || c.type == .entrata || c.type == .trasferimento) {
                uncategorized.append(c)
            } else if c.type == .trasferimento {
                transfers.append(c)
            } else if c.type == .entrata {
                income.append(c)
            } else {
                groups[c.type, default: []].append(c)
            }
        }
        var out = CategoryType.expenseGroups.map {
            CategoryBoardSection(key: $0.rawValue, addType: $0, categories: groups[$0] ?? [])
        }
        out.append(CategoryBoardSection(key: "entrata", addType: .entrata, categories: income))
        out.append(CategoryBoardSection(key: "trasferimento", addType: .trasferimento, categories: transfers))
        if uncategorized.contains(where: \.isFallback) {
            out.append(CategoryBoardSection(key: "fallback", addType: nil, categories: uncategorized))
        }
        return out
    }
}
