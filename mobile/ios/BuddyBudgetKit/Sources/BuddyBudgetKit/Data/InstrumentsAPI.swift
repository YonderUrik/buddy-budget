import Foundation

// Instruments and the security page (spec: api/endpoints/instruments.md, features/08-securities-watchlist.md).
// Same names on Android (`InstrumentsApi` and the models in `core/data/InstrumentsApi.kt`).

// MARK: - Search

public struct InstrumentSearchResult: Decodable, Equatable, Sendable {
    public struct MarketHit: Decodable, Equatable, Sendable, Identifiable {
        public let symbol: String
        public let name: String
        public let exchange: String?
        public let exchangeLabel: String?
        public let type: String

        public var id: String { symbol }
        public var kind: InstrumentType { InstrumentType(rawValue: type) ?? .etf }
    }

    public struct CryptoHit: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        public let name: String
        public let symbol: String
    }

    public let known: [Instrument]
    public let market: [MarketHit]
    public let crypto: [CryptoHit]
    public let isin: String?
    public let marketUnavailable: Bool
    public let cryptoUnavailable: Bool

    public init(known: [Instrument] = [], market: [MarketHit] = [], crypto: [CryptoHit] = [], isin: String? = nil,
                marketUnavailable: Bool = false, cryptoUnavailable: Bool = false) {
        self.known = known
        self.market = market
        self.crypto = crypto
        self.isin = isin
        self.marketUnavailable = marketUnavailable
        self.cryptoUnavailable = cryptoUnavailable
    }
}

/// `POST /api/instruments` body (discriminated by `source`).
public enum InstrumentCreateInput: Equatable, Sendable {
    case yahoo(symbol: String, name: String, type: String, isin: String?)
    case coingecko(id: String, name: String, currency: String)
    case isin(isin: String, name: String, type: String, currency: String)
    case manual(name: String, type: String, currency: String, isin: String?)

    public var json: [String: Any] {
        switch self {
        case .yahoo(let symbol, let name, let type, let isin):
            var out: [String: Any] = ["source": "yahoo", "yahooSymbol": symbol, "name": name, "type": type]
            if let isin { out["isin"] = isin }
            return out
        case .coingecko(let id, let name, let currency):
            return ["source": "coingecko", "coingeckoId": id, "name": name, "currency": currency]
        case .isin(let isin, let name, let type, let currency):
            return ["source": "isin", "isin": isin, "name": name, "type": type, "currency": currency]
        case .manual(let name, let type, let currency, let isin):
            var out: [String: Any] = ["source": "manuale", "name": name, "type": type, "currency": currency]
            if let isin { out["isin"] = isin }
            return out
        }
    }
}

public struct BackfillState: Decodable, Equatable, Sendable {
    public let instrumentId: String
    public let status: String
    public let saved: Int?
    public let total: Int?
    public let interrupted: Bool?

    /// INV-024: still downloading (an interrupted job counts as finished).
    public var isRunning: Bool { status == "running" && interrupted != true }
}

public struct PriceOnDate: Decodable, Equatable, Sendable {
    public struct Price: Decodable, Equatable, Sendable {
        public let date: String
        public let close: Double
        public let origin: String

        public init(date: String, close: Double, origin: String) {
            self.date = date
            self.close = close
            self.origin = origin
        }
    }

    public let price: Price?
    public let loading: Bool

    public init(price: Price?, loading: Bool) {
        self.price = price
        self.loading = loading
    }
}

// MARK: - Analysis (security page)

public struct PriceAlert: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let direction: String
    public let targetPrice: String
    public let status: String
    public let triggeredAt: String?
    public let triggeredPrice: String?

    public var target: Double { Double(targetPrice) ?? 0 }
    public var triggered: Double? { triggeredPrice.flatMap(Double.init) }
    public var isTriggered: Bool { status == "scattato" }
    public var isAbove: Bool { direction == "sopra" }
}

public struct TitleAnalysis: Decodable, Equatable, Sendable {
    public struct Point: Decodable, Equatable, Sendable {
        public let date: String
        public let close: Double
    }

    public struct Stats: Decodable, Equatable, Sendable {
        public let lastClose: Double
        public let lastDate: String
        public let dayChange: Double?
        public let returns: [String: Double]
        public let high52: Double?
        public let low52: Double?
        public let fromHigh: Double?
        public let volatility: Double?
        public let maxDrawdown: Double?
    }

    public struct Purchase: Decodable, Equatable, Sendable {
        public let date: String
        public let price: Double
    }

    public struct Position: Decodable, Equatable, Sendable {
        public let quantity: Double
        public let averagePrice: Double?
        public let value: Double
        public let gain: Double?
        public let incomeReceived: Double
        public let purchases: [Purchase]
        public let changeVsAverage: Double?
    }

    public struct Fundamentals: Decodable, Equatable, Sendable {
        public let marketCap: Double?
        public let trailingPE: Double?
        public let forwardPE: Double?
        public let priceToBook: Double?
        public let dividendYield: Double?
        public let eps: Double?
        public let beta: Double?
        public let profitMargin: Double?
        public let returnOnEquity: Double?
        public let revenueGrowth: Double?
        public let debtToEquity: Double?
        public let expenseRatio: Double?
        public let totalAssets: Double?
        public let revenuePerShare: Double?
        public let holdingsPE: Double?
        public let holdingsPB: Double?
        public let holdingsPS: Double?
        public let fundYield: Double?
        public let exDividendDate: String?
        public let fundCategory: String?
    }

    public struct Indicator: Decodable, Equatable, Sendable {
        public struct Term: Decodable, Equatable, Sendable {
            public let label: String
            public let value: Double
            public let unit: String
        }

        public struct History: Decodable, Equatable, Sendable {
            public let min: Double
            public let max: Double
            public let average: Double
            public let years: Int
        }

        public let value: Double
        public let numerator: Term
        public let denominator: Term
        public let history: History?
    }

    public struct StockFundamentals: Decodable, Equatable, Sendable {
        public struct Column: Decodable, Equatable, Sendable {
            public let label: String
            public let end: String
            public let trailing: Bool
        }

        public struct Company: Decodable, Equatable, Sendable {
            public let revenue: [Double?]
            public let netIncome: [Double?]
            public let freeCashFlow: [Double?]
        }

        public struct Growth: Decodable, Equatable, Sendable {
            public let lastYear: Double?
            public let average: Double?
            public let averageYears: Int
        }

        public let currency: String
        public let priceComparable: Bool
        public let columns: [Column]
        public let valuation: [String: Indicator]
        public let perShare: [String: [Double?]]
        public let company: Company
        public let margins: [String: Indicator]
        public let growth: Growth
        public let profitability: [String: Indicator]
        public let solidity: [String: Indicator]
    }

    public struct DividendFacts: Decodable, Equatable, Sendable {
        public struct Year: Decodable, Equatable, Sendable {
            public let year: Int
            public let amount: Double
            public let partial: Bool
        }

        public let perYear: [Year]
        public let trailing: Double
        public let yieldToday: Double?
        public let yieldOnCost: Double?
        public let growth: Double?
        public let growthYears: Int
        public let nextExDate: String?
    }

    public struct AnnualReturn: Decodable, Equatable, Sendable {
        public let year: Int
        public let value: Double
        public let partial: Bool
    }

    public struct Holding: Decodable, Equatable, Sendable {
        public let symbol: String?
        public let name: String
        public let weight: Double
    }

    public struct FundRef: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let weight: Double?
    }

    public struct Composition: Decodable, Equatable, Sendable {
        public struct Shared: Decodable, Equatable, Sendable {
            public let holding: Holding
            public let elsewhere: [FundRef]
        }

        public let holdings: [Holding]
        public let sectors: [String: Double]?
        public let shared: [Shared]
    }

    public let instrument: Instrument
    public let series: [Point]
    public let stats: Stats?
    public let historyDays: Int
    public let backfilling: Bool
    public let position: Position?
    public let watching: Bool
    public let alerts: [PriceAlert]
    public let fundamentals: Fundamentals?
    public let fundamentalsStatus: String
    public let commentaryAvailable: Bool
    public let stock: StockFundamentals?
    public let dividends: DividendFacts?
    public let annualReturns: [AnnualReturn]
    public let composition: Composition?
    public let insideFunds: [FundRef]
}

/// `GET /api/instruments/{id}/quotation`.
public struct QuotationCandidates: Decodable, Equatable, Sendable {
    public struct Candidate: Decodable, Equatable, Sendable {
        public let symbol: String
        public let exchange: String?
        public let currency: String
    }

    public let status: String
    public let candidates: [Candidate]?
}

/// `POST /api/instruments/{id}/commentary`.
public struct Commentary: Decodable, Equatable, Sendable {
    public let available: Bool
    public let text: String?
}

/// `PUT /api/instruments/{id}/settings` body (nil = automatic).
public struct InstrumentSettingsInput: Equatable, Sendable {
    public var taxRate: String?
    public var taxHarmonized: Bool?
    public var couponRate: Double?
    public var couponFrequency: Int?
    public var maturityDate: String?

    public init(taxRate: String? = nil, taxHarmonized: Bool? = nil, couponRate: Double? = nil, couponFrequency: Int? = nil,
                maturityDate: String? = nil) {
        self.taxRate = taxRate
        self.taxHarmonized = taxHarmonized
        self.couponRate = couponRate
        self.couponFrequency = couponFrequency
        self.maturityDate = maturityDate
    }

    public var json: [String: Any] {
        func value(_ v: Any?) -> Any { v ?? NSNull() }
        return ["taxRate": value(taxRate), "taxHarmonized": value(taxHarmonized), "couponRate": value(couponRate.map(jsonDecimal)),
                "couponFrequency": value(couponFrequency), "maturityDate": value(maturityDate)]
    }
}

// MARK: - API

public struct InstrumentsAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// `GET /api/instruments/search?q=` (SEC-002; callers debounce and require ≥ 2 characters).
    public func search(_ q: String) async throws -> InstrumentSearchResult {
        try await client.get("api/instruments/search", query: ["q": q])
    }

    /// `POST /api/instruments` (201 created / 200 reused). `deferHistory` = `?history=deferred` (benchmark).
    public func create(_ input: InstrumentCreateInput, deferHistory: Bool = false) async throws -> Instrument {
        let response = try await client.send("api/instruments", method: "POST", query: deferHistory ? ["history": "deferred"] : [:],
                                             body: try InvestmentsAPI.body(input.json))
        return try InvestmentsAPI.decode(response.data)
    }

    /// `GET /api/instruments/backfill?ids=` (≤ 50 ids).
    public func backfill(ids: [String]) async throws -> [BackfillState] {
        guard !ids.isEmpty else { return [] }
        return try await client.get("api/instruments/backfill", query: ["ids": ids.prefix(50).joined(separator: ",")])
    }

    /// `GET /api/instruments/{id}/analysis?period=` (SEC-015).
    public func analysis(id: String, period: TitlePeriod) async throws -> TitleAnalysis {
        try await client.get("api/instruments/\(InvestmentsAPI.escape(id))/analysis", query: ["period": period.rawValue])
    }

    /// `GET /api/instruments/{id}/price?date=` (INV-067).
    public func price(id: String, date: String) async throws -> PriceOnDate {
        try await client.get("api/instruments/\(InvestmentsAPI.escape(id))/price", query: ["date": date])
    }

    /// `POST /api/instruments/{id}/manual-prices` (INV-026).
    public func setManualPrice(id: String, date: String, close: Double) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/manual-prices", method: "POST",
                                  body: try InvestmentsAPI.body(["date": date, "close": jsonDecimal(close)]))
    }

    /// `PUT /api/instruments/{id}/watch` / `DELETE` (SEC-012).
    public func setWatching(id: String, _ watching: Bool) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/watch", method: watching ? "PUT" : "DELETE")
    }

    /// `POST /api/instruments/{id}/alerts` (SEC-030).
    public func createAlert(id: String, above: Bool, target: Double) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/alerts", method: "POST",
                                  body: try InvestmentsAPI.body(["direction": above ? "sopra" : "sotto", "targetPrice": jsonDecimal(target)]))
    }

    /// `DELETE /api/instruments/{id}/alerts/{alertId}` (SEC-033).
    public func deleteAlert(id: String, alertId: String) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/alerts/\(InvestmentsAPI.escape(alertId))", method: "DELETE")
    }

    /// `POST /api/instruments/{id}/commentary` (SEC-049; can take ~45 s).
    public func commentary(id: String) async throws -> Commentary {
        let response = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/commentary", method: "POST")
        return try InvestmentsAPI.decode(response.data)
    }

    /// `GET /api/instruments/{id}/quotation` (SEC-028).
    public func quotations(id: String) async throws -> QuotationCandidates {
        try await client.get("api/instruments/\(InvestmentsAPI.escape(id))/quotation")
    }

    /// `POST /api/instruments/{id}/quotation` (SEC-028).
    public func linkQuotation(id: String, symbol: String) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/quotation", method: "POST",
                                  body: try InvestmentsAPI.body(["yahooSymbol": symbol]))
    }

    /// `PUT /api/instruments/{id}/settings` (INV-082 / SEC-050; tax fields never sent for DE).
    public func saveSettings(id: String, _ input: InstrumentSettingsInput) async throws {
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/settings", method: "PUT",
                                  body: try InvestmentsAPI.body(input.json))
    }

    /// `PUT /api/instruments/{id}/breakdown` (INV-048; nil = automatic for that dimension).
    public func saveBreakdown(id: String, sectors: [String: Double]?, areas: [String: Double]?) async throws {
        func encode(_ map: [String: Double]?) -> Any { map.map { $0.mapValues(jsonDecimal) } ?? NSNull() }
        _ = try await client.send("api/instruments/\(InvestmentsAPI.escape(id))/breakdown", method: "PUT",
                                  body: try InvestmentsAPI.body(["sectors": encode(sectors), "areas": encode(areas)]))
    }
}
