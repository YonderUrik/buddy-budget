import BuddyBudgetKit
import Foundation
import Observation

/// State of the security page (08-securities-watchlist): one analysis request per chart period, re-polled every 2.5 s
/// while the price history downloads (capped), follow toggle, alerts, commentary, quotation link. Same fields as
/// `SecurityModel` on Android.
@MainActor @Observable
final class SecurityModel {
    let instrumentId: String
    private(set) var period: TitlePeriod = .default
    private(set) var analysis: Loadable<TitleAnalysis> = .loading
    private(set) var errorMessage: String?
    private(set) var followPending = false
    private(set) var alertPending = false
    var alertError: String?
    private(set) var commentary: String?
    private(set) var commentaryState: CommentaryState = .idle
    private(set) var quotations: QuotationCandidates?
    private(set) var quotationsLoading = false
    var quotationError: String?

    enum CommentaryState: Equatable { case idle, writing, done, failed(String?) }

    @ObservationIgnored private let env: AppEnvironment
    @ObservationIgnored private var pollTask: Task<Void, Never>?
    /// Investimenti caches to refresh after follow / alert / link (SEC-014).
    @ObservationIgnored var onChanged: (() async -> Void)?

    init(env: AppEnvironment, instrumentId: String) {
        self.env = env
        self.instrumentId = instrumentId
    }

    var value: TitleAnalysis? { analysis.value }

    private func message(_ error: Error) -> String {
        (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
    }

    /// SEC-015 / SEC-016.
    func load() async {
        do {
            let result = try await env.instruments.analysis(id: instrumentId, period: period)
            analysis = .loaded(result)
            errorMessage = nil
            schedulePoll(result.backfilling)
        } catch {
            if analysis.value == nil {
                analysis = .failed
                errorMessage = (error as? APIError)?.body?.message
            }
        }
    }

    func setPeriod(_ next: TitlePeriod) {
        period = next
        Task { await load() }
    }

    /// Re-poll every 2.5 s while `backfilling` (at most 40 times, only while the page is open).
    private func schedulePoll(_ backfilling: Bool) {
        pollTask?.cancel()
        guard backfilling else { return }
        pollTask = Task { [weak self] in
            for _ in 0..<40 {
                try? await Task.sleep(for: .milliseconds(2500))
                guard let self, !Task.isCancelled else { return }
                guard let next = try? await self.env.instruments.analysis(id: self.instrumentId, period: self.period) else { continue }
                self.analysis = .loaded(next)
                if !next.backfilling { return }
            }
        }
    }

    func stop() { pollTask?.cancel() }

    /// SEC-012: no confirmation.
    func toggleFollow() async {
        guard let current = value else { return }
        followPending = true
        defer { followPending = false }
        do {
            try await env.instruments.setWatching(id: instrumentId, !current.watching)
            await load()
            await onChanged?()
        } catch {
            env.toasts.show(.error, message(error))
        }
    }

    /// SEC-030…032.
    func createAlert(above: Bool, level: Double) async -> Bool {
        alertPending = true
        alertError = nil
        defer { alertPending = false }
        do {
            try await env.instruments.createAlert(id: instrumentId, above: above, target: level)
            await load()
            await onChanged?()
            return true
        } catch {
            alertError = message(error)
            return false
        }
    }

    /// SEC-033: immediate delete.
    func deleteAlert(_ alert: PriceAlert) async {
        do {
            try await env.instruments.deleteAlert(id: instrumentId, alertId: alert.id)
            await load()
            await onChanged?()
        } catch {
            env.toasts.show(.error, message(error))
        }
    }

    /// SEC-049.
    func generateCommentary() async {
        commentaryState = .writing
        do {
            let result = try await env.instruments.commentary(id: instrumentId)
            if let text = result.text {
                commentary = text
                commentaryState = .done
            } else {
                commentaryState = .failed(nil)
            }
        } catch {
            commentaryState = .failed((error as? APIError)?.body?.message)
        }
    }

    /// SEC-028.
    func searchQuotations() async {
        quotationsLoading = true
        quotationError = nil
        defer { quotationsLoading = false }
        do {
            quotations = try await env.instruments.quotations(id: instrumentId)
        } catch {
            quotationError = message(error)
        }
    }

    func link(_ symbol: String) async {
        do {
            try await env.instruments.linkQuotation(id: instrumentId, symbol: symbol)
            quotations = nil
            await load()
            await onChanged?()
        } catch {
            quotationError = message(error)
        }
    }
}
