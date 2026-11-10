package io.buddybudget.core.domain.debts

import io.buddybudget.core.domain.liquidity.MovementFields
import io.buddybudget.core.domain.liquidity.MovementFilter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// lib/debts/transaction-candidates.test.ts
private data class CandidateTx(
    val id: String,
    override val date: String,
    override val amount: Double,
    override val description: String,
    override val categoryId: String?,
) : MovementFields {
    override val note: String? get() = null
    override val accountId: String? get() = "a1"
    override val excludedAmount: Double get() = 0.0
}

class DebtCandidatesTest {
    private val list = listOf(
        CandidateTx("far", "2026-09-01", -500.0, "Mutuo banca", "c2"),
        CandidateTx("near", "2026-09-19", -80.0, "Spesa", "c1"),
        CandidateTx("exact", "2026-09-10", -500.00, "Rata mutuo", "c2"),
        CandidateTx("near2", "2026-09-21", -50.0, "Mutuo extra", "c2"),
    )

    @Test fun DEBT_rankInstallmentCandidatesExactFirstThenClosest() {
        val ids = DebtCalc.rankInstallmentCandidates(list, MovementFilter(), "2026-09-20", 500.0).map { it.id }
        assertEquals(listOf("exact", "far", "near", "near2"), ids)
    }

    @Test fun DEBT_rankInstallmentCandidatesFiltersTextAndCategory() {
        val ids = DebtCalc.rankInstallmentCandidates(list, MovementFilter(categoryId = "c2", searchText = "mutuo"), "2026-09-20", 500.0).map { it.id }
        assertEquals(listOf("exact", "far", "near2"), ids)
        assertTrue(DebtCalc.rankInstallmentCandidates(list, MovementFilter(categoryId = "c1", searchText = "mutuo"), "2026-09-20", 500.0).isEmpty())
    }

    @Test fun DEBT_describeFilterUsage() {
        assertEquals(DebtCandidateFilterUsage.NESSUNO, DebtCalc.describeFilterUsage(MovementFilter(searchText = " ")))
        assertEquals(DebtCandidateFilterUsage.TESTO, DebtCalc.describeFilterUsage(MovementFilter(searchText = "a")))
        assertEquals(DebtCandidateFilterUsage.CATEGORIA, DebtCalc.describeFilterUsage(MovementFilter(categoryId = "c")))
        assertEquals(DebtCandidateFilterUsage.ENTRAMBI, DebtCalc.describeFilterUsage(MovementFilter(categoryId = "c", searchText = "a")))
    }
}
