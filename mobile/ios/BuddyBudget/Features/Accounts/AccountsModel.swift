import BuddyBudgetKit
import Foundation
import Observation

/// Translates an `AccountsText` (Italian source + values; nested lists translated and joined with ", ").
func accountsText(_ text: AccountsText) -> String {
    var values = text.values
    for (key, list) in text.lists { values[key] = list.map(accountsText).joined(separator: ", ") }
    return L10n.lookup(italian: text.source, values)
}

/// State of Liquidità · Conti (ACC-001…010, 032…051): accounts, background jobs and their 1 s polling, the open sheet
/// and the «Conti trovati» step. Same fields as `AccountsModel` on Android.
@MainActor @Observable
final class AccountsModel {
    private(set) var accounts: Loadable<[Account]> = .loading
    private(set) var jobs: [SyncJob] = []
    private(set) var capacity: BankCapacity?
    /// Accounts whose «Sincronizza ora» request is in flight.
    private(set) var syncStarting: Set<String> = []
    /// Account shown in the detail sheet.
    var detailId: String?
    /// New-account sheet (nil = closed).
    var newAccount: NewAccountModel?
    /// «Conti trovati» after the bank consent (nil = the list).
    var found: FoundAccountsModel?

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored weak var shell: ShellModel?
    @ObservationIgnored private var poller: Task<Void, Never>?
    @ObservationIgnored private var running: Set<String> = []

    init(env: AppEnvironment) {
        self.env = env
    }

    var list: [Account] { accounts.value ?? [] }
    var groups: [AccountGroup] { AccountGrouping.group(list) }
    var alerts: [RenewalAlert] { RenewalAlerts.build(list) }
    var detail: Account? { detailId.flatMap { id in list.first { $0.id == id } } }
    var currency: String { env.session.currency }

    // MARK: Loading

    func start() async {
        async let a: Void = refresh()
        async let j: Void = loadJobs()
        async let c: Void = loadCapacity()
        _ = await (a, j, c)
    }

    func stop() {
        poller?.cancel()
        poller = nil
    }

    func refresh() async {
        if accounts.value == nil { accounts = .loading }
        do {
            accounts = .loaded(try await env.accounts.list(today: CalendarDate.of(Date(), in: .current)))
        } catch {
            if accounts.value == nil { accounts = .failed }
        }
    }

    func retry() async {
        accounts = .loading
        await refresh()
    }

    func loadCapacity() async {
        capacity = try? await env.goCardless.capacity()
    }

    /// ACC-046: fetch the jobs and poll every second while one runs.
    func loadJobs() async {
        guard let next = try? await env.syncJobs.list() else { return }
        apply(jobs: next)
        if SyncJobs.shouldPoll(next) { startPolling() }
    }

    private func apply(jobs next: [SyncJob]) {
        let finished = SyncJobs.finishedSince(previous: running, current: next)
        running = SyncJobs.runningIds(next)
        jobs = next
        shell?.syncRunning = !running.isEmpty
        if finished {
            // ACC-051: refresh what the job changed; the history charts reload too (OV-044, TX-076).
            shell?.markHistoryPending()
            shell?.dataChanged()
            Task { await refresh() }
        }
    }

    private func startPolling() {
        guard poller == nil else { return }
        poller = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(SyncJobs.pollInterval))
                guard let self, !Task.isCancelled else { return }
                if let next = try? await self.env.syncJobs.list() { self.apply(jobs: next) }
                if !SyncJobs.shouldPoll(self.jobs) { break }
            }
            self?.poller = nil
        }
    }

    func isSyncing(_ account: Account) -> Bool { SyncJobs.isSyncing(jobs, accountId: account.id) }

    func status(_ account: Account) -> AccountStatusLine { AccountRowStatus.resolve(account, syncing: isSyncing(account)) }

    // MARK: Navigation

    /// ACC-009 / ACC-010: consume the deep-link intent once.
    func consume(_ intent: AccountsLaunchIntent?) {
        guard let intent else { return }
        shell?.accountsIntent = nil
        switch intent {
        case .newAccount: openNewAccount(renew: false)
        case .renew: openNewAccount(renew: true)
        }
    }

    func openNewAccount(renew: Bool) {
        detailId = nil
        let model = NewAccountModel(env: env, renew: renew, capacity: capacity)
        model.onCreated = { [weak self] in
            self?.newAccount = nil
            Task { await self?.refresh() }
        }
        model.onLinked = { [weak self] connectionId, accounts in
            guard let self else { return }
            newAccount = nil
            found = FoundAccountsModel(env: env, connectionId: connectionId, accounts: accounts)
        }
        model.onNavigate = { [weak self] path in
            self?.newAccount = nil
            self?.navigate(path)
        }
        newAccount = model
    }

    /// In-app path; destinations not built yet (imports, categorize) say so.
    func navigate(_ path: String) {
        if AppDestination(path: path) == nil {
            env.toasts.show(.info, L10n.comingSoon)
            return
        }
        shell?.open(path: path)
    }

    func showMovements(_ account: Account) {
        detailId = nil
        navigate(AccountsPaths.movements(accountId: account.id))
    }

    func finishFound(started: Bool) {
        found = nil
        Task {
            await refresh()
            if started { await loadJobs() }
        }
    }

    // MARK: Edits

    /// ACC-032…035: optimistic local update, rolled back with a toast on failure.
    func update(_ account: Account, _ patch: AccountPatch?) {
        guard let patch, case .loaded(var items) = accounts, let index = items.firstIndex(where: { $0.id == account.id }) else { return }
        let previous = items[index]
        items[index] = AccountEdits.apply(patch, to: previous)
        accounts = .loaded(items)
        Task {
            do {
                _ = try await env.accounts.update(id: account.id, patch)
            } catch {
                if case .loaded(var current) = accounts, let i = current.firstIndex(where: { $0.id == account.id }) {
                    current[i] = previous
                    accounts = .loaded(current)
                }
                env.toasts.show(.error, message(error))
            }
        }
    }

    /// ACC-040…042: after the confirmation; the sheet closes optimistically.
    func remove(_ account: Account) {
        detailId = nil
        if case .loaded(let items) = accounts { accounts = .loaded(items.filter { $0.id != account.id }) }
        Task {
            do {
                try await env.accounts.delete(id: account.id)
            } catch {
                env.toasts.show(.error, message(error))
            }
            await refresh()
            await loadCapacity()
        }
    }

    /// ACC-043 / ACC-044.
    func sync(_ account: Account) {
        guard !syncStarting.contains(account.id) else { return }
        syncStarting.insert(account.id)
        Task {
            defer { syncStarting.remove(account.id) }
            do {
                _ = try await env.goCardless.syncAccount(id: account.id)
                await loadJobs()
            } catch {
                let status = (error as? APIError)?.status
                let text = SyncStartError.message(status: status, nextEligibleAt: account.health?.nextEligibleAt,
                                                  locale: LocalizedStrings.shared.language.bbLocale, timeZone: .current)
                env.toasts.showError(accountsText(text), area: .syncBanca)
                if status == 409 { await loadJobs() }
            }
        }
    }

    /// ACC-049.
    func dismiss(_ job: SyncJob) {
        jobs.removeAll { $0.id == job.id }
        Task { try? await env.syncJobs.dismiss(id: job.id) }
    }

    func message(_ error: Error) -> String {
        guard let api = error as? APIError else { return L10n.genericError }
        if api.isTransport { return L10n.connectionFailedCheckYourNetworkAnd }
        if let text = api.body?.message, let status = api.status, (400..<600).contains(status) { return text }
        return L10n.genericError
    }

    // MARK: Debug fixtures (screenshots only)

    #if DEBUG
    func debugApply(jobs next: [SyncJob]) { jobs = next }
    #endif
}

/// The «Nuovo conto» sheet (ACC-011…022, 029…031): choice, bank picker with the native consent, manual form.
@MainActor @Observable
final class NewAccountModel {
    enum Step: Equatable { case choice, bank, manual }

    let renew: Bool
    var step: Step
    private(set) var capacity: BankCapacity?

    // Bank
    var country: String
    var search = ""
    private(set) var institutions: Loadable<[Institution]> = .loading
    private(set) var chosen: Institution?
    private(set) var linkError: String?

    // Manual
    var manualStep = 0
    var draft = ManualAccountDraft()
    var errors = ManualAccountErrors()
    private(set) var creating = false
    private(set) var createError: String?

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored var onCreated: () -> Void = {}
    @ObservationIgnored var onLinked: (String, ConnectionAccounts) -> Void = { _, _ in }
    @ObservationIgnored var onNavigate: (String) -> Void = { _ in }
    @ObservationIgnored private var institutionsTask: Task<Void, Never>?

    init(env: AppEnvironment, renew: Bool, capacity: BankCapacity?) {
        self.env = env
        self.renew = renew
        self.capacity = capacity
        step = renew ? .bank : .choice
        country = BankCountries.defaultCode(productCountry: env.session.country)
    }

    var unavailable: BankUnavailableCopy? { renew ? nil : BankCapacityCopy.unavailable(capacity) }
    var busy: Bool { chosen != nil }
    var filtered: [Institution] { InstitutionSearch.filter(institutions.value ?? [], query: search) }

    /// ACC-012: capacity is checked when the sheet opens (not in renewal mode, ACC-014).
    func start() async {
        if !renew { capacity = (try? await env.goCardless.capacity()) ?? capacity }
        if step == .bank, institutions.value == nil, !debugFrozen { loadInstitutions() }
    }

    func choose(_ next: Step) {
        step = next
        if next == .bank, institutions.value == nil { loadInstitutions() }
        if next == .manual { manualStep = 0; errors = ManualAccountErrors() }
    }

    // MARK: Bank

    func setCountry(_ code: String) {
        guard code != country else { return }
        country = code
        search = ""
        loadInstitutions()
    }

    func loadInstitutions() {
        institutionsTask?.cancel()
        institutions = .loading
        let code = country
        institutionsTask = Task {
            do {
                let list = try await env.goCardless.institutions(country: code)
                guard !Task.isCancelled, code == country else { return }
                institutions = .loaded(list)
            } catch {
                guard !Task.isCancelled, code == country else { return }
                institutions = .failed
            }
        }
    }

    /// ACC-021 / ACC-022 and the R6 return: start → auth browser → complete → «Conti trovati».
    func select(_ institution: Institution) async {
        guard chosen == nil else { return }
        linkError = nil
        chosen = institution
        do {
            let start = try await env.goCardless.startConnection(institution)
            guard let url = URL(string: start.link) else { throw APIError.decoding("link") }
            let callback = await BankBrowser.shared.authenticate(url)
            let outcome = callback.flatMap(BankLinkReturn.parse)
            guard let connectionId = outcome?.ref ?? start.connectionId else {
                return fail(BankLinkMessages.notFound)
            }
            if outcome?.status == .invalidRef { return fail(BankLinkMessages.notFound) }
            if outcome?.status == .cancelled {
                chosen = nil
                env.toasts.show(.info, L10n.lookup(italian: BankLinkMessages.cancelled))
                return
            }
            await complete(connectionId: connectionId, closedEarly: outcome == nil)
        } catch {
            fail(nil, error: error)
        }
    }

    private func complete(connectionId: String, closedEarly: Bool) async {
        do {
            let done = try await env.goCardless.complete(connectionId: connectionId)
            chosen = nil
            onLinked(connectionId, done.accounts)
        } catch {
            let api = error as? APIError
            if closedEarly, api?.status == 409 {
                // The browser was closed before the bank answered: nothing to complete yet.
                chosen = nil
                env.toasts.show(.info, L10n.lookup(italian: BankLinkMessages.cancelled))
                return
            }
            if api?.isTransport == true { return fail(nil, error: error) }
            fail(BankLinkMessages.completeError(status: api?.status, serverMessage: api?.body?.message))
        }
    }

    private func fail(_ source: String?, error: Error? = nil) {
        chosen = nil
        if let source {
            linkError = L10n.lookup(italian: source)
        } else if let api = error as? APIError {
            if api.isTransport { linkError = L10n.connectionFailedCheckYourNetworkAnd }
            else { linkError = api.body?.message ?? L10n.lookup(italian: "Impossibile avviare il collegamento con la banca") }
        } else {
            linkError = L10n.genericError
        }
    }

    // MARK: Manual

    func next() {
        errors = draft.validateNameAndType()
        if errors.isEmpty { manualStep = 1 }
    }

    func back() {
        errors = ManualAccountErrors()
        createError = nil
        if manualStep == 0 { step = .choice } else { manualStep = 0 }
    }

    /// ACC-030 / ACC-031.
    func create() async {
        errors = draft.validateBalance()
        guard errors.isEmpty, let request = draft.request(), !creating else { return }
        creating = true
        createError = nil
        defer { creating = false }
        do {
            _ = try await env.accounts.create(request)
            onCreated()
        } catch {
            if let api = error as? APIError, api.isTransport { createError = L10n.connectionFailedCheckYourNetworkAnd }
            else { createError = (error as? APIError)?.body?.message ?? L10n.genericError }
        }
    }

    /// DEBUG fixtures must not be replaced by a real load.
    @ObservationIgnored private var debugFrozen = false

    #if DEBUG
    func debugSet(institutions list: [Institution]?, error: String? = nil) {
        debugFrozen = true
        institutionsTask?.cancel()
        institutions = list.map { .loaded($0) } ?? .failed
        linkError = error
    }
    #endif
}

/// «Conti trovati» (ACC-023…028): pick the shared accounts and how to import them.
@MainActor @Observable
final class FoundAccountsModel {
    let connectionId: String
    private(set) var accounts: Loadable<ConnectionAccounts>
    var selected: Set<String> = []
    /// External account id → existing linked account to re-link to (absent = new account).
    var targets: [String: String] = [:]
    private(set) var error: String?
    private(set) var finalizing = false

    @ObservationIgnored let env: AppEnvironment

    init(env: AppEnvironment, connectionId: String, accounts: ConnectionAccounts?) {
        self.env = env
        self.connectionId = connectionId
        self.accounts = accounts.map { .loaded($0) } ?? .loading
    }

    func load() async {
        guard accounts.value == nil else { return }
        accounts = .loading
        do { accounts = .loaded(try await env.goCardless.connectionAccounts(connectionId: connectionId)) } catch { accounts = .failed }
    }

    func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
        error = nil
    }

    /// ACC-025 / ACC-026: true when the import started.
    func confirm() async -> Bool {
        guard let data = accounts.value, !finalizing else { return false }
        let selections = FoundAccounts.selections(data.externalAccounts, selected: selected, targets: targets)
        guard !selections.isEmpty else {
            error = L10n.lookup(italian: FoundAccounts.emptySelectionError)
            return false
        }
        finalizing = true
        error = nil
        defer { finalizing = false }
        do {
            _ = try await env.goCardless.finalize(connectionId: connectionId, selections: selections)
            return true
        } catch {
            let api = error as? APIError
            self.error = api?.isTransport == true ? L10n.connectionFailedCheckYourNetworkAnd
                : (api?.body?.message.map { L10n.lookup(italian: $0) } ?? L10n.genericError)
            return false
        }
    }
}
