package io.buddybudget.core.domain.planningde

import io.buddybudget.core.data.PlanningPortfolio
import io.buddybudget.core.data.PlanningResults
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale

// What the German Tax and Income screens show (web `tax-editor.tsx`, `income-view.tsx`, `fields.tsx`), built from the
// server results, the instrument names and the edited plan. Bound to one language; `translate` maps a catalog key (the
// English source keys of this area) to its text (identity in tests). Same API on iOS.

/** A label / amount row (web `Result`); a null amount reads «More information needed» (PLAN-016). */
data class GermanPlanningRow(val id: String, val label: String, val value: String)

/** One option of a native picker (web `Choice`). */
data class GermanPlanningOption(val value: String, val label: String)

/** A fund / ETF to classify (PLAN-025). */
data class GermanFundRow(val id: String, val name: String)

/** A 2026 fund sale that takes prior gross advances (PLAN-025). */
data class GermanFundSaleRow(val id: String, val label: String)

/** One recorded-income year (PLAN-027). */
data class GermanIncomeYearView(val year: Int, val rows: List<GermanPlanningRow>)

/** One forecast payment, rendered as a card on phone (mobile adaptation of the web table, PLAN-028, PLAN-029). */
data class GermanForecastCard(
    val id: String,
    val date: String,
    val instrument: String,
    val gross: String,
    val net: String,
    /** The net amount is not computable (shown muted). */
    val netUnavailable: Boolean,
    /** `2026 rules scenario` flag (only with simulations). */
    val benchmark: Boolean,
)

/** External sources listed under «Rules and official sources» (PLAN-017). */
data class GermanPlanningSource(val label: String, val url: String)

class GermanPlanningText(val locale: BBLocale, val masked: Boolean = false, private val translate: (String) -> String) {
    companion object {
        const val CURRENCY = "EUR"

        /** Web `REASONS`. */
        val reasonKeys: Map<String, String> = mapOf(
            "currency" to "German tax estimates require portfolio currency EUR.",
            "history" to "Confirm complete acquisition history and custody accounts before calculating.",
            "classification" to "Confirm the fund tax classification using its documentation.",
            "fund-history" to "Confirm prior fund advances and any taxable advances received this year.",
            "legacy" to "Pre-2009 securities and pre-2018 fund lots need individual tax treatment.",
            "unsupported" to "This instrument or adjustment requires individual tax treatment.",
            "missing-lots" to "A sale has missing acquisition lots. Add the original purchases in the same custody account.",
            "invalid" to "An operation has missing or invalid amounts.",
        )

        /** Web `FUND_OPTIONS` labels. */
        val fundKindKeys: Map<String, String> = mapOf(
            "unknown" to "Not yet classified",
            "equity" to "Equity fund (30% exemption)",
            "mixed" to "Mixed fund (15% exemption)",
            "property" to "Property fund (60% exemption)",
            "foreign-property" to "Foreign property fund (80% exemption)",
            "other" to "Other fund (no exemption)",
        )

        val sources: List<GermanPlanningSource> = listOf(
            GermanPlanningSource("EStG §32d", "https://www.gesetze-im-internet.de/estg/__32d.html"),
            GermanPlanningSource("InvStG §18", "https://www.gesetze-im-internet.de/invstg_2018/__18.html"),
            GermanPlanningSource("InvStG §20", "https://www.gesetze-im-internet.de/invstg_2018/__20.html"),
            GermanPlanningSource("RWBestV 2026", "https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html"),
            GermanPlanningSource("EStG §23", "https://www.gesetze-im-internet.de/estg/__23.html"),
        )

        fun churchValue(rate: Double): String = if (rate == 0.08) "0.08" else if (rate == 0.09) "0.09" else "0"
        fun churchRate(value: String): Double = if (value == "0.08") 0.08 else if (value == "0.09") 0.09 else 0.0
    }

    fun tr(key: String): String = translate(key)

    /** Web `Amount`: EUR in the user's locale, `More information needed` for null (PLAN-016). */
    fun amount(value: Double?): String =
        if (value == null) tr("More information needed") else BBFormat.formatCurrency(value, CURRENCY, locale, masked = masked)

    fun date(iso: String): String = BBFormat.formatDateWithYear(iso, locale)

    // MARK: Inputs

    val assessmentOptions: List<GermanPlanningOption>
        get() = listOf(
            GermanPlanningOption("single", tr("Individual (€1,000 allowance)")),
            GermanPlanningOption("joint", tr("Joint (€2,000 allowance)")),
        )

    /** Stored values 0, 0.08, 0.09 as strings (`String(p.churchRate)` on the web). */
    val churchOptions: List<GermanPlanningOption>
        get() = listOf(
            GermanPlanningOption("0", tr("None")),
            GermanPlanningOption("0.08", tr("8%")),
            GermanPlanningOption("0.09", tr("9%")),
        )

    val fundOptions: List<GermanPlanningOption>
        get() = GermanFundKinds.all.map { GermanPlanningOption(it, tr(fundKindKeys[it] ?: it)) }

    // MARK: Tax (PLAN-021…026)

    /** PLAN-021: one line per issue, `{instrument}: {reason}` when instrument-specific. */
    fun issueLines(report: PlanningResults.TaxReport, portfolio: PlanningPortfolio?): List<String> = report.issues.map { issue ->
        val reason = tr(reasonKeys[issue.reason] ?: issue.reason)
        if (issue.instrumentId.isEmpty()) reason else "${portfolio?.name(issue.instrumentId) ?: ""}: $reason"
    }

    /**
     * PLAN-022, PLAN-023: the eight result rows; estimates are «More information needed» while issues exist, the recorded
     * taxes always show.
     */
    fun taxRows(report: PlanningResults.TaxReport): List<GermanPlanningRow> {
        val e = report.estimate
        return listOf(
            GermanPlanningRow("foreignCredit", tr("Foreign tax credit applied"), amount(e?.foreignCredit)),
            GermanPlanningRow("capitalTax", tr("Estimated capital income tax"), amount(e?.capitalTax)),
            GermanPlanningRow("solidarity", tr("Solidarity surcharge"), amount(e?.solidarity)),
            GermanPlanningRow("church", tr("Church tax"), amount(e?.church)),
            GermanPlanningRow("total", tr("Estimated total tax"), amount(e?.total)),
            GermanPlanningRow("recorded", tr("Recorded taxes (shown separately)"), amount(report.recordedTaxes)),
            GermanPlanningRow("shareLosses", tr("Remaining share losses"), amount(e?.remainingShareLosses)),
            GermanPlanningRow("generalLosses", tr("Remaining general losses"), amount(e?.remainingGeneralLosses)),
        )
    }

    /** PLAN-024: `{date} · {instrument}` and the taxable amount of each 2026 realised event. */
    fun realisedEvents(report: PlanningResults.TaxReport, portfolio: PlanningPortfolio?): List<GermanPlanningRow> = report.events.map {
        GermanPlanningRow(it.id, "${date(it.date)} · ${portfolio?.name(it.instrumentId) ?: ""}", amount(it.taxable))
    }

    /** PLAN-025: the funds / ETFs with operations, in the server's order. */
    fun fundRows(tax: PlanningResults.Tax, portfolio: PlanningPortfolio?): List<GermanFundRow> =
        tax.fundInstrumentIds.map { GermanFundRow(it, portfolio?.name(it) ?: "") }

    /** PLAN-025: `{instrument} · {date} · Prior gross advances (€)` per 2026 fund sale. */
    fun fundSaleRows(tax: PlanningResults.Tax, portfolio: PlanningPortfolio?): List<GermanFundSaleRow> = tax.fundSaleIds.mapNotNull { id ->
        val sale = portfolio?.operation(id) ?: return@mapNotNull null
        GermanFundSaleRow(id, "${portfolio.name(sale.instrumentId) ?: ""} · ${date(sale.date)} · ${tr("Prior gross advances (€)")}")
    }

    // MARK: Income (PLAN-027…031)

    /** PLAN-027: per year, newest first. */
    fun incomeYears(income: PlanningResults.Income): List<GermanIncomeYearView> = income.history.sortedByDescending { it.year }.map { y ->
        GermanIncomeYearView(y.year, listOf(
            GermanPlanningRow("gross", tr("Gross income"), amount(y.gross)),
            GermanPlanningRow("withheld", tr("Recorded withholding and fees"), amount(y.withheld)),
            GermanPlanningRow("net", tr("Recorded net income"), amount(y.net)),
        ))
    }

    /** PLAN-028, PLAN-029: one card per forecast payment (the server already excludes principal redemptions). */
    fun forecastCards(income: PlanningResults.Income, portfolio: PlanningPortfolio?): List<GermanForecastCard> =
        income.events.mapIndexed { i, e ->
            GermanForecastCard("${e.instrumentId}:${e.date}:$i", date(e.date), portfolio?.name(e.instrumentId) ?: "",
                amount(e.gross), amount(e.net), e.net == null, e.benchmark)
        }
}
