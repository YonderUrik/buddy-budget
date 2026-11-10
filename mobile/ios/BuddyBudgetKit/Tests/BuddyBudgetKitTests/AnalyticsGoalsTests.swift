import Foundation
import Testing
@testable import BuddyBudgetKit

// Analitiche and Obiettivi (spec: features/11-analytics.md, 12-goals.md). `analytics-base.json` comes from
// spec/api/fixtures (2026-10-18, demo user); `goals.json` is the same capture of `GET /api/goals` (2026-10-19), copied
// into Fixtures/ until the spec submodule is bumped. Twin: AnalyticsGoalsTest.kt.

private func analyticsView() throws -> AnalyticsView {
    try JSONDecoder().decode(AnalyticsView.self, from: try fixture("analytics-base.json"))
}

private func goalsView() throws -> GoalsView {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/goals.json")
    return try JSONDecoder().decode(GoalsView.self, from: try Data(contentsOf: url))
}

private func planJSON() throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: try fixtureJSON("analytics-base.json", ["plan"])) as! [String: Any]
}

nonisolated(unsafe) private let ait = AnalyticsText(locale: .itIT, translate: { $0 })
nonisolated(unsafe) private let git = GoalsText(locale: .itIT, currency: "EUR", translate: { $0 })
private let nbsp = "\u{00A0}"

private func state() throws -> AnalyticsUiState {
    var s = AnalyticsUiState()
    s.view = try analyticsView()
    return s
}

// MARK: - Analitiche

@Test func ANA002_decodesTheBaseAndRecomputesTheServerPlan() throws {
    let view = try analyticsView()
    #expect(view.currency == "EUR")
    #expect(view.walkthroughSeen)
    #expect(view.storedAssumptions.expectedReturn == 0.04)
    #expect(view.assumptions.expectedReturn == 0.16)
    #expect(view.returnInfo.source == .storico)
    #expect(view.base.positions.count == 13)
    #expect(view.base.cashflow.months.count == 12)
    #expect(view.base.risk?.observations == 316)
    let plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
    let server = try planJSON()
    #expect(abs(plan.target! - (server["target"] as! Double)) < 1e-6)
    #expect(abs(plan.yearsToFire! - (server["yearsToFire"] as! Double)) < 1e-9)
    #expect(abs(plan.wealth - (server["wealth"] as! Double)) < 1e-6)
    #expect(plan.spendingSource == .dati)
    #expect(plan.coast.count == 5)
}

@Test func ANA001_aCountryErrorShowsTheUnavailableState() {
    var s = AnalyticsUiState()
    #expect(s.gate == .loading)
    s.failed = true
    #expect(s.gate == .failed)
    s.unavailable = true
    #expect(s.gate == .unavailable)
}

@Test func ANA009_headlineSaysTheYearAndTheTimeLeft() throws {
    let s = try state()
    let plan = try #require(s.savedPlan)
    let h = ait.headline(plan: plan, baseline: plan, todayYear: 2026)
    #expect(h.lead == "Puoi smettere di lavorare intorno al")
    #expect(h.big == "2039")
    #expect(h.sub == "tra 12,3 anni")
    #expect(h.comparison == nil)
    let missing = FirePlanning.resolvePlan(FirePlanBase(wealth: .init(liquidity: 1000, investments: 0, pension: 0, debts: 0),
                                                        cashflow: .init(annualSpending: 0, annualSavings: 0, monthsWithData: 1), positions: []),
                                           .defaults)
    let m = ait.headline(plan: missing, baseline: missing, todayYear: 2026)
    #expect(m.missing && m.big == "Mi serve la tua spesa annua")
}

@Test func ANA010_sliderScenarioIsComparedWithTheSavedPlan() throws {
    var s = try state()
    let saved = try #require(s.savedPlan)
    s.move(.annualSavings, to: (saved.savings ?? 0) + 6000)
    #expect(s.hasScenario)
    let plan = try #require(s.scenarioPlan)
    #expect(plan.yearsToFire! < saved.yearsToFire!)
    let h = ait.headline(plan: plan, baseline: saved, todayYear: 2026)
    #expect(h.positive)
    #expect(h.comparison?.hasSuffix("prima delle ipotesi salvate") == true)
}

@Test func ANA011_periodChoiceFollowsTheSavedPeriodAndPersistsWithAPatch() throws {
    var s = try state()
    #expect(s.shownPeriodChoice == .twelve)
    #expect(AnalyticsPeriodChoice(.ultimi(months: 24)) == .twentyFour)
    s.chooseCustomPeriod()
    #expect(s.customFrom == "2025-10" && s.customTo == "2026-09")
    let json = AnalyticsAssumptionsPatch.period(.personalizzato(from: "2025-01", to: "2025-12")).json
    #expect((json["dataPeriod"] as? [String: Any])?["kind"] as? String == "personalizzato")
}

@Test func ANA012_customPeriodIsValidated() {
    let today = CalendarDate(year: 2026, month: 10, day: 18)
    #expect(AnalyticsRules.customPeriodError(from: "2025-10", to: "2026-10", today: today)?.source == "Il mese in corso non è finito: fermati al mese scorso.")
    #expect(AnalyticsRules.customPeriodError(from: "2026-08", to: "2026-09", today: today)?.source == "Scegli almeno {0} mesi.")
    #expect(AnalyticsRules.customPeriodError(from: "2015-01", to: "2026-09", today: today)?.source == "Scegli al massimo 10 anni.")
    #expect(AnalyticsRules.customPeriodError(from: "2024-01", to: "2026-09", today: today) == nil)
    #expect(AnalyticsRules.pickerYears(today: today).first == 2026 && AnalyticsRules.pickerYears(today: today).count == 11)
}

@Test func ANA013_showsTheActualRangeUsed() throws {
    let view = try analyticsView()
    #expect(ait.rangeText(view.base.cashflow.fromKey, view.base.cashflow.toKey) == "ott 2025 – set 2026")
    #expect(ait.periodPhrase(.ultimi(months: 12), fromKey: "", toKey: "") == "negli ultimi 12 mesi")
    #expect(ait.periodPhrase(.personalizzato(from: "2024-01", to: "2025-12"), fromKey: "2024-01-01", toKey: "2025-12-31") == "da gen 2024 a dic 2025")
}

@Test func ANA014_movingBackOntoTheBaselineClearsTheOverride() throws {
    var s = try state()
    let saved = try #require(s.savedPlan)
    s.move(.withdrawalRate, to: 0.04)
    #expect(s.overrides.withdrawalRate == 0.04)
    s.move(.withdrawalRate, to: 0.0352)
    #expect(s.overrides.withdrawalRate == nil)
    s.move(.annualSpending, to: (saved.spending ?? 0) + 30)
    #expect(s.overrides.annualSpending == nil)
    #expect(!s.hasScenario)
}

@Test func ANA015_deltaUnderAMovedSlider() {
    #expect(ait.deltaText(base: 12.3, next: 10.3) == "2 anni prima")
    #expect(ait.deltaText(base: 12.3, next: 13.8) == "1,5 anni dopo")
    #expect(ait.deltaText(base: 12.3, next: 12.32) == nil)
    #expect(ait.deltaText(base: 12.3, next: nil) == "il traguardo supera gli 80 anni")
}

@Test func ANA016_sourcesOfTheFiguresAndTheWayBack() throws {
    let view = try analyticsView()
    #expect(ait.returnSourceLabel(view.returnInfo) == "Dai tuoi dati")
    #expect(ait.returnSourceText(view.returnInfo, currency: "EUR", period: .ultimi(months: 12))
        == "Il tuo portafoglio negli ultimi 12 mesi ha reso 18,3% l'anno, 16,0% tolta l'inflazione.")
    #expect(AnalyticsRules.historyOffer(view.returnInfo) == nil)
    let manual = FireExpectedReturnInfo(value: 0.05, source: .manuale, history: view.returnInfo.history, historyReal: 0.6, clamped: false, high: false)
    #expect(AnalyticsRules.historyOffer(manual) == 0.5)
    #expect(AnalyticsAssumptionsPatch.useData(.annualSavings).json["annualSavings"] is NSNull)
    #expect(AnalyticsAssumptionsPatch.useHistoryReturn.json["expectedReturnAuto"] as? Bool == true)
    #expect(ait.cashflowAverageText(periodPhrase: "negli ultimi 12 mesi", coveredMonths: 12, periodMonths: 12)
        == "Media mensile dei movimenti negli ultimi 12 mesi, moltiplicata per 12. I giroconti tra i tuoi conti non contano.")
}

@Test func ANA017_optimisticReturnWarning() throws {
    let view = try analyticsView()
    #expect(view.returnInfo.high)
    #expect(FirePlanning.highReturnWarning == 0.08)
    #expect(ait.highReturnText.hasPrefix("Sopra 8% reale"))
}

@Test func ANA018_sliderIsReplacedWhenTheBaselineIsUnknown() {
    #expect(FirePlanning.scenarioSlider(.annualSpending, baseline: nil) == nil)
    #expect(FirePlanning.scenarioSlider(.annualSavings, baseline: nil) == nil)
    #expect(FirePlanning.scenarioSlider(.expectedReturn, baseline: nil) != nil)
    #expect(ait.notKnownHint == "Per calcolarla servono almeno 3 mesi di movimenti nel periodo scelto. Puoi scriverla in «Tutte le ipotesi».")
}

@Test func ANA019_savingTheSlidersSendsOnlyTheMovedFields() {
    let patch = AnalyticsAssumptionsPatch.scenario(FireScenarioOverrides(annualSavings: 9000, withdrawalRate: 0.04))
    #expect(patch.keys == ["annualSavings", "withdrawalRate"])
    #expect(patch.json["annualSavings"] as? Double == 9000)
}

@Test func ANA020_fourAnswerTilesDefaultingToArrivo() throws {
    let s = try state()
    #expect(s.selected == .quando)
    let plan = try #require(s.savedPlan)
    let costs = AnalyticsRules.costs(s.view!.base, ter: [:], country: "IT")
    let tiles = ait.tiles(plan: plan, scenario: false, todayYear: 2026, lasting: nil, retirementYears: 40, costs: costs, currency: "EUR")
    #expect(tiles.map(\.question) == [.doveSono, .quando, .reggera, .costi])
    #expect(tiles[0].value == "13%")
    #expect(tiles[0].note == "97.534\(nbsp)€ su 768.307\(nbsp)€")
    #expect(tiles[1].value == "2039" && tiles[1].note == "ai ritmi attuali")
    #expect(tiles[2].value == "—" && tiles[2].note == "serve la spesa annua")
    #expect(tiles[3].note == "0,20% l'anno")
    #expect(!tiles[2].loading)
    // While the Monte Carlo runs the tile is loading, not «serve la spesa annua» (that is only for a missing spending).
    let computing = ait.tiles(plan: plan, scenario: false, todayYear: 2026, lasting: nil, retirementYears: 40, costs: costs,
                              currency: "EUR", simulating: true)[2]
    #expect(computing.loading && computing.value.isEmpty)
}

@Test func ANA023_cancelledMonteCarloStopsEarly() {
    let input = MonteCarloInput(startingWealth: 500_000, annualSavings: 0, accumulationYears: 0, retirementYears: 40,
                                annualSpending: 20_000, expectedReturn: 0.05, volatility: 0.15, rule: .fissa)
    var polls = 0
    _ = MonteCarlo.runMonteCarlo(input) { polls += 1; return polls > 10 }
    #expect(polls == 11)
    #expect(MonteCarlo.runMonteCarlo(input) == MonteCarlo.runMonteCarlo(input, isCancelled: { false }))
}

@Test func ANA021_journeySentencesMatchTheServer() throws {
    let view = try analyticsView()
    let plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
    let split = FireCalc.splitGrowth(view.base.splitPoints)
    let sentences = ait.journeySentences(plan: plan, split: split, currency: "EUR", withdrawalRate: view.assumptions.withdrawalRate)
    let server = try JSONSerialization.jsonObject(with: try fixtureJSON("analytics-base.json", ["growth"])) as! [String: Any]
    #expect(sentences == server["journey"] as! [String])
}

@Test func ANA022_timelineSeriesMatchesTheServer() throws {
    let s = try state()
    let series = AnalyticsRules.timelineSeries(s.savedPlan!, s.view!.assumptions)
    let server = (try JSONSerialization.jsonObject(with: try fixtureJSON("analytics-base.json", ["timeline"])) as! [String: Any])["series"] as! [[String: Double]]
    #expect(series.count == server.count)
    for (a, b) in zip(series, server) { #expect(abs(a.wealth - b["wealth"]!) < 1e-6) }
}

@Test func ANA023_monteCarloIsDeterministicAndComparesTheFourRules() throws {
    let s = try state()
    let input = try #require(s.simulationInput)
    #expect(input.accumulationYears == 0)
    let a = MonteCarlo.compareRules(input), b = MonteCarlo.compareRules(input)
    #expect(a == b)
    #expect(a.map(\.rule) == WithdrawalRule.allCases)
    let answer = try #require(ait.lastingAnswer(a, selected: .fissa, retirementYears: 40))
    #expect(answer.rules.count == 4)
    #expect(answer.headline.hasPrefix("Se smettessi oggi, il patrimonio dura 40 anni nel "))
    #expect(answer.headline.hasSuffix("(regola: spesa fissa)."))
}

@Test func ANA024_costsAnswerCountsStampDutyAndLatentTax() throws {
    let s = try state()
    let view = s.view!
    let summary = AnalyticsRules.costs(view.base, ter: ["160469f4-e5ab-47c0-ae0b-e98b9272a5a9": 0.002], country: "IT")
    #expect(summary.annualCost > 0)
    let drag = AnalyticsRules.drag(summary, expectedReturn: view.assumptions.expectedReturn)
    #expect(drag.count == 31)
    let sentences = ait.costsSentences(summary, lostAfterYears: drag.last?.lost, years: 30, liquidation: s.savedPlan!.liquidation, currency: "EUR")
    #expect(sentences.first?.hasPrefix("Costi dei fondi e bollo: ") == true)
    #expect(sentences.contains { $0.hasPrefix("Per posizioni da ") })
    #expect(sentences.last == "Vendendo tutto oggi pagheresti circa 2223\(nbsp)€ di imposte sulle plusvalenze.")
}

@Test func ANA036_beforeTaxOutsideItaly() throws {
    let s = try state()
    let view = s.view!
    let ter = ["160469f4-e5ab-47c0-ae0b-e98b9272a5a9": 0.002]
    // No stamp duty for DE and «Altro paese» (web `annualStampDutyRate` 0, `summary.stampDuty` false).
    let other = AnalyticsRules.costs(view.base, ter: ter, country: "OTHER")
    let italy = AnalyticsRules.costs(view.base, ter: ter, country: "IT")
    #expect(!other.stampDuty)
    #expect(italy.stampDuty)
    #expect(other.annualCost < italy.annualCost)
    #expect(other.annualCost == AnalyticsRules.costs(view.base, ter: ter, country: "DE").annualCost)
    // Capital gains tax off: no latent tax, so no «Vendendo tutto oggi…» sentence and the plan runs before tax.
    let beforeTax = view.withCapitalGainsTax(false)
    #expect(beforeTax.base.positions.allSatisfy { $0.taxRate == 0 })
    #expect(view.withCapitalGainsTax(true) == view)
    let plan = FirePlanning.resolvePlan(beforeTax.base.planBase, beforeTax.assumptions)
    #expect(plan.liquidation.latentTax == 0)
    let sentences = ait.costsSentences(other, lostAfterYears: nil, years: 30, liquidation: plan.liquidation, currency: "EUR")
    #expect(sentences.first?.hasPrefix("Costi dei fondi: ") == true)
    #expect(!sentences.contains { $0.hasPrefix("Vendendo tutto oggi") })
    let others = ait.otherAssumptions(view.assumptions, taxes: false)
    #expect(others.hasPrefix("Altre ipotesi: volatilità ") && !others.contains("imposte"))
    #expect(ait.otherAssumptions(view.assumptions).contains("imposte"))
}

@Test func ANA025_guidanceWhenSpendingOrPositionsAreMissing() {
    let empty = CostSummary(rows: [], totalValue: 0, annualCost: 0, annualPct: nil, missingTerValue: 0)
    #expect(ait.costsSentences(empty, lostAfterYears: nil, years: 30, liquidation: FireCalc.computeLiquidation([]), currency: "EUR")
        == ["Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano."])
    var s = AnalyticsUiState()
    #expect(s.simulationInput == nil)
    s.overrides = FireScenarioOverrides()
    #expect(s.scenarioPlan == nil)
}

@Test func ANA026_expertPanelsStartCollapsed() {
    #expect(AnalyticsUiState().expertOpen.isEmpty)
}

@Test func ANA027_growthSplitNeedsTwoMonths() throws {
    let view = try analyticsView()
    let split = FireCalc.splitGrowth(view.base.splitPoints)
    #expect(split.rows.count == 12)
    #expect(ait.shortMonth("2025-11") == "nov 25")
}

@Test func ANA028_sensitivityTablesCentreOnTheUsersCell() throws {
    let s = try state()
    let plan = s.savedPlan!
    let a = s.view!.assumptions
    let rate = try #require(AnalyticsRules.rateSensitivity(plan, a, text: ait))
    #expect(rate.rows == ["2,5%", "3,0%", "3,5%", "4,0%", "4,5%"])
    #expect(rate.columns == ["14,0%", "15,0%", "16,0%", "17,0%", "18,0%"])
    // The tables use the gross FIRE number (no latent tax), like the web.
    let gross = FireCalc.yearsToTarget(FireGrowthInput(current: plan.wealth, annualSaving: plan.savings!, realReturn: a.expectedReturn),
                                       target: plan.fireNumberGross!)
    #expect(rate.cells[2][2].years == gross)
    let spend = try #require(AnalyticsRules.spendingSensitivity(plan, a, text: ait))
    #expect(spend.rows == ["−20%", "−10%", "0%", "+10%", "+20%"])
    #expect(AnalyticsRules.cellText(FireSensitivityCell(rowValue: 0, columnValue: 0, years: 12.27), text: ait) == "12,3 a")
    #expect(AnalyticsRules.cellText(FireSensitivityCell(rowValue: 0, columnValue: 0, years: 0), text: ait) == "ok")
    #expect(AnalyticsRules.leanNumber(s.view!.base, a) != nil)
}

@Test func ANA029_simulationCanRetireAtTheFireTarget() throws {
    var s = try state()
    s.retireAt = .fire
    let input = try #require(s.expertSimulationInput)
    #expect(input.accumulationYears == 13)
}

@Test func ANA031_terIsValidatedBetweenZeroAndFive() throws {
    let positions = try analyticsView().base.positions
    let id = positions[0].id
    #expect(try AnalyticsRules.validateTers([id: "0,20"], positions: positions).get() == [id: 0.002])
    if case .failure(let e) = AnalyticsRules.validateTers([id: "7"], positions: positions) {
        #expect(e.values["0"] == "ETF Azionario Globale Demo")
    } else {
        Issue.record("expected an error")
    }
    #expect(AnalyticsRules.terDrafts([id: 0.0022]) == [id: "0,22"])
    #expect(AnalyticsAssumptionsPatch.ters([id: 0.002]).json["terByInstrument"] as? [String: Double] == [id: 0.002])
}

@Test func ANA032_glossaryTermsAreUnderlinedOnce() {
    let parts = ait.glossed("Il numero FIRE è la tua spesa annua divisa per il tasso di prelievo; il numero FIRE resta.")
    #expect(parts == [.text("Il "), .term(id: "numero-fire", text: "numero FIRE"), .text(" è la tua spesa annua divisa per il "),
                      .term(id: "tasso-prelievo", text: "tasso di prelievo"), .text("; il numero FIRE resta.")])
    #expect(AnalyticsContent.term("var")?.title == "VaR 95%")
    #expect(AnalyticsContent.explainers.count == 9)
}

@Test func ANA033_allAssumptionsAreValidatedIntoAPartialUpdate() throws {
    let view = try analyticsView()
    var draft = AnalyticsAssumptionsDraft(view.storedAssumptions)
    #expect(draft.percents[.withdrawalRate] == "3,5")
    #expect(draft.years == "40")
    var patch = try draft.submit(text: ait).get()
    #expect(patch["expectedReturn"] == nil)
    #expect(patch["withdrawalRate"] == .number(0.035))
    #expect(patch["annualSpending"] == .null)
    #expect(patch["publicPension"] == .pension(nil))
    draft.set(.withdrawalRate, "12")
    if case .failure(let e) = draft.submit(text: ait) {
        #expect(e.text == "Tasso di prelievo: inserisci un valore tra 1,0% e 10,0%.")
    } else {
        Issue.record("expected an error")
    }
    draft.set(.withdrawalRate, "4")
    draft.years = "40,5"
    if case .failure(let e) = draft.submit(text: ait) { #expect(e.text == "Anni di pensione: inserisci un numero intero tra 5 e 70.") }
    draft.years = "35"
    draft.set(.expectedReturn, "5")
    draft.pensionAnnual = "12.000"
    draft.pensionAfter = "10"
    patch = try draft.submit(text: ait).get()
    #expect(patch["expectedReturn"] == .number(0.05))
    #expect(patch["publicPension"] == .pension(MonteCarloPublicPension(annual: 12000, startsAfterYears: 10)))
}

@Test func ANA034_resetRestoresTheRecommendedValues() throws {
    let view = try analyticsView()
    var draft = AnalyticsAssumptionsDraft(view.storedAssumptions)
    draft.set(.volatility, "30")
    draft.rule = .vanguard
    draft.includeTax = false
    draft.resetToDefaults(view.returnInfo)
    #expect(draft.percents[.volatility] == "12")
    #expect(draft.rule == .fissa && draft.includeTax && !draft.includePension)
    #expect(draft.years == "40")
    #expect(!draft.returnAuto)
}

@Test func ANA035_legacyRoutesSelectTheirQuestion() {
    #expect(AnalyticsQuestion(path: "/analitiche/costi") == .costi)
    #expect(AnalyticsQuestion(path: "/analitiche/crescita") == .doveSono)
    #expect(AnalyticsQuestion(path: "/analitiche/simulazione") == .reggera)
    #expect(AnalyticsQuestion(path: "/analitiche#reggera") == .reggera)
    #expect(AnalyticsQuestion(path: "/analitiche") == nil)
}

@Test func ANA005_walkthroughHasSixSteps() {
    #expect(AnalyticsContent.walkthrough.count == 6)
    #expect(AnalyticsContent.walkthrough[0].title == "Quattro domande, una risposta ciascuna")
}

@Test func ANA008_goalDialogPreviewsAndLinksToTheData() throws {
    let view = try analyticsView()
    let plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
    var draft = AnalyticsGoalDraft(plan: plan)
    #expect(draft.text == "26.278")
    #expect(draft.followsData)
    #expect(draft.patch?.json["annualSpending"] is NSNull)
    draft.text = "30.000"
    #expect(!draft.followsData)
    #expect(draft.patch?.json["annualSpending"] as? Double == 30000)
    let preview = try #require(draft.preview(base: view.base, assumptions: view.assumptions))
    #expect(abs(preview.fireNumberGross! - 30000 / 0.035) < 1e-6)
    #expect(ait.goalPreviewWhen(preview, todayYear: 2026).hasPrefix("Ai ritmi di oggi ci arrivi intorno al "))
    draft.text = "0"
    #expect(draft.patch == nil)
}

@Test func ANA_parseNumberReadsItalianNumbers() {
    #expect(AnalyticsRules.parseNumber("3,5") == 3.5)
    #expect(AnalyticsRules.parseNumber("1.250,5") == 1250.5)
    #expect(AnalyticsRules.parseNumber("24.000") == 24000)
    #expect(AnalyticsRules.parseNumber(" ") == nil)
    #expect(AnalyticsRules.parseNumber("abc") == nil)
    #expect(AnalyticsRules.toFieldText(0.035, percent: true) == "3,5")
    #expect(AnalyticsRules.toFieldText(26277.89, percent: false) == "26278")
}

// MARK: - Obiettivi

@Test func GOAL004_decodesTheGoalsViewAndReusesItForFiveMinutes() throws {
    let view = try goalsView()
    #expect(view.goals.count == 3)
    #expect(view.sources.count == 17)
    #expect(view.fire?.baseYear == 2039)
    #expect(view.essentialMonthly == 1428)
    #expect(view.goals[2].sources[0].kind == "instrument")
    var s = GoalsUiState()
    s.view = view
    let now = Date()
    s.loadedAt = now
    #expect(s.isFresh(now: now.addingTimeInterval(299)))
    #expect(!s.isFresh(now: now.addingTimeInterval(301)))
    #expect(s.gate == .content)
}

@Test func GOAL002_countryErrorShowsUnavailable() {
    var s = GoalsUiState()
    s.unavailable = true
    #expect(s.gate == .unavailable)
}

@Test func GOAL003_deepLinksOpenTheFormWithThePresetKind() {
    #expect(GoalsLaunchIntent(path: "/analitiche/obiettivi?nuovo=1&tipo=viaggio&da=novita") == .new(kind: .viaggio))
    #expect(GoalsLaunchIntent(path: "/analitiche/obiettivi?nuovo=1&tipo=boh") == .new(kind: nil))
    #expect(GoalsLaunchIntent(path: "/analitiche/obiettivi") == .list)
    #expect(GoalsLaunchIntent(path: "/analitiche/obiettivi/abc") == .detail(id: "abc"))
    #expect(GoalsLaunchIntent(path: "/analitiche") == nil)
}

@Test func GOAL005_GOAL006_emptyStateSuggestsAnEmergencyFund() throws {
    let view = try goalsView()
    var s = GoalsUiState()
    s.view = GoalsView(currency: "EUR", goals: [], sources: view.sources, essentialMonthly: 1428)
    #expect(s.gate == .empty)
    let suggestion = try #require(GoalsRules.emergencySuggestion(s.view!))
    #expect(suggestion.target == 8600)
    #expect(abs(suggestion.free - (8100 + 145 + 5050.34 + 1320)) < 1e-9)
    #expect(GoalsRules.emergencySuggestion(GoalsView(currency: "EUR", goals: [])) == nil)
}

@Test func GOAL007_capacityHeaderStatesAndBar() throws {
    let view = try goalsView()
    let header = git.capacityHeader(view)
    #expect(header.title == "Metti da parte 426\(nbsp)€ al mese.")
    #expect(header.requested == "I tuoi obiettivi ne chiedono 600\(nbsp)€.")
    #expect(header.explanation == "Il risparmio va agli obiettivi nell'ordine che scegli. Ne mancano 174\(nbsp)€ al mese: Anticipo casa resta indietro.")
    #expect(header.segments.map(\.key) == [view.goals[0].id, view.goals[1].id, view.goals[2].id, "gap"])
    #expect(header.segments.last?.dashed == true)
    #expect(git.segmentText(header.segments.last!) == "−174\(nbsp)€")
    #expect(abs(header.scaleMax - 600) < 1e-9)
    let unknown = GoalsView(currency: "EUR", goals: view.goals)
    #expect(git.capacityHeader(unknown).title == "Non sappiamo ancora quanto risparmi al mese.")
    let negative = GoalsView(currency: "EUR", capacity: -10, goals: view.goals)
    #expect(git.capacityHeader(negative).title == "In questo periodo hai speso più di quanto hai incassato.")
}

@Test func GOAL008_rowsSayStatusPaceAndFireShift() throws {
    let view = try goalsView()
    #expect(git.statusSentence(view.goals[0]) == "Al ritmo di 150\(nbsp)€ al mese ci arrivi a agosto 2027.")
    #expect(git.statusSentence(view.goals[1]) == "Al ritmo di 200\(nbsp)€ al mese ci arrivi a dicembre 2027, dopo agosto 2027: servirebbero 270\(nbsp)€ al mese.")
    #expect(git.statusSentence(view.goals[2]).contains(" (ricevi 76\(nbsp)€ dei 250\(nbsp)€ che hai scelto)"))
    #expect(git.statusLabel(view.goals[0]) == nil)
    #expect(git.statusLabel(view.goals[1]) == "In ritardo")
    #expect(git.fireShift(view.goals[0]) == "non sposta il traguardo")
    #expect(git.fireShift(view.goals[1]) == "sposta il traguardo di 2 mesi")
    #expect(GoalsRules.openGoals(view).count == 3)
}

@Test func GOAL009_reorderSwapsOpenNeighboursAndSendsTheFullOrder() throws {
    let view = try goalsView()
    let ids = view.goals.map(\.id)
    #expect(GoalsRules.reorder(view, openIndex: 1, delta: -1) == [ids[1], ids[0], ids[2]])
    #expect(GoalsRules.reorder(view, openIndex: 0, delta: -1) == nil)
    let moved = GoalsRules.applying([ids[2], ids[0], ids[1]], to: view)
    #expect(moved.goals.map(\.id) == [ids[2], ids[0], ids[1]])
}

@Test func GOAL011_fireRowSentence() throws {
    let view = try goalsView()
    #expect(git.fireSentence(view.fire!) == "Il traguardo delle Analitiche: ci arrivi nel 2039.")
    #expect(git.fireSentence(.init(target: 1, wealth: 0, progress: 0, baseYear: 2039, withGoalsYear: 2041))
        == "Il traguardo delle Analitiche: ci arrivi nel 2041 con i tuoi obiettivi, nel 2039 senza.")
    #expect(git.fireSentence(.init(target: 1, wealth: 0, progress: 0, baseYear: nil, withGoalsYear: nil))
        == "Il traguardo delle Analitiche: al ritmo di oggi non ci arrivi entro 50 anni.")
}

@Test func GOAL012_theRoadIsSortedByDate() throws {
    let stops = git.road(try goalsView())
    #expect(stops.map(\.when) == ["agosto 2027", "dicembre 2027", "2039", "novembre 2057"])
    #expect(stops[2].label == "Smetti di lavorare")
}

@Test func GOAL013_achievedGoalsAreListedApart() throws {
    let view = try goalsView()
    let g = view.goals[0]
    let done = GoalView(id: g.id, name: g.name, kind: g.kind, target: g.target, achievedAt: "2026-10-01T00:00:00.000Z", current: g.target,
                        progress: 1, monthsToGo: nil, status: "raggiunto")
    let v = GoalsView(currency: "EUR", goals: [done, view.goals[1]])
    #expect(GoalsRules.doneGoals(v).map(\.id) == [g.id])
    #expect(GoalsRules.openGoals(v).map(\.id) == [view.goals[1].id])
    #expect(git.statusSentence(done) == "Segnato come raggiunto: non prende più niente dal risparmio del mese.")
}

@Test func GOAL014_GOAL015_formStepsValidate() {
    var draft = GoalDraft()
    #expect(!GoalWizard.canAdvance(.tipo, draft, todayKey: "2026-10-19"))
    draft = GoalWizard.withKind(draft, .viaggio, essentialMonthly: nil)
    #expect(draft.name == "Viaggio")
    #expect(GoalWizard.canAdvance(.tipo, draft, todayKey: "2026-10-19"))
    #expect(GoalKind.altro.label == "Qualcos'altro")
}

@Test func GOAL016_GOAL017_amountStepNotes() {
    var draft = GoalWizard.withKind(GoalDraft(), .emergenza, essentialMonthly: 1428)
    #expect(draft.target == 8600 && draft.emergencyMonths == 6)
    draft.targetMonth = "2027-10"
    let note = git.requiredNote(draft, todayKey: "2026-10-19", capacity: GoalsFormCapacity(total: 426, taken: 350))
    #expect(note == "Per arrivare a ottobre 2027 servono 717\(nbsp)€ al mese. Metti da parte 426\(nbsp)€ al mese, di cui 350\(nbsp)€ già presi dagli altri obiettivi.")
}

@Test func GOAL018_GOAL019_sourcesProposeTheMissingAmount() throws {
    let view = try goalsView()
    let sources = GoalsRules.formSources(view, goal: nil)
    #expect(sources.count == 17)
    var draft = GoalDraft(kind: .viaggio, name: "Viaggio", target: 1000)
    let deposito = try #require(sources.first { $0.name == "Conto deposito" })
    draft = GoalsRules.toggleSource(draft, deposito)
    #expect(draft.sources.first?.amount == 1000)
    draft = GoalsRules.toggleSource(draft, deposito)
    #expect(draft.sources.isEmpty)
    draft.target = 0
    draft = GoalsRules.toggleSource(draft, deposito)
    #expect(draft.sources.first?.amount == 8100)
    let edit = GoalsRules.formSources(view, goal: view.goals[0])
    #expect(abs((edit.first { $0.name == "Conto deposito" }?.free ?? 0) - 15600) < 1e-9)
}

@Test func GOAL020_GOAL021_paceShortcutsAndPosition() throws {
    let view = try goalsView()
    let capacity = try #require(GoalsRules.formCapacity(view, goal: nil))
    #expect(abs(capacity.taken - view.allocated) < 1e-9)
    #expect(GoalsRules.freeCapacity(capacity) == 0)
    #expect(GoalsRules.positionChoices(view, goal: nil).count == 3)
    #expect(GoalsRules.positionChoices(view, goal: view.goals[0]).isEmpty)
    let draft = GoalsRules.initialDraft(view, goal: nil, presetKind: nil)
    #expect(draft.priority == 3)
}

@Test func GOAL022_summaryRows() {
    var draft = GoalDraft(kind: .viaggio, name: "Viaggio", target: 4500, targetMonth: "2027-08", monthly: 200)
    #expect(git.summaryRows(draft).map(\.value) == ["4500\(nbsp)€", "agosto 2027", "Niente, parti da zero", "200\(nbsp)€"])
    draft.sources = [GoalDraftSource(key: "account:a", amount: 1800)]
    #expect(git.summarySources(draft, names: ["account:a": "Conto deposito"]) == "Da: Conto deposito 1800\(nbsp)€")
}

@Test func GOAL024_GOAL025_createSendsThePriorityEditDoesNot() {
    let payload = GoalWizard.toPayload(GoalDraft(kind: .casa, name: " Casa ", target: 40000, targetMonth: "2031-10", monthly: 250,
                                                 sources: [GoalDraftSource(key: "instrument:x", amount: 12000)], priority: 2))
    let create = GoalsAPI.json(payload, includePriority: true)
    #expect(create["priority"] as? Int == 2)
    #expect(create["name"] as? String == "Casa")
    #expect(create["targetDate"] as? String == "2031-10-01")
    #expect((create["sources"] as? [[String: Any]])?.first?["instrumentId"] as? String == "x")
    #expect(GoalsAPI.json(payload, includePriority: false)["priority"] == nil)
    let noDate = GoalsAPI.json(GoalWizard.toPayload(GoalDraft(kind: .altro, name: "X", target: 1)), includePriority: false)
    #expect(noDate["targetDate"] is NSNull)
}

@Test func GOAL027_GOAL028_detailSourcesAndWhatChanges() throws {
    let view = try goalsView()
    #expect(git.sourceDetail(view.goals[0].sources[0]) == "7500\(nbsp)€ dei 17.400\(nbsp)€ sul conto")
    #expect(git.sourceDetail(view.goals[2].sources[0]).hasPrefix("12.000\(nbsp)€ dei 21.564\(nbsp)€ della posizione · imposta stimata "))
    #expect(git.targetLine(view.goals[1]) == "di 4500\(nbsp)€ · entro agosto 2027")
    #expect(git.wealthImpact(view.goals[0]) == ("0\(nbsp)€", "i soldi restano tuoi, da parte"))
    #expect(git.wealthImpact(view.goals[1]) == ("−4500\(nbsp)€", "escono a dicembre 2027"))
}

@Test func GOAL034_amountsAreMaskedWhenHidden() {
    let hidden = GoalsText(locale: .itIT, currency: "EUR", masked: true, translate: { $0 })
    #expect(hidden.money(1234) == BBFormat.amountMask)
}

@Test func ANA013_monthCalendarRangeAndBounds() {
    // No data yet: today falls back to 2026-01-01 and the period is the last 12 months.
    let state = AnalyticsUiState()
    #expect(state.customPeriodRange == DateKeyRange(from: "2025-01", to: "2025-12"))
    #expect(state.customPeriodMin == "2016-01")
    #expect(state.customPeriodMax == "2025-12")
}
