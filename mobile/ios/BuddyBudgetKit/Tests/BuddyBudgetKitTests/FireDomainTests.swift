import BuddyBudgetKit
import Testing

// Behaviour of the FIRE / Monte Carlo ports not pinned by fire-and-simulations.json.

private let mcInput = MonteCarloInput(
    startingWealth: 500_000, annualSavings: 0, accumulationYears: 0, retirementYears: 30, annualSpending: 20_000,
    expectedReturn: 0.04, volatility: 0.12, inflation: 0.02, rule: .fissa, paths: 200, seed: 1
)

@Test func monteCarloCompareRulesUsesSamePathsPerRule() async {
    // Off the main actor, as the app runs it.
    let results = await Task.detached { MonteCarlo.compareRules(mcInput) }.value
    #expect(results.map(\.rule) == [.fissa, .percentuale, .guytonKlinger, .vanguard])
    #expect(results[0] == MonteCarlo.runMonteCarlo(mcInput))
    #expect(results[0].successRate == 0.765)
}

@Test func fireScenarioOverridesKeepUntouchedAssumptions() {
    let a = FirePlanning.applyScenario(.defaults, FireScenarioOverrides(expectedReturn: 0.05))
    #expect(a.expectedReturn == 0.05 && a.withdrawalRate == FireAssumptions.defaults.withdrawalRate)
    #expect(FirePlanning.hasScenario(FireScenarioOverrides(withdrawalRate: 0.04)))
    #expect(!FirePlanning.hasScenario(FireScenarioOverrides()))
}

@Test func summarizeCostsRejectsUnknownCountry() {
    #expect(throws: CostsError.unsupportedCountry("FR")) { try CostsCalc.summarizeCosts([], productCountry: "FR") }
}
