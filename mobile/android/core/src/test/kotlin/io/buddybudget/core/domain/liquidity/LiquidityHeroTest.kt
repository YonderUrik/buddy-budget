package io.buddybudget.core.domain.liquidity

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountSource
import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.fixture
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LiquidityHeroTest {
    @Test fun TX010_heroPeriodsDefaultTo3M() {
        assertEquals(listOf("1M", "3M", "1A", "Max"), LiquidityHero.periods.map(LiquidityHero::label))
        assertEquals(OverviewPeriod.ThreeMonths, LiquidityHero.defaultPeriod)
        assertEquals("negli ultimi 3 mesi", LiquidityHero.phrase(OverviewPeriod.ThreeMonths))
        assertEquals("da quando c'è lo storico", LiquidityHero.phrase(OverviewPeriod.Max))
        val today = CalendarDate(2026, 5, 31)
        assertEquals("2026-04-30", LiquidityHero.periodStart(OverviewPeriod.OneMonth, today, null))
        assertEquals("2026-02-28", LiquidityHero.periodStart(OverviewPeriod.ThreeMonths, today, null))
        assertEquals("2025-05-31", LiquidityHero.periodStart(OverviewPeriod.OneYear, today, null))
        assertEquals("2024-01-05", LiquidityHero.periodStart(OverviewPeriod.Max, today, "2024-01-05"))
        assertEquals("2026-05-31", LiquidityHero.periodStart(OverviewPeriod.Max, today, null))
    }

    @Test fun TX011_totalSeriesIsTheLiquidityClass() {
        val view = ApiClient.DefaultJson.decodeFromString(OverviewView.serializer(), fixture("overview.json"))
        val points = LiquidityHero.totalSeries(view)
        assertEquals(view.series.size, points.size)
        assertEquals(LiquidityHeroPoint("2026-07-18", 23495.34), points.first())
        assertEquals(view.todayByClass["liquidita"], points.last().value)
        assertEquals(points.last().value - points.first().value, LiquidityHero.delta(points))
    }

    @Test fun TX011_accountSeriesRebuiltBackwards() {
        val movements = listOf("2026-10-17" to -68.0, "2026-10-18" to 250.0, "2026-10-18" to -250.0, "2026-10-21" to -10.0)
        val series = LiquidityHero.accountSeries(1000.0, true, movements, "2026-10-16", "2026-10-20")
        assertEquals(listOf("2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"), series.map { it.date })
        assertEquals(listOf(1078.0, 1010.0, 1010.0, 1010.0, 1010.0), series.map { it.value })
        val manual = LiquidityHero.accountSeries(500.0, false, movements, "2026-10-18", "2026-10-20")
        assertEquals(listOf(500.0, 500.0, 500.0), manual.map { it.value })
        assertEquals(0.0, LiquidityHero.delta(manual))
        assertNull(LiquidityHero.delta(listOf(LiquidityHeroPoint("2026-10-20", 1.0))))
        assertTrue(LiquidityHero.followsTransactions(Account("a", "A", "", 0.0, source = AccountSource.Auto)))
        assertFalse(LiquidityHero.followsTransactions(Account("a", "A", "", 0.0, source = AccountSource.Auto, followsTransactions = false)))
    }
}
