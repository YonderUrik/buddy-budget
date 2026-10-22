package io.buddybudget.core.domain.fire

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.DataPeriod

// Port of lib/analitiche/{assumptions (constants), plan, scenario, simulation, historical-return (resolveExpectedReturn)}.ts.
// The assumptions are stored and merged by the server (GET/PATCH /api/analytics/assumptions); the base comes from
// GET /api/analytics/base. Mobile re-runs the plan on every slider move. Same API as the Swift FirePlanning.

/** `AnalyticsAssumptions`. Ratios are fractions (0.04 = 4%); null amounts = derive from the user's data. */
data class FireAssumptions(
    val withdrawalRate: Double,
    val dataPeriod: DataPeriod,
    val annualSpending: Double?,
    val annualSavings: Double?,
    val expectedReturn: Double,
    val expectedReturnAuto: Boolean,
    val volatility: Double,
    val inflation: Double,
    val retirementYears: Double,
    val rule: WithdrawalRule,
    val includePensionFunds: Boolean,
    val includeLatentTax: Boolean,
    val publicPension: MonteCarloPublicPension?,
    val terByInstrument: Map<String, Double>,
) {
    companion object {
        /** `DEFAULT_ASSUMPTIONS`. */
        val defaults = FireAssumptions(
            withdrawalRate = 0.035, dataPeriod = DataPeriod.Ultimi(12), annualSpending = null, annualSavings = null,
            expectedReturn = 0.04, expectedReturnAuto = true, volatility = 0.12, inflation = 0.02, retirementYears = 40.0,
            rule = WithdrawalRule.FISSA, includePensionFunds = false, includeLatentTax = true, publicPension = null,
            terByInstrument = emptyMap(),
        )
    }
}

/** A min/max bound of [FireAssumptionLimits]. */
data class FireLimit(val min: Double, val max: Double)

/** `ASSUMPTION_LIMITS`. */
object FireAssumptionLimits {
    val withdrawalRate = FireLimit(0.01, 0.1)
    val expectedReturn = FireLimit(-0.02, 0.5)
    val volatility = FireLimit(0.0, 0.6)
    val inflation = FireLimit(-0.02, 0.15)
    val retirementYears = FireLimit(5.0, 70.0)
    val amount = FireLimit(0.0, 1e8)
    val ter = FireLimit(0.0, 0.05)
}

/** The part of `AnalyticsBase` (GET /api/analytics/base) that `resolvePlan` reads. */
data class FirePlanBase(val wealth: Wealth, val cashflow: Cashflow, val positions: List<FireLiquidationPosition>) {
    data class Wealth(val liquidity: Double, val investments: Double, val pension: Double, val debts: Double)
    data class Cashflow(val annualSpending: Double, val annualSavings: Double, val monthsWithData: Int)
}

/** Where a figure comes from (`FigureSource`). */
enum class FireFigureSource(val key: String) { IPOTESI("ipotesi"), DATI("dati"), MANCA("manca") }

data class FireCoastPoint(val years: Double, val number: Double)

/** `AnalyticsPlan`. */
data class FirePlan(
    val spending: Double?,
    val spendingSource: FireFigureSource,
    val savings: Double?,
    val savingsSource: FireFigureSource,
    val wealth: Double,
    val liquidation: FireLiquidationResult,
    val taxShare: Double,
    val fireNumberGross: Double?,
    val target: Double?,
    val progress: Double?,
    val yearsToFire: Double?,
    val coast: List<FireCoastPoint>,
)

/** The four assumptions moved by the "e se…" sliders (`ScenarioField`). */
enum class FireScenarioField(val key: String) {
    ANNUAL_SAVINGS("annualSavings"),
    ANNUAL_SPENDING("annualSpending"),
    EXPECTED_RETURN("expectedReturn"),
    WITHDRAWAL_RATE("withdrawalRate"),
    ;

    companion object {
        fun fromKey(key: String): FireScenarioField? = entries.firstOrNull { it.key == key }
    }
}

/** Slider values being tried (`ScenarioOverrides`); null = untouched. */
data class FireScenarioOverrides(
    val annualSavings: Double? = null,
    val annualSpending: Double? = null,
    val expectedReturn: Double? = null,
    val withdrawalRate: Double? = null,
)

/** Slider bounds and step (`SliderSpec`). */
data class FireSliderSpec(val min: Double, val max: Double, val step: Double)

/** When retirement starts in the simulation (`RetireAt`). */
enum class FireRetireAt(val key: String) { OGGI("oggi"), FIRE("fire") }

/** `HistoricalReturnResult` (computed by the server, input of `resolveExpectedReturn`). */
sealed interface FireHistoricalReturnResult {
    data class Ok(
        val months: Int,
        val shorterThanPeriod: Boolean,
        val fromKey: String,
        val toKey: String,
        val nominal: Double,
        val real: Double?,
    ) : FireHistoricalReturnResult

    /** `reason`: nessun-investimento | storico-breve | periodo-breve | patrimonio-basso | prezzi-mancanti. */
    data class Manca(val reason: String) : FireHistoricalReturnResult
}

/** `ReturnSource`. */
enum class FireReturnSource(val key: String) { STORICO("storico"), PRUDENTE("prudente"), MANUALE("manuale") }

/** `ExpectedReturnInfo`. */
data class FireExpectedReturnInfo(
    val value: Double,
    val source: FireReturnSource,
    val history: FireHistoricalReturnResult,
    val historyReal: Double?,
    val clamped: Boolean,
    val high: Boolean,
)

object FirePlanning {
    /** `COAST_HORIZONS`. */
    val coastHorizons: List<Double> = listOf(10.0, 15.0, 20.0, 25.0, 30.0)
    /** `MIN_MONTHS_FOR_CASHFLOW`. */
    const val minMonthsForCashflow = 3
    /** `HIGH_RETURN_WARNING`. */
    const val highReturnWarning = 0.08
    private const val maxAccumulationYears = 40.0
    private const val moneyStep = 100.0
    private const val moneyMinCeiling = 12_000.0
    private const val percentStep = 0.001
    private val withdrawalRange = FireLimit(0.02, 0.06)

    /** Yearly spending and savings from the period's movements; null when too few months have data. */
    fun cashflowFromData(base: FirePlanBase): Pair<Double?, Double?> {
        val enough = base.cashflow.monthsWithData >= minMonthsForCashflow
        return Pair(
            if (enough && base.cashflow.annualSpending > 0) base.cashflow.annualSpending else null,
            if (enough) base.cashflow.annualSavings else null,
        )
    }

    /** Applies the assumptions to the data. */
    fun resolvePlan(base: FirePlanBase, a: FireAssumptions): FirePlan {
        val (dataSpending, dataSavings) = cashflowFromData(base)
        val spending = a.annualSpending ?: dataSpending
        val savings = a.annualSavings ?: dataSavings

        val wealth = base.wealth.liquidity + base.wealth.investments + (if (a.includePensionFunds) base.wealth.pension else 0.0)
        val liquidation = FireCalc.computeLiquidation(base.positions)
        val taxShare = if (a.includeLatentTax && wealth > 0) Math.min(liquidation.latentTax / wealth, 0.99) else 0.0

        val gross = spending?.let { FireCalc.fireNumber(it, a.withdrawalRate) }
        val target = gross?.let { FireCalc.fireNumberAfterTax(it, taxShare) }
        val growth = FireGrowthInput(wealth, savings ?: 0.0, a.expectedReturn)
        return FirePlan(
            spending = spending,
            spendingSource = when {
                a.annualSpending != null -> FireFigureSource.IPOTESI
                dataSpending != null -> FireFigureSource.DATI
                else -> FireFigureSource.MANCA
            },
            savings = savings,
            savingsSource = when {
                a.annualSavings != null -> FireFigureSource.IPOTESI
                dataSavings != null -> FireFigureSource.DATI
                else -> FireFigureSource.MANCA
            },
            wealth = wealth,
            liquidation = liquidation,
            taxShare = taxShare,
            fireNumberGross = gross,
            target = target,
            progress = target?.let { if (it > 0) wealth / it else null },
            yearsToFire = target?.let { FireCalc.yearsToTarget(growth, it) },
            coast = target?.let { t -> coastHorizons.map { FireCoastPoint(it, FireCalc.coastNumber(t, a.expectedReturn, it)) } } ?: emptyList(),
        )
    }

    private fun roundUp(v: Double, to: Double) = Math.ceil(v / to) * to
    private fun roundDown(v: Double, to: Double) = Math.floor(v / to) * to

    /** Slider of an assumption given its starting value; null when the figure is missing. */
    fun scenarioSlider(field: FireScenarioField, baseline: Double?): FireSliderSpec? = when (field) {
        FireScenarioField.EXPECTED_RETURN ->
            FireSliderSpec(FireAssumptionLimits.expectedReturn.min, FireAssumptionLimits.expectedReturn.max, percentStep)
        FireScenarioField.WITHDRAWAL_RATE -> FireSliderSpec(withdrawalRange.min, withdrawalRange.max, percentStep)
        FireScenarioField.ANNUAL_SPENDING -> baseline?.let {
            FireSliderSpec(0.0, roundUp(Math.max(it * 2, moneyMinCeiling), moneyStep * 5), moneyStep)
        }
        FireScenarioField.ANNUAL_SAVINGS -> baseline?.let {
            FireSliderSpec(
                if (it < 0) roundDown(it * 2, moneyStep * 5) else 0.0,
                roundUp(Math.max(Math.abs(it) * 2, moneyMinCeiling), moneyStep * 5),
                moneyStep,
            )
        }
    }

    /** Assumptions with the slider values on top. */
    fun applyScenario(assumptions: FireAssumptions, overrides: FireScenarioOverrides): FireAssumptions = assumptions.copy(
        annualSavings = overrides.annualSavings ?: assumptions.annualSavings,
        annualSpending = overrides.annualSpending ?: assumptions.annualSpending,
        expectedReturn = overrides.expectedReturn ?: assumptions.expectedReturn,
        withdrawalRate = overrides.withdrawalRate ?: assumptions.withdrawalRate,
    )

    /** True when at least one slider moved. */
    fun hasScenario(overrides: FireScenarioOverrides): Boolean =
        overrides.annualSavings != null || overrides.annualSpending != null || overrides.expectedReturn != null || overrides.withdrawalRate != null

    /** Years to FIRE with some assumptions changed, wealth and latent tax share unchanged. */
    fun yearsToFireWith(plan: FirePlan, assumptions: FireAssumptions, overrides: FireScenarioOverrides): Double? {
        val spending = overrides.annualSpending ?: plan.spending ?: return null
        val gross = FireCalc.fireNumber(spending, overrides.withdrawalRate ?: assumptions.withdrawalRate)
        val target = gross?.let { FireCalc.fireNumberAfterTax(it, plan.taxShare) } ?: return null
        return FireCalc.yearsToTarget(
            FireGrowthInput(plan.wealth, overrides.annualSavings ?: plan.savings ?: 0.0, overrides.expectedReturn ?: assumptions.expectedReturn),
            target,
        )
    }

    /** Simulation input from the assumptions and the plan; null when spending is missing. */
    fun buildSimulationInput(plan: FirePlan, a: FireAssumptions, retireAt: FireRetireAt, rule: WithdrawalRule = a.rule): MonteCarloInput? {
        val spending = plan.spending
        if (spending == null || spending <= 0) return null
        val years = plan.yearsToFire
        val accumulationYears = if (retireAt == FireRetireAt.FIRE && years != null) Math.min(Math.ceil(years), maxAccumulationYears) else 0.0
        return MonteCarloInput(
            startingWealth = Math.max(0.0, plan.wealth),
            annualSavings = Math.max(0.0, plan.savings ?: 0.0),
            accumulationYears = accumulationYears,
            retirementYears = a.retirementYears,
            annualSpending = spending,
            expectedReturn = a.expectedReturn,
            volatility = a.volatility,
            inflation = a.inflation,
            rule = rule,
            publicPension = a.publicPension,
        )
    }

    /** Real yearly return of the history: observed inflation if any, otherwise the assumed one. */
    fun historyRealReturn(history: FireHistoricalReturnResult.Ok, assumedInflation: Double): Double =
        history.real ?: ((1 + history.nominal) / (1 + assumedInflation) - 1)

    /** Return to use: the user's, or (auto) the clamped real return of the history, else the prudent default. */
    fun resolveExpectedReturn(a: FireAssumptions, history: FireHistoricalReturnResult): FireExpectedReturnInfo {
        val lim = FireAssumptionLimits.expectedReturn
        val historyReal = (history as? FireHistoricalReturnResult.Ok)?.let { historyRealReturn(it, a.inflation) }
        val fromHistory = historyReal?.let { Math.min(Math.max(it, lim.min), lim.max) }
        val value: Double
        val source: FireReturnSource
        var clamped = false
        if (!a.expectedReturnAuto) {
            value = a.expectedReturn
            source = FireReturnSource.MANUALE
        } else if (fromHistory == null) {
            value = FireAssumptions.defaults.expectedReturn
            source = FireReturnSource.PRUDENTE
        } else {
            value = JSNumber.round(fromHistory * 1000) / 1000
            source = FireReturnSource.STORICO
            clamped = fromHistory != historyReal
        }
        return FireExpectedReturnInfo(value, source, history, historyReal, clamped, value > highReturnWarning)
    }

    /** Assumptions with the return actually used. */
    fun withExpectedReturn(a: FireAssumptions, info: FireExpectedReturnInfo): FireAssumptions =
        if (info.value == a.expectedReturn) a else a.copy(expectedReturn = info.value)
}
