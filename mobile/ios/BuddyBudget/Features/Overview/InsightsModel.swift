import BuddyBudgetKit
import Foundation
import Observation

/// One module's data in «Il tuo quadro»: never loaded, loading, loaded, or failed (renders nothing, SHELL-037).
enum InsightState<T> {
    case idle, loading, loaded(T), failed

    var value: T? { if case .loaded(let v) = self { return v } else { return nil } }
    var isLoading: Bool { if case .loading = self { return true } else { return false } }
}

/// «Il tuo quadro» in «Altro» (SHELL-020, SHELL-028…038): collapsed by default, no request until opened; each enabled
/// module loads its data with its freshness window and is never retried. Same fields as `InsightsModel` on Android.
@MainActor @Observable
final class InsightsModel {
    private(set) var isOpen = false
    private(set) var summary: InsightState<SidebarSummary> = .idle
    private(set) var deadlines: InsightState<SidebarDeadlines> = .idle
    private(set) var fire: InsightState<SidebarFire> = .idle

    @ObservationIgnored private let env: AppEnvironment
    @ObservationIgnored private var summaryClock = FreshnessClock()
    @ObservationIgnored private var deadlinesClock = FreshnessClock()
    @ObservationIgnored private var fireClock = FreshnessClock()

    init(env: AppEnvironment) {
        self.env = env
        #if DEBUG
        // `-BBQuadro open` opens «Il tuo quadro» at launch for screenshots.
        if ["open", "top"].contains(DebugLaunch.value("-BBQuadro")) { toggleOpen() }
        #endif
    }

    var retirement: Bool { env.session.bootstrap?.capabilities.features.retirement ?? true }

    func isEnabled(_ module: SidebarModuleId) -> Bool {
        env.preferences.flag(module.preferenceKey, default: SidebarModuleId.enabledByDefault)
    }

    func setEnabled(_ module: SidebarModuleId, _ enabled: Bool) {
        env.preferences.setFlag(module.preferenceKey, enabled)
        if enabled && isOpen { Task { await load() } }
    }

    /// SHELL-029: enabled modules in render order.
    var modules: [SidebarModuleId] { SidebarModuleId.renderOrder(enabled: isEnabled, retirement: retirement) }

    /// Section open state, remembered per device like the web's `section-open:<id>`.
    func isSectionOpen(_ module: SidebarModuleId) -> Bool {
        env.preferences.flag("section-open:\(module.rawValue)", default: module.openByDefault)
    }

    func toggleSection(_ module: SidebarModuleId) {
        env.preferences.setFlag("section-open:\(module.rawValue)", !isSectionOpen(module))
    }

    var includePension: Bool { env.preferences.flag(OverviewPreferenceKeys.includePension, default: true) }

    /// SHELL-020: the first open triggers the requests.
    func toggleOpen() {
        isOpen.toggle()
        if isOpen { Task { await load() } }
    }

    /// Demo data changed: everything is stale.
    func invalidate() {
        summaryClock = FreshnessClock()
        deadlinesClock = FreshnessClock()
        fireClock = FreshnessClock()
        if isOpen { Task { await load() } }
    }

    /// SHELL-028 / SHELL-037: only the enabled modules, only when not fresh, no retry; in parallel.
    func load() async {
        let now = Date()
        let active = modules
        async let a: Void = SidebarModuleId.needsSummary(active) ? loadSummary(now) : ()
        async let b: Void = active.contains(.scadenze) ? loadDeadlines(now) : ()
        async let c: Void = active.contains(.fire) ? loadFire(now) : ()
        _ = await (a, b, c)
    }

    private func loadSummary(_ now: Date) async {
        guard !summaryClock.isFresh(now: now, seconds: SidebarModuleId.oggi.freshSeconds) else { return }
        summaryClock.mark(now)
        if summary.value == nil { summary = .loading }
        summary = (try? await env.sidebar.summary()).map { .loaded($0) } ?? .failed
    }

    private func loadDeadlines(_ now: Date) async {
        guard !deadlinesClock.isFresh(now: now, seconds: SidebarModuleId.scadenze.freshSeconds) else { return }
        deadlinesClock.mark(now)
        if deadlines.value == nil { deadlines = .loading }
        deadlines = (try? await env.sidebar.deadlines()).map { .loaded($0) } ?? .failed
    }

    private func loadFire(_ now: Date) async {
        guard !fireClock.isFresh(now: now, seconds: SidebarModuleId.fire.freshSeconds) else { return }
        fireClock.mark(now)
        if fire.value == nil { fire = .loading }
        fire = (try? await env.sidebar.fire()).map { .loaded($0) } ?? .failed
    }
}
