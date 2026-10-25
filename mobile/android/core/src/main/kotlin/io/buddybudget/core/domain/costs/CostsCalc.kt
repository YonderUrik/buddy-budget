package io.buddybudget.core.domain.costs

// Port of lib/calc/costs.ts (domain/costs.md): recurring portfolio costs (user-entered TER + stamp duty) and their drag.

/** `CostPosition`; `ter` is a yearly fraction (0.002 = 0.20%), null when not entered. */
data class CostPosition(val id: String, val name: String, val value: Double, val ter: Double?, val subjectToBollo: Boolean)

/** `CostRow`. */
data class CostRow(
    val id: String,
    val name: String,
    val value: Double,
    val terCost: Double,
    val bolloCost: Double,
    val total: Double,
    val pct: Double,
)

/** `CostSummary`. */
data class CostSummary(
    val rows: List<CostRow>,
    val totalValue: Double,
    val annualCost: Double,
    val annualPct: Double?,
    val missingTerValue: Double,
    /** The user's country charges a yearly stamp duty on securities (Italy's bollo): texts name it only then (#465). */
    val stampDuty: Boolean = true,
)

/** `CostDragPoint`. */
data class CostDragPoint(val year: Int, val withoutCosts: Double, val withCosts: Double, val lost: Double)

class UnsupportedCostCountryException(country: String) : IllegalArgumentException("Unsupported investment-cost country $country")

object CostsCalc {
    /** `financialCountry(country).investmentCosts.annualStampDutyRate` (IT 0.2%, DE and OTHER 0). */
    fun annualStampDutyRate(productCountry: String): Double? = when (productCountry) {
        "IT" -> 0.002
        "DE", "OTHER" -> 0.0
        else -> null
    }

    /** Yearly cost per position (TER × value + stamp duty) and total, rows by total descending (stable). */
    fun summarizeCosts(positions: List<CostPosition>, productCountry: String): CostSummary {
        val stampDuty = annualStampDutyRate(productCountry) ?: throw UnsupportedCostCountryException(productCountry)
        val rows = positions
            .filter { it.value > 0 }
            .map { p ->
                val terCost = p.value * (p.ter ?: 0.0)
                val bolloCost = if (p.subjectToBollo) p.value * stampDuty else 0.0
                val total = terCost + bolloCost
                CostRow(p.id, p.name, p.value, terCost, bolloCost, total, total / p.value)
            }
            .sortedWith { a, b -> b.total.compareTo(a.total) }
        val totalValue = rows.fold(0.0) { s, r -> s + r.value }
        val annualCost = rows.fold(0.0) { s, r -> s + r.total }
        return CostSummary(
            rows = rows,
            totalValue = totalValue,
            annualCost = annualCost,
            annualPct = if (totalValue > 0) annualCost / totalValue else null,
            missingTerValue = positions.filter { it.value > 0 && it.ter == null }.fold(0.0) { s, p -> s + p.value },
            stampDuty = stampDuty > 0,
        )
    }

    /** How much costs erode wealth over `years` years (no contributions): same gross return with and without the cost. */
    fun costDrag(value: Double, grossReturn: Double, annualCostPct: Double, years: Int): List<CostDragPoint> =
        (0..years).map { year ->
            val withoutCosts = value * StrictMath.pow(1 + grossReturn, year.toDouble())
            val withCosts = value * StrictMath.pow(1 + grossReturn - annualCostPct, year.toDouble())
            CostDragPoint(year, withoutCosts, withCosts, withoutCosts - withCosts)
        }
}
