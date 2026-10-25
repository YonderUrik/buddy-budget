package io.buddybudget.core.domain

import io.buddybudget.core.domain.networth.NetWorthSeriesPoint
import io.buddybudget.core.domain.networth.NetWorthToggles
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal object NetWorthVectorAdapters {
    /** Series input: inline array, or "<vector id>.expected" pointing at another net-worth.json vector. */
    private fun seriesJson(v: JsonElement): List<JsonElement> {
        if (v is JsonArray) return v
        val ref = v.str
        require(ref.endsWith(".expected")) { "series ref $ref" }
        val id = ref.removeSuffix(".expected")
        return VectorSuite.load("net-worth.json").first { it.id == id }.expected as JsonArray
    }

    private fun points(items: List<JsonElement>): List<NetWorthSeriesPoint> = items.map { p ->
        NetWorthSeriesPoint(
            date = p["date"].optStr ?: "",
            label = p["label"].optStr ?: "",
            value = p["value"].num,
            byClass = (p["byClass"] as? JsonObject)?.mapValues { it.value.num } ?: emptyMap(),
            isEstimated = (p["isEstimated"] as? JsonPrimitive)?.content == "true",
        )
    }

    /** The input points with `value` replaced (`{...point, value}`). */
    private fun withValues(items: List<JsonElement>, pts: List<NetWorthSeriesPoint>): JsonElement =
        arr(items.zip(pts).map { (item, p) -> JsonObject((item as JsonObject) + ("value" to n(p.value))) })

    val handlers: Map<String, Handler> = mapOf(
        "computeNetWorthChange" to { i ->
            val c = NetWorthToggles.computeNetWorthChange(points(seriesJson(i["series"])))
            obj("start" to n(c.start), "end" to n(c.end), "delta" to n(c.delta), "deltaPct" to (c.deltaPct?.let { n(it) } ?: JsonNull))
        },
        "excludeClassFromSeries" to { i ->
            val items = seriesJson(i["series"])
            withValues(items, NetWorthToggles.excludeClassFromSeries(points(items), i["classKey"].str))
        },
        "restrictSeriesToClasses" to { i ->
            val items = seriesJson(i["series"])
            withValues(items, NetWorthToggles.restrictSeriesToClasses(points(items), i["classKeys"].list.map { it.str }))
        },
    )
}
