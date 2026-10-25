import BuddyBudgetKit
import Foundation
import Observation

/// State of Debiti (10-debts): the one `GET /api/debts?include=insights` response shared by the overview and the loan
/// detail (DEBT-001), the dialogs and every mutation (refetch after each, DEBT-037). Logic lives in BuddyBudgetKit
/// (`DebtsUiState`, `DebtsRules`, `DebtCalc`); this model only sequences API calls. One instance per signed-in
/// session (kept by `ShellModel`). Same fields as `DebtsModel` on Android.
@MainActor @Observable
final class DebtsModel {
    private(set) var state: DebtsUiState
    /// Add-debt flow (DEBT-009…017).
    var addOpen = false
    /// Pay-installment dialog (DEBT-004, DEBT-023): debt id + row.
    var paying: (debtId: String, row: DebtPlanRow)?
    /// Rate change / balance correction (DEBT-025/026).
    var eventKind: DebtEventDialogKind?
    /// Early repayment (DEBT-032…035).
    var earlyOpen = false
    /// Delete confirmation (DEBT-028).
    var confirmDelete = false
    /// Events hidden while their undo toast runs (decision 0003).
    private(set) var pendingEventRemovals: Set<String> = []
    private(set) var bulkBusy = false
    /// DEBT-024: categories of the transaction picker.
    private(set) var categories: [MovementCategory] = []

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var started = false

    init(env: AppEnvironment) {
        self.env = env
        state = DebtsUiState(today: DebtsModel.todayKey)
    }

    /// "Today" of the plans: the UTC date, as the server (api/endpoints/debts.md).
    static var todayKey: String { CalendarDate.of(Date(), in: TimeZone(identifier: "UTC")!).iso }
    var currency: String { env.session.currency }

    func start() async {
        guard !started else { return }
        started = true
        // Unstructured: a view `.task` cancelled by a re-render must not fail the first load.
        await Task { await self.load() }.value
    }

    /// DEBT-001: keeps the previous data when a refresh fails.
    func load() async {
        state.today = Self.todayKey
        if state.data == nil { state.failed = false }
        do {
            state.data = try await env.debts.view()
            state.failed = false
            #if DEBUG
            openDebugDialog()
            #endif
        } catch {
            #if DEBUG
            print("BBDEBUG debts load failed: \(error)")
            #endif
            if state.data == nil { state.failed = true }
        }
    }

    #if DEBUG
    @ObservationIgnored private var debugDialogOpened = false

    /// DEBUG-only `-BBDialog add|pay|rate|balance|early|delete` opens a dialog for screenshots.
    private func openDebugDialog() {
        guard !debugDialogOpened, let name = DebugLaunch.value("-BBDialog") else { return }
        debugDialogOpened = true
        let debt = state.selected
        switch name {
        case "add": addOpen = true
        case "pay": if let debt, let row = debt.plan.rows.first(where: { $0.status != .pagata }) { paying = (debt.id, row) }
        case "rate": eventKind = .rateChange
        case "balance": eventKind = .balanceCorrection
        case "early", "early-filled": earlyOpen = true
        case "delete": confirmDelete = true
        default: break
        }
    }
    #endif

    func retry() async {
        state.failed = false
        await load()
    }

    func select(_ id: String?) { state.selectedId = id }
    func setExitExtra(_ value: Double) { state.exitExtra = value }

    // MARK: Mutations

    private func message(_ error: Error) -> String {
        (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
    }

    /// DEBT-016: creates the debt; returns the server message on failure.
    func create(_ input: DebtCreateInput) async -> String? {
        do {
            try await env.debts.create(input)
            addOpen = false
            env.toasts.show(.success, L10n.lookup(italian: "Debito aggiunto"))
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    /// DEBT-023/025/026/034.
    func addEvent(debtId: String, _ input: DebtEventInput) async -> String? {
        do {
            try await env.debts.addEvent(debtId: debtId, input)
            paying = nil
            eventKind = nil
            earlyOpen = false
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    /// DEBT-020: bulk-pays every past unsettled installment.
    func markAllPaid(_ debt: DebtView) async {
        guard let upTo = DebtsRules.unsettled(debt).last?.number, !bulkBusy else { return }
        bulkBusy = true
        defer { bulkBusy = false }
        do {
            let count = try await env.debts.bulkPay(debtId: debt.id, upTo: upTo)
            env.toasts.show(.success, DebtsText(locale: LocalizedStrings.shared.language.bbLocale, translate: { L10n.lookup(italian: $0) }).bulkDone(count))
            await load()
        } catch {
            env.toasts.showError(message(error), area: .debito)
        }
    }

    /// DEBT-027 + decision 0003: the event leaves the list at once; the DELETE is sent when the undo toast expires.
    func removeEvent(debtId: String, _ event: DebtEventView) {
        pendingEventRemovals.insert(event.id)
        env.toasts.showUndo(L10n.lookup(italian: "Evento eliminato"),
                            onUndo: { [weak self] in self?.pendingEventRemovals.remove(event.id) },
                            onCommit: { [weak self] in Task { await self?.commitEventRemoval(debtId: debtId, event.id) } })
    }

    private func commitEventRemoval(debtId: String, _ id: String) async {
        do {
            try await env.debts.deleteEvent(debtId: debtId, eventId: id)
        } catch {
            env.toasts.showError(message(error), area: .debito)
        }
        await load()
        pendingEventRemovals.remove(id)
    }

    /// DEBT-028: after the confirmation; back to the overview.
    func delete(_ debt: DebtView, then done: () -> Void) async {
        do {
            try await env.debts.delete(id: debt.id)
            confirmDelete = false
            state.selectedId = nil
            done()
            await load()
        } catch {
            confirmDelete = false
            env.toasts.showError(message(error), area: .debito)
        }
    }

    // MARK: Transaction picker (DEBT-024)

    func candidates(dueDate: String) async -> [Movement]? {
        if categories.isEmpty { categories = (try? await env.categoriesAPI.list()) ?? [] }
        return try? await env.debts.candidates(dueDate: dueDate)
    }
}
