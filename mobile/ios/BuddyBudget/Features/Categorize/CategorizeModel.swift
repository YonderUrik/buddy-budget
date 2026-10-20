import BuddyBudgetKit
import Foundation
import Observation

enum CategorizeTab: Hashable { case toReview, auto }

/// State of /categorizza (CAT-036…089): the «Da decidere» deck with batched saves, «Messe dall'app», auto-apply,
/// AI generation polling and Ricategorizza. Same fields as `CategorizeModel` on Android.
@MainActor @Observable
final class CategorizeModel {
    private(set) var tab: CategorizeTab = .toReview
    @ObservationIgnored private var userChoseTab = false

    private(set) var suggestionsState: FeedState = .loading
    private(set) var deck = CategorizeDeck(groups: [])
    private(set) var autoApplyEnabled = true
    private(set) var auto: Loadable<AutoCategorizedResponse> = .loading
    private(set) var categories: [MovementCategory] = []
    private(set) var usage: [String: Int] = [:]
    private(set) var ai: AiCategorizationState?
    /// The «Usa sempre questa categoria» checkbox of the active card (never on by default, CAT-063).
    var remember = false
    /// Groups of «Messe dall'app» being changed (row disabled).
    private(set) var changingAuto: Set<String> = []
    var remoteLogoShown = false

    // AI generation (CAT-048…053)
    private(set) var generating = false
    private(set) var generationTotal = 0
    private(set) var generationDone = 0
    private(set) var generationFinished = false

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored var onChanged: (() async -> Void)?
    /// CAT-097: opens a movement's detail (set by the screen to the shell's sheet).
    @ObservationIgnored var openMovement: (String) -> Void = { _ in }
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var pollTask: Task<Void, Never>?

    init(env: AppEnvironment) {
        self.env = env
    }

    var today: CalendarDate { LiquidityModel.today }
    func category(_ id: String?) -> MovementCategory? { categories.first { $0.id == id } }

    // MARK: Loading

    func load() async {
        async let meta: Void = loadMeta()
        async let suggestions: Void = loadSuggestions()
        async let autoList: Void = loadAuto()
        _ = await (meta, suggestions, autoList)
    }

    private func loadMeta() async {
        async let cats = try? env.categoriesAPI.list()
        async let use = try? env.categoriesAPI.usage()
        async let state = try? env.user.aiCategorization()
        let (c, u, a) = await (cats, use, state)
        if let c { categories = c }
        if let u { usage = u }
        ai = a
    }

    /// CAT-040…042: ready groups are hidden and auto-applied once per load.
    func loadSuggestions() async {
        do {
            let response = try await env.transactions.suggestions()
            autoApplyEnabled = response.autoApply.enabled
            let ready = Set(response.autoApply.readyKeys)
            var next = CategorizeDeck(groups: response.groups)
            next.remove(keys: ready)
            deck = next
            suggestionsState = .loaded
            if !ready.isEmpty {
                let readyGroups = response.groups.filter { ready.contains($0.groupKey) }
                Task { await autoApply(restoring: readyGroups) }
            }
        } catch {
            if suggestionsState != .loaded { suggestionsState = .failed }
        }
    }

    private func autoApply(restoring readyGroups: [SuggestionGroup]) async {
        do {
            let result = try await env.transactions.categorizeAuto()
            if result.applied > 0 {
                let message = result.applied == 1 ? L10n.s1TransactionCategorizedAutomatically
                    : L10n.s0TransactionsCategorizedAutomatically(String(result.applied))
                env.toasts.show(.success, "\(message) \(L10n.findThemUnderAssignedByTheApp_44a35c)", actionLabel: L10n.view) { [weak self] in
                    self?.select(.auto)
                }
                await loadAuto()
                await onChanged?()
            }
        } catch {
            deck.restore(readyGroups)
        }
    }

    func loadAuto() async {
        do {
            auto = .loaded(try await env.transactions.autoCategorized())
        } catch {
            if auto.value == nil { auto = .failed }
        }
    }

    func select(_ next: CategorizeTab) {
        userChoseTab = true
        tab = next
    }

    // MARK: Deck (CAT-058…068)

    func confirm() {
        guard deck.confirm(remember: remember) else { return }
        decided()
    }

    func choose(_ category: MovementCategory) {
        deck.choose(categoryId: category.id, remember: remember)
        decided()
    }

    func skip() {
        deck.skip()
        remember = false
    }

    func undo() {
        if let decision = deck.undo() { remember = decision.remember }
        scheduleSave()
    }

    private func decided() {
        remember = false
        scheduleSave()
    }

    /// CAT-064: saved together 5 s after the last decision.
    private func scheduleSave() {
        saveTask?.cancel()
        guard deck.canUndo else { return }
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    /// Saves every pending decision now (5 s idle, leaving the screen, app in background).
    func flush() async {
        saveTask?.cancel()
        guard let batch = deck.beginSave() else { return }
        do {
            for chunk in stride(from: 0, to: batch.count, by: 25).map({ Array(batch[$0..<min($0 + 25, batch.count)]) }) {
                _ = try await env.transactions.categorizeApply(chunk.map(\.applyGroup))
            }
            deck.finishSave(batch)
            await loadAuto()
            await onChanged?()
        } catch {
            deck.failSave(batch)
            env.toasts.showError((error as? APIError)?.body?.message ?? L10n.saveFailedTryAgain, area: .movimento)
        }
    }

    // MARK: Auto-apply option (CAT-045)

    func enableAutoApply() async {
        do {
            ai = try await env.user.updateAiCategorization(AiCategorizationPatch(autoApply: true))
            autoApplyEnabled = true
            await loadSuggestions()
        } catch {
            env.toasts.showError(L10n.genericError, area: .salvataggio)
        }
    }

    // MARK: «Messe dall'app» (CAT-077…080, CAT-082: a 30-day history, nothing to confirm)

    func changeAuto(_ group: AutoCategorizedGroup, to category: MovementCategory, remember: Bool) async {
        changingAuto.insert(group.groupKey)
        defer { changingAuto.remove(group.groupKey) }
        do {
            _ = try await env.transactions.categorizeApply([CategorizeApplyGroup(transactionIds: group.transactionIds, categoryId: category.id,
                                                                                  excludedPercentage: 0, createRule: remember,
                                                                                  merchantKey: group.merchantKey)])
            env.toasts.show(.success, remember ? L10n.categoryChangedIncludingForFutureTr : L10n.categoryChanged)
            await loadAuto()
            await onChanged?()
        } catch {
            env.toasts.showError((error as? APIError)?.body?.message ?? L10n.saveFailedTryAgain, area: .movimento)
        }
    }

    // MARK: AI (CAT-048…053)

    var aiAvailable: Bool { ai?.available ?? false }
    var aiConsented: Bool { ai?.enabled ?? false }

    /// CAT-048: available, on «Da decidere», something to decide, and groups without proposal or a run in progress/done.
    var showsAI: Bool {
        aiAvailable && tab == .toReview && !deck.isEmpty && (deck.withoutProposal > 0 || generating || generationFinished)
    }

    /// CAT-050: records the consent, then starts.
    func consentAndGenerate() async {
        do {
            ai = try await env.user.updateAiCategorization(AiCategorizationPatch(enabled: true))
        } catch {
            env.toasts.show(.error, L10n.theAssistantIsUnavailable)
            return
        }
        await generate()
    }

    /// CAT-051…053: start, then poll every 4 s.
    func generate() async {
        guard !generating else { return }
        do {
            let status = try await env.transactions.generateSuggestions()
            guard status == "started" else {
                env.toasts.show(.error, L10n.theAssistantIsUnavailable)
                return
            }
        } catch {
            env.toasts.show(.error, L10n.theAssistantIsUnavailable)
            return
        }
        generating = true
        generationFinished = false
        generationTotal = deck.withoutProposal
        generationDone = 0
        pollTask?.cancel()
        pollTask = Task { [weak self] in await self?.poll() }
    }

    private func poll() async {
        var unchanged = 0
        var lastDone = 0
        for _ in 0..<60 {
            try? await Task.sleep(for: .seconds(4))
            if Task.isCancelled { return }
            guard let response = try? await env.transactions.suggestions() else { continue }
            deck.refresh(with: response.groups.filter { !Set(response.autoApply.readyKeys).contains($0.groupKey) })
            let missing = deck.withoutProposal
            generationDone = max(0, generationTotal - missing)
            if generationDone == lastDone { unchanged += 1 } else { unchanged = 0 }
            lastDone = generationDone
            if missing == 0 || (generationDone > 0 && unchanged >= 8) { break }
        }
        generating = false
        generationFinished = true
        let done = generationDone
        env.toasts.show(.success, done == 1 ? L10n.s1MerchantHasASuggestion : L10n.s0MerchantsHaveSuggestions(String(done)))
        await loadSuggestions()
    }

    func stop() {
        pollTask?.cancel()
    }
}
