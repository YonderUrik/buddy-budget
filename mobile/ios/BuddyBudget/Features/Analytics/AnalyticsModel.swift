import BuddyBudgetKit
import Foundation
import Observation

/// The two views of Analitiche (`ANALYTICS_TABS`).
enum AnalyticsTab: String, CaseIterable {
    case risposte, obiettivi

    var title: String { self == .risposte ? "Risposte" : "Obiettivi" }
    var viewDescription: String {
        self == .risposte ? "Quanto ti serve, quando ci arrivi, quanto dura" : "Per cosa metti da parte e quando ci arrivi"
    }
    var icon: BBIcon { self == .risposte ? .messageCircleQuestionMark : .target }
    var subtitle: String {
        self == .risposte
            ? "Muovi le ipotesi e guarda cosa cambia. I numeri tecnici sono in «Per esperti»."
            : "Per cosa metti da parte, quando ci arrivi e cosa cambia per il traguardo."
    }
}

/// The goal form being shown (create or edit, start step, preset kind).
struct GoalFormRequest: Equatable {
    var goalId: String?
    var startStep: GoalFormStep = .tipo
    var presetKind: GoalKind?
}

/// State of Analitiche (11-analytics, 12-goals): one `GET /api/analytics/base` for «Risposte» (ANA-002), one
/// `GET /api/goals` for «Obiettivi» (GOAL-004), every mutation and the Monte Carlo off the main thread. Logic lives in
/// BuddyBudgetKit (`AnalyticsUiState`, `AnalyticsRules`, `GoalsRules`, `GoalWizard`); this model only sequences calls.
/// Same fields as `AnalyticsModel` on Android.
@MainActor @Observable
final class AnalyticsModel {
    var tab: AnalyticsTab = .risposte
    private(set) var state = AnalyticsUiState()
    private(set) var goals = GoalsUiState()
    /// Monte Carlo over the four rules, retiring today (ANA-023); nil while computing or without spending.
    private(set) var results: [MonteCarloResult]?
    /// Expert simulation with the retire-at toggle (ANA-029).
    private(set) var expertResult: MonteCarloResult?
    private(set) var updatingPeriod = false
    var walkthroughOpen = false
    var walkthroughStep = 0
    var targetDialogOpen = false
    var assumptionsOpen = false
    /// Glossary term or explainer shown in the bottom sheet (ANA-032).
    var termId: String?
    var terDrafts: [String: String] = [:]
    var terError: String?
    // Goals
    var goalForm: GoalFormRequest?
    var goalFormError: String?
    private(set) var goalSaving = false
    var confirmDeleteGoal: String?
    var deleteError: String?
    private(set) var goalBusy = false
    /// Goal emails off: the summary step offers «Ricordamelo per email» (GOAL-023).
    private(set) var offerReminders = false

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var started = false
    @ObservationIgnored private var autoOpened = false
    /// Arrived from «Primi passi» (`?traguardo=1`): the walkthrough does not open on top (ANA-007).
    @ObservationIgnored var fromGoalLink = false
    @ObservationIgnored private var simulationKey: MonteCarloInput?
    @ObservationIgnored private var expertKey: MonteCarloInput?
    @ObservationIgnored private var simulationTask: Task<Void, Never>?
    @ObservationIgnored private var simulationRunning = false
    @ObservationIgnored private var expertRunning = false
    @ObservationIgnored private var expertTask: Task<Void, Never>?
    @ObservationIgnored private var debugDialogOpened = false

    init(env: AppEnvironment) {
        self.env = env
    }

    /// The device's local day (`today=` of the base call).
    static var todayKey: String { CalendarDate.of(Date(), in: .current).iso }
    var currency: String { state.view?.currency ?? env.session.currency }
    var todayYear: Int { state.today.year }

    func start() async {
        guard !started else { return }
        started = true
        await Task { await self.load() }.value
    }

    func refresh() async {
        if tab == .risposte { await load() } else { await loadGoals(force: true) }
    }

    // MARK: Risposte

    /// ANA-002 (403 → country-unavailable, ANA-001). Keeps the previous view when a refresh fails.
    func load() async {
        do {
            let view = try await env.analytics.base(today: Self.todayKey)
            state.view = view
            state.failed = false
            state.unavailable = false
            terDrafts = AnalyticsRules.terDrafts(view.storedAssumptions.terByInstrument)
            scheduleSimulation()
            // ANA-005: the walkthrough opens by itself on the first visit, not when arriving for «Il tuo traguardo».
            if !view.walkthroughSeen, !autoOpened, !fromGoalLink {
                autoOpened = true
                walkthroughStep = 0
                walkthroughOpen = true
            }
            openDebugDialog()
        } catch let error as APIError where error.code == .countryFeatureUnavailable {
            state.unavailable = true
        } catch {
            if state.view == nil { state.failed = true }
        }
        updatingPeriod = false
    }

    func retry() async {
        state.failed = false
        await load()
    }

    func select(_ question: AnalyticsQuestion) { state.selected = question }

    func toggleExpert(_ question: AnalyticsQuestion) {
        if state.expertOpen.contains(question) { state.expertOpen.remove(question) } else { state.expertOpen.insert(question) }
        scheduleExpertSimulation()
    }

    /// ANA-014.
    func move(_ field: FireScenarioField, to value: Double) {
        state.move(field, to: value)
        scheduleSimulation()
    }

    /// ANA-019 «Ripristina».
    func resetScenario() {
        state.overrides = FireScenarioOverrides()
        scheduleSimulation()
    }

    /// ANA-019 «Salva queste ipotesi».
    func saveScenario() async {
        if await save(.scenario(state.overrides)) { state.overrides = FireScenarioOverrides() }
    }

    /// ANA-016.
    func useData(_ field: FireScenarioField) async { await save(.useData(field)) }
    func useHistoryReturn() async { await save(.useHistoryReturn) }

    /// ANA-011: 12/24 save at once; «Scegli i mesi» shows the selects.
    func choosePeriod(_ choice: AnalyticsPeriodChoice) {
        switch choice {
        case .custom:
            state.chooseCustomPeriod()
        case .twelve, .twentyFour:
            state.periodChoice = choice
            Task { await savePeriod(.ultimi(months: choice == .twentyFour ? 24 : 12)) }
        }
    }

    func setCustom(from: String? = nil, to: String? = nil) {
        if let from { state.customFrom = from }
        if let to { state.customTo = to }
    }

    /// ANA-013: a range applied from the month calendar (already validated by the sheet).
    func applyCustomPeriod(_ range: DateKeyRange) async {
        state.customFrom = range.from
        state.customTo = range.to
        state.periodChoice = .custom
        await applyCustomPeriod()
    }

    func applyCustomPeriod() async {
        guard state.customError == nil, !state.customUnchanged else { return }
        await savePeriod(.personalizzato(from: state.customFrom, to: state.customTo))
    }

    private func savePeriod(_ period: DataPeriod) async {
        updatingPeriod = true
        if !(await save(.period(period))) { updatingPeriod = false }
        state.periodChoice = nil
    }

    func setRetireAt(_ retireAt: FireRetireAt) {
        state.retireAt = retireAt
        scheduleExpertSimulation()
    }

    func selectRule(_ rule: WithdrawalRule) { state.withdrawalRule = rule }

    /// ANA-031: validates and saves all TERs together.
    func saveTers() async {
        guard let view = state.view else { return }
        switch AnalyticsRules.validateTers(terDrafts, positions: view.base.positions) {
        case .failure(let e):
            terError = L10n.lookup(italian: e.source, e.values)
        case .success(let ters):
            terError = nil
            await save(.ters(ters))
        }
    }

    /// Every `PUT /api/analytics/assumptions` then refetch (the period changes which data count) and drop the goals cache.
    @discardableResult
    func save(_ patch: AnalyticsAssumptionsPatch) async -> Bool {
        state.saving = true
        state.saveError = nil
        defer { state.saving = false }
        do {
            try await env.analytics.update(patch)
            goals.loadedAt = nil
            await load()
            return true
        } catch {
            state.saveError = message(error)
            return false
        }
    }

    /// ANA-005: closing (finished or skipped) marks the walkthrough seen.
    func closeWalkthrough() {
        walkthroughOpen = false
        guard let view = state.view, !view.walkthroughSeen else { return }
        Task { try? await env.analytics.markWalkthroughSeen() }
    }

    func openWalkthrough() {
        walkthroughStep = 0
        walkthroughOpen = true
    }

    // MARK: Monte Carlo off the main thread (same seed and algorithm as the web)

    /// True while the «Regge» compare runs (the tile and the answer show a loading state, not «serve la spesa annua»).
    var simulating: Bool { state.simulationInput != nil && results == nil }

    private func scheduleSimulation() {
        let input = state.simulationInput
        // Same input already computed or still computing: keep it (restarting would throw the work away).
        if input == simulationKey, results != nil || input == nil || simulationRunning { scheduleExpertSimulation(); return }
        simulationKey = input
        simulationTask?.cancel()
        guard let input else {
            results = nil
            scheduleExpertSimulation()
            return
        }
        simulationRunning = true
        simulationTask = Task { [weak self] in
            // Debounce: the sliders move continuously; the heavy part runs once they rest.
            try? await Task.sleep(for: .milliseconds(120))
            if Task.isCancelled { return }
            let computed = await Self.compareRulesInParallel(input)
            if Task.isCancelled { return }
            self?.simulationRunning = false
            self?.results = computed
            self?.scheduleExpertSimulation()
        }
        scheduleExpertSimulation()
    }

    /// The four rules are independent runs on the same paths: one child task each (about 4× faster on a multi-core
    /// device). Each run polls cancellation per path, so a superseded compare frees the CPU at once.
    nonisolated private static func compareRulesInParallel(_ input: MonteCarloInput) async -> [MonteCarloResult] {
        await withTaskGroup(of: (Int, MonteCarloResult).self) { group in
            for (index, rule) in MonteCarlo.withdrawalRules.enumerated() {
                var copy = input
                copy.rule = rule
                group.addTask(priority: .userInitiated) { (index, MonteCarlo.runMonteCarlo(copy, isCancelled: { Task.isCancelled })) }
            }
            var out: [(Int, MonteCarloResult)] = []
            for await item in group { out.append(item) }
            return out.sorted { $0.0 < $1.0 }.map(\.1)
        }
    }

    private func scheduleExpertSimulation() {
        guard state.expertOpen.contains(.reggera) else { return }
        let input = state.expertSimulationInput
        guard input != expertKey || (expertResult == nil && !expertRunning) else { return }
        expertKey = input
        expertTask?.cancel()
        guard let input else {
            expertResult = nil
            return
        }
        // Retiring today = the saved rule of the compare already computed (same seed, same paths).
        if input == simulationKey, let match = results?.first(where: { $0.rule == input.rule }) {
            expertResult = match
            return
        }
        expertRunning = true
        expertTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(120))
            if Task.isCancelled { return }
            let computed = await Self.runInBackground(input)
            if Task.isCancelled { return }
            self?.expertRunning = false
            self?.expertResult = computed
        }
    }

    nonisolated private static func runInBackground(_ input: MonteCarloInput) async -> MonteCarloResult {
        await withTaskGroup(of: MonteCarloResult.self) { group in
            group.addTask(priority: .userInitiated) { MonteCarlo.runMonteCarlo(input, isCancelled: { Task.isCancelled }) }
            return await group.next()!
        }
    }

    // MARK: Obiettivi

    /// GOAL-004: reused for 5 minutes; mutations force a refetch.
    func loadGoals(force: Bool = false) async {
        if !force, goals.isFresh(now: Date()) { return }
        do {
            goals.view = try await env.goals.list()
            goals.loadedAt = Date()
            goals.failed = false
            goals.unavailable = false
            openDebugGoalDialog()
        } catch let error as APIError where error.code == .countryFeatureUnavailable {
            goals.unavailable = true
        } catch {
            if goals.view == nil { goals.failed = true }
        }
    }

    func retryGoals() async {
        goals.failed = false
        await loadGoals(force: true)
    }

    /// GOAL-009 / GOAL-010: optimistic swap, full order to the server, refetch; 409 shows the server message.
    func moveGoal(openIndex: Int, delta: Int) async {
        guard let view = goals.view, !goals.reordering, let ids = GoalsRules.reorder(view, openIndex: openIndex, delta: delta) else { return }
        goals.view = GoalsRules.applying(ids, to: view)
        goals.reordering = true
        defer { goals.reordering = false }
        do {
            try await env.goals.reorder(ids)
        } catch {
            env.toasts.show(.error, message(error))
        }
        await loadGoals(force: true)
    }

    /// GOAL-003 / GOAL-029 / GOAL-030: opens the form (reminder offer read from the notification settings).
    func openGoalForm(_ request: GoalFormRequest) {
        goalFormError = nil
        goalForm = request
        if request.goalId == nil {
            Task {
                let prefs = try? await env.user.notifications()
                offerReminders = prefs.map { !$0.goalAlertsEnabled } ?? false
            }
        }
    }

    /// GOAL-024 / GOAL-025 (GOAL-023: reminders turned on only after a successful create, open question 1).
    func submitGoal(_ draft: GoalDraft, remind: Bool) async -> Bool {
        guard let request = goalForm else { return false }
        goalSaving = true
        goalFormError = nil
        defer { goalSaving = false }
        do {
            let payload = GoalWizard.toPayload(draft)
            if let id = request.goalId {
                try await env.goals.update(id: id, payload)
            } else {
                try await env.goals.create(payload)
                if remind, offerReminders {
                    _ = try? await env.user.updateNotifications(NotificationPreferencesPatch(goalAlertsEnabled: true))
                }
            }
            goalForm = nil
            await loadGoals(force: true)
            return true
        } catch {
            goalFormError = message(error)
            return false
        }
    }

    /// GOAL-031: no confirmation.
    func toggleAchieved(_ goal: GoalView) async {
        goalBusy = true
        defer { goalBusy = false }
        do {
            try await env.goals.setAchieved(id: goal.id, goal.achievedAt == nil)
            await loadGoals(force: true)
        } catch {
            env.toasts.show(.error, message(error))
        }
    }

    /// GOAL-032: after the confirmation; back to the list on success.
    func deleteGoal(_ id: String) async -> Bool {
        goalBusy = true
        deleteError = nil
        defer { goalBusy = false }
        do {
            try await env.goals.delete(id: id)
            confirmDeleteGoal = nil
            await loadGoals(force: true)
            return true
        } catch {
            deleteError = message(error)
            return false
        }
    }

    private func message(_ error: Error) -> String {
        if let text = (error as? APIError)?.body?.message, !text.isEmpty { return L10n.lookup(italian: text) }
        return L10n.genericError
    }

    // MARK: DEBUG

    /// DEBUG-only `-BBDialog walkthrough|assumptions|target|term:<id>` (Risposte) for screenshots, once.
    private func openDebugDialog() {
        #if DEBUG
        if !debugDialogOpened, let question = DebugLaunch.value("-BBQuestion").flatMap(AnalyticsQuestion.init(rawValue:)) { state.selected = question }
        guard !debugDialogOpened, let name = DebugLaunch.value("-BBDialog") else { return }
        debugDialogOpened = true
        switch name {
        case "walkthrough": openWalkthrough()
        case "assumptions": assumptionsOpen = true
        case "target": targetDialogOpen = true
        case let n where n.hasPrefix("term:"): termId = String(n.dropFirst(5))
        case let n where n.hasPrefix("expert:"):
            if let q = AnalyticsQuestion(rawValue: String(n.dropFirst(7))) {
                state.selected = q
                state.expertOpen.insert(q)
                scheduleExpertSimulation()
            }
        default: debugDialogOpened = false
        }
        #endif
    }

    /// DEBUG-only `-BBDialog goal:<step>[:<id>]` opens the goal form at a step for screenshots.
    private func openDebugGoalDialog() {
        #if DEBUG
        guard !debugDialogOpened, let name = DebugLaunch.value("-BBDialog"), name.hasPrefix("goal") else { return }
        debugDialogOpened = true
        let parts = name.split(separator: ":").map(String.init)
        let step = parts.count > 1 ? GoalFormStep(rawValue: parts[1]) ?? .tipo : .tipo
        let id = parts.count > 2 ? goals.view?.goals.first?.id : nil
        openGoalForm(GoalFormRequest(goalId: id, startStep: id == nil ? .tipo : step, presetKind: id == nil && step != .tipo ? .viaggio : nil))
        debugStartStep = step
        #endif
    }

    /// DEBUG: step the new-goal form jumps to.
    var debugStartStep: GoalFormStep?
}
