import BuddyBudgetKit
import Foundation
import Observation

/// State of the German Tax and Income screens (13-planning-de, PLAN-007…031): the plan editor, the server results of
/// the saved plan, debounced results of the edited plan, and the instrument names. Logic lives in BuddyBudgetKit
/// (`GermanPlanEditor`, `GermanPlanValidation`, `GermanPlanningText`); this model only sequences API calls. One per
/// signed-in session (kept by `InvestmentsModel`), shared by the `Tasse` and `Dividendi` tabs. Same fields as
/// `GermanPlanningModel` on Android.
@MainActor @Observable
final class GermanPlanningModel {
    enum Phase: Equatable { case loading, failed, loaded }

    private(set) var phase: Phase = .loading
    private(set) var editor: GermanPlanEditor?
    /// Results of the saved plan (`?include=results`); Income always shows these.
    private(set) var savedResults: PlanningResults?
    /// Results of the edited plan (`POST /api/financial-planning/results`), while the draft differs from the saved plan.
    private(set) var previewResults: PlanningResults?
    private(set) var portfolio: PlanningPortfolio?
    /// Unsaved-changes sheet: what to do once the user saved or discarded.
    var pendingLeave: (() -> Void)?
    /// 409 «Reload» confirmation.
    var reloadPrompt = false

    @ObservationIgnored private let api: FinancialPlanningAPI
    @ObservationIgnored private var previewTask: Task<Void, Never>?

    init(api: FinancialPlanningAPI) {
        self.api = api
    }

    /// Results shown by the Tax screen: the edited plan's when available, else the saved plan's.
    var taxResults: PlanningResults? {
        if editor?.isDirty == true, let previewResults { return previewResults }
        return savedResults
    }

    var isDirty: Bool { editor?.isDirty ?? false }

    func start() async {
        guard phase != .loaded || editor == nil else { return }
        await load()
    }

    /// PLAN-007, PLAN-008: plan + results and the instrument names; either failing shows «Could not load the plan.».
    func load() async {
        if editor == nil { phase = .loading }
        do {
            async let planLoad = api.load()
            async let portfolioLoad = api.portfolio()
            let (envelope, names) = try await (planLoad, portfolioLoad)
            // A refresh keeps the user's edits (and their revision: a stale save gets the 409 message, PLAN-013).
            if editor?.isDirty != true {
                editor = GermanPlanEditor(plan: envelope.plan, revision: envelope.revision)
            }
            savedResults = envelope.results
            portfolio = names
            phase = .loaded
            schedulePreview()
        } catch {
            if editor == nil { phase = .failed }
        }
    }

    func retry() {
        phase = .loading
        Task { await load() }
    }

    func updateTax(_ change: (inout GermanTaxSettings) -> Void) {
        editor?.updateTax(change)
        schedulePreview()
    }

    /// Debounced results of the edited plan (only when it is valid: the server rejects invalid plans).
    private func schedulePreview() {
        previewTask?.cancel()
        guard let editor, editor.isDirty else {
            previewResults = nil
            return
        }
        guard editor.isValid else { return }
        let plan = editor.draft
        previewTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled, let self else { return }
            guard let results = try? await self.api.preview(plan: plan), !Task.isCancelled, self.editor?.draft == plan else { return }
            self.previewResults = results
        }
    }

    /// PLAN-012, PLAN-013. Returns true when saved.
    @discardableResult
    func save() async -> Bool {
        guard var editor, let body = editor.beginSave() else { return false }
        self.editor = editor
        do {
            let saved = try await api.save(plan: body.plan, revision: body.revision)
            editor.saveSucceeded(plan: saved.plan, revision: saved.revision)
            self.editor = editor
            if let previewResults, body.plan == saved.plan { savedResults = previewResults }
            previewResults = nil
            previewTask?.cancel()
            // The results of the saved plan (Income reads them).
            if let fresh = try? await api.load(), fresh.revision == editor.revision { savedResults = fresh.results }
            return true
        } catch {
            editor.saveFailed(conflict: error.apiBody?.status == 409)
            self.editor = editor
            return false
        }
    }

    /// Unsaved-changes sheet «Discard changes».
    func discard() {
        editor?.discard()
        previewResults = nil
        previewTask?.cancel()
    }

    /// 409 «Reload»: the server's plan replaces the edits (after confirmation).
    func reload() async {
        editor = nil
        previewResults = nil
        await load()
    }

    /// Runs `action` now, or after the unsaved-changes sheet when the plan has unsaved edits.
    func confirmLeave(_ action: @escaping () -> Void) {
        if isDirty { pendingLeave = action } else { action() }
    }

    func resolveLeave(save: Bool) async {
        guard let action = pendingLeave else { return }
        pendingLeave = nil
        if save {
            guard await self.save() else { return }
        } else {
            discard()
        }
        action()
    }
}

private extension Error {
    var apiBody: APIErrorBody? { (self as? APIError)?.body }
}
