package io.buddybudget.core.domain

import io.buddybudget.core.domain.goals.GoalDraft
import io.buddybudget.core.domain.goals.GoalWizard
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

internal object GoalsVectorAdapters {
    val handlers: Map<String, Handler> = mapOf(
        "emergencyTarget" to { i -> n(GoalWizard.emergencyTarget(i["essentialMonthly"].num, i["months"].num)) },
        "requiredMonthly" to { i ->
            val d = i["draft"]
            var draft = GoalDraft(target = d["target"].optNum, targetMonth = d["targetMonth"].optStr)
            (d["sources"] as? JsonObject)?.forEach { (key, value) -> draft = draft.setSource(key, value.num) }
            GoalWizard.requiredMonthly(draft, i["today"].str)?.let { n(it) } ?: JsonNull
        },
    )
}
