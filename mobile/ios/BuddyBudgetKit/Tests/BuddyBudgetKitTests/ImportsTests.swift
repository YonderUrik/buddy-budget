import Foundation
import Testing
@testable import BuddyBudgetKit

// Imports (14-imports IMP-*, 07-investments INV-092…110, 09-pension PEN-014/018). Golden vectors of the web TypeScript
// (`imports/import-rules-vectors.json`, sample files) and real responses of the dev server (2026-10-19) are copied from
// spec/api/fixtures into Fixtures/ until the spec submodule is bumped. Twin: ImportsTest.kt.

private func localFixture(_ name: String) throws -> Data {
    try Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name)"))
}

private func vectors() throws -> [String: Any] {
    let root = try JSONSerialization.jsonObject(with: try localFixture("imports/import-rules-vectors.json")) as! [String: Any]
    return root["vectors"] as! [String: Any]
}

private func text(_ name: String) throws -> String { String(decoding: try localFixture(name), as: UTF8.self) }

private let today = "2026-10-19"

/// The web's JSON shape of an `ImportRow`.
private func json(_ row: ImportRow) -> [String: Any] {
    switch row {
    case let .ok(line, identity, op, warnings):
        var operation: [String: Any] = ["type": op.type, "date": op.date, "quantity": op.quantity, "price": op.price,
                                        "grossAmount": op.grossAmount as Any? ?? NSNull(), "fees": op.fees, "taxes": op.taxes,
                                        "note": op.note as Any? ?? NSNull()]
        operation = operation.mapValues { $0 }
        let id: [String: Any] = ["key": identity.key, "symbol": identity.symbol as Any? ?? NSNull(), "isin": identity.isin as Any? ?? NSNull(),
                                 "name": identity.name as Any? ?? NSNull(), "currency": identity.currency as Any? ?? NSNull(),
                                 "symbolIsYahoo": identity.symbolIsYahoo]
        return ["line": line, "status": "ok", "identity": id, "operation": operation, "warnings": warnings]
    case let .skipped(line, message): return ["line": line, "status": "skipped", "message": message]
    case let .error(line, message): return ["line": line, "status": "error", "message": message]
    }
}

private func same(_ a: Any, _ b: Any) -> Bool {
    NSDictionary(dictionary: ["v": a]).isEqual(to: ["v": b])
}

private func mappingJSON(_ m: ImportMapping) -> [String: Any] {
    ["columns": Dictionary(uniqueKeysWithValues: m.columns.map { ($0.key.rawValue, $0.value) }), "dateOrder": m.dateOrder.rawValue,
     "decimal": m.decimal.rawValue, "typeValues": m.typeValues, "defaultType": m.defaultType, "symbolIsYahoo": m.symbolIsYahoo]
}

private func nodeJSON(_ node: JSONNode) throws -> Any {
    try JSONSerialization.jsonObject(with: try JSONEncoder().encode(node), options: .fragmentsAllowed)
}

// MARK: - XLSX (IMP-018, PEN-014)

@Test func IMP018_readsTheFirstSheetLikeTheWeb() throws {
    let v = try vectors()["xlsx"] as! [String: Any]
    let grid = try ImportXlsx.read(try localFixture("imports/sample.xlsx"))
    #expect(grid.headers == v["headers"] as! [String])
    #expect(grid.rows == v["rows"] as! [[String]])
    #expect(try ImportXlsx.csv(try localFixture("imports/sample.xlsx")) == v["csv"] as! String)
}

@Test func IMP019_rejectsFilesThatAreNotXlsx() throws {
    #expect(throws: ImportXlsxError.message("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV")) {
        try ImportXlsx.read(Data("not a zip".utf8))
    }
    let error = PersonalImportRules.fileError(name: "vecchio.XLS", size: 10, locale: .itIT)
    #expect(error?.template.hasPrefix("I file .xls (Excel antico)") == true)
    let big = PersonalImportRules.fileError(name: "big.xlsx", size: 6 * 1024 * 1024, locale: .itIT)
    #expect(big == ImportText("Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.", ["0": "6 MB", "1": "5 MB"]))
    #expect(PersonalImportRules.fileError(name: "a.csv", size: 26 * 1024 * 1024, locale: .itIT)?.values == ["0": "26 MB", "1": "25 MB"])
    #expect(PersonalImportRules.fileError(name: "a.csv", size: 100, locale: .itIT) == nil)
}

@Test func IMP018_jsNumberToStringMatchesJavaScript() {
    #expect(ImportXlsx.jsToString(10880) == "10880")
    #expect(ImportXlsx.jsToString(11250.4) == "11250.4")
    #expect(ImportXlsx.jsToString(0.1 + 0.2) == "0.30000000000000004")
    #expect(ImportXlsx.jsToString(1e-7) == "1e-7")
    #expect(ImportXlsx.jsToString(0.000001) == "0.000001")
    #expect(ImportXlsx.jsToString(1e21) == "1e+21")
    #expect(ImportXlsx.jsToString(-2.5e-8) == "-2.5e-8")
    #expect(ImportXlsx.jsToString(123456789012345680000) == "123456789012345680000")
    #expect(ImportXlsx.excelSerialToIso(46022) == "2025-12-31")
    #expect(ImportXlsx.excelSerialToIso(0.5) == nil)
}

// MARK: - Broker files (INV-093…099)

@Test func INV094_detectsTheFormatFromContent() throws {
    for case let v as [String: Any] in try vectors()["detect"] as! [Any] {
        let content = try (v["file"] as? String).map { try text($0) } ?? v["text"] as! String
        #expect(ImportProviders.detect(content)?.rawValue == v["provider"] as? String, "\(v)")
    }
}

@Test func INV095_warnsWhenTheFileDoesNotMatchTheChosenProvider() throws {
    for case let v as [String: Any] in try vectors()["mismatch"] as! [Any] {
        let chosen = ImportProviderId(rawValue: v["chosen"] as! String)!
        let detected = (v["detected"] as? String).flatMap(ImportProviderId.init(rawValue:))
        #expect(ImportProviders.mismatchMessage(chosen: chosen, detected: detected) == v["message"] as? String)
    }
    #expect(ImportProviders.all.map(\.id) == [.tradeRepublic, .degiro, .fineco, .interactiveBrokers, .yahooPortfolio])
}

@Test func INV098_mapsGenericFilesLikeTheWeb() throws {
    for case let v as [String: Any] in try vectors()["generic"] as! [Any] {
        let table = ImportCsv.parse(try text(v["file"] as! String))
        #expect(String(table.delimiter) == v["delimiter"] as! String)
        let initial = ImportPresets.initialMapping(table)
        #expect(initial.preset?.id == v["preset"] as? String)
        #expect(same(mappingJSON(initial.mapping), v["mapping"]!), "\(v["file"]!)")
        #expect(ImportMappingRules.missingFields(initial.mapping) == v["missing"] as! [String])
        let rows = ImportNormalize.rows(table, mapping: initial.mapping, today: today)
        let expected = v["rows"] as! [Any]
        #expect(rows.count == expected.count)
        for (row, e) in zip(rows, expected) { #expect(same(json(row), e), "\(json(row)) vs \(e)") }
        let identities = ImportNormalize.identities(rows)
        let expectedIds = v["identities"] as! [[String: Any]]
        #expect(identities.map(\.identity.key) == expectedIds.map { $0["key"] as! String })
        #expect(identities.map(\.count) == expectedIds.map { $0["count"] as! Int })
        #expect(same(try nodeJSON(ImportFormatMetadata.mapped(table, mapping: initial.mapping, provider: nil)), v["metadata"]!))
    }
}

@Test func INV098_readsTheFinecoDossierTable() throws {
    let v = try vectors()["fineco"] as! [String: Any]
    let content = try text(v["file"] as! String)
    #expect(FinecoImport.looksLikeFineco(content) == v["looksLike"] as! Bool)
    let table = try FinecoImport.parseTable(content)
    let expectedTable = v["table"] as! [String: Any]
    #expect(table.headers == expectedTable["headers"] as! [String])
    #expect(table.rows == expectedTable["rows"] as! [[String]])
    let mapping = FinecoImport.mapping(table)
    #expect(same(mappingJSON(mapping), v["mapping"]!))
    let rows = ImportNormalize.rows(table, mapping: mapping, today: today)
    for (row, e) in zip(rows, v["rows"] as! [Any]) { #expect(same(json(row), e)) }
}

@Test func INV098_suggestsColumnsAndRemembersTheMappingPerHeaders() throws {
    for case let v as [String: Any] in try vectors()["suggestColumns"] as! [Any] {
        let columns = ImportMappingRules.suggestColumns(v["headers"] as! [String])
        #expect(same(Dictionary(uniqueKeysWithValues: columns.map { ($0.key.rawValue, $0.value) }), v["columns"]!))
    }
    #expect(ImportMappingRules.storageKey(["Data", "Quantità (n.)"]) == "bb-import-mapping:data|quantitan")
    let table = ImportCsv.parse(try text("imports/generic-operazioni.csv"))
    let mapping = ImportPresets.initialMapping(table).mapping
    let decoded = try JSONDecoder().decode(ImportMapping.self, from: try JSONEncoder().encode(mapping))
    #expect(decoded == mapping)
    #expect(ImportMappingRules.savedMappingIsValid(mapping, headers: table.headers))
    #expect(!ImportMappingRules.savedMappingIsValid(mapping, headers: ["a"]))
    let typed = ImportMappingRules.settingColumn(mapping, field: .type, column: 1, table: table)
    #expect(typed.typeValues["a"] == "acquisto")
}

@Test func INV095_explainsRowAndFileMessagesLikeTheWeb() throws {
    let v = try vectors()
    for case let e as [String: Any] in v["explainRow"] as! [Any] {
        let explained = ImportMessages.explainRow(e["message"] as! String)
        #expect(explained.text == e["text"] as! String)
        #expect(explained.hint == e["hint"] as? String)
    }
    for case let e as [String: Any] in v["explainFile"] as! [Any] {
        let explained = ImportMessages.explainFile(e["message"] as! String)
        #expect(explained.text == e["text"] as! String)
        #expect(explained.hint == e["hint"] as? String)
    }
}

@Test func INV093_validatesTheSelection() {
    #expect(ImportBatch.validate(sizes: Array(repeating: 10, count: 21)) == "Seleziona al massimo 20 file alla volta.")
    #expect(ImportBatch.validate(sizes: [6 * 1024 * 1024]) == "Ogni file deve essere più piccolo di 5 MB.")
    #expect(ImportBatch.validate(sizes: Array(repeating: 4 * 1024 * 1024, count: 7)) == "La selezione supera 25 MB. Seleziona meno file.")
    #expect(ImportBatch.validate(sizes: [1, 2]) == nil)
}

@Test func INV096_decodesTheServerStatementPreview() throws {
    let parsed = try JSONDecoder().decode(ActivityStatement.self, from: try localFixture("investments-import-parse-degiro.json"))
    #expect(parsed.provider == .degiro)
    #expect(!parsed.isEmpty)
    let rows = parsed.rows
    #expect(rows.map(\.line) == [5, 9, 10])
    #expect(rows.allSatisfy { $0.isOk })
    #expect(rows.first?.operation?.grossAmount == 5)
    #expect(parsed.warnings.isEmpty)
    #expect(ImportNormalize.identities(rows).map(\.count) == [3])
    #expect(parsed.statement?.from == "2025-01-01")
}

@Test func INV103_ordersStatementsIbkrFirstThenByAccountAndPeriod() throws {
    let degiro = try JSONDecoder().decode(ActivityStatement.self, from: try localFixture("investments-import-parse-degiro.json"))
    let files = [PreparedStatementFile(name: "b.csv", text: "", parsed: degiro), PreparedStatementFile(name: "a.csv", text: "", parsed: degiro)]
    let ordered = try ImportBatch.order(files)
    #expect(ordered.map(\.name) == ["b.csv", "a.csv"])
}

@Test func INV099_resolvesInstrumentsAndDescribesTheChoice() throws {
    struct Wrapper: Decodable { let results: [R]; struct R: Decodable { let key: String; let match: BrokerImportAPI.MatchDTO } }
    let resolved = try JSONDecoder().decode(Wrapper.self, from: try localFixture("investments-import-resolve.json"))
    let choice = InstrumentChoice(resolved.results[0].match.value)
    #expect(ImportChoices.describe(choice).title == "Da controllare")
    #expect(ImportChoices.attentionRank(choice) == 1)
    #expect(ImportChoices.describe(.skip(reason: "unavailable")).title == "Fonti non raggiungibili")
    #expect(ImportChoices.describe(nil).title == "Non trovato")
    #expect(ImportChoices.describe(.known(Instrument(id: "1", isin: "IT1", name: "X", priceMode: "manuale"))).text.hasPrefix("Ha i prezzi manuali"))
}

@Test func INV100_decodesTheDryRunAndBuildsTheRequest() throws {
    let result = try JSONDecoder().decode(ImportRunResult.self, from: try localFixture("investments-import-dry-run.json"))
    #expect(result.counts.new == 3)
    #expect(result.inserted == 0)
    let parsed = try JSONDecoder().decode(ActivityStatement.self, from: try localFixture("investments-import-parse-degiro.json"))
    let key = parsed.identities[0].key
    let input: JSONNode = .object(["source": .string("yahoo"), "yahooSymbol": .string("VWCE.MI")])
    var request = try #require(RunImportRequest.build(rows: parsed.rows, choices: [key: .create(input: input, label: "", detail: "", type: "etf", confidence: "guess",
                                                                                                  source: "yahoo")],
                                                      excluded: [], dryRun: true, preset: "degiro"))
    request.statementCsv = "csv"
    let body = try nodeJSON(request.json()) as! [String: Any]
    #expect(body["dryRun"] as? Bool == true)
    #expect((body["operations"] as! [Any]).count == 3)
    #expect(((body["instruments"] as! [[String: Any]])[0]["create"] as! [String: Any])["yahooSymbol"] as? String == "VWCE.MI")
    #expect(RunImportRequest.build(rows: parsed.rows, choices: [key: .skip(reason: "not_found")], excluded: [], dryRun: true, preset: nil) == nil)
    #expect(RunImportRequest.build(rows: parsed.rows, choices: [key: .known(Instrument(id: "i", name: "x"))], excluded: [key], dryRun: true, preset: nil) == nil)
}

// MARK: - Import management (INV-106…110)

@Test func INV106_listsBrokerAndPersonalImportsGroupedBySource() throws {
    struct S: Decodable { let statements: [BrokerStatementRecord] }
    let statements = try JSONDecoder().decode(S.self, from: try localFixture("investments-statements.json")).statements
    let personal = try JSONDecoder().decode(PersonalImportListing.self, from: try localFixture("personal-imports-imported.json"))
    let history = ImportHistory.build(statements: statements, personal: personal)
    #expect(history.map(\.kind) == [.personal, .broker])
    #expect(history[1].source == "DEGIRO")
    #expect(history[1].details.map(\.count) == [8])
    #expect(history[0].source == "Banca Prova")
    #expect(history[0].statusLabel == "Importato")
    #expect(ImportHistory.group(history).map(\.source) == ["Banca Prova", "DEGIRO"])
    #expect(ImportHistory.period(from: "2025-01-01", to: "2025-01-05", timeZone: TimeZone(identifier: "Europe/Rome")!, locale: .itIT) == "1 gen 2025 – 5 gen 2025")
    #expect(ImportHistory.period(from: "2025-01-01", to: "2025-01-01", timeZone: .current, locale: .itIT) == "1 gen 2025")
}

@Test func INV107_deletesLaterStatementsOfTheSameAccountToo() throws {
    struct S: Decodable { let statements: [BrokerStatementRecord] }
    let base = try JSONDecoder().decode(S.self, from: try localFixture("investments-statements.json")).statements[0]
    func record(_ id: String, _ account: String, _ from: String) -> BrokerStatementRecord {
        let s = base.statement
        return BrokerStatementRecord(id: id, accountKey: account, portfolioId: "", createdAt: "",
                                     statement: .init(provider: s.provider, account: s.account, from: from, to: from, positions: [], ledger: [], issues: []))
    }
    let all = [record("a", "x", "2024-01-01"), record("b", "x", "2025-01-01"), record("c", "y", "2026-01-01"), record("d", "x", "2023-01-01")]
    #expect(ImportHistory.affectedStatements("a", in: all).map(\.id) == ["a", "b"])
    #expect(ImportHistory.affectedStatements("zz", in: all).isEmpty)
}

@Test func INV108_decodesThePersonalDeletionPreview() throws {
    let preview = try JSONDecoder().decode(PersonalImportDeletion.self, from: try localFixture("personal-import-deletion.json"))
    #expect(preview.name == "Banca Prova")
    #expect(preview.cashCount == 6)
    #expect(preview.token.count == 64)
}

@Test func INV109_resetNeedsTheExactLiteral() {
    #expect(ImportHistory.resetConfirmation == "AZZERA INVESTIMENTI")
}

// MARK: - Personal imports (IMP-*)

private func job(_ status: String, id: String = "j", created: String = "2026-10-19T10:00:00.000Z", correctionOf: String? = nil,
                 error: String? = nil, results: PersonalImportListing.Results? = nil) -> PersonalImportListing.Job {
    PersonalImportListing.Job(id: id, formatId: "f", status: status, correctionOf: correctionOf, createdAt: created, error: error, results: results)
}

@Test func IMP002_decodesFormatsAndJobsNewestFirst() throws {
    let listing = try JSONDecoder().decode(PersonalImportListing.self, from: try localFixture("personal-imports-review.json"))
    #expect(listing.formats.map(\.name) == ["Banca Prova"])
    #expect(listing.jobs[0].status == "review_failed")
    #expect(listing.formatName(listing.jobs[0].formatId) == "Banca Prova")
    let imported = try JSONDecoder().decode(PersonalImportListing.self, from: try localFixture("personal-imports-imported.json"))
    #expect(imported.jobs[0].results == PersonalImportListing.Results(cash: 6, investments: 0, skipped: 0))
}

@Test func IMP003_pollsOnlyWhileAJobRuns() {
    #expect(PersonalImportRules.shouldPoll(PersonalImportListing(formats: [], jobs: [job("processing")])))
    #expect(PersonalImportRules.shouldPoll(PersonalImportListing(formats: [], jobs: [job("ready")])))
    #expect(!PersonalImportRules.shouldPoll(PersonalImportListing(formats: [], jobs: [job("imported"), job("review_failed")])))
    #expect(!PersonalImportRules.shouldPoll(nil))
}

@Test func IMP004_opensAJobFromItsPathOrLink() {
    #expect(ImportsRoutes.jobId(path: "/importazioni?job=abc-1") == "abc-1")
    #expect(ImportsRoutes.jobId(path: "/importazioni") == nil)
    #expect(ImportsRoutes.inAppPath(url: URL(string: "https://buddybudget.io/importazioni?job=x")!) == "/importazioni?job=x")
    #expect(ImportsRoutes.inAppPath(url: URL(string: "buddybudget://importazioni?job=x")!) == "/importazioni?job=x")
    #expect(ImportsRoutes.inAppPath(url: URL(string: "buddybudget://bank/return?ref=1")!) == nil)
    #expect(ImportsRoutes.inAppPath(url: URL(string: "https://example.com/importazioni")!) == nil)
    #expect(AppDestination(path: "/importazioni?job=x") == .imports)
    #expect(AppDestination.imports.tab == .liquidity)
}

@Test func IMP005_reportJobFollowsUploadSelectionThenFirstActive() {
    let jobs = [job("imported", id: "a"), job("processing", id: "b")]
    #expect(PersonalImportRules.reportJob(jobs: jobs, selected: nil, receiptJobId: nil)?.id == "b")
    #expect(PersonalImportRules.reportJob(jobs: jobs, selected: "a", receiptJobId: nil)?.id == "a")
    #expect(PersonalImportRules.reportJob(jobs: jobs, selected: "a", receiptJobId: "new")?.id == "new")
    #expect(PersonalImportRules.reportJob(jobs: [job("imported")], selected: nil, receiptJobId: nil) == nil)
}

@Test func IMP006_choosesCorrectionReviewOrReceipt() {
    #expect(PersonalImportRules.reportKind(job("review_failed"), correcting: nil) == .review)
    #expect(PersonalImportRules.reportKind(job("imported"), correcting: "j") == .correction)
    #expect(PersonalImportRules.reportKind(job("correction_ready", correctionOf: "o"), correcting: nil) == .correction)
    #expect(PersonalImportRules.reportKind(job("imported", correctionOf: "o"), correcting: nil) == .receipt)
    #expect(PersonalImportRules.reportKind(job("failed"), correcting: nil) == .receipt)
    #expect(!PersonalImportRules.showsUploadForm(report: nil, hasReceipt: true, correcting: nil))
    #expect(!PersonalImportRules.showsUploadForm(report: job("queued", correctionOf: "o"), hasReceipt: false, correcting: nil))
    #expect(PersonalImportRules.showsUploadForm(report: job("imported"), hasReceipt: false, correcting: nil))
}

@Test func IMP007_describesRowsAndDays() {
    #expect(PersonalImportRules.describe(job("processing")).message == ImportText("Analisi in corso"))
    #expect(PersonalImportRules.describe(job("imported", results: .init(cash: 3, investments: 1, skipped: 0)))
        == (ImportText("{0} movimenti · {1} operazioni", ["0": "3", "1": "1"]), "Dettaglio"))
    #expect(PersonalImportRules.describe(job("review_failed", error: "x")).message == ImportText("x", verbatim: true))
    #expect(PersonalImportRules.describe(job("expired")).action == "Riprova")
    let rome = TimeZone(identifier: "Europe/Rome")!
    let now = PersonalImportRules.instant("2026-10-19T18:00:00.000Z")!
    #expect(PersonalImportRules.dayLabel("2026-10-19T08:05:00.000Z", now: now, timeZone: rome, locale: .itIT) == ImportText("oggi {0}", ["0": "10:05"]))
    #expect(PersonalImportRules.dayLabel("2026-10-18T08:05:00.000Z", now: now, timeZone: rome, locale: .itIT) == ImportText("ieri"))
    #expect(PersonalImportRules.dayLabel("2026-10-02T08:05:00Z", now: now, timeZone: rome, locale: .itIT) == ImportText("{0}", ["0": "2 ott"]))
    #expect(PersonalImportRules.statusLabel("correction_ready") == "Correzione da confermare")
}

@Test func IMP009_failedRowsGoToTheForm() {
    #expect(PersonalImportRules.tapRetries(job("failed")))
    #expect(PersonalImportRules.tapRetries(job("expired")))
    #expect(!PersonalImportRules.tapRetries(job("failed", correctionOf: "o")))
    #expect(!PersonalImportRules.tapRetries(job("review_failed")))
}

@Test func IMP013_listsWhatTheStepMisses() {
    #expect(PersonalImportRules.missing(step: .source, isNew: true, name: "  ", hasFile: false, consent: false) == ["scrivi da dove arriva il file"])
    #expect(PersonalImportRules.missing(step: .source, isNew: false, name: "", hasFile: false, consent: false).isEmpty)
    #expect(PersonalImportRules.missing(step: .file, isNew: true, name: "x", hasFile: false, consent: false) == ["scegli il file"])
    #expect(PersonalImportRules.missing(step: .consent, isNew: true, name: "x", hasFile: true, consent: false) == ["dai il consenso all'analisi"])
}

@Test func IMP021_showsTheFileSizeAndRows() throws {
    #expect(PersonalImportRules.fileSize(500, locale: .itIT) == ImportText("{0} KB", ["0": "1"]))
    #expect(PersonalImportRules.fileSize(1536 * 1024, locale: .itIT) == ImportText("{0} MB", ["0": "1,5"]))
    #expect(PersonalImportRules.countCsvRows("a;b\n1;2\n\n3;4\n") == 2)
    let file = try PersonalImportRules.read(name: "banca-prova.csv", data: try localFixture("imports/banca-prova.csv"))
    #expect(PersonalImportRules.countCsvRows(file.csv) == 6)
    let xlsx = try PersonalImportRules.read(name: "sample.xlsx", data: try localFixture("imports/sample.xlsx"))
    #expect(xlsx.csv.hasPrefix("Data;Contributi netti;Controvalore"))
}

@Test func IMP028_derivesTheReceiptStage() {
    #expect(PersonalImportRules.receiptStage("queued") == 1)
    #expect(PersonalImportRules.receiptStage("processing") == 1)
    #expect(PersonalImportRules.receiptStage("ready") == 2)
    #expect(PersonalImportRules.receiptStage("imported") == 4)
    #expect(PersonalImportRules.receiptTitle("expired") == "Non siamo riusciti a importare il file")
    #expect(PersonalImportRules.receiptTitle("ready") == "File ricevuto")
}

@Test func IMP034_groupsThePreviewByOutcome() throws {
    let preview = try JSONDecoder().decode(PersonalImportPreview.self, from: try localFixture("personal-import-preview.json"))
    let groups = PersonalImportRules.groups(preview.records)
    #expect(groups.errors.count == 6)
    #expect(groups.ignored.count == 1)
    #expect(groups.importable.isEmpty)
    #expect(groups.tabs == [.importable, .ignored, .errors])
    #expect(groups.defaultTab == .errors)
}

@Test func IMP042_groupsErrorsByReasonMostFrequentFirst() throws {
    let preview = try JSONDecoder().decode(PersonalImportPreview.self, from: try localFixture("personal-import-preview.json"))
    let reasons = PersonalImportRules.errorsByReason(preview.records)
    #expect(reasons.map(\.records.count).reduce(0, +) == 6)
    #expect(reasons[0].reason == "Divisa mancante o non valida.")
    func err(_ key: String, _ reason: String) -> PersonalImportPreview.Record {
        .init(key: key, source: ["x"], outcome: .init(row: 0, kind: "error", reason: reason))
    }
    let ordered = PersonalImportRules.errorsByReason([err("1", "A"), err("2", "B"), err("3", "B"), err("4", " "), err("5", "A")])
    #expect(ordered.map(\.reason) == ["A", "B", "Riga non riconosciuta"])
}

@Test func IMP043_lineNumbersReferToTheOriginalFile() {
    let record = PersonalImportPreview.Record(key: "k", source: [" a ", "b"], outcome: .init(row: 3, kind: "error", reason: "x"))
    #expect(PersonalImportRules.sourceLine(record) == 4)
    #expect(PersonalImportRules.sourceText(record) == "a  · b")
    let withLine = PersonalImportPreview.Record(key: "k", source: [], line: 9, outcome: .init(row: 3, kind: "error", reason: "x"))
    #expect(PersonalImportRules.sourceLine(withLine) == 9)
}

@Test func IMP046_summarisesEachRow() {
    let cash = PersonalImportPreview.Record(key: "c", source: [], line: 2, outcome: .init(row: 1, kind: "cash", date: "2026-10-02", currency: "EUR",
                                                                                         description: "Stipendio", amount: 2150, transfer: false))
    #expect(PersonalImportRules.rowSummary(cash) == .init(date: "2026-10-02", title: "Stipendio", kind: "Movimento", quantity: nil, price: nil, line: 2,
                                                         amount: 2150, currency: "EUR", positive: true))
    let buy = PersonalImportPreview.Record(key: "b", source: [], outcome: .init(row: 4, kind: "investment", date: "2026-10-03", currency: "USD",
                                                                                type: "acquisto", name: "ETF", quantity: 2, price: 10))
    let s = PersonalImportRules.rowSummary(buy)
    #expect(s.amount == -20)
    #expect(s.line == 6)
    #expect(s.kind == "Acquisto")
    let sell = PersonalImportPreview.Record(key: "s", source: [], outcome: .init(row: 4, kind: "investment", type: "vendita", name: "ETF", quantity: 2, price: 10))
    #expect(PersonalImportRules.rowSummary(sell).amount == 20)
}

@Test func IMP058_islandShowsRecentNotDismissedJobs() {
    let now = PersonalImportRules.instant("2026-10-19T18:00:00.000Z")!
    let jobs = [job("imported", id: "old", created: "2026-10-18T17:00:00.000Z"), job("processing", id: "a", created: "2026-10-19T10:00:00.000Z"),
                job("failed", id: "b", created: "2026-10-19T12:00:00.000Z"), job("expired", id: "c", created: "2026-10-19T13:00:00.000Z")]
    #expect(PersonalImportRules.islandJobs(jobs, dismissed: [], now: now).map(\.id) == ["b", "a"])
    #expect(PersonalImportRules.islandJobs(jobs, dismissed: ["b"], now: now).map(\.id) == ["a"])
    let text = PersonalImportRules.islandText(job("imported", results: .init(cash: 6, investments: 0, skipped: 0)), source: "Banca Prova")
    #expect(text.title == ImportText("{0}: completato", ["0": "Banca Prova"]))
    #expect(text.detail == ImportText("{0} movimenti · {1} operazioni", ["0": "6", "1": "0"]))
    #expect(PersonalImportRules.islandText(job("correction_ready"), source: "x").detail == ImportText("Confronta la correzione prima di confermare."))
    #expect(PersonalImportRules.islandState("review_failed") == .failed)
}

@Test func IMP059_remembersTheLast50Dismissals() {
    var list: [String] = []
    for i in 0..<60 { list = PersonalImportRules.addDismissed("id\(i)", to: list) }
    #expect(list.count == 50)
    #expect(list.first == "id10")
    #expect(PersonalImportRules.addDismissed("id20", to: list).last == "id20")
}

@Test func IMP060_detectsFinishedJobs() {
    #expect(PersonalImportRules.finishedSince(previous: ["a"], now: [job("imported", id: "a")]))
    #expect(!PersonalImportRules.finishedSince(previous: ["a"], now: [job("ready", id: "a")]))
    #expect(!PersonalImportRules.finishedSince(previous: [], now: [job("imported", id: "a")]))
}

// MARK: - Pensione (PEN-014, PEN-018)

@Test func PEN014_readsSnapshotsFromCsvAndExcelFiles() throws {
    var state = PensionImportState(today: today, existing: [])
    state.loadFile(name: "sample.xlsx", data: try localFixture("imports/sample.xlsx"))
    #expect(state.step == .columns)
    #expect(state.fileName == "sample.xlsx")
    #expect(state.table?.decimalFallback == .dot)
    #expect(state.mapping?.columns[.date] == 0)
    var csv = PensionImportState(today: today, existing: [])
    csv.loadFile(name: "modello.csv", data: PensionImport.templateData())
    #expect(csv.snapshots.count == 2)
    #expect(csv.snapshots[0].value == 11250.4)
    var bad = PensionImportState(today: today, existing: [])
    bad.loadFile(name: "x.xlsx", data: Data("nope".utf8))
    #expect(bad.error == "Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV")
    bad.loadFile(name: "x.csv", data: Data("solo".utf8))
    #expect(bad.error == "Il file non sembra una tabella con intestazioni e almeno una riga")
}

@Test func PEN018_buildsTheDownloadableTemplate() {
    #expect(PensionImport.templateCsv() == "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11420,00;11890,15")
    #expect(PensionImport.templateData().prefix(3) == Data([0xEF, 0xBB, 0xBF]))
    #expect(PensionImport.templateFileName == "buddybudget-modello-pensione.csv")
}
