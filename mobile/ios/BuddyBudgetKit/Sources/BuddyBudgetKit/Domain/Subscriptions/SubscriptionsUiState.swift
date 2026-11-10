import Foundation

/// Everything the Abbonamenti screen renders, derived from the last response (UI only renders it).
/// Same fields as `SubscriptionsUiState` on Android.
public struct SubscriptionsUiState: Equatable, Sendable {
    public enum Phase: Equatable, Sendable { case loading, failed, loaded }

    public var phase: Phase
    public var response: SubscriptionsResponse?
    /// A quick action or a detail/add save is running (SUB-015: quick buttons disabled).
    public var isSaving: Bool
    /// Saved ids whose removal waits for the undo window (decision 0003).
    public var pendingRemovals: Set<String>

    public init(phase: Phase = .loading, response: SubscriptionsResponse? = nil, isSaving: Bool = false,
                pendingRemovals: Set<String> = []) {
        self.phase = phase
        self.response = response
        self.isSaving = isSaving
        self.pendingRemovals = pendingRemovals
    }

    public var today: String { response?.today ?? "" }
    public var currency: String { response?.currency ?? "EUR" }

    /// Items as shown (pending removals applied).
    public var items: [SubscriptionItem] {
        SubscriptionsView.applyingRemovals(response?.items ?? [], removedIds: pendingRemovals)
    }

    /// Server totals, or recomputed while a removal is pending so the hero matches the list.
    public var totals: SubscriptionTotals {
        guard let response else { return SubscriptionTotals() }
        return pendingRemovals.isEmpty ? response.totals : SubscriptionsView.totals(items)
    }

    public var sections: SubscriptionSections { SubscriptionsView.sections(items, today: today) }

    public var nextCharge: SubscriptionNextCharge? { SubscriptionsView.nextCharge(items, today: today) }

    /// SUB-007: no items at all.
    public var isEmpty: Bool { items.isEmpty }

    /// The current version of an item (after a refetch), by key.
    public func item(key: String) -> SubscriptionItem? { items.first { $0.key == key } }
}
