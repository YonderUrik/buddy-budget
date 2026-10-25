package io.buddybudget.core.domain.shell

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class LiquidityNavigationTest {
    @Test fun TX001_liquiditySegmentsInOrder() {
        assertEquals(listOf("Movimenti", "Analisi", "Conti", "Abbonamenti"), LiquiditySegment.entries.map { it.title })
        assertEquals(LiquiditySegment.Accounts, LiquiditySegment.fromDestination(AppDestination.Accounts))
        assertEquals(LiquiditySegment.Subscriptions, LiquiditySegment.fromDestination(AppDestination.Subscriptions))
        assertEquals(LiquiditySegment.Movements, LiquiditySegment.fromDestination(AppDestination.Liquidity))
        assertNull(LiquiditySegment.fromDestination(AppDestination.Overview))
        assertEquals(AppDestination.Subscriptions, AppDestination.fromPath("/liquidita/abbonamenti"))
        assertEquals(AppTab.Liquidity, AppDestination.Subscriptions.tab)
    }

    @Test fun ACC009_ACC010_accountsLaunchIntentFromDeepLink() {
        assertEquals(AccountsLaunchIntent.NewAccount, AccountsLaunchIntent.fromPath("/liquidita/conti?nuovo=1"))
        assertEquals(AccountsLaunchIntent.NewAccount, AccountsLaunchIntent.fromPath("/liquidita/conti?new=1"))
        assertEquals(AccountsLaunchIntent.Renew("panoramica"), AccountsLaunchIntent.fromPath("/liquidita/conti?rinnova=panoramica"))
        assertEquals(AccountsLaunchIntent.Renew("1"), AccountsLaunchIntent.fromPath("/liquidita?rinnova=1"))
        assertNull(AccountsLaunchIntent.fromPath("/liquidita/conti"))
        assertNull(AccountsLaunchIntent.fromPath("/liquidita?nuovo=1"))
        assertNull(AccountsLaunchIntent.fromPath("/panoramica?rinnova=1"))
    }
}
