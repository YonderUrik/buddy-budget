import Foundation
import Testing
@testable import BuddyBudgetKit

@Test func TX001_liquiditySegmentsInOrder() {
    #expect(LiquiditySegment.allCases.map(\.title) == ["Movimenti", "Analisi", "Conti", "Abbonamenti"])
    #expect(LiquiditySegment(destination: .accounts) == .accounts)
    #expect(LiquiditySegment(destination: .subscriptions) == .subscriptions)
    #expect(LiquiditySegment(destination: .liquidity) == .movements)
    #expect(LiquiditySegment(destination: .overview) == nil)
    #expect(AppDestination(path: "/liquidita/abbonamenti") == .subscriptions)
    #expect(AppDestination.subscriptions.tab == .liquidity)
}

@Test func ACC009_ACC010_accountsLaunchIntentFromDeepLink() {
    #expect(AccountsLaunchIntent(path: "/liquidita/conti?nuovo=1") == .newAccount)
    #expect(AccountsLaunchIntent(path: "/liquidita/conti?new=1") == .newAccount)
    #expect(AccountsLaunchIntent(path: "/liquidita/conti?rinnova=panoramica") == .renew(origin: "panoramica"))
    #expect(AccountsLaunchIntent(path: "/liquidita?rinnova=1") == .renew(origin: "1"))
    #expect(AccountsLaunchIntent(path: "/liquidita/conti") == nil)
    #expect(AccountsLaunchIntent(path: "/liquidita?nuovo=1") == nil)
    #expect(AccountsLaunchIntent(path: "/panoramica?rinnova=1") == nil)
}
