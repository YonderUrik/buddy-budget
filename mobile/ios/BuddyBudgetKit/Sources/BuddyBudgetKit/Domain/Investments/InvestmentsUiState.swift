import Foundation

/// What a view-gated tab shows (INV-010). Same cases as `InvestmentsGate` on Android.
public enum InvestmentsGate: Equatable, Sendable {
    case loading
    case failed
    /// No operation for the selected brokers: `Mostra tutti i broker`.
    case emptyFiltered
    /// «Registra il tuo primo investimento».
    case empty
    case content

    /// Portafoglio counts as non-empty with broker cash even without operations (`countsCash`).
    public static func of(loaded: Bool, failed: Bool, hasTransactions: Bool, hasCash: Bool, countsCash: Bool,
                          brokersFiltered: Bool) -> InvestmentsGate {
        if !loaded { return failed ? .failed : .loading }
        if hasTransactions || (countsCash && hasCash) { return .content }
        return brokersFiltered ? .emptyFiltered : .empty
    }
}

/// Everything the Investimenti frame and its tabs render, derived from the last responses (UI only renders it).
/// Same fields as `InvestmentsUiState` on Android.
public struct InvestmentsUiState: Equatable, Sendable {
    public enum Phase: Equatable, Sendable { case loading, failed, loaded }

    public var tab: InvestmentsTab
    public var visibleTabs: [InvestmentsTab]
    /// Portafoglio period and its custom range (INV-016/017).
    public var period: InvestmentsPeriod
    public var customRange: ChartRange
    /// Performance has its own period (INV-036 resets inspection when it changes).
    public var performancePeriod: InvestmentsPeriod
    public var performanceCustomRange: ChartRange
    /// INV-009: broker groups removed from the numbers (view-only, reset when leaving the section).
    public var excludedBrokers: Set<String>
    /// INV-018: «Rimetti i costi / le imposte nel portafoglio» (off = recorded values).
    public var reinvestFees: Bool
    public var reinvestTaxes: Bool
    public var today: String

    public init(tab: InvestmentsTab = .portfolio, visibleTabs: [InvestmentsTab] = InvestmentsTab.allCases,
                period: InvestmentsPeriod = .default, customRange: ChartRange? = nil,
                performancePeriod: InvestmentsPeriod = .default, performanceCustomRange: ChartRange? = nil,
                excludedBrokers: Set<String> = [], reinvestFees: Bool = false, reinvestTaxes: Bool = false, today: String) {
        self.tab = tab
        self.visibleTabs = visibleTabs
        self.period = period
        self.customRange = customRange ?? InvestmentsRules.defaultCustomRange(today: today)
        self.performancePeriod = performancePeriod
        self.performanceCustomRange = performanceCustomRange ?? InvestmentsRules.defaultCustomRange(today: today)
        self.excludedBrokers = excludedBrokers
        self.reinvestFees = reinvestFees
        self.reinvestTaxes = reinvestTaxes
        self.today = today
    }

    /// Portafoglio query (INV-005).
    public var portfolioQuery: InvestmentsQuery {
        InvestmentsQuery.make(period: period, custom: customRange, today: today, excludedBrokers: excludedBrokers)
    }

    /// Diversificazione / Operazioni reuse the default 3-month view (INV-005).
    public var baseQuery: InvestmentsQuery {
        InvestmentsQuery.make(period: .default, custom: customRange, today: today, excludedBrokers: excludedBrokers)
    }

    /// Dividendi / Tasse use the default period too (the server computes on the whole history where needed).
    public func performanceQuery(selection: ChartRange?) -> InvestmentsQuery {
        InvestmentsQuery.make(period: performancePeriod, custom: performanceCustomRange, today: today,
                              excludedBrokers: excludedBrokers, selection: selection)
    }

    public var simulating: Bool { reinvestFees || reinvestTaxes }
    public var simulationCount: Int { (reinvestFees ? 1 : 0) + (reinvestTaxes ? 1 : 0) }

    /// Broker chip text (Italian source + values): «Tutti i broker» or «Broker: {0} di {1}».
    public func brokerChip(_ brokers: [InvestmentsView.Broker]) -> (source: String, values: [String: String]) {
        let enabled = brokers.filter { !excludedBrokers.contains($0.id) }.count
        if enabled < brokers.count { return ("Broker: {0} di {1}", ["0": String(enabled), "1": String(brokers.count)]) }
        return ("Tutti i broker", [:])
    }
}

/// Hero of Portafoglio with the cost simulation applied (INV-011, INV-018).
public struct PortfolioHero: Equatable, Sendable {
    public let value: Double
    public let simulating: Bool
    public let extra: Double
    /// Area values (simulated when active).
    public let values: [Double]
    /// Recorded values, only while simulating.
    public let registered: [Double]?
    public let invested: [Double]
    public let showsDayChange: Bool

    public static func of(_ view: InvestmentsView, reinvestFees: Bool, reinvestTaxes: Bool) -> PortfolioHero {
        let recorded = view.series.map(\.value)
        let active = (reinvestFees || reinvestTaxes) && view.costImpact.available
        let scenario = active ? InvestmentsRules.costScenario(view.costScenarios, reinvestFees: reinvestFees, reinvestTaxes: reinvestTaxes) : nil
        let simulating = scenario != nil
        let values = scenario.map { $0.series.count == recorded.count ? $0.series : recorded } ?? recorded
        return PortfolioHero(value: scenario?.value ?? view.summary.totalValue, simulating: simulating,
                             extra: scenario?.extra ?? 0, values: values, registered: simulating ? recorded : nil,
                             invested: view.series.map(\.invested),
                             showsDayChange: !simulating && view.summary.dayChange != nil && view.summary.dayChangePct != nil)
    }
}

/// Risk card numbers of Performance (INV-041/042).
public enum RiskCopy {
    /// INV-041: fewer than 20 trading days.
    public static let minObservations = 20
    /// Sharpe needs 60 observations (INV-042).
    public static let sharpeObservations = 60

    public static func sharpeWord(_ level: String?) -> String? {
        switch level {
        case "negativo": "No"
        case "basso": "Poco"
        case "discreto": "Discreto"
        case "buono": "Bene"
        default: nil
        }
    }
}
