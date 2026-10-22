import Foundation

// Pensione screens state and rules (spec: features/09-pension.md). The server computes performance, scenarios, TFR,
// yearly breakdown and the exit-tax timeline per whole year (`GET /api/pension/view`); the projection sliders run
// `PensionCalc.projectPension` on the device. Same names on Android (`PensionUiState.kt`).

/// The five Pensione tabs (PEN tabs table).
public enum PensionTab: String, Sendable, CaseIterable {
    case overview, trend, scenarios, projection, data

    public var title: String {
        switch self {
        case .overview: "Panoramica"
        case .trend: "Andamento"
        case .scenarios: "Scenari"
        case .projection: "Proiezione"
        case .data: "I tuoi dati"
        }
    }

    public var description: String {
        switch self {
        case .overview: "Il fondo in sintesi"
        case .trend: "Contributi e valore nel tempo"
        case .scenarios: "Cosa cambia con ipotesi diverse"
        case .projection: "Quanto potresti avere alla pensione"
        case .data: "Fondo, fotografie e importazioni"
        }
    }

    /// Lucide icon key in the views sheet (web `PENSION_TABS`).
    public var iconKey: String {
        switch self {
        case .overview: "layout-dashboard"
        case .trend: "chart-column"
        case .scenarios: "scale"
        case .projection: "hourglass"
        case .data: "database"
        }
    }

    /// Web sub-paths (`/pensione/scenari`…).
    public init?(path: String) {
        let clean = String(path.split(separator: "?").first ?? "")
        switch clean {
        case "/pensione": self = .overview
        case "/pensione/andamento": self = .trend
        case "/pensione/scenari": self = .scenarios
        case "/pensione/proiezione": self = .projection
        case "/pensione/dati": self = .data
        default: return nil
        }
    }
}

/// What the Pensione frame shows (PEN states). Same cases as `PensionGate` on Android.
public enum PensionGate: Equatable, Sendable {
    case loading, failed
    /// DE (403 `country_feature_unavailable`, PEN-001).
    case unavailable
    /// No fund: the add-fund form inline (PEN-005).
    case empty
    case content

    public static func of(view: PensionView?, failed: Bool, unavailable: Bool) -> PensionGate {
        if unavailable { return .unavailable }
        guard let view else { return failed ? .failed : .loading }
        return view.fund == nil ? .empty : .content
    }
}

/// One snapshot row of «I tuoi dati» with the contribution derived from the previous one (PEN-011).
public struct PensionSnapshotRow: Equatable, Sendable, Identifiable {
    public let snapshot: PensionSnapshot
    /// nil without a previous snapshot or when the delta is ≤ 0 (shown as «—»).
    public let delta: Double?
    public var id: String { snapshot.id }
}

/// Pure rules of the Pensione screens. Same names on Android (`PensionRules`).
public enum PensionRules {
    /// PEN-007.
    public static let maxFunds = 10
    public static let nameMaxLength = 80
    /// PEN-011.
    public static let visibleSnapshots = 6
    /// PEN-020.
    public static let minChartPoints = 2
    /// PEN-021 «Tra 25 anni».
    public static let previewYears = 25
    public static let flatYears = 15
    /// PEN-017.
    public static let importMaxRows = 1000
    public static let maxSnapshots = 5000
    public static let minYear = 1950

    /// PEN-011: newest first, with the contribution delta versus the previous snapshot (by date).
    public static func snapshotRows(_ snapshots: [PensionSnapshot]) -> [PensionSnapshotRow] {
        let sorted = snapshots.sorted { $0.date < $1.date }
        return sorted.enumerated().map { index, snapshot in
            let delta = index > 0 ? snapshot.netContributions - sorted[index - 1].netContributions : nil
            return PensionSnapshotRow(snapshot: snapshot, delta: delta.flatMap { $0 > 0 ? $0 : nil })
        }.reversed()
    }

    /// PEN-010: a snapshot amount (≥ 0, locale decimal; empty → nil).
    public static func parseAmount(_ text: String) -> Double? {
        guard let value = BBFormat.parseAmount(text), value >= 0 else { return nil }
        return value
    }

    /// `isPlausiblePensionDate`: real date, year ≥ 1950, not after today + 1 day.
    public static func isPlausibleDate(_ value: String, today: String) -> Bool {
        guard let day = CalendarDate(iso: value), day.iso == value, day.year >= minYear,
              let limit = CalendarDate(iso: today)?.adding(days: 1) else { return false }
        return day.epochDay <= limit.epochDay
    }

    /// PEN-008: save only when changed and valid.
    public static func canSaveProfile(name: String, date: String, originalName: String, originalDate: String) -> Bool {
        let trimmed = JSNumber.trim(name)
        let changed = trimmed != originalName || date != originalDate
        return changed && !trimmed.isEmpty && !date.isEmpty
    }

    /// PEN-022: best and worst year by gain (only with more than one year).
    public static func bestAndWorst(_ years: [PensionView.Year]) -> (best: PensionView.Year, worst: PensionView.Year)? {
        guard years.count > 1, var best = years.first, var worst = years.first else { return nil }
        for year in years.dropFirst() {
            if year.gain > best.gain { best = year }
            if year.gain < worst.gain { worst = year }
        }
        return (best, worst)
    }

    /// PEN-021: the fund beats the company TFR.
    public static func beatsTfr(_ view: PensionView) -> Bool {
        guard let annual = view.performance?.annualReturn, let tfr = view.tfr else { return false }
        return annual >= tfr.annualRate
    }

    /// PEN-025: the scenarios for `years` of participation (precomputed timeline, clamped to 0…35).
    public static func scenarios(_ view: PensionView, years: Int?) -> [PensionView.Scenario] {
        guard let years else { return view.scenarios }
        let clamped = min(view.exitTax.maxYears, max(0, years))
        return view.exitTax.timeline.first { $0.years == clamped }?.scenarios ?? view.scenarios
    }

    /// PEN-027: default quarterly contribution rounded to the slider step.
    public static func defaultQuarterly(_ view: PensionView) -> Double {
        let step = view.projection.sliders.quarterlyContribution.step
        let raw = view.projection.sliders.quarterlyContribution.default
        return step > 0 ? (raw / step).rounded() * step : raw
    }

    /// PEN-027/028: projection points for the sliders.
    public static func projection(startValue: Double, quarterly: Double, years: Int, rates: PensionView.Projection.Rates) -> [PensionProjectionPoint] {
        PensionCalc.projectPension(startValue: startValue, quarterlyContribution: quarterly, years: Double(years),
                                   rates: PensionProjectionRates(prudent: rates.prudent, base: rates.base, optimistic: rates.optimistic))
    }
}

/// Everything the Pensione frame renders. Same fields as `PensionUiState` on Android.
public struct PensionUiState: Equatable, Sendable {
    public var view: PensionView?
    public var failed = false
    public var unavailable = false
    public var tab: PensionTab = .overview
    /// PEN-003: selected fund (in memory, default first).
    public var fundId: String?
    /// PEN-025: simulated years of participation (nil = today's).
    public var simulatedYears: Int?
    /// PEN-027 sliders (nil = defaults from the view).
    public var projectionYears: Int?
    public var projectionQuarterly: Double?

    public init() {}

    public var gate: PensionGate { PensionGate.of(view: view, failed: failed, unavailable: unavailable) }
    public var fund: PensionView.Fund? { view?.fund }

    /// PEN-013: analysis tabs need a snapshot.
    public var hasSnapshots: Bool { view?.last != nil && view?.performance != nil }

    /// PEN-025: years shown by the chip.
    public var shownYears: Int {
        guard let view else { return 0 }
        return min(view.exitTax.maxYears, max(0, simulatedYears ?? view.exitTax.realYears))
    }

    /// The simulation is active only when it differs from today's years.
    public var isSimulating: Bool {
        guard let view, let simulatedYears else { return false }
        return simulatedYears != view.exitTax.realYears
    }

    public var scenarios: [PensionView.Scenario] {
        guard let view else { return [] }
        return isSimulating ? PensionRules.scenarios(view, years: simulatedYears) : view.scenarios
    }

    public var years: Int { projectionYears ?? Int(view?.projection.sliders.years.default ?? 25) }
    public var quarterly: Double { projectionQuarterly ?? view.map(PensionRules.defaultQuarterly) ?? 0 }

    /// Selecting another fund resets the per-fund simulations (web: the rate simulation resets with the fund).
    public mutating func select(fundId: String) {
        self.fundId = fundId
        simulatedYears = nil
        projectionQuarterly = nil
    }
}

/// Pensione phrasing (web components under `components/domain/pension`), bound to one language. Same API on Android.
public struct PensionText {
    public let locale: BBLocale
    private let translate: (String) -> String

    public init(locale: BBLocale, translate: @escaping (String) -> String) {
        self.locale = locale
        self.translate = translate
    }

    public func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    /// Web `money` of Pensione: no decimals.
    public func money(_ value: Double, _ currency: String, masked: Bool = false) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: masked)
    }

    public func percent(_ ratio: Double, digits: Int = 1) -> String { BBFormat.formatPct(ratio, digits: digits, locale: locale) }

    /// «+5,9%» / «−1,2%».
    public func signedPercent(_ ratio: Double) -> String {
        (ratio >= 0 ? "+" : BBFormat.minusSign) + percent(abs(ratio))
    }

    /// «+1.162 €» / «−80 €».
    public func signedMoney(_ value: Double, _ currency: String, masked: Bool = false) -> String {
        (value >= 0 ? "+" : BBFormat.minusSign) + money(abs(value), currency, masked: masked)
    }

    public func longDate(_ iso: String) -> String {
        CalendarDate(iso: iso).map { BBFormat.formatLongDate($0, locale: locale) } ?? iso
    }

    public func shortDate(_ iso: String) -> String { BBFormat.formatDateWithYear(iso, locale: locale) }

    /// Chart axis label «set 26».
    public func chartDate(_ iso: String) -> String {
        guard let d = CalendarDate(iso: iso) else { return iso }
        return "\(BBFormat.shortMonthLabel(d.month, locale: locale)) \(String(d.year % 100).leftPad(2))"
    }

    /// PEN-019 eyebrow: «{fondo} · aggiornato al {data lunga}».
    public func heroEyebrow(name: String, lastDate: String) -> String {
        "\(name) · \(tr("aggiornato al")) \(longDate(lastDate))"
    }

    /// PEN-019: «di guadagno|di perdita sui contributi versati».
    public func gainCaption(_ gain: Double) -> String {
        "\(gain >= 0 ? tr("di guadagno") : tr("di perdita")) \(tr("sui contributi versati"))"
    }

    public func annualReturnLabel(approximate: Bool) -> String {
        tr("Rendimento annuo") + (approximate ? tr(" (stima)") : "")
    }

    public func reasonTitle(_ reason: String) -> String {
        switch reason {
        case "pensionamento": tr("Alla pensione")
        case "sanitarie": tr("Spese sanitarie straordinarie")
        default: tr("Altri motivi")
        }
    }

    public func reasonDetail(_ reason: String) -> String {
        switch reason {
        case "pensionamento": tr("Fino al 50-60% in capitale, il resto in rendita")
        case "sanitarie": tr("Anticipazione per terapie e interventi")
        default: tr("Riscatto fuori dai casi previsti dalla legge")
        }
    }

    /// PEN-023 detail line: «{dettaglio} · aliquota 15,0%» (+ « · +120 € rispetto a oggi» while simulating).
    public func scenarioDetail(_ scenario: PensionView.Scenario, delta: Double, currency: String, masked: Bool = false) -> [InvestmentsTextRun] {
        var runs = [InvestmentsTextRun("\(reasonDetail(scenario.reason)) \(tr("· aliquota")) \(percent(scenario.rate))", .muted)]
        if delta != 0 {
            runs.append(InvestmentsTextRun(" · \(signedMoney(delta, currency, masked: masked)) \(tr("rispetto a oggi"))", delta > 0 ? .pos : .neg))
        }
        return runs
    }

    /// PEN-024 conclusion.
    public func tfrConclusion(fundValue: Double, tfr: PensionView.Tfr, inflation: Double, currency: String, masked: Bool = false) -> [InvestmentsTextRun] {
        let diff = fundValue - tfr.net
        let better = diff >= 0
        let diffPct = tfr.net > 0 ? diff / tfr.net : nil
        return [
            InvestmentsTextRun("\(better ? tr("Finora il fondo ha reso") : tr("Finora il TFR in azienda avrebbe reso")) ", .muted),
            InvestmentsTextRun(money(abs(diff), currency, masked: masked), better ? .pos : .neg),
            InvestmentsTextRun((diffPct.map { " (\(signedPercent(abs($0))))" } ?? "")
                + " \(tr("in più. Rivalutazione in azienda stimata al")) \(percent(tfr.annualRate)) \(tr("l'anno con inflazione ipotizzata al")) \(percent(inflation))\(tr(": il confronto ha senso solo su periodi lunghi, perché il fondo oscilla."))", .muted),
        ]
    }

    /// PEN-025 summary while simulating (runs), or the idle hint.
    public func taxSimulation(state: PensionUiState, adhesionDate: String, currency: String, masked: Bool = false) -> [InvestmentsTextRun] {
        guard state.isSimulating, let view = state.view else {
            return [InvestmentsTextRun(tr("Trascina l'aliquota lungo la linea (o usa le frecce) per vedere cosa cambierebbe nelle stime. Resta solo su questa pagina: non viene salvato nulla."), .muted)]
        }
        let years = state.shownYears
        let year = (Int(adhesionDate.prefix(4)) ?? 0) + years
        let scenario = state.scenarios.first
        let baseline = view.scenarios.first
        var runs = [
            InvestmentsTextRun(tr("Simulazione"), .strong),
            InvestmentsTextRun("\(tr(": dopo")) \(years) \(tr("anni di adesione (nel")) \(year)\(tr(") l'aliquota sarebbe")) \(percent(scenario?.rate ?? 0))"),
        ]
        if let scenario, let baseline {
            let delta = scenario.netLow - baseline.netLow
            runs.append(InvestmentsTextRun("\(tr(", e alla pensione ti resterebbero almeno")) "))
            runs.append(InvestmentsTextRun(money(scenario.netLow, currency, masked: masked), .strong))
            runs.append(InvestmentsTextRun(" (\(signedMoney(delta, currency, masked: masked)) \(tr("rispetto a oggi)."))"))
        } else {
            runs.append(InvestmentsTextRun("."))
        }
        return runs
    }

    /// PEN-028: «tra {n} anni, di cui {importo} di rendimento».
    public func projectionCaption(years: Int, gain: Double, currency: String, masked: Bool = false) -> String {
        "\(tr("tra")) \(years) \(tr("anni, di cui")) \(money(max(0, gain), currency, masked: masked)) \(tr("di rendimento"))"
    }

    /// PEN-028 sentence (runs).
    public func paidInSentence(_ paidIn: Double, currency: String, masked: Bool = false) -> [InvestmentsTextRun] {
        [
            InvestmentsTextRun("\(tr("Verserai ancora")) ", .muted),
            InvestmentsTextRun(money(paidIn, currency, masked: masked), .strong),
            InvestmentsTextRun(tr(": il resto del valore finale è rendimento. Con meno anni o versamenti più bassi la cifra scende, muovi gli slider per vederlo."), .muted),
        ]
    }

    /// PEN-022 best/worst: «2024 · +412 € (+5,1%)».
    public func yearLine(_ year: PensionView.Year, currency: String, masked: Bool = false) -> String {
        "\(year.year) · \(signedMoney(year.gain, currency, masked: masked))" + (year.returnRate.map { " (\(signedPercent($0)))" } ?? "")
    }
}

extension String {
    func leftPad(_ width: Int) -> String { count >= width ? self : String(repeating: "0", count: width - count) + self }
}
