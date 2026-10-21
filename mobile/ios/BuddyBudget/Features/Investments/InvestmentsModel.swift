import BuddyBudgetKit
import Foundation
import Observation

/// State of Investimenti (07-investments): the tab frame, the shared view per query, Performance, Dividendi, Tasse,
/// the watched titles, the price-history backfill and every mutation. Logic lives in BuddyBudgetKit
/// (`InvestmentsRules`, `InvestmentsUiState`, `OperationForm`); this model only sequences API calls. One instance per
/// signed-in session (kept by `ShellModel`). Same fields as `InvestmentsModel` on Android.
@MainActor @Observable
final class InvestmentsModel {
    private(set) var state: InvestmentsUiState
    /// Views by query (Portafoglio and the 3-month view shared by Diversificazione and Operazioni, INV-005).
    private(set) var views: [InvestmentsQuery: InvestmentsView] = [:]
    private(set) var failedQueries: Set<InvestmentsQuery> = []
    private(set) var performance: Loadable<InvestmentsPerformance> = .loading
    /// INV-035: a range picked on the returns chart (replaces the period's bounds).
    private(set) var selection: ChartRange?
    /// INV-034: chart point being inspected (index into `returns.series`).
    var inspectIndex: Int?
    /// INV-039: backfill state of the benchmark (`nil` = not read yet, `.some(nil)` = nothing on the server).
    private(set) var benchmarkBackfill: BackfillState?? = nil
    private(set) var income: Loadable<InvestmentsIncome> = .loading
    private(set) var taxes: Loadable<InvestmentsTaxes> = .loading
    /// INV-027 / SEC-010: watched ∪ held titles; nil on error (section hidden).
    private(set) var titles: [TitleItem]?
    /// INV-024: instruments whose price history is still downloading.
    private(set) var backfilling: Set<String> = []
    /// Register / edit operation (INV-062…073): the form to open, and the operation being edited.
    var registerForm: OperationForm?
    /// «Importa» / «Importa da file CSV» (INV-001, INV-010): opens the broker import, set by the shell.
    @ObservationIgnored var openImport: (() -> Void)?
    var editing: OperationResult?
    /// Which screen presents the register dialog: "" = the Investimenti frame, else the security page's instrument id.
    var registerHost = ""
    /// INV-026: instrument whose manual price is being entered.
    var manualPriceFor: Instrument?
    /// A remote logo was shown (INV-030 credit).
    var logosShown = false

    /// DE Tasse / Dividendi: the German plan (13-planning-de), shared by both tabs.
    let planning: GermanPlanningModel

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var backfillTask: Task<Void, Never>?
    @ObservationIgnored private var incomePolls = 0

    init(env: AppEnvironment) {
        self.env = env
        state = InvestmentsUiState(today: InvestmentsModel.todayKey)
        planning = GermanPlanningModel(api: env.planning)
    }

    static var todayKey: String { CalendarDate.of(Date(), in: .current).iso }
    var currency: String { env.session.currency }
    var countryContent: InvestmentsCountryContent { InvestmentsCountryContent.of(env.session.features) }
    var showsInflation: Bool { env.session.features?.inflation ?? true }

    // MARK: Tabs and periods

    func select(_ tab: InvestmentsTab) {
        state.tab = tab
        ensureBaseView()
        Task { await load(tab) }
    }

    /// The broker chip and the pickers need a view even on Performance / Dividendi / Tasse.
    private func ensureBaseView() {
        if anyView == nil, state.tab != .portfolio, state.tab != .diversification, state.tab != .operations {
            Task { await loadView(state.baseQuery) }
        }
    }

    /// INV-009: the broker filter is session-only and reset when leaving the section.
    func leaveSection() {
        guard !state.excludedBrokers.isEmpty else { return }
        state.excludedBrokers = []
    }

    func refreshTabs() {
        state.visibleTabs = InvestmentsTab.visible(env.session.sections)
        if !state.visibleTabs.contains(state.tab) { state.tab = .portfolio }
    }

    func setPeriod(_ period: InvestmentsPeriod) {
        state.period = period
        Task { await loadPortfolio() }
    }

    func applyCustomRange(_ range: ChartRange) {
        state.customRange = range
        state.period = .custom
        Task { await loadPortfolio() }
    }

    /// INV-036: changing period or range clears selection and inspection.
    func setPerformancePeriod(_ period: InvestmentsPeriod) {
        state.performancePeriod = period
        selection = nil
        inspectIndex = nil
        Task { await loadPerformance() }
    }

    func applyPerformanceRange(_ range: ChartRange) {
        state.performanceCustomRange = range
        state.performancePeriod = .custom
        selection = nil
        inspectIndex = nil
        Task { await loadPerformance() }
    }

    func selectRange(_ range: ChartRange?) {
        selection = range
        inspectIndex = nil
        Task { await loadPerformance() }
    }

    func toggleBroker(_ id: String) {
        if state.excludedBrokers.contains(id) { state.excludedBrokers.remove(id) } else { state.excludedBrokers.insert(id) }
        Task { await load(state.tab) }
    }

    func showAllBrokers() {
        state.excludedBrokers = []
        Task { await load(state.tab) }
    }

    func setReinvest(fees: Bool? = nil, taxes: Bool? = nil) {
        if let fees { state.reinvestFees = fees }
        if let taxes { state.reinvestTaxes = taxes }
    }

    // MARK: Loading

    var portfolioView: InvestmentsView? { views[state.portfolioQuery] }
    var baseView: InvestmentsView? { views[state.baseQuery] }
    /// Any loaded view (broker list, instruments for pickers).
    var anyView: InvestmentsView? { portfolioView ?? baseView ?? views.values.first }

    func gate(_ query: InvestmentsQuery, countsCash: Bool) -> InvestmentsGate {
        let view = views[query]
        return InvestmentsGate.of(loaded: view != nil, failed: failedQueries.contains(query),
                                  hasTransactions: view?.hasTransactions ?? false, hasCash: !(view?.brokerCash.isEmpty ?? true),
                                  countsCash: countsCash, brokersFiltered: !state.excludedBrokers.isEmpty)
    }

    func start() async {
        state.today = Self.todayKey
        refreshTabs()
        ensureBaseView()
        await load(state.tab)
    }

    func load(_ tab: InvestmentsTab) async {
        switch tab {
        case .portfolio: await loadPortfolio()
        case .performance: await loadPerformance()
        case .diversification, .operations: await loadView(state.baseQuery)
        case .income: await loadIncome()
        case .taxes: await loadTaxes()
        }
    }

    /// After a mutation or a data change (INV-007): drop every cached response and reload the visible tab.
    func reloadAll() async {
        views = [:]
        failedQueries = []
        performance = .loading
        income = .loading
        taxes = .loading
        if countryContent == .germanPlan, state.tab == .income || state.tab == .taxes { await planning.load() }
        await load(state.tab)
    }

    func loadPortfolio() async {
        async let titlesLoad: Void = loadTitles()
        await loadView(state.portfolioQuery)
        await titlesLoad
        if let view = portfolioView { startBackfillPolling(ids: view.instruments.map(\.id)) }
    }

    func loadView(_ query: InvestmentsQuery) async {
        failedQueries.remove(query)
        do {
            views[query] = try await env.investments.view(query)
        } catch {
            if views[query] == nil { failedQueries.insert(query) }
        }
    }

    func loadTitles() async {
        titles = try? await env.investments.titles()
    }

    func loadPerformance() async {
        let query = state.performanceQuery(selection: selection)
        if performance.value == nil { performance = .loading }
        do {
            let result = try await env.investments.performance(query)
            performance = .loaded(result)
            if let id = result.benchmark?.id { await pollBenchmark(id) }
        } catch {
            if performance.value == nil { performance = .failed }
        }
    }

    @ObservationIgnored private var benchmarkTask: Task<Void, Never>?

    /// INV-039: benchmark download progress (every 2 s while running, then reload the comparison).
    private func pollBenchmark(_ id: String) async {
        benchmarkTask?.cancel()
        let states = try? await env.instruments.backfill(ids: [id])
        benchmarkBackfill = .some(states?.first)
        guard states?.first?.isRunning == true else { return }
        benchmarkTask = Task { [weak self] in
            for _ in 0..<150 {
                try? await Task.sleep(for: .seconds(2))
                guard let self, !Task.isCancelled else { return }
                let next = try? await self.env.instruments.backfill(ids: [id])
                self.benchmarkBackfill = .some(next?.first)
                if next?.first?.isRunning != true {
                    await self.loadPerformance()
                    return
                }
            }
        }
    }

    /// INV-081: refetch every 4 s (max 6 times) while dividend histories download.
    func loadIncome() async {
        guard countryContent == .italian else { return }
        do {
            let result = try await env.investments.income(state.baseQuery)
            income = .loaded(result)
            if result.pendingDividendHistory > 0, incomePolls < 6 {
                incomePolls += 1
                try? await Task.sleep(for: .seconds(4))
                if state.tab == .income { await loadIncome() }
            } else {
                incomePolls = 0
            }
        } catch {
            if income.value == nil { income = .failed }
        }
    }

    func loadTaxes() async {
        guard countryContent == .italian else { return }
        do {
            taxes = .loaded(try await env.investments.taxes(state.baseQuery))
        } catch {
            if taxes.value == nil { taxes = .failed }
        }
    }

    /// INV-024: poll `GET /api/instruments/backfill` every 2 s while any instrument is downloading, then refetch.
    private func startBackfillPolling(ids: [String]) {
        backfillTask?.cancel()
        backfillTask = Task { [weak self] in
            var wasRunning = false
            for _ in 0..<90 {
                guard let self, !Task.isCancelled else { return }
                let states = (try? await self.env.instruments.backfill(ids: ids)) ?? []
                let running = Set(states.filter(\.isRunning).map(\.instrumentId))
                self.backfilling = running
                if running.isEmpty {
                    if wasRunning { await self.reloadAll() }
                    return
                }
                wasRunning = true
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    // MARK: Mutations

    private func message(_ error: Error) -> String {
        (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
    }

    private func afterMutation() async {
        await reloadAll()
        if state.tab != .portfolio { await loadTitles() }
    }

    /// Opens «Registra operazione» (INV-062), optionally prefilled.
    func openRegister(_ form: OperationForm? = nil) {
        editing = nil
        var f = form ?? OperationForm(date: Self.todayKey)
        if f.held == nil, let id = f.instrument?.id { f.held = heldQuantity(id) }
        registerForm = f
    }

    func openEdit(_ op: OperationResult) {
        let instrument = anyView?.instrument(op.transaction.instrumentId)
        editing = op
        registerForm = OperationForm.editing(op.transaction, instrument: instrument,
                                             held: heldQuantity(op.transaction.instrumentId).map { $0 + (op.transaction.type == "vendita" ? op.transaction.quantityValue : 0) })
    }

    /// Units held now (sales cannot exceed them, INV-069).
    func heldQuantity(_ instrumentId: String) -> Double? {
        guard let view = anyView else { return nil }
        return view.summary.rows.first { $0.instrument.id == instrumentId }?.quantity ?? 0
    }

    /// Creates or updates an operation; returns the server error message on failure (INV-070).
    func save(_ form: OperationForm) async -> String? {
        guard let input = form.input(today: Self.todayKey) else { return form.validate(today: Self.todayKey) }
        do {
            if let editing {
                try await env.investments.updateOperation(id: editing.transaction.id, input)
            } else {
                try await env.investments.createOperation(input)
            }
            registerForm = nil
            editing = nil
            registerHost = ""
            await afterMutation()
            return nil
        } catch {
            return message(error)
        }
    }

    /// INV-061: immediate delete (server refusals as a toast).
    func delete(_ op: OperationResult) async {
        do {
            try await env.investments.deleteOperation(id: op.transaction.id)
            await afterMutation()
        } catch {
            env.toasts.showError(message(error), area: .operazione)
        }
    }

    func saveManualPrice(_ instrument: Instrument, date: String, close: Double) async -> String? {
        do {
            try await env.instruments.setManualPrice(id: instrument.id, date: date, close: close)
            manualPriceFor = nil
            await afterMutation()
            return nil
        } catch {
            return message(error)
        }
    }

    func saveTargets(_ targets: [InvestmentsView.Target]) async -> String? {
        do {
            try await env.investments.setTargets(targets)
            await afterMutation()
            return nil
        } catch {
            return message(error)
        }
    }

    func setBenchmark(_ instrumentId: String?) async -> String? {
        do {
            try await env.investments.setBenchmark(instrumentId)
            performance = .loading
            await loadPerformance()
            return nil
        } catch {
            return message(error)
        }
    }

    /// Benchmark from a market search hit (`?history=deferred`, INV-038).
    func setBenchmark(hit: InstrumentSearchResult.MarketHit) async -> String? {
        do {
            let instrument = try await env.instruments.create(.yahoo(symbol: hit.symbol, name: hit.name, type: hit.type, isin: nil),
                                                              deferHistory: true)
            return await setBenchmark(instrument.id)
        } catch {
            return message(error)
        }
    }

    func setRegime(_ regime: String) async {
        do {
            try await env.investments.setTaxRegime(regime)
            await loadTaxes()
        } catch {
            env.toasts.showError(message(error), area: .salvataggio)
        }
    }

    func addCarryforward(year: Int, amount: Double, note: String?) async -> String? {
        do {
            try await env.investments.addCarryforward(year: year, amount: amount, note: note)
            await loadTaxes()
            return nil
        } catch {
            return message(error)
        }
    }

    func deleteCarryforward(_ id: String) async {
        do {
            try await env.investments.deleteCarryforward(id: id)
            await loadTaxes()
        } catch {
            env.toasts.show(.error, message(error))
        }
    }

    func saveSettings(_ instrumentId: String, _ input: InstrumentSettingsInput) async -> String? {
        do {
            try await env.instruments.saveSettings(id: instrumentId, input)
            async let t: Void = loadTaxes()
            async let i: Void = loadIncome()
            _ = await (t, i)
            return nil
        } catch {
            return message(error)
        }
    }

    /// INV-078: ignore proposals with an undo toast.
    func dismiss(_ items: [InvestmentsIncome.Missing]) async {
        let pairs = items.map { (instrumentId: $0.instrumentId, date: $0.date) }
        do {
            try await env.investments.dismissDividends(pairs)
            await loadIncome()
            let text = items.count == 1 ? L10n.lookup(italian: "Proposta ignorata")
                : L10n.lookup(italian: "{0} proposte ignorate", ["0": String(items.count)])
            env.toasts.show(.plain, text, actionLabel: L10n.lookup(italian: "Annulla"), onAction: { [weak self] in
                Task {
                    try? await self?.env.investments.restoreDividends(pairs)
                    await self?.loadIncome()
                }
            })
        } catch {
            env.toasts.showError(message(error), area: .operazione)
        }
    }

    /// INV-086: «Prima di vendere» (server simulation; callers debounce).
    func simulateSale(instrumentId: String, quantity: Double) async -> Result<SaleSimulation, APIError> {
        do {
            return .success(try await env.investments.simulateSale(instrumentId: instrumentId, quantity: quantity, query: state.baseQuery))
        } catch let error as APIError {
            return .failure(error)
        } catch {
            return .failure(.transport(String(describing: error)))
        }
    }
}
