import Foundation
import Testing
@testable import BuddyBudgetKit

@Test func TX010_heroPeriodsDefaultTo3M() {
    #expect(LiquidityHero.periods.map(LiquidityHero.label) == ["1M", "3M", "1A", "Max"])
    #expect(LiquidityHero.defaultPeriod == .threeMonths)
    #expect(LiquidityHero.phrase(.threeMonths) == "negli ultimi 3 mesi")
    #expect(LiquidityHero.phrase(.max) == "da quando c'è lo storico")
    let today = CalendarDate(year: 2026, month: 5, day: 31)
    #expect(LiquidityHero.periodStart(.oneMonth, today: today, earliest: nil) == "2026-04-30")
    #expect(LiquidityHero.periodStart(.threeMonths, today: today, earliest: nil) == "2026-02-28")
    #expect(LiquidityHero.periodStart(.oneYear, today: today, earliest: nil) == "2025-05-31")
    #expect(LiquidityHero.periodStart(.max, today: today, earliest: "2024-01-05") == "2024-01-05")
    #expect(LiquidityHero.periodStart(.max, today: today, earliest: nil) == "2026-05-31")
}

@Test func TX011_totalSeriesIsTheLiquidityClass() throws {
    let view = try JSONDecoder().decode(OverviewView.self, from: try fixture("overview.json"))
    let points = LiquidityHero.totalSeries(view)
    #expect(points.count == view.series.count)
    #expect(points.first == LiquidityHeroPoint(date: "2026-07-18", value: 23495.34))
    #expect(points.last?.value == view.todayByClass["liquidita"])
    #expect(LiquidityHero.delta(points) == points.last!.value - points.first!.value)
}

@Test func TX011_accountSeriesRebuiltBackwards() {
    let movements: [(date: String, amount: Double)] = [("2026-10-17", -68), ("2026-10-18", 250), ("2026-10-18", -250), ("2026-10-21", -10)]
    let series = LiquidityHero.accountSeries(balance: 1000, followsTransactions: true, movements: movements, from: "2026-10-16", today: "2026-10-20")
    #expect(series.map(\.date) == ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"])
    // Today's balance minus later movements (−10 on the 21st): 1010; the 17th's −68 moves the 16th up.
    #expect(series.map(\.value) == [1078, 1010, 1010, 1010, 1010])
    let manual = LiquidityHero.accountSeries(balance: 500, followsTransactions: false, movements: movements, from: "2026-10-18", today: "2026-10-20")
    #expect(manual.map(\.value) == [500, 500, 500])
    #expect(LiquidityHero.delta(manual) == 0)
    #expect(LiquidityHero.delta([LiquidityHeroPoint(date: "2026-10-20", value: 1)]) == nil)
    #expect(LiquidityHero.followsTransactions(Account(id: "a", name: "A", type: "", balance: 0, source: .auto)))
    #expect(!LiquidityHero.followsTransactions(Account(id: "a", name: "A", type: "", balance: 0, source: .auto, followsTransactions: false)))
}
