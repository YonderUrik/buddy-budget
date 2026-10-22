import Foundation

/// A decision taken on a card, not yet saved (CAT-064).
public struct CategorizeDecision: Equatable, Sendable {
    public enum Exit: Equatable, Sendable { case confirm, change }

    public let group: SuggestionGroup
    public let categoryId: String
    public let excludedPercentage: Double
    public let remember: Bool
    /// Side the card left by (undo brings it back from there, CAT-067).
    public let exit: Exit

    public var applyGroup: CategorizeApplyGroup {
        CategorizeApplyGroup(transactionIds: group.transactionIds, categoryId: categoryId, excludedPercentage: excludedPercentage,
                             createRule: remember, merchantKey: group.merchantKey)
    }
}

/// «Da decidere» card deck (`use-swipe-deck.ts`), pure: the queue, skip, decide, undo and the pending batch.
/// Same type on Android.
public struct CategorizeDeck: Equatable, Sendable {
    /// Groups still to decide, first = the active card.
    public private(set) var queue: [SuggestionGroup]
    /// Decided and not saved yet, oldest first (undo pops the last one).
    public private(set) var pending: [CategorizeDecision] = []
    /// Decided and being saved (no longer undoable).
    public private(set) var saving: [CategorizeDecision] = []

    /// CAT-039: groups sorted by number of movements, descending (stable).
    public init(groups: [SuggestionGroup]) {
        queue = CategoryLegend.stableSorted(groups) { Double($1.transactionIds.count - $0.transactionIds.count) }
    }

    public var current: SuggestionGroup? { queue.first }
    public var next: SuggestionGroup? { queue.count > 1 ? queue[1] : nil }
    public var remaining: Int { queue.count }
    public var canUndo: Bool { !pending.isEmpty }
    public var isEmpty: Bool { queue.isEmpty }

    /// CAT-058/066: confirm the proposal with its split percentage. False without a proposal.
    @discardableResult
    public mutating func confirm(remember: Bool) -> Bool {
        guard let group = current, let suggestion = group.suggestion else { return false }
        decide(CategorizeDecision(group: group, categoryId: suggestion.suggestedCategoryId,
                                  excludedPercentage: suggestion.suggestedSplitPercentage ?? 0, remember: remember, exit: .confirm))
        return true
    }

    /// CAT-059/066: another category, with 0 % exclusion.
    public mutating func choose(categoryId: String, remember: Bool) {
        guard let group = current else { return }
        decide(CategorizeDecision(group: group, categoryId: categoryId, excludedPercentage: 0, remember: remember, exit: .change))
    }

    /// CAT-060: the active card goes to the end of the queue (not saved).
    public mutating func skip() {
        guard queue.count > 1 else { return }
        queue.append(queue.removeFirst())
    }

    /// Restores the last unsaved decision to the top of the deck; returns it.
    @discardableResult
    public mutating func undo() -> CategorizeDecision? {
        guard let last = pending.popLast() else { return nil }
        queue.insert(last.group, at: 0)
        return last
    }

    /// Moves every pending decision to `saving` and returns the batch to send (nil when nothing is pending).
    public mutating func beginSave() -> [CategorizeDecision]? {
        guard !pending.isEmpty else { return nil }
        let batch = pending
        saving += batch
        pending = []
        return batch
    }

    public mutating func finishSave(_ batch: [CategorizeDecision]) {
        let keys = Set(batch.map(\.group.groupKey))
        saving.removeAll { keys.contains($0.group.groupKey) }
    }

    /// CAT-065: a failed save puts the cards back on the deck (at the top, in their original order).
    public mutating func failSave(_ batch: [CategorizeDecision]) {
        finishSave(batch)
        let keys = Set(queue.map(\.groupKey))
        queue.insert(contentsOf: batch.map(\.group).filter { !keys.contains($0.groupKey) }, at: 0)
    }

    /// Hides groups (auto-apply `readyKeys`, CAT-040) or brings them back after a failure (CAT-042).
    public mutating func remove(keys: Set<String>) {
        queue.removeAll { keys.contains($0.groupKey) }
    }

    public mutating func restore(_ groups: [SuggestionGroup]) {
        let keys = Set(queue.map(\.groupKey))
        queue += groups.filter { !keys.contains($0.groupKey) }
    }

    /// AI polling (CAT-052): fresh suggestions replace the cards still in the queue (same order); groups that are
    /// new and not decided yet go to the end; groups no longer returned leave the queue.
    public mutating func refresh(with groups: [SuggestionGroup]) {
        let byKey = Dictionary(groups.map { ($0.groupKey, $0) }, uniquingKeysWith: { a, _ in a })
        let decided = Set((pending + saving).map(\.group.groupKey))
        let known = Set(queue.map(\.groupKey))
        queue = queue.compactMap { byKey[$0.groupKey] }
        queue += groups.filter { !known.contains($0.groupKey) && !decided.contains($0.groupKey) }
    }

    /// Groups in the queue without a proposal (AI banner, CAT-048/052).
    public var withoutProposal: Int { queue.filter { $0.suggestion == nil }.count }

    private mutating func decide(_ decision: CategorizeDecision) {
        queue.removeFirst()
        pending.append(decision)
    }

    /// Movements still to decide (CAT-037 `Da decidere · n`).
    public var movementCount: Int { queue.reduce(0) { $0 + $1.transactionIds.count } }
}

/// Wording helpers shared by cards, «Messe dall'app» and Ricategorizza (`lib/categorization/origin.ts`).
/// Strings are Italian catalog keys with their placeholder values; the UI translates them.
public enum CategorizationText {
    /// CAT-043: confidence at or above which a proposal applies on its own (0.7 since web #456).
    public static let autoApplyThreshold = 0.7

    /// SET-031 hint: the threshold as a whole percentage («70»).
    public static var autoApplyPercent: String { String(confidencePercent(autoApplyThreshold)) }

    /// A translator: Italian catalog source plus its `{0}` values (`L10n.lookup` in the app).
    public typealias Translate = (String, [String: String]) -> String

    /// CAT-047 (`autoOriginDescription`): why the app set a category on its own, composed from the web's fragments.
    /// `bankCategory` quotes the bank's label for origin `banca`. Nil for the user's choice and unknown origins.
    public static func autoOriginDescription(_ source: CategorySource?, confidence: Double?, bankCategory: String?, tr: Translate) -> String? {
        let percent = confidence.map { tr(" (sicura al {0}%)", ["0": String(confidencePercent($0))]) } ?? ""
        switch source {
        case .regola: return tr("Messa dall'app con una tua regola", [:])
        case .banca:
            if let label = bankCategory, !label.isEmpty { return tr("Messa dall'app: nel file la banca la chiama «{0}»", ["0": label]) }
            return tr("Messa dall'app con la categoria scritta dalla banca nel file", [:])
        case .assistente: return tr("Messa dall'app: proposta dell'AI{0}", ["0": percent])
        case .storico: return tr("Messa dall'app: la scegli sempre per questo esercente{0}", ["0": percent])
        default: return nil
        }
    }

    public struct Phrase: Equatable, Sendable {
        public let key: String
        public let values: [String]
    }

    /// CAT-047: why a category is proposed.
    public static func suggestionOrigin(_ suggestion: CategorizeSuggestion) -> Phrase {
        switch suggestion.source {
        case .assistente: return Phrase(key: "Proposta dall'AI", values: [])
        case .regola:
            if let pattern = suggestion.rulePattern { return Phrase(key: "Simile alla tua regola «{0}»", values: [pattern]) }
            return Phrase(key: "Simile a una tua regola", values: [])
        default:
            guard let history = suggestion.history else { return Phrase(key: "Come i tuoi movimenti passati", values: []) }
            if history.total == 1 { return Phrase(key: "Come l'unico tuo movimento simile", values: []) }
            if history.agreeing == history.total { return Phrase(key: "Come tutti i tuoi {0} movimenti simili", values: [String(history.total)]) }
            return Phrase(key: "Come {0} dei tuoi {1} movimenti simili", values: [String(history.agreeing), String(history.total)])
        }
    }

    /// Whole percentage of a 0…1 confidence (CAT-046: accessibility text only).
    public static func confidencePercent(_ confidence: Double) -> Int {
        Int(JSNumber.round(min(1, max(0, confidence)) * 100))
    }

    /// When the movements happened: «9 ott», «2–9 ott», «28 set – 9 ott»; with the year when it is not the
    /// current one or the range crosses years (`dateRangeLabel`).
    public static func dateRangeLabel(_ dates: [String], today: CalendarDate, locale: BBLocale) -> String {
        guard !dates.isEmpty else { return "" }
        let sorted = dates.sorted()
        let first = sorted[0], last = sorted[sorted.count - 1]
        let year = { (iso: String) in Int(iso.prefix(4)) ?? 0 }
        let withYear = year(first) != year(last) || year(last) != today.year
        let format = { (iso: String) in withYear ? BBFormat.formatDateWithYear(iso, locale: locale) : BBFormat.formatShortDate(iso, locale: locale) }
        if first == last { return format(first) }
        if !withYear && first.prefix(7) == last.prefix(7) {
            return "\(Int(first.dropFirst(8).prefix(2)) ?? 0)–\(BBFormat.formatShortDate(last, locale: locale))"
        }
        return "\(format(first)) – \(format(last))"
    }

    /// Indices of the most recent movements of a group (preview, CAT-055): by date desc, at most `limit`.
    public static func recentIndices(_ dates: [String], limit: Int) -> [Int] {
        Array(dates.indices.sorted { dates[$0] > dates[$1] || (dates[$0] == dates[$1] && $0 < $1) }.prefix(limit))
    }
}

/// «Messe dall'app» summary (CAT-077, web #456): the same Italian fragments the web joins, so every language reads exactly
/// as on the web. Same names on Android.
public enum AutoReviewText {
    /// Days of history «Messe dall'app» covers (`AUTO_CATEGORIZED_RECENT_DAYS`).
    public static let recentDays = 30

    /// The reason fragment: on/off × some rows from the bank's category.
    public static func reasonSource(autoApplyEnabled: Bool, fromBank: Bool) -> String {
        switch (autoApplyEnabled, fromBank) {
        case (true, true): return ", con le tue regole, con la categoria della banca o perché era abbastanza sicura"
        case (true, false): return ", con le tue regole o perché era abbastanza sicura"
        case (false, true): return ", con le tue regole o con la categoria della banca"
        case (false, false): return ", con le tue regole"
        }
    }

    /// «Negli ultimi 30 giorni, 12 movimenti hanno la categoria messa dall'app, con … . Non serve confermarle: …»
    public static func summary(total: Int, fromBank: Bool, autoApplyEnabled: Bool, tr: CategorizationText.Translate) -> String {
        tr("Negli ultimi {0} giorni,", ["0": String(recentDays)]) + " "
            + (total == 1 ? tr("1 movimento ha", [:]) : tr("{0} movimenti hanno", ["0": String(total)])) + " "
            + tr("la categoria messa dall'app", [:]) + tr(reasonSource(autoApplyEnabled: autoApplyEnabled, fromBank: fromBank), [:])
            + tr(". Non serve confermarle: se una non va, toccala e cambiala.", [:])
    }
}
