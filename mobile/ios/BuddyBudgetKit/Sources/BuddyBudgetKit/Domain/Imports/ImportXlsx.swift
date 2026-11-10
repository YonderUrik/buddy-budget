import Compression
import Foundation

// Port of the web's `lib/pension/import/xlsx.ts` (`readXlsx`) and `gridToCsv` (`lib/investments/import/fineco.ts`):
// the first sheet of an `.xlsx` file read on the device as a text grid, then turned into the same CSV text the web
// sends, so a format derived on the web reads a mobile upload identically (IMP-018, INV-093, PEN-014).
// Same names on Android (`ImportXlsx.kt`).

/// Text grid of the first sheet: the first non-empty row is the header.
public struct ImportGrid: Equatable, Sendable {
    public let headers: [String]
    public let rows: [[String]]
}

public enum ImportXlsxError: Error, Equatable, Sendable {
    /// Italian source of the user message (translate with the catalog).
    case message(String)

    public var text: String {
        switch self { case .message(let m): m }
    }
}

public enum ImportXlsx {
    /// `XLSX_MAX_FILE_BYTES`: largest Excel file accepted.
    public static let maxFileBytes = 5 * 1024 * 1024
    /// Largest part once decompressed (stops zip bombs).
    static let maxPartBytes = 20 * 1024 * 1024
    /// `XLSX_MAX_ROWS`.
    public static let maxRows = 5000
    static let excelEpochOffsetDays = 25569.0
    static let builtinDateFormats: Set<Int> = [14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52,
                                               53, 54, 55, 56, 57, 58]

    /// `readXlsx`: throws an `ImportXlsxError` with the web's Italian message.
    public static func read(_ data: Data) throws -> ImportGrid {
        if data.count > maxFileBytes { throw ImportXlsxError.message("Il file Excel è troppo grande") }
        let wanted: (String) -> Bool = { name in
            name == "xl/sharedStrings.xml" || name == "xl/styles.xml" || name.hasPrefix("xl/worksheets/sheet")
                || name.hasPrefix("xl/workbook.xml") || name == "xl/_rels/workbook.xml.rels"
        }
        let files: [String: Data]
        do {
            files = try ZipReader.entries(data, filter: wanted, maxSize: maxPartBytes)
        } catch {
            throw ImportXlsxError.message("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV")
        }
        guard let sheetPath = firstSheetPath(files), let sheetData = files[sheetPath] else {
            throw ImportXlsxError.message("Non trovo nessun foglio nel file Excel")
        }
        let strings = sharedStrings(files["xl/sharedStrings.xml"].map(utf8))
        let dateStyle = dateStyles(files["xl/styles.xml"].map(utf8))
        let sheet = utf8(sheetData)

        var grid: [[String]] = []
        for rowMatch in matches(#"<row\b[^>]*?(?:/>|>([\s\S]*?)</row>)"#, in: sheet) {
            var row: [String] = []
            let rowBody = rowMatch[1] ?? ""
            for cellMatch in matches(#"<c\b([^>]*?)(?:/>|>([\s\S]*?)</c>)"#, in: rowBody) {
                let head = cellMatch[1] ?? ""
                let body = cellMatch[2] ?? ""
                let ref = attr(head, "r")
                let type = attr(head, "t")
                let raw = firstMatch(#"<v>([\s\S]*?)</v>"#, in: body)?[1] ?? ""
                var text = ""
                if type == "s" {
                    text = Int(raw).flatMap { $0 >= 0 && $0 < strings.count ? strings[$0] : nil } ?? ""
                } else if type == "inlineStr" {
                    text = textOf(body)
                } else if type == "str" || type == "e" || type == "b" {
                    text = decodeEntities(raw)
                } else if !raw.isEmpty {
                    let number = JSNumber.parse(raw)
                    let style = Int(attr(head, "s") ?? "0") ?? 0
                    if style >= 0, style < dateStyle.count, dateStyle[style] {
                        text = number.flatMap(excelSerialToIso) ?? raw
                    } else if let number, number.isFinite {
                        text = jsToString(number)
                    } else {
                        text = raw
                    }
                }
                let column = ref.map(columnIndex) ?? row.count
                while row.count < column { row.append("") }
                let trimmed = JSNumber.trim(text)
                if column < row.count { row[column] = trimmed } else { row.append(trimmed) }
            }
            grid.append(row)
            if grid.count > maxRows + 1 { throw ImportXlsxError.message("Il foglio ha troppe righe: al massimo \(maxRows)") }
        }
        let records = grid.filter { $0.contains { !$0.isEmpty } }
        return ImportGrid(headers: records.first ?? [], rows: Array(records.dropFirst()))
    }

    /// `gridToCsv`: cells → CSV text with `;`, quoting cells containing `;`, `"` or a new line.
    public static func gridToCsv(_ grid: [[String]]) -> String {
        func quote(_ cell: String) -> String {
            cell.contains(where: { $0 == ";" || $0 == "\"" || $0 == "\n" || $0 == "\r" || $0 == "\r\n" })
                ? "\"" + cell.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : cell
        }
        return grid.map { $0.map(quote).joined(separator: ";") }.joined(separator: "\n")
    }

    /// CSV text of a sheet (headers + rows), as the web sends it.
    public static func csv(_ data: Data) throws -> String {
        let sheet = try read(data)
        return gridToCsv([sheet.headers] + sheet.rows)
    }

    /// JS `String(number)` (same name as on Android).
    public static func jsToString(_ value: Double) -> String { JSNumber.toString(value) }

    /// `excelSerialToIso`: serial day number → `YYYY-MM-DD` (the time part is dropped).
    public static func excelSerialToIso(_ serial: Double) -> String? {
        guard serial.isFinite, serial >= 1 else { return nil }
        let days = (serial - excelEpochOffsetDays).rounded(.down)
        guard abs(days) < 1e8 else { return nil }
        return CalendarDate(year: 1970, month: 1, day: 1).adding(days: Int(days)).iso
    }

    // MARK: XML helpers (same regular expressions as the web)

    static func utf8(_ data: Data) -> String { String(decoding: data, as: UTF8.self) }

    static func decodeEntities(_ text: String) -> String {
        guard text.contains("&") else { return text }
        var out = text
        out = replace(#"&#x([0-9a-fA-F]+);"#, in: out) { m in
            UInt32(m[1] ?? "", radix: 16).flatMap(Unicode.Scalar.init).map { String(Character($0)) } ?? (m[0] ?? "")
        }
        out = replace(#"&#(\d+);"#, in: out) { m in
            UInt32(m[1] ?? "").flatMap(Unicode.Scalar.init).map { String(Character($0)) } ?? (m[0] ?? "")
        }
        return out.replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&apos;", with: "'")
            .replacingOccurrences(of: "&amp;", with: "&")
    }

    static func attr(_ tag: String, _ name: String) -> String? {
        firstMatch("(?:^|\\s)" + NSRegularExpression.escapedPattern(for: name) + "=\"([^\"]*)\"", in: tag)?[1].map(decodeEntities)
    }

    static func textOf(_ xml: String) -> String {
        decodeEntities(matches(#"<t(?:\s[^>]*)?>([\s\S]*?)</t>"#, in: xml).map { $0[1] ?? "" }.joined())
    }

    static func columnIndex(_ ref: String) -> Int {
        var index = 0
        for char in ref.uppercased() where char.isASCII && char.isLetter {
            index = index * 26 + Int(char.asciiValue!) - 64
        }
        return index - 1
    }

    static func isDateFormatCode(_ code: String) -> Bool {
        let stripped = replace(#""[^"]*"|\[[^\]]*\]|\\."#, in: code) { _ in "" }
        return stripped.range(of: "[dmyDMY]", options: .regularExpression) != nil
    }

    static func dateStyles(_ xml: String?) -> [Bool] {
        guard let xml else { return [] }
        var custom: [Int: Bool] = [:]
        for m in matches(#"<numFmt\s[^>]*>"#, in: xml) {
            let tag = m[0] ?? ""
            if let id = Int(attr(tag, "numFmtId") ?? "") { custom[id] = isDateFormatCode(attr(tag, "formatCode") ?? "") }
        }
        let cellXfs = firstMatch(#"<cellXfs[^>]*>([\s\S]*?)</cellXfs>"#, in: xml)?[1] ?? ""
        return matches(#"<xf\s[^>]*>"#, in: cellXfs).map { m in
            let id = Int(attr(m[0] ?? "", "numFmtId") ?? "") ?? -1
            return custom[id] ?? builtinDateFormats.contains(id)
        }
    }

    static func sharedStrings(_ xml: String?) -> [String] {
        guard let xml else { return [] }
        return matches(#"<si(?:\s[^>]*)?>([\s\S]*?)</si>"#, in: xml).map { textOf($0[1] ?? "") }
    }

    static func firstSheetPath(_ files: [String: Data]) -> String? {
        let workbook = files["xl/workbook.xml"].map(utf8)
        let rels = files["xl/_rels/workbook.xml.rels"].map(utf8)
        if let workbook, let sheetTag = firstMatch(#"<sheet\s[^>]*>"#, in: workbook)?[0], let rid = attr(sheetTag, "r:id"), let rels {
            for m in matches(#"<Relationship\s[^>]*>"#, in: rels) {
                let tag = m[0] ?? ""
                if attr(tag, "Id") == rid, let target = attr(tag, "Target") {
                    let path = target.hasPrefix("/") ? String(target.dropFirst()) : "xl/\(target)"
                    if files[path] != nil { return path }
                }
            }
        }
        return files.keys.sorted().first { $0.range(of: #"^xl/worksheets/sheet\d+\.xml$"#, options: .regularExpression) != nil }
    }

    /// Capture groups of every match (index 0 = whole match; nil = group not taking part).
    static func matches(_ pattern: String, in text: String) -> [[String?]] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { result in
            (0..<result.numberOfRanges).map { i in
                let r = result.range(at: i)
                return r.location == NSNotFound ? nil : ns.substring(with: r)
            }
        }
    }

    static func firstMatch(_ pattern: String, in text: String) -> [String?]? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let ns = text as NSString
        guard let result = regex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<result.numberOfRanges).map { i in
            let r = result.range(at: i)
            return r.location == NSNotFound ? nil : ns.substring(with: r)
        }
    }

    static func replace(_ pattern: String, in text: String, with transform: ([String?]) -> String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        let ns = text as NSString
        var out = ""
        var last = 0
        for result in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: result.range.location - last))
            let groups = (0..<result.numberOfRanges).map { i -> String? in
                let r = result.range(at: i)
                return r.location == NSNotFound ? nil : ns.substring(with: r)
            }
            out += transform(groups)
            last = result.range.location + result.range.length
        }
        out += ns.substring(from: last)
        return out
    }
}

/// Minimal ZIP reader (central directory; stored and deflated entries), enough for `.xlsx`. Throws on anything else.
enum ZipReader {
    struct Failure: Error {}

    static func entries(_ data: Data, filter: (String) -> Bool, maxSize: Int) throws -> [String: Data] {
        let bytes = [UInt8](data)
        func u16(_ o: Int) throws -> Int {
            guard o >= 0, o + 2 <= bytes.count else { throw Failure() }
            return Int(bytes[o]) | Int(bytes[o + 1]) << 8
        }
        func u32(_ o: Int) throws -> Int {
            guard o >= 0, o + 4 <= bytes.count else { throw Failure() }
            return Int(bytes[o]) | Int(bytes[o + 1]) << 8 | Int(bytes[o + 2]) << 16 | Int(bytes[o + 3]) << 24
        }
        // End of central directory: last occurrence of PK\5\6 within the final 64 KiB + 22 bytes.
        guard bytes.count >= 22 else { throw Failure() }
        var eocd = -1
        var i = bytes.count - 22
        let floor = max(0, bytes.count - 22 - 65_535)
        while i >= floor {
            if bytes[i] == 0x50, bytes[i + 1] == 0x4B, bytes[i + 2] == 0x05, bytes[i + 3] == 0x06 { eocd = i; break }
            i -= 1
        }
        guard eocd >= 0 else { throw Failure() }
        let count = try u16(eocd + 10)
        var offset = try u32(eocd + 16)
        var out: [String: Data] = [:]
        for _ in 0..<count {
            guard try u32(offset) == 0x0201_4B50 else { throw Failure() }
            let method = try u16(offset + 10)
            let compressed = try u32(offset + 20)
            let size = try u32(offset + 24)
            let nameLength = try u16(offset + 28)
            let extraLength = try u16(offset + 30)
            let commentLength = try u16(offset + 32)
            let local = try u32(offset + 42)
            guard offset + 46 + nameLength <= bytes.count else { throw Failure() }
            let name = String(decoding: bytes[(offset + 46)..<(offset + 46 + nameLength)], as: UTF8.self)
            offset += 46 + nameLength + extraLength + commentLength
            guard filter(name), size <= maxSize else { continue }
            guard try u32(local) == 0x0403_4B50 else { throw Failure() }
            let start = local + 30 + (try u16(local + 26)) + (try u16(local + 28))
            guard start >= 0, start + compressed <= bytes.count else { throw Failure() }
            let payload = Array(bytes[start..<(start + compressed)])
            switch method {
            case 0: out[name] = Data(payload)
            case 8: out[name] = try inflate(payload, size: size)
            default: throw Failure()
            }
        }
        return out
    }

    /// Raw DEFLATE (RFC 1951) via the Compression framework's `COMPRESSION_ZLIB`.
    static func inflate(_ input: [UInt8], size: Int) throws -> Data {
        if size == 0 { return Data() }
        var output = [UInt8](repeating: 0, count: size)
        let written = input.withUnsafeBufferPointer { src in
            output.withUnsafeMutableBufferPointer { dst in
                compression_decode_buffer(dst.baseAddress!, size, src.baseAddress!, input.count, nil, COMPRESSION_ZLIB)
            }
        }
        guard written == size else { throw Failure() }
        return Data(output)
    }
}

extension JSNumber {
    /// JS `String(number)` (Number::toString): shortest round-trip digits, exponent form outside 1e-7 ≤ |x| < 1e21.
    public static func toString(_ value: Double) -> String {
        if value.isNaN { return "NaN" }
        if value == 0 { return "0" }
        if value.isInfinite { return value < 0 ? "-Infinity" : "Infinity" }
        let sign = value < 0 ? "-" : ""
        // Swift's description is the shortest round-trip representation; extract digits and exponent.
        let description = "\(abs(value))"
        var mantissa = description
        var exponent = 0
        if let e = description.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = String(description[..<e])
            exponent = Int(description[description.index(after: e)...]) ?? 0
        }
        let parts = mantissa.split(separator: ".", omittingEmptySubsequences: false)
        let intPart = String(parts[0])
        let fracPart = parts.count > 1 ? String(parts[1]) : ""
        var digits = intPart + fracPart
        var point = intPart.count + exponent // decimal point position relative to digits start
        // Strip leading zeros.
        while digits.count > 1, digits.first == "0" {
            digits.removeFirst()
            point -= 1
        }
        while digits.count > 1, digits.last == "0" { digits.removeLast() }
        let k = digits.count
        let n = point
        if k <= n, n <= 21 { return sign + digits + String(repeating: "0", count: n - k) }
        if 0 < n, n <= 21 {
            let index = digits.index(digits.startIndex, offsetBy: n)
            return sign + digits[..<index] + "." + digits[index...]
        }
        if -6 < n, n <= 0 { return sign + "0." + String(repeating: "0", count: -n) + digits }
        let e = n - 1
        let expText = e < 0 ? "-\(-e)" : "+\(e)"
        if k == 1 { return sign + digits + "e" + expText }
        return sign + String(digits.first!) + "." + digits.dropFirst() + "e" + expText
    }
}
