import BuddyBudgetKit
import Testing

// Goal wizard helpers (goals.md "Client wizard helpers") and pension slider behaviour not pinned by vectors.

@Test func goalWizardStepsAndPayload() {
    var draft = GoalWizard.initialDraft(nil, goalsCount: 2)
    #expect(draft.priority == 2)
    #expect(!GoalWizard.canAdvance(.tipo, draft, todayKey: "2026-10-18"))
    draft = GoalWizard.withKind(draft, .emergenza, essentialMonthly: 1537)
    #expect(draft.name == "Fondo di emergenza")
    #expect(draft.target == 9200)
    #expect(draft.emergencyMonths == 6)
    #expect(GoalWizard.canAdvance(.tipo, draft, todayKey: "2026-10-18"))
    // A user-typed name survives a kind change; the previous default does not.
    #expect(GoalWizard.withKind(draft, .viaggio, essentialMonthly: nil).name == "Viaggio")
    var custom = draft
    custom.name = "Mio"
    #expect(GoalWizard.withKind(custom, .viaggio, essentialMonthly: nil).name == "Mio")
    #expect(GoalWizard.withKind(custom, .viaggio, essentialMonthly: nil).emergencyMonths == nil)

    draft.targetMonth = "2026-10"
    #expect(!GoalWizard.canAdvance(.quanto, draft, todayKey: "2026-10-18"))
    draft.targetMonth = "2027-06"
    #expect(GoalWizard.canAdvance(.quanto, draft, todayKey: "2026-10-18"))
    draft.setSource("account:a", 500)
    draft.setSource("instrument:x", 0)
    #expect(!GoalWizard.canAdvance(.fonti, draft, todayKey: "2026-10-18"))
    draft.setSource("instrument:x", 8700)
    #expect(GoalWizard.canAdvance(.fonti, draft, todayKey: "2026-10-18"))
    #expect(GoalWizard.isCovered(draft))
    #expect(GoalWizard.canAdvance(.ritmo, draft, todayKey: "2026-10-18"))
    #expect(GoalWizard.requiredMonthly(draft, todayKey: "2026-10-18") == 0)

    let payload = GoalWizard.toPayload(draft)
    #expect(payload.targetDate == "2027-06-01")
    #expect(payload.sources == [GoalPayloadSource(accountId: "a", instrumentId: nil, amount: 500),
                                GoalPayloadSource(accountId: nil, instrumentId: "x", amount: 8700)])
}

@Test func goalAvailableSourcesAddsBackOwnShare() {
    let free = [GoalFreeSource(kind: .account, id: "a", name: "Conto", total: 1000, free: 200, taxPerEuro: 0),
                GoalFreeSource(kind: .instrument, id: "x", name: "ETF", total: 0, free: 0, taxPerEuro: 0.1),
                GoalFreeSource(kind: .account, id: "b", name: "Vuoto", total: 0, free: 0, taxPerEuro: 0)]
    let goal = GoalWizardGoal(kind: .viaggio, name: "Viaggio", target: 3000, targetDate: "2027-06-01", monthly: 100, priority: 0,
                              sources: [GoalAssignedSource(kind: .instrument, refId: "x", amount: 50, counted: 45, tax: 5)])
    let result = GoalWizard.availableSources(free, goal: goal)
    #expect(result.map(\.id) == ["a", "x"])
    #expect(result[1].free == 50)
    #expect(GoalWizard.initialDraft(goal, goalsCount: 3).targetMonth == "2027-06")
}

@Test func pensionSliderRanges() {
    #expect(PensionCalc.exitTaxRate(Double(PensionCalc.exitTaxTimelineYears)) == 0.09)
    #expect(PensionCalc.projectPension(startValue: 0, quarterlyContribution: 0, years: -3,
                                       rates: .init(prudent: 0, base: 0, optimistic: 0)).count == 1)
}
