import Foundation

// The German plan document as the app edits it (13-planning-de §2, PLAN-007…017): typed access to the tax profile on
// top of the verbatim JSON tree, the full client-side validation (port of zod `germanPlanSchema`), numeric input
// clamping and the save-bar state machine. Results come from the server (ADR 0002). Same names on Android.

/// Fund tax classes in the order of the web select (`FUND_OPTIONS`).
public enum GermanFundKinds {
    public static let all = ["unknown", "equity", "mixed", "property", "foreign-property", "other"]
}

/// The visible tax inputs (`plan.tax`, PLAN-018, PLAN-019, PLAN-025, PLAN-026). `year` and `futureForecast` are not
/// edited on mobile and stay as saved (PLAN-031).
public struct GermanTaxSettings: Equatable, Sendable {
    public var joint = false
    /// 0, 0.08 or 0.09.
    public var churchRate: Double = 0
    public var allowanceUsedElsewhere: Double = 0
    public var verifiedForeignCredit: Double = 0
    public var shareLosses: Double = 0
    public var generalLosses: Double = 0
    public var otherCapitalIncome: Double = 0
    public var historyConfirmed = false
    /// Instrument id → fund kind (missing = `unknown`).
    public var fundKinds: [String: String] = [:]
    /// Sale transaction id → gross prior advances (EUR).
    public var priorAdvancesBySale: [String: Double] = [:]
    public var fundHistoryConfirmed = false

    public init() {}

    /// Reads `plan.tax`, with the schema defaults for missing keys.
    public init(plan: JSONNode) {
        let tax = plan["tax"]
        joint = tax?["joint"]?.bool ?? false
        churchRate = tax?["churchRate"]?.double ?? 0
        allowanceUsedElsewhere = tax?["allowanceUsedElsewhere"]?.double ?? 0
        verifiedForeignCredit = tax?["verifiedForeignCredit"]?.double ?? 0
        shareLosses = tax?["shareLosses"]?.double ?? 0
        generalLosses = tax?["generalLosses"]?.double ?? 0
        otherCapitalIncome = tax?["otherCapitalIncome"]?.double ?? 0
        historyConfirmed = tax?["historyConfirmed"]?.bool ?? false
        fundKinds = (tax?["fundKinds"]?.object ?? [:]).compactMapValues { $0.string }
        priorAdvancesBySale = (tax?["priorAdvancesBySale"]?.object ?? [:]).compactMapValues { $0.double }
        fundHistoryConfirmed = tax?["fundHistoryConfirmed"]?.bool ?? false
    }

    public func fundKind(_ instrumentId: String) -> String { fundKinds[instrumentId] ?? "unknown" }
    public func priorAdvances(_ saleId: String) -> Double { priorAdvancesBySale[saleId] ?? 0 }

    /// `plan` with these settings written into `plan.tax`; every other key of the document (hidden sections, `year`,
    /// `futureForecast`, unknown future keys) is kept as it was (PLAN-014, PLAN-031).
    public func applied(to plan: JSONNode) -> JSONNode {
        var root = plan.object ?? [:]
        var tax = root["tax"]?.object ?? [:]
        tax["joint"] = .bool(joint)
        tax["churchRate"] = .number(churchRate)
        tax["allowanceUsedElsewhere"] = .number(allowanceUsedElsewhere)
        tax["verifiedForeignCredit"] = .number(verifiedForeignCredit)
        tax["shareLosses"] = .number(shareLosses)
        tax["generalLosses"] = .number(generalLosses)
        tax["otherCapitalIncome"] = .number(otherCapitalIncome)
        tax["historyConfirmed"] = .bool(historyConfirmed)
        tax["fundKinds"] = .object(fundKinds.mapValues { .string($0) })
        tax["priorAdvancesBySale"] = .object(priorAdvancesBySale.mapValues { .number($0) })
        tax["fundHistoryConfirmed"] = .bool(fundHistoryConfirmed)
        root["tax"] = .object(tax)
        return .object(root)
    }
}

// MARK: - Numeric inputs (PLAN-015)

/// Web `NumberField`: min (default 0), max (default 1e12), empty or invalid text → 0, values clamped as typed;
/// percent fields are typed in % and stored as fractions.
public enum PlanningNumberInput {
    public static let defaultMax = 1e12

    /// The stored value for the typed text.
    public static func value(text: String, min: Double = 0, max: Double = defaultMax, percent: Bool = false) -> Double {
        let typed = BBFormat.parseAmount(text) ?? 0
        let clamped = Swift.max(min, Swift.min(max, typed.isFinite ? typed : 0))
        return percent ? clamped / 100 : clamped
    }

    /// Text shown for a stored value (web `Number(value.toFixed(8))`), with the locale decimal separator, no grouping.
    public static func text(_ value: Double, locale: BBLocale, percent: Bool = false) -> String {
        let shown = percent ? value * 100 : value
        var s = String(format: "%.8f", shown)
        while s.hasSuffix("0") { s.removeLast() }
        if s.hasSuffix(".") { s.removeLast() }
        if s == "-0" { s = "0" }
        return locale == .enGB ? s : s.replacingOccurrences(of: ".", with: ",")
    }

    /// True when the typed text is outside the limits, i.e. the field must show the clamped value instead.
    public static func needsClamp(text: String, min: Double = 0, max: Double = defaultMax) -> Bool {
        guard let typed = BBFormat.parseAmount(text) else { return false }
        return typed < min || typed > max
    }
}

// MARK: - Validation (PLAN-011)

/// Port of zod `germanPlanSchema` (`lib/financial-planning/schema.ts`): strict objects (unknown keys rejected), every
/// field optional with its default, ranges, integers, enums, and the plan-level refinements. `true` = the server
/// accepts the document.
public enum GermanPlanValidation {
    public static func isValid(_ plan: JSONNode) -> Bool {
        guard let root = plan.object else { return false }
        let v = Validator()
        v.object(plan, [
            "version": { v.literal($0, 1) },
            "country": { v.stringLiteral($0, "DE") },
            "tax": { v.taxProfile($0) },
            "fund": { v.fundScenario($0) },
            "pensions": { v.array($0, max: 100) { v.pension($0) } },
            "pensionTax": { v.pensionTax($0) },
            "retirement": { v.retirement($0) },
            "crypto": { v.array($0, max: 1000) { v.cryptoSale($0) } },
            "cryptoOtherGains": { v.number($0, min: -1e12, max: 1e12) },
            "cryptoLossCarryforward": { v.money($0) },
            "otherTaxableIncome": { v.money($0) },
        ])
        guard v.ok else { return false }
        // superRefine, on the values with defaults applied.
        let year = root["tax"]?["year"]?.double ?? 2026
        let pensions = root["pensions"]?.array ?? []
        let activeAvd = pensions.filter { $0["kind"]?.string == "avd" && ($0["avd"]?["enabled"]?.bool ?? false) }
        if activeAvd.count > 1 { return false }
        for p in activeAvd {
            let years = p["yearsUntilPayment"]?.double ?? 0
            let avd = p["avd"]
            let start = avd?["payoutStartAge"]?.double ?? 67
            let age = avd?["ageAtStart"]?.double ?? 40
            let contributionStart = avd?["contributionStartYear"]?.double ?? 2027
            if years != start - age + contributionStart - year { return false }
            if year + years <= contributionStart { return false }
        }
        let pensionTax = root["pensionTax"]
        if (pensionTax?["childless"]?.bool ?? false) && (pensionTax?["childrenUnder25"]?.double ?? 0) > 0 { return false }
        for key in ["pensions", "crypto"] {
            var ids = Set<String>()
            for item in root[key]?.array ?? [] {
                let id = item["id"]?.string ?? ""
                if ids.contains(id) { return false }
                ids.insert(id)
            }
        }
        return true
    }

    private final class Validator {
        var ok = true

        func fail() { ok = false }

        /// Strict object: unknown keys fail, missing keys take their default (not checked).
        func object(_ node: JSONNode?, _ fields: [String: (JSONNode) -> Void]) {
            guard let node else { return }
            guard let o = node.object else { return fail() }
            for (key, value) in o {
                guard let check = fields[key] else { return fail() }
                check(value)
            }
        }

        /// Required-object variant used for object values that are present.
        func requiredKeys(_ node: JSONNode, _ keys: [String]) {
            guard let o = node.object else { return fail() }
            for key in keys where o[key] == nil { fail() }
        }

        func number(_ node: JSONNode, min: Double, max: Double, int: Bool = false) {
            guard let n = node.double, n.isFinite, n >= min, n <= max else { return fail() }
            if int, n.rounded() != n { fail() }
        }

        func nullableNumber(_ node: JSONNode, min: Double, max: Double, int: Bool = false) {
            if node.isNull { return }
            number(node, min: min, max: max, int: int)
        }

        func money(_ node: JSONNode, max: Double = 1e12) { number(node, min: 0, max: max) }
        func rate(_ node: JSONNode, max: Double = 1) { number(node, min: 0, max: max) }
        func int(_ node: JSONNode, _ min: Double, _ max: Double) { number(node, min: min, max: max, int: true) }

        func bool(_ node: JSONNode) { if node.bool == nil { fail() } }

        func literal(_ node: JSONNode, _ value: Double) { if node.double != value { fail() } }
        func stringLiteral(_ node: JSONNode, _ value: String) { if node.string != value { fail() } }

        func oneOf(_ node: JSONNode, _ values: [String]) {
            guard let s = node.string, values.contains(s) else { return fail() }
        }

        /// `z.string().trim().min(1).max(100)` (lengths in UTF-16 units, as in JavaScript).
        func name(_ node: JSONNode) {
            guard let s = node.string else { return fail() }
            let n = s.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count
            if n < 1 || n > 100 { fail() }
        }

        func id(_ node: JSONNode) {
            guard let s = node.string, (1...100).contains(s.utf16.count) else { return fail() }
        }

        /// `z.iso.date()`: `YYYY-MM-DD`, a real calendar day.
        func date(_ node: JSONNode) {
            guard let s = node.string, GermanPlanValidation.isISODate(s) else { return fail() }
        }

        func array(_ node: JSONNode, max: Int, _ each: (JSONNode) -> Void) {
            guard let a = node.array, a.count <= max else { return fail() }
            a.forEach(each)
        }

        func record(_ node: JSONNode, _ value: (JSONNode) -> Void) {
            guard let o = node.object else { return fail() }
            for (key, v) in o {
                if key.utf16.count > 100 { fail() }
                value(v)
            }
        }

        func taxProfile(_ node: JSONNode) {
            object(node, [
                "year": { self.literal($0, 2026) },
                "futureForecast": { self.oneOf($0, ["verified", "constant-2026"]) },
                "joint": { self.bool($0) },
                "churchRate": { n in if ![0, 0.08, 0.09].contains(n.double ?? -1) { self.fail() } },
                "allowanceUsedElsewhere": { self.money($0) },
                "shareLosses": { self.money($0) },
                "generalLosses": { self.money($0) },
                "otherCapitalIncome": { self.money($0) },
                "verifiedForeignCredit": { self.money($0) },
                "historyConfirmed": { self.bool($0) },
                "fundKinds": { self.record($0) { self.oneOf($0, GermanFundKinds.all) } },
                "priorAdvancesBySale": { self.record($0) { self.money($0) } },
                "fundHistoryConfirmed": { self.bool($0) },
            ])
        }

        func fundScenario(_ node: JSONNode) {
            object(node, [
                "kind": { self.oneOf($0, GermanFundKinds.all) },
                "startValue": { self.money($0) },
                "endValue": { self.money($0) },
                "distributions": { self.money($0) },
                "acquisitionMonth": { self.int($0, 1, 12) },
            ])
        }

        func avd(_ node: JSONNode) {
            object(node, [
                "enabled": { self.bool($0) },
                "contributionStartYear": { self.int($0, 2027, 2100) },
                "eligibility": { self.oneOf($0, ["none", "direct", "indirect"]) },
                "spouseAnnualContribution": { self.money($0, max: 6840) },
                "childAllowanceYears": { self.array($0, max: 20) { self.int($0, 0, 30) } },
                "starterBonus": { self.bool($0) },
                "ageAtStart": { self.int($0, 18, 100) },
                "taxableIncomeBeforeDeduction": { self.money($0) },
                "payout": { self.oneOf($0, ["provider", "drawdown"]) },
                "payoutStartAge": { self.int($0, 65, 70) },
                "payoutEndAge": { self.int($0, 85, 120) },
                "lumpSumRate": { self.rate($0, max: 0.3) },
                "payoutReturn": { self.number($0, min: -0.5, max: 0.3) },
            ])
            guard ok, node.object != nil else { return }
            if node["payout"]?.string == "drawdown", (node["payoutEndAge"]?.double ?? 85) <= (node["payoutStartAge"]?.double ?? 67) { fail() }
        }

        func pension(_ node: JSONNode) {
            requiredKeys(node, ["id", "name", "kind"])
            object(node, [
                "id": { self.id($0) },
                "name": { self.name($0) },
                "kind": { self.oneOf($0, ["statutory", "occupational", "riester", "ruerup", "private", "avd"]) },
                "capital": { self.money($0) },
                "monthlyContribution": { self.money($0) },
                "monthlyGross": { self.money($0) },
                "yearsUntilPayment": { self.int($0, 0, 80) },
                "nominalReturn": { self.number($0, min: -0.5, max: 0.3) },
                "points": { self.money($0, max: 1000) },
                "annualPoints": { self.money($0, max: 10) },
                "accessFactor": { self.number($0, min: 0, max: 2) },
                "taxTreatment": { self.oneOf($0, ["unknown", "funded", "private-annuity", "statement"]) },
                "taxableAnnualFromStatement": { self.money($0) },
                "pensionStartYear": { self.nullableNumber($0, min: 1900, max: 2200, int: true) },
                "taxFreeAnnualAmount": { self.nullableNumber($0, min: 0, max: 1e12) },
                "ageAtPayment": { self.int($0, 0, 120) },
                "avd": { self.avd($0) },
                "paymentMode": { self.oneOf($0, ["income", "capital"]) },
            ])
            guard ok else { return }
            let kind = node["kind"]?.string ?? ""
            if kind == "avd", node["avd"]?["enabled"]?.bool ?? false, (node["monthlyContribution"]?.double ?? 0) * 12 > 6840 { fail() }
            if ["statutory", "ruerup", "riester", "avd"].contains(kind), (node["paymentMode"]?.string ?? "income") != "income" { fail() }
        }

        func pensionTax(_ node: JSONNode) {
            object(node, [
                "mode": { self.oneOf($0, ["manual", "rules"]) },
                "insurance": { self.oneOf($0, ["kvdr", "voluntary", "private"]) },
                "additionalHealthRate": { self.rate($0, max: 0.1) },
                "childless": { self.bool($0) },
                "childrenUnder25": { self.int($0, 0, 20) },
                "otherInsuranceIncome": { self.money($0) },
                "voluntarySubsidy": { self.bool($0) },
                "annualPrivatePremium": { self.money($0) },
                "annualDeductiblePremium": { self.money($0) },
                "surchargeChildAllowance": { self.money($0) },
                "otherTaxableIncome": { self.money($0) },
                "otherDeductions": { self.money($0) },
            ])
        }

        func retirement(_ node: JSONNode) {
            object(node, [
                "liquidCapital": { self.money($0) },
                "annualSaving": { self.money($0) },
                "annualSpending": { self.money($0) },
                "yearsUntilRetirement": { self.int($0, 0, 80) },
                "realReturn": { self.number($0, min: -0.5, max: 0.3) },
                "withdrawalRate": { self.number($0, min: 0.005, max: 0.2) },
                "inflation": { self.number($0, min: 0, max: 0.2) },
                "pensionDeductionRate": { self.rate($0) },
                "withdrawalTaxShare": { self.rate($0, max: 0.9) },
            ])
        }

        func cryptoSale(_ node: JSONNode) {
            requiredKeys(node, ["id", "name", "acquired", "sold", "proceeds", "cost"])
            object(node, [
                "id": { self.id($0) },
                "name": { self.name($0) },
                "acquired": { self.date($0) },
                "sold": { self.date($0) },
                "proceeds": { self.money($0) },
                "cost": { self.money($0) },
                "fees": { self.money($0) },
            ])
            guard ok else { return }
            let acquired = node["acquired"]?.string ?? ""
            let sold = node["sold"]?.string ?? ""
            if sold < acquired || !sold.hasPrefix("2026-") { fail() }
        }
    }

    static func isISODate(_ s: String) -> Bool {
        let parts = s.split(separator: "-", omittingEmptySubsequences: false)
        guard s.utf8.count == 10, parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              parts.allSatisfy({ $0.allSatisfy { $0.isASCII && $0.isNumber } }),
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]), (1...12).contains(m), d >= 1 else { return false }
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
        let days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
        return d <= days
    }
}

// MARK: - Save bar (PLAN-010…014)

/// Messages of the save bar (web `role="alert"` lines).
public enum GermanPlanMessage: Equatable, Sendable {
    /// 409 `plan_changed` (PLAN-013).
    case conflict
    /// Any other failure; edits are kept.
    case failed

    public var key: String {
        switch self {
        case .conflict: return "This plan changed in another tab. Reload before saving."
        case .failed: return "Could not save. Your changes are still here."
        }
    }
}

/// The editor of the plan document: the saved plan and revision, the edited draft and the save state. One per
/// signed-in DE user, shared by the Tax and Income tabs; Income always shows the saved plan's results.
public struct GermanPlanEditor: Equatable, Sendable {
    public private(set) var saved: JSONNode
    public private(set) var revision: Int
    public private(set) var draft: JSONNode
    public private(set) var saving = false
    public private(set) var message: GermanPlanMessage?

    public init(plan: JSONNode, revision: Int) {
        saved = plan
        self.revision = revision
        draft = plan
    }

    public var tax: GermanTaxSettings { GermanTaxSettings(plan: draft) }
    public var isDirty: Bool { draft != saved }
    public var isValid: Bool { GermanPlanValidation.isValid(draft) }
    /// PLAN-010: enabled only when changed, valid and not saving.
    public var canSave: Bool { !saving && isDirty && isValid }
    /// `Unsaved changes` / `Plan saved`.
    public var statusKey: String { isDirty ? "Unsaved changes" : "Plan saved" }
    /// `Save plan` / `Saving…`.
    public var buttonKey: String { saving ? "Saving…" : "Save plan" }
    /// PLAN-011.
    public var validationKey: String? { isValid ? nil : "Check the entered names, dates and numeric limits before saving." }

    public mutating func updateTax(_ change: (inout GermanTaxSettings) -> Void) {
        var tax = self.tax
        change(&tax)
        draft = tax.applied(to: draft)
    }

    /// Starts a save: the body to send (`{plan, revision}`), or nil when saving is not allowed.
    public mutating func beginSave() -> (plan: JSONNode, revision: Int)? {
        guard canSave else { return nil }
        saving = true
        message = nil
        return (draft, revision)
    }

    /// PLAN-012: adopt the server's plan and revision; the editor resets to the saved state.
    public mutating func saveSucceeded(plan: JSONNode, revision: Int) {
        saved = plan
        self.revision = revision
        draft = plan
        saving = false
        message = nil
    }

    /// PLAN-013: keep the edits, show why.
    public mutating func saveFailed(conflict: Bool) {
        saving = false
        message = conflict ? .conflict : .failed
    }

    /// Unsaved-changes sheet «Discard»: back to the saved plan.
    public mutating func discard() {
        draft = saved
        message = nil
    }

    /// A fresh load (first load, pull to refresh, 409 «Reload»): replaces saved, revision and draft.
    public mutating func reload(plan: JSONNode, revision: Int) {
        saved = plan
        self.revision = revision
        draft = plan
        saving = false
        message = nil
    }
}
