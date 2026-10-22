import BuddyBudgetKit
import Testing

// Behaviour of the German planning editors not pinned by financial-planning-de.json.

@Test func PLAN_germanCapitalTaxFailsClosedForUnresearchedYears() {
    var profile = GermanTaxProfile()
    profile.year = 2027
    #expect(throws: GermanPlanningError.unsupportedTaxYear) {
        try GermanPlanning.germanCapitalTax(profile, shareGains: 0, generalIncome: 1000)
    }
}

@Test func PLAN_germanPensionNetReportsUnknownTaxTreatment() {
    var occupational = GermanPensionPlan(kind: .occupational)
    occupational.id = "bav"
    var plan = GermanPlan()
    plan.pensionTax.mode = .rules
    let result = GermanPlanning.germanPensionNet([GermanPensionPayment(plan: occupational, annual: 6000, lumpSum: 0)], plan: plan)
    #expect(result.issues == ["bav"])
    #expect(result.net == nil)
}
