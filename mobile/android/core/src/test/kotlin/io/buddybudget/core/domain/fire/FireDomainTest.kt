package io.buddybudget.core.domain.fire

import io.buddybudget.core.domain.costs.CostsCalc
import io.buddybudget.core.domain.costs.UnsupportedCostCountryException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Behaviour of the FIRE / Monte Carlo ports not pinned by fire-and-simulations.json. Mirrors FireDomainTests.swift. */
class FireDomainTest {
    private val mcInput = MonteCarloInput(
        startingWealth = 500_000.0, annualSavings = 0.0, accumulationYears = 0.0, retirementYears = 30.0, annualSpending = 20_000.0,
        expectedReturn = 0.04, volatility = 0.12, inflation = 0.02, rule = WithdrawalRule.FISSA, paths = 200.0, seed = 1u,
    )

    @Test fun monteCarloCompareRulesUsesSamePathsPerRule() {
        val results = MonteCarlo.compareRules(mcInput)
        assertEquals(WithdrawalRule.entries.toList(), results.map { it.rule })
        assertEquals(MonteCarlo.runMonteCarlo(mcInput), results[0])
        assertEquals(0.765, results[0].successRate)
    }

    @Test fun fireScenarioOverridesKeepUntouchedAssumptions() {
        val a = FirePlanning.applyScenario(FireAssumptions.defaults, FireScenarioOverrides(expectedReturn = 0.05))
        assertEquals(0.05, a.expectedReturn)
        assertEquals(FireAssumptions.defaults.withdrawalRate, a.withdrawalRate)
        assertTrue(FirePlanning.hasScenario(FireScenarioOverrides(withdrawalRate = 0.04)))
        assertFalse(FirePlanning.hasScenario(FireScenarioOverrides()))
    }

    @Test fun summarizeCostsRejectsUnknownCountry() {
        assertFailsWith<UnsupportedCostCountryException> { CostsCalc.summarizeCosts(emptyList(), "FR") }
    }
}
