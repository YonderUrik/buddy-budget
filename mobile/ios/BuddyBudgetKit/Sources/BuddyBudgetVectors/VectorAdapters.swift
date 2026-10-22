import BuddyBudgetKit
import Foundation

/// Thrown by an adapter for a vector that cannot run in this module yet.
struct SkipVector: Error { let reason: String }

struct AdapterError: Error, CustomStringConvertible {
    let description: String
    init(_ d: String) { description = d }
}

typealias Handler = @Sendable (JSONValue) throws -> JSONValue

extension VectorSuite {
    /// Time zone the vectors were generated in (`formatting.json → generatedWith.tz`).
    static let vectorTimeZone = TimeZone(identifier: "Europe/Rome")!

    /// Base adapters (BBFormat / Periods) merged with the per-topic domain ports (`VectorAdapters+<Topic>.swift`).
    static let handlers: [String: [String: Handler]] = {
        var merged = baseHandlers
        for (file, topic) in topicHandlers {
            merged[file, default: [:]].merge(topic) { _, new in new }
        }
        return merged
    }()

    /// Per-topic adapters of the ported domain functions.
    static let topicHandlers: [(String, [String: Handler])] = [
        ("debts.json", debtsHandlers),
        ("fire-and-simulations.json", fireHandlers),
        ("costs.json", costsHandlers),
        ("pension.json", pensionHandlers),
        ("goals.json", goalsHandlers),
        ("financial-planning-de.json", planningDEHandlers),
        ("liquidity.json", liquidityHandlers),
        ("expenses.json", expensesHandlers),
        ("net-worth.json", netWorthHandlers),
        ("exposure.json", exposureHandlers),
        ("subscriptions.json", subscriptionsHandlers),
    ]

    static let baseHandlers: [String: [String: Handler]] = [
        "formatting.json": formattingHandlers,
        "expenses.json": [
            "getPeriodRange": { i in range(Periods.getPeriodRange(try expensePeriod(i), try date(i["referenceDate"]))) },
            "getPreviousPeriodRange": { i in range(Periods.getPreviousPeriodRange(try expensePeriod(i), try date(i["referenceDate"]))) },
            "shiftReferenceDate": { i in
                .string(Periods.shiftReferenceDate(try expensePeriod(i), try date(i["referenceDate"]), direction: try int(i["direction"])).iso)
            },
            "formatPeriodLabel": { i in
                let p = try expensePeriod(i)
                return .string(Periods.formatPeriodLabel(p, Periods.getPeriodRange(p, try date(i["referenceDate"])), locale: try locale(i)))
            },
            "scaleBudgetForPeriod": { i in .number(Periods.scaleBudgetForPeriod(try num(i["monthlyTotal"]), try expensePeriod(i))) },
        ],
        "cashflow.json": [
            "getCashflowPeriodRange": { i in range(Periods.getCashflowPeriodRange(try cashflowPeriod(i), try date(i["referenceDate"]))) },
            "getPreviousCashflowPeriodRange": { i in
                range(Periods.getPreviousCashflowPeriodRange(try cashflowPeriod(i), try date(i["referenceDate"])))
            },
            "shiftCashflowReferenceDate": { i in
                .string(Periods.shiftCashflowReferenceDate(try cashflowPeriod(i), try date(i["referenceDate"]), direction: try int(i["direction"])).iso)
            },
            "formatCashflowPeriodLabel": { i in
                .string(Periods.formatCashflowPeriodLabel(DateRange(from: try date(i["range"]["from"]), to: try date(i["range"]["to"]))))
            },
            "getTrendRange": { i in range(Periods.getTrendRange(try expensePeriod(i), try date(i["referenceDate"]))) },
        ],
        "liquidity.json": [
            "dayLabel": { i in .string(BBFormat.dayLabel(try date(i["date"]), today: try date(i["today"]), locale: try locale(i))) },
        ],
        "net-worth.json": [
            "getNetWorthPeriodRange": { i in
                guard let p = i["period"].string.flatMap(NetWorthPeriod.init(rawValue:)) else { throw AdapterError("period") }
                let earliest = i["earliestDate"].isNull ? nil : try date(i["earliestDate"])
                return range(Periods.getNetWorthPeriodRange(p, today: try date(i["today"]), earliestDate: earliest))
            },
        ],
        "debts.json": [
            "round2": { i in .number(JSNumber.round2Epsilon(try num(i["value"]))) },
            "addMonthsClamped": { i in
                .string(try date(i["date"]).addingMonthsClamped(try int(i["months"]), anchorDay: i["anchorDay"].int).iso)
            },
            "parseAmount": { i in BBFormat.parseAmount(try str(i["text"])).map(JSONValue.number) ?? .null },
            "addDaysIso": { i in .string(try date(i["isoDate"]).adding(days: try int(i["days"])).iso) },
            "todayIso": { i in .string(Periods.todayUTC(try instant(i["now"])).iso) },
        ],
        "goals.json": [
            "monthsBetween": { i in .number(Double(Periods.monthsBetween(try str(i["from"]), try str(i["to"])))) },
            "addMonthsKey": { i in .string(Periods.addMonthsKey(try str(i["from"]), try int(i["months"]))) },
        ],
        "pension.json": [
            "addMonths": { i in .string(try date(i["date"]).addingMonthsClamped(try int(i["months"])).iso) },
            "wholeYearsBetween": { i in .number(Double(Periods.wholeYearsBetween(try str(i["from"]), try str(i["to"])))) },
        ],
        "italian-taxes.json": [
            "shiftMonths": { i in .string(try date(i["dateKey"]).addingMonthsClamped(try int(i["months"])).iso) },
        ],
        "fire-and-simulations.json": [
            "monthSpan": { i in .number(Double(Periods.monthSpan(try str(i["from"]), try str(i["to"])))) },
            "resolvePeriodRange": { i in
                let p = i["period"]
                let period: DataPeriod = p["kind"].string == "ultimi"
                    ? .ultimi(months: try int(p["months"]))
                    : .personalizzato(from: try str(p["from"]), to: try str(p["to"]))
                let r = Periods.resolvePeriodRange(period, today: try date(i["today"]))
                return .object(["from": .string(r.from.iso), "to": .string(r.to.iso), "months": .number(Double(r.months))])
            },
        ],
        "returns.json": [
            "daysBetween": { i in .number(Double(Periods.daysBetween(try date(i["fromKey"]), try date(i["toKey"])))) },
            "isoWeek": { i in
                let w = Periods.isoWeek(try date(i["date"]))
                return .object(["year": .number(Double(w.year)), "week": .number(Double(w.week))])
            },
        ],
    ]

    static let formattingHandlers: [String: Handler] = [
        "formatCurrency": { i in
            let max = i["maximumFractionDigits"].int ?? 2
            return .string(BBFormat.formatCurrency(try num(i["value"]), currency: try str(i["currency"]), locale: try locale(i),
                                                   maximumFractionDigits: max))
        },
        "getCurrencySymbol": { i in .string(BBFormat.getCurrencySymbol(try str(i["currency"]), locale: try locale(i))) },
        "formatPct": { i in .string(BBFormat.formatPct(try num(i["value"]), digits: i["digits"].int ?? 1, locale: try locale(i))) },
        "formatSignedPct": { i in .string(BBFormat.formatSignedPct(try num(i["value"]), locale: try locale(i))) },
        "formatSignedCurrency": { i in
            .string(BBFormat.formatSignedCurrency(try num(i["value"]), currency: try str(i["currency"]), locale: try locale(i)))
        },
        "formatPrice": { i in .string(BBFormat.formatPrice(try num(i["value"]), currency: try str(i["currency"]), locale: try locale(i))) },
        "formatCompactAmount": { i in .string(BBFormat.formatCompactAmount(try num(i["value"]), locale: try locale(i))) },
        "formatRatio": { i in .string(BBFormat.formatRatio(try num(i["value"]), digits: i["digits"].int ?? 1, locale: try locale(i))) },
        "shortMonthLabel": { i in .string(BBFormat.shortMonthLabel(try int(i["month"]), locale: try locale(i))) },
        "formatMonthLabel": { i in .string(BBFormat.formatMonthLabel(try str(i["key"]), locale: try locale(i))) },
        "formatShortDate": { i in .string(BBFormat.formatShortDate(try str(i["iso"]), locale: try locale(i))) },
        "formatDateWithYear": { i in .string(BBFormat.formatDateWithYear(try str(i["iso"]), locale: try locale(i))) },
        "formatLongDate": { i in .string(BBFormat.formatLongDate(try date(i["date"]), locale: try locale(i))) },
        "formatRelativeTime": { i in
            let now = try instant(i["now"])
            let date = now.addingTimeInterval(-(try num(i["msAgo"])) / 1000)
            return .string(BBFormat.formatRelativeTime(date, now: now, locale: try locale(i), timeZone: vectorTimeZone))
        },
        "splitMoney": { i in
            let s = BBFormat.splitMoney(try num(i["value"]), currency: try str(i["currency"]), locale: try locale(i))
            return .object(["main": .string(s.main), "tail": .string(s.tail)])
        },
        "formatDuration": { i in
            guard let language = i["language"].string.flatMap(BBLanguage.init(rawValue:)) else { throw AdapterError("language") }
            return .string(BBFormat.formatDuration(try int(i["months"]), language: language))
        },
        "translate": { i in
            // Catalog lookup belongs to the generated strings runtime (L10n.translate); only the Italian source
            // path (no lookup) is checked here, which exercises BBFormat.interpolate.
            guard i["language"].string == "it" else {
                throw SkipVector(reason: "needs the generated string catalog (L10n.translate), not BBFormat")
            }
            var values: [String: String] = [:]
            if case .object(let o) = i["values"] { for (k, v) in o { values[k] = v.jsString } }
            return .string(BBFormat.interpolate(try str(i["source"]), values))
        },
    ]

    /// Functions that intentionally stay on the server: the app displays the endpoint's result instead of
    /// porting them (domain/README.md §2). The vector is reported as "server-side" with the replacing endpoint.
    static let serverSide: [String: [String: String]] = [
        "cashflow.json": [
            "computeCashflowKpis": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeMonthlySeries": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeIncomeSources": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeWhereItGoes": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeAccumulatedSavings": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
            "computeSavingsRate": "server-side: GET /api/liquidity/analysis (KPIs, income sources, accumulated savings, savings rate; the 6-month in/out series is not on a mobile screen)",
        ],
        "category-colors.json": [
            "distributeColors": "server-side: POST /api/categories/distribute-colors",
        ],
        "costs.json": [
            "computeCostImpact": "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
            "reinvestedAmount": "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
            "reinvestmentEffects": "server-side: GET /api/investments/view (costImpact, costScenarios, reinvestmentEffects)",
        ],
        "debts.json": [
            "buildDebtsView(overview + apr)": "server-side: GET /api/debts (plan, statuses, totals, APR, weighted APR)",
            "yearlyInterestShares": "server-side: GET /api/debts?include=insights (yearly interest shares, exit plan per slider step)",
            "buildExitPlan": "server-side: GET /api/debts?include=insights (yearly interest shares, exit plan per slider step)",
        ],
        "expenses.json": [
            "computeSummary": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeIncomeSummary": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeKpis": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeIncomeKpis": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeCategoryBreakdown": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeGroupTotals": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "compute6MonthTrend": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
            "computeCategoryMonthlyStacks": "server-side: GET /api/liquidity/month + GET /api/liquidity/analysis",
        ],
        "exposure.json": [
            "completeWeights": "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "resolveInstrumentExposure": "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "aggregateExposure": "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "roundedCurrentWeights": "server-side: GET /api/investments/view (analysis: exposure, allocation drift, currentWeights)",
            "normalizeCompanyName": "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
            "baseTicker": "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
            "holdingsOverlap": "server-side: GET /api/instruments/{id}/analysis (shared holdings)",
        ],
        "fx.json": [
            "getPerEur": "server-side: GET /api/investments/view (amounts already converted to the base currency)",
            "fxRateBetween": "server-side: GET /api/investments/view (amounts already converted to the base currency)",
            "convertAmount": "server-side: GET /api/investments/view (amounts already converted to the base currency)",
        ],
        "goals.json": [
            "buildGoalsPlan": "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
            "buildGoalsView": "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
            "monthsToFire": "server-side: GET /api/goals (GoalsView with the savings plan, ETA and FIRE shift)",
        ],
        "investments.json": [
            "priceMultiplier": "server-side: GET /api/investments/view",
            "sortTransactions": "server-side: GET /api/investments/view",
            "computePositions": "server-side: GET /api/investments/view",
            "findOversoldTransaction": "server-side: GET /api/investments/view",
            "buildPriceIndex": "server-side: GET /api/investments/view",
            "resolvePrice": "server-side: GET /api/investments/view",
            "computePortfolioSummary": "server-side: GET /api/investments/view",
            "computeComposition": "server-side: GET /api/investments/view",
            "computeDailyPortfolioValues": "server-side: GET /api/investments/view",
        ],
        "italian-taxes.json": [
            "cryptoTaxRate": "server-side: GET /api/investments/taxes",
            "toBaseEquivalent": "server-side: GET /api/investments/taxes",
            "taxCategoryOf": "server-side: GET /api/investments/taxes",
            "computeRealizedGains": "server-side: GET /api/investments/taxes",
            "computeTaxReport": "server-side: GET /api/investments/taxes",
            "lossesByExpiry": "server-side: GET /api/investments/taxes",
            "computeBollo": "server-side: GET /api/investments/taxes",
            "resolveTaxSettings": "server-side: GET /api/investments/taxes",
            "looksLikeGovernmentBond": "server-side: GET /api/investments/taxes",
            "estimatedTaxCharges": "server-side: GET /api/investments/taxes",
            "computeTaxOpportunities": "server-side: GET /api/investments/taxes",
            "simulateSale": "server-side: POST /api/investments/taxes/simulate-sale",
            "couponDates": "server-side: GET /api/investments/income",
            "dividendGrowth": "server-side: GET /api/investments/income",
            "incomeByMonth": "server-side: GET /api/investments/income",
            "findMissingIncome": "server-side: GET /api/investments/income",
            "forecastIncome": "server-side: GET /api/investments/income",
        ],
        "liquidity.json": [
            "buildCumulativeSpend": "server-side: GET /api/liquidity/month (pace)",
            "buildAccountBalanceSeries": "server-side: GET /api/accounts?include=trend",
        ],
        "month-pace.json": [
            "computeMonthPace": "server-side: GET /api/overview (monthPace) + GET /api/liquidity/month (pace)",
        ],
        "overview-voice.json": [
            "buildVoiceLines": "server-side: GET /api/overview (voice)",
        ],
        "net-worth.json": [
            "deriveLiquidityHistory": "server-side: server cron (net_worth_snapshots, source = derivato)",
            "buildNetWorthSeries": "server-side: GET /api/overview (net-worth series)",
        ],
        "pension.json": [
            "deriveContributions": "server-side: GET /api/pension/view",
            "computePensionPerformance": "server-side: GET /api/pension/view",
            "companyTfrValue": "server-side: GET /api/pension/view",
            "recentQuarterlyContribution": "server-side: GET /api/pension/view",
            "yearlyBreakdown": "server-side: GET /api/pension/view",
        ],
        "returns.json": [
            "toDailyFlows": "server-side: GET /api/investments/performance",
            "computeDailyReturns": "server-side: GET /api/investments/performance",
            "computeTwrSeries": "server-side: GET /api/investments/performance",
            "annualize": "server-side: GET /api/investments/performance",
            "xirrDaily": "server-side: GET /api/investments/performance",
            "moneyWeightedReturn": "server-side: GET /api/investments/performance",
            "investorCashFlows": "server-side: GET /api/investments/performance",
            "inflationBetween": "server-side: GET /api/investments/performance",
            "realReturn": "server-side: GET /api/investments/performance",
            "simulateBenchmark": "server-side: GET /api/investments/performance",
            "resolvePerformanceRange": "server-side: GET /api/investments/performance",
            "computePortfolioReturns": "server-side: GET /api/investments/performance",
            "computePeriodGain": "server-side: GET /api/investments/performance",
            "heatmapLevel": "server-side: GET /api/investments/performance",
            "buildReturnHeatmap": "server-side: GET /api/investments/performance",
        ],
        "risk.json": [
            "sampleStd": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "correlation": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "beta": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "observationsPerYear": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "riskObservations": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "computeDrawdown": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "sharpeRatio": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "averageRate": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "pairCorrelation": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "sortinoRatio": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "calmarRatio": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "historicalTailRisk": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "riskContributions": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "concentration": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "annualizedReturn": "server-side: GET /api/investments/view (analysis) + GET /api/investments/performance (risk)",
            "computeTitleStats": "server-side: GET /api/instruments/{id}/analysis",
            "downsampleCloses": "server-side: GET /api/instruments/{id}/analysis",
        ],
        "subscriptions.json": [
            "subscriptionKey": "server-side: GET /api/subscriptions",
            "detectSubscriptions": "server-side: GET /api/subscriptions",
            "buildSubscriptionsView": "server-side: GET /api/subscriptions",
            "upcomingCharges": "server-side: GET /api/subscriptions",
            "recentPriceRises": "server-side: GET /api/subscriptions",
        ],
        "fire-and-simulations.json": [
            "resolveAssumptions": "server-side: GET/PATCH /api/analytics/assumptions (server merges)",
            "mergeAssumptions": "server-side: GET/PATCH /api/analytics/assumptions (server merges)",
        ],
    ]

    static var deferred: [String: [String: String]] { serverSide }

    // MARK: Input helpers

    static func str(_ v: JSONValue) throws -> String {
        guard let s = v.string else { throw AdapterError("expected string, got \(v)") }
        return s
    }

    static func num(_ v: JSONValue) throws -> Double {
        guard let n = v.double else { throw AdapterError("expected number, got \(v)") }
        return n
    }

    static func int(_ v: JSONValue) throws -> Int { Int(try num(v)) }

    static func date(_ v: JSONValue) throws -> CalendarDate {
        guard let d = CalendarDate(iso: try str(v)) else { throw AdapterError("bad date \(v)") }
        return d
    }

    static func locale(_ i: JSONValue) throws -> BBLocale {
        guard let l = i["locale"].string.flatMap(BBLocale.init(tag:)) else { throw AdapterError("locale") }
        return l
    }

    static func expensePeriod(_ i: JSONValue) throws -> ExpensePeriod {
        guard let p = i["period"].string.flatMap(ExpensePeriod.init(rawValue:)) else { throw AdapterError("period") }
        return p
    }

    static func cashflowPeriod(_ i: JSONValue) throws -> CashflowPeriod {
        guard let p = i["period"].string.flatMap(CashflowPeriod.init(rawValue:)) else { throw AdapterError("period") }
        return p
    }

    static func range(_ r: DateRange) -> JSONValue { .object(["from": .string(r.from.iso), "to": .string(r.to.iso)]) }

    /// `YYYY-MM-DDTHH:MM:SS[.sss](Z|±HH:MM)` → instant.
    static func instant(_ v: JSONValue) throws -> Date {
        let s = try str(v)
        let chars = Array(s)
        guard chars.count >= 20, let day = CalendarDate(iso: String(chars[0..<10])),
              let h = Int(String(chars[11..<13])), let m = Int(String(chars[14..<16])), let sec = Int(String(chars[17..<19]))
        else { throw AdapterError("bad instant \(s)") }
        var i = 19
        var millis = 0.0
        if chars[i] == "." {
            var frac = ""
            i += 1
            while i < chars.count, chars[i].isNumber { frac.append(chars[i]); i += 1 }
            millis = (Double("0." + frac) ?? 0) * 1000
        }
        var offset = 0
        if i < chars.count, chars[i] != "Z" {
            let sign = chars[i] == "-" ? -1 : 1
            guard let oh = Int(String(chars[(i + 1)..<(i + 3)])), let om = Int(String(chars[(i + 4)..<(i + 6)])) else {
                throw AdapterError("bad offset \(s)")
            }
            offset = sign * (oh * 3600 + om * 60)
        }
        let seconds = Double(day.epochDay * 86_400 + h * 3600 + m * 60 + sec - offset) + millis / 1000
        return Date(timeIntervalSince1970: seconds)
    }
}
