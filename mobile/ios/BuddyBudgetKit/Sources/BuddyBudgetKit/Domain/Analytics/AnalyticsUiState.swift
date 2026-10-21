import Foundation

// Analitiche «Risposte» state and rules (spec: features/11-analytics.md). The server sends the saved assumptions and
// the data base (`GET /api/analytics/base`); every slider move re-runs `FirePlanning.resolvePlan` on the device, Monte
// Carlo runs off the main thread with the web's seed. Same names on Android (`AnalyticsUiState.kt`).

/// A translated validation message.
public struct AnalyticsMessage: Error, Equatable, Sendable {
    public let text: String
    public init(_ text: String) { self.text = text }
}

extension CatalogText: Error {}

/// What the Risposte screen shows (shared "view gate").
public enum AnalyticsGate: Equatable, Sendable {
    case loading, failed, unavailable, content
}

/// Data-period picker choice (ANA-011).
public enum AnalyticsPeriodChoice: String, CaseIterable, Sendable {
    case twelve = "12"
    case twentyFour = "24"
    case custom = "personalizzato"

    public var label: String {
        switch self {
        case .twelve: "12 mesi"
        case .twentyFour: "24 mesi"
        case .custom: "Scegli i mesi"
        }
    }

    public init(_ period: DataPeriod) {
        switch period {
        case .personalizzato: self = .custom
        case .ultimi(let months): self = months == 24 ? .twentyFour : .twelve
        }
    }
}

/// One point of the «Quando arrivi» chart.
public struct AnalyticsTimelinePoint: Hashable, Sendable {
    public let year: Int
    public let wealth: Double
}

/// A sensitivity table (rows × columns of years to FIRE, the user's cell in the middle).
public struct AnalyticsSensitivityTable: Hashable, Sendable {
    public let rows: [String]
    public let columns: [String]
    public let cells: [[FireSensitivityCell]]
}

public enum AnalyticsRules {
    /// `MIN_INVESTED_FOR_ESTIMATE`.
    public static let minInvestedForEstimate = 1000.0
    /// Years over which costs erode the portfolio (`COST_DRAG_YEARS`).
    public static let costDragYears = 30
    public static let timelineExtraYears = 3
    public static let timelineMaxYears = 60
    public static let timelineDefaultYears = 30
    /// Custom period: 3 months to 10 years (`CUSTOM_PERIOD_LIMITS`).
    public static let customPeriodMinMonths = 3
    public static let customPeriodMaxMonths = 120
    /// Years offered in the custom period selects.
    public static let periodYearsBack = 10
    static let rateSteps = [-0.01, -0.005, 0, 0.005, 0.01]
    static let returnSteps = [-0.02, -0.01, 0, 0.01, 0.02]
    static let spendingChanges = [-0.2, -0.1, 0, 0.1, 0.2]
    static let savingChanges = [-0.2, -0.1, 0, 0.1, 0.2]

    /// Integer as text («40»).
    public static func intText(_ value: Double) -> String { String(Int(JSNumber.round(value))) }

    /// `RULE_LABELS` (Italian source).
    public static func ruleLabel(_ rule: WithdrawalRule) -> String {
        switch rule {
        case .fissa: "Fissa (stessa spesa ogni anno)"
        case .percentuale: "Percentuale del patrimonio"
        case .guytonKlinger: "Guyton-Klinger (semplificata)"
        case .vanguard: "Vanguard dinamica"
        }
    }

    /// Glossary id of each rule chip.
    public static func ruleTerm(_ rule: WithdrawalRule) -> String {
        switch rule {
        case .fissa: "regola-fissa"
        case .percentuale: "regola-percentuale"
        case .guytonKlinger: "regola-gk"
        case .vanguard: "regola-vanguard"
        }
    }

    // MARK: Sliders (ANA-014…019)

    /// Starting value of a slider: plan figures for money, assumptions for rates.
    public static func baseline(_ field: FireScenarioField, plan: FirePlan, assumptions: FireAssumptions) -> Double? {
        switch field {
        case .annualSavings: plan.savings
        case .annualSpending: plan.spending
        case .expectedReturn: assumptions.expectedReturn
        case .withdrawalRate: assumptions.withdrawalRate
        }
    }

    /// Value set by a slider move: back onto the baseline (within half a step) clears the override.
    public static func override(_ value: Double, baseline: Double?, spec: FireSliderSpec) -> Double? {
        abs(value - (baseline ?? value)) < spec.step / 2 ? nil : value
    }

    /// Snaps a slider position to its step.
    public static func snap(_ value: Double, spec: FireSliderSpec) -> Double {
        let steps = JSNumber.round((value - spec.min) / spec.step)
        let snapped = spec.min + steps * spec.step
        return min(max(JSNumber.round(snapped * 1e9) / 1e9, spec.min), spec.max)
    }

    public static func overrides(_ overrides: FireScenarioOverrides, setting field: FireScenarioField, to value: Double?) -> FireScenarioOverrides {
        var next = overrides
        switch field {
        case .annualSavings: next.annualSavings = value
        case .annualSpending: next.annualSpending = value
        case .expectedReturn: next.expectedReturn = value
        case .withdrawalRate: next.withdrawalRate = value
        }
        return next
    }

    public static func value(_ overrides: FireScenarioOverrides, _ field: FireScenarioField) -> Double? {
        switch field {
        case .annualSavings: overrides.annualSavings
        case .annualSpending: overrides.annualSpending
        case .expectedReturn: overrides.expectedReturn
        case .withdrawalRate: overrides.withdrawalRate
        }
    }

    /// Years to FIRE with only this field moved (the delta under a slider, ANA-015).
    public static func yearsWithField(_ field: FireScenarioField, value: Double, plan: FirePlan, assumptions: FireAssumptions) -> Double? {
        FirePlanning.yearsToFireWith(plan, assumptions, Self.overrides(FireScenarioOverrides(), setting: field, to: value))
    }

    /// ANA-016: «Usa il tuo ({x}%)» offer when the return was written by hand and a history exists.
    public static func historyOffer(_ info: FireExpectedReturnInfo) -> Double? {
        guard info.source == .manuale, let real = info.historyReal else { return nil }
        let lim = FireAssumptionLimits.expectedReturn
        return min(max(real, lim.min), lim.max)
    }

    // MARK: Data period (ANA-011…013)

    /// Default custom range: the last 12 complete months.
    public static func defaultCustomRange(today: CalendarDate) -> (from: String, to: String) {
        let lastFull = today.addingMonthsOverflow(-1)
        return (lastFull.addingMonthsOverflow(-11).monthKey, lastFull.monthKey)
    }

    /// Years in the custom selects: this year and the 10 before.
    public static func pickerYears(today: CalendarDate) -> [Int] { (0...periodYearsBack).map { today.year - $0 } }

    /// ANA-012: validation message (Italian source + values), nil when valid.
    public static func customPeriodError(from: String, to: String, today: CalendarDate) -> CatalogText? {
        let span = Periods.monthSpan(from, to)
        if to > today.addingMonthsOverflow(-1).monthKey { return CatalogText("Il mese in corso non è finito: fermati al mese scorso.") }
        if span < customPeriodMinMonths { return CatalogText("Scegli almeno {0} mesi.", ["0": String(customPeriodMinMonths)]) }
        if span > customPeriodMaxMonths { return CatalogText("Scegli al massimo 10 anni.") }
        return nil
    }

    // MARK: Charts and tables

    /// «Quando arrivi»: wealth year by year up to a little past the target (`timelineSeries`).
    public static func timelineSeries(_ plan: FirePlan, _ a: FireAssumptions) -> [AnalyticsTimelinePoint] {
        let horizon = plan.yearsToFire.map { min(Int($0.rounded(.up)) + timelineExtraYears, timelineMaxYears) } ?? timelineDefaultYears
        let growth = FireGrowthInput(current: plan.wealth, annualSaving: plan.savings ?? 0, realReturn: a.expectedReturn)
        return (0...horizon).map { AnalyticsTimelinePoint(year: $0, wealth: max(0, FireCalc.wealthAfterYears(growth, years: Double($0)))) }
    }

    /// Sensitivity by withdrawal rate (rows) × real return (columns).
    public static func rateSensitivity(_ plan: FirePlan, _ a: FireAssumptions, text: AnalyticsText) -> AnalyticsSensitivityTable? {
        guard let spending = plan.spending else { return nil }
        let rates = rateSteps.map { max(a.withdrawalRate + $0, 0.01) }
        let returns = returnSteps.map { a.expectedReturn + $0 }
        let cells = FireCalc.sensitivityByRateAndReturn(annualSpending: spending, current: plan.wealth, annualSaving: plan.savings ?? 0,
                                                        withdrawalRates: rates, realReturns: returns)
        return AnalyticsSensitivityTable(rows: rates.map { text.pct($0) }, columns: returns.map { text.pct($0) }, cells: cells)
    }

    /// Sensitivity by spending change (rows) × saving change (columns).
    public static func spendingSensitivity(_ plan: FirePlan, _ a: FireAssumptions, text: AnalyticsText) -> AnalyticsSensitivityTable? {
        guard let spending = plan.spending else { return nil }
        let cells = FireCalc.sensitivityBySpendingAndSaving(
            annualSpending: spending, withdrawalRate: a.withdrawalRate, realReturn: a.expectedReturn, current: plan.wealth,
            annualSaving: plan.savings ?? 0, spendingChanges: spendingChanges, savingChanges: savingChanges
        )
        return AnalyticsSensitivityTable(rows: spendingChanges.map(text.signedPct), columns: savingChanges.map(text.signedPct), cells: cells)
    }

    /// Cell text: «—» beyond 80 years, «ok» reached, else «12,3 a».
    public static func cellText(_ cell: FireSensitivityCell, text: AnalyticsText) -> String {
        guard let years = cell.years else { return "—" }
        if years == 0 { return text.tr("ok") }
        return text.tr("{0} a", ["0": BBFormat.formatRatio(years, digits: 1, locale: text.locale)])
    }

    /// Lean FIRE number (essential + occasional spending only).
    public static func leanNumber(_ base: AnalyticsBase, _ a: FireAssumptions) -> Double? {
        base.cashflow.leanSpending.flatMap { FireCalc.fireNumber(annualSpending: $0, withdrawalRate: a.withdrawalRate) }
    }

    /// X labels kept by Recharts' `preserveEnd` with `minTickGap`: the last one always, then backwards every label that
    /// does not overlap the previous kept one. Label width is estimated (12 pt text, 6.6 pt per character) so both
    /// platforms thin the same way.
    public static func visibleTicks(_ labels: [String], plotWidth: Double, minTickGap: Double) -> [Int] {
        guard !labels.isEmpty else { return [] }
        let n = labels.count
        func x(_ i: Int) -> Double { n > 1 ? Double(i) * plotWidth / Double(n - 1) : plotWidth / 2 }
        func size(_ i: Int) -> Double { Double(labels[i].count) * 6.6 }
        var kept = [n - 1]
        var edge = x(n - 1) - size(n - 1) / 2
        for i in stride(from: n - 2, through: 0, by: -1) {
            let right = x(i) + size(i) / 2
            if right + minTickGap <= edge, x(i) - size(i) / 2 >= -size(i) / 2 {
                kept.append(i)
                edge = x(i) - size(i) / 2
            }
        }
        return kept.reversed()
    }

    /// Y domain of an analytics chart: `[0, auto]` (nice max), fixed, or `[auto, auto]` (nice min/max).
    public static func zeroAutoDomain(_ values: [Double]) -> ClosedRange<Double> {
        let hi = values.max() ?? 1
        let ticks = ChartScale.niceTicks(min: 0, max: max(hi, 0))
        let top = ticks.last ?? hi
        return 0...(top > 0 ? top : 1)
    }

    public static func autoDomain(_ values: [Double]) -> ClosedRange<Double> {
        guard let lo = values.min(), let hi = values.max() else { return 0...1 }
        let ticks = ChartScale.niceTicks(min: lo, max: hi)
        guard let a = ticks.first, let b = ticks.last, b > a else { return (lo - 1)...(hi + 1) }
        return a...b
    }

    /// Horizontal grid lines inside a domain.
    public static func gridLines(_ domain: ClosedRange<Double>) -> [Double] {
        ChartScale.niceTicks(min: domain.lowerBound, max: domain.upperBound).filter { domain.contains($0) }
    }

    // MARK: Costs (ANA-024, ANA-031)

    public static func costs(_ base: AnalyticsBase, ter: [String: Double], country: String) -> CostSummary {
        (try? CostsCalc.summarizeCosts(base.costPositions(ter: ter), productCountry: country))
            ?? CostSummary(rows: [], totalValue: 0, annualCost: 0, annualPct: nil, missingTerValue: 0)
    }

    public static func drag(_ summary: CostSummary, expectedReturn: Double) -> [CostDragPoint] {
        guard let pct = summary.annualPct else { return [] }
        return CostsCalc.costDrag(value: summary.totalValue, grossReturn: expectedReturn, annualCostPct: pct, years: costDragYears)
    }

    /// TER field texts from the saved values (`toFieldText(ter, true)`).
    public static func terDrafts(_ ters: [String: Double]) -> [String: String] { ters.mapValues { toFieldText($0, percent: true) } }

    /// ANA-031: every non-empty TER must be 0–5%; the result replaces `terByInstrument`.
    public static func validateTers(_ drafts: [String: String], positions: [AnalyticsBase.Position]) -> Result<[String: Double], CatalogText> {
        var next: [String: Double] = [:]
        for p in positions {
            guard let text = drafts[p.id], !JSNumber.trim(text).isEmpty else { continue }
            guard let value = parseNumber(text), value >= 0, value <= 5 else {
                return .failure(CatalogText("Costo di «{0}»: inserisci un valore tra 0% e 5%.", ["0": p.name]))
            }
            next[p.id] = value / 100
        }
        return .success(next)
    }

    // MARK: Number fields (`assumptions-fields.ts`)

    /// Italian-style number ("3,5", "1.250,5"); nil when empty or invalid.
    public static func parseNumber(_ text: String) -> Double? {
        var s = JSNumber.trim(text).filter { !$0.isWhitespace }
        // Drop dots followed by exactly three digits and then a non-digit or the end (thousands separators).
        var out = ""
        let chars = Array(s)
        for (i, c) in chars.enumerated() {
            if c == "." {
                let next = chars.dropFirst(i + 1)
                let digits = next.prefix(3)
                if digits.count == 3, digits.allSatisfy(\.isASCIIDigit), next.count == 3 || !(next.dropFirst(3).first?.isASCIIDigit ?? false) {
                    continue
                }
            }
            out.append(c)
        }
        s = out
        if let comma = s.firstIndex(of: ",") { s.replaceSubrange(comma...comma, with: ".") }
        if s.isEmpty { return nil }
        guard let value = JSNumber.parse(s), value.isFinite else { return nil }
        return value
    }

    /// Number as an Italian field text ("0,035" → "3,5" when `percent`).
    public static func toFieldText(_ value: Double?, percent: Bool) -> String {
        guard let value else { return "" }
        let shown = percent ? JSNumber.round(value * 10000) / 100 : JSNumber.round(value)
        return jsString(shown).replacingOccurrences(of: ".", with: ",")
    }

    static func jsString(_ value: Double) -> String {
        if value == value.rounded(), abs(value) < 1e15 { return String(Int64(value)) }
        return "\(value)"
    }

    // MARK: Glossary (`GlossedText`)

    private static let glossaryPattern: NSRegularExpression = {
        let phrases = AnalyticsContent.glossary.flatMap(\.match).sorted { $0.count > $1.count }
        let alternation = phrases.map(NSRegularExpression.escapedPattern(for:)).joined(separator: "|")
        return try! NSRegularExpression(pattern: "(?<![\\p{L}\\p{N}])(\(alternation))(?![\\p{L}\\p{N}])", options: [.caseInsensitive])
    }()

    private static let idByPhrase: [String: String] = {
        var map: [String: String] = [:]
        for entry in AnalyticsContent.glossary { for phrase in entry.match where map[phrase] == nil { map[phrase] = entry.id } }
        return map
    }()

    public static func glossed(_ text: String) -> [AnalyticsTextPart] {
        let ns = text as NSString
        var parts: [AnalyticsTextPart] = []
        var seen: Set<String> = []
        var last = 0
        for match in glossaryPattern.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            let range = match.range(at: 1)
            let phrase = ns.substring(with: range)
            guard let id = idByPhrase[phrase.lowercased()], !seen.contains(id) else { continue }
            seen.insert(id)
            if range.location > last { parts.append(.text(ns.substring(with: NSRange(location: last, length: range.location - last)))) }
            parts.append(.term(id: id, text: phrase))
            last = range.location + range.length
        }
        if last < ns.length { parts.append(.text(ns.substring(from: last))) }
        return parts
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}

// MARK: - «Tutte le ipotesi» (ANA-033, ANA-034)

/// Form state of «Tutte le ipotesi» (`AssumptionsPanel`): texts as typed, validated on save into a partial update.
public struct AnalyticsAssumptionsDraft: Equatable, Sendable {
    public enum PercentField: String, CaseIterable, Sendable {
        case withdrawalRate, expectedReturn, volatility, inflation

        public var label: String {
            switch self {
            case .withdrawalRate: "Tasso di prelievo"
            case .expectedReturn: "Rendimento reale atteso"
            case .volatility: "Volatilità annua"
            case .inflation: "Inflazione attesa"
            }
        }

        public var hint: String {
            switch self {
            case .withdrawalRate:
                "Quanto del capitale prelevi il primo anno di pensione. 4% è la regola storica americana; per un orizzonte lungo e per l'Europa si ragiona su valori più prudenti (3-3,5%)."
            case .expectedReturn:
                "Rendimento annuo del portafoglio al netto dell'inflazione. Un portafoglio azionario globale ha reso storicamente circa 4-5% reale, ma non è una promessa: nel dubbio scendi."
            case .volatility:
                "Quanto oscillano i rendimenti da un anno all'altro. Circa 15% per un portafoglio quasi tutto azionario, 8-10% per uno bilanciato. Nella scheda Rischio vedi quella osservata sul tuo."
            case .inflation:
                "Serve solo a una regola di prelievo (Guyton-Klinger). Tutto il resto è già in euro di oggi."
            }
        }

        public var limits: (min: Double, max: Double) {
            switch self {
            case .withdrawalRate: FireAssumptionLimits.withdrawalRate
            case .expectedReturn: FireAssumptionLimits.expectedReturn
            case .volatility: FireAssumptionLimits.volatility
            case .inflation: FireAssumptionLimits.inflation
            }
        }
    }

    public var percents: [PercentField: String]
    /// True = on save the return follows the history again.
    public var returnAuto = false
    public var years: String
    public var spending: String
    public var savings: String
    public var rule: WithdrawalRule
    public var includePension: Bool
    public var includeTax: Bool
    public var pensionAnnual: String
    public var pensionAfter: String
    public let initialExpectedReturn: String

    public init(_ a: FireAssumptions) {
        percents = Self.percentTexts(a)
        initialExpectedReturn = percents[.expectedReturn] ?? ""
        years = AnalyticsRules.jsString(a.retirementYears)
        spending = AnalyticsRules.toFieldText(a.annualSpending, percent: false)
        savings = AnalyticsRules.toFieldText(a.annualSavings, percent: false)
        rule = a.rule
        includePension = a.includePensionFunds
        includeTax = a.includeLatentTax
        pensionAnnual = AnalyticsRules.toFieldText(a.publicPension?.annual, percent: false)
        pensionAfter = a.publicPension.map { AnalyticsRules.jsString($0.startsAfterYears) } ?? ""
    }

    static func percentTexts(_ a: FireAssumptions) -> [PercentField: String] {
        [
            .withdrawalRate: AnalyticsRules.toFieldText(a.withdrawalRate, percent: true),
            .expectedReturn: AnalyticsRules.toFieldText(a.expectedReturn, percent: true),
            .volatility: AnalyticsRules.toFieldText(a.volatility, percent: true),
            .inflation: AnalyticsRules.toFieldText(a.inflation, percent: true),
        ]
    }

    /// Typing in a percent field; the return field stops following the history.
    public mutating func set(_ field: PercentField, _ text: String) {
        percents[field] = text
        if field == .expectedReturn { returnAuto = false }
    }

    /// «Usa il tuo rendimento ({x}%)».
    public mutating func useHistory(_ offer: Double) {
        percents[.expectedReturn] = AnalyticsRules.toFieldText(offer, percent: true)
        returnAuto = true
    }

    /// ANA-034: «Ripristina i valori consigliati» (TERs kept; applied only on save).
    public mutating func resetToDefaults(_ info: FireExpectedReturnInfo) {
        let d = FireAssumptions.defaults
        let manual = info.source == .manuale
        var texts = Self.percentTexts(d)
        texts[.expectedReturn] = manual ? AnalyticsRules.toFieldText(AnalyticsRules.historyOffer(info) ?? d.expectedReturn, percent: true) : initialExpectedReturn
        percents = texts
        returnAuto = manual
        years = AnalyticsRules.jsString(d.retirementYears)
        spending = ""
        savings = ""
        rule = d.rule
        includePension = d.includePensionFunds
        includeTax = d.includeLatentTax
        pensionAnnual = ""
        pensionAfter = ""
    }

    /// ANA-033: validates and builds the partial update; the error is a translated message.
    public func submit(text: AnalyticsText) -> Result<AnalyticsAssumptionsPatch, AnalyticsMessage> {
        var patch = AnalyticsAssumptionsPatch()
        for field in PercentField.allCases {
            let lim = field.limits
            guard let value = AnalyticsRules.parseNumber(percents[field] ?? ""), value / 100 >= lim.min, value / 100 <= lim.max else {
                return .failure(AnalyticsMessage(text.tr("{0}: inserisci un valore tra {1} e {2}.", ["0": text.tr(field.label), "1": text.pct(lim.min), "2": text.pct(lim.max)])))
            }
            patch[field.rawValue] = .number(value / 100)
        }
        if returnAuto {
            patch["expectedReturn"] = nil
            patch["expectedReturnAuto"] = .bool(true)
        } else if percents[.expectedReturn] == initialExpectedReturn {
            patch["expectedReturn"] = nil
        }
        let lim = FireAssumptionLimits.retirementYears
        guard let y = AnalyticsRules.parseNumber(years), y == y.rounded(), y >= lim.min, y <= lim.max else {
            return .failure(AnalyticsMessage(text.tr("Anni di pensione: inserisci un numero intero tra {0} e {1}.",
                                    ["0": AnalyticsRules.intText(lim.min), "1": AnalyticsRules.intText(lim.max)])))
        }
        patch["retirementYears"] = .number(y)
        patch["annualSpending"] = AnalyticsRules.parseNumber(spending).map { .number($0) } ?? .null
        patch["annualSavings"] = AnalyticsRules.parseNumber(savings).map { .number($0) } ?? .null
        if let annual = AnalyticsRules.parseNumber(pensionAnnual), annual > 0 {
            let after = max(0, JSNumber.round(AnalyticsRules.parseNumber(pensionAfter) ?? 0))
            patch["publicPension"] = .pension(MonteCarloPublicPension(annual: annual, startsAfterYears: after))
        } else {
            patch["publicPension"] = .pension(nil)
        }
        patch["rule"] = .text(rule.rawValue)
        patch["includePensionFunds"] = .bool(includePension)
        patch["includeLatentTax"] = .bool(includeTax)
        return .success(patch)
    }
}

// MARK: - «Il tuo traguardo» (ANA-007, ANA-008)

public struct AnalyticsGoalDraft: Equatable, Sendable {
    public var text: String
    /// Spending from the data (nil when written by hand or unknown).
    public let dataSpending: Double?

    /// Prefilled with the current spending, Italian grouping like the web (the field parses Italian numbers).
    public init(plan: FirePlan) {
        dataSpending = plan.spendingSource == .dati ? plan.spending : nil
        text = plan.spending.map { BBFormat.formatNumber(JSNumber.round($0), minimumFractionDigits: 0, maximumFractionDigits: 0, locale: .itIT) } ?? ""
    }

    public var value: Double? { AnalyticsRules.parseNumber(text) }
    public var isValid: Bool { value.map { $0 > 0 && $0 <= FireAssumptionLimits.amount.max } ?? false }

    /// Equal to the data-derived figure → saved as `null` (stays linked to the data).
    public var followsData: Bool {
        guard let dataSpending, let value else { return false }
        return JSNumber.round(value) == JSNumber.round(dataSpending)
    }

    /// Live preview of target and arrival year.
    public func preview(base: AnalyticsBase, assumptions: FireAssumptions) -> FirePlan? {
        guard isValid, let value else { return nil }
        var a = assumptions
        a.annualSpending = value
        return FirePlanning.resolvePlan(base.planBase, a)
    }

    /// `PUT` body, or nil when invalid («Scrivi quanto ti serve in un anno, per esempio 24.000.»).
    public var patch: AnalyticsAssumptionsPatch? {
        guard isValid else { return nil }
        return .annualSpending(followsData ? nil : value)
    }
}

extension AnalyticsText {
    /// Sentence under the preview target («Ai ritmi di oggi ci arrivi intorno al {0}, tra {1}.»).
    public func goalPreviewWhen(_ preview: FirePlan, todayYear: Int) -> String {
        if preview.savingsSource == .manca { return tr("Per dirti quando ci arrivi servono almeno 3 mesi di movimenti.") }
        guard let years = preview.yearsToFire else { return tr("Ai ritmi di oggi ci vorrebbero più di 80 anni.") }
        if years == 0 { return tr("Il tuo patrimonio lo ha già raggiunto.") }
        return tr("Ai ritmi di oggi ci arrivi intorno al {0}, tra {1}.", ["0": String(todayYear + Int(years.rounded(.up))), "1": formatYears(years)])
    }
}

// MARK: - Screen state

/// Risposte state: the view, the sliders being tried and the derived plans. Same fields as `AnalyticsUiState` on Android.
public struct AnalyticsUiState: Equatable, Sendable {
    public var view: AnalyticsView?
    public var failed = false
    public var unavailable = false
    public var overrides = FireScenarioOverrides()
    public var selected: AnalyticsQuestion = .quando
    /// «Per esperti» panels opened (collapsed by default, ANA-026).
    public var expertOpen: Set<AnalyticsQuestion> = []
    public var saving = false
    public var saveError: String?
    /// The period picker shows the custom selects (local until «Usa questi mesi»).
    public var periodChoice: AnalyticsPeriodChoice?
    public var customFrom = ""
    public var customTo = ""
    /// Expert simulation: retire today or at the FIRE target (ANA-029).
    public var retireAt: FireRetireAt = .oggi
    /// Rule selected in the rules table.
    public var withdrawalRule: WithdrawalRule?

    public init() {}

    public var gate: AnalyticsGate {
        if unavailable { return .unavailable }
        if view == nil { return failed ? .failed : .loading }
        return .content
    }

    public var today: CalendarDate { view.flatMap { CalendarDate(iso: $0.today) } ?? CalendarDate(year: 2026, month: 1, day: 1) }

    /// Saved plan (assumptions in use, i.e. return from history when automatic).
    public var savedPlan: FirePlan? { view.map { FirePlanning.resolvePlan($0.base.planBase, $0.assumptions) } }

    public var hasScenario: Bool { FirePlanning.hasScenario(overrides) }

    /// Assumptions with the slider values on top.
    public var scenarioAssumptions: FireAssumptions? { view.map { FirePlanning.applyScenario($0.assumptions, overrides) } }

    public var scenarioPlan: FirePlan? {
        guard let view, let a = scenarioAssumptions else { return nil }
        return hasScenario ? FirePlanning.resolvePlan(view.base.planBase, a) : savedPlan
    }

    public var period: DataPeriod { view?.assumptions.dataPeriod ?? .ultimi(months: 12) }

    /// Choice shown by the segmented control.
    public var shownPeriodChoice: AnalyticsPeriodChoice { periodChoice ?? AnalyticsPeriodChoice(period) }

    /// ANA-013 month calendar (`PeriodSelector`, #408): the range it opens on (saved custom range, else the last 12
    /// complete months) and its bounds (10 years back from January, up to the last complete month).
    public var customPeriodRange: DateKeyRange {
        if case let .personalizzato(from, to) = period { return DateKeyRange(from: from, to: to) }
        let range = AnalyticsRules.defaultCustomRange(today: today)
        return DateKeyRange(from: range.from, to: range.to)
    }

    public var customPeriodMin: String { String(format: "%04d-01", today.year - AnalyticsRules.periodYearsBack) }

    public var customPeriodMax: String { today.addingMonthsOverflow(-1).monthKey }

    /// Opens the custom selects with the saved custom range or the last 12 complete months.
    public mutating func chooseCustomPeriod() {
        periodChoice = .custom
        if case let .personalizzato(from, to) = period {
            customFrom = from
            customTo = to
        } else {
            let range = AnalyticsRules.defaultCustomRange(today: today)
            customFrom = range.from
            customTo = range.to
        }
    }

    /// ANA-012 message for the current selects.
    public var customError: CatalogText? { AnalyticsRules.customPeriodError(from: customFrom, to: customTo, today: today) }

    public var customUnchanged: Bool {
        if case let .personalizzato(from, to) = period { return from == customFrom && to == customTo }
        return false
    }

    /// Slider move (ANA-014): values back on the baseline clear the override.
    public mutating func move(_ field: FireScenarioField, to value: Double) {
        guard let plan = savedPlan, let view else { return }
        let baseline = AnalyticsRules.baseline(field, plan: plan, assumptions: view.assumptions)
        guard let spec = FirePlanning.scenarioSlider(field, baseline: baseline) else { return }
        let snapped = AnalyticsRules.snap(value, spec: spec)
        overrides = AnalyticsRules.overrides(overrides, setting: field, to: AnalyticsRules.override(snapped, baseline: baseline, spec: spec))
    }

    /// Simulation input of the «Regge» answer (retire today, the saved rule and the compare over the four rules).
    public var simulationInput: MonteCarloInput? {
        guard let plan = scenarioPlan, let a = scenarioAssumptions else { return nil }
        return FirePlanning.buildSimulationInput(plan, a, retireAt: .oggi)
    }

    /// Input of the expert simulation with the retire-at toggle.
    public var expertSimulationInput: MonteCarloInput? {
        guard let plan = scenarioPlan, let a = scenarioAssumptions else { return nil }
        return FirePlanning.buildSimulationInput(plan, a, retireAt: retireAt)
    }
}
