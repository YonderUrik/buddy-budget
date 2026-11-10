import Foundation

// Port of the web's `lib/pension/import/mapping.ts` and `plan.ts` (PEN-014…018): a CSV/TXT/XLSX file (read on the
// device, `ImportXlsx` for Excel) or pasted text, and the downloadable template. Same names on Android (`PensionImport.kt`).

/// Snapshot fields a column can feed.
public enum PensionImportField: String, Sendable, CaseIterable {
    case date, netContributions, value

    public var label: String {
        switch self {
        case .date: "Data"
        case .netContributions: "Contributi netti"
        case .value: "Controvalore"
        }
    }
}

/// `PensionImportTable`.
public struct PensionImportTable: Equatable, Sendable {
    public let headers: [String]
    public let rows: [[String]]
    /// Decimal separator assumed when the values don't reveal it (comma for `;` CSVs, dot otherwise).
    public let decimalFallback: ImportDecimalSeparator

    public init(headers: [String], rows: [[String]], decimalFallback: ImportDecimalSeparator) {
        self.headers = headers
        self.rows = rows
        self.decimalFallback = decimalFallback
    }
}

/// `PensionImportMapping`.
public struct PensionImportMapping: Equatable, Sendable {
    public var columns: [PensionImportField: Int]
    public var dateOrder: ImportDateOrder
    public var decimal: ImportDecimalSeparator

    public init(columns: [PensionImportField: Int], dateOrder: ImportDateOrder, decimal: ImportDecimalSeparator) {
        self.columns = columns
        self.dateOrder = dateOrder
        self.decimal = decimal
    }
}

/// `ImportedSnapshot` (line 1 = headers).
public struct PensionImportedSnapshot: Equatable, Sendable {
    public let line: Int
    public let date: String
    public let netContributions: Double
    public let value: Double
}

/// `PensionImportRow`.
public enum PensionImportRow: Equatable, Sendable {
    case ok(PensionImportedSnapshot)
    case error(line: Int, message: String)

    public var line: Int {
        switch self {
        case .ok(let s): s.line
        case .error(let line, _): line
        }
    }
}

/// `PlannedSnapshotRow`.
public struct PensionPlannedRow: Equatable, Sendable {
    public enum Status: String, Sendable { case new, update, unchanged, error }

    public let line: Int
    public let date: String
    public let status: Status
    /// Italian source (catalog key) with values.
    public let message: String?
    public let messageValues: [String: String]
    public let previous: (netContributions: Double, value: Double)?

    public static func == (a: PensionPlannedRow, b: PensionPlannedRow) -> Bool {
        a.line == b.line && a.date == b.date && a.status == b.status && a.message == b.message && a.messageValues == b.messageValues
            && a.previous?.netContributions == b.previous?.netContributions && a.previous?.value == b.previous?.value
    }
}

/// `SnapshotImportPlan`.
public struct PensionImportPlan: Equatable, Sendable {
    public let rows: [PensionPlannedRow]
    public let counts: PensionImportCounts
    /// Whole-import problem (too many snapshots): Italian source + values.
    public let error: String?
    public let errorValues: [String: String]

    /// Nothing new or changed.
    public var nothingToWrite: Bool { counts.new + counts.update == 0 }
    /// Any row error or a whole-import error blocks the import (PEN-016).
    public var blocked: Bool { counts.error > 0 || error != nil }
}

public enum PensionImport {
    static let headerSynonyms: [PensionImportField: [String]] = [
        .date: ["data", "date", "datariferimento", "datadiriferimento", "dataposizione", "dataaggiornamento", "datavalore", "datavaluta"],
        .netContributions: ["contributinetti", "contributonetto", "netcontributions", "versamentinetti", "totaleversato", "versato",
                            "contributiversati", "contributi", "contributions", "versamenti"],
        .value: ["controvalore", "controvaloreattuale", "valoreposizione", "posizionematurata", "posizione", "montante", "saldo", "valore",
                 "value", "balance", "patrimonio"],
    ]
    static let maxAmount = 1e8

    /// `PENSION_TEMPLATE_HEADERS` and the template rows (PEN-018).
    public static let templateHeaders = ["Data", "Contributi netti", "Controvalore"]
    public static let templateFileName = "buddybudget-modello-pensione.csv"
    static let templateRows = [["31/03/2026", "10880,00", "11250,40"], ["30/06/2026", "11420,00", "11890,15"]]

    /// `pensionTemplateCsv`: `;`-separated, decimal comma, day/month/year. The download prepends a UTF-8 BOM.
    public static func templateCsv() -> String {
        ([templateHeaders] + templateRows).map { $0.joined(separator: ";") }.joined(separator: "\n")
    }

    /// The template file as downloaded (BOM so Excel shows the accents).
    public static func templateData() -> Data { Data(("\u{FEFF}" + templateCsv()).utf8) }

    /// Table of an Excel sheet (`readXlsx`: decimals with the dot).
    public static func table(_ grid: ImportGrid) -> PensionImportTable {
        PensionImportTable(headers: grid.headers, rows: grid.rows, decimalFallback: .dot)
    }

    /// `readCsvTable`: pasted text or CSV.
    public static func readTable(_ text: String) -> PensionImportTable {
        let table = ImportCsv.parse(text)
        return PensionImportTable(headers: table.headers, rows: table.rows, decimalFallback: table.delimiter == ";" ? .comma : .dot)
    }

    /// `suggestPensionColumns`: exact synonyms first, then long-synonym prefixes.
    public static func suggestColumns(_ headers: [String]) -> [PensionImportField: Int] {
        let normalized = headers.map(ImportValues.normalizeHeader)
        var used = Set<Int>()
        var columns: [PensionImportField: Int] = [:]
        for exact in [true, false] {
            for field in PensionImportField.allCases where columns[field] == nil {
                for synonym in headerSynonyms[field] ?? [] {
                    let index = normalized.indices.first { i in
                        !used.contains(i) && (exact ? normalized[i] == synonym : synonym.count >= 6 && normalized[i].hasPrefix(synonym))
                    }
                    if let index {
                        columns[field] = index
                        used.insert(index)
                        break
                    }
                }
            }
        }
        return columns
    }

    static func columnValues(_ table: PensionImportTable, _ column: Int?) -> [String] {
        guard let column else { return [] }
        return table.rows.map { column < $0.count ? $0[column] : "" }.filter { !JSNumber.trim($0).isEmpty }
    }

    /// `initialPensionMapping`.
    public static func initialMapping(_ table: PensionImportTable) -> PensionImportMapping {
        let columns = suggestColumns(table.headers)
        let numbers = columnValues(table, columns[.netContributions]) + columnValues(table, columns[.value])
        return PensionImportMapping(columns: columns, dateOrder: ImportValues.detectDateOrder(columnValues(table, columns[.date])),
                                    decimal: ImportValues.detectDecimalSeparator(numbers, fallback: table.decimalFallback))
    }

    /// `missingPensionFields`: labels (Italian source) of fields without a column.
    public static func missingFields(_ mapping: PensionImportMapping) -> [String] {
        PensionImportField.allCases.filter { mapping.columns[$0] == nil }.map(\.label)
    }

    /// `normalizePensionRows`: each row read with the mapping; invalid rows become errors (never throws).
    public static func normalizeRows(_ table: PensionImportTable, _ mapping: PensionImportMapping, today: String) -> [PensionImportRow] {
        guard let date = mapping.columns[.date], let net = mapping.columns[.netContributions], let value = mapping.columns[.value] else { return [] }
        return table.rows.enumerated().map { i, cells in
            let line = i + 2
            func cell(_ c: Int) -> String { c < cells.count ? cells[c] : "" }
            guard let iso = ImportValues.parseDate(cell(date), order: mapping.dateOrder) else { return .error(line: line, message: "Data non valida") }
            guard PensionRules.isPlausibleDate(iso, today: today) else { return .error(line: line, message: "Data nel futuro o troppo vecchia") }
            let n = ImportValues.parseNumber(cell(net), decimal: mapping.decimal)
            let v = ImportValues.parseNumber(cell(value), decimal: mapping.decimal)
            guard let n else { return .error(line: line, message: "Contributi netti non validi") }
            guard let v else { return .error(line: line, message: "Controvalore non valido") }
            if n < 0 || v < 0 || n > maxAmount || v > maxAmount { return .error(line: line, message: "Importo fuori dai limiti") }
            return .ok(PensionImportedSnapshot(line: line, date: iso, netContributions: n, value: v))
        }
    }

    static func cents(_ n: Double) -> Double { JSNumber.round(n * 100) }

    /// `planSnapshotImport`: new / update / unchanged / error per row, against the saved snapshots.
    public static func plan(_ incoming: [PensionImportedSnapshot], existing: [PensionSnapshot], today: String,
                            maxSnapshots: Int = PensionRules.maxSnapshots) -> PensionImportPlan {
        let saved = Dictionary(existing.map { ($0.date, $0) }, uniquingKeysWith: { a, _ in a })
        var seen: [String: PensionImportedSnapshot] = [:]
        func same(_ a: (Double, Double), _ b: (Double, Double)) -> Bool { cents(a.0) == cents(b.0) && cents(a.1) == cents(b.1) }
        let rows: [PensionPlannedRow] = incoming.map { snap in
            if !PensionRules.isPlausibleDate(snap.date, today: today) {
                return PensionPlannedRow(line: snap.line, date: snap.date, status: .error, message: "Data nel futuro o troppo vecchia",
                                         messageValues: [:], previous: nil)
            }
            if let earlier = seen[snap.date] {
                let equal = same((earlier.netContributions, earlier.value), (snap.netContributions, snap.value))
                return PensionPlannedRow(line: snap.line, date: snap.date, status: equal ? .unchanged : .error,
                                         message: equal ? "Uguale alla riga {0}" : "Stessa data della riga {0} con valori diversi",
                                         messageValues: ["0": String(earlier.line)], previous: nil)
            }
            seen[snap.date] = snap
            guard let current = saved[snap.date] else {
                return PensionPlannedRow(line: snap.line, date: snap.date, status: .new, message: nil, messageValues: [:], previous: nil)
            }
            let equal = same((current.netContributions, current.value), (snap.netContributions, snap.value))
            return PensionPlannedRow(line: snap.line, date: snap.date, status: equal ? .unchanged : .update, message: nil, messageValues: [:],
                                     previous: (current.netContributions, current.value))
        }
        let counts = PensionImportCounts(new: rows.filter { $0.status == .new }.count, update: rows.filter { $0.status == .update }.count,
                                         unchanged: rows.filter { $0.status == .unchanged }.count, error: rows.filter { $0.status == .error }.count)
        let tooMany = existing.count + counts.new > maxSnapshots
        return PensionImportPlan(rows: rows, counts: counts, error: tooMany ? "Il fondo avrebbe più di {0} fotografie" : nil,
                                 errorValues: tooMany ? ["0": String(maxSnapshots)] : [:])
    }
}

/// State of the «Importa le fotografie» wizard (paste → columns → summary). Same fields as `PensionImportState` on Android.
public struct PensionImportState: Equatable, Sendable {
    public enum Step: String, Sendable, CaseIterable {
        case file, columns, summary

        public var label: String {
            switch self {
            case .file: "File"
            case .columns: "Colonne"
            case .summary: "Riepilogo"
            }
        }
    }

    public var step: Step = .file
    public var text = ""
    /// Name of the file read (nil for pasted text).
    public var fileName: String?
    /// Italian source of the file-step error (unreadable file or table without rows).
    public var error: String?
    public var table: PensionImportTable?
    public var mapping: PensionImportMapping?
    public var done: PensionImportCounts?
    public let today: String
    public let existing: [PensionSnapshot]

    public init(today: String, existing: [PensionSnapshot]) {
        self.today = today
        self.existing = existing
    }

    /// «Leggi»: reads the pasted rows and guesses the mapping (`Leggi` disabled with blank text).
    public mutating func read() {
        guard !JSNumber.trim(text).isEmpty else { return }
        load(PensionImport.readTable(text), name: nil)
    }

    /// `load`: a table from a file or pasted text; needs headers and at least one row.
    public mutating func load(_ table: PensionImportTable, name: String?) {
        guard table.headers.count >= 2, !table.rows.isEmpty else {
            error = "Il file non sembra una tabella con intestazioni e almeno una riga"
            return
        }
        self.table = table
        mapping = PensionImport.initialMapping(table)
        fileName = name
        error = nil
        step = .columns
    }

    /// PEN-014: a picked file (CSV/TXT as UTF-8 text, XLSX first sheet).
    public mutating func loadFile(name: String, data: Data) {
        if name.lowercased().hasSuffix(".xlsx") {
            do {
                load(PensionImport.table(try ImportXlsx.read(data)), name: name)
            } catch let failure as ImportXlsxError {
                error = failure.text
            } catch {
                self.error = "Non riesco a leggere il file"
            }
        } else {
            load(PensionImport.readTable(String(decoding: data, as: UTF8.self)), name: name)
        }
    }

    public var rows: [PensionImportRow] {
        guard let table, let mapping else { return [] }
        return PensionImport.normalizeRows(table, mapping, today: today)
    }

    public var snapshots: [PensionImportedSnapshot] {
        rows.compactMap { if case .ok(let s) = $0 { return s } else { return nil } }
    }

    public var problems: [PensionImportRow] { rows.filter { if case .error = $0 { return true } else { return false } } }
    public var missing: [String] { mapping.map(PensionImport.missingFields) ?? [] }
    public var plan: PensionImportPlan { PensionImport.plan(snapshots, existing: existing, today: today) }

    /// PEN-015: «Avanti» needs every field mapped and at least one valid row.
    public var canContinue: Bool { missing.isEmpty && !snapshots.isEmpty }
    /// PEN-017: max 1000 rows per import.
    public var tooManyRows: Bool { snapshots.count > PensionRules.importMaxRows }

    public var payload: [PensionImportRowInput] {
        snapshots.map { PensionImportRowInput(line: $0.line, date: $0.date, netContributions: $0.netContributions, value: $0.value) }
    }

    public mutating func back() {
        switch step {
        case .summary: step = .columns
        case .columns: step = .file
        case .file: break
        }
    }
}
