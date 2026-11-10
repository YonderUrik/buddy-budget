import Foundation
import Testing
@testable import BuddyBudgetKit

// Help & support (16-help-support, SUP-*). Real dev-server responses in Fixtures/support.json (copied from
// spec/api/fixtures until the submodule is bumped). Twin: SupportTest.kt.

private func supportFixture() throws -> [String: Any] {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/support.json")
    return try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
}

private func reply(_ name: String, in root: [String: Any]) throws -> StubTransport.Reply {
    let entry = root[name] as! [String: Any]
    let body = entry["body"].flatMap { $0 is NSNull ? nil : $0 }
    let text = try body.map { String(decoding: try JSONSerialization.data(withJSONObject: $0), as: UTF8.self) } ?? ""
    return StubTransport.Reply(status: entry["status"] as! Int, body: text)
}

private func jsonObject(_ request: URLRequest?) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: request?.httpBody ?? Data()) as! [String: Any]
}

private let context = ReportContext(path: "/liquidita/conti", version: "ios-0.1.0 (1)", width: 402, height: 874, dark: true)

// MARK: - Help screen

@Test func SUP002_fromParameterIsTheContextPath() {
    #expect(HelpLaunch(path: "/aiuto?da=%2Fliquidita%2Fconti").contextPath == "/liquidita/conti")
    #expect(HelpLaunch(path: "/aiuto").contextPath == "/aiuto")
    #expect(HelpLaunch(path: "/aiuto?da=").from == nil)
}

@Test func SUP003_kindParameterIsPreselectedAndInvalidValuesIgnored() {
    #expect(HelpLaunch(path: "/aiuto?tipo=idea").kind == .idea)
    #expect(HelpLaunch(path: "/aiuto?da=/debiti&tipo=domanda").kind == .domanda)
    #expect(HelpLaunch(path: "/aiuto?tipo=altro").kind == .problema)
    #expect(HelpLaunch(path: "/aiuto").kind == .problema)
    #expect(ReportKind.parse("PROBLEMA") == nil)
}

@Test func SUP004_statusPageLink() {
    #expect(Support.statusURL == "https://stats.uptimerobot.com/BCuTWm0Ukg")
}

@Test func SUP006_fiveQuickAnswersVerbatim() {
    #expect(Support.faq.map(\.id) == ["banca-scaduta", "import-csv", "categoria-sbagliata", "dati-miei", "stime-fiscali"])
    #expect(Support.faq[0].question == "Il collegamento con la banca non si aggiorna più")
    #expect(Support.faq[3].answer == "Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi.")
}

@Test func SUP007_githubLinksWithPrefilledIssue() {
    let links = Support.githubLinks(context: context)
    #expect(links.map(\.id) == [.issue, .issueAperte, .novita, .sicurezza])
    // Same string as the web's `new URLSearchParams(...).toString()` for this context.
    #expect(links[0].href == "https://github.com/YonderUrik/buddy-budget/issues/new?template=bug.yml&ambiente=BuddyBudget+ios-0.1.0+%281%29%2C+pagina+%2Fliquidita%2Fconti%2C+schermo+402x874%2C+tema+scuro")
    #expect(links[1].href == "https://github.com/YonderUrik/buddy-budget/issues")
    #expect(links[2].href == "https://github.com/YonderUrik/buddy-budget/releases")
    #expect(links[3].href == "https://github.com/YonderUrik/buddy-budget/security/policy")
    #expect(links[3].hint == "In privato, mai in una issue pubblica.")
    #expect(Support.githubIssueURL(kind: .idea, context: context) == "https://github.com/YonderUrik/buddy-budget/issues/new?template=funzionalita.yml")
    #expect(Support.formEncode("BuddyBudget 0.1.0 (1), pagina /a") == "BuddyBudget+0.1.0+%281%29%2C+pagina+%2Fa")
}

// MARK: - Report form

@Test func SUP008_kindLabelsAndPlaceholders() {
    #expect(ReportKind.allCases.map(\.label) == ["Un problema", "Una domanda", "Un'idea"])
    #expect(ReportKind.problema.placeholder == "Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo.")
    #expect(ReportKind.domanda.placeholder == "Cosa vuoi sapere?")
    #expect(ReportKind.idea.placeholder == "Cosa ti piacerebbe poter fare?")
}

@Test func SUP009_messageNeedsTenCharactersAfterTrimming() {
    #expect(!Support.canSubmit(message: "   corto    "))
    #expect(!Support.canSubmit(message: "123456789"))
    #expect(Support.canSubmit(message: "1234567890"))
    #expect(!Support.canSubmit(message: "Abbastanza lungo", pending: true))
    let long = String(repeating: "a", count: 4100)
    let input = Support.input(kind: .idea, message: long, withContext: false, context: context, source: .pagina, error: nil)
    #expect(input.message.count == Support.messageMaxLength)
}

@Test func SUP011_contextOmittedWhenUnchecked() throws {
    let with = Support.input(kind: .domanda, message: "  Una domanda vera  ", withContext: true, context: context, source: .pagina, error: nil)
    #expect(with.context == context)
    #expect(with.message == "Una domanda vera")
    let without = Support.input(kind: .domanda, message: "Una domanda vera", withContext: false, context: context, source: .pagina, error: nil)
    #expect(without.context == nil)
    let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(without)) as! [String: Any]
    #expect(body["context"] == nil)
    #expect(body["error"] == nil)
}

@Test func SUP012_contextHasOnlyPathVersionScreenAndTheme() throws {
    let raw = ReportContext(path: "/investimenti/titoli/abc?x=1#y", version: String(repeating: "9", count: 50), viewport: "1x1", theme: .chiaro)
    #expect(raw.path == "/investimenti/titoli/abc")
    #expect(raw.version.count == 40)
    #expect(raw.viewport == "100x100")
    #expect(Support.sanitizePath("https://evil.example") == "/")
    #expect(Support.sanitizePath("/" + String(repeating: "a", count: 200)).count == 120)
    #expect(context.viewport == "402x874")
    #expect(context.theme == .scuro)
    let keys = try (JSONSerialization.jsonObject(with: JSONEncoder().encode(context)) as! [String: Any]).keys.sorted()
    #expect(keys == ["path", "theme", "version", "viewport"])
}

@Test func SUP013_sendReturnsTheReference() async throws {
    let root = try supportFixture()
    let transport = StubTransport([try reply("created", in: root)])
    let api = SupportAPI(client: makeClient(transport, token: "t"))
    let input = Support.input(kind: .domanda, message: "Fixture capture, dev server only", withContext: true,
                              context: ReportContext(path: "/aiuto", version: "ios-0.1.0 (1)", viewport: "402x874", theme: .chiaro),
                              source: .pagina, error: nil)
    let reference = try await api.send(input)
    #expect(reference == "SUP-7K2QF9")
    #expect(transport.last?.httpMethod == "POST")
    #expect(transport.last?.url?.path == "/api/support")
    let sent = try jsonObject(transport.last)
    #expect(NSDictionary(dictionary: sent).isEqual(to: root["request"] as! [String: Any]))
}

@Test func SUP013_twoHundredWithoutReferenceIsAFailure() async throws {
    let transport = StubTransport([try reply("createdWithoutReference", in: try supportFixture())])
    let api = SupportAPI(client: makeClient(transport, token: "t"))
    await #expect(throws: ReportSendError(serverMessage: nil)) {
        _ = try await api.send(Support.input(kind: .idea, message: "Un'idea lunga", withContext: false, context: context, source: .pagina, error: nil))
    }
}

@Test func SUP015_failureKeepsTheServerMessage() async throws {
    let root = try supportFixture()
    for (name, expected) in [("validation", "Scrivi qualche parola in più."),
                             ("sendFailedIt", "Non siamo riusciti a inviare la segnalazione. Riprova o scrivi a support@buddybudget.io.")] {
        let api = SupportAPI(client: makeClient(StubTransport([try reply(name, in: root)]), token: "t"))
        do {
            _ = try await api.send(Support.input(kind: .idea, message: "Un messaggio", withContext: false, context: context, source: .pagina, error: nil))
            Issue.record("expected a failure")
        } catch {
            #expect(error.message == expected)
        }
    }
    #expect(ReportSendError(serverMessage: nil).message == "Non siamo riusciti a inviare la segnalazione.")
}

@Test func SUP016_rateLimitMessageFromTheServer() async throws {
    let api = SupportAPI(client: makeClient(StubTransport([try reply("rateLimitedDe", in: try supportFixture())]), token: "t"))
    do {
        _ = try await api.send(Support.input(kind: .idea, message: "Un messaggio", withContext: false, context: context, source: .pagina, error: nil))
        Issue.record("expected a failure")
    } catch {
        #expect(error.message == "Du hast bereits mehrere Meldungen gesendet: Versuche es später erneut.")
    }
}

@Test func SUP018_sourceTagsTheReport() throws {
    for source in [ReportSource.pagina, .pulsante, .errore] {
        let input = Support.input(kind: .idea, message: "Un messaggio", withContext: false, context: context, source: source, error: nil)
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as! [String: Any]
        #expect(body["source"] as? String == source.rawValue)
    }
}

// MARK: - Quick-report sheet

@Test func SUP020_errorForcesTheProblemKind() throws {
    let root = try supportFixture()
    let error = ReportError(area: .abbonamento, message: "Hai già un abbonamento con questo nome")
    let input = Support.input(kind: .idea, message: "Il salvataggio non va a buon fine", withContext: false, context: context,
                              source: .errore, error: error)
    #expect(input.kind == .problema)
    let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as! [String: Any]
    #expect(NSDictionary(dictionary: body).isEqual(to: root["requestFromError"] as! [String: Any]))
    #expect(ReportErrorArea.abbonamento.label == "Salvataggio di un abbonamento")
    #expect(ReportErrorArea.allCases.count == 13)
}

@Test func SUP021_attachedErrorIsCutTo300Characters() {
    let error = ReportError(area: .salvataggio, message: String(repeating: "x", count: 400))
    #expect(error.message.count == 300)
    #expect(ReportErrorArea(rawValue: "import_movimenti") == .importMovimenti)
    #expect(ReportErrorArea(rawValue: "boh") == nil)
}

// MARK: - Crash reporting

@Test func SUP024_crashReportCarriesOnlyTheArea() throws {
    #expect(ClientErrorArea.from(path: "/investimenti/titoli/abc") == .investimenti)
    #expect(ClientErrorArea.from(path: "/liquidita/conti?nuovo=1") == .liquidita)
    #expect(ClientErrorArea.from(path: "/country-unavailable") == .altro)
    #expect(ClientErrorArea.from(path: "/") == .altro)
    let report = ClientErrorReport.decodingFailure(screenPath: "/panoramica", endpoint: "api/overview")
    let root = try supportFixture()
    let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(report)) as! [String: Any]
    #expect(NSDictionary(dictionary: body).isEqual(to: (root["clientErrors"] as! [String: Any])["request"] as! [String: Any]))
    #expect(ClientErrorReport.decodingFailure(screenPath: "/debiti", endpoint: "api/debts/abc-123?include=insights").message
        == "Risposta non leggibile: /api/debts")
    let long = ClientErrorReport(kind: .sezione, path: "/aiuto", name: String(repeating: "n", count: 99), message: "", digest: String(repeating: "d", count: 99))
    #expect(long.message == "Errore senza messaggio")
    #expect(long.name?.count == 80)
    #expect(long.digest?.count == 64)
}

@Test func SUP024_decodingFailureFiresTheHookOnce() async throws {
    let transport = StubTransport([StubTransport.Reply(status: 200, body: "{\"nope\":1}"), StubTransport.Reply(status: 204, body: "")])
    let client = makeClient(transport, token: "t")
    let seen = LockedPaths()
    client.events.set(onDecodingFailure: { seen.append($0) })
    struct Shape: Decodable { let reference: String }
    _ = try? await client.get("api/overview", as: Shape.self)
    #expect(seen.values == ["api/overview"])
    let reporter = ClientErrorReporter(api: ClientErrorsAPI(client: client))
    let report = ClientErrorReport.decodingFailure(screenPath: "/panoramica", endpoint: "api/overview")
    #expect(await reporter.report(report))
    #expect(!(await reporter.report(report)))
    #expect(transport.requests.count == 2)
    #expect(transport.last?.url?.path == "/api/client-errors")
}

@Test func SUP025_crashReportFailuresAreSilent() async throws {
    let root = try supportFixture()
    let invalid = (root["clientErrors"] as! [String: Any])["invalid"] as! [String: Any]
    let body = String(decoding: try JSONSerialization.data(withJSONObject: invalid["body"]!), as: UTF8.self)
    let api = ClientErrorsAPI(client: makeClient(StubTransport(status: 400, body: body), token: "t"))
    await api.report(ClientErrorReport(kind: .sezione, path: "/aiuto", name: nil, message: "x"))
    let offline = ClientErrorsAPI(client: makeClient(StubTransport(status: 429, body: ""), token: "t"))
    await offline.report(ClientErrorReport(kind: .sezione, path: "/aiuto", name: nil, message: "x"))
}

private final class LockedPaths: @unchecked Sendable {
    private let lock = NSLock()
    private var items: [String] = []
    func append(_ value: String) { lock.withLock { items.append(value) } }
    var values: [String] { lock.withLock { items } }
}
