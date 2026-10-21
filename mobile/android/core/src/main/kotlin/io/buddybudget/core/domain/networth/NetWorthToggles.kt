package io.buddybudget.core.domain.networth

/** One point of the net-worth chart series (served by `GET /api/overview`). */
data class NetWorthSeriesPoint(
    val date: String = "",
    val label: String = "",
    val value: Double,
    val byClass: Map<String, Double>,
    val isEstimated: Boolean = false,
)

/** Change between the first and the last point; `deltaPct` is a ratio (0.5 = +50%). */
data class NetWorthChange(val start: Double, val end: Double, val delta: Double, val deltaPct: Double?)

/** Net-worth class toggles (`lib/calc/net-worth.ts`): plain sums over the served series. Same as Swift. */
object NetWorthToggles {
    /** Total minus one class (`byClass` untouched). */
    fun excludeClassFromSeries(series: List<NetWorthSeriesPoint>, classKey: String): List<NetWorthSeriesPoint> =
        series.map { it.copy(value = it.value - (it.byClass[classKey] ?: 0.0)) }

    /** Total recomputed over the given classes only (in `classKeys` order); `byClass` untouched. */
    fun restrictSeriesToClasses(series: List<NetWorthSeriesPoint>, classKeys: List<String>): List<NetWorthSeriesPoint> =
        series.map { p -> p.copy(value = classKeys.fold(0.0) { sum, key -> sum + (p.byClass[key] ?: 0.0) }) }

    fun computeNetWorthChange(series: List<NetWorthSeriesPoint>): NetWorthChange {
        if (series.isEmpty()) return NetWorthChange(0.0, 0.0, 0.0, null)
        val start = series.first().value
        val end = series.last().value
        val delta = end - start
        val deltaPct = if (series.size >= 2 && start != 0.0) delta / Math.abs(start) else null
        return NetWorthChange(start, end, delta, deltaPct)
    }
}
