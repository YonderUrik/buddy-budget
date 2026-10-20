package io.buddybudget.core.domain.fire

// Port of lib/calc/fire.ts, lib/calc/growth-split.ts and lib/calc/liquidation.ts (domain/fire-and-simulations.md).
// All values are real (today's euros). Same names and operation order as the web; StrictMath = V8's fdlibm.

/** Growth with constant yearly savings, in real terms (`GrowthInput`). */
data class FireGrowthInput(val current: Double, val annualSaving: Double, val realReturn: Double)

/** One cell of a sensitivity table (`SensitivityCell`). */
data class FireSensitivityCell(val rowValue: Double, val columnValue: Double, val years: Double?)

/** `GrowthSplitPoint`: month-end net worth and the month's savings (income − expenses). */
data class FireGrowthSplitPoint(val month: String, val netWorth: Double, val savings: Double)

data class FireGrowthSplitRow(
    val month: String,
    val netWorth: Double,
    val savings: Double,
    val delta: Double,
    val fromSavings: Double,
    val fromMarket: Double,
)

data class FireGrowthSplit(
    val rows: List<FireGrowthSplitRow>,
    val totalDelta: Double,
    val totalFromSavings: Double,
    val totalFromMarket: Double,
    /** null when total growth is zero or negative. */
    val savingsShare: Double?,
)

/** `LiquidationPosition`; `taxRate` is the effective rate (0.26 or 0.125). */
data class FireLiquidationPosition(val id: String, val name: String, val value: Double, val unrealizedGain: Double, val taxRate: Double)

data class FireLiquidationTax(val id: String, val name: String, val tax: Double)

/** `LiquidationResult`. */
data class FireLiquidationResult(
    val latentTax: Double,
    val grossValue: Double,
    val netValue: Double,
    val taxRatio: Double?,
    val byPosition: List<FireLiquidationTax>,
)

object FireCalc {
    /** `MAX_PLANNING_YEARS`: beyond this the result is "never". */
    const val maxPlanningYears: Double = 80.0

    /** Capital needed so that withdrawing `withdrawalRate` per year covers the yearly spending. */
    fun fireNumber(annualSpending: Double, withdrawalRate: Double): Double? {
        if (!(annualSpending >= 0) || !(withdrawalRate > 0)) return null
        return annualSpending / withdrawalRate
    }

    /** FIRE number grossed up for the tax share of every withdrawn euro. */
    fun fireNumberAfterTax(grossNumber: Double, taxShare: Double): Double? {
        if (!(taxShare >= 0) || taxShare >= 1) return null
        return grossNumber / (1 - taxShare)
    }

    /** Wealth after `years` years, savings paid at year end. */
    fun wealthAfterYears(input: FireGrowthInput, years: Double): Double {
        if (years <= 0) return input.current
        if (Math.abs(input.realReturn) < 1e-12) return input.current + input.annualSaving * years
        val growth = StrictMath.pow(1 + input.realReturn, years)
        return input.current * growth + (input.annualSaving * (growth - 1)) / input.realReturn
    }

    /** Years (fractional) to reach `target`; 0 if already there, null if never or beyond [maxPlanningYears]. */
    fun yearsToTarget(input: FireGrowthInput, target: Double): Double? {
        val (current, annualSaving, realReturn) = input
        if (current >= target) return 0.0
        val years: Double
        if (Math.abs(realReturn) < 1e-12) {
            if (annualSaving <= 0) return null
            years = (target - current) / annualSaving
        } else {
            val top = target * realReturn + annualSaving
            val bottom = current * realReturn + annualSaving
            if (!(top > 0) || !(bottom > 0)) return null
            years = StrictMath.log(top / bottom) / StrictMath.log(1 + realReturn)
        }
        if (!years.isFinite() || years < 0 || years > maxPlanningYears) return null
        return years
    }

    /** Wealth that today reaches `target` in `years` years with the real return only. */
    fun coastNumber(target: Double, realReturn: Double, years: Double): Double {
        if (years <= 0) return target
        return target / StrictMath.pow(1 + realReturn, years)
    }

    /** Lean spending: required (Dovute) + occasional (Saltuarie). */
    fun leanSpending(dovuta: Double, saltuaria: Double): Double = dovuta + saltuaria

    /** Years to FIRE by withdrawal rate (rows) × real return (columns). */
    fun sensitivityByRateAndReturn(
        annualSpending: Double,
        current: Double,
        annualSaving: Double,
        withdrawalRates: List<Double>,
        realReturns: List<Double>,
    ): List<List<FireSensitivityCell>> = withdrawalRates.map { rate ->
        realReturns.map { realReturn ->
            val target = fireNumber(annualSpending, rate)
            FireSensitivityCell(
                rowValue = rate,
                columnValue = realReturn,
                years = target?.let { yearsToTarget(FireGrowthInput(current, annualSaving, realReturn), it) },
            )
        }
    }

    /** Years to FIRE by relative spending change (rows) × relative saving change (columns). */
    fun sensitivityBySpendingAndSaving(
        annualSpending: Double,
        withdrawalRate: Double,
        realReturn: Double,
        current: Double,
        annualSaving: Double,
        spendingChanges: List<Double>,
        savingChanges: List<Double>,
    ): List<List<FireSensitivityCell>> = spendingChanges.map { spendingChange ->
        savingChanges.map { savingChange ->
            val spending = annualSpending * (1 + spendingChange)
            val target = fireNumber(spending, withdrawalRate)
            val saving = annualSaving * (1 + savingChange) - (spending - annualSpending)
            FireSensitivityCell(
                rowValue = spendingChange,
                columnValue = savingChange,
                years = target?.let { yearsToTarget(FireGrowthInput(current, saving, realReturn), it) },
            )
        }
    }

    /** Share of income not spent; null without income. */
    fun savingsRate(income: Double, expenses: Double): Double? = if (income > 0) (income - expenses) / income else null

    /** Months of spending covered by `amount`; null when monthly spending is zero. */
    fun monthsOfCoverage(amount: Double, monthlySpending: Double): Double? =
        if (monthlySpending > 0) amount / monthlySpending else null

    /** Splits each month's net-worth change into savings and market/other. The first point is the start. */
    fun splitGrowth(points: List<FireGrowthSplitPoint>): FireGrowthSplit {
        val rows = (1 until points.size).map { i ->
            val delta = points[i].netWorth - points[i - 1].netWorth
            FireGrowthSplitRow(points[i].month, points[i].netWorth, points[i].savings, delta, points[i].savings, delta - points[i].savings)
        }
        val totalDelta = rows.fold(0.0) { s, r -> s + r.delta }
        val totalFromSavings = rows.fold(0.0) { s, r -> s + r.fromSavings }
        return FireGrowthSplit(
            rows = rows,
            totalDelta = totalDelta,
            totalFromSavings = totalFromSavings,
            totalFromMarket = totalDelta - totalFromSavings,
            savingsShare = if (totalDelta > 0) totalFromSavings / totalDelta else null,
        )
    }

    /** Latent tax if everything were sold today (gains only), sorted by tax descending (stable). */
    fun computeLiquidation(positions: List<FireLiquidationPosition>): FireLiquidationResult {
        val byPosition = positions
            .map { FireLiquidationTax(it.id, it.name, Math.max(0.0, it.unrealizedGain) * it.taxRate) }
            .filter { it.tax > 0 }
            .sortedWith { a, b -> b.tax.compareTo(a.tax) }
        val latentTax = byPosition.fold(0.0) { s, p -> s + p.tax }
        val grossValue = positions.fold(0.0) { s, p -> s + p.value }
        return FireLiquidationResult(
            latentTax = latentTax,
            grossValue = grossValue,
            netValue = grossValue - latentTax,
            taxRatio = if (grossValue > 0) latentTax / grossValue else null,
            byPosition = byPosition,
        )
    }
}
