package io.buddybudget.core.domain.pension

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.Periods

/** Fiscal parameters of the Italian supplementary pension (web `PENSION_TAX_RULES`, lib/calc/pension.ts). */
object PensionTaxRules {
    const val VALID_FROM_YEAR = 2026
    const val EXIT_BASE_RATE = 0.15
    const val EXIT_REDUCTION_AFTER_YEARS = 15
    const val EXIT_REDUCTION_PER_YEAR = 0.003
    const val EXIT_MIN_RATE = 0.09
    const val EXIT_OTHER_REASONS_RATE = 0.23
}

enum class PensionWithdrawalReason(val key: String) { PENSIONAMENTO("pensionamento"), SANITARIE("sanitarie"), ALTRI("altri") }

data class PensionWithdrawalScenario(
    val reason: PensionWithdrawalReason,
    val rate: Double,
    /** Prudent net: tax on the whole value. */
    val netLow: Double,
    /** Expected net: tax on contributions only. */
    val netHigh: Double,
)

data class PensionExitTaxMilestones(val reductionStartsOn: String, val minRateOn: String)

data class PensionProjectionRates(val prudent: Double, val base: Double, val optimistic: Double)

data class PensionProjectionPoint(val year: Int, val prudent: Double, val base: Double, val optimistic: Double)

/** Client-side pension maths (exit-tax slider, projection sliders), ported 1:1 from lib/calc/pension.ts. Same as Swift `PensionCalc`. */
object PensionCalc {
    /** Years after which the exit rate reaches its floor (end of the timeline). */
    const val EXIT_TAX_TIMELINE_YEARS = 35
    private const val MONTHS_PER_YEAR = 12
    private const val QUARTERS_PER_YEAR = 4

    /** Pension `addMonths`: clamped month arithmetic on `YYYY-MM-DD`. */
    fun addMonths(key: String, months: Int): String = CalendarDate.parse(key)?.plusMonthsClamped(months)?.iso ?: key

    /** Exit tax rate (contributions since 2007) after [years] years of participation. */
    fun exitTaxRate(years: Double): Double {
        val reduction = maxOf(0.0, years - PensionTaxRules.EXIT_REDUCTION_AFTER_YEARS) * PensionTaxRules.EXIT_REDUCTION_PER_YEAR
        return maxOf(PensionTaxRules.EXIT_MIN_RATE, PensionTaxRules.EXIT_BASE_RATE - reduction)
    }

    fun exitTaxMilestones(adhesionDate: String): PensionExitTaxMilestones {
        val r = PensionTaxRules
        val yearsToMin = r.EXIT_REDUCTION_AFTER_YEARS +
            JSNumber.round((r.EXIT_BASE_RATE - r.EXIT_MIN_RATE) / r.EXIT_REDUCTION_PER_YEAR).toInt()
        return PensionExitTaxMilestones(
            reductionStartsOn = addMonths(adhesionDate, r.EXIT_REDUCTION_AFTER_YEARS * MONTHS_PER_YEAR),
            minRateOn = addMonths(adhesionDate, yearsToMin * MONTHS_PER_YEAR),
        )
    }

    /** Estimated net if withdrawn today in three scenarios; [yearsOverride] drives the rate-simulation slider. */
    fun withdrawalScenarios(
        value: Double,
        netContributions: Double,
        adhesionDate: String?,
        today: String,
        yearsOverride: Double? = null,
    ): List<PensionWithdrawalScenario> {
        val years = yearsOverride ?: adhesionDate?.let { Periods.wholeYearsBetween(it, today).toDouble() } ?: 0.0
        val reduced = exitTaxRate(years)
        val base = minOf(value, maxOf(0.0, netContributions))
        fun make(reason: PensionWithdrawalReason, rate: Double) =
            PensionWithdrawalScenario(reason, rate, netLow = value - rate * maxOf(0.0, value), netHigh = value - rate * base)
        return listOf(
            make(PensionWithdrawalReason.PENSIONAMENTO, reduced),
            make(PensionWithdrawalReason.SANITARIE, reduced),
            make(PensionWithdrawalReason.ALTRI, PensionTaxRules.EXIT_OTHER_REASONS_RATE),
        )
    }

    /** Projection in today's euros: start value plus a constant quarterly contribution, real returns in 3 scenarios. */
    fun projectPension(startValue: Double, quarterlyContribution: Double, years: Double, rates: PensionProjectionRates): List<PensionProjectionPoint> {
        val total = maxOf(0.0, JSNumber.round(years)).toInt()
        var prudent = startValue
        var base = startValue
        var optimistic = startValue
        val exponent = 1.0 / QUARTERS_PER_YEAR
        val points = mutableListOf(PensionProjectionPoint(0, prudent, base, optimistic))
        for (year in 1..total) {
            repeat(QUARTERS_PER_YEAR) {
                prudent = prudent * StrictMath.pow(1 + rates.prudent, exponent) + quarterlyContribution
                base = base * StrictMath.pow(1 + rates.base, exponent) + quarterlyContribution
                optimistic = optimistic * StrictMath.pow(1 + rates.optimistic, exponent) + quarterlyContribution
            }
            points += PensionProjectionPoint(year, prudent, base, optimistic)
        }
        return points
    }
}
