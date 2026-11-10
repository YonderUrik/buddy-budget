import Foundation

// Ports of the web's `lib/investments/import/csv.ts` and `values.ts` (shared by every import: the Pensione paste
// import now, the CSV/Excel imports of Phase 4). Pure, no I/O. Same names on Android (`ImportParsing.kt`).

/// `DecimalSeparator`.
public enum ImportDecimalSeparator: String, Sendable, CaseIterable {
    case dot = "."
    case comma = ","
}

/// `DateOrder`: order of day, month and year (the separator is detected).
public enum ImportDateOrder: String, Sendable, CaseIterable {
    case ymd, dmy, mdy
}

/// `CsvTable`: headers and rows of trimmed cells.
public struct ImportCsvTable: Equatable, Sendable {
    public let delimiter: Character
    public let headers: [String]
    public let rows: [[String]]
}

public enum ImportCsv {
    /// Delimiters tried when the file doesn't declare one.
    public static let delimiters: [Character] = [",", ";", "\t", "|"]
    static let sampleLines = 10

    /// `parseCsvRecords` (non-strict): logical records, quoted fields may contain new lines.
    public static func records(_ text: String, delimiter: Character = ",") -> [[String]] {
        var records: [[String]] = []
        var record: [String] = []
        var field = ""
        var quoted = false
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let char = chars[i]
            if quoted {
                if char == "\"" && i + 1 < chars.count && chars[i + 1] == "\"" {
                    field.append("\"")
                    i += 1
                } else if char == "\"" {
                    quoted = false
                } else {
                    field.append(char)
                }
                i += 1
                continue
            }
            if char == "\"" && field.isEmpty {
                quoted = true
            } else if char == delimiter {
                record.append(field)
                field = ""
            } else if char == "\n" || char == "\r" || char == "\r\n" {
                if char == "\r" && i + 1 < chars.count && chars[i + 1] == "\n" { i += 1 }
                record.append(field)
                records.append(record)
                record = []
                field = ""
            } else {
                field.append(char)
            }
            i += 1
        }
        if !field.isEmpty || !record.isEmpty {
            record.append(field)
            records.append(record)
        }
        return records
    }

    /// `detectDelimiter`: the one giving the same number (> 1) of columns on the first lines; ties → more columns.
    public static func detectDelimiter(_ text: String) -> Character {
        let lines = text.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" || $0 == "\r\n" })
            .map { $0.hasSuffix("\r") ? String($0.dropLast()) : String($0) }
            .filter { !JSNumber.trim($0).isEmpty }
            .prefix(sampleLines)
        let sample = lines.joined(separator: "\n")
        var best: (delimiter: Character, score: Double) = (",", -1)
        for delimiter in delimiters {
            let counts = records(sample, delimiter: delimiter).map(\.count)
            guard let first = counts.first, first >= 2 else { continue }
            let consistent = Double(counts.filter { $0 == first }.count) / Double(counts.count)
            let score = consistent * 100 + Double(first)
            if score > best.score { best = (delimiter, score) }
        }
        return best.delimiter
    }

    /// `parseCsv`: strips the BOM, detects the delimiter, drops empty rows, trims cells.
    public static func parse(_ text: String, delimiter: Character? = nil) -> ImportCsvTable {
        let clean = text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
        let chosen = delimiter ?? detectDelimiter(clean)
        let all = records(clean, delimiter: chosen)
            .map { $0.map { JSNumber.trim($0) } }
            .filter { $0.contains { !$0.isEmpty } }
        return ImportCsvTable(delimiter: chosen, headers: all.first ?? [], rows: Array(all.dropFirst()))
    }
}

public enum ImportValues {
    /// `parseNumber`: drops spaces, currency symbols and codes and the thousands separator; `(x)` is negative.
    public static func parseNumber(_ raw: String, decimal: ImportDecimalSeparator) -> Double? {
        var text = JSNumber.trim(raw).filter { !" '€$£".contains($0) && !$0.isWhitespace }
        if text.count >= 3, text.prefix(3).allSatisfy({ $0.isASCII && $0.isUppercase }) {
            text = String(text.dropFirst(3))
        }
        if text.count >= 3, text.suffix(3).allSatisfy({ $0.isASCII && $0.isUppercase }) {
            text = String(text.dropLast(3))
        }
        if text.isEmpty || text == "-" { return nil }
        if text.count >= 2, text.first == "(", text.last == ")" { text = "-" + text.dropFirst().dropLast() }
        let thousands: Character = decimal == .dot ? "," : "."
        text = text.filter { $0 != thousands }
        if decimal == .comma, let comma = text.firstIndex(of: ",") { text.replaceSubrange(comma...comma, with: ".") }
        guard text.range(of: #"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$"#, options: .regularExpression) != nil,
              let value = Double(text), value.isFinite else { return nil }
        return value
    }

    /// `detectDecimalSeparator`: a comma wins when followed by ≠ 3 digits or after a dot; ties → `fallback`.
    public static func detectDecimalSeparator(_ values: [String], fallback: ImportDecimalSeparator = .dot) -> ImportDecimalSeparator {
        var comma = 0
        var dot = 0
        for raw in values {
            let v = Array(raw.filter { $0.isASCII && ($0.isNumber || $0 == "." || $0 == ",") })
            let lastComma = v.lastIndex(of: ",")
            let lastDot = v.lastIndex(of: ".")
            if let c = lastComma, let d = lastDot {
                if c > d { comma += 1 } else { dot += 1 }
            } else if let c = lastComma {
                if v.count - c - 1 != 3 { comma += 1 }
            } else if let d = lastDot {
                if v.count - d - 1 != 3 || (v.count >= 2 && v[0] == "0" && v[1] == ".") { dot += 1 }
            }
        }
        if comma == dot { return fallback }
        return comma > dot ? .comma : .dot
    }

    /// `parseDate`: `/ - .` or no separator, two-digit years (→ 20xx), a trailing time is ignored.
    public static func parseDate(_ raw: String, order: ImportDateOrder) -> String? {
        let text = String(JSNumber.trim(raw).split(whereSeparator: { $0 == "T" || $0.isWhitespace }).first ?? "")
        var parts: [String]
        if text.count == 8, text.allSatisfy({ $0.isASCII && $0.isNumber }) {
            let c = Array(text)
            parts = order == .ymd ? [String(c[0..<4]), String(c[4..<6]), String(c[6...])]
                : [String(c[0..<2]), String(c[2..<4]), String(c[4...])]
        } else {
            parts = text.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "/" || $0 == "." || $0 == "-" }).map(String.init)
        }
        guard parts.count == 3, parts.allSatisfy({ (1...4).contains($0.count) && $0.allSatisfy { $0.isASCII && $0.isNumber } }) else { return nil }
        let n = parts.compactMap { Int($0) }
        let (year, month, day): (Int, Int, Int)
        switch order {
        case .ymd: (year, month, day) = (n[0], n[1], n[2])
        case .dmy: (year, month, day) = (n[2], n[1], n[0])
        case .mdy: (year, month, day) = (n[2], n[0], n[1])
        }
        let fullYear = year < 100 ? 2000 + year : year
        guard fullYear >= 1900, fullYear <= 2200, (1...12).contains(month), day >= 1,
              day <= CalendarDate.daysInMonth(year: fullYear, month: month) else { return nil }
        return CalendarDate(year: fullYear, month: month, day: day).iso
    }

    /// `detectDateOrder`: the order that reads the most values; ties → dmy, then ymd, then mdy.
    public static func detectDateOrder(_ values: [String]) -> ImportDateOrder {
        var best: (order: ImportDateOrder, count: Int) = (.dmy, -1)
        for order in [ImportDateOrder.dmy, .ymd, .mdy] {
            let count = values.filter { parseDate($0, order: order) != nil }.count
            if count > best.count { best = (order, count) }
        }
        return best.order
    }

    /// `normalizeHeader`: lower case, no accents, only `a-z0-9` (`Quantità (n.)` → `quantitan`).
    public static func normalizeHeader(_ header: String) -> String {
        header.lowercased().folding(options: .diacriticInsensitive, locale: nil)
            .filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }
}
