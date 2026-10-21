import Foundation

/// Formatting locale. Derived from the **account language**, never from the device
/// (`it → it-IT`, `en → en-GB`, `de → de-DE`).
public enum BBLocale: String, CaseIterable, Sendable {
    case itIT = "it-IT"
    case enGB = "en-GB"
    case deDE = "de-DE"

    public var tag: String { rawValue }
    public init?(tag: String) { self.init(rawValue: tag) }

    public init(language: BBLanguage) {
        switch language {
        case .it: self = .itIT
        case .en: self = .enGB
        case .de: self = .deDE
        }
    }

    public var language: BBLanguage {
        switch self {
        case .itIT: .it
        case .enGB: .en
        case .deDE: .de
        }
    }
}

/// Account language (`user.language`).
public enum BBLanguage: String, CaseIterable, Sendable {
    case it, en, de
}

/// Date skeletons the web uses (`locale-data.json → dateSkeletonsSample`).
public enum BBDateSkeleton: String, CaseIterable, Sendable {
    case dMMM = "d MMM"
    case dMMMy = "d MMM y"
    case dMMMMy = "d MMMM y"
    case dMMMM = "d MMMM"
    case MMMMy = "MMMM y"
    case MMMy = "MMM y"
    case MMMyy = "MMM yy"
    case dMMMyy = "d MMM yy"
    case ddMMMy = "dd MMM y"
    case EEEEdMMMM = "EEEE d MMMM"
    case EEEEdMMMMy = "EEEE d MMMM y"
    case EEEdMMMMy = "EEE d MMMM y"
    case HHmm = "HH:mm"
}

/// One locale's tables, loaded from the bundled copy of `spec/domain/locale-data/locale-data.json`
/// (exported from the web's ICU). Refresh: copy the spec file over
/// `Sources/BuddyBudgetKit/Domain/LocaleData/locale-data.json`; `vector-check` and the tests fail
/// while the two copies differ.
struct FormatLocaleTable: Sendable {
    struct CurrencyPattern: Sendable {
        let pattern: String
        let symbol: String
    }

    struct CompactEntry: Sendable {
        /// Power of ten the value is divided by (0 = not abbreviated, e.g. de-DE thousands).
        let divisorExponent: Int
        let prefix: String
        let suffix: String
    }

    let decimal: String
    let group: String
    let minimumGroupingDigits: Int
    let minusSign: String
    let percentPattern: String
    let currency: [String: CurrencyPattern]
    /// Indexed by magnitude (floor(log10)) 3…14.
    let compact: [Int: CompactEntry]
    let monthsLong: [String]
    /// Stand-alone `{month:"short"}` (de "Mär", "Sep").
    let monthsShort: [String]
    /// Format-context abbreviation used inside dates (de "März", "Sept.", it "set").
    let monthsAbbreviated: [String]
    let weekdaysLong: [String]
    let weekdaysShort: [String]
    /// Skeleton → template with `{d}`, `{dd}`, `{MMM}`, `{MMMM}`, `{y}`, `{yy}`, `{EEEE}`, `{EEE}`, `{HH}`, `{mm}`.
    let dateTemplates: [BBDateSkeleton: String]
    /// "A e B" → the two-item conjunction.
    let listConjunction2: String
}

enum FormatLocaleData {
    static let tables: [BBLocale: FormatLocaleTable] = {
        guard let url = Bundle.module.url(forResource: "locale-data", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            fatalError("BuddyBudgetKit: locale-data.json resource missing")
        }
        do {
            return try load(data)
        } catch {
            fatalError("BuddyBudgetKit: invalid locale-data.json: \(error)")
        }
    }()

    /// Raw bytes of the bundled locale data (tests compare them with the spec copy).
    static func bundledData() -> Data? {
        Bundle.module.url(forResource: "locale-data", withExtension: "json").flatMap { try? Data(contentsOf: $0) }
    }

    static func table(_ locale: BBLocale) -> FormatLocaleTable { tables[locale]! }

    private struct RawFile: Decodable {
        let locales: [String: RawLocale]
    }

    private struct RawLocale: Decodable {
        struct Currency: Decodable { let pattern: String; let symbol: String }
        struct Skeletons: Decodable { let outputs: [String: String] }
        let decimal: String
        let group: String
        let minimumGroupingDigits: Int
        let minusSign: String
        let percentPattern: String
        let currency: [String: Currency]
        let compact: [String: String]
        let monthsLong: [String]
        let monthsShort: [String]
        let monthsShortInDate: [String]
        let weekdaysLong: [String]
        let weekdaysShort: [String]
        let dateSkeletonsSample: Skeletons
        let listConjunction2: String
    }

    enum LoadError: Error { case invalid(String) }

    static func load(_ data: Data) throws -> [BBLocale: FormatLocaleTable] {
        let file = try JSONDecoder().decode(RawFile.self, from: data)
        var result: [BBLocale: FormatLocaleTable] = [:]
        for locale in BBLocale.allCases {
            guard let raw = file.locales[locale.tag] else { throw LoadError.invalid("missing \(locale.tag)") }
            result[locale] = try build(raw)
        }
        return result
    }

    private static func build(_ raw: RawLocale) throws -> FormatLocaleTable {
        // Compact: "1 Mln" for 1e6 → divide by 1e6, suffix " Mln"; "10.000" (de, 1e4) → not abbreviated.
        var known: [(power: Int, entry: FormatLocaleTable.CompactEntry)] = []
        for (key, output) in raw.compact {
            guard let value = Double(key) else { throw LoadError.invalid("compact key \(key)") }
            let power = Int((log10(value)).rounded())
            let chars = Array(output)
            guard let start = chars.firstIndex(where: { $0.isASCII && $0.isNumber }) else { throw LoadError.invalid("compact \(output)") }
            var end = start
            while end < chars.count, (chars[end].isASCII && chars[end].isNumber) || String(chars[end]) == raw.group { end += 1 }
            let shown = String(chars[start..<end]).filter { $0.isASCII && $0.isNumber }
            let shownPower = shown.count - 1
            known.append((power, .init(divisorExponent: power - shownPower, prefix: String(chars[..<start]), suffix: String(chars[end...]))))
        }
        known.sort { $0.power < $1.power }
        var compact: [Int: FormatLocaleTable.CompactEntry] = [:]
        for magnitude in 3...14 {
            if let best = known.last(where: { $0.power <= magnitude }) { compact[magnitude] = best.entry }
        }

        // Format-context month abbreviation: "1. Jan." → "Jan.", "1 set" → "set".
        let stripped = raw.monthsShortInDate.map { String($0.drop(while: { $0 == "1" })) }
        var commonPrefix = 0
        if let first = stripped.first {
            let firstChars = Array(first)
            outer: while commonPrefix < firstChars.count {
                let c = firstChars[commonPrefix]
                if c.isLetter { break }
                for s in stripped {
                    let a = Array(s)
                    if commonPrefix >= a.count || a[commonPrefix] != c { break outer }
                }
                commonPrefix += 1
            }
        }
        let abbreviated = stripped.map { String($0.dropFirst(commonPrefix)) }

        // Date templates from the sample date: Sunday 6 September 2026, 14:05.
        var templates: [BBDateSkeleton: String] = [:]
        for skeleton in BBDateSkeleton.allCases {
            guard var out = raw.dateSkeletonsSample.outputs[skeleton.rawValue] else {
                throw LoadError.invalid("skeleton \(skeleton.rawValue)")
            }
            let fields = skeleton.rawValue.split(whereSeparator: { !$0.isLetter }).map(String.init)
            let order = ["EEEE", "EEE", "MMMM", "MMM", "y", "yy", "HH", "mm", "dd", "d"]
            let samples: [String: String] = [
                "EEEE": raw.weekdaysLong[6], "EEE": raw.weekdaysShort[6], "MMMM": raw.monthsLong[8],
                "MMM": abbreviated[8], "y": "2026", "yy": "26", "HH": "14", "mm": "05", "dd": "06", "d": "6",
            ]
            for field in order where fields.contains(field) {
                guard let sample = samples[field], let range = out.range(of: sample) else {
                    throw LoadError.invalid("field \(field) not found in \(out)")
                }
                out.replaceSubrange(range, with: "{\(field)}")
            }
            templates[skeleton] = out
        }

        return FormatLocaleTable(
            decimal: raw.decimal, group: raw.group, minimumGroupingDigits: raw.minimumGroupingDigits,
            minusSign: raw.minusSign, percentPattern: raw.percentPattern,
            currency: raw.currency.mapValues { .init(pattern: $0.pattern, symbol: $0.symbol) },
            compact: compact, monthsLong: raw.monthsLong, monthsShort: raw.monthsShort,
            monthsAbbreviated: abbreviated, weekdaysLong: raw.weekdaysLong, weekdaysShort: raw.weekdaysShort,
            dateTemplates: templates, listConjunction2: raw.listConjunction2
        )
    }
}
