import Foundation
import Testing
@testable import BuddyBudgetKit

// Debiti and Pensione (spec: features/10-debts.md, 09-pension.md). View fixtures come from spec/api/fixtures
// (debts-insights.json, pension-view.json, both captured on 2026-10-18 for the demo user).

private let fixtureToday = "2026-10-18"
private var it: DebtsText { DebtsText(locale: .itIT, translate: { $0 }) }
private var pit: PensionText { PensionText(locale: .itIT, translate: { $0 }) }

private func debtsView() throws -> DebtsViewData {
    try JSONDecoder().decode(DebtsViewData.self, from: try fixture("debts-insights.json"))
}

private func pensionView() throws -> PensionView {
    try JSONDecoder().decode(PensionView.self, from: try fixture("pension-view.json"))
}

private func mortgage() throws -> DebtView { try #require(try debtsView().debts.first { $0.name == "Mutuo casa" }) }

// MARK: - Debiti

@Test func DEBT001_decodesTheDebtsViewWithInsights() throws {
    let view = try debtsView()
    #expect(view.debts.count == 3)
    #expect(view.overview.totalDebt == 39937.23)
    #expect(view.overview.nextDue.count == 3)
    let insights = try #require(view.insights)
    #expect(insights.exit.extras.count == 21)
    #expect(insights.exit.plans.count == 21)
    #expect(insights.interestShares.items.count == 3)
    let debt = try mortgage()
    #expect(debt.startMode == .origine)
    #expect(debt.plan.rows.count == 120)
    #expect(debt.plan.rows[0].status == .daConfermare)
}

@Test func DEBT002_heroSaysOpenLoansAndTheDebtFreeMonth() throws {
    let view = try debtsView()
    let free = DebtsRules.freeDate(view.debts)
    #expect(free == "2033-09-05")
    #expect(it.heroSubtitle(openCount: DebtsRules.openCount(view.debts), freeDate: free) == "3 finanziamenti · liberi da debiti a settembre 2033")
    #expect(it.heroSubtitle(openCount: 1, freeDate: free) == "un finanziamento · liberi da debiti a settembre 2033")
    #expect(it.heroSubtitle(openCount: 0, freeDate: nil) == "Nessun finanziamento aperto")
}

@Test func DEBT003_relativeDueTexts() {
    #expect(it.dueText(0) == "oggi")
    #expect(it.dueText(1) == "domani")
    #expect(it.dueText(12) == "tra 12 giorni")
    #expect(it.dueText(-1) == "scaduta ieri")
    #expect(it.dueText(-3) == "scaduta da 3 giorni")
    #expect(DebtsRules.daysBetween("2026-10-18", "2026-10-20") == 2)
}

@Test func DEBT004_overviewDueFindsItsUnsettledPlanRow() throws {
    let view = try debtsView()
    let due = try #require(view.overview.nextDue.first)
    let row = try #require(DebtsRules.dueRow(view.debt(due.debtId), date: due.date))
    #expect(row.dueDate == due.date)
    #expect(row.status != .pagata)
}

@Test func DEBT005_listRowDetailAndRepaidShare() throws {
    let view = try debtsView()
    let debt = try mortgage()
    #expect(it.listDetail(debt) == "finisce a settembre 2033 · 2,94% TAEG")
    #expect(abs(DebtsRules.repaidShare(debt, insights: view.insights) - 0.2780636842105263) < 1e-9)
    // Without insights the share comes from the plan (first row residual + capital = principal).
    #expect(abs(DebtsRules.repaidShare(debt, insights: nil) - (1 - 27433.58 / 38000)) < 1e-9)
}

@Test func DEBT006_exitSliderIndexesTheServerPlans() throws {
    var state = DebtsUiState(today: fixtureToday)
    state.data = try debtsView()
    #expect(state.exitExtra == 200)
    let plan = try #require(state.exitPlan)
    #expect(plan.interestSaved == 1708.25)
    #expect(plan.steps.map(\.name) == ["Cucina e lavatrice", "Prestito auto", "Mutuo casa"])
    #expect(it.exitStep(plan.steps[0]) == "Chiuso a aprile 2027 invece di febbraio 2028")
    state.exitExtra = 0
    #expect((state.exitPlan?.interestSaved ?? 0) < plan.interestSaved)
}

@Test func DEBT007_interestSharesHiddenWithoutInterest() throws {
    var state = DebtsUiState(today: fixtureToday)
    state.data = try debtsView()
    #expect(state.interest?.items.first?.name == "Mutuo casa")
    #expect(abs((state.interest?.total ?? 0) - 1736.62117) < 1e-6)
}

@Test func DEBT008_gateStates() {
    #expect(DebtsGate.of(loaded: false, failed: false, count: 0) == .loading)
    #expect(DebtsGate.of(loaded: false, failed: true, count: 0) == .failed)
    #expect(DebtsGate.of(loaded: true, failed: false, count: 0) == .empty)
    #expect(DebtsGate.of(loaded: true, failed: false, count: 2) == .content)
}

@Test func DEBT011_DEBT015_addFormComputesTheMissingFigure() throws {
    var form = DebtCalc.emptyAddDebtForm(.nuovo)
    form.name = "Prestito auto"
    form.firstInstallmentDate = "2026-11-15"
    form.principal = "15000"
    form.installments = "60"
    form.annualRate = "6,9"
    guard case .ok(let resolved) = DebtCalc.resolveAddForm(form) else { Issue.record("not resolved"); return }
    #expect(resolved.calculated == .installment)
    let runs = it.calculated(.installment, value: resolved.inputs.installment, currency: "EUR")
    #expect(runs.map(\.text).joined() == "Abbiamo calcolato la rata: 296,31\u{a0}€. Può differire di poco da quello della banca, per gli arrotondamenti.")
    #expect(it.calculatedPlaceholder(.installment, resolved: resolved) == "296,31")
    #expect(it.calculatedPlaceholder(.principal, resolved: resolved) == "")
    let preview = try #require(try DebtCalc.previewAddForm(form, resolved))
    #expect(preview.endDate.iso == "2031-10-15")
}

@Test func DEBT017_createBodySendsInstallmentOnlyWhenTypedAndAnchorForSnapshots() throws {
    var form = DebtCalc.emptyAddDebtForm(.fotografia)
    form.name = "Mutuo"
    form.firstInstallmentDate = "2026-11-01"
    form.principal = "100000"
    form.installments = "240"
    form.annualRate = "3"
    guard case .ok(let resolved) = DebtCalc.resolveAddForm(form) else { Issue.record("not resolved"); return }
    let json = DebtCalc.buildCreateDebtInput(form, resolved, today: fixtureToday).json
    #expect(json["anchorDate"] as? String == fixtureToday)
    #expect(json["installment"] == nil)
    #expect(json["startMode"] as? String == "fotografia")
}

@Test func DEBT016_createPostsAndReturnsTheId() async throws {
    let transport = StubTransport(status: 201, body: #"{"id":"d-1"}"#)
    var form = DebtCalc.emptyAddDebtForm(.nuovo)
    form.name = "Auto"
    form.firstInstallmentDate = "2026-11-15"
    form.principal = "1000"
    form.installments = "10"
    form.annualRate = "0"
    guard case .ok(let resolved) = DebtCalc.resolveAddForm(form) else { Issue.record("not resolved"); return }
    let id = try await DebtsAPI(client: makeClient(transport)).create(DebtCalc.buildCreateDebtInput(form, resolved, today: fixtureToday))
    #expect(id == "d-1")
    #expect(transport.last?.url?.path == "/api/debts")
    #expect(transport.last?.httpMethod == "POST")
}

@Test func DEBT018_factsTexts() throws {
    let debt = try mortgage()
    #expect(it.rates(debt) == "2,90% · 2,94%")
    #expect(it.residualCaption(debt) == "ancora da restituire · finisce a settembre 2033")
    #expect(it.startMode(debt.startMode) == "In corso · dall'origine")
}

@Test func DEBT020_pendingBannerAndBulkPay() async throws {
    let debt = try mortgage()
    #expect(it.pending(debt) == "Il piano conta 37 rate già passate: se le hai pagate, confermale.")
    #expect(DebtsRules.unsettled(debt).last?.number == 37)
    #expect(it.bulkDone(1) == "Una rata segnata come pagata")
    #expect(it.bulkDone(4) == "4 rate segnate come pagate")
    let transport = StubTransport(status: 201, body: #"{"count":37}"#)
    let count = try await DebtsAPI(client: makeClient(transport)).bulkPay(debtId: debt.id, upTo: 37)
    #expect(count == 37)
    #expect(transport.last?.url?.path == "/api/debts/\(debt.id)/payments/bulk")
    #expect(String(decoding: try #require(transport.last?.httpBody), as: UTF8.self) == #"{"upToInstallment":37}"#)
}

@Test func DEBT021_planShowsTwoPastAndEightNextRows() throws {
    let debt = try mortgage()
    let range = DebtsRules.visibleRange(debt.plan.rows, today: fixtureToday)
    #expect(range.count == 10)
    #expect(debt.plan.rows[range.lowerBound].dueDate < fixtureToday)
    #expect(debt.plan.rows[range.lowerBound + 2].dueDate >= fixtureToday)
    #expect(it.planToggle(showAll: false, total: 120, hidden: 110) == "Mostra tutte le 120 rate (altre 110)")
}

@Test func DEBT022_rowBreakdownAndStatusLabels() throws {
    let row = try mortgage().plan.rows[0]
    #expect(it.rowBreakdown(row, currency: "EUR") == "Capitale 273,35\u{a0}€ · interessi 91,83\u{a0}€ · residuo 37.726,65\u{a0}€")
    #expect(it.status(.daConfermare) == "Da confermare")
}

@Test func DEBT023_paymentDefaultsAndValidation() async throws {
    let past = DebtPlanRow(number: 3, dueDate: "2026-09-05", installment: 365.18, interest: 1, capital: 1, residual: 1, status: .scaduta)
    let future = DebtPlanRow(number: 4, dueDate: "2026-11-05", installment: 365.18, interest: 1, capital: 1, residual: 1, status: .daPagare)
    #expect(DebtsRules.defaultPaymentDate(past, today: fixtureToday) == "2026-09-05")
    #expect(DebtsRules.defaultPaymentDate(future, today: fixtureToday) == fixtureToday)
    #expect(DebtsRules.paymentInput(past, date: fixtureToday, amount: "0", transactionId: nil) == .failure(DebtsMessage("Inserisci l'importo pagato")))
    let input = try DebtsRules.paymentInput(past, date: "2026-09-05", amount: "365,18", transactionId: "t-1").get()
    let transport = StubTransport(status: 201, body: #"{"id":"e-1"}"#)
    try await DebtsAPI(client: makeClient(transport)).addEvent(debtId: "d-1", input)
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? NSDictionary
    #expect(sent == ["type": "payment", "installmentNumber": 3, "date": "2026-09-05", "amount": 365.18, "transactionId": "t-1"])
}

@Test func DEBT024_candidatesQueryTheWindowAroundTheDueDate() async throws {
    let transport = StubTransport(status: 200, body: #"{"items":[],"nextCursor":null}"#)
    _ = try await DebtsAPI(client: makeClient(transport)).candidates(dueDate: "2026-11-05")
    let query = URLComponents(url: try #require(transport.last?.url), resolvingAgainstBaseURL: false)?.queryItems ?? []
    let items = Dictionary(uniqueKeysWithValues: query.map { ($0.name, $0.value ?? "") })
    #expect(items["from"] == "2026-10-16")
    #expect(items["to"] == "2026-11-25")
    #expect(items["type"] == "uscita")
}

@Test func DEBT025_DEBT026_simpleEventsValidation() {
    #expect(DebtEventDialogKind.rateChange.input(date: "2026-10-18", value: "0") == .success(.rateChange(date: "2026-10-18", rate: 0)))
    #expect(DebtEventDialogKind.balanceCorrection.input(date: "2026-10-18", value: "0") == .failure(DebtsMessage("Inserisci un valore valido")))
    #expect(DebtEventDialogKind.balanceCorrection.input(date: "2026-10-18", value: "12.000,5")
        == .success(.balanceCorrection(date: "2026-10-18", amount: 12000.5)))
    #expect(DebtEventDialogKind.rateChange.input(date: "2026-10-18", value: "abc") == .failure(DebtsMessage("Inserisci un valore valido")))
}

@Test func DEBT027_eventsNewestFirstWithDescriptions() throws {
    let debt = try mortgage()
    let ordered = DebtsRules.orderedEvents(debt)
    #expect(ordered.first!.date >= ordered.last!.date)
    #expect(it.event(DebtEventView(id: "1", type: "payment", date: "2026-01-05", amount: nil, installmentNumber: 4), currency: "EUR") == "Rata 4 pagata")
    #expect(it.event(DebtEventView(id: "1", type: "payment", date: "2026-01-05", amount: 365.18, installmentNumber: 4), currency: "EUR")
        == "Rata 4 pagata · 365,18\u{a0}€")
    #expect(it.event(DebtEventView(id: "2", type: "rate_change", date: "2026-01-05", rate: 3.25), currency: "EUR") == "Tasso portato al 3,25%")
    #expect(it.event(DebtEventView(id: "3", type: "early_repayment", date: "2026-01-05", amount: 5000, penalty: 50, effect: "reduce_duration"),
                     currency: "EUR") == "Estinzione anticipata di 5000,00\u{a0}€ · durata ridotta · penale 50,00\u{a0}€")
    #expect(it.event(DebtEventView(id: "4", type: "balance_correction", date: "2026-01-05", amount: 20000), currency: "EUR")
        == "Residuo corretto a 20.000,00\u{a0}€")
}

@Test func DEBT030_extraPerMonthSimulation() throws {
    let debt = try mortgage()
    let sim = try #require(DebtsRules.extraSimulation(debt, extra: 200, today: fixtureToday))
    #expect(sim.monthsSaved > 0)
    #expect(sim.interestSaved > 0)
    #expect(sim.showsGain(extra: 200))
    #expect(!sim.showsGain(extra: 0))
    let none = try #require(DebtsRules.extraSimulation(debt, extra: 0, today: fixtureToday))
    #expect(none.monthsSaved == 0)
    #expect(it.extraSentence(none, extra: 0, currency: "EUR").map(\.text).joined() == "Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi.")
    #expect(it.extraSentence(sim, extra: 200, currency: "EUR").first?.text == "Finisci ")
}

@Test func DEBT031_refinanceNeedsRateAndWholeInstallments() throws {
    let debt = try mortgage()
    #expect(DebtsRules.refinance(debt, rate: "", installments: "83", costs: "", penalty: "", today: fixtureToday) == nil)
    #expect(DebtsRules.refinance(debt, rate: "2", installments: "8,5", costs: "", penalty: "", today: fixtureToday) == nil)
    let good = try #require(DebtsRules.refinance(debt, rate: "1", installments: "83", costs: "100", penalty: "", today: fixtureToday))
    #expect(good.switchCosts == 100)
    let verdict = it.refinanceVerdict(good, currency: "EUR")
    #expect(verdict.positive)
    #expect(verdict.text.hasPrefix("Conviene: risparmi "))
    let bad = try #require(DebtsRules.refinance(debt, rate: "9", installments: "83", costs: "0", penalty: "0", today: fixtureToday))
    #expect(!it.refinanceVerdict(bad, currency: "EUR").positive)
}

@Test func DEBT030_DEBT031_simulationResultTexts() throws {
    let debt = try mortgage()
    let sim = try #require(DebtsRules.extraSimulation(debt, extra: 200, today: fixtureToday))
    let extra = try #require(it.extraResult(sim, extra: 200, currency: "EUR"))
    #expect(extra.label == "Finisci prima di")
    #expect(extra.value == it.duration(sim.monthsSaved))
    #expect(extra.caption.hasSuffix(" di interessi."))
    let none = try #require(DebtsRules.extraSimulation(debt, extra: 0, today: fixtureToday))
    #expect(it.extraResult(none, extra: 0, currency: "EUR") == nil)
    let good = try #require(DebtsRules.refinance(debt, rate: "1", installments: "83", costs: "100", penalty: "", today: fixtureToday))
    let pos = it.refinanceResult(good, currency: "EUR")
    #expect(pos.positive && pos.label == "Conviene: risparmi")
    #expect(pos.caption.hasPrefix("Al netto delle spese"))
    let bad = try #require(DebtsRules.refinance(debt, rate: "9", installments: "83", costs: "0", penalty: "0", today: fixtureToday))
    let neg = it.refinanceResult(bad, currency: "EUR")
    #expect(!neg.positive && neg.caption == "Tra interessi e spese.")
}

@Test func DEBT032_DEBT033_earlyRepaymentPreview() throws {
    let debt = try mortgage()
    var values = DebtEarlyRepaymentFormValues(mode: .once, date: fixtureToday, amount: "", penalty: "", penaltyUnit: .eur)
    #expect(DebtsRules.earlyRepayment(debt, today: fixtureToday, values: values) == .empty)
    values.amount = "5000"
    guard case .once(_, let penalty, _, let comparison) = DebtsRules.earlyRepayment(debt, today: fixtureToday, values: values) else {
        Issue.record("expected once"); return
    }
    #expect(penalty == 0)
    #expect(comparison.reduceDuration.monthsSaved > 0)
    #expect(comparison.reduceInstallment.nextInstallment < comparison.baselineInstallment)
    values.date = "2040-01-01"
    #expect(DebtsRules.earlyRepayment(debt, today: fixtureToday, values: values) == .error(message: "La data è dopo l'ultima rata del piano"))
    values.date = fixtureToday
    values.penalty = "-1"
    #expect(DebtsRules.earlyRepayment(debt, today: fixtureToday, values: values) == .error(message: "La penale non è valida"))
    #expect(it.monthsEarlier(0) == "stessa scadenza")
    #expect(it.monthsEarlier(1) == "1 mese prima")
    #expect(it.monthsEarlier(5) == "5 mesi prima")
}

@Test func DEBT035_monthlyModeIsSimulationOnly() throws {
    let debt = try mortgage()
    let values = DebtEarlyRepaymentFormValues(mode: .monthly, date: "", amount: "100", penalty: "", penaltyUnit: .eur)
    guard case .monthly(let amount, let result) = DebtsRules.earlyRepayment(debt, today: fixtureToday, values: values) else {
        Issue.record("expected monthly"); return
    }
    #expect(amount == 100)
    #expect(result.monthsSaved > 0)
}

// MARK: - Pensione

@Test func PEN001_DE_isUnavailable() {
    var state = PensionUiState()
    state.unavailable = true
    #expect(state.gate == .unavailable)
}

@Test func PEN002_decodesTheView() throws {
    let view = try pensionView()
    #expect(view.funds.count == 1)
    #expect(view.fund?.snapshots.count == 16)
    #expect(view.exitTax.timeline.count == 36)
    #expect(view.projection.sliders.quarterlyContribution.default == 620)
    var state = PensionUiState()
    state.view = view
    #expect(state.gate == .content)
    #expect(state.hasSnapshots)
}

@Test func PEN011_snapshotsNewestFirstWithContributionDelta() throws {
    let view = try pensionView()
    let rows = PensionRules.snapshotRows(view.fund!.snapshots)
    #expect(rows.first?.snapshot.date == "2026-10-01")
    #expect(rows.last?.delta == nil)
    #expect(rows.first?.delta == 620)
    let flat = PensionRules.snapshotRows([
        PensionSnapshot(id: "a", date: "2026-01-01", netContributions: 100, value: 100),
        PensionSnapshot(id: "b", date: "2026-04-01", netContributions: 100, value: 110),
    ])
    #expect(flat.first?.delta == nil)
}

@Test func PEN010_snapshotAmountsAndDates() {
    #expect(PensionRules.parseAmount("10880,5") == 10880.5)
    #expect(PensionRules.parseAmount("-1") == nil)
    #expect(PensionRules.parseAmount("") == nil)
    #expect(PensionRules.isPlausibleDate("2026-10-19", today: fixtureToday))
    #expect(!PensionRules.isPlausibleDate("2026-10-20", today: fixtureToday))
    #expect(!PensionRules.isPlausibleDate("1949-12-31", today: fixtureToday))
    #expect(!PensionRules.isPlausibleDate("2026-02-30", today: fixtureToday))
}

@Test func PEN008_profileSaveOnlyWhenChangedAndValid() {
    #expect(!PensionRules.canSaveProfile(name: "Fondo", date: "2020-01-01", originalName: "Fondo", originalDate: "2020-01-01"))
    #expect(PensionRules.canSaveProfile(name: "Fondo 2", date: "2020-01-01", originalName: "Fondo", originalDate: "2020-01-01"))
    #expect(!PensionRules.canSaveProfile(name: "  ", date: "2020-01-01", originalName: "Fondo", originalDate: "2020-01-01"))
}

@Test func PEN019_heroTexts() throws {
    let view = try pensionView()
    let perf = try #require(view.performance)
    #expect(pit.heroEyebrow(name: "Piano pensione", lastDate: perf.lastDate) == "Piano pensione · aggiornato al 1 ottobre 2026")
    #expect(pit.signedMoney(perf.gain, "EUR") == "+1162\u{a0}€")
    #expect(pit.gainCaption(perf.gain) == "di guadagno sui contributi versati")
    #expect(pit.annualReturnLabel(approximate: perf.approximate) == "Rendimento annuo (stima)")
    #expect(pit.signedPercent(perf.annualReturn!) == "+6,0%")
}

@Test func PEN021_insights() throws {
    let view = try pensionView()
    #expect(PensionRules.beatsTfr(view))
    #expect(Int(view.projection.preview!.base) == 98209)
}

@Test func PEN022_bestAndWorstYear() throws {
    let view = try pensionView()
    let pair = try #require(PensionRules.bestAndWorst(view.yearly))
    #expect(pair.best.gain >= pair.worst.gain)
    #expect(PensionRules.bestAndWorst(Array(view.yearly.prefix(1))) == nil)
}

@Test func PEN023_PEN025_PEN026_rateSimulationIndexesTheTimeline() throws {
    var state = PensionUiState()
    state.view = try pensionView()
    #expect(state.shownYears == 4)
    #expect(!state.isSimulating)
    #expect(state.scenarios.first?.rate == 0.15)
    state.simulatedYears = 20
    #expect(state.isSimulating)
    #expect(state.scenarios.first?.rate == 0.135)
    #expect(state.scenarios.first?.netLow == 9585.99055)
    let text = pit.taxSimulation(state: state, adhesionDate: "2022-10-15", currency: "EUR").map(\.text).joined()
    #expect(text == "Simulazione: dopo 20 anni di adesione (nel 2042) l'aliquota sarebbe 13,5%, e alla pensione ti resterebbero almeno 9586\u{a0}€ (+166\u{a0}€ rispetto a oggi).")
    state.simulatedYears = 4
    #expect(!state.isSimulating)
    state.simulatedYears = 99
    #expect(state.shownYears == 35)
}

@Test func PEN024_tfrConclusion() throws {
    let view = try pensionView()
    let runs = pit.tfrConclusion(fundValue: view.last!.value, tfr: view.tfr!, inflation: view.assumedInflation, currency: "EUR")
    #expect(runs[0].text == "Finora il fondo ha reso ")
    #expect(runs[1].text == "687\u{a0}€")
}

@Test func PEN027_PEN028_projectionMatchesTheServerPreview() throws {
    let view = try pensionView()
    var state = PensionUiState()
    state.view = view
    #expect(state.years == 25)
    #expect(state.quarterly == 620)
    let points = PensionRules.projection(startValue: view.last!.value, quarterly: state.quarterly, years: state.years, rates: view.projection.rates)
    #expect(abs(points.last!.base - view.projection.preview!.base) < 0.01)
    #expect(pit.projectionCaption(years: 25, gain: 1234.4, currency: "EUR") == "tra 25 anni, di cui 1234\u{a0}€ di rendimento")
}

@Test func PEN014_PEN015_pasteIsReadWithDetectedMapping() {
    var wizard = PensionImportState(today: fixtureToday, existing: [])
    wizard.text = "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11.420,00;11.890,15\n31/13/2026;1;1"
    wizard.read()
    #expect(wizard.step == .columns)
    #expect(wizard.mapping?.columns == [.date: 0, .netContributions: 1, .value: 2])
    #expect(wizard.mapping?.decimal == .comma)
    #expect(wizard.mapping?.dateOrder == .dmy)
    #expect(wizard.snapshots.map(\.date) == ["2026-03-31", "2026-06-30"])
    #expect(wizard.snapshots[1].value == 11890.15)
    #expect(wizard.problems == [.error(line: 4, message: "Data non valida")])
    #expect(wizard.canContinue)
    wizard.mapping?.columns[.value] = nil
    #expect(wizard.missing == ["Controvalore"])
    #expect(!wizard.canContinue)
}

@Test func PEN016_planAgainstSavedSnapshots() {
    let existing = [PensionSnapshot(id: "s", date: "2026-03-31", netContributions: 10880, value: 11000)]
    let incoming = [
        PensionImportedSnapshot(line: 2, date: "2026-03-31", netContributions: 10880, value: 11250.4),
        PensionImportedSnapshot(line: 3, date: "2026-06-30", netContributions: 11420, value: 11890.15),
        PensionImportedSnapshot(line: 4, date: "2026-06-30", netContributions: 11420, value: 11890.15),
        PensionImportedSnapshot(line: 5, date: "2026-06-30", netContributions: 1, value: 1),
    ]
    let plan = PensionImport.plan(incoming, existing: existing, today: fixtureToday)
    #expect(plan.rows.map(\.status) == [.update, .new, .unchanged, .error])
    #expect(plan.rows[2].message == "Uguale alla riga {0}")
    #expect(plan.rows[3].messageValues == ["0": "3"])
    #expect(plan.counts == PensionImportCounts(new: 1, update: 1, unchanged: 1, error: 1))
    #expect(plan.blocked)
    #expect(PensionImport.plan(incoming, existing: existing, today: fixtureToday, maxSnapshots: 1).error == "Il fondo avrebbe più di {0} fotografie")
}

@Test func PEN017_importSendsRowsAndReadsCounts() async throws {
    let transport = StubTransport(status: 201, body: #"{"counts":{"new":2,"update":0,"unchanged":1,"error":0}}"#)
    let counts = try await PensionAPI(client: makeClient(transport)).importSnapshots(
        fundId: "f-1", rows: [PensionImportRowInput(line: 2, date: "2026-03-31", netContributions: 10880, value: 11250.4)])
    #expect(counts.new == 2)
    #expect(transport.last?.url?.path == "/api/pension/funds/f-1/snapshots/import")
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? NSDictionary
    #expect(sent?["format"] as? String == "incollato")
}

@Test func IMPORT_valueParsers() {
    #expect(ImportValues.parseNumber("1.234,56\u{a0}€", decimal: .comma) == 1234.56)
    #expect(ImportValues.parseNumber("EUR 1,234.56", decimal: .dot) == 1234.56)
    #expect(ImportValues.parseNumber("(12,5)", decimal: .comma) == -12.5)
    #expect(ImportValues.parseNumber("3.0E-4", decimal: .dot) == 0.0003)
    #expect(ImportValues.parseNumber("abc", decimal: .dot) == nil)
    #expect(ImportValues.detectDecimalSeparator(["1.000"], fallback: .comma) == .comma)
    #expect(ImportValues.detectDecimalSeparator(["12,5", "1.234,56"]) == .comma)
    #expect(ImportValues.parseDate("20260105", order: .ymd) == "2026-01-05")
    #expect(ImportValues.parseDate("05/01/26 10:00", order: .dmy) == "2026-01-05")
    #expect(ImportValues.detectDateOrder(["12/31/2026"]) == .mdy)
    #expect(ImportValues.normalizeHeader("Quantità (n.)") == "quantitan")
    #expect(ImportCsv.parse("a,b\r\n\"x, y\",2\r\n").rows == [["x, y", "2"]])
}

@Test func DEBT038_deepLinksOpenTheDetail() {
    #expect(DebtsRoutes.detailId(path: "/debiti") == nil)
    #expect(DebtsRoutes.detailId(path: "/debiti/finanziamenti?id=abc") == "abc")
    #expect(DebtsRoutes.detailId(path: "/debiti/finanziamenti") == "")
    #expect(DebtsRoutes.detailId(path: "/debiti/simulatore") == "")
    #expect(PensionTab(path: "/pensione/scenari") == .scenarios)
    #expect(PensionTab(path: "/pensione") == .overview)
}
