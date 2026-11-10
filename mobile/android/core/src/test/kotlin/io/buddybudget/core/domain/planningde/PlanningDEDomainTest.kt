package io.buddybudget.core.domain.planningde

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

/** Behaviour of the German planning editors not pinned by financial-planning-de.json. Same cases as the Swift tests. */
class PlanningDEDomainTest {
    @Test fun PLAN_germanCapitalTaxFailsClosedForUnresearchedYears() {
        assertFailsWith<UnsupportedGermanTaxYear> {
            GermanPlanning.germanCapitalTax(GermanTaxProfile(year = 2027), 0.0, 1000.0)
        }
    }

    @Test fun PLAN_germanPensionNetReportsUnknownTaxTreatment() {
        val occupational = GermanPensionPlan(kind = GermanPensionKind.OCCUPATIONAL, id = "bav")
        val plan = GermanPlan(pensionTax = GermanPensionTax(mode = GermanPensionTaxMode.RULES))
        val result = GermanPlanning.germanPensionNet(listOf(GermanPensionPayment(occupational, 6000.0, 0.0)), plan)
        assertEquals(listOf("bav"), result.issues)
        assertNull(result.net)
    }
}
