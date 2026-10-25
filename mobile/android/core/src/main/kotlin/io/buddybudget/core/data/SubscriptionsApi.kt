package io.buddybudget.core.data

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.subscriptions.SubscriptionCadence
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

// Subscriptions / Abbonamenti (spec: api/endpoints/subscriptions.md, features/06-subscriptions.md).
// Same names on iOS (`SubscriptionsAPI` and the models in `Data/SubscriptionsAPI.swift`).

/** What the user decided; [DaConfermare] = detected without a saved choice. */
enum class SubscriptionDecision(val raw: String) {
    DaConfermare("da-confermare"), Confermato("confermato"), Escluso("escluso"), Terminato("terminato"), Unknown("");

    companion object {
        fun of(raw: String?): SubscriptionDecision = entries.firstOrNull { it.raw == raw && it != Unknown } ?: Unknown
    }
}

/** Stored status sent with POST/PATCH. */
enum class SubscriptionStatus(val raw: String) {
    Confermato("confermato"), Escluso("escluso"), Terminato("terminato");

    val decision: SubscriptionDecision get() = SubscriptionDecision.of(raw)
}

/** `Fermo` = the expected charge was missed beyond the cadence's grace days. */
enum class SubscriptionActivity(val raw: String) {
    Attivo("attivo"), Fermo("fermo"), Unknown("");

    companion object {
        fun of(raw: String?): SubscriptionActivity = entries.firstOrNull { it.raw == raw && it != Unknown } ?: Unknown
    }
}

enum class SubscriptionOrigin(val raw: String) {
    Rilevato("rilevato"), Manuale("manuale"), Unknown("");

    companion object {
        fun of(raw: String?): SubscriptionOrigin = entries.firstOrNull { it.raw == raw && it != Unknown } ?: Unknown
    }
}

data class SubscriptionPriceChange(val from: Double, val to: Double, val since: String)

data class SubscriptionCharge(val id: String, val date: String, val amount: Double)

/** Why detection proposes an item (explanation bullets of the detail). */
sealed class SubscriptionReason {
    data class Count(val count: Int) : SubscriptionReason()
    data class Cadence(val cadence: SubscriptionCadence, val skipped: Boolean) : SubscriptionReason()
    /** `constant` = `costante`, otherwise `variabile-lieve`. */
    data class Amount(val constant: Boolean) : SubscriptionReason()
    data class PriceChange(val from: Double, val to: Double, val since: String) : SubscriptionReason()
    data class Day(val day: Int) : SubscriptionReason()
    data object Unknown : SubscriptionReason()
}

data class SubscriptionItem(
    val key: String,
    /** Saved row id; null until the user decides. */
    val id: String? = null,
    val name: String,
    val origin: SubscriptionOrigin = SubscriptionOrigin.Rilevato,
    val decision: SubscriptionDecision = SubscriptionDecision.DaConfermare,
    val activity: SubscriptionActivity = SubscriptionActivity.Attivo,
    /** Null when unknown (also for a cadence value this app version does not know). */
    val cadence: SubscriptionCadence? = SubscriptionCadence.MENSILE,
    val amount: Double? = null,
    val monthly: Double? = null,
    val lastDate: String? = null,
    val nextDate: String? = null,
    val overdueDays: Int = 0,
    val priceChange: SubscriptionPriceChange? = null,
    val charges: List<SubscriptionCharge> = emptyList(),
    val reasons: List<SubscriptionReason> = emptyList(),
    val confidence: Double? = null,
    val categoryId: String? = null,
    val logoPath: String? = null,
) {
    val isManual: Boolean get() = origin == SubscriptionOrigin.Manuale
}

data class SubscriptionTotals(
    val count: Int = 0,
    val monthly: Double = 0.0,
    val yearly: Double = 0.0,
    val pendingCount: Int = 0,
    val pendingMonthly: Double = 0.0,
)

data class SubscriptionsResponse(
    val items: List<SubscriptionItem>,
    val totals: SubscriptionTotals,
    val currency: String,
    /** Server date `YYYY-MM-DD`, used for every relative date (SUB-001). */
    val today: String,
) {
    companion object {
        /** Tolerant decoding: money as number or string, unknown enum values, missing optionals. */
        fun decode(json: kotlinx.serialization.json.Json, text: String): SubscriptionsResponse {
            val root = json.parseToJsonElement(text) as JsonObject
            val totals = root["totals"] as? JsonObject
            return SubscriptionsResponse(
                items = (root["items"] as? JsonArray).orEmpty().map { item(it as JsonObject) },
                totals = SubscriptionTotals(
                    count = totals.money("count")?.toInt() ?: 0,
                    monthly = totals.money("monthly") ?: 0.0,
                    yearly = totals.money("yearly") ?: 0.0,
                    pendingCount = totals.money("pendingCount")?.toInt() ?: 0,
                    pendingMonthly = totals.money("pendingMonthly") ?: 0.0,
                ),
                currency = root.string("currency") ?: "EUR",
                today = root.string("today") ?: throw ApiError.Decoding("missing today"),
            )
        }

        private fun item(o: JsonObject): SubscriptionItem {
            val key = o.string("key") ?: throw ApiError.Decoding("missing key")
            val change = o["priceChange"] as? JsonObject
            return SubscriptionItem(
                key = key,
                id = o.string("id"),
                name = o.string("name") ?: key,
                origin = SubscriptionOrigin.of(o.string("origin")),
                decision = SubscriptionDecision.of(o.string("decision")),
                activity = SubscriptionActivity.of(o.string("activity")),
                cadence = o.string("cadence")?.let { SubscriptionCadence.fromKey(it) },
                amount = o.money("amount"),
                monthly = o.money("monthly"),
                lastDate = o.string("lastDate"),
                nextDate = o.string("nextDate"),
                overdueDays = o.money("overdueDays")?.toInt() ?: 0,
                priceChange = change?.let {
                    SubscriptionPriceChange(it.money("from") ?: 0.0, it.money("to") ?: 0.0, it.string("since") ?: "")
                },
                charges = (o["charges"] as? JsonArray).orEmpty().map {
                    val c = it as JsonObject
                    SubscriptionCharge(c.string("id") ?: "", c.string("date") ?: "", c.money("amount") ?: 0.0)
                },
                reasons = (o["reasons"] as? JsonArray).orEmpty().map { reason(it as JsonObject) },
                confidence = o.money("confidence"),
                categoryId = o.string("categoryId"),
                logoPath = o.string("logoPath"),
            )
        }

        private fun reason(o: JsonObject): SubscriptionReason = when (o.string("kind")) {
            "count" -> SubscriptionReason.Count(o.money("count")?.toInt() ?: 0)
            "cadence" -> o.string("cadence")?.let { SubscriptionCadence.fromKey(it) }
                ?.let { SubscriptionReason.Cadence(it, (o["skipped"] as? JsonPrimitive)?.booleanOrNull ?: false) }
                ?: SubscriptionReason.Unknown
            "amount" -> SubscriptionReason.Amount(o.string("mode") == "costante")
            "price-change" -> SubscriptionReason.PriceChange(o.money("from") ?: 0.0, o.money("to") ?: 0.0, o.string("since") ?: "")
            "day" -> SubscriptionReason.Day(o.money("day")?.toInt() ?: 0)
            else -> SubscriptionReason.Unknown
        }

        private fun JsonObject?.string(key: String): String? = (this?.get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content

        /** A JSON number, or a numeric string (Drizzle numerics); null when missing, null or not numeric. */
        private fun JsonObject?.money(key: String): Double? {
            val p = this?.get(key) as? JsonPrimitive ?: return null
            if (p is JsonNull) return null
            return if (p.isString) JSNumber.parse(p.content) else p.contentOrNull?.toDoubleOrNull()
        }
    }
}

/**
 * An expense category for the subscription picker (SUB-025). Deliberately small and subscriptions-scoped: the full
 * categories API lives elsewhere.
 */
@Serializable
data class SubscriptionCategory(
    val id: String,
    val name: String,
    val type: String,
    val color: String? = null,
    val icon: String? = null,
) {
    companion object {
        /** Income (`entrata`) and transfer (`trasferimento`) categories are not offered (SUB-025). Server order kept. */
        fun expenseOnly(categories: List<SubscriptionCategory>): List<SubscriptionCategory> =
            categories.filter { it.type != "entrata" && it.type != "trasferimento" }
    }
}

/** `POST /api/subscriptions` with `origin: "rilevato"`: a decision on a detected item. */
data class SubscriptionDecisionInput(
    val key: String,
    val status: SubscriptionStatus,
    val name: String,
    val amount: Double,
    val cadence: SubscriptionCadence,
    val categoryId: String?,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("origin", "rilevato")
        put("key", key)
        put("status", status.raw)
        put("name", name)
        put("amount", amount)
        put("cadence", cadence.key)
        put("categoryId", categoryId?.let(::JsonPrimitive) ?: JsonNull)
    }
}

/** `POST /api/subscriptions` with `origin: "manuale"` (SUB-023). */
data class ManualSubscriptionInput(
    val name: String,
    val amount: Double,
    val cadence: SubscriptionCadence,
    val nextDate: String,
    val categoryId: String?,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("origin", "manuale")
        put("name", name)
        put("amount", amount)
        put("cadence", cadence.key)
        put("nextDate", nextDate)
        put("categoryId", categoryId?.let(::JsonPrimitive) ?: JsonNull)
    }
}

/** Tri-state category edit: untouched, or set to a value / null (cleared). */
sealed class CategoryChange {
    data object Unchanged : CategoryChange()
    data class Set(val categoryId: String?) : CategoryChange()
}

/** `PATCH /api/subscriptions/{id}`: null fields are omitted; `categoryId = Set(null)` clears it. */
data class SubscriptionPatch(
    val status: SubscriptionStatus? = null,
    val name: String? = null,
    val amount: Double? = null,
    val cadence: SubscriptionCadence? = null,
    val nextDate: String? = null,
    val categoryId: CategoryChange = CategoryChange.Unchanged,
) {
    fun toJson(): JsonObject = buildJsonObject {
        amount?.let { put("amount", it) }
        cadence?.let { put("cadence", it.key) }
        (categoryId as? CategoryChange.Set)?.let { put("categoryId", it.categoryId?.let(::JsonPrimitive) ?: JsonNull) }
        name?.let { put("name", it) }
        nextDate?.let { put("nextDate", it) }
        status?.let { put("status", it.raw) }
    }
}

class SubscriptionsApi(private val client: ApiClient) {
    /** `GET /api/subscriptions`. */
    suspend fun list(): SubscriptionsResponse {
        val response = client.send("api/subscriptions", "GET")
        return try {
            SubscriptionsResponse.decode(client.json, response.text)
        } catch (e: ApiError) {
            throw e
        } catch (e: Exception) {
            throw ApiError.Decoding(e.message ?: "invalid JSON")
        }
    }

    /** Decision on a detected item (upsert by key, 200). */
    suspend fun decide(input: SubscriptionDecisionInput) {
        client.send("api/subscriptions", "POST", body = input.toJson().toString())
    }

    /** Manual subscription (201; 409 when the name's key already exists). */
    suspend fun addManual(input: ManualSubscriptionInput) {
        client.send("api/subscriptions", "POST", body = input.toJson().toString())
    }

    suspend fun update(id: String, patch: SubscriptionPatch) {
        client.send("api/subscriptions/$id", "PATCH", body = patch.toJson().toString())
    }

    /** Detected: removes the choice (back to «da confermare»). Manual: deletes the subscription. */
    suspend fun delete(id: String) {
        client.send("api/subscriptions/$id", "DELETE")
    }

    /** `GET /api/categories` reduced to the expense categories of the picker (SUB-025). */
    suspend fun expenseCategories(): List<SubscriptionCategory> =
        SubscriptionCategory.expenseOnly(client.get("api/categories", ListSerializer(SubscriptionCategory.serializer())))
}
