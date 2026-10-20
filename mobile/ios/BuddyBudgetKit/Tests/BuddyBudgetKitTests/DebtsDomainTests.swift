import BuddyBudgetKit
import Testing

// Debts helpers not pinned by the vectors (ported from the web's lib/debts/early-repayment-form.test.ts and
// components/domain/debts/debt-plan-table.tsx).

private let terms = DebtTerms(startMode: .nuovo, principal: 12000, annualRate: 6, installments: 24,
                              firstInstallmentDate: CalendarDate(year: 2026, month: 3, day: 5))
private let today = CalendarDate(year: 2026, month: 2, day: 1)
private let values = DebtEarlyRepaymentFormValues(mode: .once, date: "2026-08-10", amount: "3000", penalty: "", penaltyUnit: .eur)

@Test func DEBT_resolvePenaltyEuroOrPercent() {
    #expect(DebtCalc.resolvePenalty(3000, "50", .eur) == 50)
    #expect(DebtCalc.resolvePenalty(3000, "1", .percent) == 30)
    #expect(DebtCalc.resolvePenalty(3000, "", .percent) == 0)
    #expect(DebtCalc.resolvePenalty(3000, "abc", .eur) == nil)
}

@Test func DEBT_previewEarlyRepayment() throws {
    let plan = try DebtCalc.buildLoanPlan(terms, [], today: today)
    var v = values
    v.amount = ""
    #expect(try DebtCalc.previewEarlyRepayment(terms: terms, events: [], plan: plan, today: today, values: v) == .empty)
    v = values
    v.date = "2030-01-01"
    if case .error = try DebtCalc.previewEarlyRepayment(terms: terms, events: [], plan: plan, today: today, values: v) {} else { Issue.record("expected error") }
    v = values
    v.penalty = "1"
    v.penaltyUnit = .percent
    guard case .once(_, let penalty, _, let comparison) = try DebtCalc.previewEarlyRepayment(terms: terms, events: [], plan: plan, today: today, values: v)
    else { Issue.record("expected once"); return }
    #expect(penalty == 30)
    #expect(abs(comparison.reduceDuration.netBenefit - (comparison.reduceDuration.interestSaved - 30)) < 0.005)
    v = values
    v.mode = .monthly
    v.amount = "100"
    if case .monthly = try DebtCalc.previewEarlyRepayment(terms: terms, events: [], plan: plan, today: today, values: v) {} else { Issue.record("expected monthly") }
}

@Test func DEBT_visibleRowRangeAndBasics() throws {
    let plan = try DebtCalc.buildLoanPlan(terms, [], today: CalendarDate(year: 2026, month: 7, day: 1))
    // First future row (due ≥ today) is #5 (2026-07-05) at index 4 → [2, 12).
    let r = DebtCalc.visibleRowRange(plan.rows, today: CalendarDate(year: 2026, month: 7, day: 1))
    #expect(r.start == 2 && r.end == 12)
    let all = DebtCalc.visibleRowRange(plan.rows, today: CalendarDate(year: 2030, month: 1, day: 1))
    #expect(all.start == 22 && all.end == 24)
    var form = DebtCalc.emptyAddDebtForm(.nuovo)
    #expect(DebtCalc.validateAddFormBasics(form) == "Dai un nome al debito")
    form.name = " Auto "
    #expect(DebtCalc.validateAddFormBasics(form) == "Indica la data della prima rata")
    form.firstInstallmentDate = "2026-03-05"
    #expect(DebtCalc.validateAddFormBasics(form) == nil)
}
