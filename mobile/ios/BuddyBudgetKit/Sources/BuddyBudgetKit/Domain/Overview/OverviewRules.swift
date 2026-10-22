import Foundation

// Presentation rules of the Overview (spec: features/02-overview.md). Numbers come from `GET /api/overview`; these are
// the client-side choices the web makes while rendering (greeting, legend toggles, which blocks show, step copy…).
// Visible text is returned as Italian catalog sources (`CatalogText`) that the UI translates. Same names on Android.

/// An Italian catalog source plus its `{n}` values, translated by the UI (`L10n.lookup` / `tr`).
public struct CatalogText: Equatable, Hashable, Sendable {
    public let source: String
    public let values: [String: String]

    public init(_ source: String, _ values: [String: String] = [:]) {
        self.source = source
        self.values = values
    }
}

// MARK: - Greeting (OV-001, OV-002)

public enum Greeting {
    /// OV-001: `Buongiorno` before 12, `Buon pomeriggio` 12–17, `Buonasera` from 18 (device hour).
    public static func source(hour: Int) -> String {
        if hour < 12 { return "Buongiorno" }
        if hour < 18 { return "Buon pomeriggio" }
        return "Buonasera"
    }

    /// First word of the user's name; nil when the name is empty.
    public static func firstName(_ name: String?) -> String? {
        guard let first = name?.split(separator: " ").first, !first.isEmpty else { return nil }
        return String(first)
    }

    /// `Buongiorno, Giulia` from an already translated greeting.
    public static func title(greeting: String, name: String?) -> String {
        firstName(name).map { "\(greeting), \($0)" } ?? greeting
    }

    /// OV-002: «Martedì 6 ottobre 2026» (long date with weekday, first letter capitalized).
    public static func dateLabel(_ date: CalendarDate, locale: BBLocale) -> String {
        BBFormat.capitalize(BBFormat.formatDate(date, .EEEEdMMMMy, locale: locale))
    }
}

// MARK: - Screen state (OV-005…007)

/// What the Overview body shows under the greeting.
public enum OverviewContent: Equatable, Sendable {
    /// OV-005: skeleton of three blocks.
    case loading
    /// OV-006: `Impossibile caricare i dati della panoramica.` + retry.
    case failed
    /// OV-007: no account, no investments, no pension → checklist (or empty state) + demo offer.
    case empty(OverviewView)
    case loaded(OverviewView)

    public static func resolve(view: OverviewView?, failed: Bool) -> OverviewContent {
        guard let view else { return failed ? .failed : .loading }
        return view.isEmpty ? .empty(view) : .loaded(view)
    }

    public var view: OverviewView? {
        switch self {
        case .empty(let v), .loaded(let v): v
        case .loading, .failed: nil
        }
    }
}

/// Voice sentences (server `voice`): `strong` segments are the figures, masked when amounts are hidden (OV-021).
public enum OverviewVoice {
    public static let mask = "••••"

    public static func segments(_ lines: [OverviewView.VoiceLine], hideAmounts: Bool) -> [OverviewView.VoiceSegment] {
        var out: [OverviewView.VoiceSegment] = []
        for (i, line) in lines.enumerated() {
            for segment in line.segments {
                out.append(segment.strong && hideAmounts ? OverviewView.VoiceSegment(text: mask, strong: true) : segment)
            }
            if i < lines.count - 1 { out.append(OverviewView.VoiceSegment(text: " ")) }
        }
        return out
    }
}

// MARK: - Asset classes

public enum AssetClass {
    public static let liquidity = "liquidita"
    public static let investments = "investimenti"
    public static let pension = "previdenza"
    public static let debts = "debiti"
    /// Stacking order from the bottom (`ASSET_CLASS_ORDER`).
    public static let order = [liquidity, investments, pension, debts]

    /// Italian label (catalog source).
    public static func label(_ key: String) -> String {
        switch key {
        case liquidity: "Liquidità"
        case investments: "Investimenti"
        case pension: "Previdenza"
        case debts: "Debiti"
        default: key
        }
    }

    /// Swatch token of each class (`ASSET_CLASS_COLORS`): `primary`, `neg` or a `--swatch-*` name.
    public static func colorToken(_ key: String) -> String {
        switch key {
        case liquidity: "swatch-teal"
        case investments: "primary"
        case debts: "neg"
        default: "swatch-slate"
        }
    }

    /// Classes with at least one non-zero value, in stacking order (`assetClassesInSeries`).
    public static func present(in series: [OverviewView.SeriesPoint]) -> [String] {
        var present = Set<String>()
        for point in series {
            for (key, value) in point.byClass where value != 0 { present.insert(key) }
        }
        return present.sorted { a, b in
            let ra = order.firstIndex(of: a) ?? order.count, rb = order.firstIndex(of: b) ?? order.count
            return ra != rb ? ra < rb : a < b
        }
    }

    /// OV-022: area screen of a composition row.
    public static func path(_ key: String) -> String {
        switch key {
        case liquidity: "/liquidita/conti"
        case investments: "/investimenti"
        case pension: "/pensione"
        default: "/debiti"
        }
    }
}

// MARK: - Net worth chart (OV-012…020)

public enum NetWorthChartView: String, CaseIterable, Sendable {
    case total, byClass

    public var label: String { self == .total ? "Totale" : "Per classe" }
}

/// `toggleHiddenClass` / `visibleClasses` / `countedClasses` (components/domain/net-worth/net-worth-chart.utils.ts).
public enum NetWorthLegend {
    /// OV-016: showing removes from hidden; hiding adds, but never the last visible class (set unchanged).
    public static func toggle(_ hidden: Set<String>, key: String, allClasses: [String]) -> Set<String> {
        var next = hidden
        if next.contains(key) {
            next.remove(key)
            return next
        }
        let stillVisible = allClasses.filter { $0 != key && !next.contains($0) }
        if stillVisible.isEmpty { return next }
        next.insert(key)
        return next
    }

    public static func visible(_ allClasses: [String], hidden: Set<String>) -> [String] {
        allClasses.filter { !hidden.contains($0) }
    }

    /// Classes that count in the shown total: the visible ones, minus pension when excluded.
    public static func counted(_ visible: [String], pensionIncluded: Bool) -> [String] {
        visible.filter { $0 != AssetClass.pension || pensionIncluded }
    }
}

/// Everything the net-worth card renders, derived from the served series and the local toggles.
public struct NetWorthChartState: Equatable, Sendable {
    public struct LegendItem: Equatable, Sendable {
        public let key: String
        public let visible: Bool
        /// Latest value of the class (0 decimals in the chip).
        public let latest: Double
    }

    public struct Row: Equatable, Sendable {
        public let key: String
        /// Italian source (`Debiti (già sottratti)` for debts).
        public let label: String
        public let value: Double
    }

    /// OV-020: one point's detail (date, rows top-down, total).
    public struct PointDetail: Equatable, Sendable {
        public let date: String
        public let isEstimated: Bool
        public let rows: [Row]
        /// Italian source: `Totale`, `Totale senza previdenza` or `Totale parziale`.
        public let totalLabel: String
        public let total: Double
    }

    public let view: NetWorthChartView
    public let series: [OverviewView.SeriesPoint]
    /// Series behind the headline and the chart (restricted to the visible classes when some are hidden).
    public let shownSeries: [OverviewView.SeriesPoint]
    public let change: OverviewView.Change
    public let hasHistory: Bool
    public let allClasses: [String]
    public let visibleClasses: [String]
    public let isPartial: Bool
    public let hasPension: Bool
    public let pensionExcluded: Bool
    public let showsDebts: Bool
    public let showsNetLine: Bool
    public let tooltipClasses: [String]
    public let totalLabel: String

    /// - Parameters: `change` is the served change (already without pension when excluded).
    public init(series: [OverviewView.SeriesPoint], change: OverviewView.Change, view: NetWorthChartView,
                hidden: Set<String>, pensionIncluded: Bool) {
        let present = AssetClass.present(in: series)
        let hasDebts = present.contains(AssetClass.debts)
        let assets = present.filter { $0 != AssetClass.debts }
        let all = assets.isEmpty ? [AssetClass.liquidity] : assets
        let effectiveHidden = view == .total ? Set<String>() : hidden
        let visible = NetWorthLegend.visible(all, hidden: effectiveHidden)
        let partial = visible.count < all.count
        let hasPension = all.contains(AssetClass.pension)
        let excluded = hasPension && !pensionIncluded
        self.view = view
        self.series = series
        allClasses = all
        visibleClasses = visible
        isPartial = partial
        self.hasPension = hasPension
        pensionExcluded = excluded
        if partial {
            let counted = NetWorthLegend.counted(visible, pensionIncluded: pensionIncluded)
            let restricted = series.map { p in
                OverviewView.SeriesPoint(date: p.date, value: counted.reduce(0) { $0 + (p.byClass[$1] ?? 0) },
                                         byClass: p.byClass, isEstimated: p.isEstimated)
            }
            shownSeries = restricted
            self.change = NetWorthChartState.change(of: restricted)
        } else {
            shownSeries = series
            self.change = change
        }
        hasHistory = series.count >= 2
        let debtsShown = hasDebts && !partial
        showsDebts = debtsShown
        showsNetLine = debtsShown || (excluded && visible.contains(AssetClass.pension))
        if view == .total {
            tooltipClasses = debtsShown ? all + [AssetClass.debts] : all
            totalLabel = excluded ? "Totale senza previdenza" : "Totale"
        } else {
            tooltipClasses = debtsShown ? visible + [AssetClass.debts] : visible
            totalLabel = partial ? "Totale parziale" : excluded ? "Totale senza previdenza" : "Totale"
        }
    }

    /// `computeNetWorthChange`: first vs last point; `deltaPct` on |start|, nil when start is 0 or < 2 points.
    public static func change(of series: [OverviewView.SeriesPoint]) -> OverviewView.Change {
        guard let first = series.first, let last = series.last else {
            return OverviewView.Change(start: 0, end: 0, delta: 0, deltaPct: nil)
        }
        let delta = last.value - first.value
        let pct: Double? = series.count >= 2 && first.value != 0 ? delta / abs(first.value) : nil
        return OverviewView.Change(start: first.value, end: last.value, delta: delta, deltaPct: pct)
    }

    /// OV-014: the `Totale` / `Per classe` toggle.
    public var showsViewToggle: Bool { hasHistory && allClasses.count > 1 }
    /// OV-018: the pension switch.
    public var showsPensionSwitch: Bool { hasPension }
    /// OV-016: legend chips (Per classe, more than one class).
    public var showsLegend: Bool { view == .byClass && hasHistory && allClasses.count > 1 }

    public var legend: [LegendItem] {
        let last = shownSeries.last
        return allClasses.map { LegendItem(key: $0, visible: visibleClasses.contains($0), latest: last?.byClass[$0] ?? 0) }
    }

    /// OV-017: hidden class keys (the UI lower-cases the translated labels).
    public var hiddenClasses: [String] { allClasses.filter { !visibleClasses.contains($0) } }

    /// OV-015 / OV-019: notes under the legend (Per classe), Italian sources.
    public var notes: [String] {
        guard view == .byClass, allClasses.count > 1 || showsNetLine else { return [] }
        var out: [String] = []
        if showsNetLine { out.append("Linea scura: patrimonio netto") }
        if showsDebts { out.append("Il patrimonio netto è già al netto dei debiti") }
        if pensionExcluded && visibleClasses.contains(AssetClass.pension) { out.append("Area grigia: previdenza, non inclusa nel totale") }
        return out
    }

    /// Headline (OV-012), or the scrubbed point (mobile adaptation: the headline follows the finger).
    public func headline(scrub: Int?) -> (value: Double, change: OverviewView.Change) {
        guard let i = scrub, shownSeries.indices.contains(i) else { return (change.end, change) }
        let c = NetWorthChartState.change(of: [shownSeries[0], shownSeries[i]])
        return (shownSeries[i].value, c)
    }

    /// OV-020: detail of one point.
    public func detail(at index: Int) -> PointDetail? {
        guard shownSeries.indices.contains(index) else { return nil }
        let point = shownSeries[index]
        let rows: [Row] = tooltipClasses.count > 1
            ? tooltipClasses.reversed().map { key in
                Row(key: key, label: key == AssetClass.debts ? "Debiti (già sottratti)" : AssetClass.label(key), value: point.byClass[key] ?? 0)
            }
            : []
        return PointDetail(date: point.date, isEstimated: point.isEstimated, rows: rows, totalLabel: totalLabel, total: point.value)
    }

    /// X-axis label of a point: `d MMM` for daily periods, `MMM yy` for monthly ones.
    public static func axisLabel(_ date: String, period: OverviewPeriod, locale: BBLocale) -> String {
        guard let d = CalendarDate(iso: date) else { return date }
        let skeleton: BBDateSkeleton = (period == .oneMonth || period == .threeMonths) ? .dMMM : .MMMyy
        return BBFormat.formatDate(d, skeleton, locale: locale)
    }
}

/// Stacked areas of `Per classe` (OV-015): cumulative bands from the bottom, plus the plot's Y domain.
public enum NetWorthStack {
    public struct Band: Equatable, Sendable {
        public let key: String
        public let lower: [Double]
        public let upper: [Double]
    }

    public static func bands(_ series: [OverviewView.SeriesPoint], classes: [String]) -> [Band] {
        var base = Array(repeating: 0.0, count: series.count)
        return classes.map { key in
            let lower = base
            let upper = series.enumerated().map { i, p in base[i] + (p.byClass[key] ?? 0) }
            base = upper
            return Band(key: key, lower: lower, upper: upper)
        }
    }

    /// Recharts `[0, auto]` with the hidden Y axis: from min(0, lowest value) to the nice maximum.
    public static func domain(bands: [Band], netLine: [Double]?) -> ClosedRange<Double> {
        let values = bands.flatMap { $0.upper + $0.lower } + (netLine ?? [])
        let lo = min(0, values.min() ?? 0)
        let hi = max(values.max() ?? 1, lo + 1)
        let ticks = ChartScale.niceTicks(min: lo, max: hi)
        return (ticks.first ?? lo)...(ticks.last ?? hi)
    }

    /// Closed band between two curves (monotone upper edge left→right, lower edge right→left), as Recharts draws a
    /// stacked area whose base is the previous series.
    public static func bandPath(upper: [ChartPoint], lower: [ChartPoint], curve: ChartCurve = .monotone) -> [ChartPathCommand] {
        guard let first = lower.first, let last = lower.last, !upper.isEmpty else { return [] }
        // Replay each lower segment p[i] → p[i+1] backwards, from p[i+1] to p[i].
        var segments: [(from: ChartPoint, command: ChartPathCommand)] = []
        var cursor = first
        for command in ChartPaths.line(lower, curve: curve).dropFirst() {
            segments.append((cursor, command))
            switch command {
            case .line(let p), .cubic(_, _, let p): cursor = p
            default: break
            }
        }
        var back: [ChartPathCommand] = [.line(last)]
        for (from, command) in segments.reversed() {
            switch command {
            case .line: back.append(.line(from))
            case .cubic(let c1, let c2, _): back.append(.cubic(c2, c1, from))
            default: break
            }
        }
        return ChartPaths.line(upper, curve: curve) + back + [.close]
    }

    /// X labels kept by Recharts' default `preserveEnd` thinning with `minTickGap`: walk from the end, keep a label
    /// when it does not overlap the previously kept one. `centers`/`widths` in points.
    public static func thinLabels(centers: [Double], widths: [Double], minGap: Double = 32, plotWidth: Double) -> [Int] {
        guard !centers.isEmpty else { return [] }
        var kept: [Int] = []
        var lastStart = Double.infinity
        for i in stride(from: centers.count - 1, through: 0, by: -1) {
            let half = widths[i] / 2
            var start = centers[i] - half
            var end = centers[i] + half
            if i == centers.count - 1 { end = min(end, plotWidth); start = end - widths[i] }
            if start < 0 { continue }
            if end + minGap <= lastStart {
                kept.append(i)
                lastStart = start
            }
        }
        return kept.reversed()
    }
}

// MARK: - Composition (OV-022…025)

public enum CompositionDisplay {
    public static func assetCount(_ items: [OverviewView.CompositionItem]) -> Int { items.filter { !$0.isLiability }.count }

    /// Slices: assets with a positive share.
    public static func donutItems(_ items: [OverviewView.CompositionItem]) -> [OverviewView.CompositionItem] {
        items.filter { !$0.isLiability && $0.share > 0 }
    }

    /// OV-024: donut with 2 or more asset classes.
    public static func showsDonut(_ items: [OverviewView.CompositionItem]) -> Bool {
        assetCount(items) > 1 && !donutItems(items).isEmpty
    }

    /// `computeInvestedShare`: the investments share when there are 2+ asset classes.
    public static func investedShare(_ items: [OverviewView.CompositionItem]) -> Double? {
        guard assetCount(items) >= 2 else { return nil }
        return items.first { $0.key == AssetClass.investments }?.share
    }

    /// OV-023: ` · {pct}%` on asset rows when there are 2+ asset classes.
    public static func showsShare(_ item: OverviewView.CompositionItem, in items: [OverviewView.CompositionItem]) -> Bool {
        assetCount(items) > 1 && !item.isLiability
    }

    /// `Math.round(ratio × 100)%`.
    public static func percent(_ ratio: Double) -> String { "\(Int((ratio * 100).rounded()))%" }

    /// Sentence under the title when there is no donut (`investedSentence`).
    public static func sentence(_ items: [OverviewView.CompositionItem]) -> CatalogText? {
        guard let share = investedShare(items), !showsDonut(items) else { return nil }
        if share == 0 { return CatalogText("Per ora è tutto liquidità.") }
        return CatalogText("Il {0} è investito, il resto è liquidità.", ["0": percent(share)])
    }
}

// MARK: - Month pace (OV-026)

public enum MonthPaceDisplay {
    /// Budget used (capped at 1), nil without budgets.
    public static func budgetUsed(_ pace: OverviewView.MonthPace) -> Double? {
        guard let total = pace.budgetTotal, total > 0 else { return nil }
        return min(1, pace.budgetSpent / total)
    }

    public static func isOverBudget(_ pace: OverviewView.MonthPace) -> Bool {
        guard let total = pace.budgetTotal else { return false }
        return pace.budgetSpent > total
    }

    /// `restano {0}` / `sforato di {0}` with the amount to format.
    public static func budgetText(_ pace: OverviewView.MonthPace) -> (source: String, amount: Double)? {
        guard budgetUsed(pace) != nil, let total = pace.budgetTotal else { return nil }
        return isOverBudget(pace) ? ("sforato di {0}", pace.budgetSpent - total) : ("restano {0}", total - pace.budgetSpent)
    }
}

/// Geometry of the hand-drawn `MonthPaceChart` (charts.md §3): height 200, pad {22, 64, 28, 8}, max × 1.12.
public struct MonthPaceGeometry: Equatable, Sendable {
    public static let height = 200.0
    public static let padTop = 22.0, padRight = 64.0, padBottom = 28.0, padLeft = 8.0

    public let width: Double
    public let max: Double
    public let daysInMonth: Int

    public init(pace: OverviewView.MonthPace, width: Double) {
        self.width = Swift.max(240, width)
        daysInMonth = pace.daysInMonth
        max = Swift.max(1, pace.current.max() ?? 0, pace.typical?.max() ?? 0) * 1.12
    }

    public func x(day: Int) -> Double {
        MonthPaceGeometry.padLeft + Double(day - 1) / Double(Swift.max(1, daysInMonth - 1))
            * (width - MonthPaceGeometry.padLeft - MonthPaceGeometry.padRight)
    }

    public func y(_ value: Double) -> Double {
        MonthPaceGeometry.padTop + (1 - value / max) * (MonthPaceGeometry.height - MonthPaceGeometry.padTop - MonthPaceGeometry.padBottom)
    }

    public func points(_ values: [Double]) -> [ChartPoint] {
        values.enumerated().map { ChartPoint(x: x(day: $0.offset + 1), y: y($0.element)) }
    }

    /// X ticks: 1, mid-month, last day.
    public var ticks: [Int] { [1, Int((Double(daysInMonth) / 2).rounded(.up)), daysInMonth] }
    public var baselineY: Double { MonthPaceGeometry.height - MonthPaceGeometry.padBottom }
}

// MARK: - Investments pulse (OV-028)

public struct InvestmentsPulse: Equatable, Sendable {
    public let value: Double
    public let paid: Double
    public let marketGain: Double
    public let positions: Int

    public init(_ inv: OverviewView.Investments) {
        value = inv.value
        paid = inv.paid
        marketGain = inv.marketGain
        positions = inv.positions
    }

    public var isLoss: Bool { marketGain < 0 }
    public var sign: String { isLoss ? "−" : "+" }
    /// Gain on paid, nil when nothing was paid.
    public var ratio: Double? { paid > 0 ? marketGain / paid : nil }
    /// Share of the bar for the paid part (never above 100%).
    public var paidShare: Double { value > 0 ? Swift.min(1, Swift.max(0, Swift.min(paid, value) / value)) : 0 }

    /// `{±x,x}% sul versato`, or `dal mercato` when nothing was paid.
    public func ratioText(locale: BBLocale) -> CatalogText {
        guard let ratio else { return CatalogText("dal mercato") }
        let pct = BBFormat.formatNumber(abs(ratio * 100), minimumFractionDigits: 1, maximumFractionDigits: 1, locale: locale)
        return CatalogText("{0}{1}% sul versato", ["0": sign, "1": pct])
    }

    /// `1 posizione` / `{0} posizioni`.
    public var positionsText: CatalogText {
        positions == 1 ? CatalogText("1 posizione") : CatalogText("{0} posizioni", ["0": String(positions)])
    }
}

// MARK: - Upcoming dues (OV-027)

public enum UpcomingDues {
    public static let limit = 3

    public static func shown(_ debts: OverviewView.Debts?) -> [OverviewView.NextDue] {
        Array((debts?.nextDue ?? []).prefix(limit))
    }
}

// MARK: - «Primi passi» (OV-033…037)

/// «Primi passi» steps (OV-033, web #444: debts and pension added).
public enum StartStepId: String, CaseIterable, Sendable {
    case conto, `import`, investimento, debito, pensione, obiettivo

    /// Steps asked when the user picked no focus (the original four).
    public static let defaults: [StartStepId] = [.conto, .import, .investimento, .obiettivo]

    /// OV-046: the account can be postponed but never skipped.
    public static let unskippable: Set<StartStepId> = [.conto]
}

/// One step: title, description, CTA, in-app path and the «done» text (toast and acknowledgement, OV-048 / SHELL-060).
public struct StartStepDefinition: Equatable, Sendable {
    public let id: StartStepId
    public let title: String
    public let description: String
    public let cta: String
    public let path: String
    public let done: String
}

/// «Cosa vuoi tenere sotto controllo?» (AUTH-058, OV-047): the answers and the step each one adds.
public enum StartFocus: String, CaseIterable, Sendable {
    case spese, investimenti, debiti, pensione

    public var title: String {
        switch self {
        case .spese: "Spese e conti"
        case .investimenti: "Investimenti"
        case .debiti: "Mutuo e prestiti"
        case .pensione: "Fondo pensione"
        }
    }

    public var description: String {
        switch self {
        case .spese: "Dove vanno i soldi ogni mese, per categoria."
        case .investimenti: "ETF, azioni, BTP e crypto, con rendimento e tasse."
        case .debiti: "Rate, interessi e quando finisci di pagare."
        case .pensione: "Quanto hai da parte e quanto rende."
        }
    }

    public var iconKey: String {
        switch self {
        case .spese: "wallet"
        case .investimenti: "trending-up"
        case .debiti: "credit-card"
        case .pensione: "umbrella"
        }
    }

    public var step: StartStepId {
        switch self {
        case .spese: .import
        case .investimenti: .investimento
        case .debiti: .debito
        case .pensione: .pensione
        }
    }

    /// The answers available in a product country: the pension one only where the pension section exists.
    public static func options(pensionAvailable: Bool) -> [StartFocus] {
        pensionAvailable ? allCases : allCases.filter { $0 != .pensione }
    }
}

public enum StartChecklist {
    /// OV-033 / OV-037 (`START_STEPS`, `obiettivo` replaced by the budget step where `retirement` is off).
    public static func steps(retirement: Bool) -> [StartStepDefinition] {
        [
            StartStepDefinition(id: .conto, title: "Aggiungi il tuo conto",
                                description: "Crealo a mano: bastano il nome e il saldo di oggi.",
                                cta: "Aggiungi un conto", path: "/liquidita/conti?nuovo=1", done: "Conto aggiunto"),
            StartStepDefinition(id: .import, title: "Importa i movimenti",
                                description: "Carica il CSV o l'estratto conto della tua banca.",
                                cta: "Importa un file", path: "/importazioni", done: "Movimenti aggiunti"),
            StartStepDefinition(id: .investimento, title: "Aggiungi un investimento",
                                description: "Registra un acquisto o importa il rendiconto del tuo broker.",
                                cta: "Vai agli investimenti", path: "/investimenti", done: "Primo investimento registrato"),
            StartStepDefinition(id: .debito, title: "Aggiungi il mutuo o un prestito",
                                description: "Importo, tasso e durata: calcoliamo il piano rate, quanto paghi di interessi e quando finisci.",
                                cta: "Aggiungi un finanziamento", path: "/debiti", done: "Finanziamento aggiunto"),
            StartStepDefinition(id: .pensione, title: "Aggiungi il fondo pensione",
                                description: "Bastano i contributi versati e il valore di oggi, dall'area clienti del fondo.",
                                cta: "Aggiungi il fondo", path: "/pensione", done: "Fondo pensione aggiunto"),
            retirement
                ? StartStepDefinition(id: .obiettivo, title: "Fissa il tuo traguardo",
                                      description: "Dicci quanto ti serve in un anno: calcoliamo il patrimonio che ti basta per vivere di rendita e quando ci arrivi.",
                                      cta: "Fissa il traguardo", path: "/analitiche?traguardo=1", done: "Traguardo fissato")
                : StartStepDefinition(id: .obiettivo, title: "Imposta un budget", description: "Imposta un budget per categoria.",
                                      cta: "Vai alle categorie", path: "/liquidita/categorie", done: "Budget impostato"),
        ]
    }

    public static func definition(_ id: StartStepId, retirement: Bool) -> StartStepDefinition {
        steps(retirement: retirement).first { $0.id == id }!
    }

    /// Steps asked for a focus (`startStepsFor`): account first, target last, the others by focus; never pension where hidden.
    public static func stepsFor(_ focus: [StartFocus]?, pensionAvailable: Bool) -> [StartStepId] {
        let wanted: Set<StartStepId> = {
            guard let focus, !focus.isEmpty else { return Set(StartStepId.defaults) }
            return Set([.conto] + focus.map(\.step) + [.obiettivo])
        }()
        return StartStepId.allCases.filter { wanted.contains($0) && (pensionAvailable || $0 != .pensione) }
    }

    public static func doneCount(_ status: StartStatus) -> Int {
        status.askedSteps.filter { status.steps.isDone($0) }.count
    }

    /// OV-034: «{n} su {m} fatti» — m = steps asked minus those skipped and not done.
    public static func statusLine(_ status: StartStatus) -> CatalogText {
        let asked = status.askedSteps.filter { !status.skippedSteps.contains($0) || status.steps.isDone($0) }.count
        return CatalogText("{0} su {1} fatti", ["0": String(doneCount(status)), "1": String(asked)])
    }

    /// OV-045: the first step neither done nor skipped; nil when all are settled.
    public static func nextStep(_ status: StartStatus) -> StartStepId? {
        status.askedSteps.first { !status.steps.isDone($0) && !status.skippedSteps.contains($0) }
    }

    /// OV-046: «Non mi serve» is offered for every step but the account.
    public static func canSkip(_ step: StartStepId) -> Bool { !StartStepId.unskippable.contains(step) }

    /// The state of a step in the list under the next step.
    public enum RowState: Equatable, Sendable { case done, skipped, todo }

    public static func rowState(_ status: StartStatus, _ step: StartStepId) -> RowState {
        if status.steps.isDone(step) { return .done }
        return status.skippedSteps.contains(step) ? .skipped : .todo
    }

    /// SHELL-060 / OV-048: steps asked that are done now and were not in `before`.
    public static func newlyDone(before: Set<StartStepId>, _ status: StartStatus) -> [StartStepId] {
        status.askedSteps.filter { status.steps.isDone($0) && !before.contains($0) }
    }

    /// OV-035: normal layout → not dismissed, not completed, no demo; empty layout (forced) → not completed, no demo.
    public static func isVisible(_ status: StartStatus, forced: Bool) -> Bool {
        if forced { return !status.completed && !status.demoActive }
        return !status.dismissed && !status.completed && !status.demoActive
    }

    /// OV-038: re-read every 15 s while a step is missing and the checklist is not dismissed.
    public static let pollSeconds: UInt64 = 15

    public static func shouldPoll(_ status: StartStatus?) -> Bool {
        guard let status else { return false }
        return !status.completed && !status.dismissed
    }
}

// MARK: - Goals tile (OV-030…032)

public enum GoalsTile {
    public static let limit = 3

    public enum Mode: Equatable, Sendable {
        case hidden
        /// OV-031: «Novità: obiettivi di risparmio».
        case invite
        /// OV-032: up to 3 open goals.
        case list([GoalView])
    }

    /// OV-030: requested only where `/analitiche/obiettivi` exists (`capabilities.sections.goals`, false for DE).
    public static func isAvailable(_ sections: MeBootstrap.Sections) -> Bool { sections.goals }

    /// OV-032: open goals by months-to-go ascending (no ETA last), then progress descending.
    public static func closest(_ goals: [GoalView], limit: Int = limit) -> [GoalView] {
        let open = goals.enumerated().filter { $0.element.status != "raggiunto" }
        let sorted = open.sorted { a, b in
            let ma = a.element.monthsToGo.map(Double.init) ?? .infinity, mb = b.element.monthsToGo.map(Double.init) ?? .infinity
            if ma != mb { return ma < mb }
            if a.element.progress != b.element.progress { return a.element.progress > b.element.progress }
            return a.offset < b.offset
        }
        return Array(sorted.prefix(limit).map(\.element))
    }

    /// OV-031: `checklistShown` hides the invite while «Primi passi» is on screen (web #444).
    public static func mode(_ view: GoalsView?, inviteDismissed: Bool, checklistShown: Bool = false) -> Mode {
        guard let view else { return .hidden }
        if view.goals.isEmpty { return inviteDismissed || checklistShown ? .hidden : .invite }
        let shown = closest(view.goals)
        return shown.isEmpty ? .hidden : .list(shown)
    }

    /// Status in a word (`statusLabel`), Italian source.
    public static func statusLabel(_ status: String) -> String? {
        switch status {
        case "raggiunto": "Raggiunto"
        case "in_linea": "In linea"
        case "in_ritardo": "In ritardo"
        default: nil
        }
    }

    /// `statusSentence`: parts translated and joined by the UI; the first part is capitalized after translation
    /// when `capitalizeFirst` is set. `money` / `month` are the formatted values.
    public static func statusSentence(_ goal: GoalView, money: (Double) -> String, month: (String) -> String)
        -> (parts: [CatalogText], capitalizeFirst: Bool) {
        switch goal.status {
        case "raggiunto":
            return ([goal.achievedAt != nil
                ? CatalogText("Segnato come raggiunto: non prende più niente dal risparmio del mese.")
                : CatalogText("I soldi ci sono tutti: puoi segnarlo come raggiunto.")], false)
        case "fermo":
            return ([goal.monthly <= 0
                ? CatalogText("Nessuna quota al mese: scegline una per sapere quando ci arrivi.")
                : CatalogText("Questo mese il risparmio non arriva fin qui: gli obiettivi più in alto prendono tutto.")], false)
        default:
            var parts = [CatalogText("al ritmo di {0} al mese ci arrivi a {1}", ["0": money(goal.funded), "1": month(goal.etaMonth ?? "")])]
            if goal.funded + 0.5 < goal.monthly {
                parts.append(CatalogText(" (ricevi {0} dei {1} che hai scelto)", ["0": money(goal.funded), "1": money(goal.monthly)]))
            }
            if goal.status == "in_ritardo", let targetDate = goal.targetDate {
                parts.append(CatalogText(", dopo {0}: servirebbero {1} al mese.", ["0": month(targetDate), "1": money(goal.required ?? 0)]))
            } else {
                parts.append(CatalogText("."))
            }
            return (parts, true)
        }
    }

    /// Icon key and swatch token of a goal kind (`GOAL_KIND_INFO`).
    public static func iconKey(_ kind: String) -> String {
        switch kind {
        case "emergenza": "shield-check"
        case "viaggio": "plane"
        case "casa": "house"
        case "acquisto": "shopping-bag"
        default: "sparkles"
        }
    }

    public static func colorToken(_ kind: String) -> String {
        switch kind {
        case "emergenza": "swatch-teal"
        case "viaggio": "swatch-amber"
        case "casa": "swatch-violet"
        case "acquisto": "swatch-blue"
        default: "swatch-pink"
        }
    }

    /// Progress bar color: amber when late, `--pos` when reached, `--primary` otherwise.
    public static func progressToken(_ status: String) -> String {
        switch status {
        case "in_ritardo": "swatch-amber"
        case "raggiunto": "pos"
        default: "primary"
        }
    }
}

// MARK: - «Novità» (SHELL-049, SHELL-050)

public enum WhatsNewDismissals {
    /// Device key (`bb:whats-new-dismissed`), ids joined by commas as on the web.
    public static let key = "bb:whats-new-dismissed"

    public static func parse(_ raw: String?) -> [String] {
        (raw ?? "").split(separator: ",").map(String.init).filter { !$0.isEmpty }
    }

    public static func adding(_ id: String, to raw: String?) -> String {
        var ids = parse(raw)
        if !ids.contains(id) { ids.append(id) }
        return ids.joined(separator: ",")
    }

    /// SHELL-049: at most one entry — the server's `current`, or the newest fresh entry not dismissed here.
    public static func pick(_ whatsNew: WhatsNew?, dismissed: [String]) -> WhatsNewEntry? {
        guard let whatsNew else { return nil }
        if let current = whatsNew.current, !dismissed.contains(current.id) { return current }
        return whatsNew.entries.first { !dismissed.contains($0.id) }
    }
}

/// Per-device keys of the Overview (decision 0003: same keys and defaults as the web's localStorage).
public enum OverviewPreferenceKeys {
    /// OV-018: default on, shared with «Il tuo quadro» › Oggi.
    public static let includePension = "bb:net-worth-include-pension"
    /// OV-031: default off.
    public static let goalsInviteDismissed = "bb-goals-invite-dismissed"
}
