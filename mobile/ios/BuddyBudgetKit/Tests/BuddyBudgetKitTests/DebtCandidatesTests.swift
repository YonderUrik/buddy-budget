import BuddyBudgetKit
import Testing

// lib/debts/transaction-candidates.test.ts
private struct CandidateTx: MovementFields {
    let id: String
    let date: String
    let amount: Double
    let description: String
    let categoryId: String?
    var note: String? { nil }
    var accountId: String? { "a1" }
    var excludedAmount: Double { 0 }
}

private let list = [
    CandidateTx(id: "far", date: "2026-09-01", amount: -500, description: "Mutuo banca", categoryId: "c2"),
    CandidateTx(id: "near", date: "2026-09-19", amount: -80, description: "Spesa", categoryId: "c1"),
    CandidateTx(id: "exact", date: "2026-09-10", amount: -500.00, description: "Rata mutuo", categoryId: "c2"),
    CandidateTx(id: "near2", date: "2026-09-21", amount: -50, description: "Mutuo extra", categoryId: "c2"),
]

@Test func DEBT_rankInstallmentCandidatesExactFirstThenClosest() {
    let ids = DebtCalc.rankInstallmentCandidates(list, filter: MovementFilter(), dueDate: "2026-09-20", expectedAmount: 500).map(\.id)
    #expect(ids == ["exact", "far", "near", "near2"])
}

@Test func DEBT_rankInstallmentCandidatesFiltersTextAndCategory() {
    let ids = DebtCalc.rankInstallmentCandidates(list, filter: MovementFilter(categoryId: "c2", searchText: "mutuo"),
                                                 dueDate: "2026-09-20", expectedAmount: 500).map(\.id)
    #expect(ids == ["exact", "far", "near2"])
    #expect(DebtCalc.rankInstallmentCandidates(list, filter: MovementFilter(categoryId: "c1", searchText: "mutuo"),
                                               dueDate: "2026-09-20", expectedAmount: 500).isEmpty)
}

@Test func DEBT_describeFilterUsage() {
    #expect(DebtCalc.describeFilterUsage(MovementFilter(searchText: " ")) == .nessuno)
    #expect(DebtCalc.describeFilterUsage(MovementFilter(searchText: "a")) == .testo)
    #expect(DebtCalc.describeFilterUsage(MovementFilter(categoryId: "c")) == .categoria)
    #expect(DebtCalc.describeFilterUsage(MovementFilter(categoryId: "c", searchText: "a")) == .entrambi)
}
