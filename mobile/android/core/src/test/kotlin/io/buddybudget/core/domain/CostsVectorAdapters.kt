package io.buddybudget.core.domain

/** costs.json → CostsCalc (summarizeCosts, costDrag). The cost-impact functions are server-side. */
internal object CostsVectorAdapters {
    val handlers: Map<String, Handler> = mapOf(
        "summarizeCosts" to { i -> FireVectorAdapters.summarizeCostsVector(i) },
        "costDrag" to { i -> FireVectorAdapters.costDragVector(i) },
    )
}
