import Foundation

// Investimenti (spec: api/endpoints/investments-views.md, investments.md, features/07-investments.md). The server runs
// the web's engines; the app only renders the views and sends mutations. Same names on Android
// (`InvestmentsApi` and the models in `core/data/InvestmentsApi.kt`).

// MARK: - Shared rows

public enum InstrumentType: String, Sendable, CaseIterable {
    case etf, azione, obbligazione, fondo, crypto, etc
}

/// Raw `instruments` row (numeric columns as strings). Unknown enum values decode to safe defaults.
public struct Instrument: Decodable, Equatable, Hashable, Sendable, Identifiable {
    public let id: String
    public let isin: String?
    public let name: String
    /// Raw type (`etf`, `azione`, …); see `kind`.
    public let type: String
    public let currency: String
    public let priceMode: String
    public let priceUnit: String
    public let exchange: String?
    public let taxRate: String?
    public let taxHarmonized: Bool?
    public let createdByUserId: String?

    public init(id: String, isin: String? = nil, name: String, type: String = "etf", currency: String = "EUR",
                priceMode: String = "auto", priceUnit: String = "unita", exchange: String? = nil, taxRate: String? = nil,
                taxHarmonized: Bool? = nil, createdByUserId: String? = nil) {
        self.id = id
        self.isin = isin
        self.name = name
        self.type = type
        self.currency = currency
        self.priceMode = priceMode
        self.priceUnit = priceUnit
        self.exchange = exchange
        self.taxRate = taxRate
        self.taxHarmonized = taxHarmonized
        self.createdByUserId = createdByUserId
    }

    public var kind: InstrumentType { InstrumentType(rawValue: type) ?? .etf }
    /// Bonds quoted in % of nominal: value = quantity × price / 100 (INV-065).
    public var isPercentOfNominal: Bool { priceUnit == "percentuale_nominale" }
    public var hasAutomaticPrices: Bool { priceMode == "auto" }
}

public struct LastPrice: Decodable, Equatable, Sendable {
    public let date: String
    public let close: Double
    public let origin: String
}

/// One open position (`PositionRow`), sorted by value desc by the server.
public struct PositionRow: Decodable, Equatable, Sendable, Identifiable {
    public let instrument: Instrument
    public let quantity: Double
    public let averagePrice: Double?
    public let costBasis: Double?
    public let lastPrice: LastPrice?
    public let value: Double?
    public let unrealizedGain: Double?
    public let unrealizedGainPct: Double?
    public let weight: Double?

    public var id: String { instrument.id }
}

public struct PortfolioSummary: Decodable, Equatable, Sendable {
    public let totalValue: Double
    public let dayChange: Double?
    public let dayChangePct: Double?
    public let unrealizedGain: Double?
    public let realizedGain: Double?
    public let income: Double?
    public let totalGain: Double?
    public let totalGainPct: Double?
    public let investedNet: Double?
    public let costBasis: Double?
    public let unpricedCount: Int
    public let rows: [PositionRow]
}

// MARK: - GET /api/investments/view

public struct InvestmentsView: Decodable, Equatable, Sendable {
    public struct DateRange: Decodable, Equatable, Sendable {
        public let from: String
        public let to: String
        public init(from: String, to: String) {
            self.from = from
            self.to = to
        }
    }

    public struct Broker: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let label: String
        public let operations: Int
        public let excluded: Bool
    }

    public struct BrokerCash: Decodable, Equatable, Sendable {
        public let accountId: String
        public let provider: String
        public let name: String
        public let balance: Double
        public let statementDate: String?
    }

    public struct SeriesPoint: Decodable, Equatable, Sendable {
        public let date: String
        public let label: String
        public let value: Double
        public let invested: Double
    }

    public struct Slice: Decodable, Equatable, Sendable {
        public let key: String
        public let value: Double
        public let share: Double
    }

    public struct Breakdown: Decodable, Equatable, Sendable {
        public let paid: Double
        public let market: Double
        public let value: Double
        public let marketShare: Double?
        public let cashedIn: Double
    }

    public struct PriceNote: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let price: String?
        public let detail: String
        public let stale: Bool
        public let hint: String?
    }

    public struct PeriodGain: Decodable, Equatable, Sendable {
        public let fromKey: String
        public let toKey: String
        public let startValue: Double
        public let endValue: Double
        public let netContributions: Double
        public let income: Double
        public let gain: Double
        public let twr: Double?
    }

    public struct CostImpact: Decodable, Equatable, Sendable {
        public let fees: Double
        public let taxes: Double
        public let estimatedTaxes: Double
        public let available: Bool
    }

    /// One of the four «Rimetti costi / imposte» combinations (INV-018).
    public struct CostScenario: Decodable, Equatable, Sendable {
        public let includeFees: Bool
        public let includeTaxes: Bool
        public let active: Bool
        public let value: Double
        public let extra: Double
        public let series: [Double]
    }

    public struct ReinvestmentEffects: Decodable, Equatable, Sendable {
        public let fees: Double
        public let taxes: Double
    }

    public struct IncomeHistory: Decodable, Equatable, Sendable {
        public struct Payment: Decodable, Equatable, Sendable, Identifiable {
            public let id: String
            public let instrumentId: String
            public let date: String
            public let kind: String
            public let gross: Double
            public let taxes: Double
            public let fees: Double
            public let net: Double
        }

        public let total: Double
        public let trailing: Double
        public let count: Int
        public let yieldOnCost: Double?
        public let payments: [Payment]
    }

    public struct ExposureBreakdown: Decodable, Equatable, Sendable {
        public let slices: [Slice]
        public let classifiedShare: Double
    }

    public struct ExposureRow: Decodable, Equatable, Sendable {
        public struct Exposure: Decodable, Equatable, Sendable {
            public let sectors: [String: Double]?
            public let sectorSource: String?
            public let areas: [String: Double]?
            public let areaSource: String?
        }

        public struct Manual: Decodable, Equatable, Sendable {
            public let sectors: [String: Double]?
            public let areas: [String: Double]?
        }

        public let instrument: Instrument
        public let value: Double
        public let share: Double
        public let exposure: Exposure?
        public let manual: Manual?
    }

    public struct FundOverlap: Decodable, Equatable, Sendable {
        public let aId: String
        public let bId: String
        public let share: Double
        public let method: String
    }

    public struct StockInsideFunds: Decodable, Equatable, Sendable {
        public struct Fund: Decodable, Equatable, Sendable {
            public let fundId: String
            public let weightInFund: Double
            public let viaFundValue: Double
        }

        public let stockId: String
        public let directValue: Double
        public let funds: [Fund]
        public let totalValue: Double
    }

    public struct CorrelationPair: Decodable, Equatable, Sendable {
        public let aId: String
        public let bId: String
        public let value: Double
    }

    public struct CorrelationFamilies: Decodable, Equatable, Sendable {
        public let families: [[String]]
        public let independent: [String]
    }

    public struct Target: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let weight: Double

        public init(instrumentId: String, weight: Double) {
            self.instrumentId = instrumentId
            self.weight = weight
        }
    }

    public struct AllocationRowView: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let value: Double
        public let currentWeight: Double
        public let targetWeight: Double
        public let drift: Double
        public let status: String
        public let inTarget: Bool
    }

    public struct Allocation: Decodable, Equatable, Sendable {
        public let rows: [AllocationRowView]
        public let total: Double
        public let unpricedIds: [String]
        public let maxDrift: Double
    }

    public struct Analysis: Decodable, Equatable, Sendable {
        public let sectors: ExposureBreakdown
        public let areas: ExposureBreakdown
        public let exposureRows: [ExposureRow]
        public let overlaps: [FundOverlap]
        public let stocksInFunds: [StockInsideFunds]
        public let targets: [Target]
        public let allocation: Allocation?
        public let sectorInsight: String?
        public let areaInsight: String?
        public let correlationPairs: [CorrelationPair]
        public let correlationFamilies: CorrelationFamilies?
        public let currentWeights: [Target]
        /// Present when there are ≥ 2 priced positions (needed to tell «20 days» apart from «no pairs»).
        public let correlations: Correlations?
    }

    public struct Correlations: Decodable, Equatable, Sendable {
        public let instrumentIds: [String]
    }

    public let currency: String
    public let today: String
    public let period: String
    public let calculationPeriod: String
    public let range: DateRange?
    public let brokers: [Broker]
    public let brokerCash: [BrokerCash]
    public let cashTotal: Double
    public let hasTransactions: Bool
    public let summary: PortfolioSummary
    public let series: [SeriesPoint]
    public let byType: [Slice]
    public let byCurrency: [Slice]
    public let instruments: [Instrument]
    /// «I tuoi strumenti»: instruments held today, most recently traded first (INV-111, web #445).
    @DefaultEmptyStrings public var heldInstrumentIds: [String]
    public let breakdown: Breakdown
    public let concentrationText: String?
    public let priceNotes: [PriceNote]
    public let currencyExposure: Double
    public let periodGain: PeriodGain?
    public let costImpact: CostImpact
    public let costScenarios: [CostScenario]
    public let reinvestmentEffects: ReinvestmentEffects
    public let income: IncomeHistory
    public let analysis: Analysis
    public let operationMonths: [OperationMonth]
    public let operationYears: [Int]
    public let operationTotals: OperationTotals
    public let benchmark: Instrument?
    public let benchmarkFirstPriceDate: String?

    public func instrument(_ id: String) -> Instrument? { instruments.first { $0.id == id } }
    public func priceNote(_ id: String) -> PriceNote? { priceNotes.first { $0.instrumentId == id } }
}

// MARK: Operations (Operazioni)

/// Raw `investment_transactions` row (numerics as strings).
public struct InvestmentTransaction: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let instrumentId: String
    public let statementAccountKey: String?
    public let type: String
    public let date: String
    public let quantity: String
    public let price: String
    public let fxRate: String
    public let fees: String
    public let taxes: String
    public let grossAmount: String?
    public let note: String?

    public init(id: String, instrumentId: String, statementAccountKey: String? = nil, type: String, date: String,
                quantity: String = "0", price: String = "0", fxRate: String = "1", fees: String = "0", taxes: String = "0",
                grossAmount: String? = nil, note: String? = nil) {
        self.id = id
        self.instrumentId = instrumentId
        self.statementAccountKey = statementAccountKey
        self.type = type
        self.date = date
        self.quantity = quantity
        self.price = price
        self.fxRate = fxRate
        self.fees = fees
        self.taxes = taxes
        self.grossAmount = grossAmount
        self.note = note
    }

    public var quantityValue: Double { Double(quantity) ?? 0 }
    public var priceValue: Double { Double(price) ?? 0 }
    public var fxRateValue: Double { Double(fxRate) ?? 1 }
    public var feesValue: Double { Double(fees) ?? 0 }
    public var taxesValue: Double { Double(taxes) ?? 0 }
    public var grossValue: Double? { grossAmount.flatMap(Double.init) }
    /// INV-060/061: imported from a reconciled broker statement (read-only).
    public var isReconciled: Bool { statementAccountKey != nil }
}

public struct OperationResult: Decodable, Equatable, Sendable, Identifiable {
    public let transaction: InvestmentTransaction
    public let paid: Double
    public let received: Double
    public let remainingQuantity: Double?
    public let currentValue: Double?
    public let gain: Double?
    public let gainPct: Double?
    /// Cost the gain is measured against (sums of `gain / gainBase` give the totals' %).
    public let gainBase: Double?

    public init(transaction: InvestmentTransaction, paid: Double = 0, received: Double = 0, remainingQuantity: Double? = nil,
                currentValue: Double? = nil, gain: Double? = nil, gainPct: Double? = nil, gainBase: Double? = nil) {
        self.transaction = transaction
        self.paid = paid
        self.received = received
        self.remainingQuantity = remainingQuantity
        self.currentValue = currentValue
        self.gain = gain
        self.gainPct = gainPct
        self.gainBase = gainBase
    }

    public var id: String { transaction.id }
}

public struct OperationTotals: Decodable, Equatable, Sendable {
    public let count: Int
    public let bought: Double
    public let sold: Double
    public let income: Double
    public let gain: Double
    public let gainPct: Double?
    public let unpricedCount: Int

    public init(count: Int, bought: Double, sold: Double, income: Double, gain: Double, gainPct: Double?, unpricedCount: Int) {
        self.count = count
        self.bought = bought
        self.sold = sold
        self.income = income
        self.gain = gain
        self.gainPct = gainPct
        self.unpricedCount = unpricedCount
    }
}

public struct OperationMonth: Decodable, Equatable, Sendable, Identifiable {
    public let key: String
    public let year: Int
    public let label: String
    public let operations: [OperationResult]
    public let totals: OperationTotals

    public init(key: String, year: Int, label: String, operations: [OperationResult], totals: OperationTotals) {
        self.key = key
        self.year = year
        self.label = label
        self.operations = operations
        self.totals = totals
    }

    public var id: String { key }
}

// MARK: - GET /api/investments/performance

public struct ReturnValues: Decodable, Equatable, Sendable {
    public struct Real: Decodable, Equatable, Sendable {
        public let value: Double?
        public let inflation: Double?
        public let throughMonth: String?
    }

    public struct BenchmarkValues: Decodable, Equatable, Sendable {
        public let twr: Double?
        public let twrAnnual: Double?
        public let simulatedValue: Double?
        public let portfolioValue: Double?
        public let moneyWeighted: Double?
        public let depleted: Bool?
    }

    public let fromKey: String
    public let baseKey: String?
    public let toKey: String
    public let days: Int
    public let showAnnual: Bool
    public let twr: Double?
    public let twrAnnual: Double?
    public let moneyWeighted: Double?
    public let moneyWeightedAnnual: Double?
    public let real: Real?
    public let benchmarkStatus: String
    public let benchmark: BenchmarkValues?
    public let timingInsight: String?
}

public struct InspectPoint: Decodable, Equatable, Sendable {
    public let index: Int
    public let date: String
    public let values: ReturnValues

    enum Keys: String, CodingKey { case index, date }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        index = try c.decode(Int.self, forKey: .index)
        date = try c.decode(String.self, forKey: .date)
        values = try ReturnValues(from: decoder)
    }

    public init(index: Int, date: String, values: ReturnValues) {
        self.index = index
        self.date = date
        self.values = values
    }
}

public struct HeatmapCell: Decodable, Equatable, Sendable {
    public let key: String
    public let label: String
    public let ret: Double?
    public let gain: Double?
    public let level: Int
}

public struct ReturnHeatmap: Decodable, Equatable, Sendable {
    public struct Row: Decodable, Equatable, Sendable {
        public let label: String
        public let cells: [HeatmapCell?]
        public let total: HeatmapCell?
    }

    public let grouping: String
    public let columns: [String]
    public let rows: [Row]
    public let scale: Double
    public let positive: Int
    public let negative: Int
    public let counted: Int
}

public struct InvestmentsPerformance: Decodable, Equatable, Sendable {
    public struct ReturnsSeries: Decodable, Equatable, Sendable {
        public struct Point: Decodable, Equatable, Sendable {
            public let date: String
            public let label: String
            public let portfolio: Double
            public let benchmark: Double?
        }

        public let values: ReturnValues
        public let series: [Point]

        enum Keys: String, CodingKey { case series }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            series = try c.decodeIfPresent([Point].self, forKey: .series) ?? []
            values = try ReturnValues(from: decoder)
        }
    }

    public struct Drawdown: Decodable, Equatable, Sendable {
        public let depth: Double
        public let peakDate: String?
        public let troughDate: String?
        public let recoveryDate: String?
        public let current: Double?
    }

    public struct DrawdownPoint: Decodable, Equatable, Sendable {
        public let date: String
        public let drawdown: Double
        public let label: String
    }

    public struct BenchmarkRisk: Decodable, Equatable, Sendable {
        public let volatility: Double?
        public let beta: Double?
        public let correlation: Double?
    }

    public struct Risk: Decodable, Equatable, Sendable {
        public let observations: Int
        public let fewData: Bool
        public let volatility: Double?
        public let drawdown: Drawdown?
        public let drawdownSeries: [DrawdownPoint]
        public let sharpe: Double?
        public let riskFreeRate: Double?
        public let benchmark: BenchmarkRisk?
        public let level: Int?
        public let levelLabel: String?
        public let scalePosition: Double?
        public let levelInsight: String?
        public let volatilityInsight: String?
        public let sharpeLevel: String?
        public let sharpeInsight: String?
        public let betaInsight: String?
        public let recoveryDays: Int?
    }

    public struct Heatmaps: Decodable, Equatable, Sendable {
        public let giorno: ReturnHeatmap?
        public let settimana: ReturnHeatmap?
        public let mese: ReturnHeatmap?
        public let anno: ReturnHeatmap?
    }

    public let currency: String
    public let today: String
    public let period: String
    public let range: InvestmentsView.DateRange?
    public let selection: InvestmentsView.DateRange?
    public let hasTransactions: Bool
    public let benchmark: Instrument?
    public let benchmarkFirstPriceDate: String?
    public let returns: ReturnsSeries?
    public let benchmarkVerdict: String?
    public let inspect: [InspectPoint]
    public let risk: Risk?
    public let heatmaps: Heatmaps
}

// MARK: - GET /api/investments/income (IT)

public struct InvestmentsIncome: Decodable, Equatable, Sendable {
    public struct Missing: Decodable, Equatable, Sendable, Identifiable {
        public let instrumentId: String
        public let kind: String
        public let date: String
        public let quantity: Double
        public let gross: Double
        public let fxRate: Double?
        public let estimatedTax: Double?

        public var id: String { "\(instrumentId):\(date)" }
    }

    public struct ForecastMonth: Decodable, Equatable, Sendable {
        public let key: String
        public let gross: Double
        public let net: Double
    }

    public struct ForecastEvent: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let kind: String
        public let date: String
        public let gross: Double
        public let net: Double
        public let basis: String
    }

    public struct Forecast: Decodable, Equatable, Sendable {
        public let months: [ForecastMonth]
        public let events: [ForecastEvent]
        public let totalGross: Double
        public let totalNet: Double
        public let bondsWithoutTerms: [String]
    }

    public struct MonthDetail: Decodable, Equatable, Sendable {
        public let month: Int
        public let gross: Double
        public let withheld: Double
        public let net: Double
    }

    public struct YearDetail: Decodable, Equatable, Sendable {
        public let year: Int
        public let months: [MonthDetail]
        public let gross: Double
        public let withheld: Double
        public let net: Double
    }

    public struct Growth: Decodable, Equatable, Sendable {
        public let rate: Double
        public let years: Int
    }

    public struct InstrumentRow: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let trailingNet: Double
        public let yieldOnCost: Double?
        public let forecastGross: Double
        public let currentYield: Double?
        public let growth: Growth?
        public let hasCouponTerms: Bool
    }

    public struct TaxSetting: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let taxRate: Double?
        public let taxRateSource: String?
        public let harmonized: Bool?
        public let harmonizedSource: String?
    }

    public let currency: String
    public let todayKey: String
    public let hasTransactions: Bool
    public let history: InvestmentsView.IncomeHistory
    public let missing: [Missing]
    public let forecast: Forecast
    public let byMonth: [YearDetail]
    public let byInstrument: [InstrumentRow]
    public let rows: [PositionRow]
    public let instruments: [Instrument]
    public let taxSettings: [TaxSetting]
    public let pendingDividendHistory: Int

    public func instrument(_ id: String) -> Instrument? { instruments.first { $0.id == id } }
}

// MARK: - GET /api/investments/taxes (IT)

public struct InvestmentsTaxes: Decodable, Equatable, Sendable {
    public struct TaxYear: Decodable, Equatable, Sendable {
        public let year: Int
        public let gains: Double
        public let losses: Double
        public let fundGains: Double
        public let cryptoGains: Double
        public let cryptoLosses: Double
        public let lossesUsed: Double
        public let lossesCreated: Double
        public let lossesExpired: Double
        public let cryptoLossesUsed: Double
        public let taxOnGains: Double
        public let taxOnFunds: Double
        public let taxOnCrypto: Double
        public let estimatedTax: Double
        public let withheld: Double
        public let incomeGross: Double
        public let incomeWithheld: Double
        public let bollo: Double
        public let nonHarmonizedCount: Int
    }

    public struct LossEntry: Decodable, Equatable, Sendable {
        public let year: Int
        public let expiresYear: Int
        public let amount: Double
        public let remaining: Double
        public let origin: String
        public let crypto: Bool
    }

    public struct Report: Decodable, Equatable, Sendable {
        public let regime: String
        public let years: [TaxYear]
        public let losses: [LossEntry]
    }

    public struct OpportunityRow: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let unrealized: Double
        public let equivalent: Double
    }

    public struct Opportunities: Decodable, Equatable, Sendable {
        public let expiringThisYear: Double
        public let compensableGains: [OpportunityRow]
        public let compensableTotal: Double
        public let losses: [OpportunityRow]
        public let lossesTotal: Double
    }

    public struct Sellable: Decodable, Equatable, Sendable {
        public let instrument: Instrument
        public let quantity: Double
        public let price: Double?
        public let fxRate: Double?
    }

    public struct Carryforward: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let year: Int
        public let amount: String
        public let note: String?

        public var amountValue: Double { Double(amount) ?? 0 }
    }

    public struct Setting: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let taxRate: String?
        public let taxHarmonized: Bool?
        public let couponRate: String?
        public let couponFrequency: Int?
        public let maturityDate: String?
    }

    public struct Resolved: Decodable, Equatable, Sendable {
        public let instrumentId: String
        public let taxRate: Double
        public let taxRateSource: String?
        public let harmonized: Bool?
        public let harmonizedSource: String?
    }

    public let currency: String
    public let todayKey: String
    public let currentYear: Int
    public let regime: String
    public let report: Report
    public let opportunities: Opportunities
    public let instruments: [Instrument]
    public let rateListInstrumentIds: [String]
    public let settings: [Setting]
    public let resolved: [Resolved]
    public let sellable: [Sellable]
    public let carryforwards: [Carryforward]
    public let hasTransactions: Bool

    public func instrument(_ id: String) -> Instrument? { instruments.first { $0.id == id } }
    public func setting(_ id: String) -> Setting? { settings.first { $0.instrumentId == id } }
    public func resolved(_ id: String) -> Resolved? { resolved.first { $0.instrumentId == id } }
}

/// `POST /api/investments/taxes/simulate-sale`.
public struct SaleSimulation: Decodable, Equatable, Sendable {
    public let instrumentId: String
    public let regime: String
    public let quantity: Double
    public let heldQuantity: Double
    public let price: Double
    public let fxRate: Double
    public let proceeds: Double
    public let cost: Double
    public let gain: Double
    public let category: String
    public let taxDelta: Double
    public let lossesUsed: Double
    public let lossesCreated: Double
    public let net: Double
    public let nonHarmonized: Bool
    public let taxLineLabel: String
    public let note: String
}

// MARK: - GET /api/investments/titles

public struct TitleItem: Decodable, Equatable, Sendable, Identifiable {
    public let instrument: Instrument
    public let held: Bool
    public let watching: Bool
    public let lastClose: Double?
    public let lastDate: String?
    public let dayChange: Double?
    public let monthChange: Double?
    public let spark: [Double]
    public let activeAlerts: Int
    public let triggeredAlerts: Int

    public var id: String { instrument.id }
}

struct TitlesResponse: Decodable {
    let items: [TitleItem]
}

// MARK: - Writes

/// Body of `POST /api/investments/transactions` / `PATCH …/{id}` (amounts as typed; nil = omitted).
public struct OperationInput: Equatable, Sendable {
    public var instrumentId: String
    public var type: String
    public var date: String
    public var quantity: Double?
    public var price: Double?
    public var grossAmount: Double?
    public var fxRate: Double?
    public var fees: Double
    public var taxes: Double
    public var note: String?

    public init(instrumentId: String, type: String, date: String, quantity: Double? = nil, price: Double? = nil,
                grossAmount: Double? = nil, fxRate: Double? = nil, fees: Double = 0, taxes: Double = 0, note: String? = nil) {
        self.instrumentId = instrumentId
        self.type = type
        self.date = date
        self.quantity = quantity
        self.price = price
        self.grossAmount = grossAmount
        self.fxRate = fxRate
        self.fees = fees
        self.taxes = taxes
        self.note = note
    }

    /// JSON body; `forUpdate` drops `instrumentId` (PATCH cannot change it).
    public func json(forUpdate: Bool = false) -> [String: Any] {
        var out: [String: Any] = ["type": type, "date": date, "fees": jsonDecimal(fees), "taxes": jsonDecimal(taxes)]
        if !forUpdate { out["instrumentId"] = instrumentId }
        if let quantity { out["quantity"] = jsonDecimal(quantity) }
        if let price { out["price"] = jsonDecimal(price) }
        if let grossAmount { out["grossAmount"] = jsonDecimal(grossAmount) }
        if let fxRate { out["fxRate"] = jsonDecimal(fxRate) }
        out["note"] = note.map { $0 as Any } ?? NSNull()
        return out
    }
}

/// A Double written with its shortest representation (JSONSerialization would print 39.899999999999999).
func jsonDecimal(_ value: Double) -> Any { Decimal(string: String(value)).map { NSDecimalNumber(decimal: $0) } ?? value }

// MARK: - API

public struct InvestmentsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/investments/view` (Portafoglio, Diversificazione, Operazioni).
    public func view(_ query: InvestmentsQuery) async throws -> InvestmentsView {
        try await client.get("api/investments/view", query: query.parameters)
    }

    /// `GET /api/investments/performance`.
    public func performance(_ query: InvestmentsQuery) async throws -> InvestmentsPerformance {
        try await client.get("api/investments/performance", query: query.parameters)
    }

    /// `GET /api/investments/income` (IT only, INV-091).
    public func income(_ query: InvestmentsQuery) async throws -> InvestmentsIncome {
        try await client.get("api/investments/income", query: query.parameters)
    }

    /// `GET /api/investments/taxes` (IT only, INV-091).
    public func taxes(_ query: InvestmentsQuery) async throws -> InvestmentsTaxes {
        try await client.get("api/investments/taxes", query: query.parameters)
    }

    /// `POST /api/investments/taxes/simulate-sale` (IT only; quantity clamped by the server).
    public func simulateSale(instrumentId: String, quantity: Double, query: InvestmentsQuery) async throws -> SaleSimulation {
        let body = try Self.body(["instrumentId": instrumentId, "quantity": jsonDecimal(quantity)])
        var params = query.parameters
        params.removeValue(forKey: "period")
        let response = try await client.send("api/investments/taxes/simulate-sale", method: "POST", query: params, body: body)
        return try Self.decode(response.data)
    }

    /// `GET /api/investments/titles` (watched ∪ held).
    public func titles() async throws -> [TitleItem] {
        let response: TitlesResponse = try await client.get("api/investments/titles")
        return response.items
    }

    public func createOperation(_ input: OperationInput) async throws {
        _ = try await client.send("api/investments/transactions", method: "POST", body: try Self.body(input.json()))
    }

    public func updateOperation(id: String, _ input: OperationInput) async throws {
        _ = try await client.send("api/investments/transactions/\(Self.escape(id))", method: "PATCH",
                                  body: try Self.body(input.json(forUpdate: true)))
    }

    public func deleteOperation(id: String) async throws {
        _ = try await client.send("api/investments/transactions/\(Self.escape(id))", method: "DELETE")
    }

    /// `PATCH /api/investments/portfolio` with the benchmark (nil removes it).
    public func setBenchmark(_ instrumentId: String?) async throws {
        _ = try await client.send("api/investments/portfolio", method: "PATCH",
                                  body: try Self.body(["benchmarkInstrumentId": instrumentId.map { $0 as Any } ?? NSNull()]))
    }

    /// `PATCH /api/investments/portfolio {taxRegime}` (IT only).
    public func setTaxRegime(_ regime: String) async throws {
        _ = try await client.send("api/investments/portfolio", method: "PATCH", body: try Self.body(["taxRegime": regime]))
    }

    /// `PUT /api/investments/targets` (empty list removes the target, INV-052).
    public func setTargets(_ targets: [InvestmentsView.Target]) async throws {
        let list = targets.map { ["instrumentId": $0.instrumentId, "weight": jsonDecimal($0.weight)] as [String: Any] }
        _ = try await client.send("api/investments/targets", method: "PUT", body: try Self.body(["targets": list]))
    }

    /// `POST /api/investments/dividends/dismissed` (INV-078).
    public func dismissDividends(_ items: [(instrumentId: String, date: String)]) async throws {
        let list = items.map { ["instrumentId": $0.instrumentId, "date": $0.date] }
        _ = try await client.send("api/investments/dividends/dismissed", method: "POST", body: try Self.body(["items": list]))
    }

    /// `DELETE /api/investments/dividends/dismissed` (undo).
    public func restoreDividends(_ items: [(instrumentId: String, date: String)]) async throws {
        let list = items.map { ["instrumentId": $0.instrumentId, "date": $0.date] }
        _ = try await client.send("api/investments/dividends/dismissed", method: "DELETE", body: try Self.body(["items": list]))
    }

    /// `POST /api/investments/tax-carryforwards` (IT only, INV-088).
    public func addCarryforward(year: Int, amount: Double, note: String?) async throws {
        _ = try await client.send("api/investments/tax-carryforwards", method: "POST",
                                  body: try Self.body(["year": year, "amount": jsonDecimal(amount), "note": note.map { $0 as Any } ?? NSNull()]))
    }

    public func deleteCarryforward(id: String) async throws {
        _ = try await client.send("api/investments/tax-carryforwards/\(Self.escape(id))", method: "DELETE")
    }

    static func body(_ json: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }

    static func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    static func escape(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }
}
