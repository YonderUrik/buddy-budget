import Foundation

// Personal CSV / Excel imports (14-imports, IMP-*): pure rules ported from the web's `components/domain/personal-import/*`,
// `lib/personal-import/{island,preview-groups,review-groups}.ts`, `lib/queries/personal-imports.ts` and the import
// history of Investimenti (`components/domain/investments/import-history.ts`, INV-106). Same names on Android
// (`PersonalImport.kt`). Italian strings are catalog sources.

// MARK: - API model (`GET /api/personal-imports`)

public struct PersonalImportListing: Decodable, Equatable, Sendable {
    public struct Format: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let name: String
        public init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }

    /// Counts of a finished import. `rows` (movements in the file) and `alreadyPresent` exist since web #461 (older jobs
    /// have neither); `bankCategorized` since web #456.
    public struct Results: Decodable, Equatable, Sendable {
        public let cash: Int
        public let investments: Int
        public let skipped: Int
        public let bankCategorized: Int
        public let rows: Int?
        public let alreadyPresent: Int?

        public init(cash: Int, investments: Int, skipped: Int, bankCategorized: Int = 0, rows: Int? = nil, alreadyPresent: Int? = nil) {
            self.cash = cash
            self.investments = investments
            self.skipped = skipped
            self.bankCategorized = bankCategorized
            self.rows = rows
            self.alreadyPresent = alreadyPresent
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            cash = try c.decodeIfPresent(Int.self, forKey: .cash) ?? 0
            investments = try c.decodeIfPresent(Int.self, forKey: .investments) ?? 0
            skipped = try c.decodeIfPresent(Int.self, forKey: .skipped) ?? 0
            bankCategorized = try c.decodeIfPresent(Int.self, forKey: .bankCategorized) ?? 0
            rows = try c.decodeIfPresent(Int.self, forKey: .rows)
            alreadyPresent = try c.decodeIfPresent(Int.self, forKey: .alreadyPresent)
        }

        enum CodingKeys: String, CodingKey { case cash, investments, skipped, bankCategorized, rows, alreadyPresent }
    }

    public struct Job: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let formatId: String
        public let status: String
        public let correctionOf: String?
        public let estimatedAt: String
        public let expiresAt: String
        public let createdAt: String
        public let error: String?
        public let results: Results?

        public init(id: String, formatId: String, status: String, correctionOf: String? = nil, estimatedAt: String = "",
                    expiresAt: String = "", createdAt: String, error: String? = nil, results: Results? = nil) {
            self.id = id
            self.formatId = formatId
            self.status = status
            self.correctionOf = correctionOf
            self.estimatedAt = estimatedAt
            self.expiresAt = expiresAt
            self.createdAt = createdAt
            self.error = error
            self.results = results
        }
    }

    public let formats: [Format]
    public let jobs: [Job]

    public init(formats: [Format], jobs: [Job]) {
        self.formats = formats
        self.jobs = jobs
    }

    public func formatName(_ id: String) -> String? { formats.first { $0.id == id }?.name }
}

/// `GET /api/personal-imports/{id}` preview (amounts are JSON numbers in the source currency).
public struct PersonalImportPreview: Decodable, Equatable, Sendable {
    public struct Outcome: Decodable, Equatable, Sendable {
        public let row: Int
        public let kind: String
        public let date: String?
        public let currency: String?
        public let description: String?
        public let amount: Double?
        public let transfer: Bool?
        public let type: String?
        public let name: String?
        public let quantity: Double?
        public let price: Double?
        public let grossAmount: Double?
        public let reason: String?

        public init(row: Int, kind: String, date: String? = nil, currency: String? = nil, description: String? = nil, amount: Double? = nil,
                    transfer: Bool? = nil, type: String? = nil, name: String? = nil, quantity: Double? = nil, price: Double? = nil,
                    grossAmount: Double? = nil, reason: String? = nil) {
            self.row = row
            self.kind = kind
            self.date = date
            self.currency = currency
            self.description = description
            self.amount = amount
            self.transfer = transfer
            self.type = type
            self.name = name
            self.quantity = quantity
            self.price = price
            self.grossAmount = grossAmount
            self.reason = reason
        }
    }

    public struct Record: Decodable, Equatable, Sendable, Identifiable {
        public let key: String
        public let source: [String]
        public let line: Int?
        public let rate: Double?
        public let outcome: Outcome
        public var id: String { key }

        public init(key: String, source: [String], line: Int? = nil, rate: Double? = nil, outcome: Outcome) {
            self.key = key
            self.source = source
            self.line = line
            self.rate = rate
            self.outcome = outcome
        }
    }

    public let headers: [String]
    public let currency: String
    public let records: [Record]

    public init(headers: [String], currency: String, records: [Record]) {
        self.headers = headers
        self.currency = currency
        self.records = records
    }
}

/// `?correction=1` comparison.
public struct PersonalImportCorrection: Decodable, Equatable, Sendable {
    public struct CashRow: Decodable, Equatable, Sendable {
        public let date: String
        public let description: String
        public let amount: Double
        public let investment: Trade?
    }

    public struct Trade: Decodable, Equatable, Sendable {
        public let date: String?
        public let description: String?
        public let currency: String
        public let grossAmount: Double?
        public let type: String
        public let quantity: Double
        public let price: Double
        public let fees: Double
        public let taxes: Double
    }

    public let currency: String
    public let before: [CashRow]
    public let tradesBefore: [Trade]
    public let after: [CashRow]
    public let investmentsBefore: Int
    public let investmentsAfter: Int

    public var cashBefore: Double { before.reduce(0) { $0 + $1.amount } }
    public var cashAfter: Double { after.reduce(0) { $0 + $1.amount } }
    /// Proposed investment operations (the web's `after.flatMap(r => r.investment ? …)`).
    public var tradesAfter: [Trade] {
        after.compactMap { row in
            row.investment.map { Trade(date: row.date, description: row.description, currency: $0.currency, grossAmount: $0.grossAmount,
                                       type: $0.type, quantity: $0.quantity, price: $0.price, fees: $0.fees, taxes: $0.taxes) }
        }
    }
}

/// `?deletion=1` summary (also the body of `DELETE` and `discard_correction`).
public struct PersonalImportDeletion: Decodable, Equatable, Sendable {
    public struct Upload: Decodable, Equatable, Sendable {
        public let id: String
        public let createdAt: String
    }

    public let token: String
    public let name: String
    public let cashCount: Int
    public let investmentCount: Int
    public let uploads: [Upload]
}

// MARK: - Rules

/// What the device knows of a file just uploaded (size and rows are not stored server-side).
public struct PersonalImportReceiptFile: Equatable, Sendable {
    public let name: String
    public let size: Int?
    public let rows: Int?
    public let source: String

    public init(name: String, size: Int? = nil, rows: Int? = nil, source: String) {
        self.name = name
        self.size = size
        self.rows = rows
        self.source = source
    }
}

/// A catalog source with its `{n}` values; `verbatim` = server text shown as is.
public struct ImportText: Equatable, Sendable {
    public let template: String
    public let values: [String: String]
    public let verbatim: Bool

    public init(_ template: String, _ values: [String: String] = [:], verbatim: Bool = false) {
        self.template = template
        self.values = values
        self.verbatim = verbatim
    }
}

/// Island state of a job (`islandState`).
public enum PersonalImportIslandState: String, Sendable { case running, done, failed, review }

/// A personal file read on the device, ready to upload.
public struct PersonalImportLoadedFile: Equatable, Sendable {
    public let name: String
    public let size: Int
    public let csv: String

    public init(name: String, size: Int, csv: String) {
        self.name = name
        self.size = size
        self.csv = csv
    }
}

public enum PersonalImportRules {
    public static let maxBytes = 25 * 1024 * 1024
    public static let maxRows = 50_000
    public static let consentVersion = "openrouter-raw-zdr-v3"
    public static let pollInterval: TimeInterval = 3
    public static let islandVisibleSeconds: TimeInterval = 24 * 60 * 60
    public static let maxDismissed = 50
    public static let reviewRowsPerReason = 5
    public static let rowsPageSize = 25
    public static let nameMaxLength = 80
    public static let feedbackMaxLength = 2000
    public static let activeStatuses: Set<String> = ["queued", "processing", "ready"]

    /// `personalImportLabels`.
    public static func statusLabel(_ status: String) -> String {
        switch status {
        case "queued": "In attesa di analisi"
        case "processing": "Stiamo analizzando il CSV"
        case "correction_ready": "Correzione da confermare"
        case "ready": "Salvataggio in corso"
        case "review_failed": "Righe da controllare"
        case "failed": "Analisi non riuscita"
        case "imported": "Importato"
        case "expired": "File scaduto"
        default: status
        }
    }

    /// `isActiveJob` (IMP-003, IMP-005).
    public static func isActive(_ job: PersonalImportListing.Job?) -> Bool { job.map { activeStatuses.contains($0.status) } ?? false }

    /// IMP-003: poll only while a job is running.
    public static func shouldPoll(_ listing: PersonalImportListing?) -> Bool { listing?.jobs.contains { isActive($0) } ?? false }

    /// `islandState`.
    public static func islandState(_ status: String) -> PersonalImportIslandState? {
        if status == "correction_ready" { return .review }
        if activeStatuses.contains(status) { return .running }
        if status == "imported" { return .done }
        if status == "failed" || status == "review_failed" { return .failed }
        return nil
    }

    /// `islandJobs` (IMP-058/059): recent, not dismissed, known state; newest first.
    public static func islandJobs(_ jobs: [PersonalImportListing.Job], dismissed: Set<String>, now: Date) -> [PersonalImportListing.Job] {
        jobs.filter { job in
            guard islandState(job.status) != nil, !dismissed.contains(job.id), let created = parseInstant(job.createdAt) else { return false }
            return now.timeIntervalSince(created) < islandVisibleSeconds
        }
        .sorted { (parseInstant($0.createdAt) ?? .distantPast) > (parseInstant($1.createdAt) ?? .distantPast) }
    }

    /// `runningImportIds` (IMP-060: data refresh when one of these is no longer running).
    public static func runningIds(_ jobs: [PersonalImportListing.Job]) -> Set<String> {
        Set(jobs.filter { islandState($0.status) == .running }.map(\.id))
    }

    /// IMP-060: some job seen running has finished.
    public static func finishedSince(previous: Set<String>, now jobs: [PersonalImportListing.Job]) -> Bool {
        let running = runningIds(jobs)
        return previous.contains { !running.contains($0) }
    }

    /// Dismissed ids kept on the device: the last `maxDismissed`.
    public static func addDismissed(_ id: String, to list: [String]) -> [String] {
        Array((list.filter { $0 != id } + [id]).suffix(maxDismissed))
    }

    /// `importOverlap` (web #461): how many movements of the file were already there.
    public enum Overlap: Equatable, Sendable { case nothingNew, partial, allNew, unknown }

    public static func overlap(_ results: PersonalImportListing.Results?) -> Overlap {
        guard let rows = results?.rows, let present = results?.alreadyPresent else { return .unknown }
        if present == 0 { return .allNew }
        return present >= rows ? .nothingNew : .partial
    }

    /// IMP-030: the line under the receipt title of a finished import (`importSummary`).
    public static func importSummary(_ results: PersonalImportListing.Results?) -> ImportText {
        switch overlap(results) {
        case .nothingNew:
            let rows = results?.rows ?? 0
            return rows == 1 ? ImportText("Il movimento del file c'era già: non abbiamo aggiunto niente.")
                : ImportText("Tutti i {0} movimenti del file c'erano già: non abbiamo aggiunto niente.", ["0": String(rows)])
        case .partial:
            let rows = results?.rows ?? 0
            return ImportText("{0} su {1} movimenti importati: gli altri c'erano già.", ["0": String(rows - (results?.alreadyPresent ?? 0)), "1": String(rows)])
        default:
            return ImportText("I dati sono già nel tuo conto.")
        }
    }

    /// IMP-030: «Niente di nuovo da importare» replaces «Importazione completata» when every movement was already there.
    public static func receiptTitle(_ status: String?, results: PersonalImportListing.Results?) -> String {
        status == "imported" && overlap(results) == .nothingNew ? "Niente di nuovo da importare" : receiptTitle(status)
    }

    /// IMP-030: the receipt lists what was added unless nothing was new.
    public static func showsAddedLines(_ results: PersonalImportListing.Results) -> Bool { overlap(results) != .nothingNew }

    /// IMP-030: the notes under the added counts — skipped rows, movements that took the bank's category (web #456) and,
    /// only for older jobs without the counts, the generic «already there» line.
    public static func receiptNotes(_ results: PersonalImportListing.Results) -> [ImportText] {
        var notes: [ImportText] = []
        if results.skipped > 0 {
            notes.append(results.skipped == 1 ? ImportText("1 riga non riconosciuta è stata saltata, come hai scelto: non entra nei conti.")
                : ImportText("{0} righe non riconosciute sono state saltate, come hai scelto: non entrano nei conti.", ["0": String(results.skipped)]))
        }
        if results.bankCategorized > 0 {
            notes.append(results.bankCategorized == 1
                ? ImportText("1 movimento ha già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.")
                : ImportText("{0} movimenti hanno già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.", ["0": String(results.bankCategorized)]))
        }
        if overlap(results) == .unknown { notes.append(ImportText("Le righe già presenti sono state saltate, senza doppioni.")) }
        return notes
    }

    /// IMP-062: the server refused a file already imported (`409 {code:"already_imported"}`): a notice, not a fault.
    public static let alreadyImportedCode = "already_imported"

    /// IMP-049…054 (correction of a wrong AI import) are not on web `main` (decision 0004: only on the unmerged web
    /// branch `codex/import-result-correction`): the entry point stays off until the web ships it.
    public static let correctionsEnabled = false

    /// Island card title and detail (Italian sources with `{0}`/`{1}` values).
    public static func islandText(_ job: PersonalImportListing.Job, source: String) -> (title: ImportText, detail: ImportText) {
        let state = islandState(job.status)
        let correctionReady = job.status == "correction_ready"
        let review = job.status == "review_failed" || correctionReady
        let title = ImportText(state == .running ? "{0}: importo il file" : review ? "{0}: da controllare"
            : state == .failed ? "{0}: non riuscito" : overlap(job.results) == .nothingNew ? "{0}: niente di nuovo" : "{0}: completato", ["0": source])
        if correctionReady { return (title, ImportText("Confronta la correzione prima di confermare.")) }
        if state == .running { return (title, ImportText("Puoi continuare a usare l'app.")) }
        if review { return (title, ImportText("Vedi quali righe e scegli cosa fare.")) }
        if state == .failed { return (title, ImportText("Vedi cosa fare.")) }
        if let results = job.results, overlap(results) == .nothingNew { return (title, ImportText("I movimenti c'erano già tutti.")) }
        if let results = job.results, overlap(results) == .partial, let rows = results.rows, let present = results.alreadyPresent {
            return (title, ImportText("{0} su {1} movimenti importati", ["0": String(rows - present), "1": String(rows)]))
        }
        if let results = job.results {
            return (title, ImportText("{0} movimenti · {1} operazioni", ["0": String(results.cash), "1": String(results.investments)]))
        }
        return (title, ImportText("Dati aggiunti."))
    }

    /// `describeImportJob` (IMP-007): list row message and action. `message` is Italian; values for the imported counts.
    public static func describe(_ job: PersonalImportListing.Job) -> (message: ImportText, action: String?) {
        switch job.status {
        case "queued", "processing": return (ImportText("Analisi in corso"), nil)
        case "correction_ready": return (ImportText("Correzione da confermare"), "Confronta")
        case "ready": return (ImportText("Salvataggio in corso"), nil)
        case "imported":
            if let r = job.results {
                if overlap(r) == .nothingNew {
                    return (ImportText("Niente di nuovo: {0} movimenti c'erano già", ["0": String(r.alreadyPresent ?? 0)]), "Dettaglio")
                }
                if overlap(r) == .partial, let rows = r.rows, let present = r.alreadyPresent {
                    return (ImportText("{0} su {1} movimenti importati", ["0": String(rows - present), "1": String(rows)]), "Dettaglio")
                }
                return (ImportText("{0} movimenti · {1} operazioni", ["0": String(r.cash), "1": String(r.investments)]), "Dettaglio")
            }
            return (ImportText("Importato"), "Dettaglio")
        case "review_failed": return (job.error.map { ImportText($0, verbatim: true) } ?? ImportText("Qualche riga da correggere"), "Controlla")
        case "failed": return (job.error.map { ImportText($0, verbatim: true) } ?? ImportText("Formato non riconosciuto"), "Riprova")
        case "expired": return (ImportText("File scaduto: caricalo di nuovo"), "Riprova")
        default: return (ImportText(job.status, verbatim: true), nil)
        }
    }

    /// IMP-009: a failed or expired non-correction row brings the user to the upload form.
    public static func tapRetries(_ job: PersonalImportListing.Job) -> Bool {
        describe(job).action == "Riprova" && job.correctionOf == nil
    }

    /// `receiptStage` (IMP-028): index of the stage in progress; 4 = all done.
    public static func receiptStage(_ status: String?) -> Int {
        switch status {
        case "imported": 4
        case "ready": 2
        default: 1
        }
    }

    public static let receiptStages = ["File ricevuto", "Analisi del formato", "Controlli e salvataggio", "Importato"]

    /// IMP-026.
    public static func receiptTitle(_ status: String?) -> String {
        if status == "imported" { return "Importazione completata" }
        if isFailed(status) { return "Non siamo riusciti a importare il file" }
        return "File ricevuto"
    }

    public static func isFailed(_ status: String?) -> Bool { ["failed", "review_failed", "expired"].contains(status ?? "") }

    /// Which report the page shows (IMP-004…006): the file just uploaded, else the selected job, else the first active.
    public static func reportJob(jobs: [PersonalImportListing.Job]?, selected: String?, receiptJobId: String?) -> PersonalImportListing.Job? {
        if let receiptJobId {
            return jobs?.first { $0.id == receiptJobId }
                ?? PersonalImportListing.Job(id: receiptJobId, formatId: "", status: "queued", createdAt: "")
        }
        if let selected { return jobs?.first { $0.id == selected } }
        return jobs?.first { isActive($0) }
    }

    public enum ReportKind: Equatable, Sendable { case correction, review, receipt }

    /// IMP-006: correction screen, review (`review_failed`) or receipt.
    public static func reportKind(_ job: PersonalImportListing.Job, correcting: String?) -> ReportKind {
        if correcting == job.id || (job.correctionOf != nil && job.status != "imported") { return .correction }
        if job.status == "review_failed" { return .review }
        return .receipt
    }

    /// The upload form is hidden while a fresh receipt, a correction start or an open correction job is shown.
    public static func showsUploadForm(report: PersonalImportListing.Job?, hasReceipt: Bool, correcting: String?) -> Bool {
        if hasReceipt || correcting != nil { return false }
        if let report, report.correctionOf != nil, report.status != "imported" { return false }
        return true
    }

    /// `formatFileSize`: `{0} MB` (one decimal, locale digits) or `{0} KB` (≥ 1). Returns the source and its value.
    public static func fileSize(_ bytes: Int, locale: BBLocale) -> ImportText {
        if bytes >= 1024 * 1024 {
            return ImportText("{0} MB", ["0": BBFormat.formatNumber(Double(bytes) / 1024 / 1024, minimumFractionDigits: 0, maximumFractionDigits: 1,
                                                                   locale: locale)])
        }
        return ImportText("{0} KB", ["0": String(max(1, Int(JSNumber.round(Double(bytes) / 1024))))])
    }

    /// `countCsvRows`: data rows (header and blank lines excluded).
    public static func countCsvRows(_ csv: String) -> Int {
        let lines = csv.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" || $0 == "\r\n" })
        return max(0, lines.filter { !JSNumber.trim(String($0)).isEmpty }.count - 1)
    }

    /// What a picked file is, by name, for `readPersonalImportFile` (IMP-017…019).
    public enum FileKind: Equatable, Sendable { case xlsx, xls, text }

    public static func fileKind(_ name: String) -> FileKind {
        let lower = name.lowercased()
        if lower.hasSuffix(".xlsx") { return .xlsx }
        if lower.hasSuffix(".xls") { return .xls }
        return .text
    }

    /// Error for a picked file before reading it (`readPersonalImportFile`), as `(source, values)`.
    public static func fileError(name: String, size: Int, locale: BBLocale) -> ImportText? {
        switch fileKind(name) {
        case .xlsx:
            if size > ImportXlsx.maxFileBytes {
                return ImportText("Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.",
                                  ["0": sizeText(size, locale), "1": sizeText(ImportXlsx.maxFileBytes, locale)])
            }
        case .xls:
            return ImportText("I file .xls (Excel antico) non si leggono. In Excel scegli «Salva con nome» e poi «Cartella di lavoro di Excel (.xlsx)» o «CSV».")
        case .text:
            if size > maxBytes { return ImportText("Il file pesa {0}: il massimo è {1}.", ["0": sizeText(size, locale), "1": sizeText(maxBytes, locale)]) }
        }
        return nil
    }

    /// Size with its unit, untranslated unit (`MB`/`KB` are the same in it/en/de).
    public static func sizeText(_ bytes: Int, _ locale: BBLocale) -> String {
        let s = fileSize(bytes, locale: locale)
        return s.template.replacingOccurrences(of: "{0}", with: s.values["0"] ?? "")
    }

    /// Decodes a text file as the browser's `File.text()` does (UTF-8, invalid bytes replaced; BOM kept).
    public static func decodeText(_ data: Data) -> String { String(decoding: data, as: UTF8.self) }

    /// `readPersonalImportFile`: Excel → CSV text, text files as UTF-8. Throws `ImportXlsxError` for unreadable XLSX.
    public static func read(name: String, data: Data) throws -> PersonalImportLoadedFile {
        switch fileKind(name) {
        case .xlsx: return PersonalImportLoadedFile(name: name, size: data.count, csv: try ImportXlsx.csv(data))
        case .xls, .text: return PersonalImportLoadedFile(name: name, size: data.count, csv: decodeText(data))
        }
    }

    // MARK: Upload form (IMP-012…016)

    public enum UploadStep: Int, Sendable, CaseIterable { case source, file, consent }

    /// What the current step still misses (IMP-013), as Italian fragments.
    public static func missing(step: UploadStep, isNew: Bool, name: String, hasFile: Bool, consent: Bool) -> [String] {
        switch step {
        case .source: isNew && JSNumber.trim(name).isEmpty ? ["scrivi da dove arriva il file"] : []
        case .file: hasFile ? [] : ["scegli il file"]
        case .consent: consent ? [] : ["dai il consenso all'analisi"]
        }
    }

    // MARK: Preview groups (`preview-groups.ts`, `review-groups.ts`)

    public enum PreviewTab: String, Sendable, CaseIterable { case importable, ignored, errors }

    public struct PreviewGroups: Equatable, Sendable {
        public var importable: [PersonalImportPreview.Record] = []
        public var ignored: [PersonalImportPreview.Record] = []
        public var errors: [PersonalImportPreview.Record] = []
        public var cash = 0
        public var investments = 0

        public func records(_ tab: PreviewTab) -> [PersonalImportPreview.Record] {
            switch tab {
            case .importable: importable
            case .ignored: ignored
            case .errors: errors
            }
        }

        /// Tabs shown: `Da importare` always, `Escluse` and `Errori` only when not empty (IMP-045).
        public var tabs: [PreviewTab] { [.importable] + (ignored.isEmpty ? [] : [.ignored]) + (errors.isEmpty ? [] : [.errors]) }

        /// `defaultPreviewTab`.
        public var defaultTab: PreviewTab { errors.isEmpty ? .importable : .errors }
    }

    public static func groups(_ records: [PersonalImportPreview.Record]) -> PreviewGroups {
        var g = PreviewGroups()
        for record in records {
            switch record.outcome.kind {
            case "cash":
                g.importable.append(record)
                g.cash += 1
            case "investment":
                g.importable.append(record)
                g.investments += 1
            case "ignore": g.ignored.append(record)
            default: g.errors.append(record)
            }
        }
        return g
    }

    public struct ErrorReasonGroup: Equatable, Sendable, Identifiable {
        public let reason: String
        public var records: [PersonalImportPreview.Record]
        public var id: String { reason }
    }

    /// `groupErrorsByReason` (IMP-042): most frequent first, ties by first appearance.
    public static func errorsByReason(_ records: [PersonalImportPreview.Record]) -> [ErrorReasonGroup] {
        var order: [String] = []
        var groups: [String: ErrorReasonGroup] = [:]
        for record in records where record.outcome.kind == "error" {
            let trimmed = JSNumber.trim(record.outcome.reason ?? "")
            let reason = trimmed.isEmpty ? "Riga non riconosciuta" : trimmed
            if groups[reason] == nil {
                order.append(reason)
                groups[reason] = ErrorReasonGroup(reason: reason, records: [])
            }
            groups[reason]!.records.append(record)
        }
        return order.enumerated().map { ($0.offset, groups[$0.element]!) }
            .sorted { $0.1.records.count != $1.1.records.count ? $0.1.records.count > $1.1.records.count : $0.0 < $1.0 }
            .map(\.1)
    }

    /// `sourceLine` (IMP-043): the file line (header = 1).
    public static func sourceLine(_ record: PersonalImportPreview.Record) -> Int { record.line ?? record.outcome.row + 1 }

    /// `sourceText`.
    public static func sourceText(_ record: PersonalImportPreview.Record) -> String {
        JSNumber.trim(record.source.joined(separator: " · "))
    }

    /// Row of «Tutte le righe» (IMP-046): title, subtitle source + values, signed amount and its currency.
    public struct RowSummary: Equatable, Sendable {
        public let date: String?
        public let title: String
        /// Kind label (Italian) or nil; the subtitle is `{kind}{qty}{line}`.
        public let kind: String?
        public let quantity: Double?
        public let price: Double?
        public let line: Int
        public let amount: Double?
        public let currency: String?
        public let positive: Bool
    }

    public static func rowSummary(_ record: PersonalImportPreview.Record) -> RowSummary {
        let o = record.outcome
        let line = record.line ?? o.row + 2
        switch o.kind {
        case "cash":
            let amount = o.amount ?? 0
            return RowSummary(date: o.date, title: o.description ?? "", kind: o.transfer == true ? "Giroconto" : "Movimento", quantity: nil,
                              price: nil, line: line, amount: amount, currency: o.currency, positive: amount >= 0)
        case "investment":
            let quantity = o.quantity ?? 0
            let price = o.price ?? 0
            let amount: Double
            let positive: Bool
            if let gross = o.grossAmount {
                amount = gross
                positive = true
            } else {
                amount = -(quantity * price) * (o.type == "vendita" ? -1 : 1)
                positive = false
            }
            return RowSummary(date: o.date, title: o.name ?? "", kind: ImportOperationTypes.label(o.type ?? ""),
                              quantity: quantity == 0 ? nil : quantity, price: quantity == 0 ? nil : price, line: line, amount: amount,
                              currency: o.currency, positive: positive)
        default:
            return RowSummary(date: o.date, title: o.reason ?? "", kind: nil, quantity: nil, price: nil, line: line, amount: nil,
                              currency: nil, positive: false)
        }
    }

    // MARK: Dates

    static func parseInstant(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }

    public static func instant(_ iso: String) -> Date? { parseInstant(iso) }

    /// List day label (IMP-007): `oggi HH:mm`, `ieri`, or `d MMM`. Returns the Italian source and its value.
    public static func dayLabel(_ iso: String, now: Date, timeZone: TimeZone, locale: BBLocale) -> ImportText {
        guard let date = parseInstant(iso) else { return ImportText("{0}", ["0": iso]) }
        let day = CalendarDate.of(date, in: timeZone)
        let today = CalendarDate.of(now, in: timeZone)
        let days = today.epochDay - day.epochDay
        if days <= 0 {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = timeZone
            let c = calendar.dateComponents([.hour, .minute], from: date)
            return ImportText("oggi {0}", ["0": BBFormat.formatTime(hour: c.hour ?? 0, minute: c.minute ?? 0, locale: locale)])
        }
        if days == 1 { return ImportText("ieri") }
        return ImportText("{0}", ["0": BBFormat.formatDate(day, .dMMM, locale: locale)])
    }

    /// `d MMMM, HH:mm` of an instant (receipt estimate, IMP-029).
    public static func dayMonthTime(_ iso: String, timeZone: TimeZone, locale: BBLocale) -> String {
        guard let date = parseInstant(iso) else { return iso }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let day = BBFormat.formatDate(CalendarDate.of(date, in: timeZone), .dMMMM, locale: locale)
        return "\(day), \(BBFormat.formatTime(hour: c.hour ?? 0, minute: c.minute ?? 0, locale: locale))"
    }

    /// `d MMMM` of an instant (`Importazione del {0}`, IMP-027).
    public static func dayMonth(_ iso: String, timeZone: TimeZone, locale: BBLocale) -> String {
        guard let date = parseInstant(iso) else { return "" }
        return BBFormat.formatDate(CalendarDate.of(date, in: timeZone), .dMMMM, locale: locale)
    }
}

// MARK: - Import history (`import-history.ts`, INV-106)

/// `GET /api/investments/statements` item (only the fields the history and deletion use).
public struct BrokerStatementRecord: Decodable, Equatable, Sendable, Identifiable {
    public struct Statement: Decodable, Equatable, Sendable {
        public let provider: String?
        public let account: String
        public let from: String
        public let to: String
        public let positions: [JSONNode]
        public let ledger: [JSONNode]
        public let issues: [String]
    }

    public let id: String
    public let accountKey: String
    public let portfolioId: String
    public let createdAt: String
    public let statement: Statement
}

public enum ImportStatusTone: String, Sendable { case ok, warning, error, pending }

public struct ImportHistoryDetail: Equatable, Sendable {
    public let one: String
    public let many: String
    public let count: Int?
}

public struct ImportHistoryItem: Equatable, Sendable, Identifiable {
    public enum Kind: String, Sendable { case broker, personal }
    public let key: String
    public let kind: Kind
    public let id: String
    public let source: String
    /// Period (`from`, `to`) of a broker statement.
    public let period: (from: String, to: String)?
    public let createdAt: String
    /// Detail fragments (Italian one/many source and count); `CSV personale` has count nil.
    public let details: [ImportHistoryDetail]
    public let statusLabel: String
    /// Count for the `{n} avvisi` label (nil → `statusLabel` is a plain catalog source).
    public let warnings: Int?
    public let tone: ImportStatusTone

    public static func == (a: ImportHistoryItem, b: ImportHistoryItem) -> Bool { a.key == b.key && a.statusLabel == b.statusLabel }
}

public struct ImportHistoryGroup: Equatable, Sendable, Identifiable {
    public let source: String
    public let items: [ImportHistoryItem]
    public var id: String { source }
}

public enum ImportHistory {
    public static let visible = 6

    static func brokerSource(_ statement: BrokerStatementRecord.Statement) -> String {
        if statement.provider == "trade-republic" { return ImportProviders.info(.tradeRepublic).name }
        if statement.provider == "degiro" { return ImportProviders.info(.degiro).name }
        return "\(ImportProviders.info(.interactiveBrokers).name) · conto …\(statement.account.suffix(4))"
    }

    /// Whether a source label is the IBKR template (`… · conto …1234`): translate «conto».
    public static func isIbkrSource(_ source: String) -> Bool { source.hasPrefix("Interactive Brokers · conto …") }

    /// `buildImportHistory`: broker statements and personal jobs, newest first.
    public static func build(statements: [BrokerStatementRecord], personal: PersonalImportListing?) -> [ImportHistoryItem] {
        let broker = statements.map { record -> ImportHistoryItem in
            let s = record.statement
            var details: [ImportHistoryDetail] = []
            if !s.positions.isEmpty { details.append(ImportHistoryDetail(one: "posizione", many: "posizioni", count: s.positions.count)) }
            if !s.ledger.isEmpty { details.append(ImportHistoryDetail(one: "movimento di cassa", many: "movimenti di cassa", count: s.ledger.count)) }
            let warnings = s.issues.count
            return ImportHistoryItem(key: "broker:\(record.id)", kind: .broker, id: record.id, source: brokerSource(s), period: (s.from, s.to),
                                     createdAt: record.createdAt, details: details,
                                     statusLabel: warnings > 0 ? "avvisi" : "Importato", warnings: warnings > 0 ? warnings : nil,
                                     tone: warnings > 0 ? .warning : .ok)
        }
        let custom = (personal?.jobs ?? []).map { job -> ImportHistoryItem in
            let tone: ImportStatusTone = job.status == "imported" ? .ok
                : (job.status == "failed" || job.status == "review_failed") ? .error : job.status == "expired" ? .warning : .pending
            return ImportHistoryItem(key: "personal:\(job.id)", kind: .personal, id: job.id, source: personal?.formatName(job.formatId) ?? "CSV personale",
                                     period: nil, createdAt: job.createdAt, details: [ImportHistoryDetail(one: "CSV personale", many: "CSV personale", count: nil)],
                                     statusLabel: PersonalImportRules.statusLabel(job.status), warnings: nil, tone: tone)
        }
        return (broker + custom).enumerated().sorted { a, b in
            let l = PersonalImportRules.instant(a.element.createdAt) ?? .distantPast
            let r = PersonalImportRules.instant(b.element.createdAt) ?? .distantPast
            return l != r ? l > r : a.offset < b.offset
        }.map(\.element)
    }

    /// `groupImports`: by source, in order of recency.
    public static func group(_ items: [ImportHistoryItem]) -> [ImportHistoryGroup] {
        var order: [String] = []
        var groups: [String: [ImportHistoryItem]] = [:]
        for item in items {
            if groups[item.source] == nil { order.append(item.source) }
            groups[item.source, default: []].append(item)
        }
        return order.map { ImportHistoryGroup(source: $0, items: groups[$0]!) }
    }

    /// INV-107: a broker statement and every later one of the same account (`from >= selected.from`).
    public static func affectedStatements(_ id: String, in statements: [BrokerStatementRecord]) -> [BrokerStatementRecord] {
        guard let selected = statements.first(where: { $0.id == id }) else { return [] }
        return statements.filter { $0.accountKey == selected.accountKey && $0.statement.from >= selected.statement.from }
    }

    /// `formatImportDate`: `d MMM y` of a date or an instant (local day).
    public static func date(_ value: String, timeZone: TimeZone, locale: BBLocale) -> String {
        if value.count == 10, let day = CalendarDate(iso: value) { return BBFormat.formatDate(day, .dMMMy, locale: locale) }
        guard let instant = PersonalImportRules.instant(value) else { return value }
        return BBFormat.formatDate(CalendarDate.of(instant, in: timeZone), .dMMMy, locale: locale)
    }

    /// `formatImportPeriod`: a single day once, else `from – to`.
    public static func period(from: String, to: String, timeZone: TimeZone, locale: BBLocale) -> String {
        from == to ? date(from, timeZone: timeZone, locale: locale)
            : "\(date(from, timeZone: timeZone, locale: locale)) – \(date(to, timeZone: timeZone, locale: locale))"
    }

    /// The investment reset literal (INV-109; fixed, Italian, whatever the UI language).
    public static let resetConfirmation = "AZZERA INVESTIMENTI"
}

/// `GET /api/investments/import/reset`.
public struct InvestmentResetPreview: Decodable, Equatable, Sendable {
    public let revision: String
    public let operations: Int
    public let untrackedOperations: Int
    public let statements: Int
    public let prices: Int
    public let cashAccounts: Int
}

/// `ImportResult` of `POST /api/investments/import`.
public struct ImportRunResult: Decodable, Equatable, Sendable {
    public struct Row: Decodable, Equatable, Sendable {
        public let line: Int
        public let status: String
        public let message: String?
    }

    public struct Counts: Decodable, Equatable, Sendable {
        public let new: Int
        public let duplicate: Int
        public let error: Int
    }

    public struct Replacement: Decodable, Equatable, Sendable {
        public let statements: Int
        public let operations: Int
        public let from: String
        public let to: String
    }

    public let rows: [Row]
    public let counts: Counts
    public let error: String?
    public let inserted: Int
    public let instrumentsCreated: Int
    public let replacement: Replacement?
}

// MARK: - Routes

public enum ImportsRoutes {
    /// `/importazioni?job={id}` (IMP-004): the job id, nil without one.
    public static func jobId(path: String) -> String? {
        guard let query = path.split(separator: "?", maxSplits: 1).dropFirst().first else { return nil }
        for pair in query.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            if parts.count == 2, parts[0] == "job", !parts[1].isEmpty { return parts[1].removingPercentEncoding ?? parts[1] }
        }
        return nil
    }

    /// In-app path of a link opened from outside (email links `https://buddybudget.io/importazioni?job=…`, the
    /// `buddybudget://` scheme): path + query, nil for other hosts or schemes.
    public static func inAppPath(url: URL) -> String? {
        guard let scheme = url.scheme?.lowercased() else { return nil }
        var path: String
        if scheme == "https" || scheme == "http" {
            guard let host = url.host?.lowercased(), host == "buddybudget.io" || host == "www.buddybudget.io" || host == "app.buddybudget.io" else {
                return nil
            }
            path = url.path
        } else if scheme == "buddybudget" {
            guard url.host != "bank" else { return nil }
            path = "/" + [url.host ?? "", url.path].joined().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        } else {
            return nil
        }
        if path.isEmpty { path = "/" }
        if let query = url.query, !query.isEmpty { path += "?" + query }
        return path
    }
}
