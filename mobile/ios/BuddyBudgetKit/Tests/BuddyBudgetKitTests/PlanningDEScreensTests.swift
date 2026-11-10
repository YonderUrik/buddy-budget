import Foundation
import Testing
@testable import BuddyBudgetKit

// German Tax and Income screens (spec: features/13-planning-de.md, PLAN-001…031). Results fixtures come from
// spec/api/fixtures (financial-planning-results-*.json, German demo user); the instrument names / operations come
// from Tests/BuddyBudgetKitTests/Fixtures/planning-portfolio-de.json (trimmed `GET /api/investments/overview` of the
// same user, captured 2026-10-19). Twin: PlanningDEScreensTest.kt.

private func envelope() throws -> PlanningEnvelope {
    try JSONDecoder().decode(PlanningEnvelope.self, from: try fixture("financial-planning-results-de.json"))
}

private func preview() throws -> PlanningResults {
    try JSONDecoder().decode(PlanningResults.self, from: try fixture("financial-planning-results-preview-de.json"))
}

private func portfolio() throws -> PlanningPortfolio {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/planning-portfolio-de.json")
    return try JSONDecoder().decode(PlanningPortfolio.self, from: try Data(contentsOf: url))
}

private func node(_ json: String) throws -> JSONNode {
    try JSONDecoder().decode(JSONNode.self, from: Data(json.utf8))
}

/// The fixture plan with one change at `path`.
private func plan(_ change: (inout [String: JSONNode]) -> Void) throws -> JSONNode {
    guard case .object(var root) = try envelope().plan else { throw CocoaError(.coderReadCorrupt) }
    change(&root)
    return .object(root)
}

private func setting(_ section: String, _ key: String, _ value: JSONNode) throws -> JSONNode {
    try plan { root in
        var o = root[section]?.object ?? [:]
        o[key] = value
        root[section] = .object(o)
    }
}

nonisolated(unsafe) private let english = GermanPlanningText(locale: .enGB, translate: { $0 })
private let nbsp = "\u{00A0}"

// MARK: - Gating (PLAN-001…004)

@Test func PLAN001_PLAN002_countryDecidesTheGermanScreens() throws {
    // The product country decides (web `productCountry === "DE"`); the language plays no part.
    #expect(InvestmentsCountryContent.of(country: "DE") == .germanPlan)
    #expect(InvestmentsCountryContent.of(country: "IT") == .italian)
}

@Test func PLAN003_germanSubpathsOfTaxAndIncomeAreBlocked() {
    #expect(InvestmentsCountryContent.germanPlan.blocksPath("/investimenti/tasse/simulazione"))
    #expect(InvestmentsCountryContent.germanPlan.blocksPath("/investimenti/proventi/calendario?x=1"))
    #expect(!InvestmentsCountryContent.germanPlan.blocksPath("/investimenti/tasse"))
    #expect(!InvestmentsCountryContent.germanPlan.blocksPath("/investimenti/proventi?anno=2026"))
    #expect(!InvestmentsCountryContent.italian.blocksPath("/investimenti/tasse/simulazione"))
}

@Test func PLAN004_onlyTaxAndIncomeSectionsAreOn() throws {
    let sections = try #require(try envelope().results).sections
    #expect(sections == PlanningResults.Sections(tax: true, income: true, pension: false, retirement: false, simulations: false))
}

// MARK: - Document and saving (PLAN-007…017)

@Test func PLAN007_decodesPlanRevisionAndResults() throws {
    let e = try envelope()
    #expect(e.revision == 0)
    #expect(e.plan["country"]?.string == "DE")
    #expect(e.plan["tax"]?["year"]?.double == 2026)
    let results = try #require(e.results)
    #expect(results.supported)
    #expect(results.tax?.report.events.count == 9)
    #expect(results.income?.history.map(\.year) == [2026, 2025])
    #expect(GermanPlanValidation.isValid(e.plan))
}

@Test func PLAN007_PLAN012_PLAN008_apiPaths() async throws {
    let body = String(decoding: try fixture("financial-planning-results-de.json"), as: UTF8.self)
    let transport = StubTransport(status: 200, body: body)
    let api = FinancialPlanningAPI(client: makeClient(transport))
    _ = try await api.load()
    #expect(transport.last?.url?.path == "/api/financial-planning")
    #expect(transport.last?.url?.query == "include=results")
    _ = try await api.save(plan: try envelope().plan, revision: 3)
    let put = try #require(transport.last)
    #expect(put.httpMethod == "PUT")
    let sent = try JSONSerialization.jsonObject(with: try #require(put.httpBody)) as? [String: Any]
    #expect(sent?["revision"] as? Int == 3)
    #expect(((sent?["plan"] as? [String: Any])?["tax"] as? [String: Any])?["year"] as? Int == 2026)
    #expect(String(decoding: put.httpBody!, as: UTF8.self).contains("\"year\":2026"))

    let previewBody = String(decoding: try fixture("financial-planning-results-preview-de.json"), as: UTF8.self)
    let t2 = StubTransport(status: 200, body: previewBody)
    _ = try await FinancialPlanningAPI(client: makeClient(t2)).preview(plan: try envelope().plan)
    #expect(t2.last?.httpMethod == "POST")
    #expect(t2.last?.url?.path == "/api/financial-planning/results")

    let t3 = StubTransport(status: 200, body: #"{"currency":"EUR","instruments":[],"transactions":[],"prices":[{"x":1}]}"#)
    _ = try await FinancialPlanningAPI(client: makeClient(t3)).portfolio()
    #expect(t3.last?.url?.path == "/api/investments/overview")
    #expect(t3.last?.url?.query == "period=1mese")
}

@Test func PLAN008_portfolioNamesAndOperations() throws {
    let p = try portfolio()
    #expect(p.instruments.count == 15)
    #expect(p.transactions.count == 53)
    #expect(p.name("574c06d0-e566-4aa8-a024-2701f240f174") == "ETF Euro Stoxx Dividend Demo")
}

@Test func PLAN009_unsupportedCurrencyHasNoResults() throws {
    let json = #"{"currency":"USD","supported":false,"sections":{"tax":true,"income":true,"pension":false,"retirement":false,"simulations":false},"tax":null,"income":null}"#
    let r = try JSONDecoder().decode(PlanningResults.self, from: Data(json.utf8))
    #expect(!r.supported)
    #expect(r.tax == nil && r.income == nil)
}

@Test func PLAN010_saveBarState() throws {
    var editor = GermanPlanEditor(plan: try envelope().plan, revision: 0)
    #expect(editor.statusKey == "Plan saved")
    #expect(editor.buttonKey == "Save plan")
    #expect(!editor.canSave)
    editor.updateTax { $0.historyConfirmed = true }
    #expect(editor.statusKey == "Unsaved changes")
    #expect(editor.canSave)
    let begun = editor.beginSave()
    let body = try #require(begun)
    #expect(body.revision == 0)
    #expect(editor.buttonKey == "Saving…")
    #expect(!editor.canSave)
    #expect(editor.beginSave() == nil)
    // Setting the value back makes the plan clean again.
    var back = GermanPlanEditor(plan: try envelope().plan, revision: 0)
    back.updateTax { $0.historyConfirmed = true }
    back.updateTax { $0.historyConfirmed = false }
    #expect(!back.isDirty)
}

@Test func PLAN011_validationMatchesTheServerSchema() throws {
    #expect(GermanPlanValidation.isValid(try node("{}")))
    #expect(GermanPlanValidation.isValid(try envelope().plan))
    let invalid: [JSONNode] = [
        try setting("tax", "churchRate", .number(0.07)),
        try setting("tax", "shareLosses", .number(-1)),
        try setting("tax", "otherCapitalIncome", .number(2e12)),
        try setting("tax", "year", .number(2027)),
        try setting("tax", "futureForecast", .string("always")),
        try setting("tax", "unknownKey", .bool(true)),
        try setting("tax", "fundKinds", .object(["a": .string("bond")])),
        try setting("tax", "fundKinds", .object([String(repeating: "x", count: 101): .string("equity")])),
        try setting("tax", "priorAdvancesBySale", .object(["s": .number(-2)])),
        try setting("tax", "joint", .string("yes")),
        try setting("fund", "acquisitionMonth", .number(13)),
        try setting("fund", "acquisitionMonth", .number(1.5)),
        try setting("retirement", "withdrawalRate", .number(0.001)),
        try setting("pensionTax", "childless", .bool(true)).withChildren(2),
        try plan { $0["country"] = .string("IT") },
        try plan { $0["extra"] = .number(1) },
        try plan { $0["cryptoOtherGains"] = .number(-2e12) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"BTC","acquired":"2026-01-01","sold":"2025-12-31","proceeds":1,"cost":1}"#)]) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"BTC","acquired":"2025-01-01","sold":"2025-12-31","proceeds":1,"cost":1}"#)]) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"BTC","acquired":"2025-02-30","sold":"2026-01-02","proceeds":1,"cost":1}"#)]) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"  ","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}"#)]) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"BTC","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1}"#)]) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":"A","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}"#),
                                          try! node(#"{"id":"a","name":"B","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}"#)]) },
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"GRV","kind":"statutory","paymentMode":"capital"}"#)]) },
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"X","kind":"avd","monthlyContribution":600,"yearsUntilPayment":28,"avd":{"enabled":true}}"#)]) },
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"X","kind":"avd","yearsUntilPayment":10,"avd":{"enabled":true}}"#)]) },
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"X","kind":"private","avd":{"payout":"drawdown","payoutStartAge":67,"payoutEndAge":85,"lumpSumRate":0.5}}"#)]) },
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"X","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}"#),
                                            try! node(#"{"id":"q","name":"Y","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}"#)]) },
    ]
    for (i, plan) in invalid.enumerated() {
        #expect(!GermanPlanValidation.isValid(plan), "case \(i)")
    }
    let valid: [JSONNode] = [
        try setting("tax", "churchRate", .number(0.09)),
        try setting("tax", "fundKinds", .object(["a": .string("foreign-property")])),
        try plan { $0["cryptoOtherGains"] = .number(-500) },
        try plan { $0["crypto"] = .array([try! node(#"{"id":"a","name":" BTC ","acquired":"2024-02-29","sold":"2026-01-02","proceeds":1,"cost":1}"#)]) },
        // AVD: 67 - 40 + 2027 - 2026 = 28 years.
        try plan { $0["pensions"] = .array([try! node(#"{"id":"p","name":"X","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}"#),
                                            try! node(#"{"id":"q","name":"Y","kind":"avd","yearsUntilPayment":3,"pensionStartYear":null,"taxFreeAnnualAmount":null}"#)]) },
    ]
    for (i, plan) in valid.enumerated() {
        #expect(GermanPlanValidation.isValid(plan), "case \(i)")
    }
    var editor = GermanPlanEditor(plan: try setting("tax", "churchRate", .number(0.07)), revision: 1)
    editor.updateTax { $0.joint = true }
    #expect(editor.validationKey == "Check the entered names, dates and numeric limits before saving.")
    #expect(!editor.canSave)
}

@Test func PLAN012_saveAdoptsTheServerPlanAndRevision() throws {
    var editor = GermanPlanEditor(plan: try envelope().plan, revision: 4)
    editor.updateTax { $0.shareLosses = 120 }
    let begun = editor.beginSave()
    let body = try #require(begun)
    editor.saveSucceeded(plan: body.plan, revision: 5)
    #expect(editor.revision == 5)
    #expect(!editor.isDirty)
    #expect(editor.tax.shareLosses == 120)
    #expect(editor.statusKey == "Plan saved")
}

@Test func PLAN013_conflictAndFailureKeepTheEdits() async throws {
    var editor = GermanPlanEditor(plan: try envelope().plan, revision: 0)
    editor.updateTax { $0.generalLosses = 50 }
    _ = editor.beginSave()
    editor.saveFailed(conflict: true)
    #expect(editor.message?.key == "This plan changed in another tab. Reload before saving.")
    #expect(editor.tax.generalLosses == 50)
    #expect(editor.canSave)
    _ = editor.beginSave()
    #expect(editor.message == nil)
    editor.saveFailed(conflict: false)
    #expect(editor.message?.key == "Could not save. Your changes are still here.")
    #expect(editor.isDirty)

    let transport = StubTransport(status: 409, body: #"{"error":"plan_changed","code":"plan_changed"}"#)
    do {
        _ = try await FinancialPlanningAPI(client: makeClient(transport)).save(plan: try envelope().plan, revision: 0)
        Issue.record("expected 409")
    } catch let error as APIError {
        #expect(error.body?.status == 409)
        #expect(error.body?.code == .other("plan_changed"))
    }
}

@Test func PLAN014_PLAN031_savingTaxKeepsHiddenSectionsAndSettings() throws {
    let saved = try plan { root in
        root["retirement"] = try! node(#"{"annualSpending":30000,"realReturn":0.03}"#)
        root["pensions"] = .array([try! node(#"{"id":"p","name":"GRV","kind":"statutory","points":31.5}"#)])
        var tax = root["tax"]!.object!
        tax["futureForecast"] = .string("constant-2026")
        root["tax"] = .object(tax)
    }
    var editor = GermanPlanEditor(plan: saved, revision: 2)
    editor.updateTax { $0.joint = true; $0.churchRate = 0.08; $0.fundKinds["f1"] = "equity" }
    let draft = editor.draft
    #expect(draft["retirement"] == saved["retirement"])
    #expect(draft["pensions"] == saved["pensions"])
    #expect(draft["pensionTax"] == saved["pensionTax"])
    #expect(draft["fund"] == saved["fund"])
    #expect(draft["tax"]?["futureForecast"]?.string == "constant-2026")
    #expect(draft["tax"]?["year"]?.double == 2026)
    #expect(draft["tax"]?["fundKinds"]?["f1"]?.string == "equity")
    #expect(GermanPlanValidation.isValid(draft))
}

@Test func PLAN015_numericInputsClampAndStoreFractions() {
    #expect(PlanningNumberInput.value(text: "") == 0)
    #expect(PlanningNumberInput.value(text: "abc") == 0)
    #expect(PlanningNumberInput.value(text: "-5") == 0)
    #expect(PlanningNumberInput.value(text: "1.250,50") == 1250.5)
    #expect(PlanningNumberInput.value(text: "12,5") == 12.5)
    #expect(PlanningNumberInput.value(text: "5000000000000") == 1e12)
    #expect(PlanningNumberInput.value(text: "15", min: 1, max: 12) == 12)
    #expect(PlanningNumberInput.value(text: "2,5", min: -50, max: 30, percent: true) == 0.025)
    #expect(PlanningNumberInput.needsClamp(text: "-5"))
    #expect(!PlanningNumberInput.needsClamp(text: "5"))
    #expect(!PlanningNumberInput.needsClamp(text: ""))
    #expect(PlanningNumberInput.text(1250.5, locale: .deDE) == "1250,5")
    #expect(PlanningNumberInput.text(1250.5, locale: .enGB) == "1250.5")
    #expect(PlanningNumberInput.text(0, locale: .deDE) == "0")
    #expect(PlanningNumberInput.text(0.025, locale: .deDE, percent: true) == "2,5")
}

@Test func PLAN016_PLAN022_PLAN023_resultRows() throws {
    let report = try #require(try envelope().results?.tax?.report)
    let rows = english.taxRows(report)
    #expect(rows.map(\.label) == ["Foreign tax credit applied", "Estimated capital income tax", "Solidarity surcharge", "Church tax",
                                  "Estimated total tax", "Recorded taxes (shown separately)", "Remaining share losses", "Remaining general losses"])
    #expect(rows.filter { $0.value == "More information needed" }.count == 7)
    #expect(rows[5].value == "€149.72")

    let complete = #"{"events":[],"issues":[],"recordedTaxes":0,"shareGains":0,"generalIncome":1500,"estimate":{"taxable":500,"foreignCredit":0,"usedAllowance":1000,"remainingAllowance":0,"capitalTax":125,"solidarity":6.87,"church":0,"total":131.87,"remainingShareLosses":0,"remainingGeneralLosses":0}}"#
    let estimated = english.taxRows(try JSONDecoder().decode(PlanningResults.TaxReport.self, from: Data(complete.utf8)))
    #expect(estimated.map(\.value) == ["€0.00", "€125.00", "€6.87", "€0.00", "€131.87", "€0.00", "€0.00", "€0.00"])
    let german = GermanPlanningText(locale: .deDE, translate: { $0 })
    #expect(german.amount(131.87) == "131,87\(nbsp)€")
}

@Test func PLAN017_officialSources() {
    #expect(GermanPlanningText.sources.map(\.label) == ["EStG §32d", "InvStG §18", "InvStG §20", "RWBestV 2026", "EStG §23"])
    #expect(GermanPlanningText.sources.allSatisfy { $0.url.hasPrefix("https://www.gesetze-im-internet.de/") })
}

@Test func PLAN018_taxProfileInputs() throws {
    var editor = GermanPlanEditor(plan: try envelope().plan, revision: 0)
    editor.updateTax {
        $0.joint = true
        $0.churchRate = GermanPlanningText.churchRate("0.09")
        $0.allowanceUsedElsewhere = 200
        $0.verifiedForeignCredit = 12.5
        $0.shareLosses = 1
        $0.generalLosses = 2
        $0.otherCapitalIncome = 3
    }
    let tax = editor.draft["tax"]
    #expect(tax?["joint"]?.bool == true)
    #expect(tax?["churchRate"]?.double == 0.09)
    #expect(tax?["allowanceUsedElsewhere"]?.double == 200)
    #expect(tax?["verifiedForeignCredit"]?.double == 12.5)
    #expect(GermanPlanningText.churchValue(editor.tax.churchRate) == "0.09")
    #expect(english.assessmentOptions.map(\.label) == ["Individual (€1,000 allowance)", "Joint (€2,000 allowance)"])
    #expect(english.churchOptions.map(\.value) == ["0", "0.08", "0.09"])
}

@Test func PLAN019_PLAN021_PLAN026_issueLines() throws {
    let report = try #require(try envelope().results?.tax?.report)
    let lines = english.issueLines(report, portfolio: try portfolio())
    #expect(lines == [
        "Confirm complete acquisition history and custody accounts before calculating.",
        "ETF Euro Stoxx Dividend Demo: Confirm the fund tax classification using its documentation.",
        "ETF Euro Stoxx Dividend Demo: Confirm prior fund advances and any taxable advances received this year.",
        "Physisches Gold ETC Demo: This instrument or adjustment requires individual tax treatment.",
    ])
    // Confirming the history removes the history issue (server preview of the same plan).
    let confirmed = try #require(try preview().tax?.report)
    #expect(!confirmed.issues.contains { $0.reason == "history" })
    #expect(confirmed.estimate == nil)
    #expect(GermanPlanningText.reasonKeys.count == 8)
}

@Test func PLAN020_PLAN024_realisedEvents() throws {
    let report = try #require(try envelope().results?.tax?.report)
    let rows = english.realisedEvents(report, portfolio: try portfolio())
    #expect(rows.count == 9)
    #expect(rows[0].label == "20 Feb 2026 · Nimbus Cloud Inc.")
    #expect(rows[0].value == "€8.16")
    #expect(rows[3].value == "€152.00")
}

@Test func PLAN025_fundsAndFundSales() throws {
    let tax = try #require(try envelope().results?.tax)
    let funds = english.fundRows(tax, portfolio: try portfolio())
    #expect(funds.map(\.name) == ["Aktien Welt ETF Demo", "ETF S&P 500 Demo", "ETF Emerging Markets Demo", "ETF Euro Stoxx Dividend Demo",
                                  "Euro-Anleihen ETF Demo", "Mischfonds Demo"])
    #expect(english.fundOptions.map(\.value) == ["unknown", "equity", "mixed", "property", "foreign-property", "other"])
    #expect(english.fundOptions[4].label == "Foreign property fund (80% exemption)")
    #expect(english.fundSaleRows(tax, portfolio: try portfolio()).isEmpty)

    let json = #"{"report":{"events":[],"issues":[],"recordedTaxes":0,"shareGains":0,"generalIncome":0,"estimate":null},"fundInstrumentIds":["f"],"fundSaleIds":["s1","gone"]}"#
    let withSale = try JSONDecoder().decode(PlanningResults.Tax.self, from: Data(json.utf8))
    let p = PlanningPortfolio(instruments: [.init(id: "f", name: "World ETF", type: "etf")],
                              transactions: [.init(id: "s1", instrumentId: "f", type: "vendita", date: "2026-03-05")])
    #expect(english.fundSaleRows(withSale, portfolio: p).map(\.label) == ["World ETF · 5 Mar 2026 · Prior gross advances (€)"])
    var editor = GermanPlanEditor(plan: try envelope().plan, revision: 0)
    #expect(editor.tax.fundKind("f") == "unknown")
    editor.updateTax { $0.fundKinds["f"] = "equity"; $0.priorAdvancesBySale["s1"] = 42; $0.fundHistoryConfirmed = true }
    #expect(editor.tax.fundKind("f") == "equity")
    #expect(editor.tax.priorAdvances("s1") == 42)
    #expect(editor.draft["tax"]?["fundHistoryConfirmed"]?.bool == true)
}

@Test func PLAN027_recordedIncomeNewestFirst() throws {
    let income = try #require(try envelope().results?.income)
    let years = english.incomeYears(income)
    #expect(years.map(\.year) == [2026, 2025])
    #expect(years[0].rows.map(\.label) == ["Gross income", "Recorded withholding and fees", "Recorded net income"])
    #expect(years[0].rows.map(\.value) == ["€512.04", "€149.72", "€362.32"])
}

@Test func PLAN028_PLAN029_PLAN030_forecastCards() throws {
    let income = try #require(try envelope().results?.income)
    let cards = english.forecastCards(income, portfolio: try portfolio())
    #expect(cards.count == 12)
    #expect(cards[0].date == "12 Nov 2026")
    #expect(cards[0].instrument == "ETF Euro Stoxx Dividend Demo")
    #expect(cards[0].gross == "€35.66")
    #expect(cards[0].net == "More information needed")
    #expect(cards[0].netUnavailable)
    #expect(english.amount(income.totalGross) == "€626.63")
    #expect(income.bondsWithoutTerms.isEmpty)
    #expect(Set(income.events.map(\.kind)) == ["dividendo", "cedola"])
}

@Test func PLAN031_noScenarioRowsWithoutSimulations() throws {
    let income = try #require(try envelope().results?.income)
    #expect(income.events.allSatisfy { !$0.benchmark })
}

private extension JSONNode {
    func withChildren(_ n: Double) -> JSONNode {
        guard case .object(var root) = self, var pt = root["pensionTax"]?.object else { return self }
        pt["childrenUnder25"] = .number(n)
        root["pensionTax"] = .object(pt)
        return .object(root)
    }
}
