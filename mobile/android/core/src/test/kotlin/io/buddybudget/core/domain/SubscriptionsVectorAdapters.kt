package io.buddybudget.core.domain

import io.buddybudget.core.domain.subscriptions.SubscriptionCadence
import io.buddybudget.core.domain.subscriptions.SubscriptionCalc
import kotlinx.serialization.json.JsonElement

internal object SubscriptionsVectorAdapters {
    private val JsonElement.cadence: SubscriptionCadence get() = SubscriptionCadence.fromKey(this["cadence"].str) ?: error("cadence")

    val handlers: Map<String, Handler> = mapOf(
        "monthlyEquivalent" to { i -> n(SubscriptionCalc.monthlyEquivalent(i["amount"].num, i.cadence)) },
        "nextChargeDate" to { i ->
            s(SubscriptionCalc.nextChargeDate(i["lastDate"].str, i.cadence, if (i["day"].isNull) null else i["day"].int))
        },
    )
}
