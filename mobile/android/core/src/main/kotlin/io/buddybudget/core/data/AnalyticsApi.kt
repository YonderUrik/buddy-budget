package io.buddybudget.core.data

import io.buddybudget.core.domain.costs.CostPosition
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireExpectedReturnInfo
import io.buddybudget.core.domain.fire.FireGrowthSplitPoint
import io.buddybudget.core.domain.fire.FireHistoricalReturnResult
import io.buddybudget.core.domain.fire.FireLiquidationPosition
import io.buddybudget.core.domain.fire.FirePlanBase
import io.buddybudget.core.domain.fire.FireReturnSource
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.fire.MonteCarloPublicPension
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.periods.DataPeriod
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Analitiche (11-analytics): `GET /api/analytics/base` (one call with the saved assumptions, the data base and the
// plan), `PUT /api/analytics/assumptions` (partial update) and `POST /api/analytics/walkthrough`. Spec:
// api/endpoints/analytics.md. The «e se…» sliders, Monte Carlo, sensitivity and costs run on the device from `base`
// with the ported FireCalc / FirePlanning / MonteCarlo / CostsCalc. Same names on iOS (`AnalyticsAPI.swift`).

/** `AnalyticsView` (G9). */
data class AnalyticsView(
    val currency: String,
    val today: String,
    val walkthroughSeen: Boolean,
    /** As saved: what `PUT /api/analytics/assumptions` edits. */
    val storedAssumptions: FireAssumptions,
    /** In use: `expectedReturn` from history when `expectedReturnAuto`. */
    val assumptions: FireAssumptions,
    val returnInfo: FireExpectedReturnInfo,
    val base: AnalyticsBase,
)

/** `AnalyticsBase`: what the plan, the growth split, risk and costs read. */
data class AnalyticsBase(
    val currency: String,
    val wealth: FirePlanBase.Wealth,
    val cashflow: Cashflow,
    val positions: List<Position>,
    val growthPoints: List<GrowthPoint>,
    val risk: Risk?,
    val riskContribution: List<RiskContribution>?,
    val names: Map<String, String>,
    val historicalReturn: FireHistoricalReturnResult,
) {
    @Serializable
    data class CashflowMonth(val year: Int, val month: Int, val label: String, val entrate: FlexDouble, val uscite: FlexDouble)

    @Serializable
    data class Cashflow(
        val months: List<CashflowMonth> = emptyList(),
        val fromKey: String,
        val toKey: String,
        val coveredMonths: Int = 0,
        val annualIncome: FlexDouble = 0.0,
        val annualSpending: FlexDouble = 0.0,
        val annualSavings: FlexDouble = 0.0,
        val savingsRate: FlexDouble? = null,
        val leanSpending: FlexDouble? = null,
        val monthsWithData: Int = 0,
    )

    @Serializable
    data class Position(
        val id: String,
        val name: String,
        val value: FlexDouble,
        val ter: FlexDouble? = null,
        val subjectToBollo: Boolean = false,
        val unrealizedGain: FlexDouble = 0.0,
        val taxRate: FlexDouble = 0.0,
    )

    @Serializable
    data class GrowthPoint(val month: String, val netWorth: FlexDouble, val savings: FlexDouble)

    @Serializable
    data class Tail(val `var`: FlexDouble, val cvar: FlexDouble)

    @Serializable
    data class Concentration(val hhi: FlexDouble, val effectiveN: FlexDouble)

    /** `AnalyticsRisk` (null without enough price data). */
    @Serializable
    data class Risk(
        val observations: Int = 0,
        val fewData: Boolean = false,
        val volatility: FlexDouble? = null,
        val maxDrawdown: FlexDouble? = null,
        val sharpe: FlexDouble? = null,
        val sortino: FlexDouble? = null,
        val calmar: FlexDouble? = null,
        val annualReturn: FlexDouble? = null,
        val tail: Tail? = null,
        val concentration: Concentration? = null,
    )

    @Serializable
    data class RiskContribution(val id: String, val weight: FlexDouble, val riskShare: FlexDouble)

    /** What `FirePlanning.resolvePlan` reads. */
    val planBase: FirePlanBase
        get() = FirePlanBase(
            wealth,
            FirePlanBase.Cashflow(cashflow.annualSpending, cashflow.annualSavings, cashflow.monthsWithData),
            positions.map { FireLiquidationPosition(it.id, it.name, it.value, it.unrealizedGain, it.taxRate) },
        )

    /** Growth split points («Da dove arriva la crescita»). */
    val splitPoints: List<FireGrowthSplitPoint> get() = growthPoints.map { FireGrowthSplitPoint(it.month, it.netWorth, it.savings) }

    /** Positions with the user's TERs (`summarizeCosts` input). */
    fun costPositions(ter: Map<String, Double>): List<CostPosition> =
        positions.map { CostPosition(it.id, it.name, it.value, ter[it.id], it.subjectToBollo) }
}

// MARK: - Wire format

@Serializable
private data class WealthDto(val liquidity: FlexDouble = 0.0, val investments: FlexDouble = 0.0, val pension: FlexDouble = 0.0, val debts: FlexDouble = 0.0)

@Serializable
private data class PeriodDto(val kind: String = "ultimi", val months: Int? = null, val from: String? = null, val to: String? = null) {
    fun toDomain(): DataPeriod = if (kind == "personalizzato") DataPeriod.Personalizzato(from ?: "", to ?: "") else DataPeriod.Ultimi(months ?: 12)
}

@Serializable
private data class PensionDto(val annual: FlexDouble, val startsAfterYears: FlexDouble)

@Serializable
private data class AssumptionsDto(
    val withdrawalRate: FlexDouble? = null,
    val dataPeriod: PeriodDto? = null,
    val annualSpending: FlexDouble? = null,
    val annualSavings: FlexDouble? = null,
    val expectedReturn: FlexDouble? = null,
    val expectedReturnAuto: Boolean? = null,
    val volatility: FlexDouble? = null,
    val inflation: FlexDouble? = null,
    val retirementYears: FlexDouble? = null,
    val rule: String? = null,
    val includePensionFunds: Boolean? = null,
    val includeLatentTax: Boolean? = null,
    val publicPension: PensionDto? = null,
    val terByInstrument: Map<String, FlexDouble> = emptyMap(),
) {
    fun toDomain(): FireAssumptions {
        val d = FireAssumptions.defaults
        return FireAssumptions(
            withdrawalRate = withdrawalRate ?: d.withdrawalRate,
            dataPeriod = dataPeriod?.toDomain() ?: d.dataPeriod,
            annualSpending = annualSpending,
            annualSavings = annualSavings,
            expectedReturn = expectedReturn ?: d.expectedReturn,
            expectedReturnAuto = expectedReturnAuto ?: d.expectedReturnAuto,
            volatility = volatility ?: d.volatility,
            inflation = inflation ?: d.inflation,
            retirementYears = retirementYears ?: d.retirementYears,
            rule = rule?.let { WithdrawalRule.fromKey(it) } ?: d.rule,
            includePensionFunds = includePensionFunds ?: d.includePensionFunds,
            includeLatentTax = includeLatentTax ?: d.includeLatentTax,
            publicPension = publicPension?.let { MonteCarloPublicPension(it.annual, it.startsAfterYears) },
            terByInstrument = terByInstrument,
        )
    }
}

@Serializable
private data class HistoryDto(
    val status: String,
    val months: Int = 0,
    val shorterThanPeriod: Boolean = false,
    val fromKey: String = "",
    val toKey: String = "",
    val nominal: FlexDouble = 0.0,
    val real: FlexDouble? = null,
    val reason: String? = null,
) {
    fun toDomain(): FireHistoricalReturnResult =
        if (status == "ok") FireHistoricalReturnResult.Ok(months, shorterThanPeriod, fromKey, toKey, nominal, real)
        else FireHistoricalReturnResult.Manca(reason ?: "nessun-investimento")
}

@Serializable
private data class ReturnInfoDto(
    val value: FlexDouble,
    val source: String,
    val history: HistoryDto,
    val historyReal: FlexDouble? = null,
    val clamped: Boolean = false,
    val high: Boolean = false,
) {
    fun toDomain() = FireExpectedReturnInfo(
        value, FireReturnSource.entries.firstOrNull { it.key == source } ?: FireReturnSource.PRUDENTE, history.toDomain(), historyReal, clamped, high,
    )
}

@Serializable
private data class BaseDto(
    val currency: String = "EUR",
    val wealth: WealthDto,
    val cashflow: AnalyticsBase.Cashflow,
    val positions: List<AnalyticsBase.Position> = emptyList(),
    val growthPoints: List<AnalyticsBase.GrowthPoint> = emptyList(),
    val risk: AnalyticsBase.Risk? = null,
    val riskContribution: List<AnalyticsBase.RiskContribution>? = null,
    val names: Map<String, String> = emptyMap(),
    val historicalReturn: HistoryDto,
)

@Serializable
private data class AnalyticsViewDto(
    val currency: String = "EUR",
    val today: String,
    val walkthroughSeen: Boolean = false,
    val storedAssumptions: AssumptionsDto,
    val assumptions: AssumptionsDto,
    val returnInfo: ReturnInfoDto,
    val base: BaseDto,
) {
    fun toDomain() = AnalyticsView(
        currency, today, walkthroughSeen, storedAssumptions.toDomain(), assumptions.toDomain(), returnInfo.toDomain(),
        AnalyticsBase(
            base.currency, FirePlanBase.Wealth(base.wealth.liquidity, base.wealth.investments, base.wealth.pension, base.wealth.debts),
            base.cashflow, base.positions, base.growthPoints, base.risk, base.riskContribution, base.names, base.historicalReturn.toDomain(),
        ),
    )
}

// MARK: - Partial update

/**
 * Body of `PUT /api/analytics/assumptions`: only the fields being changed, `null` values are JSON `null` (back to the
 * data). Same builders on iOS (`AnalyticsAssumptionsPatch`).
 */
data class AnalyticsAssumptionsPatch(val values: Map<String, Value> = emptyMap()) {
    sealed interface Value {
        data class Number(val value: Double) : Value
        data object Null : Value
        data class Bool(val value: Boolean) : Value
        data class Text(val value: String) : Value
        data class Period(val value: DataPeriod) : Value
        data class Pension(val value: MonteCarloPublicPension?) : Value
        data class Ters(val value: Map<String, Double>) : Value
    }

    operator fun get(key: String): Value? = values[key]
    fun with(key: String, value: Value?): AnalyticsAssumptionsPatch =
        AnalyticsAssumptionsPatch(if (value == null) values - key else values + (key to value))

    val isEmpty: Boolean get() = values.isEmpty()
    val keys: List<String> get() = values.keys.sorted()

    /** JSON object for the request body. */
    fun toJson(): JsonObject = JsonObject(values.toSortedMap().mapValues { (_, v) -> v.json() })

    private fun Value.json(): JsonElement = when (this) {
        is Value.Number -> JsonPrimitive(value)
        Value.Null -> JsonNull
        is Value.Bool -> JsonPrimitive(value)
        is Value.Text -> JsonPrimitive(value)
        is Value.Period -> when (val p = value) {
            is DataPeriod.Ultimi -> buildJsonObject { put("kind", "ultimi"); put("months", p.months) }
            is DataPeriod.Personalizzato -> buildJsonObject { put("kind", "personalizzato"); put("from", p.from); put("to", p.to) }
        }
        is Value.Pension -> value?.let { p -> buildJsonObject { put("annual", p.annual); put("startsAfterYears", p.startsAfterYears) } } ?: JsonNull
        is Value.Ters -> JsonObject(value.toSortedMap().mapValues { JsonPrimitive(it.value) })
    }

    companion object {
        /** ANA-019: the slider values tried («Salva queste ipotesi»). */
        fun scenario(o: FireScenarioOverrides): AnalyticsAssumptionsPatch {
            var p = AnalyticsAssumptionsPatch()
            o.annualSavings?.let { p = p.with("annualSavings", Value.Number(it)) }
            o.annualSpending?.let { p = p.with("annualSpending", Value.Number(it)) }
            o.expectedReturn?.let { p = p.with("expectedReturn", Value.Number(it)) }
            o.withdrawalRate?.let { p = p.with("withdrawalRate", Value.Number(it)) }
            return p
        }

        /** ANA-016: back to the figure derived from the data (`annualSavings: null` / `annualSpending: null`). */
        fun useData(field: FireScenarioField) = AnalyticsAssumptionsPatch(mapOf(field.key to Value.Null))

        /** ANA-016: the return goes back to the history (`expectedReturnAuto: true`). */
        val useHistoryReturn get() = AnalyticsAssumptionsPatch(mapOf("expectedReturnAuto" to Value.Bool(true)))

        /** ANA-011. */
        fun period(period: DataPeriod) = AnalyticsAssumptionsPatch(mapOf("dataPeriod" to Value.Period(period)))

        /** ANA-031. */
        fun ters(ters: Map<String, Double>) = AnalyticsAssumptionsPatch(mapOf("terByInstrument" to Value.Ters(ters)))

        /** ANA-008: «Il tuo traguardo» (null = linked to the data). */
        fun annualSpending(value: Double?) =
            AnalyticsAssumptionsPatch(mapOf("annualSpending" to (value?.let { Value.Number(it) } ?: Value.Null)))
    }
}

class AnalyticsApi(private val client: ApiClient) {
    /** ANA-002: `GET /api/analytics/base?today=` (403 `country_feature_unavailable` for DE, ANA-001). */
    suspend fun base(today: String): AnalyticsView = decodeView(client.send("api/analytics/base", "GET", query = mapOf("today" to today)).text)

    /** `PUT /api/analytics/assumptions` (partial); refetch the base afterwards. */
    suspend fun update(patch: AnalyticsAssumptionsPatch) {
        client.send("api/analytics/assumptions", "PUT", body = patch.toJson().toString())
    }

    /** ANA-005: `POST /api/analytics/walkthrough` (204). */
    suspend fun markWalkthroughSeen() = client.sendNoContent("api/analytics/walkthrough", "POST")

    companion object {
        fun decodeView(text: String): AnalyticsView = ApiClient.DefaultJson.decodeFromString(AnalyticsViewDto.serializer(), text).toDomain()
    }
}
