package io.buddybudget.core.domain

import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.CashflowPeriod
import io.buddybudget.core.domain.periods.DateRange
import io.buddybudget.core.domain.periods.ExpensePeriod
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.time.OffsetDateTime

/** Adapter for one vector function: JSON input → JSON output. */
internal typealias Handler = (JsonElement) -> JsonElement

/** Thrown by an adapter for a vector that cannot run here. */
internal class SkipVector(val reason: String) : Exception(reason)

internal class AdapterError(message: String) : Exception(message)

// region Input helpers (shared by the per-topic adapters)

internal operator fun JsonElement.get(key: String): JsonElement = (this as? JsonObject)?.get(key) ?: JsonNull
internal val JsonElement.str: String get() = (this as JsonPrimitive).also { require(it.isString) { "expected string, got $it" } }.content
internal val JsonElement.num: Double get() = (this as JsonPrimitive).doubleOrNull ?: error("expected number, got $this")
internal val JsonElement.int: Int get() = num.toInt()
internal val JsonElement.isNull: Boolean get() = this is JsonNull
internal val JsonElement.date: CalendarDate get() = CalendarDate.parse(str) ?: error("bad date $this")
internal val JsonElement.locale: BBLocale get() = BBLocale.fromTag(this["locale"].str) ?: error("locale")
internal val JsonElement.expensePeriod: ExpensePeriod get() = ExpensePeriod.fromKey(this["period"].str) ?: error("period")
internal val JsonElement.cashflowPeriod: CashflowPeriod get() = CashflowPeriod.fromKey(this["period"].str) ?: error("period")
internal val JsonElement.instant get() = OffsetDateTime.parse(str).toInstant()

/** JS `String(value)` for interpolation values. */
internal val JsonElement.jsString: String
    get() = when {
        this is JsonPrimitive && isString -> content
        this is JsonPrimitive && doubleOrNull != null -> doubleOrNull!!.let { d ->
            if (d == Math.floor(d) && Math.abs(d) < 1e21) d.toLong().toString() else d.toString()
        }
        else -> toString()
    }

internal fun s(value: String) = JsonPrimitive(value)
internal fun n(value: Number) = JsonPrimitive(value.toDouble())
internal fun range(r: DateRange) = JsonObject(mapOf("from" to s(r.from.iso), "to" to s(r.to.iso)))

// endregion

internal fun obj(vararg pairs: Pair<String, JsonElement>) = JsonObject(mapOf(*pairs))
internal fun arr(items: List<JsonElement>) = JsonArray(items)
internal fun b(value: Boolean) = JsonPrimitive(value)
internal val JsonElement.bool: Boolean get() = (this as JsonPrimitive).content == "true"
internal val JsonElement.list: List<JsonElement> get() = (this as? JsonArray) ?: emptyList()
internal val JsonElement.optNum: Double? get() = (this as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
internal val JsonElement.optStr: String? get() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
