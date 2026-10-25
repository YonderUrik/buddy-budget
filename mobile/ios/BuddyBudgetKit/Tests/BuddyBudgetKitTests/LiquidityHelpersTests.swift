import BuddyBudgetKit
import Foundation
import Testing

// Behaviour of the small client-side helpers not pinned by vectors (ported from the web unit tests,
// components/domain/expenses/category-breakdown-donut.utils.test.ts and lib/gocardless/connection-health.ts).

private func amount(_ id: String, _ group: LegendGroup = .voluta, _ amount: Double = 0, name: String = "Categoria") -> LegendCategoryAmount {
    LegendCategoryAmount(categoryId: id, name: name, group: group, amount: amount, color: "slate", icon: "package")
}

private func entry(_ id: String, amount a: Double = 0, name: String = "Categoria", saturazione: Double? = nil, quota: Double? = nil) -> LegendEntry {
    LegendEntry(category: amount(id, .voluta, a, name: name), budgetAmount: 0, saturazionePct: saturazione, quotaPct: quota)
}

@Test func sortCategoryAmountsByGroupThenAmount() {
    let input = [amount("fb", .daCategorizzare, 999), amount("sal", .saltuaria, 10), amount("vol", .voluta, 100),
                 amount("fut", .futuro, 5), amount("dov", .dovuta, 1)]
    #expect(CategoryLegend.sortCategoryAmounts(input).map(\.categoryId) == ["dov", "vol", "fut", "sal", "fb"])
    #expect(CategoryLegend.sortCategoryAmounts([amount("d-low", .dovuta, 10), amount("d-high", .dovuta, 50)]).map(\.categoryId)
        == ["d-high", "d-low"])
    #expect(CategoryLegend.sortCategoryAmounts([amount("zero", .voluta, 0), amount("speso", .voluta, 20)]).map(\.categoryId)
        == ["speso", "zero"])
}

@Test func computeBudgetStatsPercentages() {
    #expect(CategoryLegend.computeBudgetStats(amount: 50, budgetAmount: 100, totalSpeso: 200).saturazionePct == 50)
    #expect(CategoryLegend.computeBudgetStats(amount: 150, budgetAmount: 100, totalSpeso: 200).saturazionePct == 150)
    #expect(CategoryLegend.computeBudgetStats(amount: 50, budgetAmount: 0, totalSpeso: 200).saturazionePct == nil)
    #expect(CategoryLegend.computeBudgetStats(amount: 50, budgetAmount: 100, totalSpeso: 200).quotaPct == 25)
    #expect(CategoryLegend.computeBudgetStats(amount: 0, budgetAmount: 100, totalSpeso: 0).quotaPct == nil)
}

@Test func sortLegendEntriesCriteriaAndNullsLast() {
    let q = [entry("low", quota: 10), entry("high", quota: 80)]
    #expect(CategoryLegend.sortLegendEntries(q, criterion: .percentuale, direction: .desc).map(\.category.categoryId) == ["high", "low"])
    #expect(CategoryLegend.sortLegendEntries(q, criterion: .percentuale, direction: .asc).map(\.category.categoryId) == ["low", "high"])
    let v = [entry("low", amount: 5), entry("high", amount: 50)]
    #expect(CategoryLegend.sortLegendEntries(v, criterion: .valore, direction: .desc).map(\.category.categoryId) == ["high", "low"])
    let s = [entry("none"), entry("low", saturazione: 20), entry("high", saturazione: 90)]
    #expect(CategoryLegend.sortLegendEntries(s, criterion: .budget, direction: .desc).map(\.category.categoryId) == ["high", "low", "none"])
    #expect(CategoryLegend.sortLegendEntries(s, criterion: .budget, direction: .asc).map(\.category.categoryId) == ["low", "high", "none"])
    let n = [entry("z", name: "Zaino"), entry("a", name: "Affitto"), entry("e", name: "Élite"), entry("b", name: "bollette")]
    #expect(CategoryLegend.sortLegendEntries(n, criterion: .nome, direction: .asc).map(\.category.categoryId) == ["a", "b", "e", "z"])
    #expect(CategoryLegend.sortLegendEntries(n, criterion: .nome, direction: .desc).map(\.category.categoryId) == ["z", "e", "b", "a"])
    #expect(LegendSortCriterion.nome.defaultDirection == .asc && LegendSortCriterion.budget.defaultDirection == .desc)
}

@Test func connectionHealthHelpers() {
    #expect(ConnectionHealth.needsRenewal(.expiring) && ConnectionHealth.needsRenewal(.error) && !ConnectionHealth.needsRenewal(.ok))
    let now = Date(timeIntervalSince1970: 1_000_000)
    #expect(ConnectionHealth.consentExpiryFrom(now).timeIntervalSince1970 == 1_000_000 + 90 * 86_400)
    // Exactly 7 days left → expiring.
    let h = ConnectionHealth.computeConnectionHealth(status: .linked, consentExpiresAt: now.addingTimeInterval(7 * 86_400), now: now)
    #expect(h.state == .expiring && h.daysLeft == 7)
}

@Test func splitPresetsAndNaN() {
    #expect(SplitShare.presets.map(\.parts) == [1, 2, 3, 4])
    #expect(SplitShare.excludedFromOwnShare(total: 100, ownShare: .nan) == 0)
}
