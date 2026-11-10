package io.buddybudget.core.data

import io.buddybudget.core.domain.goals.GoalPayload
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

// Obiettivi (12-goals): `GET /api/goals` (the whole view: plan rows, sources, free balances, FIRE comparison) and the
// goal mutations. Also read by the Overview tile (OV-030…032). Spec: api/endpoints/goals.md. Same names on iOS.

/** `GET /api/goals` (IT only, `capabilities.sections.goals`). */
@Serializable
data class GoalsView(
    val currency: String = "EUR",
    val todayKey: String = "",
    /** Average monthly savings; null if unknown. */
    val capacity: FlexDouble? = null,
    val requested: FlexDouble = 0.0,
    val allocated: FlexDouble = 0.0,
    val gap: FlexDouble = 0.0,
    val goals: List<GoalView> = emptyList(),
    val fire: Fire? = null,
    val sources: List<GoalFreeSourceView> = emptyList(),
    val essentialMonthly: FlexDouble? = null,
    /** Where `essentialMonthly` comes from (web #382): `dovute` (Dovute + Saltuarie) or `tutte` (every expense). */
    val essentialBasis: String? = null,
) {
    /** Analitiche FIRE target as the "last goal"; null when spending or savings are unknown. */
    @Serializable
    data class Fire(
        val target: FlexDouble,
        val wealth: FlexDouble,
        val progress: FlexDouble,
        val baseYear: Int? = null,
        val withGoalsYear: Int? = null,
    )

    fun goal(id: String): GoalView? = goals.firstOrNull { it.id == id }
}

/** `GoalSourceView`: a part of an account or a position assigned to a goal. */
@Serializable
data class GoalSourceView(
    val id: String,
    /** `account` | `instrument`. */
    val kind: String,
    val refId: String,
    val name: String = "",
    val amount: FlexDouble,
    val counted: FlexDouble,
    val tax: FlexDouble = 0.0,
    val total: FlexDouble = 0.0,
    val short: Boolean = false,
    /** GOAL-037 (web #382): the account's avatar or the instrument type, for the source icon. */
    val accountColor: String? = null,
    val accountIcon: String? = null,
    val instrumentType: String? = null,
)

/** `FreeSource`: the free (unassigned) part of an account or position. */
@Serializable
data class GoalFreeSourceView(
    val kind: String,
    val id: String,
    val name: String = "",
    val total: FlexDouble = 0.0,
    val free: FlexDouble = 0.0,
    val taxPerEuro: FlexDouble = 0.0,
    val accountColor: String? = null,
    val accountIcon: String? = null,
    val instrumentType: String? = null,
)

@Serializable
data class GoalView(
    val id: String,
    val name: String,
    val kind: String = "altro",
    val target: FlexDouble,
    val targetDate: String? = null,
    val monthly: FlexDouble = 0.0,
    val achievedAt: String? = null,
    val current: FlexDouble = 0.0,
    val progress: FlexDouble,
    val funded: FlexDouble = 0.0,
    val required: FlexDouble? = null,
    val etaMonth: String? = null,
    val monthsToGo: Int? = null,
    val status: String,
    val priority: Int = 0,
    val sources: List<GoalSourceView> = emptyList(),
    val fireShiftMonths: Int? = null,
)

class GoalsApi(private val client: ApiClient) {
    /** GOAL-004. */
    suspend fun list(): GoalsView = client.get("api/goals", GoalsView.serializer())

    /** GOAL-024: `POST /api/goals` → `{ id }`. */
    suspend fun create(payload: GoalPayload): String {
        val text = client.send("api/goals", "POST", body = json(payload, includePriority = true).toString()).text
        return runCatching { ApiClient.DefaultJson.parseToJsonElement(text).jsonObject["id"]?.jsonPrimitive?.content }.getOrNull() ?: ""
    }

    /** GOAL-025: every field except the priority; the sources replace the existing ones. */
    suspend fun update(id: String, payload: GoalPayload) {
        client.send("api/goals/$id", "PATCH", body = json(payload, includePriority = false).toString())
    }

    /** GOAL-031: `PATCH {achieved}`. */
    suspend fun setAchieved(id: String, achieved: Boolean) {
        client.send("api/goals/$id", "PATCH", body = buildJsonObject { put("achieved", achieved) }.toString())
    }

    /** GOAL-032. */
    suspend fun delete(id: String) = client.sendNoContent("api/goals/$id", "DELETE")

    /** GOAL-009: the full id order (409 when stale, GOAL-010). */
    suspend fun reorder(ids: List<String>) {
        client.send("api/goals/reorder", "POST", body = buildJsonObject { putJsonArray("ids") { ids.forEach { add(it) } } }.toString())
    }

    companion object {
        /** Request body of create / edit (`toPayload`). */
        fun json(payload: GoalPayload, includePriority: Boolean): JsonObject = buildJsonObject {
            put("name", payload.name)
            put("kind", payload.kind.key)
            put("targetAmount", payload.targetAmount)
            put("targetDate", payload.targetDate?.let { JsonPrimitive(it) } ?: JsonNull)
            put("monthlyAmount", payload.monthlyAmount)
            if (includePriority) put("priority", payload.priority)
            putJsonArray("sources") {
                payload.sources.forEach { s ->
                    addJsonObject {
                        put("amount", s.amount)
                        s.accountId?.let { put("accountId", it) }
                        s.instrumentId?.let { put("instrumentId", it) }
                    }
                }
            }
        }
    }
}
