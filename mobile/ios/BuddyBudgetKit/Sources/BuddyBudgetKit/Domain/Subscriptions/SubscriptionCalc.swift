import Foundation

public enum SubscriptionCadence: String, CaseIterable, Sendable {
    case settimanale, mensile, trimestrale, semestrale, annuale

    /// Months between charges (0 for weekly, which goes by days).
    public var months: Int {
        switch self {
        case .settimanale: return 0
        case .mensile: return 1
        case .trimestrale: return 3
        case .semestrale: return 6
        case .annuale: return 12
        }
    }

    /// Charges per month (for the monthly equivalent), same doubles as `CADENCE_RULES[c].perMonth`.
    public var perMonth: Double {
        switch self {
        case .settimanale: return 52.0 / 12
        case .mensile: return 1
        case .trimestrale: return 1.0 / 3
        case .semestrale: return 1.0 / 6
        case .annuale: return 1.0 / 12
        }
    }
}

/// The two optimistic-UI subscription helpers (`lib/calc/subscriptions.ts`); detection stays on the server.
public enum SubscriptionCalc {
    /// `iso` + `months`, day clamped to the month's length (`addMonthsIso`).
    public static func addMonthsIso(_ iso: String, months: Int, day: Int? = nil) -> String {
        guard let d = CalendarDate(iso: iso) else { return iso }
        let anchor = day ?? d.day
        let monthIndex = d.month - 1 + months
        let last = CalendarDate.js(year: d.year, monthIndex: monthIndex + 1, day: 0).day
        return CalendarDate.js(year: d.year, monthIndex: monthIndex, day: min(anchor, last)).iso
    }

    /// Next charge after `lastDate`, keeping the typical day of the month.
    public static func nextChargeDate(_ lastDate: String, cadence: SubscriptionCadence, day: Int? = nil) -> String {
        if cadence.months == 0 { return CalendarDate(iso: lastDate)?.adding(days: 7).iso ?? lastDate }
        return addMonthsIso(lastDate, months: cadence.months, day: day)
    }

    /// Monthly equivalent cost, JS `round2`.
    public static func monthlyEquivalent(_ amount: Double, cadence: SubscriptionCadence) -> Double {
        JSNumber.round2(amount * cadence.perMonth)
    }
}
