import BuddyBudgetKit
import Foundation
import Observation

/// State of Panoramica (OV-001…043) plus the start status shared with the demo banner (SHELL-048) and «Novità»
/// (SHELL-049/050). One instance per signed-in session, owned by `ShellModel`. Same fields as `OverviewModel` on Android.
@MainActor @Observable
final class OverviewModel {
    /// OV-009: `3M` on every visit (reset when the Overview becomes active again).
    private(set) var period: OverviewPeriod = .default
    private(set) var chartView: NetWorthChartView = .total
    private(set) var hiddenClasses: Set<String> = []
    /// Scrubbed point of the chart (mobile adaptation of the hover tooltip, OV-020).
    var scrubIndex: Int?
    /// Locked composition slice (OV-024).
    var selectedSlice: Int?

    /// Last overview shown (kept while another period loads).
    private(set) var view: OverviewView?
    private(set) var failed = false
    /// OV-044: when the shown overview arrived from the server and whether a request is in flight.
    private(set) var viewUpdatedAt = Date.distantPast
    private(set) var fetchingView = false
    private(set) var start: StartStatus?
    private(set) var goals: GoalsView?
    private(set) var whatsNew: WhatsNew?

    private(set) var dismissingChecklist = false
    /// OV-046 / OV-047: a skip, restore or focus save in flight.
    private(set) var updatingStart = false
    private(set) var focusError: String?
    /// OV-048: steps done since the last visit to Panoramica, acknowledged above the next step (cleared when leaving it).
    var acknowledged: [StartStepId] = []
    private(set) var demoStarting = false
    private(set) var demoStartError: String?
    private(set) var demoClearing = false
    private(set) var demoClearError: String?

    @ObservationIgnored private let env: AppEnvironment
    @ObservationIgnored private var cache: [String: (view: OverviewView, at: Date)] = [:]
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var goalsLoaded = false
    @ObservationIgnored private var whatsNewLoaded = false
    /// Called after demo data starts or is cleared, so every visible screen refetches (OV-039, OV-042).
    @ObservationIgnored var onDataChanged: (() -> Void)?
    /// Set by the shell: whether Panoramica is on screen, and how to open an in-app path (SHELL-060).
    @ObservationIgnored var isOnOverview: () -> Bool = { false }
    @ObservationIgnored var openPath: (String) -> Void = { _ in }

    /// Web `staleTime` of the overview queries.
    private static let staleSeconds: TimeInterval = 120
    /// Steps already seen done on this device (`bb:start-seen-done`, SHELL-060).
    private static let startSeenKey = "bb:start-seen-done"

    init(env: AppEnvironment) {
        self.env = env
    }

    // MARK: Derived

    var content: OverviewContent { OverviewContent.resolve(view: view, failed: failed) }

    /// OV-018: per-device, default on, shared with «Il tuo quadro».
    var includePension: Bool { env.preferences.flag(OverviewPreferenceKeys.includePension, default: true) }

    var goalsInviteDismissed: Bool { env.preferences.flag(OverviewPreferenceKeys.goalsInviteDismissed, default: false) }

    var demoActive: Bool { start?.demoActive == true }

    var chartState: NetWorthChartState? {
        guard let view else { return nil }
        return NetWorthChartState(series: view.series, change: view.change, view: chartView, hidden: hiddenClasses,
                                  pensionIncluded: view.includePension)
    }

    /// SHELL-049: the entry shown as a chip next to the date.
    var whatsNewEntry: WhatsNewEntry? { WhatsNewDismissals.pick(whatsNew, dismissed: dismissedWhatsNew) }

    private var dismissedWhatsNew: [String] { WhatsNewDismissals.parse(env.preferences.string(WhatsNewDismissals.key)) }

    private var retirement: Bool { env.session.bootstrap?.capabilities.features.retirement ?? true }

    var steps: [StartStepDefinition] { StartChecklist.steps(retirement: retirement) }

    func step(_ id: StartStepId) -> StartStepDefinition { StartChecklist.definition(id, retirement: retirement) }

    /// AUTH-058 / OV-047: the pension answer only where the pension section exists.
    var focusOptions: [StartFocus] { StartFocus.options(pensionAvailable: env.session.sections.pension) }

    /// OV-031: the goals invite stays hidden while «Primi passi» is on screen (web #444).
    private var checklistShown: Bool {
        guard let start else { return false }
        return StartChecklist.isVisible(start, forced: view?.isEmpty == true)
    }

    var goalsMode: GoalsTile.Mode {
        GoalsTile.isAvailable(env.session.sections)
            ? GoalsTile.mode(goals, inviteDismissed: goalsInviteDismissed, checklistShown: checklistShown) : .hidden
    }

    // MARK: Loading

    /// The Overview became active (first open or back to the tab): period back to 3M, start status always refreshed
    /// (OV-038), overview refetched when stale, goals and «Novità» once per session.
    func activate() async {
        if period != .default { period = .default }
        scrubIndex = nil
        async let s: Void = refreshStart()
        async let o: Void = loadOverview(force: false)
        async let g: Void = goalsLoaded ? () : loadGoals()
        async let w: Void = whatsNewLoaded ? () : loadWhatsNew()
        _ = await (s, o, g, w)
    }

    /// Pull-to-refresh and «Riprova» (OV-006 + start status and goals).
    func refresh() async {
        cache.removeAll()
        async let s: Void = refreshStart()
        async let o: Void = loadOverview(force: true)
        async let g: Void = loadGoals()
        async let w: Void = loadWhatsNew()
        _ = await (s, o, g, w)
    }

    func retry() {
        failed = false
        Task { await refresh() }
    }

    /// OV-038 / SHELL-048: `GET /api/start` (failure keeps the last value: the block is optional).
    func refreshStart() async {
        if let next = try? await env.start.status() {
            start = next
            announceProgress(next)
        }
    }

    /// SHELL-060 / OV-048: a step that becomes done is announced once per device — a toast with the next step outside
    /// Panoramica, the acknowledgement above the next step inside it, «Primi passi completati» at the end. The first
    /// status the device sees is not news; nothing is said with sample data or once the checklist was hidden.
    private func announceProgress(_ status: StartStatus) {
        if status.demoActive { return }
        let doneNow = status.askedSteps.filter { status.steps.isDone($0) }
        let seen = env.preferences.string(Self.startSeenKey).map { Set($0.split(separator: ",").compactMap { StartStepId(rawValue: String($0)) }) }
        env.preferences.setString(Self.startSeenKey, (seen ?? []).union(doneNow).map(\.rawValue).sorted().joined(separator: ","))
        guard let seen else { return }
        let fresh = StartChecklist.newlyDone(before: seen, status)
        if fresh.isEmpty || status.dismissed { return }
        let doneText = fresh.map { L10n.lookup(italian: step($0).done) }.joined(separator: " · ")
        let onOverview = isOnOverview()
        guard let nextId = StartChecklist.nextStep(status) else {
            let title = L10n.lookup(italian: "Primi passi completati")
            if onOverview {
                env.toasts.show(.success, "\(title)\n\(doneText)")
            } else {
                env.toasts.show(.success, "\(title)\n\(doneText)", actionLabel: L10n.lookup(italian: "Vai alla Panoramica"),
                                onAction: { [weak self] in self?.openPath("/panoramica") })
            }
            return
        }
        if onOverview {
            for id in fresh where !acknowledged.contains(id) { acknowledged.append(id) }
            return
        }
        let next = step(nextId)
        env.toasts.show(.success, "\(doneText)\n\(L10n.lookup(italian: "Prossimo passo: {0}", ["0": L10n.lookup(italian: next.title)]))",
                        actionLabel: L10n.lookup(italian: next.cta), onAction: { [weak self] in self?.openPath(next.path) }, duration: 8)
    }

    /// OV-048: the acknowledgement lasts one visit to Panoramica.
    func leftOverview() { acknowledged = [] }

    /// OV-046: «Non mi serve» / «Rimetti».
    func setSkipped(_ step: StartStepId, skipped: Bool) {
        guard !updatingStart else { return }
        updatingStart = true
        Task {
            defer { updatingStart = false }
            do {
                try await env.start.setSkipped(step, skipped: skipped)
                await refreshStart()
            } catch {
                env.toasts.show(.error, L10n.genericError)
            }
        }
    }

    /// OV-047: saves the focus; the steps asked change right away. Returns true on success (the sheet closes).
    func saveFocus(_ focus: [StartFocus]) async -> Bool {
        updatingStart = true
        focusError = nil
        defer { updatingStart = false }
        do {
            try await env.start.setFocus(focus.map(\.rawValue))
            await refreshStart()
            return true
        } catch {
            focusError = Self.message(error)
            return false
        }
    }

    private func key(_ period: OverviewPeriod, _ pension: Bool) -> String { "\(period.rawValue)|\(pension ? 1 : 0)" }

    /// `GET /api/overview`, cached per (period, includePension).
    func loadOverview(force: Bool) async {
        let period = self.period, pension = includePension
        let k = key(period, pension)
        if !force, let hit = cache[k], Date().timeIntervalSince(hit.at) < Self.staleSeconds {
            view = hit.view
            failed = false
            return
        }
        if let hit = cache[k] { view = hit.view }
        loadTask?.cancel()
        let task = Task { @MainActor [env] in
            self.fetchingView = true
            defer { self.fetchingView = false }
            do {
                let today = CalendarDate.of(Date(), in: .current).iso
                let next = try await env.overview.view(period: period, includePension: pension, today: today)
                guard !Task.isCancelled else { return }
                self.cache[k] = (next, Date())
                if self.period == period && self.includePension == pension {
                    self.view = next
                    self.viewUpdatedAt = Date()
                    self.failed = false
                    if self.scrubIndex.map({ $0 >= next.series.count }) == true { self.scrubIndex = nil }
                }
            } catch {
                guard !Task.isCancelled else { return }
                if self.view == nil { self.failed = true }
                self.viewUpdatedAt = Date()
            }
        }
        loadTask = task
        await task.value
    }

    private func loadGoals() async {
        guard GoalsTile.isAvailable(env.session.sections) else { return }
        goalsLoaded = true
        // OV-006: a failure only hides the goals tile.
        goals = try? await env.goals.list()
    }

    private func loadWhatsNew() async {
        whatsNewLoaded = true
        if let next = try? await env.whatsNew.get(dismissed: dismissedWhatsNew) { whatsNew = next }
    }

    // MARK: Chart controls

    /// OV-009: a period switch is a new (cached) call.
    func setPeriod(_ next: OverviewPeriod) {
        guard next != period else { return }
        period = next
        scrubIndex = nil
        Task { await loadOverview(force: false) }
    }

    /// OV-014 / OV-017: back to `Totale` clears the hidden classes.
    func setChartView(_ next: NetWorthChartView) {
        if next == .total { hiddenClasses = [] }
        chartView = next
        scrubIndex = nil
    }

    /// OV-016.
    func toggleClass(_ key: String) {
        guard let state = chartState else { return }
        hiddenClasses = NetWorthLegend.toggle(hiddenClasses, key: key, allClasses: state.allClasses)
    }

    func showAllClasses() { hiddenClasses = [] }

    /// OV-018: persisted per device; the overview is refetched with the new `includePension`.
    func setIncludePension(_ included: Bool) {
        env.preferences.setFlag(OverviewPreferenceKeys.includePension, included)
        Task { await loadOverview(force: false) }
    }

    // MARK: Actions

    /// OV-036: no confirmation; hidden right away.
    func dismissChecklist() async {
        guard let current = start, !dismissingChecklist else { return }
        dismissingChecklist = true
        defer { dismissingChecklist = false }
        do {
            try await env.start.setDismissed(true)
            start = current.with(dismissed: true)
        } catch {
            env.toasts.show(.error, L10n.genericError)
        }
    }

    /// OV-039 / OV-040: start the sample data, then refetch everything.
    func startDemo() async {
        guard !demoStarting else { return }
        demoStarting = true
        demoStartError = nil
        defer { demoStarting = false }
        do {
            try await env.start.startDemo()
            await dataChanged()
        } catch {
            demoStartError = Self.message(error)
        }
    }

    /// OV-042 / SHELL-048: one tap, no confirmation (as the web), snackbar afterwards (mobile adaptation).
    func clearDemo() async {
        guard !demoClearing else { return }
        demoClearing = true
        demoClearError = nil
        defer { demoClearing = false }
        do {
            try await env.start.clearDemo()
            await dataChanged()
            env.toasts.show(.success, L10n.lookup(italian: "Dati d'esempio azzerati"))
        } catch {
            demoClearError = Self.message(error)
        }
    }

    private func dataChanged() async {
        onDataChanged?()
        await refresh()
    }

    /// OV-031: `Non ora`, remembered on this device.
    func dismissGoalsInvite() { env.preferences.setFlag(OverviewPreferenceKeys.goalsInviteDismissed, true) }

    /// SHELL-050: `Non mostrare più`, remembered on this device.
    func dismissWhatsNew(_ id: String) {
        env.preferences.setString(WhatsNewDismissals.key, WhatsNewDismissals.adding(id, to: env.preferences.string(WhatsNewDismissals.key)))
    }

    #if DEBUG
    @ObservationIgnored private var debugApplied = false

    /// DEBUG-only screenshot hooks: `-BBChartView byClass`, `-BBHide investimenti`, `-BBPeriod 1anno`, `-BBScrub <index>`.
    func applyDebugLaunch() {
        guard !debugApplied else { return }
        debugApplied = true
        if DebugLaunch.value("-BBChartView") == "byClass" { chartView = .byClass }
        if let hide = DebugLaunch.value("-BBHide") { hiddenClasses = Set(hide.split(separator: ",").map(String.init)) }
        if let raw = DebugLaunch.value("-BBPeriod"), let next = OverviewPeriod(rawValue: raw) { setPeriod(next) }
        if let index = DebugLaunch.value("-BBScrub").flatMap(Int.init) { scrubIndex = index }
    }
    #endif

    /// Server message of a failed call (409 demo errors are already localized), else the generic one.
    static func message(_ error: Error) -> String {
        (error as? APIError)?.body?.message ?? L10n.genericError
    }
}
