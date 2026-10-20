package io.buddybudget.core.domain.debts

import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Debts helpers not pinned by the vectors (web lib/debts/early-repayment-form.test.ts, debt-plan-table.tsx). Same as Swift DebtsDomainTests.
class DebtsDomainTest {
    private val terms = DebtTerms(DebtStartMode.NUOVO, 12000.0, 6.0, 24, CalendarDate(2026, 3, 5))
    private val today = CalendarDate(2026, 2, 1)
    private val values = DebtEarlyRepaymentFormValues(DebtEarlyRepaymentMode.ONCE, "2026-08-10", "3000", "", DebtPenaltyUnit.EUR)

    @Test fun DEBT_resolvePenaltyEuroOrPercent() {
        assertEquals(50.0, DebtCalc.resolvePenalty(3000.0, "50", DebtPenaltyUnit.EUR))
        assertEquals(30.0, DebtCalc.resolvePenalty(3000.0, "1", DebtPenaltyUnit.PERCENT))
        assertEquals(0.0, DebtCalc.resolvePenalty(3000.0, "", DebtPenaltyUnit.PERCENT))
        assertNull(DebtCalc.resolvePenalty(3000.0, "abc", DebtPenaltyUnit.EUR))
    }

    @Test fun DEBT_previewEarlyRepayment() {
        val plan = DebtCalc.buildLoanPlan(terms, emptyList(), today)
        assertEquals(DebtEarlyRepaymentPreview.Empty, DebtCalc.previewEarlyRepayment(terms, emptyList(), plan, today, values.copy(amount = "")))
        assertIs<DebtEarlyRepaymentPreview.Error>(DebtCalc.previewEarlyRepayment(terms, emptyList(), plan, today, values.copy(date = "2030-01-01")))
        val once = DebtCalc.previewEarlyRepayment(terms, emptyList(), plan, today, values.copy(penalty = "1", penaltyUnit = DebtPenaltyUnit.PERCENT))
        assertIs<DebtEarlyRepaymentPreview.Once>(once)
        assertEquals(30.0, once.penalty)
        assertTrue(abs(once.comparison.reduceDuration.netBenefit - (once.comparison.reduceDuration.interestSaved - 30)) < 0.005)
        assertIs<DebtEarlyRepaymentPreview.Monthly>(
            DebtCalc.previewEarlyRepayment(terms, emptyList(), plan, today, values.copy(mode = DebtEarlyRepaymentMode.MONTHLY, amount = "100")),
        )
    }

    @Test fun DEBT_visibleRowRangeAndBasics() {
        val plan = DebtCalc.buildLoanPlan(terms, emptyList(), CalendarDate(2026, 7, 1))
        assertEquals(DebtRowRange(2, 12), DebtCalc.visibleRowRange(plan.rows, CalendarDate(2026, 7, 1)))
        assertEquals(DebtRowRange(22, 24), DebtCalc.visibleRowRange(plan.rows, CalendarDate(2030, 1, 1)))
        var form = DebtCalc.emptyAddDebtForm(DebtStartMode.NUOVO)
        assertEquals("Dai un nome al debito", DebtCalc.validateAddFormBasics(form))
        form = form.copy(name = " Auto ")
        assertEquals("Indica la data della prima rata", DebtCalc.validateAddFormBasics(form))
        assertNull(DebtCalc.validateAddFormBasics(form.copy(firstInstallmentDate = "2026-03-05")))
    }
}
