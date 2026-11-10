import Foundation

/// Inclusive calendar range.
public struct DateRange: Hashable, Sendable {
    public let from: CalendarDate
    public let to: CalendarDate
    public init(from: CalendarDate, to: CalendarDate) {
        self.from = from
        self.to = to
    }
}

/// Liquidità / Spese period selector (`ExpensePeriod`).
public enum ExpensePeriod: String, CaseIterable, Sendable {
    case settimana, mese
    case treMesi = "3mesi"
    case anno
}

/// Cash flow period selector (`CashflowPeriod`).
public enum CashflowPeriod: String, CaseIterable, Sendable {
    case treMesi = "3mesi", seiMesi = "6mesi", dodiciMesi = "12mesi", ventiquattroMesi = "24mesi"
    public var months: Int {
        switch self {
        case .treMesi: 3
        case .seiMesi: 6
        case .dodiciMesi: 12
        case .ventiquattroMesi: 24
        }
    }
}

/// Net-worth chart period (`NetWorthPeriod`).
public enum NetWorthPeriod: String, CaseIterable, Sendable {
    case unMese = "1mese", treMesi = "3mesi", unAnno = "1anno", max
}

/// Analitiche data period (`DataPeriod`): the last 12/24 full months, or custom `YYYY-MM` keys.
public enum DataPeriod: Hashable, Sendable {
    case ultimi(months: Int)
    case personalizzato(from: String, to: String)
}

/// Range in whole months (`PeriodRange`).
public struct PeriodRange: Hashable, Sendable {
    public let from: CalendarDate
    public let to: CalendarDate
    public let months: Int
}

/// ISO-8601 week and its year.
public struct IsoWeek: Hashable, Sendable {
    public let year: Int
    public let week: Int
}

/// Period ranges, navigation and month arithmetic, ported 1:1 from the web (including its quirks).
/// Two month-arithmetic flavours exist (spec domain/README.md §3): `addingMonthsOverflow` (JS `new Date`
/// overflow, 31 Jan + 1 = 3 Mar) and `addingMonthsClamped` (31 Jan + 1 = 28 Feb). Each function says which.
public enum Periods {
    // MARK: Expenses (lib/calc/expenses.ts)

    /// `getPeriodRange`: ISO week (Mon–Sun), calendar month, 3 months ending with the reference month, calendar year.
    public static func getPeriodRange(_ period: ExpensePeriod, _ referenceDate: CalendarDate) -> DateRange {
        switch period {
        case .settimana:
            let from = referenceDate.adding(days: -(referenceDate.isoWeekday - 1))
            return DateRange(from: from, to: from.adding(days: 6))
        case .mese:
            return DateRange(from: referenceDate.startOfMonth, to: referenceDate.endOfMonth)
        case .treMesi:
            return DateRange(from: referenceDate.addingMonthsOverflow(-2).startOfMonth, to: referenceDate.endOfMonth)
        case .anno:
            return DateRange(from: CalendarDate(year: referenceDate.year, month: 1, day: 1),
                             to: CalendarDate(year: referenceDate.year, month: 12, day: 31))
        }
    }

    /// `getPreviousPeriodRange`. Uses overflow month arithmetic: the previous month of 31 March is March
    /// itself (web quirk, pinned by vectors).
    public static func getPreviousPeriodRange(_ period: ExpensePeriod, _ referenceDate: CalendarDate) -> DateRange {
        let shifted: CalendarDate
        switch period {
        case .settimana: shifted = referenceDate.adding(days: -7)
        case .mese: shifted = referenceDate.addingMonthsOverflow(-1)
        case .treMesi: shifted = referenceDate.addingMonthsOverflow(-3)
        case .anno: shifted = CalendarDate.js(year: referenceDate.year - 1, monthIndex: referenceDate.month - 1, day: referenceDate.day)
        }
        return getPeriodRange(period, shifted)
    }

    /// `shiftReferenceDate` (overflow arithmetic: 31 Jan + 1 month = 3 Mar).
    public static func shiftReferenceDate(_ period: ExpensePeriod, _ referenceDate: CalendarDate, direction: Int) -> CalendarDate {
        switch period {
        case .settimana: referenceDate.adding(days: 7 * direction)
        case .mese: referenceDate.addingMonthsOverflow(direction)
        case .treMesi: referenceDate.addingMonthsOverflow(3 * direction)
        case .anno: CalendarDate.js(year: referenceDate.year + direction, monthIndex: referenceDate.month - 1, day: referenceDate.day)
        }
    }

    /// `scaleBudgetForPeriod`: week = monthly / 30 × 7.
    public static func scaleBudgetForPeriod(_ monthlyTotal: Double, _ period: ExpensePeriod) -> Double {
        switch period {
        case .settimana: (monthlyTotal / 30) * 7
        case .mese: monthlyTotal
        case .treMesi: monthlyTotal * 3
        case .anno: monthlyTotal * 12
        }
    }

    /// `formatPeriodLabel`: "Ottobre 2026", "12–18 ott", "28 set – 4 ott", "Nov 2025 – Gen 2026", "2026".
    public static func formatPeriodLabel(_ period: ExpensePeriod, _ range: DateRange, locale: BBLocale) -> String {
        let sameYear = range.from.year == range.to.year
        switch period {
        case .mese:
            return "\(BBFormat.capitalize(BBFormat.monthName(range.from.month, locale: locale))) \(range.from.year)"
        case .anno:
            return "\(range.from.year)"
        case .settimana:
            if sameYear && range.from.month == range.to.month {
                return "\(range.from.day)\u{2013}\(BBFormat.formatDate(range.to, .dMMM, locale: locale))"
            }
            let skeleton: BBDateSkeleton = sameYear ? .dMMM : .dMMMy
            return "\(BBFormat.formatDate(range.from, skeleton, locale: locale)) \u{2013} \(BBFormat.formatDate(range.to, skeleton, locale: locale))"
        case .treMesi:
            return monthSpanLabel(range, locale: locale)
        }
    }

    // MARK: Cash flow (lib/calc/cashflow.ts, lib/calc/movements.ts)

    /// `getCashflowPeriodRange`: `months` calendar months up to the reference month (clamped arithmetic).
    public static func getCashflowPeriodRange(_ period: CashflowPeriod, _ referenceDate: CalendarDate) -> DateRange {
        DateRange(from: referenceDate.addingMonthsClamped(-(period.months - 1)).startOfMonth, to: referenceDate.endOfMonth)
    }

    /// `getPreviousCashflowPeriodRange`.
    public static func getPreviousCashflowPeriodRange(_ period: CashflowPeriod, _ referenceDate: CalendarDate) -> DateRange {
        getCashflowPeriodRange(period, referenceDate.addingMonthsClamped(-period.months))
    }

    /// `shiftCashflowReferenceDate` (clamped: 31 May − 3 months = 28 Feb).
    public static func shiftCashflowReferenceDate(_ period: CashflowPeriod, _ referenceDate: CalendarDate, direction: Int) -> CalendarDate {
        referenceDate.addingMonthsClamped(period.months * direction)
    }

    /// `formatCashflowPeriodLabel`: "Ago – Ott 2026", "Nov 2025 – Ott 2026". The web hard-codes it-IT;
    /// mobile passes the account locale (known web i18n gap, spec formatting-localization.md §5).
    public static func formatCashflowPeriodLabel(_ range: DateRange, locale: BBLocale = .itIT) -> String {
        monthSpanLabel(range, locale: locale)
    }

    /// `getTrendRange`: monthly charts window, 6 months (12 for "anno") ending with the reference month.
    public static func getTrendRange(_ period: ExpensePeriod, _ referenceDate: CalendarDate) -> DateRange {
        let months = period == .anno ? 12 : 6
        return DateRange(from: referenceDate.startOfMonth.addingMonthsOverflow(-(months - 1)).startOfMonth,
                         to: referenceDate.endOfMonth)
    }

    private static func monthSpanLabel(_ range: DateRange, locale: BBLocale) -> String {
        let toLabel = BBFormat.capitalize(BBFormat.formatDate(range.to, .MMMy, locale: locale))
        if range.from.year == range.to.year {
            return "\(BBFormat.capitalize(BBFormat.monthNameShort(range.from.month, locale: locale))) \u{2013} \(toLabel)"
        }
        return "\(BBFormat.capitalize(BBFormat.formatDate(range.from, .MMMy, locale: locale))) \u{2013} \(toLabel)"
    }

    // MARK: Net worth (lib/calc/net-worth.ts)

    /// `getNetWorthPeriodRange`: back 1/3/12 months (clamped) from today; `max` from the earliest date (or today).
    public static func getNetWorthPeriodRange(_ period: NetWorthPeriod, today: CalendarDate, earliestDate: CalendarDate?) -> DateRange {
        switch period {
        case .max: DateRange(from: earliestDate ?? today, to: today)
        case .unMese: DateRange(from: today.addingMonthsClamped(-1), to: today)
        case .treMesi: DateRange(from: today.addingMonthsClamped(-3), to: today)
        case .unAnno: DateRange(from: today.addingMonthsClamped(-12), to: today)
        }
    }

    // MARK: Analitiche (lib/analitiche/period.ts)

    /// `monthSpan("2025-11", "2026-02")` = 4 (both ends included).
    public static func monthSpan(_ from: String, _ to: String) -> Int {
        let (fy, fm) = yearMonth(from), (ty, tm) = yearMonth(to)
        return (ty - fy) * 12 + (tm - fm) + 1
    }

    /// `resolvePeriodRange`: whole months only; the current (partial) month never counts.
    public static func resolvePeriodRange(_ period: DataPeriod, today: CalendarDate) -> PeriodRange {
        let lastFull = today.addingMonthsOverflow(-1).endOfMonth
        switch period {
        case .ultimi(let months):
            return PeriodRange(from: lastFull.addingMonthsOverflow(-(months - 1)).startOfMonth, to: lastFull, months: months)
        case .personalizzato(let fromKey, let toKey):
            let (fy, fm) = yearMonth(fromKey), (ty, tm) = yearMonth(toKey)
            let from = CalendarDate.js(year: fy, monthIndex: fm - 1, day: 1)
            let wantedTo = CalendarDate.js(year: ty, monthIndex: tm - 1, day: 1).endOfMonth
            let to = wantedTo > lastFull ? lastFull : wantedTo
            let months = to < from ? 0 : (to.year - from.year) * 12 + (to.month - from.month) + 1
            return PeriodRange(from: from, to: to, months: months)
        }
    }

    // MARK: Month keys and misc. date helpers

    /// Goals' `monthsBetween`: whole months between the months of two `YYYY-MM[-DD]` keys (day ignored).
    public static func monthsBetween(_ from: String, _ to: String) -> Int {
        let (fy, fm) = yearMonth(from), (ty, tm) = yearMonth(to)
        return ty * 12 + tm - (fy * 12 + fm)
    }

    /// Goals' `addMonthsKey`: the `YYYY-MM` month `months` after the month of `from`.
    public static func addMonthsKey(_ from: String, _ months: Int) -> String {
        let (y, m) = yearMonth(from)
        let index = y * 12 + (m - 1) + months
        let year = CalendarDate.floorDiv(index, 12)
        return "\(year)-\(CalendarDate.pad(index - year * 12 + 1, 2))"
    }

    /// Pension's `wholeYearsBetween`: completed years (≥ 0), comparing `MM-DD` as strings.
    public static func wholeYearsBetween(_ from: String, _ to: String) -> Int {
        var years = (Int(to.prefix(4)) ?? 0) - (Int(from.prefix(4)) ?? 0)
        if String(to.dropFirst(5)) < String(from.dropFirst(5)) { years -= 1 }
        return max(0, years)
    }

    /// Returns' `daysBetween`: calendar days from `from` to `to`.
    public static func daysBetween(_ from: CalendarDate, _ to: CalendarDate) -> Int { to.epochDay - from.epochDay }

    /// ISO-8601 week (Thursday rule) and its year.
    public static func isoWeek(_ date: CalendarDate) -> IsoWeek {
        let monday = { (d: CalendarDate) in d.adding(days: -(d.isoWeekday - 1)) }
        let thursday = monday(date).adding(days: 3)
        let firstThursday = monday(CalendarDate(year: thursday.year, month: 1, day: 4)).adding(days: 3)
        return IsoWeek(year: thursday.year, week: (thursday.epochDay - firstThursday.epochDay) / 7 + 1)
    }

    /// Debts' `todayIso`: the **UTC** calendar date of `now`.
    public static func todayUTC(_ now: Date) -> CalendarDate {
        CalendarDate.of(now, in: TimeZone(secondsFromGMT: 0)!)
    }

    private static func yearMonth(_ key: String) -> (Int, Int) {
        let parts = key.split(separator: "-", omittingEmptySubsequences: false)
        return (parts.count > 0 ? Int(parts[0]) ?? 0 : 0, parts.count > 1 ? Int(parts[1]) ?? 0 : 0)
    }
}
