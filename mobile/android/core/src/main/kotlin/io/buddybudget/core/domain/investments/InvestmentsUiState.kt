package io.buddybudget.core.domain.investments

import io.buddybudget.core.data.InvestmentsView

/** What a view-gated tab shows (INV-010). Same cases as `InvestmentsGate` on iOS. */
enum class InvestmentsGate {
    Loading, Failed, EmptyFiltered, Empty, Content;

    companion object {
        fun of(loaded: Boolean, failed: Boolean, hasTransactions: Boolean, hasCash: Boolean, countsCash: Boolean, brokersFiltered: Boolean): InvestmentsGate {
            if (!loaded) return if (failed) Failed else Loading
            if (hasTransactions || (countsCash && hasCash)) return Content
            return if (brokersFiltered) EmptyFiltered else Empty
        }
    }
}

/** Everything the Investimenti frame and its tabs render. Same fields as `InvestmentsUiState` on iOS. */
data class InvestmentsUiState(
    val tab: InvestmentsTab = InvestmentsTab.Portfolio,
    val visibleTabs: List<InvestmentsTab> = InvestmentsTab.entries,
    val period: InvestmentsPeriod = InvestmentsPeriod.Default,
    val customRange: ChartRange,
    val performancePeriod: InvestmentsPeriod = InvestmentsPeriod.Default,
    val performanceCustomRange: ChartRange,
    /** INV-009: broker groups removed from the numbers (view-only, reset when leaving the section). */
    val excludedBrokers: Set<String> = emptySet(),
    /** INV-018 switches (off = recorded values). */
    val reinvestFees: Boolean = false,
    val reinvestTaxes: Boolean = false,
    val today: String,
) {
    val portfolioQuery: InvestmentsQuery get() = InvestmentsQuery.make(period, customRange, today, excludedBrokers)
    val baseQuery: InvestmentsQuery get() = InvestmentsQuery.make(InvestmentsPeriod.Default, customRange, today, excludedBrokers)

    fun performanceQuery(selection: ChartRange?): InvestmentsQuery =
        InvestmentsQuery.make(performancePeriod, performanceCustomRange, today, excludedBrokers, selection)

    val simulating: Boolean get() = reinvestFees || reinvestTaxes
    val simulationCount: Int get() = (if (reinvestFees) 1 else 0) + (if (reinvestTaxes) 1 else 0)

    /** «Tutti i broker» or «Broker: {0} di {1}». */
    fun brokerChip(brokers: List<InvestmentsView.Broker>): Pair<String, Map<String, String>> {
        val enabled = brokers.count { it.id !in excludedBrokers }
        return if (enabled < brokers.size) "Broker: {0} di {1}" to mapOf("0" to enabled.toString(), "1" to brokers.size.toString())
        else "Tutti i broker" to emptyMap()
    }

    companion object {
        fun initial(today: String) = InvestmentsUiState(
            customRange = InvestmentsRules.defaultCustomRange(today), performanceCustomRange = InvestmentsRules.defaultCustomRange(today), today = today,
        )
    }
}

/** Hero of Portafoglio with the cost simulation applied (INV-011, INV-018). */
data class PortfolioHero(
    val value: Double,
    val simulating: Boolean,
    val extra: Double,
    val values: List<Double>,
    val registered: List<Double>?,
    val invested: List<Double>,
    val showsDayChange: Boolean,
) {
    companion object {
        fun of(view: InvestmentsView, reinvestFees: Boolean, reinvestTaxes: Boolean): PortfolioHero {
            val recorded = view.series.map { it.value }
            val active = (reinvestFees || reinvestTaxes) && view.costImpact.available
            val scenario = if (active) InvestmentsRules.costScenario(view.costScenarios, reinvestFees, reinvestTaxes) else null
            val simulating = scenario != null
            val values = scenario?.let { if (it.series.size == recorded.size) it.series else recorded } ?: recorded
            return PortfolioHero(
                value = scenario?.value ?: view.summary.totalValue, simulating = simulating, extra = scenario?.extra ?: 0.0, values = values,
                registered = if (simulating) recorded else null, invested = view.series.map { it.invested },
                showsDayChange = !simulating && view.summary.dayChange != null && view.summary.dayChangePct != null,
            )
        }
    }
}

object RiskCopy {
    const val MIN_OBSERVATIONS = 20
    const val SHARPE_OBSERVATIONS = 60

    fun sharpeWord(level: String?): String? = when (level) {
        "negativo" -> "No"
        "basso" -> "Poco"
        "discreto" -> "Discreto"
        "buono" -> "Bene"
        else -> null
    }
}
