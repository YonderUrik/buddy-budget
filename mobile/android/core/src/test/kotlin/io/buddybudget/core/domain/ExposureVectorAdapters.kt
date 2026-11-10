package io.buddybudget.core.domain

import io.buddybudget.core.domain.investments.AllocationAnalysis
import io.buddybudget.core.domain.investments.AllocationPosition
import io.buddybudget.core.domain.investments.AllocationTarget
import io.buddybudget.core.domain.investments.AllocationTargets
import kotlinx.serialization.json.JsonElement

internal object ExposureVectorAdapters {
    private fun targets(v: JsonElement) = v.list.map { AllocationTarget(it["instrumentId"].str, it["weight"].num) }

    private fun analyze(i: JsonElement): AllocationAnalysis = AllocationTargets.analyzeAllocation(
        i["positions"].list.map { AllocationPosition(it["instrumentId"].str, it["value"].optNum) },
        targets(i["targets"]),
    )

    val handlers: Map<String, Handler> = mapOf(
        "analyzeAllocation" to { i ->
            val a = analyze(i)
            obj(
                "rows" to arr(
                    a.rows.map { r ->
                        obj(
                            "instrumentId" to s(r.instrumentId), "value" to n(r.value), "currentWeight" to n(r.currentWeight),
                            "targetWeight" to n(r.targetWeight), "drift" to n(r.drift), "status" to s(r.status.key), "inTarget" to b(r.inTarget),
                        )
                    },
                ),
                "total" to n(a.total),
                "unpricedIds" to arr(a.unpricedIds.map { s(it) }),
                "maxDrift" to n(a.maxDrift),
            )
        },
        "suggestContribution" to { i ->
            // "output of <vector id>": rerun that analyzeAllocation vector's input.
            val ref = i["analysis"].str
            require(ref.startsWith("output of ")) { "analysis ref $ref" }
            val source = VectorSuite.load("exposure.json").first { it.id == ref.removePrefix("output of ") }
            arr(
                AllocationTargets.suggestContribution(analyze(source.input), i["amount"].num).map { x ->
                    obj("instrumentId" to s(x.instrumentId), "amount" to n(x.amount), "weightAfter" to n(x.weightAfter), "targetWeight" to n(x.targetWeight))
                },
            )
        },
        "isCompleteTarget" to { i -> b(AllocationTargets.isCompleteTarget(targets(i["targets"]))) },
    )
}
