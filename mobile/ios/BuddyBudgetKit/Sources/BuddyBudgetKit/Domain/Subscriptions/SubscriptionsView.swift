import Foundation

// Pure helpers of the Abbonamenti screen (web `lib/subscriptions/view.ts`, `subscriptions-overview.tsx`,
// `subscription-detail-dialog.tsx`). Same names and behaviour as `SubscriptionsView` on Android.

/// The list sections of the screen, in display order (SUB-008…012).
public struct SubscriptionSections: Equatable, Sendable {
    /// `Trovati nei tuoi movimenti`: pending and active.
    public var toConfirm: [SubscriptionItem]
    /// `I tuoi abbonamenti`: confirmed and active.
    public var confirmed: [SubscriptionItem]
    /// `Non addebitati da un po'`: stopped, confirmed or pending.
    public var stopped: [SubscriptionItem]
    /// `Aumenti di prezzo`: recent rises, not excluded/terminated.
    public var priceRises: [SubscriptionItem]
    /// Archive `Terminati (n)`.
    public var ended: [SubscriptionItem]
    /// Archive `Non sono abbonamenti (n)`.
    public var excluded: [SubscriptionItem]

    public init(toConfirm: [SubscriptionItem] = [], confirmed: [SubscriptionItem] = [], stopped: [SubscriptionItem] = [],
                priceRises: [SubscriptionItem] = [], ended: [SubscriptionItem] = [], excluded: [SubscriptionItem] = []) {
        self.toConfirm = toConfirm
        self.confirmed = confirmed
        self.stopped = stopped
        self.priceRises = priceRises
        self.ended = ended
        self.excluded = excluded
    }
}

/// Hero line 2 (SUB-005): the next confirmed active charge within 30 days, with the window's count and sum.
public struct SubscriptionNextCharge: Equatable, Sendable {
    public let item: SubscriptionItem
    public let date: String
    /// Charges due in the window (overdue included).
    public let count: Int
    /// Sum of their amounts.
    public let total: Double
}

/// Footer actions of the detail (SUB-017, SUB-020, SUB-021).
public struct SubscriptionAllowedActions: Equatable, Sendable {
    public enum Removal: Equatable, Sendable {
        /// Manual: `Elimina`.
        case delete
        /// Saved detected: `Ripristina com'era`.
        case restore
    }

    public enum ConfirmLabel: Equatable, Sendable {
        /// `Sì, è un abbonamento`.
        case yes
        /// `Rimettilo tra i miei` (excluded or terminated).
        case putBack
    }

    public var removal: Removal?
    /// `Non è un abbonamento`.
    public var exclude: Bool
    /// `È terminato`.
    public var terminate: Bool
    public var confirm: ConfirmLabel?

    public init(removal: Removal? = nil, exclude: Bool = false, terminate: Bool = false, confirm: ConfirmLabel? = nil) {
        self.removal = removal
        self.exclude = exclude
        self.terminate = terminate
        self.confirm = confirm
    }
}

/// How a decision is saved (SUB-018).
public enum SubscriptionDecisionRoute: Equatable, Sendable {
    case patch(id: String, status: SubscriptionStatus)
    case post(SubscriptionDecisionInput)
    /// No saved choice and no amount or cadence: `Mancano importo e cadenza`.
    case missingData
}

/// What a quick action does (SUB-013).
public enum SubscriptionQuickAction: Equatable, Sendable {
    case save(SubscriptionDecisionInput)
    case openDetail
}

public enum SubscriptionsView {
    /// Days ahead counted as "upcoming" (`UPCOMING_WINDOW_DAYS`).
    public static let upcomingWindowDays = 30
    /// A price rise is shown for this many days (`PRICE_RISE_WINDOW_DAYS`).
    public static let priceRiseWindowDays = 365
    /// Charges listed in the detail (`HISTORY_LIMIT`).
    public static let historyLimit = 12
    /// Dates further than this are written with the year (`YEAR_AWAY_DAYS`).
    public static let yearAwayDays = 300

    /// Days from `today` to `date` (negative when past); 0 for invalid input.
    public static func daysBetween(_ today: String, _ date: String) -> Int {
        guard let a = CalendarDate(iso: today), let b = CalendarDate(iso: date) else { return 0 }
        return b.epochDay - a.epochDay
    }

    /// SUB-008…012: partitions the items (server order kept, i.e. by next charge).
    public static func sections(_ items: [SubscriptionItem], today: String) -> SubscriptionSections {
        SubscriptionSections(
            toConfirm: items.filter { $0.decision == .daConfermare && $0.activity == .attivo },
            confirmed: items.filter { $0.decision == .confermato && $0.activity == .attivo },
            stopped: items.filter { $0.activity == .fermo && ($0.decision == .confermato || $0.decision == .daConfermare) },
            priceRises: recentPriceRises(items, today: today),
            ended: items.filter { $0.decision == .terminato },
            excluded: items.filter { $0.decision == .escluso })
    }

    /// `upcomingCharges`: confirmed active items due within the window (overdue included).
    public static func upcoming(_ items: [SubscriptionItem], today: String,
                                windowDays: Int = upcomingWindowDays) -> [SubscriptionItem] {
        items.filter { item in
            guard item.decision == .confermato, item.activity == .attivo, let next = item.nextDate else { return false }
            return daysBetween(today, next) <= windowDays
        }
    }

    /// SUB-005: first upcoming item (server order = next date ascending) with the window's count and sum.
    public static func nextCharge(_ items: [SubscriptionItem], today: String) -> SubscriptionNextCharge? {
        let upcoming = upcoming(items, today: today)
        guard let first = upcoming.first, let date = first.nextDate else { return nil }
        let total = upcoming.reduce(0) { $0 + ($1.amount ?? 0) }
        return SubscriptionNextCharge(item: first, date: date, count: upcoming.count, total: total)
    }

    /// SUB-011 (`recentPriceRises`): a real rise within 365 days, decision neither excluded nor terminated.
    public static func recentPriceRises(_ items: [SubscriptionItem], today: String) -> [SubscriptionItem] {
        items.filter { item in
            guard let change = item.priceChange, change.to > change.from,
                  item.decision != .escluso, item.decision != .terminato else { return false }
            return daysBetween(change.since, today) <= priceRiseWindowDays
        }
    }

    /// Totals as the server computes them (`buildSubscriptionsView`), for local previews (pending undo).
    public static func totals(_ items: [SubscriptionItem]) -> SubscriptionTotals {
        let confirmed = items.filter { $0.decision == .confermato && $0.activity == .attivo && $0.monthly != nil }
        let pending = items.filter { $0.decision == .daConfermare && $0.activity == .attivo && $0.monthly != nil }
        let monthly = JSNumber.round2(confirmed.reduce(0) { $0 + ($1.monthly ?? 0) })
        return SubscriptionTotals(count: confirmed.count, monthly: monthly, yearly: JSNumber.round2(monthly * 12),
                                  pendingCount: pending.count,
                                  pendingMonthly: JSNumber.round2(pending.reduce(0) { $0 + ($1.monthly ?? 0) }))
    }

    /// SUB-016: up to 12 most recent charges, newest first (the server lists them oldest first).
    public static func history(_ item: SubscriptionItem) -> [SubscriptionCharge] {
        Array(item.charges.reversed().prefix(historyLimit))
    }

    /// Row/detail trailing line: the old price after a rise, else the monthly equivalent for non-monthly cadences.
    public static func showsMonthlyEquivalent(_ item: SubscriptionItem) -> Bool {
        item.cadence != nil && item.cadence != .mensile && item.monthly != nil
    }

    /// The rise shown under the amount (`era {from}`), if the price went up.
    public static func rise(_ item: SubscriptionItem) -> SubscriptionPriceChange? {
        guard let change = item.priceChange, change.to > change.from else { return nil }
        return change
    }

    /// SUB-017: the decision actions allowed for the item's state.
    public static func allowedActions(_ item: SubscriptionItem) -> SubscriptionAllowedActions {
        let archived = item.decision == .escluso || item.decision == .terminato
        return SubscriptionAllowedActions(
            removal: item.id == nil ? nil : (item.isManual ? .delete : .restore),
            exclude: item.decision != .escluso && !item.isManual,
            terminate: item.decision != .terminato && (item.decision != .daConfermare || item.activity == .fermo),
            confirm: item.decision == .confermato ? nil : (archived ? .putBack : .yes))
    }

    /// SUB-018: PATCH when a saved choice exists, else POST `rilevato` (needs amount and cadence).
    public static func decisionRoute(_ item: SubscriptionItem, status: SubscriptionStatus) -> SubscriptionDecisionRoute {
        if let id = item.id { return .patch(id: id, status: status) }
        guard let input = decisionInput(item, status: status) else { return .missingData }
        return .post(input)
    }

    /// SUB-013: quick actions always POST the snapshot; without amount or cadence they open the detail.
    public static func quickAction(_ item: SubscriptionItem, status: SubscriptionStatus) -> SubscriptionQuickAction {
        guard let input = decisionInput(item, status: status) else { return .openDetail }
        return .save(input)
    }

    private static func decisionInput(_ item: SubscriptionItem, status: SubscriptionStatus) -> SubscriptionDecisionInput? {
        guard let amount = item.amount, let cadence = item.cadence else { return nil }
        return SubscriptionDecisionInput(key: item.key, status: status, name: item.name, amount: amount, cadence: cadence,
                                         categoryId: item.categoryId)
    }

    /// Decision 0003: what the list shows while a removal waits for its undo window. A manual item (or a saved detected
    /// item that is no longer detected) disappears; a detected one goes back to «da confermare» without its saved id.
    public static func applyingRemovals(_ items: [SubscriptionItem], removedIds: Set<String>) -> [SubscriptionItem] {
        guard !removedIds.isEmpty else { return items }
        return items.compactMap { item in
            guard let id = item.id, removedIds.contains(id) else { return item }
            if item.isManual || item.charges.isEmpty { return nil }
            var restored = item
            restored.id = nil
            restored.decision = .daConfermare
            return restored
        }
    }

    /// Stable avatar colour of the coloured-initial fallback: index into the 8 swatches
    /// blue, teal, purple, orange, pink, indigo, cyan, amber (`avatarColor`, JS `hash * 31 + charCode >>> 0`).
    public static let avatarSwatches = ["blue", "teal", "purple", "orange", "pink", "indigo", "cyan", "amber"]

    public static func avatarSwatch(_ key: String) -> String {
        var hash: UInt32 = 0
        for unit in key.utf16 { hash = hash &* 31 &+ UInt32(unit) }
        return avatarSwatches[Int(hash % UInt32(avatarSwatches.count))]
    }
}

// MARK: - Forms (SUB-019, SUB-023)

public enum SubscriptionForm {
    public static let nameMaxLength = 80
    public static let amountMax: Double = 100_000

    public enum Result: Equatable, Sendable {
        case valid(name: String, amount: Double?)
        /// Italian catalog key of the message.
        case invalid(String)
    }

    /// Name required (trimmed, ≤ 80); amount (when `requireAmount`) parsed with the locale rules, > 0 and ≤ 100,000.
    public static func validate(name: String, amountText: String, requireAmount: Bool) -> Result {
        let trimmed = JSNumber.trim(name)
        if trimmed.isEmpty { return .invalid("Dai un nome all'abbonamento") }
        if trimmed.count > nameMaxLength { return .invalid("Il nome è troppo lungo") }
        guard requireAmount else { return .valid(name: trimmed, amount: nil) }
        guard let amount = BBFormat.parseAmount(amountText), amount > 0 else {
            return .invalid("Inserisci l'importo di ogni addebito")
        }
        if amount > amountMax { return .invalid("L'importo è troppo alto") }
        return .valid(name: trimmed, amount: amount)
    }

    /// Prefill of the amount field (2 decimals, locale separator, no grouping, so it parses back).
    public static func amountText(_ amount: Double?, locale: BBLocale) -> String {
        guard let amount else { return "" }
        let fixed = String(format: "%.2f", JSNumber.round2(amount))
        return locale == .enGB ? fixed : fixed.replacingOccurrences(of: ".", with: ",")
    }

    /// Caps the name at 80 characters while typing (web `maxLength`).
    public static func clampName(_ name: String) -> String {
        name.count > nameMaxLength ? String(name.prefix(nameMaxLength)) : name
    }
}
