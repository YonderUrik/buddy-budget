import Foundation

/// Goal kinds (web `GOAL_KINDS`).
public enum GoalKind: String, Sendable, CaseIterable {
    case emergenza, viaggio, casa, acquisto, altro

    /// Name proposed when the kind is picked (`GOAL_KIND_INFO[kind].defaultName`): an Italian catalog source key, "" = none.
    public var defaultName: String {
        switch self {
        case .emergenza: "Fondo di emergenza"
        case .viaggio: "Viaggio"
        case .casa: "Anticipo casa"
        case .acquisto, .altro: ""
        }
    }
}

public enum GoalFormStep: String, Sendable, CaseIterable {
    case tipo, quanto, fonti, ritmo, riepilogo
}

public enum GoalSourceKind: String, Sendable {
    case account, instrument
}

public enum GoalConstants {
    public static let emergencyMonthChoices = [3, 6, 12]
    public static let defaultEmergencyMonths = 6
    public static let maxGoals = 20
    public static let maxGoalSources = 12
}

/// A key/amount pair of the draft's sources; kept as an ordered list to mirror JS object insertion order.
public struct GoalDraftSource: Hashable, Sendable {
    public var key: String
    public var amount: Double
    public init(key: String, amount: Double) {
        self.key = key
        self.amount = amount
    }
}

/// Wizard draft (web `GoalDraft`).
public struct GoalDraft: Hashable, Sendable {
    public var kind: GoalKind?
    public var name: String
    public var target: Double?
    public var emergencyMonths: Int?
    /// `YYYY-MM` or nil.
    public var targetMonth: String?
    public var monthly: Double?
    /// Assigned amounts per `account:id` / `instrument:id`, in insertion order.
    public var sources: [GoalDraftSource]
    public var priority: Int
    /// GOAL-017 (web #382): monthly spending typed for the emergency fund; nil = the one computed from the movements.
    public var monthlySpend: Double?

    public init(kind: GoalKind? = nil, name: String = "", target: Double? = nil, emergencyMonths: Int? = nil,
                targetMonth: String? = nil, monthly: Double? = nil, sources: [GoalDraftSource] = [], priority: Int = 0,
                monthlySpend: Double? = nil) {
        self.monthlySpend = monthlySpend
        self.kind = kind
        self.name = name
        self.target = target
        self.emergencyMonths = emergencyMonths
        self.targetMonth = targetMonth
        self.monthly = monthly
        self.sources = sources
        self.priority = priority
    }

    /// JS object semantics: setting an existing key keeps its position.
    public mutating func setSource(_ key: String, _ amount: Double) {
        if let i = sources.firstIndex(where: { $0.key == key }) { sources[i].amount = amount } else { sources.append(.init(key: key, amount: amount)) }
    }
}

/// Free part of an account / position (web `FreeSource`).
public struct GoalFreeSource: Hashable, Sendable {
    public var kind: GoalSourceKind
    public var id: String
    public var name: String
    public var total: Double
    public var free: Double
    public var taxPerEuro: Double
    public init(kind: GoalSourceKind, id: String, name: String, total: Double, free: Double, taxPerEuro: Double) {
        self.kind = kind
        self.id = id
        self.name = name
        self.total = total
        self.free = free
        self.taxPerEuro = taxPerEuro
    }
}

/// Source already assigned to an existing goal (subset of web `GoalSourceView`).
public struct GoalAssignedSource: Hashable, Sendable {
    public var kind: GoalSourceKind
    public var refId: String
    public var amount: Double
    public var counted: Double
    public var tax: Double
    public init(kind: GoalSourceKind, refId: String, amount: Double, counted: Double, tax: Double) {
        self.kind = kind
        self.refId = refId
        self.amount = amount
        self.counted = counted
        self.tax = tax
    }
}

/// Existing goal fields the wizard reads (subset of web `GoalView`).
public struct GoalWizardGoal: Hashable, Sendable {
    public var kind: GoalKind
    public var name: String
    public var target: Double
    public var targetDate: String?
    public var monthly: Double
    public var priority: Int
    public var sources: [GoalAssignedSource]
    public init(kind: GoalKind, name: String, target: Double, targetDate: String?, monthly: Double, priority: Int, sources: [GoalAssignedSource]) {
        self.kind = kind
        self.name = name
        self.target = target
        self.targetDate = targetDate
        self.monthly = monthly
        self.priority = priority
        self.sources = sources
    }
}

public struct GoalPayloadSource: Hashable, Sendable {
    public var accountId: String?
    public var instrumentId: String?
    public var amount: Double
    public init(accountId: String?, instrumentId: String?, amount: Double) {
        self.accountId = accountId
        self.instrumentId = instrumentId
        self.amount = amount
    }
}

/// Body of `POST /api/goals` (web `GoalPayload`).
public struct GoalPayload: Hashable, Sendable {
    public var name: String
    public var kind: GoalKind
    public var targetAmount: Double
    public var targetDate: String?
    public var monthlyAmount: Double
    public var priority: Int
    public var sources: [GoalPayloadSource]
    public init(name: String, kind: GoalKind, targetAmount: Double, targetDate: String?, monthlyAmount: Double, priority: Int,
                sources: [GoalPayloadSource]) {
        self.name = name
        self.kind = kind
        self.targetAmount = targetAmount
        self.targetDate = targetDate
        self.monthlyAmount = monthlyAmount
        self.priority = priority
        self.sources = sources
    }
}

/// Goal-creation wizard maths, ported 1:1 from components/domain/goals/goal-form-state.ts.
public enum GoalWizard {
    public static func sourceKey(_ kind: GoalSourceKind, _ id: String) -> String { "\(kind.rawValue):\(id)" }

    public static func initialDraft(_ goal: GoalWizardGoal?, goalsCount: Int) -> GoalDraft {
        guard let goal else { return GoalDraft(priority: goalsCount) }
        return GoalDraft(kind: goal.kind, name: goal.name, target: goal.target, emergencyMonths: nil,
                         targetMonth: goal.targetDate.map { String($0.prefix(7)) }, monthly: goal.monthly,
                         sources: goal.sources.reduce(into: GoalDraft().sources) { acc, s in
                             let key = sourceKey(s.kind, s.refId)
                             if let i = acc.firstIndex(where: { $0.key == key }) { acc[i].amount = s.amount } else { acc.append(.init(key: key, amount: s.amount)) }
                         },
                         priority: goal.priority)
    }

    /// Changes the kind: proposes the kind's name unless the user typed their own; for "emergenza", months of expenses.
    public static func withKind(_ draft: GoalDraft, _ kind: GoalKind, essentialMonthly: Double?) -> GoalDraft {
        let previousDefault = draft.kind?.defaultName ?? ""
        var next = draft
        next.kind = kind
        next.name = JSNumber.trim(draft.name) == "" || draft.name == previousDefault ? kind.defaultName : draft.name
        if kind == .emergenza, draft.target == nil {
            // Without computed spending the months stay chosen: the amount comes when the user types the spending (web #382).
            next.emergencyMonths = GoalConstants.defaultEmergencyMonths
            next.target = essentialMonthly.map { emergencyTarget(essentialMonthly: $0, months: Double(GoalConstants.defaultEmergencyMonths)) }
            return next
        }
        next.emergencyMonths = kind == .emergenza ? draft.emergencyMonths : nil
        return next
    }

    /// GOAL-017: the monthly spending the emergency fund uses — typed by the user, else computed from the movements.
    public static func emergencySpend(_ draft: GoalDraft, essentialMonthly: Double?) -> Double? { draft.monthlySpend ?? essentialMonthly }

    /// GOAL-017: a months chip; the target follows when a spending figure exists.
    public static func withEmergencyMonths(_ draft: GoalDraft, months: Int, essentialMonthly: Double?) -> GoalDraft {
        var next = draft
        next.emergencyMonths = months
        if let spend = emergencySpend(draft, essentialMonthly: essentialMonthly) { next.target = emergencyTarget(essentialMonthly: spend, months: Double(months)) }
        return next
    }

    /// GOAL-017: `Spese al mese` typed; the target follows with the chosen months.
    public static func withMonthlySpend(_ draft: GoalDraft, value: Double?) -> GoalDraft {
        var next = draft
        next.monthlySpend = value
        if let value, let months = draft.emergencyMonths { next.target = emergencyTarget(essentialMonthly: value, months: Double(months)) }
        return next
    }

    /// GOAL-017: the note under `Spese al mese` (Italian source) by where the figure comes from.
    public static func spendNote(_ draft: GoalDraft, essentialBasis: String?) -> String {
        if draft.monthlySpend != nil || essentialBasis == nil { return "Scrivi quanto spendi in un mese: la cifra si aggiorna da sola." }
        if essentialBasis == "dovute" { return "Media delle tue spese dovute e saltuarie degli ultimi mesi (casa, bollette, spesa, rate). Puoi cambiarla." }
        return "Media di tutte le tue uscite degli ultimi mesi: molte non hanno ancora una categoria, quindi è una stima larga. Puoi cambiarla."
    }

    /// Emergency fund amount: months of essential spending, rounded to hundreds.
    public static func emergencyTarget(essentialMonthly: Double, months: Double) -> Double {
        JSNumber.round((essentialMonthly * months) / 100) * 100
    }

    /// Selectable sources with the free part as seen by `goal` (its own share becomes available again).
    public static func availableSources(_ sources: [GoalFreeSource], goal: GoalWizardGoal?) -> [GoalFreeSource] {
        var own: [String: Double] = [:]
        for s in goal?.sources ?? [] { own[sourceKey(s.kind, s.refId)] = s.counted + s.tax }
        return sources.map { s -> GoalFreeSource in
            var copy = s
            copy.free = s.free + (own[sourceKey(s.kind, s.id)] ?? 0)
            return copy
        }.filter { $0.total > 0 || own[sourceKey($0.kind, $0.id)] != nil }
    }

    /// Gross amount assigned in the draft.
    public static func assignedTotal(_ draft: GoalDraft) -> Double {
        draft.sources.reduce(0) { $0 + $1.amount }
    }

    /// True when the money already assigned covers the target.
    public static func isCovered(_ draft: GoalDraft) -> Bool {
        guard let target = draft.target else { return false }
        return target > 0 && assignedTotal(draft) >= target
    }

    /// Monthly amount needed to arrive on time from what is already assigned; nil without a date.
    public static func requiredMonthly(_ draft: GoalDraft, todayKey: String) -> Double? {
        guard let targetMonth = draft.targetMonth, !targetMonth.isEmpty, let target = draft.target else { return nil }
        let left = max(0, target - assignedTotal(draft))
        return (left / Double(max(1, Periods.monthsBetween(todayKey, targetMonth)))).rounded(.up)
    }

    /// JS `string.trim().length` (UTF-16 code units).
    static func jsLength(_ s: String) -> Int { JSNumber.trim(s).utf16.count }

    public static func canAdvance(_ step: GoalFormStep, _ draft: GoalDraft, todayKey: String) -> Bool {
        switch step {
        case .tipo:
            return draft.kind != nil && jsLength(draft.name) > 0 && jsLength(draft.name) <= 80
        case .quanto:
            guard let target = draft.target, target > 0 else { return false }
            guard let month = draft.targetMonth else { return true }
            return month > String(todayKey.prefix(7))
        case .fonti:
            return draft.sources.count <= GoalConstants.maxGoalSources && draft.sources.allSatisfy { $0.amount > 0 }
        case .ritmo:
            return (draft.monthly.map { $0 >= 0 } ?? false) || isCovered(draft)
        case .riepilogo:
            return true
        }
    }

    /// Draft ready for the API (the draft must have a kind).
    public static func toPayload(_ draft: GoalDraft) -> GoalPayload {
        GoalPayload(
            name: JSNumber.trim(draft.name),
            kind: draft.kind!,
            targetAmount: draft.target ?? 0,
            targetDate: draft.targetMonth.flatMap { $0.isEmpty ? nil : "\($0)-01" },
            monthlyAmount: draft.monthly ?? 0,
            priority: draft.priority,
            sources: draft.sources.map { s in
                let parts = s.key.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
                let id = parts.count > 1 ? parts[1] : ""
                return parts[0] == "account" ? GoalPayloadSource(accountId: id, instrumentId: nil, amount: s.amount)
                    : GoalPayloadSource(accountId: nil, instrumentId: id, amount: s.amount)
            }
        )
    }
}
