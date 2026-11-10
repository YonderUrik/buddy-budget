import Foundation

// Obiettivi screens state and rules (spec: features/12-goals.md). The server computes the plan, the sources and the
// FIRE comparison (`GET /api/goals`); the 5-step form runs on the device with the ported `GoalWizard`. Same names on
// Android (`GoalsUiState.kt`).

/// What the Goals list shows.
public enum GoalsGate: Equatable, Sendable {
    case loading, failed, unavailable, empty, content
}

extension GoalKind {
    /// Kind label in the form (`GOAL_KIND_INFO[kind].label`), Italian source.
    public var label: String {
        switch self {
        case .emergenza: "Fondo di emergenza"
        case .viaggio: "Viaggio"
        case .casa: "Casa"
        case .acquisto: "Un acquisto"
        case .altro: "Qualcos'altro"
        }
    }

    public var hint: String {
        switch self {
        case .emergenza: "Qualche mese di spese da parte per gli imprevisti"
        case .viaggio: "Una vacanza o un viaggio da pagare senza debiti"
        case .casa: "L'anticipo di una casa o dei lavori"
        case .acquisto: "Un'auto, un computer, un matrimonio"
        case .altro: "Qualunque cosa per cui vuoi mettere da parte"
        }
    }

    public var iconKey: String { GoalsTile.iconKey(rawValue) }
    public var colorToken: String { GoalsTile.colorToken(rawValue) }

    /// `KEPT_GOAL_KINDS`: the money stays in the user's wealth.
    public var isKept: Bool { self == .emergenza }
}

/// Request coming from a deep link (GOAL-003, GOAL-001, detail path).
public enum GoalsLaunchIntent: Equatable, Sendable {
    /// `/analitiche/obiettivi?nuovo=1[&tipo=…]`.
    case new(kind: GoalKind?)
    /// `/analitiche/obiettivi/{id}`.
    case detail(id: String)
    /// `/analitiche/obiettivi`.
    case list

    public static let basePath = "/analitiche/obiettivi"

    /// nil when the path is not a Goals path.
    public init?(path: String) {
        let parts = path.split(separator: "?", maxSplits: 1).map(String.init)
        let clean = parts.first ?? ""
        guard clean == Self.basePath || clean.hasPrefix(Self.basePath + "/") else { return nil }
        let id = String(clean.dropFirst(Self.basePath.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if !id.isEmpty {
            self = .detail(id: id)
            return
        }
        let query = parts.count > 1 ? parts[1] : ""
        var params: [String: String] = [:]
        for pair in query.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            params[kv[0]] = kv.count > 1 ? (kv[1].removingPercentEncoding ?? kv[1]) : ""
        }
        if params["nuovo"] != nil {
            self = .new(kind: params["tipo"].flatMap(GoalKind.init(rawValue:)))
        } else {
            self = .list
        }
    }
}

/// One segment of the capacity bar (GOAL-007).
public struct GoalsBarSegment: Hashable, Sendable {
    public let key: String
    public let label: String
    public let value: Double
    /// Swatch token (`swatch-teal`, …), `muted-foreground` or `neg`.
    public let colorToken: String
    public let dashed: Bool
}

/// Capacity header (GOAL-007): title, second line, explanation and the stacked bar.
public struct GoalsCapacityHeader: Hashable, Sendable {
    public let title: String
    public let requested: String?
    public let explanation: String
    public let segments: [GoalsBarSegment]
    /// Right end of the scale (capacity + gap).
    public let scaleMax: Double
}

/// Savings of the month and how much the other open goals already take.
public struct GoalsFormCapacity: Hashable, Sendable {
    public let total: Double
    public let taken: Double
    public init(total: Double, taken: Double) {
        self.total = total
        self.taken = taken
    }
}

/// A stop of «La strada» (GOAL-012).
public struct GoalsRoadStop: Hashable, Sendable {
    public let key: String
    public let when: String
    public let sort: String
    public let label: String
    public let iconKey: String
    public let colorToken: String
}

public enum GoalsRules {
    /// FIRE row colour and icon (`FIRE_GOAL_INFO`).
    public static let fireIconKey = "target"
    public static let fireColorToken = "swatch-emerald"

    /// GOAL-008: goals not marked achieved (a reached-but-not-marked goal stays here).
    public static func openGoals(_ view: GoalsView) -> [GoalView] {
        view.goals.filter { $0.status != "raggiunto" || $0.achievedAt == nil }
    }

    /// GOAL-013.
    public static func doneGoals(_ view: GoalsView) -> [GoalView] {
        view.goals.filter { $0.status == "raggiunto" && $0.achievedAt != nil }
    }

    /// GOAL-009: swaps an open goal with its open neighbour; achieved goals keep their place in the full order.
    public static func reorder(_ view: GoalsView, openIndex index: Int, delta: Int) -> [String]? {
        let open = openGoals(view)
        guard open.indices.contains(index), open.indices.contains(index + delta) else { return nil }
        var ids = view.goals.map(\.id)
        guard let ia = ids.firstIndex(of: open[index].id), let ib = ids.firstIndex(of: open[index + delta].id) else { return nil }
        ids.swapAt(ia, ib)
        return ids
    }

    /// Applies an id order to the view (optimistic update).
    public static func applying(_ ids: [String], to view: GoalsView) -> GoalsView {
        let byId = Dictionary(uniqueKeysWithValues: view.goals.map { ($0.id, $0) })
        let goals = ids.compactMap { byId[$0] }
        return GoalsView(currency: view.currency, todayKey: view.todayKey, capacity: view.capacity, requested: view.requested,
                         allocated: view.allocated, gap: view.gap, goals: goals.count == view.goals.count ? goals : view.goals,
                         fire: view.fire, sources: view.sources, essentialMonthly: view.essentialMonthly)
    }

    /// GOAL-006 (web #382): the suggestion sentence source by what the spending figure counts.
    public static func emergencySuggestionSource(_ view: GoalsView) -> String {
        view.essentialBasis == "tutte"
            ? "Con {0} mesi delle tue spese sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora."
            : "Con {0} mesi di spese dovute sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora."
    }

    /// GOAL-006: emergency-fund suggestion (6 months of essential spending, free account money); nil when unknown.
    public static func emergencySuggestion(_ view: GoalsView) -> (target: Double, free: Double)? {
        guard let essential = view.essentialMonthly else { return nil }
        let free = view.sources.filter { $0.kind == "account" }.reduce(0) { $0 + $1.free }
        return (GoalWizard.emergencyTarget(essentialMonthly: essential, months: Double(GoalConstants.defaultEmergencyMonths)), free)
    }

    /// Source rows of the form (GOAL-018/019): free parts with this goal's own parts added back.
    public static func formSources(_ view: GoalsView, goal: GoalView?) -> [GoalFreeSource] {
        GoalWizard.availableSources(view.sources.map {
            GoalFreeSource(kind: GoalSourceKind(rawValue: $0.kind) ?? .account, id: $0.id, name: $0.name, total: $0.total, free: $0.free,
                           taxPerEuro: $0.taxPerEuro)
        }, goal: goal.map(wizardGoal))
    }

    /// The wizard's view of an existing goal.
    public static func wizardGoal(_ goal: GoalView) -> GoalWizardGoal {
        GoalWizardGoal(kind: GoalKind(rawValue: goal.kind) ?? .altro, name: goal.name, target: goal.target, targetDate: goal.targetDate,
                       monthly: goal.monthly, priority: goal.priority,
                       sources: goal.sources.map {
                           GoalAssignedSource(kind: GoalSourceKind(rawValue: $0.kind) ?? .account, refId: $0.refId, amount: $0.amount,
                                              counted: $0.counted, tax: $0.tax)
                       })
    }

    /// Initial draft: the goal's values, or a new one at the end (preset kind applied, GOAL-003).
    public static func initialDraft(_ view: GoalsView, goal: GoalView?, presetKind: GoalKind?) -> GoalDraft {
        let initial = GoalWizard.initialDraft(goal.map(wizardGoal), goalsCount: view.goals.count)
        if goal == nil, let presetKind { return GoalWizard.withKind(initial, presetKind, essentialMonthly: view.essentialMonthly) }
        return initial
    }

    /// GOAL-018: tapping a row selects it with the amount still missing (capped at the free part), or deselects it.
    public static func toggleSource(_ draft: GoalDraft, _ source: GoalFreeSource) -> GoalDraft {
        let key = GoalWizard.sourceKey(source.kind, source.id)
        var next = draft
        if let i = next.sources.firstIndex(where: { $0.key == key }) {
            next.sources.remove(at: i)
            return next
        }
        let missing = max(0, (draft.target ?? 0) - GoalWizard.assignedTotal(draft))
        let proposed = max(0, min(source.free, missing))
        next.sources.append(GoalDraftSource(key: key, amount: proposed != 0 ? proposed : max(0, source.free.rounded(.down))))
        return next
    }

    /// Savings of the month and how much the other open goals already take; nil when capacity is unknown.
    public static func formCapacity(_ view: GoalsView, goal: GoalView?) -> GoalsFormCapacity? {
        guard let capacity = view.capacity else { return nil }
        let taken = view.goals.filter { $0.id != goal?.id && $0.status != "raggiunto" }.reduce(0) { $0 + $1.funded }
        return GoalsFormCapacity(total: max(0, capacity), taken: taken)
    }

    /// GOAL-020: «Quanto avanza» (floor of what is left), nil when unknown.
    public static func freeCapacity(_ capacity: GoalsFormCapacity?) -> Double? {
        capacity.map { max(0, ($0.total - $0.taken).rounded(.down)) }
    }

    /// GOAL-021: the other goals, in order, for the position choice (new goals only).
    public static func positionChoices(_ view: GoalsView, goal: GoalView?) -> [GoalView] {
        goal == nil ? view.goals.filter { $0.id != goal?.id } : []
    }

    /// Names of the form sources by draft key.
    public static func sourceNames(_ sources: [GoalFreeSource]) -> [String: String] {
        Dictionary(sources.map { (GoalWizard.sourceKey($0.kind, $0.id), $0.name) }, uniquingKeysWith: { a, _ in a })
    }
}

/// Obiettivi phrasing (web `goal-format.ts`, `goals-capacity.tsx`, `fire-goal-row.tsx`, `goals-road.tsx`), bound to one
/// language and currency. Same API on Android (`GoalsText.kt`).
public struct GoalsText {
    public let locale: BBLocale
    public let currency: String
    public let masked: Bool
    private let translate: (String) -> String

    public init(locale: BBLocale, currency: String, masked: Bool = false, translate: @escaping (String) -> String) {
        self.locale = locale
        self.currency = currency
        self.masked = masked
        self.translate = translate
    }

    public func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    /// Currency without decimals (GOAL-034: masked in privacy mode).
    public func money(_ value: Double) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: masked)
    }

    /// «giugno 2027» from `YYYY-MM` or `YYYY-MM-DD`.
    public func month(_ key: String) -> String { BBFormat.formatMonthLabel(String(key.prefix(7)), locale: locale) }

    public func statusLabel(_ goal: GoalView) -> String? { GoalsTile.statusLabel(goal.status).map { tr($0) } }

    public func statusSentence(_ goal: GoalView) -> String {
        let sentence = GoalsTile.statusSentence(goal, money: money, month: month)
        var parts = sentence.parts.map { tr($0.source, $0.values) }
        if sentence.capitalizeFirst, let first = parts.first { parts[0] = BBFormat.capitalize(first) }
        return parts.joined()
    }

    /// `fireShiftText`: how far the goal moves the FIRE target; nil when unknown or reached.
    public func fireShift(_ goal: GoalView) -> String? {
        guard let months = goal.fireShiftMonths, goal.status != "raggiunto" else { return nil }
        if months <= 0 { return tr("non sposta il traguardo") }
        if months < 12 { return months == 1 ? tr("sposta il traguardo di 1 mese") : tr("sposta il traguardo di {0} mesi", ["0": String(months)]) }
        let years = Int(JSNumber.round(Double(months) / 12))
        return years == 1 ? tr("sposta il traguardo di circa 1 anno") : tr("sposta il traguardo di circa {0} anni", ["0": String(years)])
    }

    /// GOAL-007.
    public func capacityHeader(_ view: GoalsView) -> GoalsCapacityHeader {
        guard let capacity = view.capacity else {
            return GoalsCapacityHeader(
                title: tr("Non sappiamo ancora quanto risparmi al mese."), requested: nil,
                explanation: tr("Servono almeno tre mesi di movimenti, oppure scrivi il tuo risparmio nelle ipotesi delle Risposte. Intanto gli obiettivi tengono il conto di quanto hai già messo da parte."),
                segments: [], scaleMax: 0
            )
        }
        let open = view.goals.filter { $0.status != "raggiunto" }
        let left = max(0, capacity - view.allocated)
        var segments = open.filter { $0.funded > 0.5 }.map {
            GoalsBarSegment(key: $0.id, label: $0.name, value: $0.funded, colorToken: (GoalKind(rawValue: $0.kind) ?? .altro).colorToken, dashed: false)
        }
        if left > 0.5 {
            segments.append(view.fire != nil
                ? GoalsBarSegment(key: "fire", label: tr("Traguardo"), value: left, colorToken: GoalsRules.fireColorToken, dashed: false)
                : GoalsBarSegment(key: "free", label: tr("Liberi"), value: left, colorToken: "muted-foreground", dashed: false))
        }
        if view.gap > 0.5 {
            segments.append(GoalsBarSegment(key: "gap", label: tr("Mancano"), value: view.gap, colorToken: "neg", dashed: true))
        }
        let lowest = open.last { $0.funded + 0.5 < $0.monthly }
        let explanation: String
        if capacity <= 0 {
            explanation = tr("Finché resta così gli obiettivi non ricevono niente: contano solo i soldi che hai già messo da parte.")
        } else if view.gap > 0.5 {
            explanation = tr("Il risparmio va agli obiettivi nell'ordine che scegli. Ne mancano {0} al mese: {1} resta indietro.",
                             ["0": money(view.gap), "1": lowest?.name ?? tr("l'ultimo della lista")])
        } else if left > 0.5 {
            explanation = view.fire != nil
                ? tr("Il risparmio va agli obiettivi nell'ordine che scegli; i {0} che avanzano vanno verso il traguardo.", ["0": money(left)])
                : tr("Il risparmio va agli obiettivi nell'ordine che scegli; ne avanzano {0} al mese.", ["0": money(left)])
        } else {
            explanation = tr("Il risparmio va agli obiettivi nell'ordine che scegli.")
        }
        return GoalsCapacityHeader(
            title: capacity <= 0 ? tr("In questo periodo hai speso più di quanto hai incassato.") : tr("Metti da parte {0} al mese.", ["0": money(capacity)]),
            requested: view.requested > 0 ? tr("I tuoi obiettivi ne chiedono {0}.", ["0": money(view.requested)]) : nil,
            explanation: explanation, segments: segments, scaleMax: max(capacity, 0) + view.gap
        )
    }

    /// Bar segment text: «{name} {amount}» or «−{gap}».
    public func segmentText(_ s: GoalsBarSegment) -> String { s.dashed ? "−" + money(s.value) : "\(s.label) \(money(s.value))" }

    /// GOAL-011: sentence of the «Smettere di lavorare» row.
    public func fireSentence(_ fire: GoalsView.Fire) -> String {
        guard let with = fire.withGoalsYear else { return tr("Il traguardo delle Analitiche: al ritmo di oggi non ci arrivi entro 50 anni.") }
        if let base = fire.baseYear, base != with {
            return tr("Il traguardo delle Analitiche: ci arrivi nel {0} con i tuoi obiettivi, nel {1} senza.", ["0": String(with), "1": String(base)])
        }
        return tr("Il traguardo delle Analitiche: ci arrivi nel {0}.", ["0": String(with)])
    }

    /// GOAL-012: stops sorted by date; empty when fewer than 2.
    public func road(_ view: GoalsView) -> [GoalsRoadStop] {
        var stops = view.goals.filter { $0.etaMonth != nil && $0.status != "raggiunto" }.map { g -> GoalsRoadStop in
            let kind = GoalKind(rawValue: g.kind) ?? .altro
            return GoalsRoadStop(key: g.id, when: month(g.etaMonth!), sort: g.etaMonth!, label: g.name, iconKey: kind.iconKey, colorToken: kind.colorToken)
        }
        if let year = view.fire?.withGoalsYear {
            stops.append(GoalsRoadStop(key: "fire", when: String(year), sort: "\(year)-12", label: tr("Smetti di lavorare"),
                                       iconKey: GoalsRules.fireIconKey, colorToken: GoalsRules.fireColorToken))
        }
        guard stops.count >= 2 else { return [] }
        return stops.enumerated().sorted { $0.element.sort != $1.element.sort ? $0.element.sort < $1.element.sort : $0.offset < $1.offset }.map(\.element)
    }

    /// GOAL-027: source row detail («{0} dei {1} sul conto», «… della posizione · imposta stimata {2}», short warning).
    public func sourceDetail(_ s: GoalSourceView) -> String {
        let base = s.kind == "account"
            ? tr("{0} dei {1} sul conto", ["0": money(s.amount), "1": money(s.total)])
            : tr("{0} dei {1} della posizione · imposta stimata {2}", ["0": money(s.amount), "1": money(s.total), "2": money(s.tax)])
        return s.short ? base + " · " + tr("oggi ne trovi solo una parte") : base
    }

    /// GOAL-027: «di {target} · entro {mese anno}» / «di {target}».
    public func targetLine(_ goal: GoalView) -> String {
        goal.targetDate.map { tr("di {0} · entro {1}", ["0": money(goal.target), "1": month($0)]) } ?? tr("di {0}", ["0": money(goal.target)])
    }

    /// GOAL-028: wealth impact (value, caption).
    public func wealthImpact(_ goal: GoalView) -> (value: String, caption: String) {
        if (GoalKind(rawValue: goal.kind) ?? .altro).isKept { return (money(0), tr("i soldi restano tuoi, da parte")) }
        return ("−" + money(goal.target), goal.etaMonth.map { tr("escono a {0}", ["0": month($0)]) } ?? tr("escono quando lo raggiungi"))
    }

    /// Step quanto note (GOAL-016).
    public func requiredNote(_ draft: GoalDraft, todayKey: String, capacity: GoalsFormCapacity?) -> String? {
        guard let month = draft.targetMonth, let required = GoalWizard.requiredMonthly(draft, todayKey: todayKey) else { return nil }
        var text = tr("Per arrivare a {0} servono {1} al mese.", ["0": self.month(month), "1": money(required)])
        if let capacity {
            text += " " + tr("Metti da parte {0} al mese, di cui {1} già presi dagli altri obiettivi.", ["0": money(capacity.total), "1": money(capacity.taken)])
        }
        return text
    }

    /// Step riepilogo rows (GOAL-022).
    public func summaryRows(_ draft: GoalDraft) -> [(label: String, value: String)] {
        [
            (tr("Quanto"), money(draft.target ?? 0)),
            (tr("Entro"), draft.targetMonth.map(month) ?? tr("Nessuna data")),
            (tr("Già da parte"), draft.sources.isEmpty ? tr("Niente, parti da zero") : money(GoalWizard.assignedTotal(draft))),
            (tr("Ogni mese"), money(draft.monthly ?? 0)),
        ]
    }

    /// «Da: Conto deposito 1.500 €, …».
    public func summarySources(_ draft: GoalDraft, names: [String: String]) -> String? {
        guard !draft.sources.isEmpty else { return nil }
        return tr("Da: {0}", ["0": draft.sources.map { "\(names[$0.key] ?? "") \(money($0.amount))" }.joined(separator: ", ")])
    }
}

/// Goals list state. Same fields as `GoalsUiState` on Android.
public struct GoalsUiState: Equatable, Sendable {
    public var view: GoalsView?
    public var failed = false
    public var unavailable = false
    public var reordering = false
    /// Time of the last successful load (5-minute reuse, GOAL-004).
    public var loadedAt: Date?

    public init() {}

    public static let cacheSeconds: TimeInterval = 300

    public var gate: GoalsGate {
        if unavailable { return .unavailable }
        guard let view else { return failed ? .failed : .loading }
        return view.goals.isEmpty ? .empty : .content
    }

    public func isFresh(now: Date) -> Bool {
        guard let loadedAt, view != nil else { return false }
        return now.timeIntervalSince(loadedAt) < Self.cacheSeconds
    }
}
