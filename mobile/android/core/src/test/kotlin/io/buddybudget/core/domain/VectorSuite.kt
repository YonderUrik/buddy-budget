package io.buddybudget.core.domain

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLanguage
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.CashflowPeriod
import io.buddybudget.core.domain.periods.DataPeriod
import io.buddybudget.core.domain.periods.DateRange
import io.buddybudget.core.domain.periods.ExpensePeriod
import io.buddybudget.core.domain.periods.NetWorthPeriod
import io.buddybudget.core.domain.periods.Periods
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.time.OffsetDateTime
import java.time.ZoneId

/** One golden vector. [toString] is the id, so JUnit names each parameterized case after it. */
class Vector(
    val file: String,
    val id: String,
    val function: String,
    val input: JsonElement,
    val expected: JsonElement,
    val tolerance: Double?,
) {
    override fun toString(): String = id
}

sealed interface VectorOutcome {
    data object Pass : VectorOutcome
    data class Fail(val message: String) : VectorOutcome
    data class Skip(val reason: String) : VectorOutcome
}

/**
 * Loads `spec/domain/vectors/<file>.json` (via the `spec.dir` system property) and runs each vector through
 * the domain ports. Every function name is either handled or listed in [serverSide] (with the endpoint that
 * replaces it); an unknown function name fails. Mirrors the Swift `VectorSuite`.
 */
object VectorSuite {
    /** Every vector file; each function is either ported (adapter) or listed in [serverSide] with its endpoint. */
    val files = listOf(
        "formatting.json", "expenses.json", "cashflow.json", "liquidity.json", "net-worth.json", "debts.json",
        "goals.json", "pension.json", "italian-taxes.json", "fire-and-simulations.json", "returns.json",
        "category-colors.json", "costs.json", "exposure.json", "financial-planning-de.json", "fx.json",
        "investments.json", "month-pace.json", "overview-voice.json", "risk.json", "subscriptions.json",
    )

    /** Time zone the vectors were generated in (`formatting.json → generatedWith.tz`). */
    private val vectorZone: ZoneId = ZoneId.of("Europe/Rome")

    /** `spec.dir` system property (core/build.gradle.kts); the `SPEC_DIR` environment variable overrides it. */
    val specDir: File
        get() = File(
            System.getenv("SPEC_DIR") ?: System.getProperty("spec.dir")
                ?: error("spec.dir system property not set (see core/build.gradle.kts)"),
        )

    fun load(file: String): List<Vector> {
        val root = Json.parseToJsonElement(File(specDir, "domain/vectors/$file").readText()).jsonObject
        return root.getValue("vectors").jsonArray.map { e ->
            val o = e.jsonObject
            Vector(
                file = file,
                id = o.getValue("id").jsonPrimitive.content,
                function = o.getValue("function").jsonPrimitive.content,
                input = o["input"] ?: JsonNull,
                expected = o["expected"] ?: JsonNull,
                tolerance = (o["tolerance"] as? JsonPrimitive)?.doubleOrNull,
            )
        }
    }

    /** null when the bundled locale data equals `spec/domain/locale-data/locale-data.json`. */
    fun localeDataMismatch(): String? {
        val spec = File(specDir, "domain/locale-data/locale-data.json")
        if (!spec.exists()) return "cannot read $spec"
        val bundled = BBFormat.bundledLocaleData() ?: return "bundled locale-data.json missing"
        return if (spec.readText() == bundled) null else "bundled locale-data.json differs from the spec copy: refresh it"
    }

    fun run(v: Vector): VectorOutcome {
        if (v.file !in files) return VectorOutcome.Fail("no adapter for file ${v.file}")
        val fileHandlers = handlers[v.file] ?: emptyMap()
        val handler = fileHandlers[v.function]
            ?: return deferred[v.file]?.get(v.function)?.let { VectorOutcome.Skip(it) }
                ?: VectorOutcome.Fail("unknown function ${v.function}: add an adapter or defer it explicitly")
        val actual = try {
            handler(v.input)
        } catch (e: SkipVector) {
            return VectorOutcome.Skip(e.reason)
        } catch (e: Exception) {
            return VectorOutcome.Fail("threw $e")
        }
        return if (matches(actual, v.expected, v.tolerance ?: 0.0)) VectorOutcome.Pass
        else VectorOutcome.Fail("expected ${show(v.expected)} got ${show(actual)}")
    }

    private fun matches(a: JsonElement, b: JsonElement, tolerance: Double): Boolean = when {
        a is JsonNull || b is JsonNull -> a is JsonNull && b is JsonNull
        a is JsonPrimitive && b is JsonPrimitive && !a.isString && !b.isString && a.booleanOrNull == null && b.booleanOrNull == null -> {
            val x = a.doubleOrNull
            val y = b.doubleOrNull
            x != null && y != null && (x == y || Math.abs(x - y) <= tolerance)
        }
        a is JsonPrimitive && b is JsonPrimitive -> a.isString == b.isString && a.content == b.content
        a is JsonArray && b is JsonArray -> a.size == b.size && a.indices.all { matches(a[it], b[it], tolerance) }
        a is JsonObject && b is JsonObject -> a.keys == b.keys && a.keys.all { matches(a.getValue(it), b.getValue(it), tolerance) }
        else -> false
    }

    /** JSON with non-ASCII escaped, so NBSP / U+2212 differences are visible in failure messages. */
    private fun show(e: JsonElement): String = e.toString().map { if (it.code in 32..126) "$it" else "\\u%04X".format(it.code) }.joinToString("")


    private val formattingHandlers: Map<String, Handler> = mapOf(
        "formatCurrency" to { i ->
            val max = (i["maximumFractionDigits"] as? JsonPrimitive)?.doubleOrNull?.toInt() ?: 2
            s(BBFormat.formatCurrency(i["value"].num, i["currency"].str, i.locale, maximumFractionDigits = max))
        },
        "getCurrencySymbol" to { i -> s(BBFormat.getCurrencySymbol(i["currency"].str, i.locale)) },
        "formatPct" to { i -> s(BBFormat.formatPct(i["value"].num, i.locale, digits = i["digits"].int)) },
        "formatSignedPct" to { i -> s(BBFormat.formatSignedPct(i["value"].num, i.locale)) },
        "formatSignedCurrency" to { i -> s(BBFormat.formatSignedCurrency(i["value"].num, i["currency"].str, i.locale)) },
        "formatPrice" to { i -> s(BBFormat.formatPrice(i["value"].num, i["currency"].str, i.locale)) },
        "formatCompactAmount" to { i -> s(BBFormat.formatCompactAmount(i["value"].num, i.locale)) },
        "formatRatio" to { i -> s(BBFormat.formatRatio(i["value"].num, i.locale, digits = i["digits"].int)) },
        "shortMonthLabel" to { i -> s(BBFormat.shortMonthLabel(i["month"].int, i.locale)) },
        "formatMonthLabel" to { i -> s(BBFormat.formatMonthLabel(i["key"].str, i.locale)) },
        "formatShortDate" to { i -> s(BBFormat.formatShortDate(i["iso"].str, i.locale)) },
        "formatDateWithYear" to { i -> s(BBFormat.formatDateWithYear(i["iso"].str, i.locale)) },
        "formatLongDate" to { i -> s(BBFormat.formatLongDate(i["date"].date, i.locale)) },
        "formatRelativeTime" to { i ->
            val now = i["now"].instant
            val date = now.minusMillis(i["msAgo"].num.toLong())
            s(BBFormat.formatRelativeTime(date, now, i.locale, vectorZone))
        },
        "splitMoney" to { i ->
            val parts = BBFormat.splitMoney(i["value"].num, i["currency"].str, i.locale)
            JsonObject(mapOf("main" to s(parts.main), "tail" to s(parts.tail)))
        },
        "formatDuration" to { i ->
            s(BBFormat.formatDuration(i["months"].int, BBLanguage.fromCode(i["language"].str) ?: error("language")))
        },
        "translate" to { i ->
            // Catalog lookup belongs to the generated strings runtime (L10n.translate); only the Italian source
            // path (no lookup) is checked here, which exercises BBFormat.interpolate.
            if (i["language"].str != "it") throw SkipVector("needs the generated string catalog (L10n.translate), not BBFormat")
            val values = (i["values"] as? JsonObject)?.mapValues { it.value.jsString } ?: emptyMap()
            s(BBFormat.interpolate(i["source"].str, values))
        },
    )

    /** Base adapters merged with the per-topic domain ports (`<Topic>VectorAdapters.kt`). */
    private val handlers: Map<String, Map<String, Handler>> by lazy {
        val merged = baseHandlers.mapValues { it.value.toMutableMap() }.toMutableMap()
        val topics = listOf(
            "debts.json" to DebtsVectorAdapters.handlers,
            "fire-and-simulations.json" to FireVectorAdapters.handlers,
            "costs.json" to CostsVectorAdapters.handlers,
            "pension.json" to PensionVectorAdapters.handlers,
            "goals.json" to GoalsVectorAdapters.handlers,
            "financial-planning-de.json" to PlanningDEVectorAdapters.handlers,
            "liquidity.json" to LiquidityVectorAdapters.handlers,
            "expenses.json" to ExpensesVectorAdapters.handlers,
            "net-worth.json" to NetWorthVectorAdapters.handlers,
            "exposure.json" to ExposureVectorAdapters.handlers,
            "subscriptions.json" to SubscriptionsVectorAdapters.handlers,
        )
        for ((file, topic) in topics) merged.getOrPut(file) { mutableMapOf() }.putAll(topic)
        merged
    }

    private val baseHandlers: Map<String, Map<String, Handler>> = mapOf(
        "formatting.json" to formattingHandlers,
        "expenses.json" to mapOf(
            "getPeriodRange" to { i -> range(Periods.getPeriodRange(i.expensePeriod, i["referenceDate"].date)) },
            "getPreviousPeriodRange" to { i -> range(Periods.getPreviousPeriodRange(i.expensePeriod, i["referenceDate"].date)) },
            "shiftReferenceDate" to { i -> s(Periods.shiftReferenceDate(i.expensePeriod, i["referenceDate"].date, i["direction"].int).iso) },
            "formatPeriodLabel" to { i ->
                val p = i.expensePeriod
                s(Periods.formatPeriodLabel(p, Periods.getPeriodRange(p, i["referenceDate"].date), i.locale))
            },
            "scaleBudgetForPeriod" to { i -> n(Periods.scaleBudgetForPeriod(i["monthlyTotal"].num, i.expensePeriod)) },
        ),
        "cashflow.json" to mapOf(
            "getCashflowPeriodRange" to { i -> range(Periods.getCashflowPeriodRange(i.cashflowPeriod, i["referenceDate"].date)) },
            "getPreviousCashflowPeriodRange" to { i -> range(Periods.getPreviousCashflowPeriodRange(i.cashflowPeriod, i["referenceDate"].date)) },
            "shiftCashflowReferenceDate" to { i ->
                s(Periods.shiftCashflowReferenceDate(i.cashflowPeriod, i["referenceDate"].date, i["direction"].int).iso)
            },
            "formatCashflowPeriodLabel" to { i -> s(Periods.formatCashflowPeriodLabel(DateRange(i["range"]["from"].date, i["range"]["to"].date))) },
            "getTrendRange" to { i -> range(Periods.getTrendRange(i.expensePeriod, i["referenceDate"].date)) },
        ),
        "liquidity.json" to mapOf(
            "dayLabel" to { i -> s(BBFormat.dayLabel(i["date"].date, i["today"].date, i.locale)) },
        ),
        "net-worth.json" to mapOf(
            "getNetWorthPeriodRange" to { i ->
                val p = NetWorthPeriod.fromKey(i["period"].str) ?: error("period")
                range(Periods.getNetWorthPeriodRange(p, i["today"].date, if (i["earliestDate"].isNull) null else i["earliestDate"].date))
            },
        ),
        "debts.json" to mapOf(
            "round2" to { i -> n(JSNumber.round2Epsilon(i["value"].num)) },
            "addMonthsClamped" to { i ->
                val anchor = if (i["anchorDay"].isNull) null else i["anchorDay"].int
                s(i["date"].date.plusMonthsClamped(i["months"].int, anchor).iso)
            },
            "parseAmount" to { i -> BBFormat.parseAmount(i["text"].str)?.let { n(it) } ?: JsonNull },
            "addDaysIso" to { i -> s(i["isoDate"].date.plusDays(i["days"].int).iso) },
            "todayIso" to { i -> s(Periods.todayUTC(i["now"].instant).iso) },
        ),
        "goals.json" to mapOf(
            "monthsBetween" to { i -> n(Periods.monthsBetween(i["from"].str, i["to"].str)) },
            "addMonthsKey" to { i -> s(Periods.addMonthsKey(i["from"].str, i["months"].int)) },
        ),
        "pension.json" to mapOf(
            "addMonths" to { i -> s(i["date"].date.plusMonthsClamped(i["months"].int).iso) },
            "wholeYearsBetween" to { i -> n(Periods.wholeYearsBetween(i["from"].str, i["to"].str)) },
        ),
        "italian-taxes.json" to mapOf(
            "shiftMonths" to { i -> s(i["dateKey"].date.plusMonthsClamped(i["months"].int).iso) },
        ),
        "fire-and-simulations.json" to mapOf(
            "monthSpan" to { i -> n(Periods.monthSpan(i["from"].str, i["to"].str)) },
            "resolvePeriodRange" to { i ->
                val p = i["period"]
                val period = if (p["kind"].str == "ultimi") DataPeriod.Ultimi(p["months"].int) else DataPeriod.Personalizzato(p["from"].str, p["to"].str)
                val r = Periods.resolvePeriodRange(period, i["today"].date)
                JsonObject(mapOf("from" to s(r.from.iso), "to" to s(r.to.iso), "months" to n(r.months)))
            },
        ),
        "returns.json" to mapOf(
            "daysBetween" to { i -> n(Periods.daysBetween(i["fromKey"].date, i["toKey"].date)) },
            "isoWeek" to { i ->
                val w = Periods.isoWeek(i["date"].date)
                JsonObject(mapOf("year" to n(w.year), "week" to n(w.week)))
            },
        ),
    )

    /**
     * Functions that intentionally stay on the server: the app displays the endpoint's result instead of porting them
     * (domain/README.md §2). Reported as "server-side" with the replacing endpoint. Same list as the Swift `serverSide`.
     */
    val serverSide: Map<String, Map<String, String>> = mapOf(
        "cashflow.json" to mapOf(
            "computeCashflowKpis" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeMonthlySeries" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeIncomeSources" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeWhereItGoes" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeAccumulatedSavings" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeSavingsRate" to "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
        ),
        "category-colors.json" to mapOf(
            "distributeColors" to "server-side: POST /api/categories/distribute-colors",
        ),
        "costs.json" to mapOf(
            "computeCostImpact" to "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
            "reinvestedAmount" to "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
            "reinvestmentEffects" to "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
        ),
        "debts.json" to mapOf(
            "buildDebtsView(overview + apr)" to "server-side: GET /api/debts (plan, statuses, totals, APR, weighted APR)",
            "yearlyInterestShares" to "server-side: GET /api/debts?include=insights (yearly interest shares, exit plan per slider step)",
            "buildExitPlan" to "server-side: GET /api/debts?include=insights (yearly interest shares, exit plan per slider step)",
        ),
        "expenses.json" to mapOf(
            "computeSummary" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeIncomeSummary" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeKpis" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeIncomeKpis" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeCategoryBreakdown" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeGroupTotals" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "compute6MonthTrend" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeCategoryMonthlyStacks" to "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
        ),
        "exposure.json" to mapOf(
            "completeWeights" to "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "resolveInstrumentExposure" to "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "aggregateExposure" to "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "roundedCurrentWeights" to "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "normalizeCompanyName" to "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
            "baseTicker" to "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
            "holdingsOverlap" to "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
        ),
        "fx.json" to mapOf(
            "getPerEur" to "server-side: GET /api/investments/view (amounts already converted to the base currency)",
            "fxRateBetween" to "server-side: GET /api/investments/view (amounts already converted to the base currency)",
            "convertAmount" to "server-side: GET /api/investments/view (amounts already converted to the base currency)",
        ),
        "goals.json" to mapOf(
            "buildGoalsPlan" to "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
            "buildGoalsView" to "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
            "monthsToFire" to "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
        ),
        "investments.json" to mapOf(
            "priceMultiplier" to "server-side: GET /api/investments/view",
            "sortTransactions" to "server-side: GET /api/investments/view",
            "computePositions" to "server-side: GET /api/investments/view",
            "findOversoldTransaction" to "server-side: GET /api/investments/view",
            "buildPriceIndex" to "server-side: GET /api/investments/view",
            "resolvePrice" to "server-side: GET /api/investments/view",
            "computePortfolioSummary" to "server-side: GET /api/investments/view",
            "computeComposition" to "server-side: GET /api/investments/view",
            "computeDailyPortfolioValues" to "server-side: GET /api/investments/view",
        ),
        "italian-taxes.json" to mapOf(
            "cryptoTaxRate" to "server-side: GET /api/investments/taxes",
            "toBaseEquivalent" to "server-side: GET /api/investments/taxes",
            "taxCategoryOf" to "server-side: GET /api/investments/taxes",
            "computeRealizedGains" to "server-side: GET /api/investments/taxes",
            "computeTaxReport" to "server-side: GET /api/investments/taxes",
            "lossesByExpiry" to "server-side: GET /api/investments/taxes",
            "computeBollo" to "server-side: GET /api/investments/taxes",
            "resolveTaxSettings" to "server-side: GET /api/investments/taxes",
            "looksLikeGovernmentBond" to "server-side: GET /api/investments/taxes",
            "estimatedTaxCharges" to "server-side: GET /api/investments/taxes",
            "computeTaxOpportunities" to "server-side: GET /api/investments/taxes",
            "simulateSale" to "server-side: POST /api/investments/taxes/simulate-sale",
            "couponDates" to "server-side: GET /api/investments/income",
            "dividendGrowth" to "server-side: GET /api/investments/income",
            "incomeByMonth" to "server-side: GET /api/investments/income",
            "findMissingIncome" to "server-side: GET /api/investments/income",
            "forecastIncome" to "server-side: GET /api/investments/income",
        ),
        "liquidity.json" to mapOf(
            "buildCumulativeSpend" to "server-side: GET /api/liquidity/month (pace)",
            "buildAccountBalanceSeries" to "server-side: GET /api/accounts?include=trend",
        ),
        "month-pace.json" to mapOf(
            "computeMonthPace" to "server-side: GET /api/overview (monthPace) + GET /api/liquidity/month (pace)",
        ),
        "overview-voice.json" to mapOf(
            "buildVoiceLines" to "server-side: GET /api/overview (voice)",
        ),
        "net-worth.json" to mapOf(
            "deriveLiquidityHistory" to "server-side: server cron (net_worth_snapshots, source = derivato)",
            "buildNetWorthSeries" to "server-side: GET /api/overview (net-worth series)",
        ),
        "pension.json" to mapOf(
            "deriveContributions" to "server-side: GET /api/pension/view",
            "computePensionPerformance" to "server-side: GET /api/pension/view",
            "companyTfrValue" to "server-side: GET /api/pension/view",
            "recentQuarterlyContribution" to "server-side: GET /api/pension/view",
            "yearlyBreakdown" to "server-side: GET /api/pension/view",
        ),
        "returns.json" to mapOf(
            "toDailyFlows" to "server-side: GET /api/investments/performance",
            "computeDailyReturns" to "server-side: GET /api/investments/performance",
            "computeTwrSeries" to "server-side: GET /api/investments/performance",
            "annualize" to "server-side: GET /api/investments/performance",
            "xirrDaily" to "server-side: GET /api/investments/performance",
            "moneyWeightedReturn" to "server-side: GET /api/investments/performance",
            "investorCashFlows" to "server-side: GET /api/investments/performance",
            "inflationBetween" to "server-side: GET /api/investments/performance",
            "realReturn" to "server-side: GET /api/investments/performance",
            "simulateBenchmark" to "server-side: GET /api/investments/performance",
            "resolvePerformanceRange" to "server-side: GET /api/investments/performance",
            "computePortfolioReturns" to "server-side: GET /api/investments/performance",
            "computePeriodGain" to "server-side: GET /api/investments/performance",
            "heatmapLevel" to "server-side: GET /api/investments/performance",
            "buildReturnHeatmap" to "server-side: GET /api/investments/performance",
        ),
        "risk.json" to mapOf(
            "sampleStd" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "correlation" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "beta" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "observationsPerYear" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "riskObservations" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "computeDrawdown" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "sharpeRatio" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "averageRate" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "pairCorrelation" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "sortinoRatio" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "calmarRatio" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "historicalTailRisk" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "riskContributions" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "concentration" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "annualizedReturn" to "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "computeTitleStats" to "server-side: GET /api/instruments/{id}/analysis",
            "downsampleCloses" to "server-side: GET /api/instruments/{id}/analysis",
        ),
        "subscriptions.json" to mapOf(
            "subscriptionKey" to "server-side: GET /api/subscriptions",
            "detectSubscriptions" to "server-side: GET /api/subscriptions",
            "buildSubscriptionsView" to "server-side: GET /api/subscriptions",
            "upcomingCharges" to "server-side: GET /api/subscriptions",
            "recentPriceRises" to "server-side: GET /api/subscriptions",
        ),
        "fire-and-simulations.json" to mapOf(
            "resolveAssumptions" to "server-side: GET/PATCH /api/analytics/assumptions (server merges)",
            "mergeAssumptions" to "server-side: GET/PATCH /api/analytics/assumptions (server merges)",
        ),
    )

    private val deferred: Map<String, Map<String, String>> get() = serverSide
}
