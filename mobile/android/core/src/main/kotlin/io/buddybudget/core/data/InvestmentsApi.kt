package io.buddybudget.core.data

import io.buddybudget.core.domain.investments.InvestmentsQuery
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Investimenti (spec: api/endpoints/investments-views.md, investments.md, features/07-investments.md). The server runs
// the web's engines; the app only renders the views and sends mutations. Same names on iOS (`InvestmentsAPI` and the
// models in `BuddyBudgetKit/Data/InvestmentsAPI.swift`).

enum class InstrumentType(val raw: String) {
    Etf("etf"), Azione("azione"), Obbligazione("obbligazione"), Fondo("fondo"), Crypto("crypto"), Etc("etc");

    companion object {
        fun of(raw: String?): InstrumentType = entries.firstOrNull { it.raw == raw } ?: Etf
    }
}

/** Raw `instruments` row (numeric columns as strings). */
@Serializable
data class Instrument(
    val id: String,
    val isin: String? = null,
    val name: String,
    val type: String = "etf",
    val currency: String = "EUR",
    val priceMode: String = "auto",
    val priceUnit: String = "unita",
    val exchange: String? = null,
    val taxRate: String? = null,
    val taxHarmonized: Boolean? = null,
    val createdByUserId: String? = null,
) {
    val kind: InstrumentType get() = InstrumentType.of(type)
    /** Bonds quoted in % of nominal: value = quantity × price / 100 (INV-065). */
    val isPercentOfNominal: Boolean get() = priceUnit == "percentuale_nominale"
    val hasAutomaticPrices: Boolean get() = priceMode == "auto"
}

@Serializable
data class LastPrice(val date: String, val close: Double, val origin: String)

/** One open position (`PositionRow`), sorted by value desc by the server. */
@Serializable
data class PositionRow(
    val instrument: Instrument,
    val quantity: Double,
    val averagePrice: Double? = null,
    val costBasis: Double? = null,
    val lastPrice: LastPrice? = null,
    val value: Double? = null,
    val unrealizedGain: Double? = null,
    val unrealizedGainPct: Double? = null,
    val weight: Double? = null,
) {
    val id: String get() = instrument.id
}

@Serializable
data class PortfolioSummary(
    val totalValue: Double,
    val dayChange: Double? = null,
    val dayChangePct: Double? = null,
    val unrealizedGain: Double? = null,
    val realizedGain: Double? = null,
    val income: Double? = null,
    val totalGain: Double? = null,
    val totalGainPct: Double? = null,
    val investedNet: Double? = null,
    val costBasis: Double? = null,
    val unpricedCount: Int = 0,
    val rows: List<PositionRow> = emptyList(),
)

// ---------------------------------------------------------------- GET /api/investments/view

@Serializable
data class InvestmentsView(
    val currency: String,
    val today: String,
    val period: String,
    val calculationPeriod: String = "3mesi",
    val range: DateRange? = null,
    val brokers: List<Broker> = emptyList(),
    val brokerCash: List<BrokerCash> = emptyList(),
    val cashTotal: Double = 0.0,
    val hasTransactions: Boolean,
    val summary: PortfolioSummary,
    val series: List<SeriesPoint> = emptyList(),
    val byType: List<Slice> = emptyList(),
    val byCurrency: List<Slice> = emptyList(),
    val instruments: List<Instrument> = emptyList(),
    /** «I tuoi strumenti»: instruments held today, most recently traded first (INV-111, web #445). */
    val heldInstrumentIds: List<String> = emptyList(),
    val breakdown: Breakdown,
    val concentrationText: String? = null,
    val priceNotes: List<PriceNote> = emptyList(),
    val currencyExposure: Double = 0.0,
    val periodGain: PeriodGain? = null,
    val costImpact: CostImpact,
    val costScenarios: List<CostScenario> = emptyList(),
    val reinvestmentEffects: ReinvestmentEffects,
    val income: IncomeHistory,
    val analysis: Analysis,
    val operationMonths: List<OperationMonth> = emptyList(),
    val operationYears: List<Int> = emptyList(),
    val operationTotals: OperationTotals,
    val benchmark: Instrument? = null,
    val benchmarkFirstPriceDate: String? = null,
) {
    @Serializable data class DateRange(val from: String, val to: String)
    @Serializable data class Broker(val id: String, val label: String, val operations: Int = 0, val excluded: Boolean = false)
    @Serializable data class BrokerCash(val accountId: String, val provider: String, val name: String, val balance: Double, val statementDate: String? = null)
    @Serializable data class SeriesPoint(val date: String, val label: String = "", val value: Double, val invested: Double)
    @Serializable data class Slice(val key: String, val value: Double, val share: Double)
    @Serializable data class Breakdown(val paid: Double, val market: Double, val value: Double, val marketShare: Double? = null, val cashedIn: Double = 0.0)
    @Serializable data class PriceNote(val instrumentId: String, val price: String? = null, val detail: String = "", val stale: Boolean = false, val hint: String? = null)
    @Serializable
    data class PeriodGain(
        val fromKey: String, val toKey: String, val startValue: Double, val endValue: Double, val netContributions: Double,
        val income: Double, val gain: Double, val twr: Double? = null,
    )
    @Serializable data class CostImpact(val fees: Double, val taxes: Double, val estimatedTaxes: Double, val available: Boolean)
    /** One of the four «Rimetti costi / imposte» combinations (INV-018). */
    @Serializable
    data class CostScenario(
        val includeFees: Boolean, val includeTaxes: Boolean, val active: Boolean = false, val value: Double, val extra: Double,
        val series: List<Double> = emptyList(),
    )
    @Serializable data class ReinvestmentEffects(val fees: Double, val taxes: Double)
    @Serializable
    data class IncomeHistory(
        val total: Double = 0.0, val trailing: Double = 0.0, val count: Int = 0, val yieldOnCost: Double? = null,
        val payments: List<Payment> = emptyList(),
    ) {
        @Serializable
        data class Payment(
            val id: String, val instrumentId: String, val date: String, val kind: String, val gross: Double, val taxes: Double,
            val fees: Double, val net: Double,
        )
    }
    @Serializable data class ExposureBreakdown(val slices: List<Slice> = emptyList(), val classifiedShare: Double = 1.0)
    @Serializable
    data class ExposureRow(val instrument: Instrument, val value: Double, val share: Double, val exposure: Exposure? = null, val manual: Manual? = null) {
        @Serializable
        data class Exposure(
            val sectors: Map<String, Double>? = null, val sectorSource: String? = null,
            val areas: Map<String, Double>? = null, val areaSource: String? = null,
        )
        @Serializable data class Manual(val sectors: Map<String, Double>? = null, val areas: Map<String, Double>? = null)
    }
    @Serializable data class FundOverlap(val aId: String, val bId: String, val share: Double, val method: String)
    @Serializable
    data class StockInsideFunds(val stockId: String, val directValue: Double, val funds: List<Fund> = emptyList(), val totalValue: Double) {
        @Serializable data class Fund(val fundId: String, val weightInFund: Double, val viaFundValue: Double)
    }
    @Serializable data class CorrelationPair(val aId: String, val bId: String, val value: Double)
    @Serializable data class CorrelationFamilies(val families: List<List<String>> = emptyList(), val independent: List<String> = emptyList())
    @Serializable data class Target(val instrumentId: String, val weight: Double)
    @Serializable
    data class AllocationRowView(
        val instrumentId: String, val value: Double, val currentWeight: Double, val targetWeight: Double, val drift: Double,
        val status: String, val inTarget: Boolean,
    )
    @Serializable data class Allocation(val rows: List<AllocationRowView> = emptyList(), val total: Double, val unpricedIds: List<String> = emptyList(), val maxDrift: Double)
    @Serializable data class Correlations(val instrumentIds: List<String> = emptyList())
    @Serializable
    data class Analysis(
        val sectors: ExposureBreakdown = ExposureBreakdown(),
        val areas: ExposureBreakdown = ExposureBreakdown(),
        val exposureRows: List<ExposureRow> = emptyList(),
        val overlaps: List<FundOverlap> = emptyList(),
        val stocksInFunds: List<StockInsideFunds> = emptyList(),
        val targets: List<Target> = emptyList(),
        val allocation: Allocation? = null,
        val sectorInsight: String? = null,
        val areaInsight: String? = null,
        val correlationPairs: List<CorrelationPair> = emptyList(),
        val correlationFamilies: CorrelationFamilies? = null,
        val currentWeights: List<Target> = emptyList(),
        /** Present when there are ≥ 2 priced positions. */
        val correlations: Correlations? = null,
    )

    fun instrument(id: String): Instrument? = instruments.firstOrNull { it.id == id }
    fun priceNote(id: String): PriceNote? = priceNotes.firstOrNull { it.instrumentId == id }
}

// ---------------------------------------------------------------- Operations

/** Raw `investment_transactions` row (numerics as strings). */
@Serializable
data class InvestmentTransaction(
    val id: String,
    val instrumentId: String,
    val statementAccountKey: String? = null,
    val type: String,
    val date: String,
    val quantity: String = "0",
    val price: String = "0",
    val fxRate: String = "1",
    val fees: String = "0",
    val taxes: String = "0",
    val grossAmount: String? = null,
    val note: String? = null,
) {
    val quantityValue: Double get() = quantity.toDoubleOrNull() ?: 0.0
    val priceValue: Double get() = price.toDoubleOrNull() ?: 0.0
    val fxRateValue: Double get() = fxRate.toDoubleOrNull() ?: 1.0
    val feesValue: Double get() = fees.toDoubleOrNull() ?: 0.0
    val taxesValue: Double get() = taxes.toDoubleOrNull() ?: 0.0
    val grossValue: Double? get() = grossAmount?.toDoubleOrNull()
    /** INV-060/061: imported from a reconciled broker statement (read-only). */
    val isReconciled: Boolean get() = statementAccountKey != null
}

@Serializable
data class OperationResult(
    val transaction: InvestmentTransaction,
    val paid: Double = 0.0,
    val received: Double = 0.0,
    val remainingQuantity: Double? = null,
    val currentValue: Double? = null,
    val gain: Double? = null,
    val gainPct: Double? = null,
    /** Cost the gain is measured against. */
    val gainBase: Double? = null,
) {
    val id: String get() = transaction.id
}

@Serializable
data class OperationTotals(
    val count: Int,
    val bought: Double,
    val sold: Double,
    val income: Double,
    val gain: Double,
    val gainPct: Double? = null,
    val unpricedCount: Int = 0,
)

@Serializable
data class OperationMonth(val key: String, val year: Int, val label: String = "", val operations: List<OperationResult> = emptyList(), val totals: OperationTotals)

// ---------------------------------------------------------------- GET /api/investments/performance

@Serializable
data class ReturnValues(
    val fromKey: String,
    val baseKey: String? = null,
    val toKey: String,
    val days: Int = 0,
    val showAnnual: Boolean = false,
    val twr: Double? = null,
    val twrAnnual: Double? = null,
    val moneyWeighted: Double? = null,
    val moneyWeightedAnnual: Double? = null,
    val real: Real? = null,
    val benchmarkStatus: String = "none",
    val benchmark: BenchmarkValues? = null,
    val timingInsight: String? = null,
) {
    @Serializable data class Real(val value: Double? = null, val inflation: Double? = null, val throughMonth: String? = null)
    @Serializable
    data class BenchmarkValues(
        val twr: Double? = null, val twrAnnual: Double? = null, val simulatedValue: Double? = null, val portfolioValue: Double? = null,
        val moneyWeighted: Double? = null, val depleted: Boolean? = null,
    )
}

/** The returns card «as of» a chart point (`index` into `returns.series`). */
@Serializable
data class InspectPoint(
    val index: Int,
    val date: String,
    val fromKey: String,
    val baseKey: String? = null,
    val toKey: String,
    val days: Int = 0,
    val showAnnual: Boolean = false,
    val twr: Double? = null,
    val twrAnnual: Double? = null,
    val moneyWeighted: Double? = null,
    val moneyWeightedAnnual: Double? = null,
    val real: ReturnValues.Real? = null,
    val benchmarkStatus: String = "none",
    val benchmark: ReturnValues.BenchmarkValues? = null,
    val timingInsight: String? = null,
) {
    val values: ReturnValues
        get() = ReturnValues(fromKey, baseKey, toKey, days, showAnnual, twr, twrAnnual, moneyWeighted, moneyWeightedAnnual, real, benchmarkStatus,
            benchmark, timingInsight)
}

@Serializable
data class HeatmapCell(val key: String, val label: String = "", val ret: Double? = null, val gain: Double? = null, val level: Int = 0)

@Serializable
data class ReturnHeatmap(
    val grouping: String,
    val columns: List<String> = emptyList(),
    val rows: List<Row> = emptyList(),
    val scale: Double = 0.0,
    val positive: Int = 0,
    val negative: Int = 0,
    val counted: Int = 0,
) {
    @Serializable data class Row(val label: String = "", val cells: List<HeatmapCell?> = emptyList(), val total: HeatmapCell? = null)
}

@Serializable
data class InvestmentsPerformance(
    val currency: String,
    val today: String,
    val period: String,
    val range: InvestmentsView.DateRange? = null,
    val selection: InvestmentsView.DateRange? = null,
    val hasTransactions: Boolean,
    val benchmark: Instrument? = null,
    val benchmarkFirstPriceDate: String? = null,
    val returns: ReturnsSeries? = null,
    val benchmarkVerdict: String? = null,
    val inspect: List<InspectPoint> = emptyList(),
    val risk: Risk? = null,
    val heatmaps: Heatmaps = Heatmaps(),
) {
    @Serializable
    data class ReturnsSeries(
        val fromKey: String,
        val baseKey: String? = null,
        val toKey: String,
        val days: Int = 0,
        val showAnnual: Boolean = false,
        val twr: Double? = null,
        val twrAnnual: Double? = null,
        val moneyWeighted: Double? = null,
        val moneyWeightedAnnual: Double? = null,
        val real: ReturnValues.Real? = null,
        val benchmarkStatus: String = "none",
        val benchmark: ReturnValues.BenchmarkValues? = null,
        val timingInsight: String? = null,
        val series: List<Point> = emptyList(),
    ) {
        @Serializable data class Point(val date: String, val label: String = "", val portfolio: Double, val benchmark: Double? = null)

        val values: ReturnValues
            get() = ReturnValues(fromKey, baseKey, toKey, days, showAnnual, twr, twrAnnual, moneyWeighted, moneyWeightedAnnual, real, benchmarkStatus,
                benchmark, timingInsight)
    }

    @Serializable data class Drawdown(val depth: Double, val peakDate: String? = null, val troughDate: String? = null, val recoveryDate: String? = null, val current: Double? = null)
    @Serializable data class DrawdownPoint(val date: String, val drawdown: Double, val label: String = "")
    @Serializable data class BenchmarkRisk(val volatility: Double? = null, val beta: Double? = null, val correlation: Double? = null)
    @Serializable
    data class Risk(
        val observations: Int = 0,
        val fewData: Boolean = false,
        val volatility: Double? = null,
        val drawdown: Drawdown? = null,
        val drawdownSeries: List<DrawdownPoint> = emptyList(),
        val sharpe: Double? = null,
        val riskFreeRate: Double? = null,
        val benchmark: BenchmarkRisk? = null,
        val level: Int? = null,
        val levelLabel: String? = null,
        val scalePosition: Double? = null,
        val levelInsight: String? = null,
        val volatilityInsight: String? = null,
        val sharpeLevel: String? = null,
        val sharpeInsight: String? = null,
        val betaInsight: String? = null,
        val recoveryDays: Int? = null,
    )
    @Serializable
    data class Heatmaps(
        val giorno: ReturnHeatmap? = null, val settimana: ReturnHeatmap? = null, val mese: ReturnHeatmap? = null, val anno: ReturnHeatmap? = null,
    )
}

// ---------------------------------------------------------------- GET /api/investments/income (IT)

@Serializable
data class InvestmentsIncome(
    val currency: String,
    val todayKey: String,
    val hasTransactions: Boolean,
    val history: InvestmentsView.IncomeHistory = InvestmentsView.IncomeHistory(),
    val missing: List<Missing> = emptyList(),
    val forecast: Forecast,
    val byMonth: List<YearDetail> = emptyList(),
    val byInstrument: List<InstrumentRow> = emptyList(),
    val rows: List<PositionRow> = emptyList(),
    val instruments: List<Instrument> = emptyList(),
    val taxSettings: List<TaxSetting> = emptyList(),
    val pendingDividendHistory: Int = 0,
) {
    @Serializable
    data class Missing(
        val instrumentId: String, val kind: String, val date: String, val quantity: Double, val gross: Double, val fxRate: Double? = null,
        val estimatedTax: Double? = null,
    ) {
        val id: String get() = "$instrumentId:$date"
    }
    @Serializable data class ForecastMonth(val key: String, val gross: Double, val net: Double)
    @Serializable data class ForecastEvent(val instrumentId: String, val kind: String, val date: String, val gross: Double, val net: Double, val basis: String)
    @Serializable
    data class Forecast(
        val months: List<ForecastMonth> = emptyList(), val events: List<ForecastEvent> = emptyList(), val totalGross: Double = 0.0,
        val totalNet: Double = 0.0, val bondsWithoutTerms: List<String> = emptyList(),
    )
    @Serializable data class MonthDetail(val month: Int, val gross: Double, val withheld: Double, val net: Double)
    @Serializable data class YearDetail(val year: Int, val months: List<MonthDetail> = emptyList(), val gross: Double, val withheld: Double, val net: Double)
    @Serializable data class Growth(val rate: Double, val years: Int)
    @Serializable
    data class InstrumentRow(
        val instrumentId: String, val trailingNet: Double, val yieldOnCost: Double? = null, val forecastGross: Double = 0.0,
        val currentYield: Double? = null, val growth: Growth? = null, val hasCouponTerms: Boolean = false,
    )
    @Serializable
    data class TaxSetting(
        val instrumentId: String, val taxRate: Double? = null, val taxRateSource: String? = null, val harmonized: Boolean? = null,
        val harmonizedSource: String? = null,
    )

    fun instrument(id: String): Instrument? = instruments.firstOrNull { it.id == id }
}

// ---------------------------------------------------------------- GET /api/investments/taxes (IT)

@Serializable
data class InvestmentsTaxes(
    val currency: String,
    val todayKey: String,
    val currentYear: Int,
    val regime: String,
    val report: Report,
    val opportunities: Opportunities,
    val instruments: List<Instrument> = emptyList(),
    val rateListInstrumentIds: List<String> = emptyList(),
    val settings: List<Setting> = emptyList(),
    val resolved: List<Resolved> = emptyList(),
    val sellable: List<Sellable> = emptyList(),
    val carryforwards: List<Carryforward> = emptyList(),
    val hasTransactions: Boolean = false,
) {
    @Serializable
    data class TaxYear(
        val year: Int, val gains: Double = 0.0, val losses: Double = 0.0, val fundGains: Double = 0.0, val cryptoGains: Double = 0.0,
        val cryptoLosses: Double = 0.0, val lossesUsed: Double = 0.0, val lossesCreated: Double = 0.0, val lossesExpired: Double = 0.0,
        val cryptoLossesUsed: Double = 0.0, val taxOnGains: Double = 0.0, val taxOnFunds: Double = 0.0, val taxOnCrypto: Double = 0.0,
        val estimatedTax: Double = 0.0, val withheld: Double = 0.0, val incomeGross: Double = 0.0, val incomeWithheld: Double = 0.0,
        val bollo: Double = 0.0, val nonHarmonizedCount: Int = 0,
    )
    @Serializable
    data class LossEntry(val year: Int, val expiresYear: Int, val amount: Double, val remaining: Double, val origin: String = "", val crypto: Boolean = false)
    @Serializable data class Report(val regime: String = "", val years: List<TaxYear> = emptyList(), val losses: List<LossEntry> = emptyList())
    @Serializable data class OpportunityRow(val instrumentId: String, val unrealized: Double, val equivalent: Double = 0.0)
    @Serializable
    data class Opportunities(
        val expiringThisYear: Double = 0.0, val compensableGains: List<OpportunityRow> = emptyList(), val compensableTotal: Double = 0.0,
        val losses: List<OpportunityRow> = emptyList(), val lossesTotal: Double = 0.0,
    )
    @Serializable data class Sellable(val instrument: Instrument, val quantity: Double, val price: Double? = null, val fxRate: Double? = null)
    @Serializable
    data class Carryforward(val id: String, val year: Int, val amount: String, val note: String? = null) {
        val amountValue: Double get() = amount.toDoubleOrNull() ?: 0.0
    }
    @Serializable
    data class Setting(
        val instrumentId: String, val taxRate: String? = null, val taxHarmonized: Boolean? = null, val couponRate: String? = null,
        val couponFrequency: Int? = null, val maturityDate: String? = null,
    )
    @Serializable
    data class Resolved(
        val instrumentId: String, val taxRate: Double, val taxRateSource: String? = null, val harmonized: Boolean? = null,
        val harmonizedSource: String? = null,
    )

    fun instrument(id: String): Instrument? = instruments.firstOrNull { it.id == id }
    fun setting(id: String): Setting? = settings.firstOrNull { it.instrumentId == id }
    fun resolved(id: String): Resolved? = resolved.firstOrNull { it.instrumentId == id }
}

/** `POST /api/investments/taxes/simulate-sale`. */
@Serializable
data class SaleSimulation(
    val instrumentId: String,
    val regime: String,
    val quantity: Double,
    val heldQuantity: Double,
    val price: Double,
    val fxRate: Double,
    val proceeds: Double,
    val cost: Double,
    val gain: Double,
    val category: String,
    val taxDelta: Double,
    val lossesUsed: Double = 0.0,
    val lossesCreated: Double = 0.0,
    val net: Double,
    val nonHarmonized: Boolean = false,
    val taxLineLabel: String,
    val note: String,
)

// ---------------------------------------------------------------- GET /api/investments/titles

@Serializable
data class TitleItem(
    val instrument: Instrument,
    val held: Boolean = false,
    val watching: Boolean = false,
    val lastClose: Double? = null,
    val lastDate: String? = null,
    val dayChange: Double? = null,
    val monthChange: Double? = null,
    val spark: List<Double> = emptyList(),
    val activeAlerts: Int = 0,
    val triggeredAlerts: Int = 0,
) {
    val id: String get() = instrument.id
}

@Serializable
data class TitlesResponse(val items: List<TitleItem> = emptyList())

// ---------------------------------------------------------------- Writes

/** Body of `POST /api/investments/transactions` / `PATCH …/{id}` (null = omitted). */
data class OperationInput(
    val instrumentId: String,
    val type: String,
    val date: String,
    val quantity: Double? = null,
    val price: Double? = null,
    val grossAmount: Double? = null,
    val fxRate: Double? = null,
    val fees: Double = 0.0,
    val taxes: Double = 0.0,
    val note: String? = null,
) {
    /** JSON body; `forUpdate` drops `instrumentId` (PATCH cannot change it). */
    fun toJson(forUpdate: Boolean = false): JsonObject = buildJsonObject {
        put("type", type)
        put("date", date)
        put("fees", fees)
        put("taxes", taxes)
        if (!forUpdate) put("instrumentId", instrumentId)
        quantity?.let { put("quantity", it) }
        price?.let { put("price", it) }
        grossAmount?.let { put("grossAmount", it) }
        fxRate?.let { put("fxRate", it) }
        put("note", note?.let(::JsonPrimitive) ?: JsonNull)
    }
}

// ---------------------------------------------------------------- API

class InvestmentsApi(private val client: ApiClient) {
    /** `GET /api/investments/view` (Portafoglio, Diversificazione, Operazioni). */
    suspend fun view(query: InvestmentsQuery): InvestmentsView = client.get("api/investments/view", InvestmentsView.serializer(), query.parameters)

    suspend fun performance(query: InvestmentsQuery): InvestmentsPerformance =
        client.get("api/investments/performance", InvestmentsPerformance.serializer(), query.parameters)

    /** IT only (INV-091). */
    suspend fun income(query: InvestmentsQuery): InvestmentsIncome = client.get("api/investments/income", InvestmentsIncome.serializer(), query.parameters)

    /** IT only (INV-091). */
    suspend fun taxes(query: InvestmentsQuery): InvestmentsTaxes = client.get("api/investments/taxes", InvestmentsTaxes.serializer(), query.parameters)

    /** `POST /api/investments/taxes/simulate-sale` (quantity clamped by the server). */
    suspend fun simulateSale(instrumentId: String, quantity: Double, query: InvestmentsQuery): SaleSimulation {
        val body = buildJsonObject {
            put("instrumentId", instrumentId)
            put("quantity", quantity)
        }
        val response = client.send("api/investments/taxes/simulate-sale", "POST", query = query.parameters - "period", body = body.toString())
        return decode(response, SaleSimulation.serializer())
    }

    suspend fun titles(): List<TitleItem> = client.get("api/investments/titles", TitlesResponse.serializer()).items

    suspend fun createOperation(input: OperationInput) {
        client.send("api/investments/transactions", "POST", body = input.toJson().toString())
    }

    suspend fun updateOperation(id: String, input: OperationInput) {
        client.send("api/investments/transactions/$id", "PATCH", body = input.toJson(forUpdate = true).toString())
    }

    suspend fun deleteOperation(id: String) {
        client.send("api/investments/transactions/$id", "DELETE")
    }

    /** `PATCH /api/investments/portfolio` with the benchmark (null removes it). */
    suspend fun setBenchmark(instrumentId: String?) {
        client.send("api/investments/portfolio", "PATCH", body = buildJsonObject { put("benchmarkInstrumentId", instrumentId?.let(::JsonPrimitive) ?: JsonNull) }.toString())
    }

    /** `PATCH /api/investments/portfolio {taxRegime}` (IT only). */
    suspend fun setTaxRegime(regime: String) {
        client.send("api/investments/portfolio", "PATCH", body = buildJsonObject { put("taxRegime", regime) }.toString())
    }

    /** `PUT /api/investments/targets` (empty list removes the target, INV-052). */
    suspend fun setTargets(targets: List<InvestmentsView.Target>) {
        val list = JsonArray(targets.map { buildJsonObject { put("instrumentId", it.instrumentId); put("weight", it.weight) } })
        client.send("api/investments/targets", "PUT", body = buildJsonObject { put("targets", list) }.toString())
    }

    private fun items(items: List<Pair<String, String>>): String {
        val list = JsonArray(items.map { (id, date) -> buildJsonObject { put("instrumentId", id); put("date", date) } })
        return buildJsonObject { put("items", list) }.toString()
    }

    /** `POST /api/investments/dividends/dismissed` (INV-078). */
    suspend fun dismissDividends(items: List<Pair<String, String>>) {
        client.send("api/investments/dividends/dismissed", "POST", body = items(items))
    }

    /** `DELETE /api/investments/dividends/dismissed` (undo). */
    suspend fun restoreDividends(items: List<Pair<String, String>>) {
        client.send("api/investments/dividends/dismissed", "DELETE", body = items(items))
    }

    /** `POST /api/investments/tax-carryforwards` (IT only, INV-088). */
    suspend fun addCarryforward(year: Int, amount: Double, note: String?) {
        val body = buildJsonObject {
            put("year", year)
            put("amount", amount)
            put("note", note?.let(::JsonPrimitive) ?: JsonNull)
        }
        client.send("api/investments/tax-carryforwards", "POST", body = body.toString())
    }

    suspend fun deleteCarryforward(id: String) {
        client.send("api/investments/tax-carryforwards/$id", "DELETE")
    }

    private fun <T> decode(response: ApiResponse, serializer: kotlinx.serialization.DeserializationStrategy<T>): T = try {
        client.json.decodeFromString(serializer, response.text)
    } catch (e: kotlinx.serialization.SerializationException) {
        throw ApiError.Decoding(e.message ?: "invalid JSON")
    }

    companion object {
        internal fun jsonElement(value: Any?): JsonElement = when (value) {
            null -> JsonNull
            is String -> JsonPrimitive(value)
            is Number -> JsonPrimitive(value)
            is Boolean -> JsonPrimitive(value)
            else -> JsonPrimitive(value.toString())
        }
    }
}
