import BuddyBudgetKit
import Foundation
import Observation

/// A screen pushed on a tab's stack.
enum ShellRoute: Hashable {
    case destination(AppDestination)
    case settingsGroup(SettingsGroup)
    /// Security page `/investimenti/titoli/{id}` (SEC-015).
    case instrument(String)
    /// Loan detail `/debiti/finanziamenti?id=` (DEBT-019).
    case debt(String)
    /// Goal detail `/analitiche/obiettivi/{id}` (GOAL-027).
    case goal(String)
}

/// Navigation state of the signed-in app: selected tab, one stack per tab (SHELL-013…021; no Liquidità badge since web #451).
/// Same name and behaviour as `ShellModel` on Android.
@MainActor @Observable
final class ShellModel {
    var tab: AppTab = .overview
    var paths: [AppTab: [ShellRoute]] = [:]
    /// TX-001: the Liquidità view shown in the Liquidità tab (its destinations are segments of one root screen).
    var liquiditySegment: LiquiditySegment = .movements
    /// ACC-009 / ACC-010: one-shot request for the Conti screen (`?nuovo=1`, `?rinnova=…`); Conti clears it.
    var accountsIntent: AccountsLaunchIntent?
    /// SUP-002 / SUP-003: `?da=` / `?tipo=` of the last `/aiuto` link; the help screen takes it once.
    @ObservationIgnored private var helpLaunch: HelpLaunch?

    @ObservationIgnored private let env: AppEnvironment
    /// Settings state shared by the hub and its group screens for this signed-in session.
    @ObservationIgnored private(set) lazy var settings = SettingsModel(env: env)
    /// Panoramica state; its start status also drives the demo banner and «Novità» (OV-*, SHELL-048…050).
    @ObservationIgnored private(set) lazy var overview = OverviewModel(env: env)
    /// «Il tuo quadro» in «Altro» (SHELL-020, SHELL-028…038).
    @ObservationIgnored private(set) lazy var insights = InsightsModel(env: env)
    /// Bumped after demo data starts or is cleared: screens showing data reload when it changes (OV-039, OV-042).
    private(set) var dataVersion = 0
    /// Liquidità state (filters, Analisi period) kept while switching tabs (TX-003).
    @ObservationIgnored private(set) lazy var liquidity = LiquidityModel(env: env)
    /// Investimenti state (tab, periods, broker filter) kept while switching tabs; the broker filter is reset when
    /// leaving the section (INV-009).
    @ObservationIgnored private(set) lazy var investments: InvestmentsModel = {
        let model = InvestmentsModel(env: env)
        model.openImport = { [weak self] in self?.brokerImport.present() }
        return model
    }()
    /// «Importa operazioni» (07-investments §8) and «Importazioni» (§9).
    @ObservationIgnored private(set) lazy var brokerImport: BrokerImportModel = {
        let model = BrokerImportModel(env: env)
        model.onImported = { [weak self] in self?.dataChanged() }
        return model
    }()
    @ObservationIgnored private(set) lazy var importManagement: ImportManagementModel = {
        let model = ImportManagementModel(env: env, imports: imports)
        model.onChanged = { [weak self] in self?.dataChanged() }
        return model
    }()
    /// «Importazioni» dialog open (INV-001).
    var importManagementOpen = false
    /// Debiti state (one `GET /api/debts` for overview and detail, DEBT-001).
    @ObservationIgnored private(set) lazy var debts = DebtsModel(env: env)
    /// Pensione state (selected fund, tab, simulations).
    @ObservationIgnored private(set) lazy var pension = PensionModel(env: env)
    /// Analitiche state (Risposte and Obiettivi, ANA-*, GOAL-*).
    @ObservationIgnored private(set) lazy var analytics = AnalyticsModel(env: env)
    /// Personal imports and the global island (14-imports).
    @ObservationIgnored private(set) lazy var imports: ImportsModel = {
        let model = ImportsModel(env: env)
        model.onFinished = { [weak self] in
            self?.markHistoryPending()
            self?.dataChanged()
        }
        return model
    }()

    /// OV-044 / TX-076: a bank sync is running (set by Conti, which polls the sync jobs).
    var syncRunning = false
    /// When an import or sync last finished, until the history charts have reloaded (`markHistoryRefreshPending`).
    private(set) var historyPendingSince: Date?

    func markHistoryPending() { historyPendingSince = Date() }

    /// What a history chart whose data was received at `dataUpdatedAt` says now (OV-044, TX-076).
    func chartRefresh(dataUpdatedAt: Date, isFetching: Bool) -> ChartRefresh.State? {
        let importing = syncRunning || !PersonalImportRules.runningIds(imports.listing?.jobs ?? []).isEmpty
        let pending = ChartRefresh.freshPending(historyPendingSince, now: Date())
        return ChartRefresh.state(importing: importing, pendingSince: pending, dataUpdatedAt: dataUpdatedAt, isFetching: isFetching)
    }

    /// Clears the pending mark once a chart holds data newer than it.
    func settleChart(dataUpdatedAt: Date, isFetching: Bool) {
        if ChartRefresh.isSettled(pendingSince: historyPendingSince, dataUpdatedAt: dataUpdatedAt, isFetching: isFetching) {
            historyPendingSince = nil
        }
    }

    /// TX-064: the movement detail open over any screen (Movimenti, Categorizza, a subscription's charges).
    var movementDetail: MovementDetailRequest?

    func openMovement(_ id: String, placeholder: Movement? = nil) {
        movementDetail = MovementDetailRequest(id: id, placeholder: placeholder)
    }

    /// The app is in the foreground: polls run only then (imports island, «Primi passi», visits).
    @ObservationIgnored private(set) var foreground = true
    @ObservationIgnored private var lastHeartbeat = Date.distantPast
    @ObservationIgnored private var welcomeShownSince: String?

    init(env: AppEnvironment) {
        self.env = env
    }

    var sections: MeBootstrap.Sections { env.session.sections }
    var tabs: [AppTab] { Navigation.tabs(sections) }

    func path(_ tab: AppTab) -> [ShellRoute] { paths[tab] ?? [] }

    func setPath(_ path: [ShellRoute], for tab: AppTab) { paths[tab] = path }

    /// SHELL-005: open on the home page chosen in Settings.
    func start() {
        env.quickReport.currentPath = { [weak self] in self?.currentPath ?? "/" }
        open(env.session.homePage)
        #if DEBUG
        if let path = DebugLaunch.openPath { open(path: path) }
        // `-BBReceiveFile <path>`: the file as if shared to the app («Apri in», mobile note) — screenshots and E2E.
        if let path = DebugLaunch.value("-BBReceiveFile"), let file = ImportFileTypes.read(URL(fileURLWithPath: path)) {
            receive(.files([file]), locale: LocalizedStrings.shared.language.bbLocale)
        }
        // `-BBBrokerFile <path>`: the broker wizard with that file (generic CSVs would go to the personal form).
        if let path = DebugLaunch.value("-BBBrokerFile"), let file = ImportFileTypes.read(URL(fileURLWithPath: path)) {
            open(.investments)
            brokerImport.present(files: [file])
        }
        // `-BBMovement <id>`: the movement detail over the opened screen (TX-064 screenshots).
        if let id = DebugLaunch.value("-BBMovement") { openMovement(id) }
        // `-BBDialog imports|broker|broker-guide`: «Importazioni» (list open) or the empty broker wizard.
        switch DebugLaunch.value("-BBDialog") {
        case "imports":
            importManagementOpen = true
            importManagement.listOpen = true
        // `-BBDialog scrivici|segnala`: the quick-report sheet, empty or with a sample attached error (16-help-support).
        case "scrivici": env.quickReport.open(source: .pulsante)
        case "segnala":
            env.quickReport.open(source: .errore, error: ReportError(area: .abbonamento, message: "Hai già un abbonamento con questo nome"))
        case "broker": brokerImport.present()
        case "broker-guide":
            brokerImport.present()
            brokerImport.provider = .degiro
            brokerImport.showGuide = true
        default: break
        }
        #endif
        overview.onDataChanged = { [weak self] in
            self?.dataVersion += 1
            self?.insights.invalidate()
        }
        // SHELL-060 / OV-038: «Primi passi» progress is announced everywhere and re-read every 15 s while incomplete.
        overview.isOnOverview = { [weak self] in
            guard let self else { return false }
            return tab == .overview && path(.overview).isEmpty
        }
        overview.openPath = { [weak self] in self?.open(path: $0) }
        // SHELL-058/059: visit heartbeat and the «Dall'ultima visita» toast.
        Task { [weak self] in
            await self?.showWelcome()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Double(WelcomeText.heartbeatSeconds)))
                guard let self else { return }
                if foreground { await heartbeat() }
            }
        }
        Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Double(StartChecklist.pollSeconds)))
                guard let self else { return }
                if foreground, StartChecklist.shouldPoll(overview.start) { await overview.refreshStart() }
            }
        }
        Task { await overview.refreshStart() }
        imports.start()
    }

    func setForeground(_ value: Bool) {
        foreground = value
        imports.setForeground(value)
        if value {
            Task { await overview.refreshStart() }
            Task { await heartbeat() }
        }
    }

    /// SHELL-058: best effort; a heartbeat that starts a new visit reads the summary again.
    private func heartbeat() async {
        let now = Date()
        guard now.timeIntervalSince(lastHeartbeat) >= WelcomeText.throttle else { return }
        lastHeartbeat = now
        guard let result = try? await env.welcome.heartbeat() else { return }
        if result.newVisit { await showWelcome() }
    }

    /// SHELL-059: one toast per visit with what happened and what waits, then marked shown (best effort).
    private func showWelcome() async {
        // `GET /api/welcome` records the visit itself, so it counts as the first heartbeat.
        lastHeartbeat = Date()
        guard let summary = (try? await env.welcome.summary())?.summary, summary.since != welcomeShownSince else { return }
        welcomeShownSince = summary.since
        let locale = LocalizedStrings.shared.language.bbLocale
        guard let content = WelcomeText.content(summary, tr: { L10n.lookup(italian: $0, $1) },
                                                join: { BBFormat.formatList($0, locale: locale) }) else { return }
        env.toasts.show(.info, content.lines.joined(separator: "\n"), actionLabel: content.actionLabel,
                        onAction: { [weak self] in self?.open(path: content.actionPath) }, duration: WelcomeText.toastSeconds)
        try? await env.welcome.markShown()
    }

    /// A file or link from outside (share sheet, «Apri in», email link). Files go to the broker wizard when they look
    /// like a supported broker export, else to the personal import form (mobile note).
    func receive(_ item: IncomingItem, locale: BBLocale) {
        switch item {
        case .link(let path):
            open(path: path)
        case .files(let files):
            guard let first = files.first else { return }
            let text = PersonalImportRules.fileKind(first.name) == .xlsx ? ((try? ImportXlsx.csv(first.data)) ?? "")
                : PersonalImportRules.decodeText(first.data)
            if files.count > 1 || ImportProviders.detect(text) != nil {
                open(.investments)
                brokerImport.present(files: files)
            } else {
                open(.imports)
                imports.receiveShared(first, locale: locale)
            }
        }
    }

    /// IMP-060 / INV-101: data changed outside the visible screen (an import finished): screens reload.
    func dataChanged() {
        dataVersion += 1
        insights.invalidate()
        // An import, sync or edit can tick a first step (OV-038) and move the net-worth history (OV-044).
        Task { await overview.refreshStart() }
        Task { await overview.loadOverview(force: true) }
    }

    /// SHELL-015: the indicator moves immediately; tapping the active tab again pops it to its root.
    func select(_ next: AppTab) {
        if next != tab, tab == .investments { investments.leaveSection() }
        if next != tab, tab == .overview { overview.leftOverview() }
        if next == tab {
            paths[next] = []
        } else {
            tab = next
        }
    }

    /// Opens a destination in its tab (SHELL-007/010: unavailable paths show the country-unavailable screen).
    func open(_ destination: AppDestination) {
        guard destination.isAvailable(in: sections) else {
            tab = .more
            paths[.more] = [.destination(.countryUnavailable)]
            return
        }
        tab = destination.tab
        if let segment = LiquiditySegment(destination: destination) {
            liquiditySegment = segment
            paths[.liquidity] = []
        } else if destination == destination.tab.root {
            paths[destination.tab] = []
        } else {
            paths[destination.tab] = [.destination(destination)]
        }
    }

    /// Pushes onto the current tab (from «Altro», Settings, feature screens).
    func push(_ route: ShellRoute) {
        paths[tab, default: []].append(route)
    }

    func back() {
        guard !(paths[tab] ?? []).isEmpty else { return }
        paths[tab]?.removeLast()
    }

    /// Deep link `/impostazioni?sezione=notifiche` and other in-app paths (SET-003).
    func open(path: String) {
        if path == "/altro" {
            tab = .more
            paths[.more] = []
            return
        }
        guard let destination = AppDestination(path: path) else { return }
        if destination == .help {
            helpLaunch = HelpLaunch(path: path)
            open(.help)
            return
        }
        if destination == .investments {
            if investments.countryContent.blocksPath(path) {
                tab = .more
                paths[.more] = [.destination(.countryUnavailable)]
                return
            }
            open(.investments)
            if let id = InvestmentsTab.instrumentId(path: path) {
                push(.instrument(id))
            } else if let investmentsTab = InvestmentsTab(path: path) {
                investments.select(investmentsTab)
            }
            return
        }
        if destination == .debts {
            open(.debts)
            // DEBT-038: the legacy simulator opens the loan detail too.
            if let id = DebtsRoutes.detailId(path: path) {
                debts.select(id.isEmpty ? nil : id)
                push(.debt(id))
            }
            return
        }
        if destination == .analytics {
            openAnalytics(path: path)
            return
        }
        if destination == .imports {
            open(.imports)
            imports.open(jobId: ImportsRoutes.jobId(path: path))
            return
        }
        if destination == .pension {
            open(.pension)
            if let tab = PensionTab(path: path) { pension.select(tab) }
            return
        }
        let intent = AccountsLaunchIntent(path: path)
        open(intent == nil ? destination : .accounts)
        if let intent { accountsIntent = intent }
        if destination == .settings, let group = SettingsGroup.from(deepLink: path) {
            push(.settingsGroup(group))
        }
    }

    /// `/analitiche[?traguardo=1]`, legacy sub-routes (ANA-035), `/analitiche/obiettivi[?nuovo=1&tipo=…]` and
    /// `/analitiche/obiettivi/{id}` (GOAL-001, GOAL-003).
    private func openAnalytics(path: String) {
        open(.analytics)
        guard sections.analytics else { return }
        if let intent = GoalsLaunchIntent(path: path) {
            analytics.tab = .obiettivi
            Task { await analytics.loadGoals() }
            switch intent {
            case .new(let kind): analytics.openGoalForm(GoalFormRequest(presetKind: kind))
            case .detail(let id): push(.goal(id))
            case .list: break
            }
            return
        }
        analytics.tab = .risposte
        if let question = AnalyticsQuestion(path: path) { analytics.select(question) }
        // ANA-007: «Fissa il tuo traguardo» opens the dialog once, without the walkthrough on top.
        if path.contains("traguardo=1") {
            analytics.fromGoalLink = true
            analytics.targetDialogOpen = true
        }
    }

    func takeHelpLaunch() -> HelpLaunch? {
        defer { helpLaunch = nil }
        return helpLaunch
    }

    /// Logical web path of the visible screen, the context of a report (16-help-support mobile note) and the area of a
    /// crash report (SUP-024). Ids stay in the path like on the web; queries never do.
    var currentPath: String {
        switch path(tab).last {
        case .destination(let destination): return destination.rawValue
        case .settingsGroup: return AppDestination.settings.rawValue
        case .instrument(let id): return "/investimenti/titoli/\(id)"
        case .debt: return "/debiti/finanziamenti"
        case .goal(let id): return "/analitiche/obiettivi/\(id)"
        case nil:
            switch tab {
            case .overview: return AppDestination.overview.rawValue
            case .liquidity: return liquiditySegment.destination.rawValue
            case .investments: return investments.state.tab.rawValue
            case .debts: return AppDestination.debts.rawValue
            case .more: return "/altro"
            }
        }
    }
}
