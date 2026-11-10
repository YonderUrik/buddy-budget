import BuddyBudgetKit
import Foundation
import Observation

/// State and actions of Liquidità · Abbonamenti (SUB-001…026). Logic lives in BuddyBudgetKit (`SubscriptionsView`,
/// `SubscriptionForm`, `SubscriptionsUiState`); this model only sequences API calls. Same fields as
/// `SubscriptionsModel` on Android.
@MainActor @Observable
final class SubscriptionsModel {
    private(set) var state = SubscriptionsUiState()
    private(set) var categories: [SubscriptionCategory] = []
    /// A remote merchant logo rendered: show the Logo.dev credit.
    var logosShown = false
    /// Archive disclosures, collapsed by default (SUB-012).
    var endedExpanded = false
    var excludedExpanded = false
    #if DEBUG
    /// DEBUG-only (`-BBSubscriptions bottom`): scroll the list to its end for screenshots.
    var debugScrollToBottom = false
    #endif

    /// Detail (SUB-016…022).
    var detailOpen = false
    private(set) var openedKey: String?
    var detailError: String?
    private(set) var detailBusy = false

    /// Add (SUB-023…025).
    var addOpen = false
    var addError: String?
    private(set) var addBusy = false

    @ObservationIgnored private let api: SubscriptionsAPI
    @ObservationIgnored private let toasts: ToastCenter
    @ObservationIgnored private var started = false

    init(api: SubscriptionsAPI, toasts: ToastCenter) {
        self.api = api
        self.toasts = toasts
    }

    /// The opened item, as of the last fetch.
    var openedItem: SubscriptionItem? { openedKey.flatMap { state.item(key: $0) } }

    func start() async {
        guard !started else { return }
        started = true
        async let list: Void = load()
        async let picker: Void = loadCategories()
        _ = await (list, picker)
    }

    /// SUB-001: one call; keeps the previous data when a refresh fails.
    func load() async {
        if state.response == nil { state.phase = .loading }
        do {
            state.response = try await api.list()
            state.phase = .loaded
        } catch {
            if state.response == nil { state.phase = .failed }
        }
    }

    func retry() async {
        state.phase = .loading
        await load()
    }

    private func loadCategories() async {
        categories = (try? await api.expenseCategories()) ?? []
    }

    // MARK: Quick actions (SUB-008, SUB-010, SUB-013, SUB-015)

    func quick(_ item: SubscriptionItem, _ status: SubscriptionStatus) {
        guard !state.isSaving else { return }
        switch SubscriptionsView.quickAction(item, status: status) {
        case .openDetail:
            open(item)
        case .save(let input):
            state.isSaving = true
            Task {
                do {
                    try await api.decide(input)
                    await load()
                } catch {
                    toasts.show(.error, message(error, fallback: "Impossibile salvare l'abbonamento"))
                }
                state.isSaving = false
            }
        }
    }

    // MARK: Detail

    func open(_ item: SubscriptionItem) {
        openedKey = item.key
        detailError = nil
        detailOpen = true
    }

    /// SUB-017/018: PATCH a saved choice, else POST `rilevato`; closes and refetches on success.
    func decide(_ item: SubscriptionItem, _ status: SubscriptionStatus) async {
        detailError = nil
        let route = SubscriptionsView.decisionRoute(item, status: status)
        if route == .missingData {
            detailError = L10n.lookup(italian: "Mancano importo e cadenza")
            return
        }
        await runDetail {
            switch route {
            case .patch(let id, let status): try await self.api.update(id: id, SubscriptionPatch(status: status))
            case .post(let input): try await self.api.decide(input)
            case .missingData: break
            }
        }
    }

    /// SUB-019: name and category; manual items also amount, cadence and next date.
    func saveEdits(_ item: SubscriptionItem, name: String, amountText: String, cadence: SubscriptionCadence,
                   nextDate: String, categoryId: String?) async {
        guard let id = item.id else { return }
        detailError = nil
        switch SubscriptionForm.validate(name: name, amountText: amountText, requireAmount: item.isManual) {
        case .invalid(let key):
            detailError = L10n.lookup(italian: key)
        case .valid(let cleanName, let amount):
            var patch = SubscriptionPatch(name: cleanName, categoryId: .some(categoryId))
            if item.isManual {
                patch.amount = amount
                patch.cadence = cadence
                patch.nextDate = nextDate
            }
            await runDetail { try await self.api.update(id: id, patch) }
        }
    }

    private func runDetail(_ call: @escaping () async throws -> Void) async {
        detailBusy = true
        defer { detailBusy = false }
        do {
            try await call()
            detailOpen = false
            await load()
        } catch {
            detailError = message(error, fallback: "Impossibile aggiornare l'abbonamento")
        }
    }

    /// SUB-020/021 + decision 0003: the web removes without confirmation, so the item leaves the list at once and the
    /// DELETE is sent when the 5 s undo toast expires.
    func remove(_ item: SubscriptionItem) {
        guard let id = item.id else { return }
        detailOpen = false
        state.pendingRemovals.insert(id)
        let text = item.isManual ? "Abbonamento eliminato" : "Abbonamento ripristinato com'era"
        toasts.showUndo(L10n.lookup(italian: text),
                        onUndo: { [weak self] in self?.state.pendingRemovals.remove(id) },
                        onCommit: { [self] in Task { await self.commitRemoval(id) } })
    }

    private func commitRemoval(_ id: String) async {
        do {
            try await api.delete(id: id)
        } catch {
            toasts.show(.error, message(error, fallback: "Impossibile rimuovere l'abbonamento"))
        }
        await load()
        state.pendingRemovals.remove(id)
    }

    // MARK: Add (SUB-023, SUB-024)

    func startAdding() {
        addError = nil
        addOpen = true
    }

    func add(name: String, amountText: String, cadence: SubscriptionCadence, nextDate: String, categoryId: String?) async {
        addError = nil
        switch SubscriptionForm.validate(name: name, amountText: amountText, requireAmount: true) {
        case .invalid(let key):
            addError = L10n.lookup(italian: key)
        case .valid(let cleanName, let amount):
            addBusy = true
            defer { addBusy = false }
            do {
                try await api.addManual(ManualSubscriptionInput(name: cleanName, amount: amount ?? 0, cadence: cadence,
                                                                nextDate: nextDate, categoryId: categoryId))
                addOpen = false
                await load()
            } catch {
                addError = message(error, fallback: "Impossibile salvare l'abbonamento")
            }
        }
    }

    /// The server's message (already translated, e.g. the 409 duplicate name), else a generic one.
    private func message(_ error: Error, fallback: String) -> String {
        if let text = (error as? APIError)?.body?.message, !text.isEmpty { return L10n.lookup(italian: text) }
        return L10n.lookup(italian: fallback)
    }
}
