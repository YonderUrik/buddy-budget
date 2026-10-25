package io.buddybudget.core.designsystem

import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

// Chart geometry shared by iOS and Android (spec: design/charts.md §1 and §4). Pure functions on plain numbers,
// unit-tested on both platforms with the same vectors; the UI only maps the commands onto Path/Canvas.
// Coordinates are screen coordinates: x to the right, y down.

data class ChartPoint(val x: Double, val y: Double)

/**
 * One drawing command. `Arc` angles are in degrees on screen (0 = 3 o'clock, positive sweep = clockwise on
 * screen), the convention of Compose `Path.arcTo` and SwiftUI `Path.addRelativeArc` in a y-down space.
 */
sealed interface ChartPathCommand {
    data class Move(val p: ChartPoint) : ChartPathCommand
    data class Line(val p: ChartPoint) : ChartPathCommand
    data class Cubic(val c1: ChartPoint, val c2: ChartPoint, val to: ChartPoint) : ChartPathCommand
    data class Arc(val center: ChartPoint, val radius: Double, val startDegrees: Double, val sweepDegrees: Double) :
        ChartPathCommand
    data object Close : ChartPathCommand
}

/** Curve type per series (charts.md §0 rule 7). */
enum class ChartCurve {
    /** Recharts `type="monotone"` = d3 `curveMonotoneX`. */
    Monotone,

    /** No `type`: straight segments. */
    Linear,

    /** Hand-drawn `smoothPath` (TrendChart, Sparkline): cubic with horizontal tangents. */
    Smooth,

    /** `type="stepAfter"`: horizontal then vertical. */
    StepAfter,
}

object ChartPaths {
    /** Path through [points] (sorted by x) with the given curve. */
    fun line(points: List<ChartPoint>, curve: ChartCurve): List<ChartPathCommand> {
        if (points.isEmpty()) return emptyList()
        val out = mutableListOf<ChartPathCommand>(ChartPathCommand.Move(points[0]))
        if (points.size == 1) return out
        when (curve) {
            ChartCurve.Linear -> points.drop(1).forEach { out += ChartPathCommand.Line(it) }
            ChartCurve.Smooth -> for (i in 1 until points.size) {
                val mid = (points[i - 1].x + points[i].x) / 2
                out += ChartPathCommand.Cubic(ChartPoint(mid, points[i - 1].y), ChartPoint(mid, points[i].y), points[i])
            }
            ChartCurve.StepAfter -> for (i in 1 until points.size) {
                out += ChartPathCommand.Line(ChartPoint(points[i].x, points[i - 1].y))
                out += ChartPathCommand.Line(points[i])
            }
            ChartCurve.Monotone -> {
                if (points.size == 2) {
                    out += ChartPathCommand.Line(points[1])
                    return out
                }
                val t = monotoneTangents(points)
                for (i in 0 until points.size - 1) {
                    val p0 = points[i]
                    val p1 = points[i + 1]
                    val d = (p1.x - p0.x) / 3
                    out += ChartPathCommand.Cubic(
                        ChartPoint(p0.x + d, p0.y + d * t[i]),
                        ChartPoint(p1.x - d, p1.y - d * t[i + 1]),
                        p1,
                    )
                }
            }
        }
        return out
    }

    /** Closed area under the line down to [baselineY] (screen y of the domain minimum or of 0). */
    fun area(points: List<ChartPoint>, curve: ChartCurve, baselineY: Double): List<ChartPathCommand> {
        if (points.isEmpty()) return emptyList()
        return line(points, curve) + listOf(
            ChartPathCommand.Line(ChartPoint(points.last().x, baselineY)),
            ChartPathCommand.Line(ChartPoint(points.first().x, baselineY)),
            ChartPathCommand.Close,
        )
    }

    /** d3 `curveMonotoneX` tangents (Steffen 1990), charts.md §4.2. */
    internal fun monotoneTangents(p: List<ChartPoint>): DoubleArray {
        val n = p.size
        val h = DoubleArray(n - 1) { p[it + 1].x - p[it].x }
        val s = DoubleArray(n - 1) { if (h[it] == 0.0) 0.0 else (p[it + 1].y - p[it].y) / h[it] }
        val t = DoubleArray(n)
        fun sign(x: Double) = if (x < 0) -1.0 else 1.0
        for (i in 1 until n - 1) {
            val p0 = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i])
            val v = (sign(s[i - 1]) + sign(s[i])) * minOf(abs(s[i - 1]), abs(s[i]), 0.5 * abs(p0))
            t[i] = if (v.isNaN()) 0.0 else v
        }
        t[0] = if (h[0] == 0.0) t[1] else (3 * s[0] - t[1]) / 2
        t[n - 1] = if (h[n - 2] == 0.0) t[n - 2] else (3 * s[n - 2] - t[n - 2]) / 2
        return t
    }
}

object ChartScale {
    /** Recharts `getNiceTickValues([min, max], tickCount, allowDecimals = true)` (charts.md §4.4). */
    fun niceTicks(min: Double, max: Double, tickCount: Int = 5): List<Double> {
        val count = max(tickCount, 2)
        val a = min(min, max)
        val b = max(min, max)
        if (!a.isFinite() || !b.isFinite()) return emptyList()
        if (a == b) return singleValueTicks(a, tickCount)
        val (step, tickMin, tickMax) = calculateStep(a, b, count, 0)
        val values = mutableListOf<Double>()
        var v = tickMin
        val end = tickMax + 0.1 * step
        var i = 0
        while (v < end && i < 100_000) {
            values += clean(v)
            v = clean(v + step)
            i++
        }
        return if (min > max) values.reversed() else values
    }

    /**
     * Hero charts: hidden Y axis, domain `[min × 0.9, max × 1.01]`, expanded to contain the data
     * (Recharts never clips data when `allowDataOverflow` is false). A flat or empty series gets ±1.
     */
    fun heroDomain(values: List<Double>): ClosedFloatingPointRange<Double> {
        if (values.isEmpty()) return 0.0..1.0
        val lo = values.min()
        val hi = values.max()
        val a = min(lo * 0.9, lo)
        val b = max(hi * 1.01, hi)
        return if (a == b) (a - 1)..(b + 1) else a..b
    }

    /** Screen y of [value] in a plot of [height] (top inset included), domain bottom at `top + height`. */
    fun y(value: Double, domain: ClosedFloatingPointRange<Double>, top: Double, height: Double): Double {
        val span = domain.endInclusive - domain.start
        if (span <= 0) return top + height / 2
        return top + height * (1 - (value - domain.start) / span)
    }

    /** Screen x of index [index] of [count] evenly spaced points across [width] (one point → centered). */
    fun x(index: Int, count: Int, left: Double = 0.0, width: Double): Double =
        if (count > 1) left + index * width / (count - 1) else left + width / 2

    /** Scrub: nearest index under the finger, `round(x / plotWidth × (n − 1))`, clamped (charts.md §1). */
    fun scrubIndex(x: Double, plotWidth: Double, count: Int): Int {
        if (count <= 1 || plotWidth <= 0) return 0
        val raw = jsRoundHalfAway(x / plotWidth * (count - 1))
        return min(max(raw, 0.0), (count - 1).toDouble()).toInt()
    }

    /** Pinned tooltip center: follows the scrub x, clamped to 14 %…86 % of the chart width (TrendChart rule). */
    fun tooltipCenterX(x: Double, width: Double): Double = min(max(x, width * 0.14), width * 0.86)

    // Recharts internals

    private fun jsRoundHalfAway(x: Double): Double = if (x < 0) -floor(-x + 0.5) else floor(x + 0.5)

    private fun digitCount(value: Double): Int = if (value == 0.0) 1 else floor(log10(abs(value))).toInt() + 1

    private fun adaptiveStep(rough: Double, correction: Int): Double {
        if (rough <= 0) return 0.0
        val digits = digitCount(rough)
        val magnitude = clean(10.0.pow(digits))
        val ratio = clean(rough / magnitude)
        val scale = if (digits != 1) 0.05 else 0.1
        val amended = clean((ceil(clean(ratio / scale)) + correction) * scale)
        return clean(amended * magnitude)
    }

    private data class Step(val step: Double, val tickMin: Double, val tickMax: Double)

    private fun calculateStep(min: Double, max: Double, tickCount: Int, correction: Int): Step {
        if (!((max - min) / (tickCount - 1)).isFinite()) return Step(0.0, 0.0, 0.0)
        val step = adaptiveStep(clean((max - min) / (tickCount - 1)), correction)
        var middle: Double
        if (min <= 0 && max >= 0) {
            middle = 0.0
        } else {
            middle = clean((min + max) / 2)
            middle = clean(middle - clean(middle.rem(step)))
        }
        var below = ceil(clean((middle - min) / step)).toInt()
        var up = ceil(clean((max - middle) / step)).toInt()
        val scaleCount = below + up + 1
        if (scaleCount > tickCount) return calculateStep(min, max, tickCount, correction + 1)
        if (scaleCount < tickCount) {
            if (max > 0) up += tickCount - scaleCount else below += tickCount - scaleCount
        }
        return Step(step, clean(middle - below * step), clean(middle + up * step))
    }

    private fun singleValueTicks(value: Double, tickCount: Int): List<Double> {
        var step = 1.0
        var middle = value
        if (value != value.toLong().toDouble()) {
            if (abs(value) < 1) {
                step = clean(10.0.pow(digitCount(value) - 1))
                middle = clean(floor(clean(middle / step)) * step)
            } else {
                middle = floor(value)
            }
        } else if (value == 0.0) {
            middle = floor((tickCount - 1) / 2.0)
        }
        val middleIndex = (tickCount - 1) / 2
        return (0 until tickCount).map { clean(middle + (it - middleIndex) * step) }
    }

    /** Removes binary noise so results match Recharts' decimal arithmetic (12 significant digits). */
    internal fun clean(x: Double): Double {
        if (!x.isFinite() || x == 0.0) return x
        val magnitude = 10.0.pow(11 - floor(log10(abs(x))))
        val scaled = x * magnitude
        val r = (if (scaled < 0) -floor(-scaled + 0.5) else floor(scaled + 0.5)) / magnitude
        return if (r == 0.0) 0.0 else r
    }
}

/** `Sparkline` geometry (charts.md §3): x evenly spread over `width`, y padded 2 pt, flat series → span 1. */
object SparklineGeometry {
    fun points(values: List<Double>, width: Double, height: Double): List<ChartPoint> {
        if (values.size < 2) return emptyList()
        val low = values.min()
        val span = (values.max() - low).let { if (it == 0.0) 1.0 else it }
        return values.mapIndexed { i, v ->
            ChartPoint(i * width / (values.size - 1), 2 + (height - 4) * (1 - (v - low) / span))
        }
    }
}

/**
 * Donut geometry: Recharts `Pie` angles + `Sector` with `cornerRadius` (charts.md §2.2–2.3, §4.4).
 * Angles start at 0° (3 o'clock) and go counter-clockwise, `paddingAngle` between slices.
 */
object DonutGeometry {
    /** Recharts angles in degrees, counter-clockwise from 3 o'clock. */
    data class Slice(val startAngle: Double, val endAngle: Double) {
        val midAngle: Double get() = (startAngle + endAngle) / 2
    }

    /** Slice angles for [values] (negative values count as 0, like a missing value). */
    fun slices(values: List<Double>, paddingAngle: Double = 2.0, startAngle: Double = 0.0, endAngle: Double = 360.0): List<Slice> {
        val clamped = values.map { max(0.0, it) }
        val padding = if (clamped.size <= 1) 0.0 else paddingAngle
        val delta = endAngle - startAngle
        val absDelta = min(abs(delta), 360.0)
        val sign = if (delta < 0) -1.0 else 1.0
        val nonZero = clamped.count { it != 0.0 }
        val totalPadding = (if (absDelta >= 360) nonZero else max(nonZero - 1, 0)) * padding
        val realTotal = absDelta - totalPadding
        val sum = clamped.sum()
        if (sum <= 0) return clamped.map { Slice(startAngle, startAngle) }
        val out = mutableListOf<Slice>()
        clamped.forEachIndexed { i, v ->
            val start = if (i == 0) startAngle else out[i - 1].endAngle + sign * padding * (if (v != 0.0) 1 else 0)
            out += Slice(start, start + sign * (v / sum) * realTotal)
        }
        return out
    }

    /** Recharts `polarToCartesian`: angle counter-clockwise from 3 o'clock, y down. */
    fun point(cx: Double, cy: Double, radius: Double, angle: Double): ChartPoint {
        val rad = -angle * Math.PI / 180
        return ChartPoint(cx + cos(rad) * radius, cy + sin(rad) * radius)
    }

    /** Annular sector outline with rounded corners (Recharts `getSectorWithCorner`, cornerIsExternal false). */
    fun sectorPath(
        cx: Double,
        cy: Double,
        innerRadius: Double,
        outerRadius: Double,
        startAngle: Double,
        endAngle: Double,
        cornerRadius: Double,
    ): List<ChartPathCommand> {
        val deltaAngle = endAngle - startAngle
        if (deltaAngle == 0.0) return emptyList()
        val sign = if (deltaAngle < 0) -1.0 else 1.0
        val r = min(cornerRadius, (outerRadius - innerRadius) / 2)
        if (r <= 0 || abs(deltaAngle) >= 360) return plainSector(cx, cy, innerRadius, outerRadius, startAngle, endAngle)

        val so = tangentCircle(cx, cy, outerRadius, startAngle, sign, false, r)
        val eo = tangentCircle(cx, cy, outerRadius, endAngle, -sign, false, r)
        val outerArc = abs(deltaAngle) - so.theta - eo.theta
        if (outerArc < 0) return plainSector(cx, cy, innerRadius, outerRadius, startAngle, endAngle)
        val center = ChartPoint(cx, cy)
        val out = mutableListOf<ChartPathCommand>(ChartPathCommand.Move(so.lineTangency))
        out += cornerArc(so.center, r, so.lineTangency, so.circleTangency)
        out += ChartPathCommand.Arc(center, outerRadius, -(startAngle + sign * so.theta), -sign * outerArc)
        out += cornerArc(eo.center, r, eo.circleTangency, eo.lineTangency)
        if (innerRadius > 0) {
            val si = tangentCircle(cx, cy, innerRadius, startAngle, sign, true, r)
            val ei = tangentCircle(cx, cy, innerRadius, endAngle, -sign, true, r)
            val innerArc = abs(deltaAngle) - si.theta - ei.theta
            out += ChartPathCommand.Line(ei.lineTangency)
            out += cornerArc(ei.center, r, ei.lineTangency, ei.circleTangency)
            out += ChartPathCommand.Arc(center, innerRadius, -(endAngle - sign * ei.theta), sign * innerArc)
            out += cornerArc(si.center, r, si.circleTangency, si.lineTangency)
        } else {
            out += ChartPathCommand.Line(center)
        }
        out += ChartPathCommand.Close
        return out
    }

    private fun plainSector(cx: Double, cy: Double, innerRadius: Double, outerRadius: Double, startAngle: Double, endAngle: Double): List<ChartPathCommand> {
        val center = ChartPoint(cx, cy)
        val sweep = endAngle - startAngle
        val out = mutableListOf(
            ChartPathCommand.Move(point(cx, cy, outerRadius, startAngle)),
            ChartPathCommand.Arc(center, outerRadius, -startAngle, -sweep),
        )
        if (innerRadius > 0) {
            out += ChartPathCommand.Line(point(cx, cy, innerRadius, endAngle))
            out += ChartPathCommand.Arc(center, innerRadius, -endAngle, sweep)
        } else {
            out += ChartPathCommand.Line(center)
        }
        out += ChartPathCommand.Close
        return out
    }

    private class Tangent(val center: ChartPoint, val circleTangency: ChartPoint, val lineTangency: ChartPoint, val theta: Double)

    private fun tangentCircle(cx: Double, cy: Double, radius: Double, angle: Double, sign: Double, isExternal: Boolean, corner: Double): Tangent {
        val centerRadius = corner * (if (isExternal) 1 else -1) + radius
        val theta = asin(corner / centerRadius) * 180 / Math.PI
        val centerAngle = angle + sign * theta
        return Tangent(
            center = point(cx, cy, centerRadius, centerAngle),
            circleTangency = point(cx, cy, radius, centerAngle),
            lineTangency = point(cx, cy, centerRadius * cos(theta * Math.PI / 180), angle),
            theta = theta,
        )
    }

    /** Short arc on the corner circle from [a] to [b] (both on the circle). */
    private fun cornerArc(c: ChartPoint, r: Double, a: ChartPoint, b: ChartPoint): ChartPathCommand {
        val start = atan2(a.y - c.y, a.x - c.x) * 180 / Math.PI
        val end = atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI
        var sweep = end - start
        while (sweep > 180) sweep -= 360
        while (sweep <= -180) sweep += 360
        return ChartPathCommand.Arc(c, r, start, sweep)
    }

    /** Index of the slice under a tap at ([x], [y]), or null (outside the ring or in a padding gap). */
    fun hitTest(x: Double, y: Double, cx: Double, cy: Double, innerRadius: Double, outerRadius: Double, slices: List<Slice>): Int? {
        val dx = x - cx
        val dy = y - cy
        val distance = sqrt(dx * dx + dy * dy)
        if (distance < innerRadius || distance > outerRadius) return null
        var angle = atan2(-dy, dx) * 180 / Math.PI
        if (angle < 0) angle += 360
        slices.forEachIndexed { i, s ->
            val lo = min(s.startAngle, s.endAngle)
            val hi = max(s.startAngle, s.endAngle)
            if ((angle in lo..hi) || (angle + 360 in lo..hi)) return i
        }
        return null
    }
}
