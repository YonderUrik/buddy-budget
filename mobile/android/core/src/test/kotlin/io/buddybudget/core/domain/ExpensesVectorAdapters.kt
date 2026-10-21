package io.buddybudget.core.domain

import io.buddybudget.core.domain.liquidity.MovementFilter
import io.buddybudget.core.domain.liquidity.MovementList

internal object ExpensesVectorAdapters {
    val handlers: Map<String, Handler> = mapOf(
        "filterTransactions" to { i ->
            require(i["fixture"].str == "transactions") { "fixture ${i["fixture"]}" }
            val f = i["filter"]
            val filter = MovementFilter(f["categoryId"].optStr, f["searchText"].str, f["accountId"].optStr)
            val result = MovementList.filterTransactions(VectorMovement.fixture(), filter)
            // The search vector records only the count (see its notes).
            if (f["searchText"].str.isNotEmpty()) n(result.size) else arr(result.map { s(it.id) })
        },
    )
}
