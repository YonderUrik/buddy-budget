import BuddyBudgetKit
import Foundation
import Observation

/// Load state of the feed.
enum FeedState: Equatable {
    case loading, loaded, failed
}

/// State of Liquidità · Movimenti and Analisi (TX-003…061): shared filters, the month view, the paged feed, the
/// period analysis and every movement mutation. One instance per signed-in session (kept by `ShellModel`).
/// Same fields as `LiquidityModel` on Android.
@MainActor @Observable
final class LiquidityModel {
    /// Set by the empty state «Aggiungi un movimento»: the top bar opens the add sheet.
    var addRequested = false

    // Shared filters (TX-003, TX-013…017)
    private(set) var accountId: String?
    private(set) var categoryFilter: MovementCategory?
    var search = ""
    private(set) var type: MovementType = .tutte
    private(set) var uncategorizedOnly = false

    // Analisi period (TX-052)
    private(set) var period: ExpensePeriod = .mese
    private(set) var reference: CalendarDate

    // Data
    private(set) var categories: [MovementCategory] = []
    private(set) var usage: [String: Int] = [:]
    private(set) var accounts: [Account]?
    private(set) var month: Loadable<LiquidityMonth> = .loading
    private(set) var feed = MovementFeed()
    private(set) var feedState: FeedState = .loading
    private(set) var loadingMore = false
    private(set) var analysis: Loadable<LiquidityAnalysis> = .loading
    /// Movements with a save in flight / a failed save (row status line).
    private(set) var savingIds: Set<String> = []
    private(set) var failedIds: Set<String> = []
    /// TX-020: a remote merchant logo was displayed in the feed.
    var remoteLogoShown = false
    // Hero chart (TX-009…011)
    private(set) var heroPeriod: OverviewPeriod = LiquidityHero.defaultPeriod
    private(set) var heroPoints: [LiquidityHeroPoint]?
    @ObservationIgnored private var heroGeneration = 0

    @ObservationIgnored let env: AppEnvironment
    /// Refreshes the «da decidere» badge of the bottom bar after a change (set by the screen).
    /// TX-076: when the month view (hero chart) arrived and whether it is reloading.
    private(set) var monthUpdatedAt = Date.distantPast
    private(set) var fetchingMonth = false
    @ObservationIgnored var onAttentionChanged: (() async -> Void)?
    @ObservationIgnored private var started = false
    @ObservationIgnored private var searchTask: Task<Void, Never>?
    @ObservationIgnored private var feedGeneration = 0
    @ObservationIgnored private var analysisGeneration = 0

    init(env: AppEnvironment) {
        self.env = env
        reference = LiquidityModel.today
    }

    static var today: CalendarDate { CalendarDate.of(Date(), in: .current) }
    var today: CalendarDate { LiquidityModel.today }
    var currency: String { env.session.currency }

    var query: TransactionQuery {
        TransactionQuery(type: type, accountId: accountId, categoryId: categoryFilter?.id, search: search, uncategorized: uncategorizedOnly)
    }

    func category(_ id: String?) -> MovementCategory? {
        guard let id else { return nil }
        return categoryIndex[id]
    }

    private var categoryIndex: [String: MovementCategory] = [:]

    func account(_ id: String?) -> Account? { accounts?.first { $0.id == id } }

    var selectedAccount: Account? { account(accountId) }
    var manualAccounts: [Account] { (accounts ?? []).filter(\.isManual) }
    var uncategorizedCount: Int { month.value?.toFix ?? 0 }

    // MARK: Loading

    /// First open: everything; later opens: refresh (returning from Categorizza or Categorie). Marks movements as
    /// seen every time (TX-004).
    func start() async {
        Task { [env] in
            try? await env.transactions.markSeen()
        }
        if started {
            await refresh()
            return
        }
        started = true
        await refresh()
    }

    func refresh() async {
        async let meta: Void = loadMeta()
        async let monthLoad: Void = loadMonth()
        async let feedLoad: Void = reloadFeed()
        async let heroLoad: Void = loadHero()
        _ = await (meta, monthLoad, feedLoad, heroLoad)
        if analysis.value != nil { await loadAnalysis() }
    }

    func loadMeta() async {
        // Each part is applied as soon as it arrives (the account tiles never wait for the categories).
        async let accountsLoad: Void = loadAccounts()
        async let categoriesLoad: Void = loadCategories()
        async let usageLoad: Void = loadUsage()
        _ = await (accountsLoad, categoriesLoad, usageLoad)
    }

    private func loadAccounts() async {
        if let a = try? await env.accounts.list(today: today) { accounts = a } else if accounts == nil { accounts = [] }
    }

    private func loadCategories() async {
        if let c = try? await env.categoriesAPI.list() { setCategories(c) }
    }

    private func loadUsage() async {
        if let u = try? await env.categoriesAPI.usage() { usage = u }
    }

    private func setCategories(_ list: [MovementCategory]) {
        categories = list
        categoryIndex = Dictionary(list.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    func loadMonth() async {
        fetchingMonth = true
        defer {
            monthUpdatedAt = Date()
            fetchingMonth = false
        }
        do {
            month = .loaded(try await env.liquidityAPI.month(accountId: accountId, today: today))
        } catch {
            if month.value == nil { month = .failed }
        }
    }

    func reloadFeed() async {
        feedGeneration += 1
        let generation = feedGeneration
        if feed.isEmpty { feedState = .loading }
        do {
            let page = try await env.transactions.page(query)
            guard generation == feedGeneration else { return }
            feed.reset(with: page)
            feedState = .loaded
        } catch {
            guard generation == feedGeneration else { return }
            feedState = .failed
        }
    }

    /// TX-019: «Mostra altri movimenti» loads the next server page.
    func loadMore() async {
        guard let cursor = feed.nextCursor, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        let generation = feedGeneration
        if let page = try? await env.transactions.page(query, cursor: cursor), generation == feedGeneration {
            feed.append(page)
        }
    }

    /// TX-011: all accounts = the liquidity class of the server's net-worth series; one account = rebuilt backwards
    /// from its balance and its movements in the period (flat for a manual account).
    func loadHero() async {
        heroGeneration += 1
        let generation = heroGeneration
        let period = heroPeriod
        let todayKey = today.iso
        do {
            let points: [LiquidityHeroPoint]
            if let account = selectedAccount {
                let follows = LiquidityHero.followsTransactions(account)
                var movements: [(date: String, amount: Double)] = []
                if follows {
                    let from = period == .max ? nil : LiquidityHero.periodStart(period, today: today, earliest: nil)
                    var query = TransactionQuery(accountId: account.id, limit: 200)
                    query.from = from
                    var cursor: String?
                    var pages = 0
                    repeat {
                        let page = try await env.transactions.page(query, cursor: cursor)
                        movements += page.items.map { ($0.date, $0.amount) }
                        cursor = page.nextCursor
                        pages += 1
                    } while cursor != nil && pages < Self.heroMaxPages
                }
                let earliest = movements.map(\.date).min()
                let from = LiquidityHero.periodStart(period, today: today, earliest: earliest)
                points = LiquidityHero.accountSeries(balance: account.balance, followsTransactions: follows, movements: movements,
                                                     from: from, today: todayKey)
            } else {
                let view = try await env.overview.view(period: period, includePension: true, today: todayKey)
                points = LiquidityHero.totalSeries(view)
            }
            guard generation == heroGeneration else { return }
            heroPoints = points
        } catch {
            guard generation == heroGeneration else { return }
            if heroPoints == nil { heroPoints = [] }
        }
    }

    /// Pages of 200 movements read for one account's curve (enough for years of a personal account).
    private static let heroMaxPages = 25

    func setHeroPeriod(_ next: OverviewPeriod) {
        guard next != heroPeriod else { return }
        heroPeriod = next
        Task { await loadHero() }
    }

    func loadAnalysis() async {
        analysisGeneration += 1
        let generation = analysisGeneration
        if analysis.value == nil { analysis = .loading }
        do {
            let result = try await env.liquidityAPI.analysis(period: period.rawValue, ref: reference, accountId: accountId, today: today)
            guard generation == analysisGeneration else { return }
            analysis = .loaded(result)
        } catch {
            guard generation == analysisGeneration else { return }
            analysis = .failed
        }
    }

    // MARK: Filters

    func selectAccount(_ id: String?) {
        guard id != accountId else { return }
        accountId = id
        Task {
            async let m: Void = loadMonth()
            async let f: Void = reloadFeed()
            async let h: Void = loadHero()
            _ = await (m, f, h)
        }
        if analysis.value != nil { Task { await loadAnalysis() } }
    }

    func setType(_ next: MovementType) {
        guard next != type else { return }
        type = next
        Task { await reloadFeed() }
    }

    func toggleUncategorized() {
        uncategorizedOnly.toggle()
        Task { await reloadFeed() }
    }

    func setCategoryFilter(_ category: MovementCategory?) {
        categoryFilter = category
        Task { await reloadFeed() }
    }

    /// TX-057: a category tapped in Analisi filters Movimenti.
    func showCategory(id: String, name: String) {
        categoryFilter = category(id) ?? MovementCategory(id: id, name: name, type: .unknown)
        Task { await reloadFeed() }
    }

    /// Search with a short debounce (the server filters, TX-014).
    func searchChanged() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await reloadFeed()
        }
    }

    // MARK: Analisi period (TX-052)

    var periodRange: DateRange { Periods.getPeriodRange(period, reference) }
    var canGoForward: Bool { !(periodRange.from <= today && today <= periodRange.to) && periodRange.to < today }

    func setPeriod(_ next: ExpensePeriod) {
        guard next != period else { return }
        period = next
        Task { await loadAnalysis() }
    }

    func shiftPeriod(_ direction: Int) {
        if direction > 0 && !canGoForward { return }
        reference = Periods.shiftReferenceDate(period, reference, direction: direction)
        Task { await loadAnalysis() }
    }

    // MARK: Mutations

    private func apply(_ updated: Movement) {
        feed.replace(updated)
    }

    private func afterMutation() {
        Task {
            await loadMonth()
            if analysis.value != nil { await loadAnalysis() }
        }
        Task { await onAttentionChanged?() }
    }

    @discardableResult
    private func patch(_ movement: Movement, _ body: TransactionPatch) async -> Movement? {
        savingIds.insert(movement.id)
        failedIds.remove(movement.id)
        defer { savingIds.remove(movement.id) }
        do {
            let updated = try await env.transactions.update(id: movement.id, body)
            // The PATCH response has no logoPath: keep the one already shown.
            let merged = updated.with(logoPath: movement.logoPath)
            apply(merged)
            afterMutation()
            return merged
        } catch {
            failedIds.insert(movement.id)
            return nil
        }
    }

    /// TX-030/031: change category, toast with undo, optional merchant rule and its feedback.
    func changeCategory(_ movement: Movement, to category: MovementCategory, remember: Bool) async {
        guard category.id != movement.categoryId else { return }
        let previous = movement.categoryId
        guard let updated = await patch(movement, TransactionPatch(categoryId: category.id)) else {
            env.toasts.showError(L10n.saveFailedTryAgain, area: .movimento)
            return
        }
        if uncategorizedOnly && !category.isFallback { feed.remove(id: updated.id) }
        env.toasts.show(.success, L10n.movedTo0(category.name), actionLabel: L10n.cancel_6c3de5) { [weak self] in
            guard let self, let previous else { return }
            Task {
                let current = self.feed.items.first(where: { $0.id == updated.id }) ?? updated
                await self.patch(current, TransactionPatch(categoryId: previous))
                if self.uncategorizedOnly { await self.reloadFeed() }
            }
        }
        guard remember, !category.isFallback else { return }
        do {
            let result = try await env.rulesAPI.create(RuleCreateBody(matchType: .merchant, pattern: movement.description,
                                                                      categoryId: category.id, replaceExisting: true))
            if result.applied > 0 {
                let others = result.applied
                env.toasts.show(.success, others == 1 ? L10n.alsoPutOneMoreTransactionIn0(category.name)
                    : L10n.alsoPut1MoreTransactionsIn0(category.name, String(others)))
                await reloadFeed()
            }
            RuleFeedback.offerPastMatches(result, env: env) { [weak self] in await self?.refresh() }
        } catch {
            // The category change succeeded; a failed rule is not blocking.
        }
    }

    /// TX-036: `excludedAmount = full − own` (positive).
    func saveSplit(_ movement: Movement, excluded: Double) async -> Bool {
        await patch(movement, TransactionPatch(excludedAmount: excluded)) != nil
    }

    /// TX-038.
    func saveNote(_ movement: Movement, text: String) async -> Bool {
        guard let note = MovementEdit.notePatch(movement, text: text) else { return true }
        return await patch(movement, TransactionPatch(note: note)) != nil
    }

    /// TX-039.
    func saveEdit(_ movement: Movement, _ body: TransactionPatch) async -> Bool {
        guard let updated = await patch(movement, body) else { return false }
        if body.date != nil { await reloadFeed() } else { apply(updated) }
        return true
    }

    /// TX-041 (after the confirmation).
    func delete(_ movement: Movement) async -> Bool {
        do {
            try await env.transactions.delete(id: movement.id)
            feed.remove(id: movement.id)
            afterMutation()
            return true
        } catch {
            env.toasts.show(.error, (error as? APIError)?.body?.message ?? L10n.genericError)
            return false
        }
    }

    /// TX-042…048: returns the server error message on failure (e.g. demo data, 409).
    func create(_ body: CreateTransactionBody) async -> String? {
        do {
            _ = try await env.transactions.create(body)
            await reloadFeed()
            afterMutation()
            return nil
        } catch {
            return (error as? APIError)?.body?.message ?? L10n.genericError
        }
    }
}

/// Rule feedback shared by Movimenti «Ricordala» and the Regole screen (TX-031, CAT-034/035).
@MainActor
enum RuleFeedback {
    /// CAT-035: persistent prompt to apply the rule to past movements as well («Cambiali» / «Lasciali così»).
    static func offerPastMatches(_ result: RuleSaveResult, env: AppEnvironment, onChanged: @escaping () async -> Void) {
        guard result.pastMatches > 0 else { return }
        let one = result.pastMatches == 1
        let message = one ? L10n.thisAlsoAppliesToOnePastTransactio : L10n.thisAlsoAppliesTo0PastTransactions(String(result.pastMatches))
        env.toasts.show(.info, message, actionLabel: one ? L10n.changeIt : L10n.changeThem, onAction: {
            Task {
                do {
                    let run = try await env.transactions.recategorize(RecategorizeBody(scope: "regola", ruleId: result.id))
                    RuleFeedback.showRecategorized(run, env: env, onChanged: onChanged)
                    await onChanged()
                } catch {
                    env.toasts.showError(L10n.genericError, area: .movimento)
                }
            }
        }, duration: 600)
    }

    /// CAT-087 result toast (10 s) with «Annulla» (CAT-088).
    static func showRecategorized(_ run: RecategorizeResult, env: AppEnvironment, onChanged: @escaping () async -> Void) {
        guard let runId = run.runId, run.changed > 0 else {
            env.toasts.show(.info, L10n.nothingToChangeTheseTransactionsHav)
            return
        }
        let message = run.changed == 1 ? L10n.oneTransactionChangedCategory : L10n.s0TransactionsChangedCategory(String(run.changed))
        env.toasts.show(.success, message, actionLabel: L10n.cancel_6c3de5, onAction: {
            Task {
                await RuleFeedback.undo(runId: runId, env: env)
                await onChanged()
            }
        }, duration: 10)
    }

    static func undo(runId: String, env: AppEnvironment) async {
        do {
            let restored = try await env.transactions.undoRecategorize(runId: runId)
            switch restored {
            case 0: env.toasts.show(.info, L10n.noTransactionsToUndoYouHaveAlready)
            case 1: env.toasts.show(.success, L10n.oneTransactionWasRestored)
            default: env.toasts.show(.success, L10n.s0TransactionsWereRestored(String(restored)))
            }
        } catch {
            env.toasts.showError((error as? APIError)?.body?.message ?? L10n.thisRecategorisationCanNoLongerBeU, area: .movimento)
        }
    }
}
