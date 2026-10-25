package io.buddybudget.core.designsystem

import kotlin.math.roundToInt

/** Geometry of the hand-drawn `TrendChart` (charts.md §3: Liquidità hero and Analisi curve). Same on iOS. */
object TrendGeometry {
    data class Layout(val line: List<ChartPoint>, val reference: List<ChartPoint>, val columns: Int)

    /**
     * x evenly spaced over `max(points, reference) − 1` columns; y padded 12 % top and bottom:
     * `toY(v) = h×0.88 − (v−low)/span × h×0.76`, with low/high over both series and `span = 1` when flat.
     */
    fun layout(values: List<Double>, reference: List<Double>?, width: Double, height: Double): Layout {
        val ref = reference.orEmpty()
        val all = values + ref
        val low = all.minOrNull() ?: 0.0
        val high = all.maxOrNull() ?: 0.0
        val span = if (high - low == 0.0) 1.0 else high - low
        val columns = maxOf(values.size, ref.size)
        val step = if (columns > 1) width / (columns - 1) else 0.0
        fun y(v: Double) = height * 0.88 - (v - low) / span * height * 0.76
        return Layout(
            values.mapIndexed { i, v -> ChartPoint(i * step, y(v)) },
            ref.mapIndexed { i, v -> ChartPoint(i * step, y(v)) },
            columns,
        )
    }

    /** Nearest column for a touch at `x` (0…width). */
    fun index(x: Double, width: Double, columns: Int): Int {
        if (columns <= 1 || width <= 0) return 0
        return (x / width * (columns - 1)).roundToInt().coerceIn(0, columns - 1)
    }
}
