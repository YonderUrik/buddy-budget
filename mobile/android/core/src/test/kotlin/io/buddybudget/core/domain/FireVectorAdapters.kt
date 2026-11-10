package io.buddybudget.core.domain

import io.buddybudget.core.domain.costs.CostPosition
import io.buddybudget.core.domain.costs.CostsCalc
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireCalc
import io.buddybudget.core.domain.fire.FireGrowthInput
import io.buddybudget.core.domain.fire.FireGrowthSplitPoint
import io.buddybudget.core.domain.fire.FireHistoricalReturnResult
import io.buddybudget.core.domain.fire.FireLiquidationPosition
import io.buddybudget.core.domain.fire.FireLiquidationResult
import io.buddybudget.core.domain.fire.FirePlan
import io.buddybudget.core.domain.fire.FirePlanBase
import io.buddybudget.core.domain.fire.FirePlanning
import io.buddybudget.core.domain.fire.FireRetireAt
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.fire.FireSensitivityCell
import io.buddybudget.core.domain.fire.MonteCarlo
import io.buddybudget.core.domain.fire.MonteCarloInput
import io.buddybudget.core.domain.fire.MonteCarloPublicPension
import io.buddybudget.core.domain.fire.MonteCarloSpendingBand
import io.buddybudget.core.domain.fire.MonteCarloWealthBand
import io.buddybudget.core.domain.fire.WithdrawalRule
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

/** fire-and-simulations.json → FireCalc / MonteCarlo / FirePlanning / CostsCalc. Mirrors `VectorAdapters+Fire.swift`. */
internal object FireVectorAdapters {
    private fun opt(v: Double?): JsonElement = v?.let { n(it) } ?: JsonNull
    private val JsonElement.nums: List<Double> get() = list.map { it.num }
    private val JsonElement.uint32: UInt get() = num.toLong().toUInt()

    private fun project(v: JsonObject, keys: List<String>) = JsonObject(v.filterKeys { it in keys })

    private fun growthInput(v: JsonElement) = FireGrowthInput(v["current"].num, v["annualSaving"].num, v["realReturn"].num)

    private fun cells(table: List<List<FireSensitivityCell>>) = arr(table.map { row ->
        arr(row.map { obj("rowValue" to n(it.rowValue), "columnValue" to n(it.columnValue), "years" to opt(it.years)) })
    })

    private fun liquidationPositions(v: JsonElement) = v.list.map {
        FireLiquidationPosition(it["id"].str, it["name"].str, it["value"].num, it["unrealizedGain"].num, it["taxRate"].num)
    }

    private fun liquidation(r: FireLiquidationResult) = obj(
        "latentTax" to n(r.latentTax), "grossValue" to n(r.grossValue), "netValue" to n(r.netValue), "taxRatio" to opt(r.taxRatio),
        "byPosition" to arr(r.byPosition.map { obj("id" to s(it.id), "name" to s(it.name), "tax" to n(it.tax)) }),
    )

    /** The base of `resolvePlan-defaults` (the other plan vectors refer to it by name). */
    private val defaultPlanBase = FirePlanBase(
        FirePlanBase.Wealth(30000.0, 120000.0, 15000.0, 0.0),
        FirePlanBase.Cashflow(30000.0, 15000.0, 12),
        listOf(
            FireLiquidationPosition("a", "ETF World", 50000.0, 10000.0, 0.26),
            FireLiquidationPosition("b", "BTP", 20000.0, 2000.0, 0.125),
            FireLiquidationPosition("c", "Stock", 5000.0, -1500.0, 0.26),
        ),
    )

    private fun planBase(v: JsonElement): FirePlanBase = when (val tag = v.optStr) {
        "same as resolvePlan-defaults" -> defaultPlanBase
        "monthsWithData=2" -> defaultPlanBase.copy(cashflow = defaultPlanBase.cashflow.copy(monthsWithData = 2))
        null -> FirePlanBase(
            FirePlanBase.Wealth(v["wealth"]["liquidity"].num, v["wealth"]["investments"].num, v["wealth"]["pension"].num, v["wealth"]["debts"].num),
            FirePlanBase.Cashflow(v["cashflow"]["annualSpending"].num, v["cashflow"]["annualSavings"].num, v["cashflow"]["monthsWithData"].int),
            liquidationPositions(v["positions"]),
        )
        else -> throw AdapterError("base $tag")
    }

    /** `"DEFAULT…"` strings are DEFAULT_ASSUMPTIONS; an object overrides some of its fields. */
    private fun assumptions(v: JsonElement): FireAssumptions {
        v.optStr?.let { if (it.startsWith("DEFAULT")) return FireAssumptions.defaults else throw AdapterError("assumptions $it") }
        var a = FireAssumptions.defaults
        for ((key, value) in v as JsonObject) {
            a = when (key) {
                "withdrawalRate" -> a.copy(withdrawalRate = value.num)
                "annualSpending" -> a.copy(annualSpending = value.optNum)
                "annualSavings" -> a.copy(annualSavings = value.optNum)
                "expectedReturn" -> a.copy(expectedReturn = value.num)
                "expectedReturnAuto" -> a.copy(expectedReturnAuto = value.bool)
                "volatility" -> a.copy(volatility = value.num)
                "inflation" -> a.copy(inflation = value.num)
                "retirementYears" -> a.copy(retirementYears = value.num)
                "includePensionFunds" -> a.copy(includePensionFunds = value.bool)
                "includeLatentTax" -> a.copy(includeLatentTax = value.bool)
                else -> throw AdapterError("assumption field $key")
            }
        }
        return a
    }

    private fun overrides(v: JsonElement) = FireScenarioOverrides(
        v["annualSavings"].optNum, v["annualSpending"].optNum, v["expectedReturn"].optNum, v["withdrawalRate"].optNum,
    )

    private fun plan(p: FirePlan) = obj(
        "spending" to opt(p.spending), "spendingSource" to s(p.spendingSource.key),
        "savings" to opt(p.savings), "savingsSource" to s(p.savingsSource.key),
        "wealth" to n(p.wealth), "liquidation" to liquidation(p.liquidation), "taxShare" to n(p.taxShare),
        "fireNumberGross" to opt(p.fireNumberGross), "target" to opt(p.target), "progress" to opt(p.progress),
        "yearsToFire" to opt(p.yearsToFire),
        "coast" to arr(p.coast.map { obj("years" to n(it.years), "number" to n(it.number)) }),
    )

    private fun wealthBand(b: MonteCarloWealthBand) =
        obj("year" to n(b.year), "p10" to n(b.p10), "p25" to n(b.p25), "p50" to n(b.p50), "p75" to n(b.p75), "p90" to n(b.p90))

    private fun spendingBand(b: MonteCarloSpendingBand) = obj("year" to n(b.year), "p10" to n(b.p10), "p50" to n(b.p50), "p90" to n(b.p90))

    /** Runs the simulation, then keeps the fields the generator pinned for that vector (gen-fire-vectors.ts). */
    private fun runMonteCarloVector(i: JsonElement): JsonElement {
        val rule = WithdrawalRule.fromKey(i["rule"].str) ?: throw AdapterError("rule")
        val pension = if (i["publicPension"].isNull) null
        else MonteCarloPublicPension(i["publicPension"]["annual"].num, i["publicPension"]["startsAfterYears"].num)
        val pathsInput = i["paths"]
        val r = MonteCarlo.runMonteCarlo(
            MonteCarloInput(
                startingWealth = i["startingWealth"].num, annualSavings = i["annualSavings"].num,
                accumulationYears = i["accumulationYears"].num, retirementYears = i["retirementYears"].num,
                annualSpending = i["annualSpending"].num, expectedReturn = i["expectedReturn"].num, volatility = i["volatility"].num,
                inflation = i["inflation"].optNum, rule = rule, publicPension = pension, paths = pathsInput.optNum,
                seed = if (i["seed"].isNull) null else i["seed"].uint32,
            ),
        )
        val ending = obj("p10" to n(r.endingWealth.p10), "p50" to n(r.endingWealth.p50), "p90" to n(r.endingWealth.p90))
        val maxCut = obj("median" to n(r.maxCut.median), "p90" to n(r.maxCut.p90))
        val ruin = arr(r.ruinByYear.map { n(it) })
        return when {
            pathsInput.optStr != null -> obj("paths" to n(r.paths), "successRate" to n(r.successRate), "endingWealth" to ending)
            pathsInput.optNum == 0.0 -> obj(
                "paths" to n(r.paths), "wealthLen" to n(r.wealth.size), "spendingLen" to n(r.spending.size), "successRate" to n(r.successRate),
            )
            pension != null -> obj(
                "successRate" to n(r.successRate), "endingWealth" to ending, "maxCut" to maxCut,
                "wealthYear10" to wealthBand(r.wealth[10]), "wealthYear35" to wealthBand(r.wealth[35]),
                "spendingYear4" to spendingBand(r.spending[4]), "spendingYear5" to spendingBand(r.spending[5]),
            )
            r.paths == 3 && rule == WithdrawalRule.GUYTON_KLINGER -> obj(
                "successRate" to n(r.successRate), "spending" to arr(r.spending.take(5).map { spendingBand(it) }), "endingWealth" to ending,
            )
            r.paths == 3 -> obj(
                "rule" to s(r.rule.key), "paths" to n(r.paths), "successRate" to n(r.successRate),
                "wealth" to arr(r.wealth.map { wealthBand(it) }), "ruinByYear" to ruin,
                "spending" to arr(r.spending.map { spendingBand(it) }), "endingWealth" to ending, "maxCut" to maxCut,
            )
            else -> obj(
                "successRate" to n(r.successRate), "endingWealth" to ending, "maxCut" to maxCut,
                "wealthYear0" to wealthBand(r.wealth[0]), "wealthYear10" to wealthBand(r.wealth[10]),
                "wealthYear30" to wealthBand(r.wealth[30]), "ruinByYear" to ruin,
                "spendingYear0" to spendingBand(r.spending[0]), "spendingYear29" to spendingBand(r.spending[29]),
            )
        }
    }

    fun summarizeCostsVector(i: JsonElement): JsonElement {
        val positions = i["positions"].list.map {
            CostPosition(it["id"].str, it["name"].str, it["value"].num, it["ter"].optNum, it["subjectToBollo"].bool)
        }
        val r = CostsCalc.summarizeCosts(positions, i["productCountry"].str)
        return obj(
            "rows" to arr(r.rows.map {
                obj(
                    "id" to s(it.id), "name" to s(it.name), "value" to n(it.value), "terCost" to n(it.terCost),
                    "bolloCost" to n(it.bolloCost), "total" to n(it.total), "pct" to n(it.pct),
                )
            }),
            "totalValue" to n(r.totalValue), "annualCost" to n(r.annualCost), "annualPct" to opt(r.annualPct),
            "missingTerValue" to n(r.missingTerValue),
        )
    }

    fun costDragVector(i: JsonElement): JsonElement = arr(
        CostsCalc.costDrag(i["value"].num, i["grossReturn"].num, i["annualCostPct"].num, i["years"].int).map {
            obj("year" to n(it.year), "withoutCosts" to n(it.withoutCosts), "withCosts" to n(it.withCosts), "lost" to n(it.lost))
        },
    )

    val handlers: Map<String, Handler> = mapOf(
        "fireNumber" to { i -> opt(FireCalc.fireNumber(i["annualSpending"].num, i["withdrawalRate"].num)) },
        "fireNumberAfterTax" to { i -> opt(FireCalc.fireNumberAfterTax(i["grossNumber"].num, i["taxShare"].num)) },
        "wealthAfterYears" to { i -> n(FireCalc.wealthAfterYears(growthInput(i["input"]), i["years"].num)) },
        "yearsToTarget" to { i -> opt(FireCalc.yearsToTarget(growthInput(i["input"]), i["target"].num)) },
        "coastNumber" to { i -> n(FireCalc.coastNumber(i["target"].num, i["realReturn"].num, i["years"].num)) },
        "leanSpending" to { i -> n(FireCalc.leanSpending(i["dovuta"].num, i["saltuaria"].num)) },
        "sensitivityByRateAndReturn" to { i ->
            cells(
                FireCalc.sensitivityByRateAndReturn(
                    i["annualSpending"].num, i["current"].num, i["annualSaving"].num, i["withdrawalRates"].nums, i["realReturns"].nums,
                ),
            )
        },
        "sensitivityBySpendingAndSaving" to { i ->
            cells(
                FireCalc.sensitivityBySpendingAndSaving(
                    i["annualSpending"].num, i["withdrawalRate"].num, i["realReturn"].num, i["current"].num, i["annualSaving"].num,
                    i["spendingChanges"].nums, i["savingChanges"].nums,
                ),
            )
        },
        "savingsRate" to { i -> opt(FireCalc.savingsRate(i["income"].num, i["expenses"].num)) },
        "monthsOfCoverage" to { i -> opt(FireCalc.monthsOfCoverage(i["amount"].num, i["monthlySpending"].num)) },
        "mulberry32" to { i ->
            val rand = MonteCarlo.mulberry32(i["seed"].uint32)
            arr((0 until i["draws"].int).map { n(rand.next()) })
        },
        "pathSeed (private)" to { i ->
            val seed = i["seed"].uint32
            arr(i["indices"].nums.map { n(MonteCarlo.pathSeed(seed, it.toInt()).toLong()) })
        },
        "gaussian" to { i ->
            if (i["generator"].optStr != "mulberry32(pathSeed(1,0))") throw AdapterError("generator ${i["generator"]}")
            val rand = MonteCarlo.mulberry32(MonteCarlo.pathSeed(1u, 0))
            arr((0 until i["draws"].int).map { n(MonteCarlo.gaussian(rand)) })
        },
        "lognormalParams" to { i ->
            val (mu, sd) = MonteCarlo.lognormalParams(i["expectedReturn"].num, i["volatility"].num)
            obj("mu" to n(mu), "sd" to n(sd))
        },
        "percentile" to { i ->
            val sorted = i["sorted"].nums
            val p = i["p"]
            if (p is JsonArray) arr(p.map { n(MonteCarlo.percentile(sorted, it.num)) }) else n(MonteCarlo.percentile(sorted, p.num))
        },
        "runMonteCarlo" to { i -> runMonteCarloVector(i) },
        "splitGrowth" to { i ->
            val r = FireCalc.splitGrowth(i["points"].list.map { FireGrowthSplitPoint(it["month"].str, it["netWorth"].num, it["savings"].num) })
            obj(
                "rows" to arr(r.rows.map {
                    obj(
                        "month" to s(it.month), "netWorth" to n(it.netWorth), "savings" to n(it.savings), "delta" to n(it.delta),
                        "fromSavings" to n(it.fromSavings), "fromMarket" to n(it.fromMarket),
                    )
                }),
                "totalDelta" to n(r.totalDelta), "totalFromSavings" to n(r.totalFromSavings),
                "totalFromMarket" to n(r.totalFromMarket), "savingsShare" to opt(r.savingsShare),
            )
        },
        "computeLiquidation" to { i -> liquidation(FireCalc.computeLiquidation(liquidationPositions(i["positions"]))) },
        "summarizeCosts" to { i -> summarizeCostsVector(i) },
        "costDrag" to { i -> costDragVector(i) },
        "resolvePlan" to { i ->
            val json = plan(FirePlanning.resolvePlan(planBase(i["base"]), assumptions(i["assumptions"])))
            // resolvePlan-fewMonths pins only the figures that go missing.
            if (i["base"].optStr == "monthsWithData=2") project(json, listOf("spending", "spendingSource", "savings", "target", "yearsToFire", "coast"))
            else json
        },
        "resolvePlan(applyScenario)" to { i ->
            val a = FirePlanning.applyScenario(FireAssumptions.defaults, overrides(i["overrides"]))
            project(plan(FirePlanning.resolvePlan(defaultPlanBase, a)), listOf("savings", "savingsSource", "yearsToFire"))
        },
        "scenarioSlider" to { i ->
            val field = FireScenarioField.fromKey(i["field"].str) ?: throw AdapterError("field")
            FirePlanning.scenarioSlider(field, i["baseline"].optNum)?.let { obj("min" to n(it.min), "max" to n(it.max), "step" to n(it.step)) }
                ?: JsonNull
        },
        "yearsToFireWith" to { i ->
            if (i["plan"].optStr != "resolvePlan-defaults") throw AdapterError("plan ${i["plan"]}")
            val p = FirePlanning.resolvePlan(defaultPlanBase, FireAssumptions.defaults)
            opt(FirePlanning.yearsToFireWith(p, FireAssumptions.defaults, overrides(i["overrides"])))
        },
        "buildSimulationInput" to { i ->
            if (i["plan"].optStr != "resolvePlan-defaults") throw AdapterError("plan ${i["plan"]}")
            val a = assumptions(i["assumptions"])
            val retireAt = FireRetireAt.entries.firstOrNull { it.key == i["retireAt"].str } ?: throw AdapterError("retireAt")
            val sim = FirePlanning.buildSimulationInput(FirePlanning.resolvePlan(defaultPlanBase, a), a, retireAt)
            if (sim == null) {
                JsonNull
            } else {
                val o = mutableMapOf<String, JsonElement>(
                    "startingWealth" to n(sim.startingWealth), "annualSavings" to n(sim.annualSavings),
                    "accumulationYears" to n(sim.accumulationYears), "retirementYears" to n(sim.retirementYears),
                    "annualSpending" to n(sim.annualSpending), "expectedReturn" to n(sim.expectedReturn),
                    "volatility" to n(sim.volatility), "rule" to s(sim.rule.key),
                )
                sim.inflation?.let { o["inflation"] = n(it) }
                sim.publicPension?.let { o["publicPension"] = obj("annual" to n(it.annual), "startsAfterYears" to n(it.startsAfterYears)) }
                JsonObject(o)
            }
        },
        "resolveExpectedReturn" to { i ->
            val h = i["history"]
            val history = if (h["status"].str == "ok") {
                FireHistoricalReturnResult.Ok(
                    h["months"].int, h["shorterThanPeriod"].bool, h["fromKey"].str, h["toKey"].str, h["nominal"].num, h["real"].optNum,
                )
            } else {
                FireHistoricalReturnResult.Manca(h["reason"].str)
            }
            val r = FirePlanning.resolveExpectedReturn(assumptions(i["assumptions"]), history)
            obj(
                "history" to h, "historyReal" to opt(r.historyReal), "clamped" to b(r.clamped), "value" to n(r.value),
                "source" to s(r.source.key), "high" to b(r.high),
            )
        },
    )
}
