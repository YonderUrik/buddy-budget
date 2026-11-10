package io.buddybudget.core.domain.goals

import io.buddybudget.core.domain.pension.PensionCalc
import io.buddybudget.core.domain.pension.PensionProjectionRates
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Goal wizard helpers (goals.md "Client wizard helpers") and pension slider behaviour. Mirrors Swift PensionGoalsDomainTests. */
class PensionGoalsDomainTest {
    @Test fun goalWizardStepsAndPayload() {
        var draft = GoalWizard.initialDraft(null, goalsCount = 2)
        assertEquals(2, draft.priority)
        assertFalse(GoalWizard.canAdvance(GoalFormStep.TIPO, draft, "2026-10-18"))
        draft = GoalWizard.withKind(draft, GoalKind.EMERGENZA, 1537.0)
        assertEquals("Fondo di emergenza", draft.name)
        assertEquals(9200.0, draft.target)
        assertEquals(6, draft.emergencyMonths)
        assertTrue(GoalWizard.canAdvance(GoalFormStep.TIPO, draft, "2026-10-18"))
        assertEquals("Viaggio", GoalWizard.withKind(draft, GoalKind.VIAGGIO, null).name)
        val custom = draft.copy(name = "Mio")
        assertEquals("Mio", GoalWizard.withKind(custom, GoalKind.VIAGGIO, null).name)
        assertNull(GoalWizard.withKind(custom, GoalKind.VIAGGIO, null).emergencyMonths)

        draft = draft.copy(targetMonth = "2026-10")
        assertFalse(GoalWizard.canAdvance(GoalFormStep.QUANTO, draft, "2026-10-18"))
        draft = draft.copy(targetMonth = "2027-06")
        assertTrue(GoalWizard.canAdvance(GoalFormStep.QUANTO, draft, "2026-10-18"))
        draft = draft.setSource("account:a", 500.0).setSource("instrument:x", 0.0)
        assertFalse(GoalWizard.canAdvance(GoalFormStep.FONTI, draft, "2026-10-18"))
        draft = draft.setSource("instrument:x", 8700.0)
        assertTrue(GoalWizard.canAdvance(GoalFormStep.FONTI, draft, "2026-10-18"))
        assertTrue(GoalWizard.isCovered(draft))
        assertTrue(GoalWizard.canAdvance(GoalFormStep.RITMO, draft, "2026-10-18"))
        assertEquals(0.0, GoalWizard.requiredMonthly(draft, "2026-10-18"))

        val payload = GoalWizard.toPayload(draft)
        assertEquals("2027-06-01", payload.targetDate)
        assertEquals(listOf(GoalPayloadSource("a", null, 500.0), GoalPayloadSource(null, "x", 8700.0)), payload.sources)
    }

    @Test fun goalAvailableSourcesAddsBackOwnShare() {
        val free = listOf(
            GoalFreeSource(GoalSourceKind.ACCOUNT, "a", "Conto", 1000.0, 200.0, 0.0),
            GoalFreeSource(GoalSourceKind.INSTRUMENT, "x", "ETF", 0.0, 0.0, 0.1),
            GoalFreeSource(GoalSourceKind.ACCOUNT, "b", "Vuoto", 0.0, 0.0, 0.0),
        )
        val goal = GoalWizardGoal(
            GoalKind.VIAGGIO, "Viaggio", 3000.0, "2027-06-01", 100.0, 0,
            listOf(GoalAssignedSource(GoalSourceKind.INSTRUMENT, "x", 50.0, 45.0, 5.0)),
        )
        val result = GoalWizard.availableSources(free, goal)
        assertEquals(listOf("a", "x"), result.map { it.id })
        assertEquals(50.0, result[1].free)
        assertEquals("2027-06", GoalWizard.initialDraft(goal, 3).targetMonth)
    }

    @Test fun pensionSliderRanges() {
        assertEquals(0.09, PensionCalc.exitTaxRate(PensionCalc.EXIT_TAX_TIMELINE_YEARS.toDouble()))
        assertEquals(1, PensionCalc.projectPension(0.0, 0.0, -3.0, PensionProjectionRates(0.0, 0.0, 0.0)).size)
    }
}
