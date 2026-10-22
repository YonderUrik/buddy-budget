package io.buddybudget.core.domain.liquidity

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Behaviour of the small client-side helpers not pinned by vectors (ported from the web unit tests,
// components/domain/expenses/category-breakdown-donut.utils.test.ts and lib/gocardless/connection-health.ts).
// Same cases as the Swift LiquidityHelpersTests.
class LiquidityHelpersTest {
    private fun amount(id: String, group: LegendGroup = LegendGroup.VOLUTA, amount: Double = 0.0, name: String = "Categoria") =
        LegendCategoryAmount(id, name, group, amount, "slate", "package")

    private fun entry(id: String, amount: Double = 0.0, name: String = "Categoria", saturazione: Double? = null, quota: Double? = null) =
        LegendEntry(amount(id, LegendGroup.VOLUTA, amount, name), 0.0, saturazione, quota)

    @Test fun sortCategoryAmountsByGroupThenAmount() {
        val input = listOf(
            amount("fb", LegendGroup.DA_CATEGORIZZARE, 999.0), amount("sal", LegendGroup.SALTUARIA, 10.0), amount("vol", LegendGroup.VOLUTA, 100.0),
            amount("fut", LegendGroup.FUTURO, 5.0), amount("dov", LegendGroup.DOVUTA, 1.0),
        )
        assertEquals(listOf("dov", "vol", "fut", "sal", "fb"), CategoryLegend.sortCategoryAmounts(input).map { it.categoryId })
        assertEquals(
            listOf("d-high", "d-low"),
            CategoryLegend.sortCategoryAmounts(listOf(amount("d-low", LegendGroup.DOVUTA, 10.0), amount("d-high", LegendGroup.DOVUTA, 50.0))).map { it.categoryId },
        )
        assertEquals(listOf("speso", "zero"), CategoryLegend.sortCategoryAmounts(listOf(amount("zero"), amount("speso", amount = 20.0))).map { it.categoryId })
    }

    @Test fun computeBudgetStatsPercentages() {
        assertEquals(50.0, CategoryLegend.computeBudgetStats(50.0, 100.0, 200.0).saturazionePct)
        assertEquals(150.0, CategoryLegend.computeBudgetStats(150.0, 100.0, 200.0).saturazionePct)
        assertNull(CategoryLegend.computeBudgetStats(50.0, 0.0, 200.0).saturazionePct)
        assertEquals(25.0, CategoryLegend.computeBudgetStats(50.0, 100.0, 200.0).quotaPct)
        assertNull(CategoryLegend.computeBudgetStats(0.0, 100.0, 0.0).quotaPct)
    }

    @Test fun sortLegendEntriesCriteriaAndNullsLast() {
        val q = listOf(entry("low", quota = 10.0), entry("high", quota = 80.0))
        assertEquals(listOf("high", "low"), CategoryLegend.sortLegendEntries(q, LegendSortCriterion.PERCENTUALE, LegendSortDirection.DESC).map { it.category.categoryId })
        assertEquals(listOf("low", "high"), CategoryLegend.sortLegendEntries(q, LegendSortCriterion.PERCENTUALE, LegendSortDirection.ASC).map { it.category.categoryId })
        val v = listOf(entry("low", amount = 5.0), entry("high", amount = 50.0))
        assertEquals(listOf("high", "low"), CategoryLegend.sortLegendEntries(v, LegendSortCriterion.VALORE, LegendSortDirection.DESC).map { it.category.categoryId })
        val s = listOf(entry("none"), entry("low", saturazione = 20.0), entry("high", saturazione = 90.0))
        assertEquals(listOf("high", "low", "none"), CategoryLegend.sortLegendEntries(s, LegendSortCriterion.BUDGET, LegendSortDirection.DESC).map { it.category.categoryId })
        assertEquals(listOf("low", "high", "none"), CategoryLegend.sortLegendEntries(s, LegendSortCriterion.BUDGET, LegendSortDirection.ASC).map { it.category.categoryId })
        val n = listOf(entry("z", name = "Zaino"), entry("a", name = "Affitto"), entry("e", name = "Élite"), entry("b", name = "bollette"))
        assertEquals(listOf("a", "b", "e", "z"), CategoryLegend.sortLegendEntries(n, LegendSortCriterion.NOME, LegendSortDirection.ASC).map { it.category.categoryId })
        assertEquals(listOf("z", "e", "b", "a"), CategoryLegend.sortLegendEntries(n, LegendSortCriterion.NOME, LegendSortDirection.DESC).map { it.category.categoryId })
        assertEquals(LegendSortDirection.ASC, LegendSortCriterion.NOME.defaultDirection)
        assertEquals(LegendSortDirection.DESC, LegendSortCriterion.BUDGET.defaultDirection)
    }

    @Test fun connectionHealthHelpers() {
        assertTrue(ConnectionHealth.needsRenewal(ConnectionHealthState.EXPIRING) && ConnectionHealth.needsRenewal(ConnectionHealthState.ERROR))
        assertTrue(!ConnectionHealth.needsRenewal(ConnectionHealthState.OK))
        val now = Instant.ofEpochSecond(1_000_000)
        assertEquals(Instant.ofEpochSecond(1_000_000 + 90 * 86_400L), ConnectionHealth.consentExpiryFrom(now))
        val h = ConnectionHealth.computeConnectionHealth(ConnectionStatus.LINKED, now.plusSeconds(7 * 86_400L), now)
        assertEquals(ConnectionHealthResult(ConnectionHealthState.EXPIRING, 7), h)
    }

    @Test fun splitPresetsAndNaN() {
        assertEquals(listOf(1, 2, 3, 4), SplitShare.presets.map { it.parts })
        assertEquals(0.0, SplitShare.excludedFromOwnShare(100.0, Double.NaN))
    }
}
