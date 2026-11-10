import Foundation

extension BBFormat {
    // MARK: Dates

    /// Formats a calendar date with one of the web's skeletons ("d MMM" → "26 set" / "26 Sept" / "26. Sept.").
    /// `hour`/`minute` are only used by `.HHmm`.
    public static func formatDate(_ date: CalendarDate, _ skeleton: BBDateSkeleton, locale: BBLocale,
                                  hour: Int = 0, minute: Int = 0) -> String {
        let t = FormatLocaleData.table(locale)
        guard let template = t.dateTemplates[skeleton] else { return date.iso }
        let values: [(String, String)] = [
            ("{EEEE}", t.weekdaysLong[date.isoWeekday - 1]),
            ("{EEE}", t.weekdaysShort[date.isoWeekday - 1]),
            ("{MMMM}", t.monthsLong[date.month - 1]),
            ("{MMM}", t.monthsAbbreviated[date.month - 1]),
            ("{yy}", CalendarDate.pad(((date.year % 100) + 100) % 100, 2)),
            ("{y}", String(date.year)),
            ("{dd}", CalendarDate.pad(date.day, 2)),
            ("{d}", String(date.day)),
            ("{HH}", CalendarDate.pad(hour, 2)),
            ("{mm}", CalendarDate.pad(minute, 2)),
        ]
        var out = ""
        var rest = Substring(template)
        while let open = rest.firstIndex(of: "{") {
            out += rest[..<open]
            guard let close = rest[open...].firstIndex(of: "}") else { break }
            let token = String(rest[open...close])
            out += values.first(where: { $0.0 == token })?.1 ?? token
            rest = rest[rest.index(after: close)...]
        }
        out += rest
        return out
    }

    /// `HH:mm`.
    public static func formatTime(hour: Int, minute: Int, locale: BBLocale) -> String {
        formatDate(CalendarDate(year: 2000, month: 1, day: 1), .HHmm, locale: locale, hour: hour, minute: minute)
    }

    /// `formatShortDate("2026-09-26")` → "26 set". Invalid input is returned unchanged.
    public static func formatShortDate(_ iso: String, locale: BBLocale) -> String {
        guard let date = CalendarDate(iso: iso) else { return iso }
        return formatDate(date, .dMMM, locale: locale)
    }

    /// `formatDateWithYear("2026-09-26")` → "26 set 2026". Invalid input is returned unchanged.
    public static func formatDateWithYear(_ iso: String, locale: BBLocale) -> String {
        guard let date = CalendarDate(iso: iso) else { return iso }
        return formatDate(date, .dMMMy, locale: locale)
    }

    /// `formatLongDate(date)` → "29 ottobre 2026".
    public static func formatLongDate(_ date: CalendarDate, locale: BBLocale) -> String {
        formatDate(date, .dMMMMy, locale: locale)
    }

    /// `formatMonthLabel("2026-03")` → "marzo 2026" (lower case as in CLDR; callers capitalize if needed).
    public static func formatMonthLabel(_ key: String, locale: BBLocale) -> String {
        let parts = key.split(separator: "-")
        guard parts.count >= 2, let y = Int(parts[0]), let m = Int(parts[1]) else { return key }
        return formatDate(CalendarDate.js(year: y, monthIndex: m - 1, day: 1), .MMMMy, locale: locale)
    }

    /// Alias of `formatMonthLabel` for a date (debts' `formatMonthYear`: "febbraio 2027").
    public static func formatMonthYear(_ date: CalendarDate, locale: BBLocale) -> String {
        formatDate(date.startOfMonth, .MMMMy, locale: locale)
    }

    /// `shortMonthLabel(month)` with a 1-based month (stand-alone abbreviation, first "." removed):
    /// it "gen", en "Sept", de "Mär".
    public static func shortMonthLabel(_ month: Int, locale: BBLocale) -> String {
        let t = FormatLocaleData.table(locale)
        let index = ((month - 1) % 12 + 12) % 12
        let label = t.monthsShort[index]
        guard let dot = label.firstIndex(of: ".") else { return label }
        var out = label
        out.remove(at: dot)
        return out
    }

    /// `shortMonthLabel("YYYY-MM")`.
    public static func shortMonthLabel(_ key: String, locale: BBLocale) -> String {
        let m = Int(key.dropFirst(5).prefix(2)) ?? 1
        return shortMonthLabel(m, locale: locale)
    }

    /// Stand-alone month name (`{month:"long"}`), lower case in it.
    public static func monthName(_ month: Int, locale: BBLocale) -> String {
        FormatLocaleData.table(locale).monthsLong[((month - 1) % 12 + 12) % 12]
    }

    /// Stand-alone abbreviated month (`{month:"short"}`, without the dot removal of `shortMonthLabel`).
    public static func monthNameShort(_ month: Int, locale: BBLocale) -> String {
        FormatLocaleData.table(locale).monthsShort[((month - 1) % 12 + 12) % 12]
    }

    /// Upper-cases only the first character ("ottobre 2026" → "Ottobre 2026"), like the web's `capitalize`.
    public static func capitalize(_ text: String) -> String {
        guard let first = text.first else { return text }
        return String(first).uppercased() + text.dropFirst()
    }

    /// Movement-feed day header (`dayLabel`): "Oggi" / "Ieri" (Italian **catalog keys**, translate them in the UI),
    /// otherwise "lunedì 5 ottobre", with the year when it is not the current one.
    public static func dayLabel(_ date: CalendarDate, today: CalendarDate, locale: BBLocale) -> String {
        if date == today { return "Oggi" }
        if date == today.adding(days: -1) { return "Ieri" }
        return formatDate(date, date.year != today.year ? .EEEEdMMMMy : .EEEEdMMMM, locale: locale)
    }

    // MARK: Relative time

    /// `formatRelativeTime(date, now)`. it-IT: "adesso", "5 min fa", "3 h fa", "1 giorno fa", "2 giorni fa";
    /// en/de: `Intl.RelativeTimeFormat(numeric:"auto")` ("now", "yesterday", "vor 5 Minuten", "vorgestern").
    /// From 7 days on: `d MMM` of `date` in `timeZone` (the device zone in the app).
    public static func formatRelativeTime(_ date: Date, now: Date, locale: BBLocale, timeZone: TimeZone = .current) -> String {
        let diffMs = ((now.timeIntervalSince1970 - date.timeIntervalSince1970) * 1000).rounded()
        let minuteMs = 60_000.0, hourMs = 3_600_000.0, dayMs = 86_400_000.0
        let fallback = { formatDate(CalendarDate.of(date, in: timeZone), .dMMM, locale: locale) }
        if locale == .itIT {
            if diffMs < minuteMs { return "adesso" }
            if diffMs < hourMs { return "\(Int((diffMs / minuteMs).rounded(.down))) min fa" }
            if diffMs < dayMs { return "\(Int((diffMs / hourMs).rounded(.down))) h fa" }
            if diffMs < 7 * dayMs {
                let days = Int((diffMs / dayMs).rounded(.down))
                return days == 1 ? "1 giorno fa" : "\(days) giorni fa"
            }
            return fallback()
        }
        let minutes = max(0, Int((diffMs / minuteMs).rounded(.down)))
        let r = RelativeStrings.table(locale)
        if minutes < 1 { return r.now }
        if minutes < 60 { return (minutes == 1 ? r.minuteOne : r.minuteOther).replacingOccurrences(of: "{0}", with: String(minutes)) }
        if minutes < 1440 {
            let h = minutes / 60
            return (h == 1 ? r.hourOne : r.hourOther).replacingOccurrences(of: "{0}", with: String(h))
        }
        if minutes < 10080 {
            let d = minutes / 1440
            if d == 1 { return r.yesterday }
            if d == 2, let dayBefore = r.dayBeforeYesterday { return dayBefore }
            return r.dayOther.replacingOccurrences(of: "{0}", with: String(d))
        }
        return fallback()
    }

    /// CLDR 48 relative-time strings for the past (`numeric:"auto"`). it-IT uses the custom web strings above.
    struct RelativeStrings {
        let now, minuteOne, minuteOther, hourOne, hourOther, yesterday: String
        let dayBeforeYesterday: String?
        let dayOther: String

        static func table(_ locale: BBLocale) -> RelativeStrings {
            switch locale {
            case .deDE:
                RelativeStrings(now: "jetzt", minuteOne: "vor {0} Minute", minuteOther: "vor {0} Minuten",
                                hourOne: "vor {0} Stunde", hourOther: "vor {0} Stunden", yesterday: "gestern",
                                dayBeforeYesterday: "vorgestern", dayOther: "vor {0} Tagen")
            default:
                RelativeStrings(now: "now", minuteOne: "{0} minute ago", minuteOther: "{0} minutes ago",
                                hourOne: "{0} hour ago", hourOther: "{0} hours ago", yesterday: "yesterday",
                                dayBeforeYesterday: nil, dayOther: "{0} days ago")
            }
        }
    }

    // MARK: Durations and lists

    /// Two-item conjunction list (`Intl.ListFormat(long, conjunction)`): "A e B", "A and B", "A und B".
    public static func formatList(_ items: [String], locale: BBLocale) -> String {
        switch items.count {
        case 0: return ""
        case 1: return items[0]
        case 2:
            let pattern = FormatLocaleData.table(locale).listConjunction2
            guard let a = pattern.firstIndex(of: "A"), let b = pattern.lastIndex(of: "B") else { return items.joined(separator: " ") }
            return String(pattern[..<a]) + items[0] + String(pattern[pattern.index(after: a)..<b]) + items[1]
                + String(pattern[pattern.index(after: b)...])
        default:
            // Not used by the web today; CLDR it/en/de: "A, B e C".
            return items.dropLast().joined(separator: ", ") + formatList(["", items.last!], locale: locale)
        }
    }

    /// Catalog keys used by `formatDuration`, with their en/de translations (web catalogs). Pass `translate`
    /// to resolve them through the generated string catalog instead.
    static let durationKeys: [String: [BBLanguage: String]] = [
        "{0} anno": [.en: "{0} year", .de: "{0} Jahr"],
        "{0} anni": [.en: "{0} years", .de: "{0} Jahre"],
        "{0} mese": [.en: "{0} month", .de: "{0} Monat"],
        "{0} mesi": [.en: "{0} months", .de: "{0} Monate"],
        "0 mesi": [.en: "0 months", .de: "0 Monate"],
    ]

    /// `formatDuration(months)`: "2 anni e 1 mese", "2 years and 1 month", "2 Jahre und 1 Monat"; 0 → "0 mesi".
    public static func formatDuration(_ months: Int, language: BBLanguage,
                                      translate: ((String) -> String)? = nil) -> String {
        let tr: (String, Int?) -> String = { key, n in
            let template = translate?(key) ?? (language == .it ? key : durationKeys[key]?[language] ?? key)
            return n.map { interpolate(template, ["0": String($0)]) } ?? template
        }
        let years = months / 12
        let rest = months % 12
        var parts: [String] = []
        if years > 0 { parts.append(tr(years == 1 ? "{0} anno" : "{0} anni", years)) }
        if rest > 0 { parts.append(tr(rest == 1 ? "{0} mese" : "{0} mesi", rest)) }
        return parts.isEmpty ? tr("0 mesi", nil) : formatList(parts, locale: BBLocale(language: language))
    }

    /// `{name}` placeholder replacement of the web's `translate` (regex `\{(\w+)\}`); unknown placeholders stay.
    public static func interpolate(_ template: String, _ values: [String: String]) -> String {
        var out = ""
        var rest = Substring(template)
        while let open = rest.firstIndex(of: "{") {
            out += rest[..<open]
            let afterOpen = rest.index(after: open)
            var end = afterOpen
            while end < rest.endIndex, rest[end].isASCII, rest[end].isLetter || rest[end].isNumber || rest[end] == "_" {
                end = rest.index(after: end)
            }
            if end > afterOpen, end < rest.endIndex, rest[end] == "}" {
                let name = String(rest[afterOpen..<end])
                out += values[name] ?? String(rest[open...end])
                rest = rest[rest.index(after: end)...]
            } else {
                out += "{"
                rest = rest[afterOpen...]
            }
        }
        out += rest
        return out
    }
}
