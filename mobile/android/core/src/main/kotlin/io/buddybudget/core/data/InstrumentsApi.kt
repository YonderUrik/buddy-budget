package io.buddybudget.core.data

import io.buddybudget.core.domain.investments.TitlePeriod
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Instruments and the security page (spec: api/endpoints/instruments.md, features/08-securities-watchlist.md).
// Same names on iOS (`InstrumentsAPI` and the models in `BuddyBudgetKit/Data/InstrumentsAPI.swift`).

@Serializable
data class InstrumentSearchResult(
    val known: List<Instrument> = emptyList(),
    val market: List<MarketHit> = emptyList(),
    val crypto: List<CryptoHit> = emptyList(),
    val isin: String? = null,
    val marketUnavailable: Boolean = false,
    val cryptoUnavailable: Boolean = false,
) {
    @Serializable
    data class MarketHit(val symbol: String, val name: String, val exchange: String? = null, val exchangeLabel: String? = null, val type: String) {
        val kind: InstrumentType get() = InstrumentType.of(type)
    }

    @Serializable data class CryptoHit(val id: String, val name: String, val symbol: String)
}

/** `POST /api/instruments` body (discriminated by `source`). */
sealed interface InstrumentCreateInput {
    data class Yahoo(val symbol: String, val name: String, val type: String, val isin: String?) : InstrumentCreateInput
    data class Coingecko(val id: String, val name: String, val currency: String) : InstrumentCreateInput
    data class Isin(val isin: String, val name: String, val type: String, val currency: String) : InstrumentCreateInput
    data class Manual(val name: String, val type: String, val currency: String, val isin: String?) : InstrumentCreateInput

    fun toJson(): JsonObject = when (this) {
        is Yahoo -> buildJsonObject {
            put("source", "yahoo"); put("yahooSymbol", symbol); put("name", name); put("type", type)
            isin?.let { put("isin", it) }
        }
        is Coingecko -> buildJsonObject { put("source", "coingecko"); put("coingeckoId", id); put("name", name); put("currency", currency) }
        is Isin -> buildJsonObject { put("source", "isin"); put("isin", isin); put("name", name); put("type", type); put("currency", currency) }
        is Manual -> buildJsonObject {
            put("source", "manuale"); put("name", name); put("type", type); put("currency", currency)
            isin?.let { put("isin", it) }
        }
    }
}

@Serializable
data class BackfillState(val instrumentId: String, val status: String, val saved: Int? = null, val total: Int? = null, val interrupted: Boolean? = null) {
    /** INV-024: still downloading (an interrupted job counts as finished). */
    val isRunning: Boolean get() = status == "running" && interrupted != true
}

@Serializable
data class PriceOnDate(val price: Price? = null, val loading: Boolean = false) {
    @Serializable data class Price(val date: String, val close: Double, val origin: String)
}

// ---------------------------------------------------------------- Analysis (security page)

@Serializable
data class PriceAlert(
    val id: String,
    val direction: String,
    val targetPrice: String,
    val status: String,
    val triggeredAt: String? = null,
    val triggeredPrice: String? = null,
) {
    val target: Double get() = targetPrice.toDoubleOrNull() ?: 0.0
    val triggered: Double? get() = triggeredPrice?.toDoubleOrNull()
    val isTriggered: Boolean get() = status == "scattato"
    val isAbove: Boolean get() = direction == "sopra"
}

@Serializable
data class TitleAnalysis(
    val instrument: Instrument,
    val series: List<Point> = emptyList(),
    val stats: Stats? = null,
    val historyDays: Int = 0,
    val backfilling: Boolean = false,
    val position: Position? = null,
    val watching: Boolean = false,
    val alerts: List<PriceAlert> = emptyList(),
    val fundamentals: Fundamentals? = null,
    val fundamentalsStatus: String = "unsupported",
    val commentaryAvailable: Boolean = false,
    val stock: StockFundamentals? = null,
    val dividends: DividendFacts? = null,
    val annualReturns: List<AnnualReturn> = emptyList(),
    val composition: Composition? = null,
    val insideFunds: List<FundRef> = emptyList(),
) {
    @Serializable data class Point(val date: String, val close: Double)
    @Serializable
    data class Stats(
        val lastClose: Double, val lastDate: String, val dayChange: Double? = null, val returns: Map<String, Double> = emptyMap(),
        val high52: Double? = null, val low52: Double? = null, val fromHigh: Double? = null, val volatility: Double? = null,
        val maxDrawdown: Double? = null,
    )
    @Serializable data class Purchase(val date: String, val price: Double)
    @Serializable
    data class Position(
        val quantity: Double, val averagePrice: Double? = null, val value: Double, val gain: Double? = null, val incomeReceived: Double = 0.0,
        val purchases: List<Purchase> = emptyList(), val changeVsAverage: Double? = null,
    )
    @Serializable
    data class Fundamentals(
        val marketCap: Double? = null, val trailingPE: Double? = null, val forwardPE: Double? = null, val priceToBook: Double? = null,
        val dividendYield: Double? = null, val eps: Double? = null, val beta: Double? = null, val profitMargin: Double? = null,
        val returnOnEquity: Double? = null, val revenueGrowth: Double? = null, val debtToEquity: Double? = null,
        val expenseRatio: Double? = null, val totalAssets: Double? = null, val revenuePerShare: Double? = null,
        val holdingsPE: Double? = null, val holdingsPB: Double? = null, val holdingsPS: Double? = null, val fundYield: Double? = null,
        val exDividendDate: String? = null, val fundCategory: String? = null,
    )
    @Serializable
    data class Indicator(val value: Double, val numerator: Term, val denominator: Term, val history: History? = null) {
        @Serializable data class Term(val label: String = "", val value: Double, val unit: String)
        @Serializable data class History(val min: Double, val max: Double, val average: Double, val years: Int)
    }
    @Serializable
    data class StockFundamentals(
        val currency: String,
        val priceComparable: Boolean = true,
        val columns: List<Column> = emptyList(),
        val valuation: Map<String, Indicator> = emptyMap(),
        val perShare: Map<String, List<Double?>> = emptyMap(),
        val company: Company = Company(),
        val margins: Map<String, Indicator> = emptyMap(),
        val growth: Growth = Growth(),
        val profitability: Map<String, Indicator> = emptyMap(),
        val solidity: Map<String, Indicator> = emptyMap(),
    ) {
        @Serializable data class Column(val label: String, val end: String = "", val trailing: Boolean = false)
        @Serializable
        data class Company(val revenue: List<Double?> = emptyList(), val netIncome: List<Double?> = emptyList(), val freeCashFlow: List<Double?> = emptyList())
        @Serializable data class Growth(val lastYear: Double? = null, val average: Double? = null, val averageYears: Int = 0)
    }
    @Serializable
    data class DividendFacts(
        val perYear: List<Year> = emptyList(), val trailing: Double = 0.0, val yieldToday: Double? = null, val yieldOnCost: Double? = null,
        val growth: Double? = null, val growthYears: Int = 0, val nextExDate: String? = null,
    ) {
        @Serializable data class Year(val year: Int, val amount: Double, val partial: Boolean = false)
    }
    @Serializable data class AnnualReturn(val year: Int, val value: Double, val partial: Boolean = false)
    @Serializable data class Holding(val symbol: String? = null, val name: String, val weight: Double)
    @Serializable data class FundRef(val id: String, val name: String, val weight: Double? = null)
    @Serializable
    data class Composition(val holdings: List<Holding> = emptyList(), val sectors: Map<String, Double>? = null, val shared: List<Shared> = emptyList()) {
        @Serializable data class Shared(val holding: Holding, val elsewhere: List<FundRef> = emptyList())
    }
}

/** `GET /api/instruments/{id}/quotation`. */
@Serializable
data class QuotationCandidates(val status: String, val candidates: List<Candidate>? = null) {
    @Serializable data class Candidate(val symbol: String, val exchange: String? = null, val currency: String)
}

/** `POST /api/instruments/{id}/commentary`. */
@Serializable
data class Commentary(val available: Boolean = false, val text: String? = null)

/** `PUT /api/instruments/{id}/settings` body (null = automatic). */
data class InstrumentSettingsInput(
    val taxRate: String? = null,
    val taxHarmonized: Boolean? = null,
    val couponRate: Double? = null,
    val couponFrequency: Int? = null,
    val maturityDate: String? = null,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("taxRate", taxRate?.let(::JsonPrimitive) ?: JsonNull)
        put("taxHarmonized", taxHarmonized?.let(::JsonPrimitive) ?: JsonNull)
        put("couponRate", couponRate?.let(::JsonPrimitive) ?: JsonNull)
        put("couponFrequency", couponFrequency?.let(::JsonPrimitive) ?: JsonNull)
        put("maturityDate", maturityDate?.let(::JsonPrimitive) ?: JsonNull)
    }
}

// ---------------------------------------------------------------- API

class InstrumentsApi(private val client: ApiClient) {
    /** `GET /api/instruments/search?q=` (SEC-002; callers debounce and require ≥ 2 characters). */
    suspend fun search(q: String): InstrumentSearchResult = client.get("api/instruments/search", InstrumentSearchResult.serializer(), mapOf("q" to q))

    /** `POST /api/instruments` (201 created / 200 reused). */
    suspend fun create(input: InstrumentCreateInput, deferHistory: Boolean = false): Instrument {
        val response = client.send("api/instruments", "POST", query = if (deferHistory) mapOf("history" to "deferred") else emptyMap(),
            body = input.toJson().toString())
        return client.json.decodeFromString(Instrument.serializer(), response.text)
    }

    /** `GET /api/instruments/backfill?ids=` (≤ 50 ids). */
    suspend fun backfill(ids: List<String>): List<BackfillState> {
        if (ids.isEmpty()) return emptyList()
        return client.get("api/instruments/backfill", ListSerializer(BackfillState.serializer()), mapOf("ids" to ids.take(50).joinToString(",")))
    }

    /** `GET /api/instruments/{id}/analysis?period=` (SEC-015). */
    suspend fun analysis(id: String, period: TitlePeriod): TitleAnalysis =
        client.get("api/instruments/$id/analysis", TitleAnalysis.serializer(), mapOf("period" to period.raw))

    /** `GET /api/instruments/{id}/price?date=` (INV-067). */
    suspend fun price(id: String, date: String): PriceOnDate = client.get("api/instruments/$id/price", PriceOnDate.serializer(), mapOf("date" to date))

    /** `POST /api/instruments/{id}/manual-prices` (INV-026). */
    suspend fun setManualPrice(id: String, date: String, close: Double) {
        client.send("api/instruments/$id/manual-prices", "POST", body = buildJsonObject { put("date", date); put("close", close) }.toString())
    }

    /** `PUT` / `DELETE /api/instruments/{id}/watch` (SEC-012). */
    suspend fun setWatching(id: String, watching: Boolean) {
        client.send("api/instruments/$id/watch", if (watching) "PUT" else "DELETE")
    }

    /** `POST /api/instruments/{id}/alerts` (SEC-030). */
    suspend fun createAlert(id: String, above: Boolean, target: Double) {
        client.send("api/instruments/$id/alerts", "POST",
            body = buildJsonObject { put("direction", if (above) "sopra" else "sotto"); put("targetPrice", target) }.toString())
    }

    /** `DELETE /api/instruments/{id}/alerts/{alertId}` (SEC-033). */
    suspend fun deleteAlert(id: String, alertId: String) {
        client.send("api/instruments/$id/alerts/$alertId", "DELETE")
    }

    /** `POST /api/instruments/{id}/commentary` (SEC-049; can take ~45 s). */
    suspend fun commentary(id: String): Commentary {
        val response = client.send("api/instruments/$id/commentary", "POST")
        return client.json.decodeFromString(Commentary.serializer(), response.text)
    }

    /** `GET /api/instruments/{id}/quotation` (SEC-028). */
    suspend fun quotations(id: String): QuotationCandidates = client.get("api/instruments/$id/quotation", QuotationCandidates.serializer())

    suspend fun linkQuotation(id: String, symbol: String) {
        client.send("api/instruments/$id/quotation", "POST", body = buildJsonObject { put("yahooSymbol", symbol) }.toString())
    }

    /** `PUT /api/instruments/{id}/settings` (INV-082 / SEC-050; tax fields never sent for DE). */
    suspend fun saveSettings(id: String, input: InstrumentSettingsInput) {
        client.send("api/instruments/$id/settings", "PUT", body = input.toJson().toString())
    }

    /** `PUT /api/instruments/{id}/breakdown` (INV-048; null = automatic for that dimension). */
    suspend fun saveBreakdown(id: String, sectors: Map<String, Double>?, areas: Map<String, Double>?) {
        fun encode(map: Map<String, Double>?) = map?.let { m -> buildJsonObject { m.forEach { (k, v) -> put(k, v) } } } ?: JsonNull
        client.send("api/instruments/$id/breakdown", "PUT", body = buildJsonObject { put("sectors", encode(sectors)); put("areas", encode(areas)) }.toString())
    }
}
