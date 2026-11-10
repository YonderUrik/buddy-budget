package io.buddybudget.core.domain

import io.buddybudget.core.domain.pension.PensionCalc
import io.buddybudget.core.domain.pension.PensionProjectionPoint
import io.buddybudget.core.domain.pension.PensionProjectionRates
import kotlinx.serialization.json.JsonElement

internal object PensionVectorAdapters {
    private fun projection(i: JsonElement): List<PensionProjectionPoint> {
        val r = i["rates"]
        return PensionCalc.projectPension(
            i["startValue"].num, i["quarterlyContribution"].num, i["years"].num,
            PensionProjectionRates(r["prudent"].num, r["base"].num, r["optimistic"].num),
        )
    }

    private fun point(p: PensionProjectionPoint) =
        obj("year" to n(p.year), "prudent" to n(p.prudent), "base" to n(p.base), "optimistic" to n(p.optimistic))

    val handlers: Map<String, Handler> = mapOf(
        "exitTaxRate" to { i -> n(PensionCalc.exitTaxRate(i["years"].num)) },
        "exitTaxMilestones" to { i ->
            val m = PensionCalc.exitTaxMilestones(i["adhesionDate"].str)
            obj("reductionStartsOn" to s(m.reductionStartsOn), "minRateOn" to s(m.minRateOn))
        },
        "withdrawalScenarios" to { i ->
            val list = PensionCalc.withdrawalScenarios(
                i["value"].num, i["netContributions"].num, i["adhesionDate"].optStr, i["today"].str, i["yearsOverride"].optNum,
            )
            arr(list.map { obj("reason" to s(it.reason.key), "rate" to n(it.rate), "netLow" to n(it.netLow), "netHigh" to n(it.netHigh)) })
        },
        "projectPension" to { i -> arr(projection(i).map(::point)) },
        "projectPension(last point)" to { i -> point(projection(i).last()) },
    )
}
