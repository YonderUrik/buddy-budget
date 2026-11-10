import Foundation
import Testing
@testable import BuddyBudgetKit

// Investimenti and Titoli (spec: features/07-investments.md, 08-securities-watchlist.md). View fixtures come from
// spec/api/fixtures (investments-*.json); instrument fixtures were captured from the dev server (demo user,
// 2026-10-19) into Tests/BuddyBudgetKitTests/Fixtures/instruments-*.json. Twin: InvestmentsTest.kt.

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
    try JSONDecoder().decode(T.self, from: try fixture(name))
}

private func local<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name)")
    return try JSONDecoder().decode(T.self, from: try Data(contentsOf: url))
}

nonisolated(unsafe) private let italian = InvestmentsText(locale: .itIT, translate: { $0 })
private let nbsp = "\u{00A0}"

// MARK: - View, query, tabs (INV-001…010)

@Test func INV005_decodesViewFixtures() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(v.currency == "EUR" && v.period == "3mesi" && v.hasTransactions)
    #expect(v.summary.rows.count == 13 && v.series.count == 93)
    #expect(v.summary.rows[0].instrument.kind == .etf && v.summary.rows[0].lastPrice?.origin == "yahoo")
    #expect(v.costScenarios.count == 4 && v.operationYears == [2026, 2025])
    #expect(v.analysis.allocation?.rows.first?.status == "sotto")
    #expect(v.operationMonths.first?.operations.first?.transaction.isReconciled == true)
    let excluded = try decode(InvestmentsView.self, "investments-view-ytd-excluded.json")
    #expect(excluded.period == "ytd" && excluded.range == InvestmentsView.DateRange(from: "2026-01-01", to: "2026-10-18"))
    #expect(excluded.brokers.first { $0.id == "manual" }?.excluded == true)
}

@Test func INV005_INV016_queryParameters() {
    let today = "2026-10-18"
    let custom = ChartRange(from: "2026-03-01", to: "2026-06-30")
    #expect(InvestmentsQuery.make(period: .threeMonths, custom: custom, today: today, excludedBrokers: []).parameters
        == ["period": "3mesi", "today": today])
    let ytd = InvestmentsQuery.make(period: .ytd, custom: custom, today: today, excludedBrokers: ["manual", "degiro"])
    #expect(ytd.range == ChartRange(from: "2026-01-01", to: today))
    #expect(ytd.parameters == ["period": "ytd", "today": today, "excludeBrokers": "degiro,manual"])
    let c = InvestmentsQuery.make(period: .custom, custom: custom, today: today, excludedBrokers: [],
                                  selection: ChartRange(from: "2026-04-01", to: "2026-05-01"))
    #expect(c.parameters == ["period": "custom", "from": "2026-03-01", "to": "2026-06-30", "today": today,
                             "selFrom": "2026-04-01", "selTo": "2026-05-01"])
    // An invalid custom range never reaches the server.
    #expect(InvestmentsQuery.make(period: .custom, custom: ChartRange(from: "2026-12-01", to: "2026-01-01"), today: today,
                                  excludedBrokers: []).period == .threeMonths)
    #expect(InvestmentsPeriod.default == .threeMonths)
    #expect(InvestmentsPeriod.allCases.map(\.label) == ["1M", "3M", "YTD", "1A", "Max", "Personalizzato"])
}

@Test func INV017_customRangeValidation() {
    let today = "2026-10-18"
    #expect(InvestmentsRules.isValidRange(ChartRange(from: "2026-01-01", to: today), today: today))
    #expect(!InvestmentsRules.isValidRange(ChartRange(from: "2026-02-30", to: today), today: today))
    #expect(!InvestmentsRules.isValidRange(ChartRange(from: "2026-05-01", to: "2026-04-01"), today: today))
    #expect(!InvestmentsRules.isValidRange(ChartRange(from: "2026-05-01", to: "2026-10-19"), today: today))
    #expect(InvestmentsRules.defaultCustomRange(today: today) == ChartRange(from: "2026-01-01", to: today))
}

@Test func INV002_INV003_tabsAndCountryGating() {
    #expect(InvestmentsTab.visible(MeBootstrap.Sections()).map(\.title) == ["Portafoglio", "Performance", "Diversificazione", "Dividendi", "Tasse", "Operazioni"])
    let off = MeBootstrap.Sections(investmentTaxes: false, investmentIncome: false)
    #expect(InvestmentsTab.visible(off) == [.portfolio, .performance, .diversification, .operations])
    #expect(InvestmentsCountryContent.of(country: "IT") == .italian)
}

@Test func INV091_germanUsersNeverGetTheItalianEngine() {
    #expect(InvestmentsCountryContent.of(country: "DE") == .germanPlan)
}

@Test func INV113_otherCountryGetsTheItalianScreensBeforeTaxWithoutTheTaxesTab() {
    // «Altro paese» (#465): Dividendi on the Italian engine, Tasse left out (server sections).
    #expect(InvestmentsCountryContent.of(country: "OTHER") == .italian)
    let other = MeBootstrap.Sections(pension: false, investmentTaxes: false, financialPlanning: false)
    #expect(InvestmentsTab.visible(other) == [.portfolio, .performance, .diversification, .income, .operations])
    #expect(!InvestmentsCountryContent.italian.blocksPath("/investimenti/proventi/x"))
}

@Test func INV004_SEC001_legacyAndDeepLinks() {
    #expect(InvestmentsTab(path: "/investimenti/rendiconti") == .operations)
    #expect(InvestmentsTab(path: "/investimenti/rendiconti/importazioni") == .operations)
    #expect(InvestmentsTab(path: "/investimenti/titoli") == .portfolio)
    #expect(InvestmentsTab(path: "/investimenti/tasse?x=1") == .taxes)
    #expect(InvestmentsTab(path: "/investimenti/titoli/abc") == nil)
    #expect(InvestmentsTab.instrumentId(path: "/investimenti/titoli/abc") == "abc")
    #expect(InvestmentsTab.instrumentId(path: "/investimenti/titoli") == nil)
}

@Test func INV008_INV009_brokerSelector() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(InvestmentsRules.showsBrokerSelector(v.brokers))
    var state = InvestmentsUiState(today: "2026-10-18")
    #expect(state.brokerChip(v.brokers).source == "Tutti i broker")
    state.excludedBrokers = ["manual"]
    #expect(state.brokerChip(v.brokers).source == "Broker: {0} di {1}" && state.brokerChip(v.brokers).values == ["0": "1", "1": "2"])
    #expect(state.portfolioQuery.excludedBrokers == ["manual"])
}

@Test func INV010_gate() {
    #expect(InvestmentsGate.of(loaded: false, failed: false, hasTransactions: false, hasCash: false, countsCash: true, brokersFiltered: false) == .loading)
    #expect(InvestmentsGate.of(loaded: false, failed: true, hasTransactions: false, hasCash: false, countsCash: true, brokersFiltered: false) == .failed)
    #expect(InvestmentsGate.of(loaded: true, failed: false, hasTransactions: false, hasCash: true, countsCash: true, brokersFiltered: false) == .content)
    #expect(InvestmentsGate.of(loaded: true, failed: false, hasTransactions: false, hasCash: true, countsCash: false, brokersFiltered: false) == .empty)
    #expect(InvestmentsGate.of(loaded: true, failed: false, hasTransactions: false, hasCash: false, countsCash: false, brokersFiltered: true) == .emptyFiltered)
}

// MARK: - Portafoglio (INV-011…030)

@Test func INV011_INV012_INV014_heroSentences() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(italian.dayChange(41.47, pct: 0.000564, currency: "EUR", masked: false) == "+41\(nbsp)€ (+0,1%)")
    #expect(italian.cashLine(cash: 1320, total: 74938.97, currency: "EUR", masked: false)
        == "Solo titoli. In più hai 1320\(nbsp)€ di liquidità sui broker (totale 74.939\(nbsp)€).")
    let gain = italian.periodGainSentence(try #require(v.periodGain), currency: "EUR", masked: false).map(\.text).joined()
    #expect(gain == "Da 18 lug 2026 il valore è passato da 77.486\(nbsp)€ a 73.619\(nbsp)€. Nel periodo hai ritirato 6588\(nbsp)€: quello non è guadagno. Il periodo ha reso +2886\(nbsp)€ (+3,8%), compresi 165\(nbsp)€ tra dividendi e cedole.")
}

@Test func INV013_maxSentenceAndBreakdown() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    let runs = italian.gainSentence(v.breakdown, unpriced: 0, currency: "EUR", masked: false)
    #expect(runs.map(\.text).joined() == "Per quello che possiedi hai pagato 66.394\(nbsp)€: il mercato ha aggiunto +7225\(nbsp)€ (+10,9%). Hai già incassato 2059\(nbsp)€ tra vendite, dividendi e cedole.")
    #expect(runs[3].style == .pos)
    let loss = InvestmentsView.Breakdown(paid: 1000, market: -100, value: 900, marketShare: nil, cashedIn: 0)
    #expect(italian.gainSentence(loss, unpriced: 2, currency: "EUR", masked: false).map(\.text).joined()
        == "Per quello che possiedi hai pagato 1000\(nbsp)€: il mercato ha tolto −100\(nbsp)€ (−10,0%). 2 strumenti non hanno ancora un prezzo e non è contato.")
}

@Test func INV018_INV019_costScenarios() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(InvestmentsRules.costScenario(v.costScenarios, reinvestFees: false, reinvestTaxes: false)?.extra == 0)
    let both = try #require(InvestmentsRules.costScenario(v.costScenarios, reinvestFees: true, reinvestTaxes: true))
    #expect(!both.includeFees && !both.includeTaxes)
    let hero = PortfolioHero.of(v, reinvestFees: true, reinvestTaxes: false)
    #expect(hero.simulating && !hero.showsDayChange && hero.registered?.count == 93)
    #expect(abs(hero.value - 74094.32) > 1 && abs(hero.extra - 56.99) < 0.01)
    let off = PortfolioHero.of(v, reinvestFees: false, reinvestTaxes: false)
    #expect(!off.simulating && off.value == v.summary.totalValue && off.showsDayChange)
}

@Test func INV021_positionTexts() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    let row = v.summary.rows[0]
    #expect(italian.quantityWithUnit(row) == "191,16 quote")
    #expect(italian.positionGain(row, currency: "EUR", masked: false) == "+2357,42\(nbsp)€ · +12,3%")
    #expect(InvestmentsRules.percent(row.weight ?? 0) == "29%")
    #expect(v.priceNote(row.instrument.id)?.stale == false)
}

@Test func INV030_instrumentIcons() {
    #expect(InstrumentIcons.initials("Energia Italia S.p.A.") == "Ei")
    #expect(InstrumentIcons.initials("Alpenfood") == "Al")
    #expect(InstrumentIcons.spec(type: .etf, name: "iShares Core MSCI World") == InstrumentIconSpec(initials: "iS", swatch: "blue"))
    #expect(InstrumentIcons.spec(type: .azione, name: "Nimbus Cloud Inc.").swatch == "violet")
    #expect(InstrumentIcons.wantsRemoteLogo(type: .azione, name: "x") && !InstrumentIcons.wantsRemoteLogo(type: .etf, name: "ETF Demo"))
}

// MARK: - Performance (INV-031…044)

@Test func INV031_INV033_decodesPerformance() throws {
    let p = try decode(InvestmentsPerformance.self, "investments-performance.json")
    #expect(p.returns?.series.count == 94 && p.returns?.values.benchmarkStatus == "ok")
    #expect(p.benchmarkVerdict == "even" && p.risk?.level == 1 && p.risk?.sharpeLevel == "buono")
    #expect(p.heatmaps.mese?.grouping == "mese" && p.heatmaps.giorno != nil)
    #expect(RiskCopy.sharpeWord(p.risk?.sharpeLevel) == "Bene")
    #expect(italian.rangeLabel(try #require(p.returns?.values)) == "18 lug 2026 – 18 ott 2026")
}

@Test func INV034_inspectSnapsToNearestSampledPoint() throws {
    let p = try decode(InvestmentsPerformance.self, "investments-performance-max.json")
    #expect(p.inspect.count == 160 && p.returns?.series.count == 427)
    #expect(InvestmentsRules.nearestInspect(4, in: p.inspect)?.index == 3)
    #expect(InvestmentsRules.nearestInspect(7, in: p.inspect)?.index == 8)
    #expect(InvestmentsRules.nearestInspect(426, in: p.inspect)?.index == 426)
    #expect(InvestmentsRules.nearestInspect(0, in: []) == nil)
}

@Test func INV038_INV039_benchmarkWait() {
    let running = BackfillState(instrumentId: "b", status: "running", saved: 10, total: 100, interrupted: false)
    #expect(BenchmarkRules.wait(backfill: nil, firstPriceDate: nil, baseKey: "2026-01-01") == .checking)
    #expect(BenchmarkRules.wait(backfill: .some(running), firstPriceDate: nil, baseKey: "2026-01-01") == .downloading(saved: 10, total: 100))
    #expect(BenchmarkRules.wait(backfill: .some(nil), firstPriceDate: nil, baseKey: "2026-01-01") == .failed)
    let done = BackfillState(instrumentId: "b", status: "done", saved: 1, total: 1, interrupted: false)
    #expect(BenchmarkRules.wait(backfill: .some(done), firstPriceDate: "2026-02-01", baseKey: "2026-01-01") == .noHistory(firstPriceDate: "2026-02-01"))
    #expect(BenchmarkRules.wait(backfill: .some(nil), firstPriceDate: "2025-01-01", baseKey: "2026-01-01") == .incomplete)
    #expect(BenchmarkRules.suggestions.map(\.yahooSymbol) == ["CSPX.L", "IWDA.AS", "VWCE.DE", "SXRV.DE"])
    #expect(BenchmarkRules.verdict(portfolioValue: 73618.97, simulatedValue: 73287.87) == "even")
    #expect(BenchmarkRules.verdict(portfolioValue: 110, simulatedValue: 100) == "better")
}

@Test func INV041_SEC026_riskLevels() {
    #expect([0.05, 0.08, 0.149, 0.15, 0.249, 0.3].map(TitleRules.riskLevel) == [1, 2, 2, 3, 3, 4])
    #expect(TitleRules.riskScalePosition(volatility: 0.7) == 1)
}

@Test func INV042_drawdownText() {
    let recovered = InvestmentsPerformance.Drawdown(depth: -0.012, peakDate: "2026-07-23", troughDate: "2026-07-27", recoveryDate: "2026-07-31", current: 0)
    #expect(italian.drawdownText(recovered, recoveryDays: 4) == "Dal 23 lug 2026 al 27 lug 2026; tornato al massimo in 4 giorni.")
    let open = InvestmentsPerformance.Drawdown(depth: -0.1, peakDate: "2026-07-23", troughDate: "2026-07-27", recoveryDate: nil, current: -0.05)
    #expect(italian.drawdownText(open, recoveryDays: nil) == "Dal 23 lug 2026 al 27 lug 2026; non è ancora tornato al massimo (a fine periodo −5,0%).")
}

@Test func INV044_heatmapSummary() throws {
    let p = try decode(InvestmentsPerformance.self, "investments-performance.json")
    #expect(italian.heatmapSummary(try #require(p.heatmaps.mese)) == "4 mesi in guadagno e 0 in perdita.")
}

// MARK: - Diversificazione (INV-045…055)

@Test func INV053_INV054_allocationAndNextContribution() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    let allocation = try #require(v.analysis.allocation)
    #expect(ExposureKeys.driftText(allocation.rows[0]).values == ["0": "−6"])
    let suggestions = AllocationTargets.suggestContribution(allocation.analysis, amount: 100)
    #expect(!suggestions.isEmpty && abs(suggestions.reduce(0) { $0 + $1.amount } - 100) < 0.01)
    #expect(AllocationTargets.suggestContribution(allocation.analysis, amount: 0).isEmpty)
}

@Test func INV055_suggestedQuantityFloorsToFourDecimals() {
    #expect(InvestmentsRules.suggestedQuantity(amount: 100, lastPrice: 112.804) == 0.8864)
    #expect(InvestmentsRules.suggestedQuantity(amount: 100, lastPrice: nil) == nil)
}

@Test func INV051_INV052_targetsEditor() {
    var rows = [TargetDraft(instrumentId: "a", name: "A", percent: "60"), TargetDraft(instrumentId: "b", name: "B", percent: "30")]
    #expect(!TargetsEditor.canSave(rows) && TargetsEditor.missing(rows) == 10)
    rows = TargetsEditor.fillLast(rows)
    #expect(rows[1].percent == "40" && TargetsEditor.canSave(rows))
    #expect(TargetsEditor.weights(rows).map(\.weight) == [0.6, 0.4])
    #expect(!TargetsEditor.canSave(rows + [TargetDraft(instrumentId: "a", name: "A", percent: "0")]))
    let initial = TargetsEditor.initial(saved: [], current: [InvestmentsView.Target(instrumentId: "a", weight: 0.27)]) { $0.uppercased() }
    #expect(initial == [TargetDraft(instrumentId: "a", name: "A", percent: "27")])
}

@Test func INV045_INV046_exposureLabels() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(v.analysis.sectors.slices.first?.key == "obbligazioni")
    #expect(ExposureKeys.share(0.0453, locale: .itIT) == "4,5%" && ExposureKeys.share(0.23, locale: .itIT) == "23%")
    #expect(ExposureKeys.sourceLabels["stima_indice"] == "Stima dall'indice")
    #expect(PlainLabels.overlap(0.85).severity == "alta" && PlainLabels.correlation(0.3).label == "Si muovono poco insieme")
    #expect(PlainLabels.decimal2(PlainLabels.averageCorrelation(v.analysis.correlationPairs) ?? 0, locale: .itIT).count == 4)
}

// MARK: - Operazioni (INV-056…061)

@Test func INV056_INV057_INV058_operationsFilterAndTotals() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    #expect(InvestmentsRules.yearOptions(v.operationYears) == [nil, 2026, 2025])
    #expect(InvestmentsRules.yearOptions([2026]).isEmpty)
    #expect(InvestmentsRules.visibleMonths(v.operationMonths, year: nil, showAll: false).count == 3)
    #expect(InvestmentsRules.visibleMonths(v.operationMonths, year: 2025, showAll: false).first?.key == "2025-12")
    let all = InvestmentsRules.totals(v.operationMonths, year: nil, all: v.operationTotals)
    #expect(all == v.operationTotals)
    let y2025 = InvestmentsRules.totals(v.operationMonths, year: 2025, all: v.operationTotals)
    let months = v.operationMonths.filter { $0.year == 2025 }
    #expect(y2025.count == months.reduce(0) { $0 + $1.totals.count })
    #expect(abs(y2025.bought - months.reduce(0) { $0 + $1.totals.bought }) < 0.01)
    #expect(abs(y2025.gain - months.reduce(0) { $0 + $1.totals.gain }) < 0.01)
}

@Test func INV059_operationDetails() throws {
    let v = try decode(InvestmentsView.self, "investments-view.json")
    let op = try #require(v.operationMonths.first?.operations.first)
    #expect(italian.operationDetails(op, instrument: v.instrument(op.transaction.instrumentId)) == "28 set 2026 · 6,00\(nbsp)USD lordi")
    #expect(operationTypeLabel("rettifica") == "Operazione sul capitale")
}

@Test func INV060_INV061_editableOperations() {
    #expect(InvestmentsRules.canEdit(InvestmentTransaction(id: "1", instrumentId: "i", type: "acquisto", date: "2026-01-01")))
    #expect(!InvestmentsRules.canEdit(InvestmentTransaction(id: "1", instrumentId: "i", statementAccountKey: "U1", type: "acquisto", date: "2026-01-01")))
    #expect(!InvestmentsRules.canEdit(InvestmentTransaction(id: "1", instrumentId: "i", type: "rettifica", date: "2026-01-01")))
}

// MARK: - Register / edit operation (INV-062…073)

private let etf = Instrument(id: "e", name: "ETF", type: "etf", currency: "USD")
private let btp = Instrument(id: "b", name: "BTP", type: "obbligazione", priceUnit: "percentuale_nominale")

@Test func INV062_INV063_INV064_formShape() {
    #expect(OperationType.allCases.map(\.rawValue) == ["acquisto", "vendita", "dividendo", "cedola", "rimborso", "split"])
    var form = OperationForm(date: "2026-10-18")
    #expect(form.type == .acquisto && form.stepCount == 3 && form.stepOneError == "Scegli uno strumento")
    form.type = .split
    #expect(form.stepCount == 2 && !form.showsPrice && form.quantityLabel == "Quote nuove per ogni quota")
    form.type = .dividendo
    #expect(form.showsGross && !form.showsQuantity)
}

@Test func INV065_bondCountervalue() {
    let form = OperationForm(instrument: btp, date: "2026-10-18", quantity: "10000", price: "99,8")
    #expect(form.quantityLabel == "Valore nominale" && form.priceLabel == "Prezzo (% del nominale)")
    #expect(form.countervalue == 9980)
}

@Test func INV066_INV069_validation() {
    let today = "2026-10-18"
    #expect(OperationForm(instrument: etf, date: "2026-10-19", quantity: "1", price: "1").validate(today: today) == "La data non può essere nel futuro")
    #expect(OperationForm(instrument: etf, date: today, quantity: "0", price: "1").validate(today: today) == "Quantità non valida")
    #expect(OperationForm(instrument: etf, date: today, quantity: "1", price: "").validate(today: today) == "Prezzo non valido")
    #expect(OperationForm(type: .split, instrument: etf, date: today).validate(today: today) == "Rapporto dello split non valido")
    #expect(OperationForm(type: .cedola, instrument: etf, date: today).validate(today: today) == "Importo non valido")
    #expect(OperationForm(instrument: etf, date: today, quantity: "1", price: "1", fxRate: "0").validate(today: today) == "Cambio non valido")
    #expect(OperationForm(instrument: etf, date: today, quantity: "2", price: "1", fees: "-1").validate(today: today) == "Importo non valido")
    // Not selling more than held.
    #expect(OperationForm(type: .vendita, instrument: etf, date: today, quantity: "5", price: "1", held: 4).validate(today: today)
        == "Non puoi vendere più quote di quelle che possiedi")
    #expect(OperationForm(type: .vendita, instrument: etf, date: today, quantity: "4", price: "1", held: 4).validate(today: today) == nil)
}

@Test func INV068_INV069_requestBody() {
    let form = OperationForm(instrument: etf, date: "2026-10-18", quantity: "1,5", price: "100", fees: "2,95", fxRate: "0,91")
    #expect(form.needsFx(userCurrency: "EUR") && !form.needsFx(userCurrency: "USD"))
    let input = form.input(today: "2026-10-18")
    #expect(input == OperationInput(instrumentId: "e", type: "acquisto", date: "2026-10-18", quantity: 1.5, price: 100, fxRate: 0.91, fees: 2.95))
    let json = input!.json(forUpdate: true)
    #expect(json["instrumentId"] == nil && json["type"] as? String == "acquisto")
    let split = OperationForm(type: .split, instrument: etf, date: "2026-10-18", quantity: "2", fees: "5").input(today: "2026-10-18")
    #expect(split?.fees == 0 && split?.price == nil && split?.quantity == 2)
}

@Test func INV067_priceSuggestionHint() {
    #expect(PriceSuggestionHint.of(nil, fetching: true, date: "2026-10-18") == .searching)
    #expect(PriceSuggestionHint.of(PriceOnDate(price: nil, loading: true), fetching: false, date: "2026-10-18") == .downloading)
    #expect(PriceSuggestionHint.of(PriceOnDate(price: nil, loading: false), fetching: false, date: "x")?.source == "Nessun prezzo per questa data: inseriscilo tu.")
    let close = PriceOnDate(price: .init(date: "2026-10-16", close: 112.8, origin: "yahoo"), loading: false)
    #expect(PriceSuggestionHint.of(close, fetching: false, date: "2026-10-18")?.source == "Ultima chiusura prima di questa data, del {0}")
    #expect(OperationForm.priceText(112.80412345) == "112,804123")
}

@Test func INV071_editStartsFromSavedValues() {
    let t = InvestmentTransaction(id: "t", instrumentId: "e", type: "vendita", date: "2026-09-18", quantity: "4.0833000000", price: "61.22400000",
                                  fxRate: "0.9", fees: "1.50", taxes: "0.00", note: "nota")
    let form = OperationForm.editing(t, instrument: etf, held: 10)
    #expect(form.type == .vendita && form.quantity == "4,0833" && form.price == "61,224" && form.fees == "1,5" && form.taxes == "" && form.fxRate == "")
    #expect(form.input(today: "2026-10-18")?.note == "nota")
}

// MARK: - Dividendi / Tasse (INV-074…091)

@Test func INV074_INV079_decodesIncome() throws {
    let i = try decode(InvestmentsIncome.self, "investments-income.json")
    #expect(i.byMonth.first?.year == 2026 && i.byMonth.first?.months.count == 12)
    #expect(i.forecast.events.first?.basis == "storico" && IncomeRules.basisLabel("storico") == "dai tuoi incassi")
    #expect(i.pendingDividendHistory == 0 && i.history.count == 11)
    #expect(IncomeRules.monthsAgo("2026-10-31", months: 12) == "2025-10-28")
}

@Test func INV083_INV087_decodesTaxes() throws {
    let t = try decode(InvestmentsTaxes.self, "investments-taxes.json")
    #expect(t.regime == "amministrato" && t.currentYear == 2026 && t.carryforwards.first?.amountValue == 640)
    #expect(TaxRules.recentYears(t.report.years).first?.year == 2026)
    #expect(t.sellable.count == 13 && t.setting("8d725ad2-a8fb-4261-bbde-a1030171bc4c")?.couponFrequency == 2)
    let losses = [InvestmentsTaxes.LossEntry(year: 2024, expiresYear: 2028, amount: 100, remaining: 80, origin: "manuale", crypto: false),
                  InvestmentsTaxes.LossEntry(year: 2023, expiresYear: 2027, amount: 50, remaining: 50, origin: "calcolata", crypto: false),
                  InvestmentsTaxes.LossEntry(year: 2025, expiresYear: 2029, amount: 30, remaining: 30, origin: "calcolata", crypto: true)]
    #expect(TaxRules.lossesByExpiry(losses).map(\.expiresYear) == [2027, 2028])
    #expect(TaxRules.lossesByExpiry(losses, crypto: true).first?.amount == 30)
}

@Test func INV086_decodesSaleSimulation() throws {
    let s = try decode(SaleSimulation.self, "investments-simulate-sale.json")
    #expect(s.category == "capitale" && s.taxLineLabel == "Imposte trattenute" && s.quantity == 5)
}

@Test func INV088_carryforwardValidation() {
    #expect(TaxRules.carryforwardError(year: 1999, amount: 1, currentYear: 2026) == "Anno non valido")
    #expect(TaxRules.carryforwardError(year: 2027, amount: 1, currentYear: 2026) == "L'anno non può essere futuro")
    #expect(TaxRules.carryforwardError(year: 2025, amount: 0, currentYear: 2026) == "Importo non valido")
    #expect(TaxRules.carryforwardError(year: 2025, amount: 640, currentYear: 2026) == nil)
}

@Test func INV082_SEC051_couponTermsAllOrNone() {
    #expect(TaxRules.couponsError(rate: nil, maturity: nil) == nil)
    #expect(TaxRules.couponsError(rate: 3.1, maturity: nil) == "Per le cedole servono tasso e scadenza")
    #expect(TaxRules.couponsError(rate: 31, maturity: "2030-01-01") == "Tasso non valido")
    let body = InstrumentSettingsInput(couponRate: 0.031, couponFrequency: 2, maturityDate: "2030-08-15").json
    #expect(body["taxRate"] is NSNull && body["couponFrequency"] as? Int == 2)
}

// MARK: - Titoli (SEC-*)

@Test func SEC002_SEC005_SEC006_searchGrouping() {
    let market: [InstrumentSearchResult.MarketHit] = [
        .init(symbol: "BTC-EUR", name: "Bitcoin EUR", exchange: "CCC", exchangeLabel: "CCC", type: "crypto"),
        .init(symbol: "VWCE.DE", name: "Vanguard FTSE All-World", exchange: "GER", exchangeLabel: "XETRA", type: "etf"),
        .init(symbol: "AAPL", name: "Apple", exchange: "NMS", exchangeLabel: "NASDAQ", type: "azione"),
    ]
    let coins: [InstrumentSearchResult.CryptoHit] = [.init(id: "bitcoin", name: "Bitcoin", symbol: "btc"), .init(id: "btc2", name: "Bitcoin 2", symbol: "btc2")]
    let groups = InstrumentSearch.group(InstrumentSearchResult(market: market, crypto: coins), query: "btc")
    #expect(groups.map(\.type) == [.etf, .azione, .crypto])
    #expect(groups.last?.items == [.coingecko(coins[0])])
    #expect(groups[0].items[0].detail(cryptoCurrency: "EUR") == "VWCE.DE · XETRA")
    #expect(MarketSearchItem.coingecko(coins[0]).detail(cryptoCurrency: "EUR") == "BTC · in EUR")
    // Only crypto results: prefix matches too, Yahoo crypto rows dropped.
    let onlyCrypto = InstrumentSearch.group(InstrumentSearchResult(market: [market[0]], crypto: coins), query: "btc")
    #expect(onlyCrypto.map(\.type) == [.crypto] && onlyCrypto[0].items.count == 2)
    #expect(!InstrumentSearch.isSearchable("a") && InstrumentSearch.isSearchable("ab"))
}

@Test func SEC003_SEC004_knownRanking() {
    let a = Instrument(id: "a", name: "A"), b = Instrument(id: "b", name: "B"), c = Instrument(id: "c", name: "C")
    #expect(InstrumentSearch.rankKnown([a, b, c], suggestions: [c, b]).map(\.id) == ["c", "b", "a"])
}

@Test func SEC008_SEC009_createInputs() {
    #expect(MarketSearchItem.yahoo(.init(symbol: "SWDA.MI", name: "W", exchange: nil, exchangeLabel: nil, type: "etf"))
        .createInput(currency: "EUR", isin: "IE00B4L5Y983") == .yahoo(symbol: "SWDA.MI", name: "W", type: "etf", isin: "IE00B4L5Y983"))
    #expect(InstrumentSearch.manualDefaultType(isin: "IT0005547408") == .obbligazione && InstrumentSearch.manualDefaultType(isin: nil) == .fondo)
    #expect(InstrumentSearch.manualInput(name: " BTP ", type: .obbligazione, currency: "EUR", isin: "IT0005547408")
        == .isin(isin: "IT0005547408", name: "BTP", type: "obbligazione", currency: "EUR"))
    #expect(InstrumentSearch.manualInput(name: "Fondo", type: .fondo, currency: "EUR", isin: nil) == .manual(name: "Fondo", type: "fondo", currency: "EUR", isin: nil))
    #expect(InstrumentSearch.manualInput(name: "", type: .fondo, currency: "EUR", isin: nil) == nil)
    #expect(InstrumentSearch.manualInput(name: "X", type: .fondo, currency: "eu", isin: nil) == nil)
    #expect(InstrumentCreateInput.coingecko(id: "bitcoin", name: "Bitcoin", currency: "EUR").json["source"] as? String == "coingecko")
}

@Test func SEC010_SEC011_watchlist() throws {
    let items = try local(TitlesResponse.self, "instruments-titles.json").items
    let watched = items.filter { $0.watching && !$0.held }
    #expect(items.count == 15 && watched.map(\.instrument.name) == ["ETF MSCI World Demo", "Vento Rinnovabili S.p.A."])
    #expect(watched[1].activeAlerts == 1 && watched[1].spark.count > 0)
    #expect(items.first { $0.instrument.name == "Fondo Bilanciato Demo" }?.lastClose == nil)
}

@Test func SEC015_SEC017_decodesAnalysis() throws {
    let etf = try local(TitleAnalysis.self, "instruments-analysis-etf.json")
    #expect(etf.instrument.kind == .etf && etf.series.count <= 240 && etf.position?.quantity == 191.16 && !etf.watching)
    #expect(etf.composition?.holdings.first?.symbol == "NMBS" && etf.fundamentalsStatus == "unavailable")
    let watched = try local(TitleAnalysis.self, "instruments-analysis-watched.json")
    #expect(watched.watching && watched.position == nil && watched.alerts.first?.isAbove == false && watched.alerts.first?.target == 9.2)
    let bond = try local(TitleAnalysis.self, "instruments-analysis-bond.json")
    #expect(bond.instrument.isPercentOfNominal && bond.fundamentalsStatus == "unsupported")
}

@Test func SEC019_keyFacts() throws {
    let etf = try local(TitleAnalysis.self, "instruments-analysis-etf.json")
    #expect(TitleFormat.keyFacts(etf, locale: .itIT).map(\.label) == ["Volatilità", "Dal massimo"])
    let bond = try local(TitleAnalysis.self, "instruments-analysis-bond.json")
    let facts = TitleFormat.keyFacts(bond, locale: .itIT)
    #expect(facts.map(\.label) == ["1 anno", "Da inizio anno", "Volatilità", "Dal massimo"])
    #expect(facts[0].value == "+1,5%")
}

@Test func SEC020_SEC021_chartMarkers() throws {
    let etf = try local(TitleAnalysis.self, "instruments-analysis-etf.json")
    let markers = TitleRules.purchaseMarkers(series: etf.series, purchases: try #require(etf.position?.purchases))
    #expect(!markers.isEmpty && markers.allSatisfy { etf.series.indices.contains($0) })
    #expect(TitleRules.isRising(etf.series))
    let series = [TitleAnalysis.Point(date: "2026-01-01", close: 2), TitleAnalysis.Point(date: "2026-01-05", close: 1)]
    #expect(TitleRules.purchaseMarkers(series: series, purchases: [.init(date: "2026-01-03", price: 1), .init(date: "2025-01-01", price: 1)]) == [1])
    #expect(!TitleRules.isRising(series))
}

@Test func SEC024_rangePosition() {
    #expect(TitleFormat.rangePosition(last: 15, low: 10, high: 20) == 0.5)
    #expect(TitleRules.isAtHigh(-0.004) && !TitleRules.isAtHigh(-0.01))
}

@Test func SEC030_alertLevelParsing() {
    #expect(TitleRules.parseAlertLevel("12,5") == 12.5)
    #expect(TitleRules.parseAlertLevel("12.5") == 12.5)
    #expect(TitleRules.parseAlertLevel("1.250,5") == 1250.5)
    #expect(TitleRules.parseAlertLevel("1,250.5") == 1250.5)
    #expect(TitleRules.parseAlertLevel("0") == nil && TitleRules.parseAlertLevel("abc") == nil && TitleRules.parseAlertLevel("") == nil)
}

@Test func SEC037_indicatorFormatting() {
    #expect(TitleFormat.indicator(14.23, format: "multiple", locale: .itIT) == "14,2")
    #expect(TitleFormat.indicator(5.678, format: "multiple", locale: .itIT) == "5,68")
    #expect(TitleFormat.indicator(0.162, format: "pct", locale: .itIT) == "16,2%")
    #expect(TitleFormat.indicator(5.8, format: "times", locale: .itIT) == "5,8×")
    #expect(TitleFormat.perShare(0.05, currency: "USD", locale: .itIT) == "0,0500 USD")
    #expect(TitleFormat.indicatorMeta.count == 17)
}

@Test func SEC045_terCost() {
    #expect(abs(TitleRules.terCost(ter: 0.002, years: 10) - 10_000 * (pow(1.05, 10) - pow(1.05 * 0.998, 10))) < 0.0001)
    #expect(TitleRules.terCost(ter: 0, years: 20) == 0)
}
