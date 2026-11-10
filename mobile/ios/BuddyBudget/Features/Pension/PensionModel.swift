import BuddyBudgetKit
import Foundation
import Observation

/// State of Pensione (09-pension): one `GET /api/pension/view` per selected fund feeds every tab (PEN-002), funds and
/// snapshots CRUD, the paste import. Logic lives in BuddyBudgetKit (`PensionUiState`, `PensionRules`,
/// `PensionImport`, `PensionCalc`); this model only sequences API calls. Same fields as `PensionModel` on Android.
@MainActor @Observable
final class PensionModel {
    private(set) var state = PensionUiState()
    /// Snapshots hidden while their undo toast runs (decision 0003).
    private(set) var pendingSnapshotRemovals: Set<String> = []
    var importOpen = false
    var confirmDeleteFund = false
    private(set) var busy = false

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var started = false
    @ObservationIgnored private var debugDialogOpened = false

    init(env: AppEnvironment) {
        self.env = env
    }

    /// "Today" of the server (UTC), used by the forms' date limits.
    static var todayKey: String { CalendarDate.of(Date(), in: TimeZone(identifier: "UTC")!).iso }
    var today: String { state.view?.today ?? Self.todayKey }
    var currency: String { state.view?.currency ?? env.session.currency }

    func start() async {
        guard !started else { return }
        started = true
        // Unstructured: a view `.task` cancelled by a re-render must not fail the first load.
        await Task { await self.load() }.value
    }

    /// PEN-002 (403 → country-unavailable, PEN-001). Keeps the previous view when a refresh fails.
    func load() async {
        do {
            let view = try await env.pension.view(fundId: state.fundId)
            state.view = view
            state.fundId = view.fund?.id
            state.failed = false
            state.unavailable = false
            #if DEBUG
            // DEBUG-only `-BBDialog import`: opens the paste import for screenshots (once).
            if !debugDialogOpened, DebugLaunch.value("-BBDialog")?.hasPrefix("import") == true {
                debugDialogOpened = true
                importOpen = true
            }
            #endif
        } catch let error as APIError where error.code == .countryFeatureUnavailable {
            state.unavailable = true
        } catch {
            if state.view == nil { state.failed = true }
        }
    }

    func retry() async {
        state.failed = false
        await load()
    }

    func select(_ tab: PensionTab) { state.tab = tab }

    /// PEN-003: recompute every tab for the chosen fund.
    func selectFund(_ id: String) {
        guard id != state.fundId else { return }
        state.select(fundId: id)
        Task { await load() }
    }

    func setSimulatedYears(_ years: Int?) { state.simulatedYears = years }
    func setProjection(years: Int? = nil, quarterly: Double? = nil) {
        if let years { state.projectionYears = years }
        if let quarterly { state.projectionQuarterly = quarterly }
    }

    private func message(_ error: Error) -> String {
        (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Operazione non riuscita")
    }

    // MARK: Funds (PEN-005…009)

    /// PEN-006: the new fund becomes the selected one.
    func createFund(name: String, adhesionDate: String) async -> String? {
        busy = true
        defer { busy = false }
        do {
            let id = try await env.pension.createFund(name: name, adhesionDate: adhesionDate)
            state.select(fundId: id)
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    /// PEN-008: only the changed fields.
    func updateFund(name: String, adhesionDate: String) async -> String? {
        guard let fund = state.fund else { return nil }
        busy = true
        defer { busy = false }
        do {
            try await env.pension.updateFund(id: fund.id, name: name == fund.name ? nil : name,
                                             adhesionDate: adhesionDate == fund.adhesionDate ? nil : adhesionDate)
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    /// PEN-009: after the confirmation; the next fund (or the empty state) follows.
    func deleteFund() async -> String? {
        guard let fund = state.fund else { return nil }
        confirmDeleteFund = false
        do {
            try await env.pension.deleteFund(id: fund.id)
            let next = state.view?.funds.first { $0.id != fund.id }?.id
            state.select(fundId: next ?? "")
            state.fundId = next
            state.tab = .overview
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    // MARK: Snapshots (PEN-010…012)

    func saveSnapshot(date: String, netContributions: Double, value: Double) async -> String? {
        guard let fund = state.fund else { return nil }
        do {
            try await env.pension.saveSnapshot(fundId: fund.id, date: date, netContributions: netContributions, value: value)
            await load()
            return nil
        } catch {
            return message(error)
        }
    }

    /// PEN-012 + decision 0003: the row leaves at once; the DELETE is sent when the undo toast expires.
    func removeSnapshot(_ snapshot: PensionSnapshot) {
        guard let fund = state.fund else { return }
        pendingSnapshotRemovals.insert(snapshot.id)
        env.toasts.showUndo(L10n.lookup(italian: "Fotografia eliminata"),
                            onUndo: { [weak self] in self?.pendingSnapshotRemovals.remove(snapshot.id) },
                            onCommit: { [weak self] in Task { await self?.commitSnapshotRemoval(fundId: fund.id, snapshot.id) } })
    }

    private func commitSnapshotRemoval(fundId: String, _ id: String) async {
        do {
            try await env.pension.deleteSnapshot(fundId: fundId, snapshotId: id)
        } catch {
            env.toasts.show(.error, message(error))
        }
        await load()
        pendingSnapshotRemovals.remove(id)
    }

    // MARK: Import (PEN-014…017)

    func importRows(_ rows: [PensionImportRowInput]) async -> Result<PensionImportCounts, ImportFailure> {
        guard let fund = state.fund else { return .failure(ImportFailure(message: "")) }
        do {
            let counts = try await env.pension.importSnapshots(fundId: fund.id, rows: rows)
            await load()
            return .success(counts)
        } catch {
            return .failure(ImportFailure(message: message(error)))
        }
    }

    struct ImportFailure: Error {
        let message: String
    }
}
