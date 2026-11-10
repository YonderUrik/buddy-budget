import Foundation

/// Pure logic behind the shared `PeriodSelector`'s custom range (web `lib/calc/calendar-range.ts`, decision
/// 2026-10-17-selettore-del-periodo, #408): calendar grids, picking a range by tapping two dates and the short label of
/// a chosen range. Keys are strings that sort chronologically: `YYYY-MM-DD` for days, `YYYY-MM` for months.
/// Twin of `CalendarRange` in :core on Android.
public enum RangeGranularity: String, Sendable { case day, month }

/// A range being picked: `to` is nil after the first tap, until the second one.
public struct RangeDraft: Equatable, Sendable {
    public var from: String
    public var to: String?
    public init(from: String, to: String?) {
        self.from = from
        self.to = to
    }
}

/// A complete range of keys (`from` ≤ `to`).
public struct DateKeyRange: Equatable, Hashable, Sendable {
    public var from: String
    public var to: String
    public init(from: String, to: String) {
        self.from = from
        self.to = to
    }
}

public struct CalendarDay: Equatable, Sendable {
    public let key: String
    public let day: Int
    /// False for the leading/trailing days of the neighbouring months that fill the grid.
    public let inMonth: Bool
}

public enum CalendarRange {
    /// `YYYY-MM` of a year and zero-based month, normalising overflow (month 12 is January of the next year).
    public static func monthKey(year: Int, monthIndex: Int) -> String {
        CalendarDate.js(year: year, monthIndex: monthIndex, day: 1).monthKey
    }

    /// Year and zero-based month of a day or month key.
    public static func parseMonth(_ key: String) -> (year: Int, monthIndex: Int) {
        let parts = key.split(separator: "-")
        let year = parts.count > 0 ? Int(parts[0]) ?? 1970 : 1970
        let month = parts.count > 1 ? Int(parts[1]) ?? 1 : 1
        return (year, month - 1)
    }

    /// Six Monday-first weeks covering the month: a fixed height, so the sheet does not jump between months.
    public static func monthGrid(year: Int, monthIndex: Int) -> [CalendarDay] {
        let first = CalendarDate.js(year: year, monthIndex: monthIndex, day: 1)
        let lead = first.isoWeekday - 1
        return (0..<42).map { index in
            let date = first.adding(days: index - lead)
            return CalendarDay(key: date.iso, day: date.day, inMonth: date.month == first.month && date.year == first.year)
        }
    }

    /// Next draft after tapping `key`: the first tap starts a new range, the second closes it. A second tap before the
    /// start moves the start instead, so the range never ends before it begins.
    public static func pick(_ draft: RangeDraft, _ key: String) -> RangeDraft {
        if draft.to != nil { return RangeDraft(from: key, to: nil) }
        return key >= draft.from ? RangeDraft(from: draft.from, to: key) : RangeDraft(from: key, to: nil)
    }

    /// Whether `key` falls inside the draft (both ends included); a half-picked draft only contains its start.
    public static func inDraft(_ draft: RangeDraft, _ key: String) -> Bool {
        guard let to = draft.to else { return key == draft.from }
        return key >= draft.from && key <= to
    }

    /// Length of a range in its own unit, both ends included (days or months).
    public static func span(from: String, to: String, granularity: RangeGranularity) -> Int {
        let a = parseMonth(from)
        let b = parseMonth(to)
        if granularity == .month { return (b.year - a.year) * 12 + (b.monthIndex - a.monthIndex) + 1 }
        guard let start = CalendarDate(iso: from), let end = CalendarDate(iso: to) else { return 0 }
        return end.epochDay - start.epochDay + 1
    }

    /// Key outside [min, max]: such dates are shown but cannot be tapped.
    public static func outOfBounds(_ key: String, min: String?, max: String?) -> Bool {
        if let min, key < min { return true }
        if let max, key > max { return true }
        return false
    }

    /// Month of a key, as `YYYY-MM`.
    public static func monthOf(_ key: String) -> String { String(key.prefix(7)) }

    /// Narrow weekday initials, Monday first (`Intl` `weekday: "narrow"`).
    public static func weekdayInitials(locale: BBLocale) -> [String] {
        FormatLocaleData.table(locale).weekdaysShort.map { String($0.prefix(1)).uppercased() }
    }

    /// Calendar page title: «ottobre 2026».
    public static func monthTitle(_ key: String, locale: BBLocale) -> String {
        let m = parseMonth(key)
        return BBFormat.formatDate(CalendarDate.js(year: m.year, monthIndex: m.monthIndex, day: 1), .MMMMy, locale: locale)
    }

    /// Short month name for the month grid («ott», without the trailing dot some locales add).
    public static func shortMonth(year: Int, monthIndex: Int, locale: BBLocale) -> String {
        BBFormat.formatDate(CalendarDate.js(year: year, monthIndex: monthIndex, day: 1), .MMMy, locale: locale)
            .replacingOccurrences(of: " \(CalendarDate.js(year: year, monthIndex: monthIndex, day: 1).year)", with: "")
            .replacingOccurrences(of: ".", with: "")
    }

    /// One end of the range in the sheet's «Dal» / «Al» boxes: «3 mar 2026» for days, «marzo 2026» for months.
    public static func endLabel(_ key: String, granularity: RangeGranularity, locale: BBLocale) -> String {
        let m = parseMonth(key)
        if granularity == .month {
            return BBFormat.formatDate(CalendarDate.js(year: m.year, monthIndex: m.monthIndex, day: 1), .MMMMy, locale: locale)
        }
        guard let date = CalendarDate(iso: key) else { return key }
        return BBFormat.formatDate(date, .dMMMy, locale: locale)
    }

    /// Short label of a range for the selector («3 mar – 17 ott», «gen 2025 – dic 2025»). The year is written only when
    /// it is not the current one or the two ends are in different years, so the label stays short in the common case.
    public static func shortLabel(from: String, to: String, granularity: RangeGranularity, locale: BBLocale,
                                  currentYear: Int) -> String {
        let a = parseMonth(from)
        let b = parseMonth(to)
        if granularity == .month {
            let one = BBFormat.formatDate(CalendarDate.js(year: a.year, monthIndex: a.monthIndex, day: 1), .MMMy, locale: locale)
            if from == to { return one }
            return "\(one) – \(BBFormat.formatDate(CalendarDate.js(year: b.year, monthIndex: b.monthIndex, day: 1), .MMMy, locale: locale))"
        }
        let withYear = a.year != b.year || b.year != currentYear
        let skeleton: BBDateSkeleton = withYear ? .dMMMy : .dMMM
        guard let start = CalendarDate(iso: from), let end = CalendarDate(iso: to) else { return "\(from) – \(to)" }
        let one = BBFormat.formatDate(start, skeleton, locale: locale)
        return from == to ? one : "\(one) – \(BBFormat.formatDate(end, skeleton, locale: locale))"
    }
}
