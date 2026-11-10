import Foundation

/// A calendar date (`YYYY-MM-DD`) with no time and no time zone: how the web's data dates
/// work (`parseDateOnly`). Arithmetic is pure proleptic-Gregorian, so it never shifts
/// across DST or time zones. `month` is 1-based (unlike JS `getMonth()`).
public struct CalendarDate: Hashable, Comparable, Sendable, CustomStringConvertible {
    public let year: Int
    public let month: Int
    public let day: Int

    /// Builds a valid date. Use `CalendarDate.js(year:monthIndex:day:)` for JS-style overflow.
    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// Parses `YYYY-MM-DD` (extra characters after the day, like a time, are ignored).
    public init?(iso: String) {
        let parts = iso.prefix(10).split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              (1...12).contains(m), d >= 1, d <= CalendarDate.daysInMonth(year: y, month: m) else { return nil }
        self.init(year: y, month: m, day: d)
    }

    /// `new Date(year, monthIndex, day)` semantics: month index is 0-based and both month and day overflow
    /// into the next/previous unit (31 Feb → 3 Mar, day 0 → last day of the previous month).
    public static func js(year: Int, monthIndex: Int, day: Int) -> CalendarDate {
        let total = year * 12 + monthIndex
        let y = floorDiv(total, 12)
        let m = total - y * 12
        return CalendarDate(epochDay: CalendarDate(year: y, month: m + 1, day: 1).epochDay + day - 1)
    }

    public init(epochDay: Int) {
        // Howard Hinnant's civil_from_days.
        let z = epochDay + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        self.init(year: yoe + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d)
    }

    /// Days since 1970-01-01.
    public var epochDay: Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    /// `YYYY-MM-DD`.
    public var iso: String {
        "\(CalendarDate.pad(year, 4))-\(CalendarDate.pad(month, 2))-\(CalendarDate.pad(day, 2))"
    }

    /// `YYYY-MM`.
    public var monthKey: String { "\(CalendarDate.pad(year, 4))-\(CalendarDate.pad(month, 2))" }

    public var description: String { iso }

    /// ISO weekday: 1 = Monday … 7 = Sunday.
    public var isoWeekday: Int { ((epochDay % 7 + 7) % 7 + 3) % 7 + 1 }

    public func adding(days: Int) -> CalendarDate { CalendarDate(epochDay: epochDay + days) }

    /// JS `new Date(y, m + months, d)`: the day overflows (31 Jan + 1 month = 3 Mar). Web `addMonths` in `lib/calc/expenses.ts`.
    public func addingMonthsOverflow(_ months: Int) -> CalendarDate {
        CalendarDate.js(year: year, monthIndex: month - 1 + months, day: day)
    }

    /// Month arithmetic clamping the day to the target month (31 Jan + 1 month = 28/29 Feb).
    /// `anchorDay` replaces the day before clamping (debts' `addMonthsClamped`).
    public func addingMonthsClamped(_ months: Int, anchorDay: Int? = nil) -> CalendarDate {
        let total = year * 12 + (month - 1) + months
        let y = CalendarDate.floorDiv(total, 12)
        let m = total - y * 12 + 1
        return CalendarDate(year: y, month: m, day: min(anchorDay ?? day, CalendarDate.daysInMonth(year: y, month: m)))
    }

    public var startOfMonth: CalendarDate { CalendarDate(year: year, month: month, day: 1) }
    public var endOfMonth: CalendarDate {
        CalendarDate(year: year, month: month, day: CalendarDate.daysInMonth(year: year, month: month))
    }

    public static func < (lhs: CalendarDate, rhs: CalendarDate) -> Bool { lhs.epochDay < rhs.epochDay }

    public static func isLeapYear(_ year: Int) -> Bool { (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 }

    public static func daysInMonth(year: Int, month: Int) -> Int {
        switch month {
        case 2: isLeapYear(year) ? 29 : 28
        case 4, 6, 9, 11: 30
        default: 31
        }
    }

    /// The calendar date of `instant` in `timeZone` (device-local "today": `TimeZone.current`).
    public static func of(_ instant: Date, in timeZone: TimeZone) -> CalendarDate {
        let seconds = instant.timeIntervalSince1970 + Double(timeZone.secondsFromGMT(for: instant))
        return CalendarDate(epochDay: Int((seconds / 86_400).rounded(.down)))
    }

    static func floorDiv(_ a: Int, _ b: Int) -> Int {
        let q = a / b
        return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
    }

    static func pad(_ value: Int, _ width: Int) -> String {
        let s = String(abs(value))
        let padded = s.count < width ? String(repeating: "0", count: width - s.count) + s : s
        return value < 0 ? "-" + padded : padded
    }
}
