import BuddyBudgetKit
import Foundation
import Observation

/// «Importa operazioni» (07-investments §8, INV-092…105): one wizard per file (File → Anteprima → Strumenti →
/// Conferma), several broker statements one at a time, optional AI recovery. Server statements (IBKR, DEGIRO,
/// Trade Republic) are parsed by `POST /api/investments/import/parse`; generic, Yahoo and Fineco files are read on the
/// device with the ported rules (`BrokerImport.swift`). Nothing is imported until the user confirms.
/// Same fields as `BrokerImportModel` on Android.
@MainActor @Observable
final class BrokerImportModel {
    enum Step: Int, CaseIterable {
        case file, mapping, instruments, summary

        var label: String {
            switch self {
            case .file: "File"
            case .mapping: "Anteprima"
            case .instruments: "Strumenti"
            case .summary: "Conferma"
            }
        }

        var hint: String {
            switch self {
            case .file: "Carica il file esportato dal tuo broker."
            case .mapping: "Controlla cosa ho letto dal file. Non è ancora stato importato nulla."
            case .instruments: "Verifica che ogni titolo del file sia quello giusto."
            case .summary: "Ultimo controllo: poi importo tutto in una volta."
            }
        }
    }

    // Session (dialog)
    var isOpen = false
    var aiFallback = false
    private(set) var fallbackJobs: [(name: String, id: String)] = []
    private(set) var batch: [PreparedStatementFile] = []
    private(set) var batchIndex = 0
    private(set) var fileError: String?
    private(set) var loadingFiles = false

    // Wizard
    private(set) var step: Step = .file
    var provider: ImportProviderId?
    var showGuide = false
    private(set) var fileName: String?
    private(set) var table: ImportCsvTable?
    private(set) var presetLabel: String?
    private(set) var presetId: String?
    private(set) var statement: ActivityStatement?
    private(set) var statementCsv: String?
    private(set) var mapping: ImportMapping?
    private(set) var choices: [String: InstrumentChoice] = [:]
    private(set) var excluded: Set<String> = []
    /// Instruments order taken when the step opens (choosing one doesn't move rows).
    private(set) var order: [String] = []
    private(set) var error: String?
    private(set) var done = false
    private(set) var fallbackJobId: String?
    private(set) var reading = false
    private(set) var resolving = false
    private(set) var running = false
    private(set) var result: ImportRunResult?
    private(set) var portfolios: [BrokerImportAPI.Portfolio] = []
    var portfolioId = ""

    @ObservationIgnored let env: AppEnvironment
    /// Called after a real import wrote data (screens reload).
    @ObservationIgnored var onImported: (() -> Void)?

    init(env: AppEnvironment) { self.env = env }

    var today: String { CalendarDate.of(Date(), in: .current).iso }

    var isBatch: Bool { !batch.isEmpty }
    var batchFinished: Bool { isBatch && batchIndex >= batch.count }

    var rows: [ImportRow] {
        if let statement { return statement.rows }
        guard let table, let mapping else { return [] }
        return ImportNormalize.rows(table, mapping: mapping, today: today)
    }

    var warnings: [ActivityStatement.Issue] { statement?.warnings ?? [] }
    var identities: [ImportIdentityCount] { ImportNormalize.identities(rows) }
    var missing: [String] { mapping.map(ImportMappingRules.missingFields) ?? [] }
    var cashCount: Int { statement?.cashMovements?.count ?? 0 }
    var validRows: Int { rows.filter(\.isOk).count + cashCount }
    var included: [ImportIdentityCount] {
        identities.filter { choices[$0.identity.key]?.isUsable == true && !excluded.contains($0.identity.key) }
    }

    var newInstruments: Int {
        included.filter { if case .create = choices[$0.identity.key] { return true } else { return false } }.count
    }

    var busy: Bool { reading || resolving || running || loadingFiles }

    // MARK: Session

    /// Opens the dialog, optionally with files shared to the app.
    func present(files: [PickedFile] = []) {
        resetSession()
        isOpen = true
        if !files.isEmpty {
            Task {
                await pick(files)
                #if DEBUG
                await debugAdvance()
                #endif
            }
        }
    }

    #if DEBUG
    /// `-BBBrokerStep instruments|summary|done`: walks the wizard without taps (screenshots and E2E).
    private func debugAdvance() async {
        guard let target = DebugLaunch.value("-BBBrokerStep"), step == .mapping else { return }
        await goToInstruments()
        guard target != "instruments", step == .instruments else { return }
        await preview()
        guard target == "done", step == .summary, result?.counts.error == 0 else { return }
        await confirm()
    }
    #endif

    func close() {
        isOpen = false
    }

    private func resetSession() {
        aiFallback = false
        fallbackJobs = []
        batch = []
        batchIndex = 0
        fileError = nil
        resetWizard(initial: nil)
        Task { [weak self] in
            guard let self else { return }
            self.portfolios = (try? await self.env.brokerImports.portfolios()) ?? []
        }
    }

    private func resetWizard(initial: PreparedStatementFile?) {
        step = initial == nil ? .file : .mapping
        provider = initial?.parsed.provider
        showGuide = false
        fileName = initial?.name
        table = nil
        presetLabel = nil
        presetId = nil
        statement = initial?.parsed
        statementCsv = initial?.text
        mapping = nil
        choices = [:]
        excluded = []
        order = []
        error = nil
        done = false
        fallbackJobId = nil
        result = nil
        portfolioId = ""
    }

    /// Batch: the wizard of the next file; past the last one the session shows the finish message.
    func nextFile() {
        batchIndex += 1
        if batchIndex < batch.count { resetWizard(initial: batch[batchIndex]) }
    }

    /// The finish action of the wizard: next file in a batch, else close.
    func finish() {
        if isBatch { nextFile() } else { close() }
    }

    func selectProvider(_ next: ImportProviderId?) {
        provider = next
        error = nil
    }

    // MARK: File step (INV-093…096, INV-103, INV-104)

    func pick(_ files: [PickedFile]) async {
        guard !busy, !files.isEmpty else { return }
        fileError = nil
        if let message = ImportBatch.validate(sizes: files.map(\.data.count)) {
            fileError = message
            return
        }
        loadingFiles = true
        defer { loadingFiles = false }
        if files.count > 1 {
            await loadBatch(files)
            return
        }
        let file = files[0]
        if PersonalImportRules.fileKind(file.name) == .xlsx {
            do {
                await loadText(try ImportXlsx.csv(file.data), name: file.name)
            } catch let failure as ImportXlsxError {
                fileError = failure.text
            } catch {
                fileError = "Impossibile leggere i file"
            }
        } else {
            await loadText(PersonalImportRules.decodeText(file.data), name: file.name)
        }
    }

    private func loadBatch(_ files: [PickedFile]) async {
        var prepared: [PreparedStatementFile] = []
        for file in files {
            let text = PersonalImportRules.decodeText(file.data)
            let detected = ImportProviders.detect(text)
            if detected?.isServerStatement != true {
                if aiFallback && detected == nil {
                    if await enqueueFallback(text, name: file.name, provider: nil) { continue }
                    return
                }
                fileError = L10n.lookup(italian: "{0}: l'import multiplo supporta rendiconti IBKR, DEGIRO e Trade Republic. Importa gli altri CSV singolarmente.",
                                        ["0": file.name])
                return
            }
            do {
                prepared.append(PreparedStatementFile(name: file.name, text: text, parsed: try await env.brokerImports.parse(text)))
            } catch {
                if !aiFallback {
                    fileError = "\(file.name): \(ImportAPIFailure(error).message ?? L10n.lookup(italian: "File non valido"))"
                    return
                }
                if !(await enqueueFallback(text, name: file.name, provider: nil)) { return }
            }
        }
        do {
            let ordered = try ImportBatch.order(prepared)
            batch = ordered
            batchIndex = 0
            if let first = ordered.first { resetWizard(initial: first) }
        } catch let failure as ImportXlsxError {
            fileError = failure.text
        } catch {}
    }

    /// Batch AI recovery: one job per unreadable file (idempotent on the server).
    private func enqueueFallback(_ text: String, name: String, provider: ImportProviderId?) async -> Bool {
        do {
            let id = try await env.personalImports.enqueue(csv: text, name: provider.map { ImportProviders.info($0).name } ?? "CSV da riconoscere",
                                                           brokerFallback: true)
            fallbackJobs = fallbackJobs.filter { $0.id != id } + [(name, id)]
            return true
        } catch {
            fileError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Impossibile avviare l'analisi AI. Riprova il caricamento.")
            return false
        }
    }

    /// `loadText`: detect the format, parse server statements, read the others with the column mapping.
    func loadText(_ text: String, name: String?) async {
        fallbackJobId = nil
        let detected = ImportProviders.detect(text)
        if let provider, let mismatch = ImportProviders.mismatchMessage(chosen: provider, detected: detected) {
            if detected == nil { await failed(mismatch, text: text) } else { error = mismatch }
            return
        }
        if let detected, detected.isServerStatement {
            reading = true
            defer { reading = false }
            do {
                let parsed = try await env.brokerImports.parse(text)
                if parsed.operations.isEmpty && (parsed.cashMovements ?? []).isEmpty && !parsed.issues.contains(where: { $0.severity == "error" }) {
                    error = "Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare"
                    return
                }
                statement = parsed
                statementCsv = text
                table = nil
                mapping = nil
                presetLabel = nil
                presetId = nil
                provider = detected
                fileName = name
                error = nil
                step = .mapping
            } catch {
                await failed(ImportAPIFailure(error).message ?? L10n.lookup(italian: "Impossibile leggere il file"), text: text)
            }
            return
        }
        if detected == .fineco {
            do {
                let fineco = try FinecoImport.parseTable(text)
                let finecoMapping = FinecoImport.mapping(fineco)
                if aiFallback, ImportNormalize.rows(fineco, mapping: finecoMapping, today: today).contains(where: \.isError) {
                    await failed("Alcune righe Fineco non sono state riconosciute", text: text)
                    return
                }
                if fineco.rows.isEmpty {
                    error = "Nel file Fineco non ci sono movimenti da importare"
                    return
                }
                setTable(fineco, mapping: finecoMapping, presetId: nil, presetLabel: nil, name: name)
                provider = .fineco
            } catch let failure as ImportXlsxError {
                await failed(failure.text, text: text)
            } catch {}
            return
        }
        let parsed = ImportCsv.parse(text)
        if parsed.headers.count < 2 || parsed.rows.isEmpty {
            await failed("Il file non sembra un CSV con intestazioni e almeno una riga", text: text)
            return
        }
        let initial = ImportPresets.initialMapping(parsed)
        if aiFallback && detected == nil && !ImportMappingRules.missingFields(initial.mapping).isEmpty {
            await failed("Non è stato possibile riconoscere le colonne del CSV", text: text)
            return
        }
        setTable(parsed, mapping: savedMapping(parsed) ?? initial.mapping, presetId: initial.preset?.id, presetLabel: initial.preset?.label, name: name)
    }

    private func setTable(_ table: ImportCsvTable, mapping: ImportMapping, presetId: String?, presetLabel: String?, name: String?) {
        statement = nil
        statementCsv = nil
        self.table = table
        self.mapping = mapping
        self.presetId = presetId
        self.presetLabel = presetLabel
        fileName = name
        error = nil
        step = .mapping
    }

    /// Unreadable file: AI analysis when authorised (INV-104), else the error.
    private func failed(_ message: String, text: String) async {
        guard aiFallback else {
            error = message
            return
        }
        reading = true
        defer { reading = false }
        do {
            let name = provider.flatMap { $0 == .generic ? nil : ImportProviders.info($0).name } ?? "CSV da riconoscere"
            fallbackJobId = try await env.personalImports.enqueue(csv: text, name: name, brokerFallback: true)
            error = nil
        } catch {
            self.error = "\(L10n.lookup(italian: message)) \(ImportAPIFailure(error).message ?? L10n.lookup(italian: "Impossibile avviare l'analisi AI"))"
        }
    }

    // MARK: Mapping (INV-098)

    private func savedMapping(_ table: ImportCsvTable) -> ImportMapping? {
        guard let raw = env.preferences.string(ImportMappingRules.storageKey(table.headers)), let data = raw.data(using: .utf8),
              let saved = try? JSONDecoder().decode(ImportMapping.self, from: data),
              ImportMappingRules.savedMappingIsValid(saved, headers: table.headers) else { return nil }
        return saved
    }

    private func saveMapping() {
        guard let table, let mapping, let data = try? JSONEncoder().encode(mapping), let raw = String(data: data, encoding: .utf8) else { return }
        env.preferences.setString(ImportMappingRules.storageKey(table.headers), raw)
    }

    func setColumn(_ field: ImportField, _ column: Int?) {
        guard let table, let mapping else { return }
        self.mapping = ImportMappingRules.settingColumn(mapping, field: field, column: column, table: table)
        result = nil
    }

    func updateMapping(_ change: (inout ImportMapping) -> Void) {
        guard var next = mapping else { return }
        change(&next)
        mapping = next
        result = nil
    }

    // MARK: Instruments (INV-099)

    func goToInstruments() async {
        guard statement != nil || (table != nil && mapping != nil) else { return }
        let ids = identities
        if ids.count > ImportBatch.maxIdentities {
            error = L10n.lookup(italian: "Il file ha {0} strumenti: al massimo {1} per import",
                                ["0": String(ids.count), "1": String(ImportBatch.maxIdentities)])
            return
        }
        if table != nil { saveMapping() }
        error = nil
        if ids.isEmpty && cashCount > 0 {
            order = []
            step = .instruments
            return
        }
        resolving = true
        defer { resolving = false }
        do {
            let matches = try await env.brokerImports.resolve(ids.map(\.identity))
            choices = matches.mapValues(InstrumentChoice.init)
            excluded = []
            order = ids.enumerated().sorted { a, b in
                let ra = ImportChoices.attentionRank(choices[a.element.identity.key])
                let rb = ImportChoices.attentionRank(choices[b.element.identity.key])
                return ra != rb ? ra < rb : a.offset < b.offset
            }.map(\.element.identity.key)
            step = .instruments
        } catch {
            self.error = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Impossibile riconoscere gli strumenti")
        }
    }

    func choose(_ key: String, instrument: Instrument) {
        choices[key] = .known(instrument)
        excluded.remove(key)
    }

    func setExcluded(_ key: String, _ exclude: Bool) {
        if exclude { excluded.insert(key) } else { excluded.remove(key) }
    }

    // MARK: Summary (INV-100…102)

    func preview() async { await submit(dryRun: true) }
    func confirm() async { await submit(dryRun: false) }

    private func submit(dryRun: Bool) async {
        let preset = statement?.preset ?? (table != nil && provider == .fineco ? "fineco" : presetId)
        var request = RunImportRequest.build(rows: rows, choices: choices, excluded: excluded, dryRun: dryRun, preset: preset)
        if request == nil, let statement, cashCount > 0 {
            request = RunImportRequest(dryRun: dryRun, preset: statement.preset, instruments: [], operations: [])
        }
        guard var request else {
            error = L10n.lookup(italian: "Nessuna operazione da importare: scegli almeno uno strumento")
            return
        }
        if let statementCsv { request.statementCsv = statementCsv }
        if let table, let mapping { request.formatMetadata = ImportFormatMetadata.mapped(table, mapping: mapping, provider: provider) }
        if statement != nil, !portfolioId.isEmpty { request.portfolioId = portfolioId }
        error = nil
        running = true
        defer { running = false }
        do {
            let outcome = try await env.brokerImports.run(request)
            result = outcome
            if let failure = outcome.error { error = failure }
            if dryRun && outcome.error == nil { step = .summary }
            if !dryRun && outcome.error == nil && outcome.counts.error == 0 {
                done = true
                onImported?()
            }
        } catch {
            self.error = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Import non riuscito")
        }
    }

    func back() {
        error = nil
        result = nil
        switch step {
        case .summary: step = .instruments
        case .instruments: step = .mapping
        default: step = .file
        }
    }
}
