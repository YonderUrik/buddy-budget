import Foundation
import Testing
@testable import BuddyBudgetKit

private func overview(_ name: String = "overview.json") throws -> OverviewView {
    try JSONDecoder().decode(OverviewView.self, from: try fixture(name))
}

private func point(_ date: String, _ byClass: [String: Double], estimated: Bool = false) -> OverviewView.SeriesPoint {
    OverviewView.SeriesPoint(date: date, value: byClass.values.reduce(0, +), byClass: byClass, isEstimated: estimated)
}

private let steps0 = StartStatus.Steps(conto: false, import: false, investimento: false, obiettivo: false)

// MARK: Decoding and request

@Test func OV008_decodesOverviewFixtures() throws {
    let v = try overview()
    #expect(v.currency == "EUR" && v.period == "3mesi" && v.includePension && !v.isEmpty)
    #expect(v.series.count == 93)
    #expect(v.series.last?.byClass["debiti"] == -39937.23)
    #expect(v.composition.map(\.key) == ["liquidita", "investimenti", "previdenza", "debiti"])
    #expect(v.composition[1].highlight?.label == "dal mercato")
    #expect(v.voice.first?.segments.filter(\.strong).count == 2)
    #expect(v.debts?.nextDue.count == 3)
    #expect(v.renewalAlerts.first?.message == "Il collegamento con Banca Demo scade tra 6 giorni.")
    let noPension = try overview("overview-1anno-no-pension.json")
    #expect(noPension.period == "1anno" && !noPension.includePension)
    #expect(noPension.pension?.included == false)
    #expect(noPension.composition.first { $0.key == "previdenza" }?.share == 0)
}

@Test func OV009_periodsAndQuery() {
    #expect(OverviewPeriod.default == .threeMonths)
    #expect(OverviewPeriod.allCases.map(\.label) == ["1M", "3M", "1A", "Max"])
    #expect(OverviewPeriod.allCases.map(\.rawValue) == ["1mese", "3mesi", "1anno", "max"])
    #expect(OverviewAPI.query(period: .oneYear, includePension: false, today: "2026-10-18")
        == ["period": "1anno", "includePension": "0", "today": "2026-10-18"])
}

@Test func flexibleNumbersAcceptStrings() throws {
    let json = #"{"value":"12.5","positions":2,"paid":"10","marketGain":2.5}"#
    let inv = try JSONDecoder().decode(OverviewView.Investments.self, from: Data(json.utf8))
    #expect(inv.value == 12.5 && inv.paid == 10)
    let fire = try JSONDecoder().decode(SidebarFire.self, from: Data(#"{"currency":"EUR","wealth":"5","target":null}"#.utf8))
    #expect(fire.wealth == 5 && fire.target == nil && fire.progress == nil)
}

// MARK: Greeting

@Test func OV001_greetingByHourAndFirstName() {
    #expect(Greeting.source(hour: 0) == "Buongiorno")
    #expect(Greeting.source(hour: 11) == "Buongiorno")
    #expect(Greeting.source(hour: 12) == "Buon pomeriggio")
    #expect(Greeting.source(hour: 17) == "Buon pomeriggio")
    #expect(Greeting.source(hour: 18) == "Buonasera")
    #expect(Greeting.title(greeting: "Buonasera", name: "Giulia Rossi") == "Buonasera, Giulia")
    #expect(Greeting.title(greeting: "Buonasera", name: "") == "Buonasera")
    #expect(Greeting.firstName(nil) == nil)
}

@Test func OV002_capitalizedLongDate() {
    #expect(Greeting.dateLabel(CalendarDate(year: 2026, month: 10, day: 6), locale: .itIT) == "Martedì 6 ottobre 2026")
    #expect(Greeting.dateLabel(CalendarDate(year: 2026, month: 10, day: 6), locale: .enGB).hasPrefix("Tuesday"))
}

// MARK: Layout

@Test func OV005_OV006_OV007_contentStates() throws {
    #expect(OverviewContent.resolve(view: nil, failed: false) == .loading)
    #expect(OverviewContent.resolve(view: nil, failed: true) == .failed)
    let v = try overview()
    #expect(OverviewContent.resolve(view: v, failed: true) == .loaded(v))
    var json = try JSONSerialization.jsonObject(with: try fixture("overview.json")) as! [String: Any]
    json["isEmpty"] = true
    let empty = try JSONDecoder().decode(OverviewView.self, from: JSONSerialization.data(withJSONObject: json))
    #expect(OverviewContent.resolve(view: empty, failed: false) == .empty(empty))
}

@Test func OV021_voiceStrongSegmentsAreMasked() throws {
    let v = try overview()
    let shown = OverviewVoice.segments(v.voice, hideAmounts: false)
    #expect(shown.map(\.text).joined().contains("2164\u{00A0}€"))
    let masked = OverviewVoice.segments(v.voice, hideAmounts: true)
    #expect(masked.filter(\.strong).allSatisfy { $0.text == "••••" })
    #expect(!masked.map(\.text).joined().contains("€"))
}

// MARK: Net worth chart

@Test func OV013_OV014_historyAndViewToggle() throws {
    let v = try overview()
    let state = NetWorthChartState(series: v.series, change: v.change, view: .total, hidden: [], pensionIncluded: true)
    #expect(state.hasHistory && state.showsViewToggle)
    #expect(state.allClasses == ["liquidita", "investimenti", "previdenza"])
    #expect(state.headline(scrub: nil).value == v.change.end)
    let single = NetWorthChartState(series: [point("2026-10-18", ["liquidita": 10])], change: .init(start: 10, end: 10, delta: 0, deltaPct: nil),
                                    view: .total, hidden: [], pensionIncluded: true)
    #expect(!single.hasHistory && !single.showsViewToggle)
    #expect(single.allClasses == ["liquidita"])
}

@Test func OV015_stackOrderNetLineAndNotes() throws {
    let v = try overview()
    let state = NetWorthChartState(series: v.series, change: v.change, view: .byClass, hidden: [], pensionIncluded: true)
    #expect(state.showsDebts && state.showsNetLine)
    #expect(state.notes == ["Linea scura: patrimonio netto", "Il patrimonio netto è già al netto dei debiti"])
    let bands = NetWorthStack.bands(v.series, classes: state.visibleClasses)
    #expect(bands.map(\.key) == ["liquidita", "investimenti", "previdenza"])
    let last = v.series.count - 1
    #expect(abs(bands[2].upper[last] - (23915.34 + 71038.29324820726 + 11082.07)) < 0.001)
    #expect(bands[1].lower[last] == bands[0].upper[last])
    let domain = NetWorthStack.domain(bands: bands, netLine: v.series.map(\.value))
    #expect(domain.lowerBound == 0 && domain.upperBound >= bands[2].upper.max()!)
}

@Test func OV015_bandPathClosesBackAlongTheLowerEdge() {
    let upper = [ChartPoint(x: 0, y: 0), ChartPoint(x: 10, y: 5), ChartPoint(x: 20, y: 2)]
    let lower = [ChartPoint(x: 0, y: 10), ChartPoint(x: 10, y: 12), ChartPoint(x: 20, y: 11)]
    let path = NetWorthStack.bandPath(upper: upper, lower: lower)
    #expect(path.first == .move(upper[0]))
    #expect(path.last == .close)
    #expect(path[path.count - 4] == .line(lower[2]))
    if case .cubic(_, _, let end) = path[path.count - 2] { #expect(end == lower[0]) } else { Issue.record("expected cubic") }
    #expect(path.count == 3 + 1 + 2 + 1)
}

@Test func OV016_legendNeverHidesLastVisibleClass() {
    let all = ["liquidita", "investimenti"]
    var hidden = NetWorthLegend.toggle([], key: "liquidita", allClasses: all)
    #expect(hidden == ["liquidita"])
    hidden = NetWorthLegend.toggle(hidden, key: "investimenti", allClasses: all)
    #expect(hidden == ["liquidita"])
    hidden = NetWorthLegend.toggle(hidden, key: "liquidita", allClasses: all)
    #expect(hidden.isEmpty)
}

@Test func OV017_partialTotalAndTotaleClearsHidden() throws {
    let v = try overview()
    let state = NetWorthChartState(series: v.series, change: v.change, view: .byClass, hidden: ["investimenti"], pensionIncluded: true)
    #expect(state.isPartial && !state.showsDebts)
    #expect(state.hiddenClasses == ["investimenti"])
    #expect(state.totalLabel == "Totale parziale")
    #expect(abs(state.headline(scrub: nil).value - (23915.34 + 11082.07)) < 0.001)
    #expect(state.legend.first { $0.key == "investimenti" }?.visible == false)
    let total = NetWorthChartState(series: v.series, change: v.change, view: .total, hidden: ["investimenti"], pensionIncluded: true)
    #expect(!total.isPartial && total.headline(scrub: nil).value == v.change.end)
}

@Test func OV018_OV019_pensionExcluded() throws {
    let v = try overview("overview-1anno-no-pension.json")
    let state = NetWorthChartState(series: v.series, change: v.change, view: .byClass, hidden: [], pensionIncluded: false)
    #expect(state.showsPensionSwitch && state.pensionExcluded)
    #expect(state.totalLabel == "Totale senza previdenza")
    #expect(state.notes.contains("Area grigia: previdenza, non inclusa nel totale"))
    // Partial with pension excluded: pension is not counted.
    let partial = NetWorthChartState(series: v.series, change: v.change, view: .byClass, hidden: ["investimenti"], pensionIncluded: false)
    #expect(partial.headline(scrub: nil).value == v.series.last!.byClass["liquidita"]!)
    #expect(OverviewPreferenceKeys.includePension == "bb:net-worth-include-pension")
}

@Test func OV020_pointDetailRowsTopDown() throws {
    let v = try overview()
    let state = NetWorthChartState(series: v.series, change: v.change, view: .total, hidden: [], pensionIncluded: true)
    let detail = try #require(state.detail(at: 0))
    #expect(detail.date == "2026-07-18" && detail.isEstimated)
    #expect(detail.rows.map(\.key) == ["debiti", "previdenza", "investimenti", "liquidita"])
    #expect(detail.rows.first?.label == "Debiti (già sottratti)")
    #expect(detail.totalLabel == "Totale" && detail.total == 69569.58)
    let scrub = state.headline(scrub: 0)
    #expect(scrub.value == 69569.58 && scrub.change.delta == 0)
}

@Test func OV009_axisLabelsAndThinning() {
    #expect(NetWorthChartState.axisLabel("2026-07-18", period: .threeMonths, locale: .itIT) == "18 lug")
    #expect(NetWorthChartState.axisLabel("2025-10-31", period: .oneYear, locale: .itIT) == "ott 25")
    let centers = (0..<10).map { Double($0) * 30 + 20 }
    let kept = NetWorthStack.thinLabels(centers: centers, widths: Array(repeating: 40, count: 10), plotWidth: 300)
    #expect(kept.last == 9)
    #expect(zip(kept, kept.dropFirst()).allSatisfy { centers[$1] - centers[$0] >= 72 })
}

// MARK: Composition, month, dues, investments

@Test func OV022_OV023_OV024_composition() throws {
    let v = try overview()
    #expect(CompositionDisplay.showsDonut(v.composition))
    #expect(CompositionDisplay.donutItems(v.composition).map(\.key) == ["liquidita", "investimenti", "previdenza"])
    #expect(CompositionDisplay.percent(CompositionDisplay.investedShare(v.composition)!) == "67%")
    #expect(CompositionDisplay.showsShare(v.composition[0], in: v.composition))
    #expect(!CompositionDisplay.showsShare(v.composition[3], in: v.composition))
    #expect(CompositionDisplay.sentence(v.composition) == nil)
    #expect(AssetClass.path("previdenza") == "/pensione" && AssetClass.path("debiti") == "/debiti")
    let excluded = try overview("overview-1anno-no-pension.json")
    #expect(!CompositionDisplay.donutItems(excluded.composition).contains { $0.key == "previdenza" })
}

@Test func OV026_monthPaceBudgetAndGeometry() throws {
    let pace = try overview().monthPace
    #expect(MonthPaceDisplay.budgetText(pace)?.source == "restano {0}")
    #expect(abs(MonthPaceDisplay.budgetText(pace)!.amount - (780 - 398.83)) < 0.001)
    #expect(!MonthPaceDisplay.isOverBudget(pace))
    let g = MonthPaceGeometry(pace: pace, width: 358)
    #expect(g.ticks == [1, 16, 31])
    #expect(g.x(day: 1) == 8 && g.x(day: 31) == 358 - 64)
    #expect(g.y(0) == 200 - 28)
    #expect(g.points(pace.current).count == 18)
}

@Test func OV027_upToThreeDues() throws {
    let v = try overview()
    #expect(UpcomingDues.shown(v.debts).map(\.name) == ["Cucina e lavatrice", "Mutuo casa", "Prestito auto"])
    #expect(UpcomingDues.shown(nil).isEmpty)
}

@Test func OV025_OV028_investmentsPulse() throws {
    let pulse = InvestmentsPulse(try #require(try overview().investments))
    #expect(!pulse.isLoss && pulse.sign == "+")
    #expect(pulse.ratioText(locale: .itIT) == CatalogText("{0}{1}% sul versato", ["0": "+", "1": "11,0"]))
    #expect(pulse.ratioText(locale: .enGB).values["1"] == "11.0")
    #expect(pulse.positionsText == CatalogText("{0} posizioni", ["0": "13"]))
    #expect(pulse.paidShare > 0.9 && pulse.paidShare < 1)
}

// MARK: Goals

@Test func OV030_goalsGatedBySections() {
    #expect(GoalsTile.isAvailable(MeBootstrap.Sections()))
    #expect(!GoalsTile.isAvailable(MeBootstrap.Sections(pension: false, analytics: false, goals: false, fire: false)))
}

@Test func OV031_inviteDismissal() {
    #expect(GoalsTile.mode(GoalsView(currency: "EUR", goals: []), inviteDismissed: false) == .invite)
    #expect(GoalsTile.mode(GoalsView(currency: "EUR", goals: []), inviteDismissed: true) == .hidden)
    #expect(GoalsTile.mode(nil, inviteDismissed: false) == .hidden)
    #expect(OverviewPreferenceKeys.goalsInviteDismissed == "bb-goals-invite-dismissed")
}

@Test func OV032_goalsSortedByMonthsToGoThenProgress() {
    let goals = [
        GoalView(id: "a", name: "A", target: 1, progress: 0.2, monthsToGo: nil, status: "fermo"),
        GoalView(id: "b", name: "B", target: 1, progress: 0.4, monthsToGo: 14, status: "in_ritardo"),
        GoalView(id: "c", name: "C", target: 1, progress: 0.8, monthsToGo: 10, status: "senza_data"),
        GoalView(id: "d", name: "D", target: 1, progress: 1, monthsToGo: 0, status: "raggiunto"),
        GoalView(id: "e", name: "E", target: 1, progress: 0.9, monthsToGo: 14, status: "in_linea"),
    ]
    #expect(GoalsTile.closest(goals).map(\.id) == ["c", "e", "b"])
    #expect(GoalsTile.mode(GoalsView(currency: "EUR", goals: [goals[3]]), inviteDismissed: false) == .hidden)
    let late = GoalView(id: "x", name: "X", target: 4500, targetDate: "2027-08-01", monthly: 200, current: 1800, progress: 0.4,
                        funded: 200, required: 270, etaMonth: "2027-12", monthsToGo: 14, status: "in_ritardo")
    let sentence = GoalsTile.statusSentence(late, money: { "\(Int($0)) €" }, month: { $0 })
    #expect(sentence.capitalizeFirst)
    #expect(sentence.parts.map(\.source) == ["al ritmo di {0} al mese ci arrivi a {1}", ", dopo {0}: servirebbero {1} al mese."])
    #expect(GoalsTile.statusLabel("in_ritardo") == "In ritardo")
}

// MARK: Primi passi

@Test func OV033_OV037_stepsAndGermanReplacement() {
    let it = StartChecklist.steps(retirement: true)
    #expect(it.map(\.id) == StartStepId.allCases)
    #expect(it[0].title == "Aggiungi il tuo conto")
    #expect(it[0].done == "Conto aggiunto")
    let goal = it.last!
    #expect(goal.path == "/analitiche?traguardo=1" && goal.cta == "Fissa il traguardo")
    let de = StartChecklist.steps(retirement: false).last!
    #expect(de.title == "Imposta un budget")
    #expect(de.description == "Imposta un budget per categoria." && de.cta == "Vai alle categorie" && de.done == "Budget impostato")
    #expect(de.path == "/liquidita/categorie")
}

@Test func OV034_statusLine() {
    #expect(StartChecklist.statusLine(StartStatus(steps: steps0)) == CatalogText("{0} su {1} fatti", ["0": "0", "1": "4"]))
    let ids = ["conto", "import", "investimento", "obiettivo"]
    let two = StartStatus(steps: StartStatus.Steps(conto: true, investimento: true), stepIds: ids)
    #expect(StartChecklist.statusLine(two) == CatalogText("{0} su {1} fatti", ["0": "2", "1": "4"]))
    // A skipped step not done leaves the count (OV-046).
    let skipped = StartStatus(steps: StartStatus.Steps(conto: true, investimento: true), stepIds: ids, skipped: ["import"])
    #expect(StartChecklist.statusLine(skipped) == CatalogText("{0} su {1} fatti", ["0": "2", "1": "3"]))
}

@Test func OV035_visibility() {
    let base = StartStatus(steps: steps0, dismissed: false, completed: false, demoActive: false)
    #expect(StartChecklist.isVisible(base, forced: false))
    let dismissed = StartStatus(steps: steps0, dismissed: true, completed: false, demoActive: false)
    #expect(!StartChecklist.isVisible(dismissed, forced: false))
    #expect(StartChecklist.isVisible(dismissed, forced: true))
    let demo = StartStatus(steps: steps0, dismissed: false, completed: false, demoActive: true)
    #expect(!StartChecklist.isVisible(demo, forced: true))
    let done = StartStatus(steps: steps0, dismissed: false, completed: true, demoActive: false)
    #expect(!StartChecklist.isVisible(done, forced: true))
}

@Test func OV036_OV039_OV042_startEndpoints() async throws {
    let transport = RecordingTransport(responses: [
        (204, ""), (201, #"{"accounts":2,"transactions":120}"#), (204, ""),
        (409, #"{"error":"Hai già dei conti: i dati d'esempio sono per chi parte da zero."}"#),
    ])
    let api = StartAPI(client: APIClient(baseURL: URL(string: "https://x.test/")!, transport: transport))
    try await api.setDismissed(true)
    #expect(try await api.startDemo().accounts == 2)
    try await api.clearDemo()
    let requests = transport.requests
    #expect(requests[0].httpMethod == "PATCH" && String(data: requests[0].httpBody ?? Data(), encoding: .utf8) == #"{"dismissed":true}"#)
    #expect(requests[1].httpMethod == "POST" && requests[1].url?.path == "/api/start/demo")
    #expect(requests[2].httpMethod == "DELETE")
    // OV-040: the 409 message is shown inline.
    do {
        try await api.startDemo()
        Issue.record("expected 409")
    } catch let error as APIError {
        #expect(error.status == 409 && error.body?.message == "Hai già dei conti: i dati d'esempio sono per chi parte da zero.")
    }
}

// MARK: «Novità»

@Test func SHELL049_SHELL050_whatsNewPickAndDismiss() throws {
    let w = try JSONDecoder().decode(WhatsNew.self, from: try fixture("whats-new.json"))
    #expect(WhatsNewDismissals.pick(w, dismissed: [])?.id == "obiettivi-di-risparmio")
    #expect(WhatsNewDismissals.pick(w, dismissed: ["obiettivi-di-risparmio"])?.id == "categorizza-con-ai")
    #expect(WhatsNewDismissals.pick(w, dismissed: ["obiettivi-di-risparmio", "categorizza-con-ai"]) == nil)
    let raw = WhatsNewDismissals.adding("a", to: WhatsNewDismissals.adding("b", to: nil))
    #expect(raw == "b,a" && WhatsNewDismissals.parse(raw) == ["b", "a"])
    #expect(WhatsNewDismissals.adding("a", to: raw) == "b,a")
    #expect(InAppLinks.nativePath("/analitiche/obiettivi?nuovo=1&da=novita") == "/analitiche/obiettivi?nuovo=1&da=novita")
    #expect(InAppLinks.nativePath("/categorizza") == "/categorizza")
    #expect(InAppLinks.nativePath("/sconosciuto/x") == "/panoramica")
}

// MARK: «Il tuo quadro»

@Test func SHELL028_SET020_SET021_moduleKeysAndOrder() {
    #expect(SidebarModuleId.allCases.map(\.preferenceKey) == [
        "bb:sidebar:module:oggi", "bb:sidebar:module:portafoglio", "bb:sidebar:module:watchlist",
        "bb:sidebar:module:scadenze", "bb:sidebar:module:fire",
    ])
    #expect(SidebarModuleId.enabledByDefault)
    #expect(SidebarModuleId.settingsOrder(retirement: true) == [.oggi, .portafoglio, .watchlist, .scadenze, .fire])
    #expect(SidebarModuleId.settingsOrder(retirement: false) == [.oggi, .portafoglio, .watchlist, .scadenze])
    #expect(SidebarModuleId.needsSummary([.scadenze, .fire]) == false)
    #expect(SidebarModuleId.needsSummary([.watchlist]))
}

@Test func SHELL029_renderOrderAndWatchlistCollapsed() {
    #expect(SidebarModuleId.renderOrder(enabled: { _ in true }, retirement: true) == [.oggi, .scadenze, .fire, .portafoglio, .watchlist])
    #expect(SidebarModuleId.renderOrder(enabled: { $0 != .oggi }, retirement: false) == [.scadenze, .portafoglio, .watchlist])
    #expect(!SidebarModuleId.watchlist.openByDefault && SidebarModuleId.oggi.openByDefault)
}

@Test func SHELL030_todayWithoutPension() throws {
    let nw = try JSONDecoder().decode(SidebarSummary.NetWorth.self, from: Data(
        #"{"total":84520.33,"monthChange":1210.5,"pension":{"total":21430.12,"monthChange":100}}"#.utf8))
    #expect(SidebarInsights.today(nw, pensionIncluded: true) == (84520.33, 1210.5))
    let excluded = SidebarInsights.today(nw, pensionIncluded: false)
    #expect(abs(excluded.total - 63090.21) < 0.001 && excluded.change == 1110.5)
    let noChange = try JSONDecoder().decode(SidebarSummary.NetWorth.self, from: Data(#"{"total":10,"monthChange":null,"pension":null}"#.utf8))
    #expect(SidebarInsights.today(noChange, pensionIncluded: false).change == nil)
}

@Test func SHELL031_SHELL032_limitsAndWords() {
    #expect(SidebarInsights.maxHoldings == 3 && SidebarInsights.maxWatchlist == 4)
    #expect(SidebarInsights.watchlistSummary(1) == "titolo" && SidebarInsights.watchlistSummary(2) == "titoli")
    #expect(SidebarInsights.alertsWord(1) == "avviso")
    #expect(SidebarInsights.tone(nil) == .neutral && SidebarInsights.tone(0.00001) == .neutral && SidebarInsights.tone(-0.01) == .neg)
    #expect(InAppLinks.securityPath("i1") == "/investimenti/titoli/i1")
}

@Test func SHELL034_SHELL035_deadlineLinksAndOverdue() throws {
    let json = #"""
    {"currency":"EUR","items":[
      {"id":"rinnovo:c1","kind":"rinnovo","label":"Rinnova Intesa","date":"2026-10-18","amount":null,"overdue":true,"href":"/liquidita/conti?rinnova=sidebar"},
      {"id":"rata:d1","kind":"rata","label":"Mutuo casa","date":"2026-11-01","amount":718.97,"overdue":false,"href":"/debiti/finanziamenti?id=d1"}]}
    """#
    let d = try JSONDecoder().decode(SidebarDeadlines.self, from: Data(json.utf8))
    #expect(InAppLinks.deadlinePath(d.items[0]) == "/liquidita/conti?rinnova=sidebar")
    #expect(InAppLinks.deadlinePath(d.items[1]) == "/debiti/finanziamenti?id=d1")
    #expect(AppDestination(path: InAppLinks.deadlinePath(d.items[1])) == .debts)
    #expect(AccountsLaunchIntent(path: InAppLinks.deadlinePath(d.items[0])) != nil)
    #expect(SidebarInsights.overdueCount(d.items) == 1 && SidebarInsights.overdueBadge(1) == "scaduta")
    #expect(SidebarInsights.overdueBadge(2) == "scadute" && SidebarInsights.overdueBadge(0) == nil)
    #expect(SidebarInsights.deadlineDay("2026-10-12", locale: .itIT) == ("12", "ott"))
}

@Test func SHELL036_fireStates() {
    #expect(SidebarInsights.fireState(SidebarFire(currency: "EUR", wealth: 1, target: nil, progress: nil, yearsToFire: nil)) == .invite)
    #expect(SidebarInsights.fireState(SidebarFire(currency: "EUR", wealth: 2, target: 1, progress: 2, yearsToFire: 0)) == .reached(progress: 2))
    #expect(SidebarInsights.fireState(SidebarFire(currency: "EUR", wealth: 120_000, target: 750_000, progress: 0.16, yearsToFire: 21.5))
        == .progress(progress: 0.16, remaining: 630_000, years: CatalogText("tra {0} anni", ["0": "22"])))
    #expect(SidebarInsights.yearsToFire(0.4) == CatalogText("tra meno di un anno"))
    #expect(SidebarInsights.yearsToFire(1.2) == CatalogText("tra 1 anno"))
    #expect(SidebarInsights.yearsToFire(nil) == nil)
    #expect(SidebarInsights.fireProgressText(1.4) == "100%" && SidebarInsights.fireProgressText(0.127) == "13%")
}

@Test func SHELL037_freshnessWindows() {
    #expect(SidebarModuleId.oggi.freshSeconds == 300 && SidebarModuleId.scadenze.freshSeconds == 600 && SidebarModuleId.fire.freshSeconds == 3600)
    var clock = FreshnessClock()
    let t0 = Date(timeIntervalSince1970: 1000)
    #expect(!clock.isFresh(now: t0, seconds: 300))
    clock.mark(t0)
    #expect(clock.isFresh(now: t0.addingTimeInterval(299), seconds: 300))
    #expect(!clock.isFresh(now: t0.addingTimeInterval(300), seconds: 300))
}

// MARK: - Helpers

final class RecordingTransport: HTTPTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var queue: [(Int, String)]
    private(set) var requests: [URLRequest] = []

    init(responses: [(Int, String)]) { queue = responses }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let (status, body) = lock.withLock { () -> (Int, String) in
            requests.append(request)
            return queue.isEmpty ? (200, "{}") : queue.removeFirst()
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (Data(body.utf8), response)
    }
}
