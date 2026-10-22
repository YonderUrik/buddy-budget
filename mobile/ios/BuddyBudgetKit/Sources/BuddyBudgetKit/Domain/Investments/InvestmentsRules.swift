import Foundation

// Investimenti on the device (spec: features/07-investments.md, api/endpoints/investments-views.md «What stays on the
// device»): period and range, the view query, tabs and country gating, the broker chip, the precomputed cost scenario,
// inspect points, the operations year filter, the register-operation form and the targets editor. Same names on
// Android (`core/domain/investments/InvestmentsRules.kt`).

// MARK: - Period

/// Chart period of Portafoglio and Performance (INV-016). Raw values are the API's `period`.
public enum InvestmentsPeriod: String, CaseIterable, Sendable {
    case oneMonth = "1mese"
    case threeMonths = "3mesi"
    case ytd
    case oneYear = "1anno"
    case max
    case custom

    /// INV-016: 3M on every visit.
    public static let `default`: InvestmentsPeriod = .threeMonths

    /// Segmented label (Italian source; only `Personalizzato` is translated).
    public var label: String {
        switch self {
        case .oneMonth: "1M"
        case .threeMonths: "3M"
        case .ytd: "YTD"
        case .oneYear: "1A"
        case .max: "Max"
        case .custom: "Personalizzato"
        }
    }
}

/// Inclusive `YYYY-MM-DD` bounds.
public struct ChartRange: Equatable, Hashable, Sendable {
    public var from: String
    public var to: String

    public init(from: String, to: String) {
        self.from = from
        self.to = to
    }
}

/// Security page chart period (SEC-020); labels are not translated (web shows them as is).
public enum TitlePeriod: String, CaseIterable, Sendable {
    case oneMonth = "1M", threeMonths = "3M", sixMonths = "6M", oneYear = "1A", fiveYears = "5A", max = "Max"

    public static let `default`: TitlePeriod = .oneYear
}

// MARK: - Query

/// Shared query of the view endpoints (`period`, `from`/`to`, `selFrom`/`selTo`, `excludeBrokers`, `today`).
public struct InvestmentsQuery: Equatable, Hashable, Sendable {
    public var period: InvestmentsPeriod
    public var range: ChartRange?
    public var selection: ChartRange?
    public var excludedBrokers: [String]
    public var today: String

    public init(period: InvestmentsPeriod, range: ChartRange? = nil, selection: ChartRange? = nil,
                excludedBrokers: [String] = [], today: String) {
        self.period = period
        self.range = range
        self.selection = selection
        self.excludedBrokers = excludedBrokers
        self.today = today
    }

    /// Builds the query of a tab: YTD resolves to 1 Jan → today; custom carries its (validated) range.
    public static func make(period: InvestmentsPeriod, custom: ChartRange, today: String, excludedBrokers: Set<String>,
                            selection: ChartRange? = nil) -> InvestmentsQuery {
        let range: ChartRange?
        switch period {
        case .ytd: range = ChartRange(from: "\(today.prefix(4))-01-01", to: today)
        case .custom: range = InvestmentsRules.isValidRange(custom, today: today) ? custom : nil
        default: range = nil
        }
        // An invalid custom range never reaches the server (Apply is disabled); fall back to the default period.
        let effective: InvestmentsPeriod = period == .custom && range == nil ? .default : period
        return InvestmentsQuery(period: effective, range: range, selection: selection,
                                excludedBrokers: excludedBrokers.sorted(), today: today)
    }

    public var parameters: [String: String] {
        var out = ["period": period.rawValue, "today": today]
        if period == .custom, let range {
            out["from"] = range.from
            out["to"] = range.to
        }
        if let selection {
            out["selFrom"] = selection.from
            out["selTo"] = selection.to
        }
        if !excludedBrokers.isEmpty { out["excludeBrokers"] = excludedBrokers.joined(separator: ",") }
        return out
    }
}

// MARK: - Tabs

/// The six Investimenti tabs (INV-002), each addressable by its web path.
public enum InvestmentsTab: String, CaseIterable, Sendable {
    case portfolio = "/investimenti"
    case performance = "/investimenti/performance"
    case diversification = "/investimenti/diversificazione"
    case income = "/investimenti/proventi"
    case taxes = "/investimenti/tasse"
    case operations = "/investimenti/operazioni"

    public var title: String {
        switch self {
        case .portfolio: "Portafoglio"
        case .performance: "Performance"
        case .diversification: "Diversificazione"
        case .income: "Dividendi"
        case .taxes: "Tasse"
        case .operations: "Operazioni"
        }
    }

    public var subtitle: String {
        switch self {
        case .portfolio: "Valore, andamento e posizioni"
        case .performance: "Rendimento, rischio e confronto"
        case .diversification: "Come è distribuito il portafoglio"
        case .income: "Cedole e proventi incassati"
        case .taxes: "Stime fiscali e minusvalenze"
        case .operations: "Acquisti e vendite registrati"
        }
    }

    /// Lucide icon key in the views sheet (web `INVESTMENTS_TABS`).
    public var iconKey: String {
        switch self {
        case .portfolio: "wallet"
        case .performance: "trending-up"
        case .diversification: "chart-pie"
        case .income: "hand-coins"
        case .taxes: "landmark"
        case .operations: "arrow-left-right"
        }
    }

    /// INV-003: Dividendi / Tasse only when the server says the path exists for the product country.
    public static func visible(_ sections: MeBootstrap.Sections) -> [InvestmentsTab] {
        allCases.filter { tab in
            switch tab {
            case .income: sections.investmentIncome
            case .taxes: sections.investmentTaxes
            default: true
            }
        }
    }

    /// Deep link / legacy path → tab (INV-004: `rendiconti…` → Operazioni, `titoli` → Portafoglio). nil = not a tab path
    /// (e.g. a security page `/investimenti/titoli/{id}`).
    public init?(path: String) {
        let clean = String(path.split(separator: "?").first ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        switch clean {
        case "investimenti", "investimenti/titoli": self = .portfolio
        case "investimenti/rendiconti", "investimenti/rendiconti/importazioni": self = .operations
        default:
            guard let tab = InvestmentsTab.allCases.first(where: { $0.rawValue == "/" + clean }) else { return nil }
            self = tab
        }
    }

    /// Security page id from `/investimenti/titoli/{id}` (SEC-001), else nil.
    public static func instrumentId(path: String) -> String? {
        let clean = String(path.split(separator: "?").first ?? "")
        let prefix = "/investimenti/titoli/"
        guard clean.hasPrefix(prefix) else { return nil }
        let id = String(clean.dropFirst(prefix.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return id.isEmpty ? nil : id
    }
}

/// What a Dividendi/Tasse tab renders (INV-091: the Italian endpoints are never called for DE). Web `productCountry ===
/// "DE" ? <PlanningScreen/> : <ItalianPage/>`: «Altro paese» gets the Italian screens before tax (INV-113, #465).
public enum InvestmentsCountryContent: Equatable, Sendable {
    case italian
    case germanPlan

    public static func of(country: String) -> InvestmentsCountryContent {
        country == "DE" ? .germanPlan : .italian
    }

    /// PLAN-003: for DE only the exact `/investimenti/tasse` and `/investimenti/proventi` paths open; their subpaths go to
    /// the country-unavailable screen (web `isCountryPathAvailable`).
    public func blocksPath(_ path: String) -> Bool {
        guard self == .germanPlan else { return false }
        let bare = String(path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first ?? "")
        return bare.hasPrefix("/investimenti/tasse/") || bare.hasPrefix("/investimenti/proventi/")
    }
}

// MARK: - Rules

public enum InvestmentsRules {
    /// Prices older than this are stale (INV-022; the server flags them in `priceNotes`).
    public static let stalePriceDays = 4
    /// Months shown before «Mostra tutti i mesi» (INV-056).
    public static let recentMonths = 3
    /// Default «next contribution» amount (INV-054).
    public static let defaultContribution = 100.0
    /// Max instruments in a target (INV-051).
    public static let maxTargets = 30

    /// INV-017: both real calendar dates, from ≤ to, to ≤ today.
    public static func isValidRange(_ range: ChartRange, today: String) -> Bool {
        guard let from = CalendarDate(iso: range.from), from.iso == range.from,
              let to = CalendarDate(iso: range.to), to.iso == range.to else { return false }
        return range.from <= range.to && range.to <= today
    }

    /// INV-017: 1 January of the current year → today.
    public static func defaultCustomRange(today: String) -> ChartRange {
        ChartRange(from: "\(today.prefix(4))-01-01", to: today)
    }

    /// INV-008: the broker chip appears only when a non-manual broker group exists.
    public static func showsBrokerSelector(_ brokers: [InvestmentsView.Broker]) -> Bool {
        brokers.contains { $0.id != "manual" }
    }

    /// INV-018: the precomputed scenario for the two switches (switch on = reinvested = `include… = false`).
    public static func costScenario(_ scenarios: [InvestmentsView.CostScenario], reinvestFees: Bool,
                                    reinvestTaxes: Bool) -> InvestmentsView.CostScenario? {
        scenarios.first { $0.includeFees == !reinvestFees && $0.includeTaxes == !reinvestTaxes }
    }

    /// INV-034: the inspect entry nearest to a chart point (inspect points may be sampled); ties → the earlier one.
    public static func nearestInspect(_ index: Int, in points: [InspectPoint]) -> InspectPoint? {
        var best: InspectPoint?
        for p in points where best == nil || abs(p.index - index) < abs(best!.index - index) { best = p }
        return best
    }

    /// INV-057: «Tutti» + years desc, only with operations in more than one year.
    public static func yearOptions(_ years: [Int]) -> [Int?] {
        let sorted = Array(Set(years)).sorted(by: >)
        return sorted.count > 1 ? [nil] + sorted : []
    }

    /// INV-056: month groups of the selected year (nil = all); the first 3 unless `showAll`.
    public static func visibleMonths(_ months: [OperationMonth], year: Int?, showAll: Bool) -> [OperationMonth] {
        let filtered = year.map { y in months.filter { $0.year == y } } ?? months
        return showAll ? filtered : Array(filtered.prefix(recentMonths))
    }

    /// INV-058: totals of a year = web `sumOperationTotals` over its operations (all years → the served totals).
    public static func totals(_ months: [OperationMonth], year: Int?, all: OperationTotals) -> OperationTotals {
        guard let year else { return all }
        var bought = 0.0, sold = 0.0, income = 0.0, gain = 0.0, base = 0.0
        var count = 0, unpriced = 0
        for op in months.filter({ $0.year == year }).flatMap(\.operations) {
            count += 1
            let type = op.transaction.type
            if type == "split" || type == "rettifica" { continue }
            if type == "acquisto" { bought += op.paid } else if type == "vendita" || type == "rimborso" { sold += op.received } else { income += op.received }
            if let g = op.gain {
                gain += g
                base += op.gainBase ?? 0
            } else if type == "acquisto", (op.remainingQuantity ?? 0) > 1e-9 {
                unpriced += 1
            }
        }
        return OperationTotals(count: count, bought: bought, sold: sold, income: income, gain: gain,
                               gainPct: base > 0 ? gain / base : nil, unpricedCount: unpriced)
    }

    /// INV-060/061: edit and delete are not offered for capital adjustments and reconciled statement operations.
    public static func canEdit(_ t: InvestmentTransaction) -> Bool { t.type != "rettifica" && !t.isReconciled }

    /// JS `String(number)` for the values of a form (integers without ".0", shortest round-trip otherwise).
    public static func jsString(_ value: Double) -> String {
        if value == value.rounded(), abs(value) < 1e15 { return String(Int64(value)) }
        return String(value)
    }

    /// `Math.round(share × 100)%` (positions, weights; same string in every language as on the web).
    public static func percent(_ share: Double) -> String { "\(Int(JSNumber.round(share * 100)))%" }

    /// INV-055: quantity of a suggested purchase, floored to 4 decimals (nil without a price).
    public static func suggestedQuantity(amount: Double, lastPrice: Double?) -> Double? {
        guard let lastPrice, lastPrice > 0 else { return nil }
        return (amount / lastPrice * 10_000).rounded(.down) / 10_000
    }
}

// MARK: - Register / edit operation (INV-062…073)

/// Operation types offered by the form (INV-063: `rettifica` never).
public enum OperationType: String, CaseIterable, Sendable {
    case acquisto, vendita, dividendo, cedola, rimborso, split

    public var label: String {
        switch self {
        case .acquisto: "Acquisto"
        case .vendita: "Vendita"
        case .dividendo: "Dividendo"
        case .cedola: "Cedola"
        case .rimborso: "Rimborso"
        case .split: "Split"
        }
    }

    public var isIncome: Bool { self == .dividendo || self == .cedola }
    /// INV-062: three steps when the type has costs, two for a split.
    public var hasCosts: Bool { self != .split }
    /// INV-067: the market price is proposed for purchases and sales only.
    public var suggestsMarketPrice: Bool { self == .acquisto || self == .vendita }
}

/// Label of every stored type (badges in Operazioni), Italian source.
public func operationTypeLabel(_ raw: String) -> String {
    if raw == "rettifica" { return "Operazione sul capitale" }
    return OperationType(rawValue: raw)?.label ?? raw
}

/// Form values and validation of «Registra operazione» / «Modifica operazione». Texts are Italian catalog sources.
public struct OperationForm: Equatable, Sendable {
    public var type: OperationType
    public var instrument: Instrument?
    public var date: String
    public var quantity: String
    public var price: String
    public var gross: String
    public var fees: String
    public var taxes: String
    public var fxRate: String
    public var note: String?
    /// Units held of the chosen instrument (sales cannot exceed it), nil when unknown.
    public var held: Double?

    public init(type: OperationType = .acquisto, instrument: Instrument? = nil, date: String, quantity: String = "",
                price: String = "", gross: String = "", fees: String = "", taxes: String = "", fxRate: String = "",
                note: String? = nil, held: Double? = nil) {
        self.type = type
        self.instrument = instrument
        self.date = date
        self.quantity = quantity
        self.price = price
        self.gross = gross
        self.fees = fees
        self.taxes = taxes
        self.fxRate = fxRate
        self.note = note
        self.held = held
    }

    /// Edit: starts from the saved values (saved price, not market), FX left empty keeps the stored rate (INV-071).
    public static func editing(_ t: InvestmentTransaction, instrument: Instrument?, held: Double?) -> OperationForm {
        OperationForm(type: OperationType(rawValue: t.type) ?? .acquisto, instrument: instrument, date: t.date,
                      quantity: numberText(t.quantityValue), price: numberText(t.priceValue),
                      gross: t.grossValue.map(numberText) ?? "", fees: t.feesValue == 0 ? "" : numberText(t.feesValue),
                      taxes: t.taxesValue == 0 ? "" : numberText(t.taxesValue), fxRate: "", note: t.note, held: held)
    }

    /// Field text of a number (comma decimal, as the web's `numberText`).
    public static func numberText(_ value: Double) -> String {
        InvestmentsRules.jsString(value).replacingOccurrences(of: ".", with: ",")
    }

    /// Prefilled price text (≤ 6 decimals, web `priceText`).
    public static func priceText(_ close: Double) -> String {
        numberText((close * 1_000_000).rounded() / 1_000_000)
    }

    public var isBond: Bool { instrument?.isPercentOfNominal == true }
    public var showsQuantity: Bool { !type.isIncome }
    public var showsPrice: Bool { !type.isIncome && type != .split }
    public var showsGross: Bool { type.isIncome }
    public var stepCount: Int { type.hasCosts ? 3 : 2 }

    /// INV-068: the FX field only when the instrument currency differs from the user's.
    public func needsFx(userCurrency: String) -> Bool { (instrument?.currency ?? userCurrency) != userCurrency }

    public var quantityLabel: String {
        if type == .split { return "Quote nuove per ogni quota" }
        return isBond ? "Valore nominale" : "Quote"
    }

    public var priceLabel: String { isBond ? "Prezzo (% del nominale)" : "Prezzo per quota" }

    private static func parse(_ text: String) -> Double? { BBFormat.parseAmount(text) }

    public var quantityValue: Double? { Self.parse(quantity) }
    public var priceValue: Double? { Self.parse(price) }
    public var grossValue: Double? { Self.parse(gross) }

    /// INV-065 «Controvalore»: quantity × price (÷ 100 for bonds), the gross for income, nil for a split / incomplete.
    public var countervalue: Double? {
        if type == .split { return nil }
        if type.isIncome { return grossValue }
        guard let q = quantityValue, let p = priceValue else { return nil }
        return q * p * (isBond ? 0.01 : 1)
    }

    /// Step 1 (INV-062): an instrument is required.
    public var stepOneError: String? { instrument == nil ? "Scegli uno strumento" : nil }

    /// Step 2 gate: the quantity (or the split ratio) must be written to continue.
    public var stepTwoError: String? {
        if type == .split { return (quantityValue ?? 0) > 0 ? nil : "Scrivi il rapporto dello split." }
        if !type.isIncome, JSNumber.trim(quantity).isEmpty { return "Scrivi la quantità." }
        return nil
    }

    /// INV-066 / INV-069 and the oversell guard; nil when the operation can be sent. Messages are the server's.
    public func validate(today: String) -> String? {
        if let e = stepOneError { return e }
        guard CalendarDate(iso: date) != nil else { return "Data non valida" }
        if date > today { return "La data non può essere nel futuro" }
        switch type {
        case .split:
            if (quantityValue ?? 0) <= 0 { return "Rapporto dello split non valido" }
        case .dividendo, .cedola:
            if (grossValue ?? 0) <= 0 { return "Importo non valido" }
        case .acquisto, .vendita, .rimborso:
            if (quantityValue ?? 0) <= 0 { return "Quantità non valida" }
            if (priceValue ?? 0) <= 0 { return "Prezzo non valido" }
            if type != .acquisto, let held, let q = quantityValue, q > held + 1e-9 {
                return "Non puoi vendere più quote di quelle che possiedi"
            }
        }
        for text in [fees, taxes] where !JSNumber.trim(text).isEmpty {
            guard let v = Self.parse(text), v >= 0 else { return "Importo non valido" }
        }
        if !JSNumber.trim(fxRate).isEmpty, (Self.parse(fxRate) ?? 0) <= 0 { return "Cambio non valido" }
        return nil
    }

    /// The request body (call after `validate` returned nil).
    public func input(today: String) -> OperationInput? {
        guard validate(today: today) == nil, let instrument else { return nil }
        let costs = type.hasCosts
        return OperationInput(
            instrumentId: instrument.id, type: type.rawValue, date: date,
            quantity: type.isIncome ? nil : quantityValue,
            price: showsPrice ? priceValue : nil,
            grossAmount: type.isIncome ? grossValue : nil,
            fxRate: costs ? Self.parse(fxRate) : nil,
            fees: costs ? (Self.parse(fees) ?? 0) : 0,
            taxes: costs ? (Self.parse(taxes) ?? 0) : 0,
            note: note.flatMap { JSNumber.trim($0).isEmpty ? nil : $0 })
    }
}

/// INV-067: the line under the price field (Italian source + value), nil when nothing to say.
public enum PriceSuggestionHint: Equatable, Sendable {
    case searching
    case downloading
    case none
    case close(date: String, sameDay: Bool, manual: Bool)

    public static func of(_ state: PriceOnDate?, fetching: Bool, date: String) -> PriceSuggestionHint? {
        guard let state else { return fetching ? .searching : nil }
        if state.loading { return .downloading }
        guard let price = state.price else { return PriceSuggestionHint.none }
        return .close(date: price.date, sameDay: price.date == date, manual: price.origin == "manuale")
    }

    /// Italian catalog source (with `{0}` = the formatted date where needed).
    public var source: String {
        switch self {
        case .searching: "Cerco il prezzo di questa data…"
        case .downloading: "Scarico i prezzi di questa data…"
        case .none: "Nessun prezzo per questa data: inseriscilo tu."
        case .close(_, let same, let manual):
            manual ? (same ? "Il tuo prezzo del {0}" : "Il tuo ultimo prezzo prima di questa data, del {0}")
                : (same ? "Chiusura del {0}" : "Ultima chiusura prima di questa data, del {0}")
        }
    }
}

// MARK: - Targets editor (INV-051)

public struct TargetDraft: Equatable, Sendable, Identifiable {
    public var instrumentId: String
    public var name: String
    /// Percentage text, one decimal (e.g. "35" or "12,5").
    public var percent: String

    public init(instrumentId: String, name: String, percent: String) {
        self.instrumentId = instrumentId
        self.name = name
        self.percent = percent
    }

    public var id: String { instrumentId }
    public var value: Double? { BBFormat.parseAmount(percent) }
}

public enum TargetsEditor {
    /// Starting rows: saved targets, else current weights (rounded, as served).
    public static func initial(saved: [InvestmentsView.Target], current: [InvestmentsView.Target],
                               name: (String) -> String) -> [TargetDraft] {
        let source = saved.isEmpty ? current : saved
        return source.map { TargetDraft(instrumentId: $0.instrumentId, name: name($0.instrumentId),
                                        percent: OperationForm.numberText((($0.weight * 1000).rounded()) / 10)) }
    }

    public static func total(_ rows: [TargetDraft]) -> Double {
        rows.reduce(0) { $0 + ($1.value ?? 0) }
    }

    /// Difference to 100 (positive = missing), rounded to one decimal.
    public static func missing(_ rows: [TargetDraft]) -> Double {
        ((100 - total(rows)) * 10).rounded() / 10
    }

    /// Save enabled: every weight > 0 and ≤ 100, sum = 100 ± 0.01, ≤ 30 rows, no duplicates.
    public static func canSave(_ rows: [TargetDraft]) -> Bool {
        guard !rows.isEmpty, rows.count <= InvestmentsRules.maxTargets,
              Set(rows.map(\.instrumentId)).count == rows.count else { return false }
        guard rows.allSatisfy({ ($0.value ?? 0) > 0 && ($0.value ?? 0) <= 100 }) else { return false }
        return abs(total(rows) - 100) <= 0.01
    }

    /// Request weights (fractions, normalised so that the server's ± 0.0001 check passes).
    public static func weights(_ rows: [TargetDraft]) -> [InvestmentsView.Target] {
        let sum = total(rows)
        return rows.map { InvestmentsView.Target(instrumentId: $0.instrumentId, weight: ($0.value ?? 0) / sum) }
    }

    /// «Aggiungi la differenza»: adds what is missing to the last row.
    public static func fillLast(_ rows: [TargetDraft]) -> [TargetDraft] {
        guard var last = rows.last, let value = last.value else { return rows }
        last.percent = OperationForm.numberText(((value + missing(rows)) * 10).rounded() / 10)
        return Array(rows.dropLast()) + [last]
    }
}

// MARK: - Alerts and security page helpers (SEC-*)

public enum TitleRules {
    /// SEC-030: comma or dot decimals; must be > 0. nil = invalid.
    public static func parseAlertLevel(_ text: String) -> Double? {
        let trimmed = JSNumber.trim(text)
        guard !trimmed.isEmpty else { return nil }
        let normalized: String
        if trimmed.contains(",") && trimmed.contains(".") {
            // "1.250,5" (it) or "1,250.5" (en): the last separator is the decimal one.
            let lastComma = trimmed.lastIndex(of: ",")!, lastDot = trimmed.lastIndex(of: ".")!
            normalized = lastComma > lastDot
                ? trimmed.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
                : trimmed.replacingOccurrences(of: ",", with: "")
        } else {
            normalized = trimmed.replacingOccurrences(of: ",", with: ".")
        }
        guard let v = Double(normalized), v.isFinite, v > 0 else { return nil }
        return v
    }

    /// SEC-026 / INV-041: 1…4 from annual volatility (thresholds 8 / 15 / 25 %).
    public static func riskLevel(volatility: Double) -> Int {
        if volatility < 0.08 { return 1 }
        if volatility < 0.15 { return 2 }
        if volatility < 0.25 { return 3 }
        return 4
    }

    /// Marker position on the 4-band scale (scale max 35 %).
    public static func riskScalePosition(volatility: Double) -> Double { min(1, max(0, volatility / 0.35)) }

    public static let riskLevelLabels = ["Basso", "Medio", "Alto", "Molto alto"]

    /// SEC-045: cost of a TER on 10.000 after `years` at a hypothetical 5 % (10.000 × (1,05ⁿ − (1,05 × (1 − TER))ⁿ)).
    public static func terCost(ter: Double, years: Int, capital: Double = 10_000, rate: Double = 0.05) -> Double {
        capital * (pow(1 + rate, Double(years)) - pow((1 + rate) * (1 - ter), Double(years)))
    }

    /// SEC-021: index of the first chart point on/after each purchase date inside the series (others skipped).
    public static func purchaseMarkers(series: [TitleAnalysis.Point], purchases: [TitleAnalysis.Purchase]) -> [Int] {
        guard let first = series.first?.date, let last = series.last?.date else { return [] }
        var out: [Int] = []
        for p in purchases where p.date >= first && p.date <= last {
            if let i = series.firstIndex(where: { $0.date >= p.date }), !out.contains(i) { out.append(i) }
        }
        return out
    }

    /// SEC-020: green when the period ends ≥ its start.
    public static func isRising(_ series: [TitleAnalysis.Point]) -> Bool {
        guard let first = series.first, let last = series.last else { return true }
        return last.close >= first.close
    }

    /// SEC-019 «Dal massimo»: within 0.5 % counts as «sui massimi».
    public static func isAtHigh(_ fromHigh: Double?) -> Bool { (fromHigh ?? -1) > -0.005 }

    /// SEC-024: returns shown in this order, only those the history reaches.
    public static let returnKeys: [(key: String, label: String)] = [("1M", "1 mese"), ("3M", "3 mesi"), ("6M", "6 mesi"),
                                                                     ("1A", "1 anno"), ("YTD", "Da inizio anno")]
}

// MARK: - Instrument icon (web `instrument-icon.ts`, without remote brands)

public struct InstrumentIconSpec: Equatable, Sendable {
    public let initials: String
    /// `--swatch-*` key (`blue`, `violet`, …).
    public let swatch: String
}

public enum InstrumentIcons {
    /// Type colours (`INSTRUMENT_TYPE_COLOR`).
    public static func typeSwatch(_ type: InstrumentType) -> String {
        switch type {
        case .etf: "blue"
        case .azione: "violet"
        case .obbligazione: "teal"
        case .fondo: "amber"
        case .crypto: "orange"
        case .etc: "slate"
        }
    }

    /// Singular type label (`INSTRUMENT_TYPE_SINGULAR`), Italian source.
    public static func typeLabel(_ type: InstrumentType) -> String {
        switch type {
        case .etf: "ETF"
        case .azione: "Azione"
        case .obbligazione: "Obbligazione / BTP"
        case .fondo: "Fondo comune"
        case .crypto: "Crypto"
        case .etc: "ETC (materie prime)"
        }
    }

    /// Plural type label (`INSTRUMENT_TYPE_LABELS`), Italian source.
    public static func typePlural(_ type: InstrumentType) -> String {
        switch type {
        case .etf: "ETF"
        case .azione: "Azioni"
        case .obbligazione: "Obbligazioni"
        case .fondo: "Fondi"
        case .crypto: "Crypto"
        case .etc: "Materie prime (ETC)"
        }
    }

    static let issuers: [(initials: String, swatch: String, prefixes: [String])] = [
        ("iS", "blue", ["ishares", "blackrock"]), ("V", "rose", ["vanguard"]), ("X", "teal", ["xtrackers", "db x trackers", "dws"]),
        ("S", "violet", ["spdr", "state street"]), ("A", "orange", ["amundi", "lyxor", "cpr"]), ("In", "emerald", ["invesco"]),
        ("W", "amber", ["wisdomtree", "etfs"]), ("VE", "teal", ["vaneck"]), ("U", "rose", ["ubs"]), ("H", "rose", ["hsbc"]),
        ("JP", "slate", ["jpmorgan", "j p morgan", "jp morgan"]), ("BN", "emerald", ["bnp paribas"]), ("GX", "blue", ["global x"]),
        ("F", "blue", ["franklin"]), ("Fi", "blue", ["fineco"]),
    ]

    /// Lower case, no accents or punctuation, single spaces.
    public static func normalize(_ name: String) -> String {
        let folded = name.lowercased().folding(options: .diacriticInsensitive, locale: nil)
        var out = ""
        var space = false
        for scalar in folded.unicodeScalars {
            let ascii = (scalar.value >= 97 && scalar.value <= 122) || (scalar.value >= 48 && scalar.value <= 57)
            if ascii {
                if space, !out.isEmpty { out.append(" ") }
                out.unicodeScalars.append(scalar)
                space = false
            } else {
                space = true
            }
        }
        return out
    }

    /// Two letters from the first words ("Energia Italia S.p.A." → "EI").
    public static func initials(_ name: String) -> String {
        let words = normalize(name).split(separator: " ")
        guard let first = words.first else { return "?" }
        let letters = words.count == 1 ? String(first.prefix(2)) : String(first.prefix(1)) + String(words[1].prefix(1))
        return letters.prefix(1).uppercased() + letters.dropFirst().lowercased()
    }

    /// Fund issuer from the name (ETF / funds), nil when unknown.
    public static func issuer(_ name: String) -> InstrumentIconSpec? {
        let n = normalize(name)
        for issuer in issuers where issuer.prefixes.contains(where: { n == $0 || n.hasPrefix($0 + " ") }) {
            return InstrumentIconSpec(initials: issuer.initials, swatch: issuer.swatch)
        }
        return nil
    }

    public static func spec(type: InstrumentType, name: String) -> InstrumentIconSpec {
        // ETFs, ETCs and funds show their issuer (ETCs since web #438).
        if type == .etf || type == .etc || type == .fondo, let issuer = issuer(name) { return issuer }
        return InstrumentIconSpec(initials: initials(name), swatch: typeSwatch(type))
    }

    /// The server only has logos for stocks and recognised fund issuers: ask only there.
    public static func wantsRemoteLogo(type: InstrumentType, name: String) -> Bool {
        type == .azione || ((type == .etf || type == .etc || type == .fondo) && issuer(name) != nil)
    }
}

// MARK: - Search results (SEC-003…006)

/// A market result to add: from Yahoo (ETF, stocks, funds…) or CoinGecko (crypto).
public enum MarketSearchItem: Equatable, Sendable, Identifiable {
    case yahoo(InstrumentSearchResult.MarketHit)
    case coingecko(InstrumentSearchResult.CryptoHit)

    public var id: String {
        switch self {
        case .yahoo(let hit): "y:\(hit.symbol)"
        case .coingecko(let coin): "cg:\(coin.id)"
        }
    }

    public var type: InstrumentType {
        switch self {
        case .yahoo(let hit): hit.kind
        case .coingecko: .crypto
        }
    }

    public var title: String {
        switch self {
        case .yahoo(let hit): hit.name
        case .coingecko(let coin): coin.name
        }
    }

    /// `{symbol} · {exchange}` or `{SYMBOL} · in {currency}` (the «in» is translated by the caller).
    public func detail(cryptoCurrency: String, inWord: String = "in") -> String {
        switch self {
        case .yahoo(let hit): [hit.symbol, hit.exchangeLabel ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
        case .coingecko(let coin): "\(coin.symbol.uppercased()) · \(inWord) \(cryptoCurrency)"
        }
    }

    /// `POST /api/instruments` body (the typed ISIN is attached to Yahoo hits).
    public func createInput(currency: String, isin: String?) -> InstrumentCreateInput {
        switch self {
        case .yahoo(let hit): .yahoo(symbol: hit.symbol, name: hit.name, type: hit.type, isin: isin)
        case .coingecko(let coin): .coingecko(id: coin.id, name: coin.name, currency: currency)
        }
    }
}

public struct SearchResultGroup: Equatable, Sendable, Identifiable {
    public let type: InstrumentType
    public let items: [MarketSearchItem]
    public var id: String { type.rawValue }
}

public enum InstrumentSearch {
    /// SEC-005 order of the groups.
    public static let typeOrder: [InstrumentType] = [.etf, .azione, .fondo, .obbligazione, .etc, .crypto]
    public static let maxCrypto = 5
    public static let minQueryLength = 2

    /// SEC-002: searches start at 2 characters.
    public static func isSearchable(_ query: String) -> Bool { query.trimmingCharacters(in: .whitespaces).count >= minQueryLength }

    /// SEC-006: exact symbol/name matches only when stocks were found, else also prefix matches; at most 5.
    public static func relevantCrypto(_ coins: [InstrumentSearchResult.CryptoHit], query: String,
                                      hasMarketResults: Bool) -> [InstrumentSearchResult.CryptoHit] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return [] }
        return Array(coins.filter { coin in
            let symbol = coin.symbol.trimmingCharacters(in: .whitespaces).lowercased()
            let name = coin.name.trimmingCharacters(in: .whitespaces).lowercased()
            if symbol == q || name == q { return true }
            return !hasMarketResults && (symbol.hasPrefix(q) || name.hasPrefix(q))
        }.prefix(maxCrypto))
    }

    /// SEC-005/006: groups by type in `typeOrder`; Yahoo crypto rows dropped when CoinGecko found coins.
    public static func group(_ result: InstrumentSearchResult, query: String) -> [SearchResultGroup] {
        let stocks = result.market.filter { $0.type != "crypto" }
        let coins = relevantCrypto(result.crypto, query: query, hasMarketResults: !stocks.isEmpty)
        let items: [MarketSearchItem] = result.market.filter { $0.type != "crypto" || coins.isEmpty }.map { .yahoo($0) }
            + coins.map { .coingecko($0) }
        return typeOrder.compactMap { type in
            let matching = items.filter { $0.type == type }
            return matching.isEmpty ? nil : SearchResultGroup(type: type, items: matching)
        }
    }

    /// SEC-003: the user's instruments first, in suggestion order.
    public static func rankKnown(_ known: [Instrument], suggestions: [Instrument]) -> [Instrument] {
        let rank = Dictionary(suggestions.enumerated().map { ($1.id, $0) }, uniquingKeysWith: { a, _ in a })
        return known.enumerated().sorted { l, r in
            let a = rank[l.element.id] ?? Int.max, b = rank[r.element.id] ?? Int.max
            return a != b ? a < b : l.offset < r.offset
        }.map(\.element)
    }

    /// SEC-009 «Non lo trovi?»: default type (bond for an Italian ISIN), and the create input.
    public static func manualDefaultType(isin: String?) -> InstrumentType { isin?.hasPrefix("IT") == true ? .obbligazione : .fondo }

    public static func isValidCurrency(_ code: String) -> Bool {
        code.count == 3 && code.unicodeScalars.allSatisfy { $0.value >= 65 && $0.value <= 90 }
    }

    public static func manualInput(name: String, type: InstrumentType, currency: String, isin: String?) -> InstrumentCreateInput? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, isValidCurrency(currency) else { return nil }
        if let isin, type == .obbligazione { return .isin(isin: isin, name: trimmed, type: type.rawValue, currency: currency) }
        return .manual(name: trimmed, type: type.rawValue, currency: currency, isin: isin)
    }
}

// MARK: - Benchmark (INV-038…040)

public struct BenchmarkSuggestion: Equatable, Sendable, Identifiable {
    public let label: String
    public let description: String
    public let name: String
    public let yahooSymbol: String
    public let isin: String
    public var id: String { yahooSymbol }
}

/// Why the comparison is not there yet (web `benchmarkWait`).
public enum BenchmarkWait: Equatable, Sendable {
    case checking
    case downloading(saved: Int, total: Int?)
    case failed
    case noHistory(firstPriceDate: String)
    case incomplete

    public var canRetry: Bool {
        switch self {
        case .failed, .incomplete, .noHistory: true
        default: false
        }
    }
}

public enum BenchmarkRules {
    public static let suggestions: [BenchmarkSuggestion] = [
        BenchmarkSuggestion(label: "S&P 500", description: "Grandi aziende statunitensi", name: "iShares Core S&P 500 UCITS ETF (Acc)",
                            yahooSymbol: "CSPX.L", isin: "IE00B5BMR087"),
        BenchmarkSuggestion(label: "MSCI World", description: "Azioni dei mercati sviluppati", name: "iShares Core MSCI World UCITS ETF (Acc)",
                            yahooSymbol: "IWDA.AS", isin: "IE00B4L5Y983"),
        BenchmarkSuggestion(label: "FTSE All-World", description: "Mercati sviluppati ed emergenti",
                            name: "Vanguard FTSE All-World UCITS ETF (Acc)", yahooSymbol: "VWCE.DE", isin: "IE00BK5BQT80"),
        BenchmarkSuggestion(label: "Nasdaq-100", description: "Grandi aziende non finanziarie del Nasdaq",
                            name: "iShares NASDAQ 100 UCITS ETF (Acc)", yahooSymbol: "SXRV.DE", isin: "IE00B53SZB19"),
    ]

    /// `nil` backfill state = not read yet (checking); `.some(nil)` = nothing on the server.
    public static func wait(backfill: BackfillState??, firstPriceDate: String?, baseKey: String) -> BenchmarkWait {
        guard let state = backfill else { return .checking }
        if let s = state, s.isRunning { return .downloading(saved: s.saved ?? 0, total: s.total) }
        let failed = state?.status == "failed" || state?.interrupted == true
        guard let first = firstPriceDate else { return .failed }
        if first > baseKey {
            if failed { return .failed }
            return state?.status == "done" ? .noHistory(firstPriceDate: first) : .incomplete
        }
        return failed ? .failed : .incomplete
    }

    /// Verdict when the server did not send one: ±1 % of the simulated value counts as even.
    public static func verdict(portfolioValue: Double, simulatedValue: Double) -> String {
        let diff = (portfolioValue - simulatedValue) / max(abs(simulatedValue), 1)
        if abs(diff) < 0.01 { return "even" }
        return diff > 0 ? "better" : "worse"
    }
}

// MARK: - Exposure labels and colours (INV-045…047)

public enum ExposureKeys {
    public static let sectorLabels: [String: String] = [
        "tecnologia": "Tecnologia", "finanza": "Finanza", "salute": "Salute", "industria": "Industria",
        "consumi_ciclici": "Consumi ciclici", "consumi_difensivi": "Consumi di base", "comunicazioni": "Comunicazioni",
        "energia": "Energia", "materiali": "Materiali", "servizi_pubblici": "Servizi pubblici", "immobiliare": "Immobiliare",
        "obbligazioni": "Obbligazioni", "liquidita": "Liquidità", "materie_prime": "Materie prime", "crypto": "Crypto",
        "altro": "Altro", "non_classificato": "Non classificato",
    ]
    public static let areaLabels: [String: String] = [
        "nord_america": "Nord America", "europa": "Europa", "italia": "Italia", "giappone": "Giappone", "pacifico": "Pacifico",
        "emergenti": "Paesi emergenti", "nessuna": "Senza area", "non_classificato": "Non classificato",
    ]
    /// `--swatch-*` keys.
    public static let sectorColors: [String: String] = [
        "tecnologia": "blue", "finanza": "indigo", "salute": "emerald", "industria": "slate-dark", "consumi_ciclici": "rose",
        "consumi_difensivi": "lime", "comunicazioni": "violet", "energia": "orange", "materiali": "amber-dark",
        "servizi_pubblici": "cyan", "immobiliare": "pink", "obbligazioni": "teal", "liquidita": "green-light",
        "materie_prime": "yellow", "crypto": "orange-dark", "altro": "purple-light", "non_classificato": "slate-light",
    ]
    public static let areaColors: [String: String] = [
        "nord_america": "blue", "europa": "indigo", "italia": "emerald", "giappone": "rose", "pacifico": "cyan",
        "emergenti": "amber", "nessuna": "orange", "non_classificato": "slate-light",
    ]
    /// Lucide icon keys of the sectors.
    public static let sectorIcons: [String: String] = [
        "tecnologia": "cpu", "finanza": "landmark", "salute": "heart-pulse", "industria": "factory", "consumi_ciclici": "shopping-bag",
        "consumi_difensivi": "shopping-cart", "comunicazioni": "radio-tower", "energia": "zap", "materiali": "pickaxe",
        "servizi_pubblici": "droplets", "immobiliare": "building-2", "obbligazioni": "scroll-text", "liquidita": "banknote",
        "materie_prime": "gem", "crypto": "bitcoin", "altro": "shapes", "non_classificato": "circle-question-mark",
    ]
    public static let sourceLabels: [String: String] = [
        "manuale": "Inserita da te", "tipo": "Dal tipo di strumento", "yahoo": "Yahoo Finance", "stima_indice": "Stima dall'indice",
        "isin": "Dal paese dell'ISIN", "nessuno": "Nessun dato",
    ]
    /// Currency colours by weight order (`CURRENCY_COLORS`).
    public static let currencyColors = ["blue", "rose", "emerald", "amber", "violet"]
    /// Rows shown before «Mostra tutti».
    public static let visibleRows = 6
    /// Coverage warning under 90 % classified (INV-047).
    public static let coverageThreshold = 0.9

    /// Web `formatShare`: one decimal under 10 %, else none («4,5%», «23%»).
    public static func share(_ share: Double, locale: BBLocale) -> String {
        BBFormat.formatNumber(share * 100, minimumFractionDigits: share < 0.1 ? 1 : 0, maximumFractionDigits: share < 0.1 ? 1 : 0,
                              locale: locale) + "%"
    }

    /// Allocation drift text (Italian source + values): «in linea», «non nell'obiettivo», «±N punti».
    public static func driftText(_ row: InvestmentsView.AllocationRowView) -> (source: String, values: [String: String]) {
        if !row.inTarget && row.status == "in_linea" { return ("non nell'obiettivo", [:]) }
        if row.status == "in_linea" { return ("in linea", [:]) }
        let points = Int(JSNumber.round(abs(row.drift) * 100))
        return ("{0} punti", ["0": "\(row.drift < 0 ? BBFormat.minusSign : "+")\(points)"])
    }
}

// MARK: - Plain labels (overlaps, correlations; web `plain-labels.ts`)

public enum PlainLabels {
    /// (Italian label, severity `alta` / `media` / `bassa`).
    public static func overlap(_ share: Double) -> (label: String, severity: String) {
        if share >= 0.8 { return ("Quasi lo stesso investimento", "alta") }
        if share >= 0.5 { return ("In buona parte lo stesso", "media") }
        return ("Una parte in comune", "bassa")
    }

    public static func correlation(_ value: Double) -> (label: String, severity: String) {
        if value >= 0.8 { return ("Si muovono quasi sempre insieme", "alta") }
        if value >= 0.5 { return ("Spesso vanno nella stessa direzione", "media") }
        if value >= 0.2 { return ("Si muovono poco insieme", "bassa") }
        return ("Indipendenti", "bassa")
    }

    public static func overlapMethodNote(_ method: String) -> String {
        switch method {
        case "stesso_indice": "Replicano lo stesso indice."
        case "aree_indici": "Stima dagli indici che replicano."
        default: "Almeno così: contando solo i primi 10 titoli."
        }
    }

    /// Average pairwise correlation (nil without pairs).
    public static func averageCorrelation(_ pairs: [InvestmentsView.CorrelationPair]) -> Double? {
        pairs.isEmpty ? nil : pairs.reduce(0) { $0 + $1.value } / Double(pairs.count)
    }

    /// `value.toFixed(2)` with the locale decimal.
    public static func decimal2(_ value: Double, locale: BBLocale) -> String {
        BBFormat.formatNumber(value, minimumFractionDigits: 2, maximumFractionDigits: 2, locale: locale)
    }
}

extension InvestmentsView.Allocation {
    /// The served allocation as the ported engine's input (INV-054 `suggestContribution` runs on the device).
    public var analysis: AllocationAnalysis {
        AllocationAnalysis(rows: rows.map {
            AllocationRow(instrumentId: $0.instrumentId, value: $0.value, currentWeight: $0.currentWeight, targetWeight: $0.targetWeight,
                          drift: $0.drift, status: AllocationStatus(rawValue: $0.status) ?? .inLinea, inTarget: $0.inTarget)
        }, total: total, unpricedIds: unpricedIds, maxDrift: maxDrift)
    }
}

// MARK: - Dividendi / Tasse helpers (INV-074…090)

public enum IncomeRules {
    /// `YYYY-MM-DD` `months` months before `today` (day capped at 28, as the web).
    public static func monthsAgo(_ today: String, months: Int) -> String {
        guard let d = CalendarDate(iso: today) else { return today }
        var y = d.year, m = d.month - months
        while m < 1 { m += 12; y -= 1 }
        return CalendarDate(year: y, month: m, day: min(d.day, 28)).iso
    }

    /// Forecast basis label (Italian source).
    public static func basisLabel(_ basis: String) -> String {
        switch basis {
        case "fonte": "come l'anno scorso"
        case "cedola": "dalla cedola"
        default: "dai tuoi incassi"
        }
    }
}

public enum TaxRules {
    /// INV-083: the last 5 years with data, most recent first.
    public static func recentYears(_ years: [InvestmentsTaxes.TaxYear]) -> [InvestmentsTaxes.TaxYear] {
        Array(years.sorted { $0.year > $1.year }.prefix(5))
    }

    /// INV-087: remaining loss pool by expiry year (crypto separate).
    public static func lossesByExpiry(_ losses: [InvestmentsTaxes.LossEntry], crypto: Bool = false) -> [(expiresYear: Int, amount: Double)] {
        var byYear: [Int: Double] = [:]
        for e in losses where e.crypto == crypto { byYear[e.expiresYear, default: 0] += e.remaining }
        return byYear.keys.sorted().map { ($0, byYear[$0]!) }
    }

    /// INV-088: year ≥ 2000 and not future, amount > 0 and ≤ 100M; nil = valid, else the server's message.
    public static func carryforwardError(year: Int?, amount: Double?, currentYear: Int) -> String? {
        guard let year, year >= 2000 else { return "Anno non valido" }
        if year > currentYear { return "L'anno non può essere futuro" }
        guard let amount, amount > 0, amount <= 100_000_000 else { return "Importo non valido" }
        return nil
    }

    /// Rate source label (Italian source).
    public static func rateSourceLabel(_ source: String?) -> String {
        switch source {
        case "manuale": "impostata da te"
        case "titolo_di_stato": "titolo di Stato, dal nome"
        default: "ordinaria"
        }
    }

    /// INV-082 / SEC-051: coupon fields all or none, rate > 0 ≤ 30 %; nil = valid.
    public static func couponsError(rate: Double?, maturity: String?) -> String? {
        if rate == nil && (maturity ?? "").isEmpty { return nil }
        guard let rate, let maturity, !maturity.isEmpty else { return "Per le cedole servono tasso e scadenza" }
        if rate <= 0 || rate > 30 { return "Tasso non valido" }
        return nil
    }
}

// MARK: - Security page formatting (SEC-019, SEC-035…047)

public struct KeyFact: Equatable, Sendable {
    /// Italian source of the label / note (value already formatted).
    public let label: String
    public let value: String
    public let note: String?
    public let noteValues: [String: String]
}

public struct IndicatorMeta: Equatable, Sendable {
    public let label: String
    public let hint: String
    public let formula: String
    /// `multiple` / `pct` / `years` / `times`.
    public let format: String
}

public enum TitleFormat {
    public static let indicatorMeta: [String: IndicatorMeta] = [
        "pe": .init(label: "P/E (prezzo / utili)", hint: "Anni di utili, ai ritmi di oggi, per ripagare il prezzo.", formula: "Prezzo ÷ utile per azione degli ultimi 12 mesi.", format: "multiple"),
        "ps": .init(label: "P/S (prezzo / ricavi)", hint: "Quanto si paga per ogni euro di ricavi.", formula: "Prezzo ÷ ricavi per azione degli ultimi 12 mesi.", format: "multiple"),
        "pb": .init(label: "P/B (prezzo / patrimonio)", hint: "Prezzo rispetto al patrimonio contabile.", formula: "Prezzo ÷ patrimonio netto per azione dell'ultimo bilancio.", format: "multiple"),
        "pfcf": .init(label: "P/FCF (prezzo / cassa libera)", hint: "Prezzo rispetto alla cassa che resta dopo gli investimenti.", formula: "Prezzo ÷ cassa libera per azione degli ultimi 12 mesi.", format: "multiple"),
        "evEbitda": .init(label: "EV / EBITDA", hint: "Valore dell'azienda, debiti compresi, rispetto al margine operativo.", formula: "(Capitalizzazione + debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", format: "multiple"),
        "earningsYield": .init(label: "Rendimento degli utili", hint: "L'inverso del P/E: utile per ogni 100 di prezzo.", formula: "Utile per azione ÷ prezzo.", format: "pct"),
        "gross": .init(label: "Margine lordo", hint: "Ricavi meno il costo di ciò che si vende.", formula: "Utile lordo ÷ ricavi.", format: "pct"),
        "operating": .init(label: "Margine operativo", hint: "Quanto resta dopo i costi di gestione.", formula: "Utile operativo ÷ ricavi.", format: "pct"),
        "net": .init(label: "Margine netto", hint: "Utile su ogni 100 di ricavi.", formula: "Utile netto ÷ ricavi.", format: "pct"),
        "roe": .init(label: "ROE", hint: "Utile sul capitale degli azionisti.", formula: "Utile netto degli ultimi 12 mesi ÷ patrimonio netto.", format: "pct"),
        "roa": .init(label: "ROA", hint: "Utile su tutto ciò che l'azienda possiede.", formula: "Utile netto degli ultimi 12 mesi ÷ totale attivo.", format: "pct"),
        "roic": .init(label: "ROIC (prima delle tasse)", hint: "Rendimento del capitale investito, debiti compresi.", formula: "Utile operativo ÷ (patrimonio netto + debiti − liquidità).", format: "pct"),
        "interestCoverage": .init(label: "Copertura degli interessi", hint: "Quante volte l'utile operativo paga gli interessi.", formula: "Utile operativo ÷ interessi passivi.", format: "times"),
        "debtToEquity": .init(label: "Debiti / patrimonio", hint: "Sopra 1 l'azienda usa più debiti che capitale proprio.", formula: "Debiti finanziari ÷ patrimonio netto.", format: "multiple"),
        "netDebtToEbitda": .init(label: "Debito netto / EBITDA", hint: "Anni di margine operativo per ripagare il debito netto.", formula: "(Debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", format: "years"),
        "currentRatio": .init(label: "Liquidità corrente", hint: "Attività a breve rispetto ai debiti a breve.", formula: "Attività correnti ÷ passività correnti.", format: "multiple"),
        "payout": .init(label: "Payout", hint: "Parte dell'utile distribuita come dividendo.", formula: "Dividendi pagati ÷ utile netto degli ultimi 12 mesi.", format: "pct"),
    ]
    public static let valuationOrder = ["pe", "ps", "pb", "pfcf", "evEbitda", "earningsYield"]
    public static let marginOrder = ["gross", "operating", "net"]
    public static let profitabilityOrder = ["roe", "roa", "roic", "interestCoverage"]
    public static let solidityOrder = ["debtToEquity", "netDebtToEbitda", "currentRatio", "payout"]
    public static let perShareRows: [(key: String, label: String)] = [("revenue", "Ricavi"), ("eps", "Utile"), ("fcf", "Cassa libera"),
                                                                       ("book", "Patrimonio"), ("dividend", "Dividendo")]

    /// `formatIndicator` («14,2», «16,2%», «2,6 anni» → years word translated by caller via `{0} anni`, «5,8×»).
    public static func indicator(_ value: Double, format: String, locale: BBLocale) -> String {
        switch format {
        case "pct": return BBFormat.formatRatio(value * 100, locale: locale) + "%"
        case "years": return BBFormat.formatRatio(value, locale: locale)
        case "times": return BBFormat.formatRatio(value, locale: locale) + "×"
        default: return BBFormat.formatRatio(value, digits: abs(value) < 10 ? 2 : 1, locale: locale)
        }
    }

    /// Per-share amount: 2 decimals (4 under 0,1) + currency code.
    public static func perShare(_ value: Double, currency: String, locale: BBLocale) -> String {
        let digits = abs(value) < 0.1 ? 4 : 2
        return "\(BBFormat.formatNumber(value, minimumFractionDigits: digits, maximumFractionDigits: digits, locale: locale)) \(currency)"
    }

    /// A formula operand in its unit (Italian «azioni» translated by the caller through `shares`).
    public static func operand(_ term: TitleAnalysis.Indicator.Term, currency: String, priceCurrency: String, locale: BBLocale,
                               sharesWord: String = "azioni") -> String {
        switch term.unit {
        case "price": perShare(term.value, currency: priceCurrency, locale: locale)
        case "perShare": perShare(term.value, currency: currency, locale: locale)
        case "shares": "\(BBFormat.formatCompactAmount(term.value, locale: locale)) \(sharesWord)"
        default: "\(BBFormat.formatCompactAmount(term.value, locale: locale)) \(currency)"
        }
    }

    /// SEC-019: up to six «in breve» facts by type, then volatility and distance from the high.
    public static func keyFacts(_ a: TitleAnalysis, locale: BBLocale) -> [KeyFact] {
        let currency = a.instrument.currency
        let f = a.fundamentals
        var facts: [KeyFact?] = []
        func fact(_ label: String, _ value: String, _ note: String? = nil, _ values: [String: String] = [:]) -> KeyFact {
            KeyFact(label: label, value: value, note: note, noteValues: values)
        }
        switch a.instrument.kind {
        case .azione:
            let pe = a.stock?.valuation["pe"]?.value ?? f?.trailingPE
            let revenue = a.stock?.perShare["revenue"]?.last ?? nil
            let yieldToday = a.dividends?.yieldToday ?? f?.dividendYield
            facts.append(f?.marketCap.map { fact("Capitalizzazione", "\(BBFormat.formatCompactAmount($0, locale: locale)) \(currency)") })
            facts.append(pe.map { fact("P/E", indicator($0, format: "multiple", locale: locale), "utili ultimi 12 mesi") })
            if let revenue, let stock = a.stock {
                facts.append(fact("Ricavi per azione", perShare(revenue, currency: stock.currency, locale: locale), "ultimi 12 mesi"))
            } else if let rps = f?.revenuePerShare {
                facts.append(fact("Ricavi per azione", perShare(rps, currency: currency, locale: locale), "ultimi 12 mesi"))
            }
            if let y = yieldToday, y > 0 {
                let trailing = a.dividends.flatMap { $0.trailing > 0 ? $0.trailing : nil }
                facts.append(fact("Dividendo", BBFormat.formatPct(y, locale: locale), trailing == nil ? nil : "{0} in 12 mesi",
                                  trailing.map { ["0": perShare($0, currency: currency, locale: locale)] } ?? [:]))
            }
        case .etf, .fondo:
            let y = f?.fundYield ?? a.dividends?.yieldToday
            facts.append(f?.expenseRatio.map { fact("Costo annuo (TER)", BBFormat.formatPct($0, digits: 2, locale: locale), "{0} ogni 10.000",
                                                    ["0": "\(BBFormat.formatCompactAmount($0 * 10_000, locale: locale)) \(currency)"]) })
            facts.append(f?.totalAssets.map { fact("Patrimonio", "\(BBFormat.formatCompactAmount($0, locale: locale)) \(currency)") })
            facts.append(f?.fundCategory.map { fact("Categoria", $0) })
            if let y, y > 0 { facts.append(fact("Rendimento da dividendo", BBFormat.formatPct(y, locale: locale))) }
        default:
            if let stats = a.stats {
                facts.append(stats.returns["1A"].map { fact("1 anno", BBFormat.formatSignedPct($0, locale: locale)) })
                facts.append(stats.returns["YTD"].map { fact("Da inizio anno", BBFormat.formatSignedPct($0, locale: locale)) })
            }
        }
        if let v = a.stats?.volatility { facts.append(fact("Volatilità", BBFormat.formatPct(v, digits: 0, locale: locale), "ultimo anno")) }
        if let h = a.stats?.fromHigh {
            facts.append(fact("Dal massimo", h < -0.005 ? BBFormat.formatSignedPct(h, locale: locale) : "sui massimi", "52 settimane"))
        }
        return Array(facts.compactMap { $0 }.prefix(6))
    }

    /// SEC-024: position of the last close in the 52-week range (0…1).
    public static func rangePosition(last: Double, low: Double, high: Double) -> Double {
        high > low ? min(1, max(0, (last - low) / (high - low))) : 0.5
    }
}
