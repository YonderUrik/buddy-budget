import Foundation

/// One end-of-day point of the Liquidità hero chart.
public struct LiquidityHeroPoint: Equatable, Sendable {
    public let date: String
    public let value: Double

    public init(date: String, value: Double) {
        self.date = date
        self.value = value
    }
}

/// Liquidità hero under the month sentence (TX-009…011, web `LiquidityOverview` + `LiquidityHero`): the period choice,
/// the series for all accounts (liquidity class of the net-worth series) or for one account (rebuilt backwards from
/// its balance), the change over the period and its phrase. Android: `LiquidityHero.kt`.
public enum LiquidityHero {
    /// TX-010: `1M`, `3M`, `1A`, `Max`, default `3M`.
    public static let periods: [OverviewPeriod] = [.oneMonth, .threeMonths, .oneYear, .max]
    public static let defaultPeriod: OverviewPeriod = .threeMonths
    /// Net-worth class of the liquidity.
    public static let liquidityClass = "liquidita"

    public static func label(_ period: OverviewPeriod) -> String {
        switch period {
        case .oneMonth: "1M"
        case .threeMonths: "3M"
        case .oneYear: "1A"
        case .max: "Max"
        }
    }

    /// Phrase after the change (web `PERIOD_PHRASES`, catalog keys).
    public static func phrase(_ period: OverviewPeriod) -> String {
        switch period {
        case .oneMonth: "nell'ultimo mese"
        case .threeMonths: "negli ultimi 3 mesi"
        case .oneYear: "nell'ultimo anno"
        case .max: "da quando c'è lo storico"
        }
    }

    /// First day of the period (`getNetWorthPeriodRange`): today minus 1, 3 or 12 months (day clamped), or the
    /// earliest date for `max` (today when there is none).
    public static func periodStart(_ period: OverviewPeriod, today: CalendarDate, earliest: String?) -> String {
        switch period {
        case .oneMonth: today.addingMonthsClamped(-1).iso
        case .threeMonths: today.addingMonthsClamped(-3).iso
        case .oneYear: today.addingMonthsClamped(-12).iso
        case .max: earliest ?? today.iso
        }
    }

    /// TX-011, all accounts: the liquidity class of the server's net-worth series (`GET /api/overview?period=`), whose
    /// last point is today's total.
    public static func totalSeries(_ view: OverviewView) -> [LiquidityHeroPoint] {
        view.series.map { LiquidityHeroPoint(date: $0.date, value: $0.byClass[liquidityClass] ?? 0) }
    }

    /// TX-011, one account (`buildAccountBalanceSeries`): end-of-day balance from `from` to today. An account whose
    /// balance follows its transactions is today's balance minus the later movements (full amounts); a manual account
    /// is a flat line at today's balance.
    public static func accountSeries(balance: Double, followsTransactions: Bool, movements: [(date: String, amount: Double)],
                                     from: String, today: String) -> [LiquidityHeroPoint] {
        guard let start = CalendarDate(iso: from), let end = CalendarDate(iso: today), start <= end else {
            return [LiquidityHeroPoint(date: today, value: round2(balance))]
        }
        var byDate: [String: Double] = [:]
        var after = 0.0
        if followsTransactions {
            for m in movements {
                if m.date > today { after += m.amount } else { byDate[m.date, default: 0] += m.amount }
            }
        }
        var points: [LiquidityHeroPoint] = []
        var running = after
        var cursor = end
        while cursor >= start {
            let key = cursor.iso
            points.append(LiquidityHeroPoint(date: key, value: round2(balance - running)))
            running += byDate[key] ?? 0
            cursor = cursor.adding(days: -1)
        }
        return points.reversed()
    }

    /// Whether an account's balance follows its movements (`accountFollowsTransactions`).
    public static func followsTransactions(_ account: Account) -> Bool {
        account.followsTransactions ?? (account.source == .auto)
    }

    /// Change over the period (last − first); nil with fewer than two points.
    public static func delta(_ points: [LiquidityHeroPoint]) -> Double? {
        guard points.count > 1, let first = points.first, let last = points.last else { return nil }
        return last.value - first.value
    }

    private static func round2(_ value: Double) -> Double { (value * 100).rounded() / 100 }
}
