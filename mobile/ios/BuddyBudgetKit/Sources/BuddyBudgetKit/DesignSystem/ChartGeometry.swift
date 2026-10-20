import Foundation

// Chart geometry shared by iOS and Android (spec: design/charts.md §1 and §4). Pure functions on plain numbers,
// unit-tested on both platforms with the same vectors; the UI only maps the commands onto Path/Canvas.
// Coordinates are screen coordinates: x to the right, y down.

public struct ChartPoint: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

/// One drawing command. `arc` angles are in degrees on screen (0 = 3 o'clock, positive sweep = clockwise on
/// screen), the convention of Compose `Path.arcTo` and SwiftUI `Path.addRelativeArc` in a y-down space.
public enum ChartPathCommand: Equatable, Sendable {
    case move(ChartPoint)
    case line(ChartPoint)
    case cubic(ChartPoint, ChartPoint, ChartPoint)
    case arc(center: ChartPoint, radius: Double, startDegrees: Double, sweepDegrees: Double)
    case close
}

/// Curve type per series (charts.md §0 rule 7).
public enum ChartCurve: String, Sendable {
    /// Recharts `type="monotone"` = d3 `curveMonotoneX`.
    case monotone
    /// No `type`: straight segments.
    case linear
    /// Hand-drawn `smoothPath` (TrendChart, Sparkline): cubic with horizontal tangents.
    case smooth
    /// `type="stepAfter"`: horizontal then vertical.
    case stepAfter
}

public enum ChartPaths {
    /// Path through `points` (sorted by x) with the given curve.
    public static func line(_ points: [ChartPoint], curve: ChartCurve) -> [ChartPathCommand] {
        guard let first = points.first else { return [] }
        var out: [ChartPathCommand] = [.move(first)]
        guard points.count > 1 else { return out }
        switch curve {
        case .linear:
            out += points.dropFirst().map { .line($0) }
        case .smooth:
            for i in 1..<points.count {
                let mid = (points[i - 1].x + points[i].x) / 2
                out.append(.cubic(ChartPoint(x: mid, y: points[i - 1].y), ChartPoint(x: mid, y: points[i].y), points[i]))
            }
        case .stepAfter:
            for i in 1..<points.count {
                out.append(.line(ChartPoint(x: points[i].x, y: points[i - 1].y)))
                out.append(.line(points[i]))
            }
        case .monotone:
            if points.count == 2 {
                out.append(.line(points[1]))
                return out
            }
            let t = monotoneTangents(points)
            for i in 0..<(points.count - 1) {
                let p0 = points[i], p1 = points[i + 1]
                let d = (p1.x - p0.x) / 3
                out.append(.cubic(ChartPoint(x: p0.x + d, y: p0.y + d * t[i]),
                                  ChartPoint(x: p1.x - d, y: p1.y - d * t[i + 1]), p1))
            }
        }
        return out
    }

    /// Closed area under the line down to `baselineY` (screen y of the domain minimum or of 0).
    public static func area(_ points: [ChartPoint], curve: ChartCurve, baselineY: Double) -> [ChartPathCommand] {
        guard let first = points.first, let last = points.last else { return [] }
        return line(points, curve: curve) + [
            .line(ChartPoint(x: last.x, y: baselineY)),
            .line(ChartPoint(x: first.x, y: baselineY)),
            .close,
        ]
    }

    /// d3 `curveMonotoneX` tangents (Steffen 1990), charts.md §4.2.
    static func monotoneTangents(_ p: [ChartPoint]) -> [Double] {
        let n = p.count
        var h = [Double](repeating: 0, count: n - 1)
        var s = [Double](repeating: 0, count: n - 1)
        for i in 0..<(n - 1) {
            h[i] = p[i + 1].x - p[i].x
            s[i] = h[i] == 0 ? 0 : (p[i + 1].y - p[i].y) / h[i]
        }
        var t = [Double](repeating: 0, count: n)
        func sign(_ x: Double) -> Double { x < 0 ? -1 : 1 }
        for i in 1..<(n - 1) {
            let p0 = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i])
            let v = (sign(s[i - 1]) + sign(s[i])) * min(abs(s[i - 1]), abs(s[i]), 0.5 * abs(p0))
            t[i] = v.isNaN ? 0 : v
        }
        t[0] = h[0] == 0 ? t[1] : (3 * s[0] - t[1]) / 2
        t[n - 1] = h[n - 2] == 0 ? t[n - 2] : (3 * s[n - 2] - t[n - 2]) / 2
        return t
    }
}

public enum ChartScale {
    /// Recharts `getNiceTickValues([min, max], tickCount, allowDecimals = true)` (charts.md §4.4).
    public static func niceTicks(min lo: Double, max hi: Double, tickCount: Int = 5) -> [Double] {
        let count = Swift.max(tickCount, 2)
        let (a, b) = lo > hi ? (hi, lo) : (lo, hi)
        guard a.isFinite, b.isFinite else { return [] }
        if a == b { return singleValueTicks(a, tickCount: tickCount) }
        let (step, tickMin, tickMax) = calculateStep(min: a, max: b, tickCount: count, correction: 0)
        var values: [Double] = []
        var v = tickMin
        let end = tickMax + 0.1 * step
        var i = 0
        while v < end && i < 100_000 {
            values.append(clean(v))
            v = clean(v + step)
            i += 1
        }
        return lo > hi ? values.reversed() : values
    }

    /// Hero charts: hidden Y axis, domain `[min × 0.9, max × 1.01]`, expanded to contain the data
    /// (Recharts never clips data when `allowDataOverflow` is false). A flat or empty series gets ±1.
    public static func heroDomain(_ values: [Double]) -> ClosedRange<Double> {
        guard let lo = values.min(), let hi = values.max() else { return 0...1 }
        let a = Swift.min(lo * 0.9, lo)
        let b = Swift.max(hi * 1.01, hi)
        return a == b ? (a - 1)...(b + 1) : a...b
    }

    /// Screen y of `value` in a plot of `height` (top inset included), domain bottom at `top + height`.
    public static func y(_ value: Double, domain: ClosedRange<Double>, top: Double, height: Double) -> Double {
        let span = domain.upperBound - domain.lowerBound
        guard span > 0 else { return top + height / 2 }
        return top + height * (1 - (value - domain.lowerBound) / span)
    }

    /// Screen x of index `i` of `count` evenly spaced points across `width` (one point → centered).
    public static func x(index i: Int, count: Int, left: Double = 0, width: Double) -> Double {
        count > 1 ? left + Double(i) * width / Double(count - 1) : left + width / 2
    }

    /// Scrub: nearest index under the finger, `round(x / plotWidth × (n − 1))`, clamped (charts.md §1).
    public static func scrubIndex(x: Double, plotWidth: Double, count: Int) -> Int {
        guard count > 1, plotWidth > 0 else { return 0 }
        let raw = (x / plotWidth * Double(count - 1)).rounded(.toNearestOrAwayFromZero)
        return Int(Swift.min(Swift.max(raw, 0), Double(count - 1)))
    }

    /// Pinned tooltip center: follows the scrub x, clamped to 14 %…86 % of the chart width (TrendChart rule).
    public static func tooltipCenterX(_ x: Double, width: Double) -> Double {
        Swift.min(Swift.max(x, width * 0.14), width * 0.86)
    }

    // MARK: Recharts internals

    private static func digitCount(_ value: Double) -> Int {
        value == 0 ? 1 : Int(floor(log10(abs(value)))) + 1
    }

    private static func adaptiveStep(_ rough: Double, correction: Int) -> Double {
        guard rough > 0 else { return 0 }
        let digits = digitCount(rough)
        let magnitude = clean(pow(10, Double(digits)))
        let ratio = clean(rough / magnitude)
        let scale = digits != 1 ? 0.05 : 0.1
        let amended = clean((ceil(clean(ratio / scale)) + Double(correction)) * scale)
        return clean(amended * magnitude)
    }

    private static func calculateStep(min: Double, max: Double, tickCount: Int, correction: Int)
        -> (step: Double, tickMin: Double, tickMax: Double) {
        guard ((max - min) / Double(tickCount - 1)).isFinite else { return (0, 0, 0) }
        let step = adaptiveStep(clean((max - min) / Double(tickCount - 1)), correction: correction)
        var middle: Double
        if min <= 0 && max >= 0 {
            middle = 0
        } else {
            middle = clean((min + max) / 2)
            middle = clean(middle - clean(middle.truncatingRemainder(dividingBy: step)))
        }
        var below = Int(ceil(clean((middle - min) / step)))
        var up = Int(ceil(clean((max - middle) / step)))
        let scaleCount = below + up + 1
        if scaleCount > tickCount {
            return calculateStep(min: min, max: max, tickCount: tickCount, correction: correction + 1)
        }
        if scaleCount < tickCount {
            if max > 0 { up += tickCount - scaleCount } else { below += tickCount - scaleCount }
        }
        return (step, clean(middle - Double(below) * step), clean(middle + Double(up) * step))
    }

    private static func singleValueTicks(_ value: Double, tickCount: Int) -> [Double] {
        var step = 1.0
        var middle = value
        if value.rounded(.towardZero) != value {
            if abs(value) < 1 {
                step = clean(pow(10, Double(digitCount(value) - 1)))
                middle = clean(floor(clean(middle / step)) * step)
            } else {
                middle = floor(value)
            }
        } else if value == 0 {
            middle = floor(Double(tickCount - 1) / 2)
        }
        let middleIndex = (tickCount - 1) / 2
        return (0..<tickCount).map { clean(middle + Double($0 - middleIndex) * step) }
    }

    /// Removes binary noise so results match Recharts' decimal arithmetic (12 significant digits).
    static func clean(_ x: Double) -> Double {
        guard x.isFinite, x != 0 else { return x }
        let magnitude = pow(10, 11 - floor(log10(abs(x))))
        let r = (x * magnitude).rounded() / magnitude
        return r == 0 ? 0 : r
    }
}

/// `Sparkline` geometry (charts.md §3): x evenly spread over `width`, y padded 2 pt, flat series → span 1.
public enum SparklineGeometry {
    public static func points(_ values: [Double], width: Double, height: Double) -> [ChartPoint] {
        guard values.count >= 2, let low = values.min(), let high = values.max() else { return [] }
        let span = high - low == 0 ? 1 : high - low
        return values.enumerated().map { i, v in
            ChartPoint(x: Double(i) * width / Double(values.count - 1), y: 2 + (height - 4) * (1 - (v - low) / span))
        }
    }
}

/// Donut geometry: Recharts `Pie` angles + `Sector` with `cornerRadius` (charts.md §2.2–2.3, §4.4).
/// Angles start at 0° (3 o'clock) and go counter-clockwise, `paddingAngle` between slices.
public enum DonutGeometry {
    public struct Slice: Equatable, Sendable {
        /// Recharts angles in degrees, counter-clockwise from 3 o'clock.
        public let startAngle: Double
        public let endAngle: Double
        public var midAngle: Double { (startAngle + endAngle) / 2 }
    }

    /// Slice angles for `values` (negative values count as 0, like a missing value).
    public static func slices(_ values: [Double], paddingAngle: Double = 2, startAngle: Double = 0,
                              endAngle: Double = 360) -> [Slice] {
        let clamped = values.map { Swift.max(0, $0) }
        let padding = clamped.count <= 1 ? 0 : paddingAngle
        let delta = endAngle - startAngle
        let absDelta = Swift.min(abs(delta), 360)
        let sign: Double = delta < 0 ? -1 : 1
        let nonZero = clamped.filter { $0 != 0 }.count
        let totalPadding = Double(absDelta >= 360 ? nonZero : Swift.max(nonZero - 1, 0)) * padding
        let realTotal = absDelta - totalPadding
        let sum = clamped.reduce(0, +)
        guard sum > 0 else { return clamped.map { _ in Slice(startAngle: startAngle, endAngle: startAngle) } }
        var out: [Slice] = []
        for (i, v) in clamped.enumerated() {
            let start = i == 0 ? startAngle : out[i - 1].endAngle + sign * padding * (v != 0 ? 1 : 0)
            out.append(Slice(startAngle: start, endAngle: start + sign * (v / sum) * realTotal))
        }
        return out
    }

    /// Recharts `polarToCartesian`: angle counter-clockwise from 3 o'clock, y down.
    public static func point(cx: Double, cy: Double, radius: Double, angle: Double) -> ChartPoint {
        let rad = -angle * .pi / 180
        return ChartPoint(x: cx + cos(rad) * radius, y: cy + sin(rad) * radius)
    }

    /// Annular sector outline with rounded corners (Recharts `getSectorWithCorner`, cornerIsExternal false).
    public static func sectorPath(cx: Double, cy: Double, innerRadius: Double, outerRadius: Double,
                                  startAngle: Double, endAngle: Double, cornerRadius: Double) -> [ChartPathCommand] {
        let deltaAngle = endAngle - startAngle
        guard deltaAngle != 0 else { return [] }
        let sign: Double = deltaAngle < 0 ? -1 : 1
        let maxCorner = (outerRadius - innerRadius) / 2
        let r = Swift.min(cornerRadius, maxCorner)
        if r <= 0 || abs(deltaAngle) >= 360 { return plainSector(cx: cx, cy: cy, innerRadius: innerRadius, outerRadius: outerRadius,
                                       startAngle: startAngle, endAngle: endAngle) }

        let so = tangentCircle(cx: cx, cy: cy, radius: outerRadius, angle: startAngle, sign: sign, isExternal: false, corner: r)
        let eo = tangentCircle(cx: cx, cy: cy, radius: outerRadius, angle: endAngle, sign: -sign, isExternal: false, corner: r)
        let outerArc = abs(deltaAngle) - so.theta - eo.theta
        if outerArc < 0 {
            return plainSector(cx: cx, cy: cy, innerRadius: innerRadius, outerRadius: outerRadius,
                               startAngle: startAngle, endAngle: endAngle)
        }
        let center = ChartPoint(x: cx, y: cy)
        var out: [ChartPathCommand] = [.move(so.lineTangency)]
        out.append(cornerArc(so.center, r, from: so.lineTangency, to: so.circleTangency))
        // Outer arc from the start corner to the end corner (screen angle = −recharts angle).
        let oStart = -(startAngle + sign * so.theta)
        out.append(.arc(center: center, radius: outerRadius, startDegrees: oStart, sweepDegrees: -sign * outerArc))
        out.append(cornerArc(eo.center, r, from: eo.circleTangency, to: eo.lineTangency))
        if innerRadius > 0 {
            let si = tangentCircle(cx: cx, cy: cy, radius: innerRadius, angle: startAngle, sign: sign, isExternal: true, corner: r)
            let ei = tangentCircle(cx: cx, cy: cy, radius: innerRadius, angle: endAngle, sign: -sign, isExternal: true, corner: r)
            let innerArc = abs(deltaAngle) - si.theta - ei.theta
            out.append(.line(ei.lineTangency))
            out.append(cornerArc(ei.center, r, from: ei.lineTangency, to: ei.circleTangency))
            let iStart = -(endAngle - sign * ei.theta)
            out.append(.arc(center: center, radius: innerRadius, startDegrees: iStart, sweepDegrees: sign * innerArc))
            out.append(cornerArc(si.center, r, from: si.circleTangency, to: si.lineTangency))
        } else {
            out.append(.line(center))
        }
        out.append(.close)
        return out
    }

    private static func plainSector(cx: Double, cy: Double, innerRadius: Double, outerRadius: Double,
                                    startAngle: Double, endAngle: Double) -> [ChartPathCommand] {
        let center = ChartPoint(x: cx, y: cy)
        let sweep = endAngle - startAngle
        var out: [ChartPathCommand] = [
            .move(point(cx: cx, cy: cy, radius: outerRadius, angle: startAngle)),
            .arc(center: center, radius: outerRadius, startDegrees: -startAngle, sweepDegrees: -sweep),
        ]
        if innerRadius > 0 {
            out.append(.line(point(cx: cx, cy: cy, radius: innerRadius, angle: endAngle)))
            out.append(.arc(center: center, radius: innerRadius, startDegrees: -endAngle, sweepDegrees: sweep))
        } else {
            out.append(.line(center))
        }
        out.append(.close)
        return out
    }

    private struct Tangent {
        let center: ChartPoint
        let circleTangency: ChartPoint
        let lineTangency: ChartPoint
        let theta: Double
    }

    private static func tangentCircle(cx: Double, cy: Double, radius: Double, angle: Double, sign: Double,
                                      isExternal: Bool, corner: Double) -> Tangent {
        let centerRadius = corner * (isExternal ? 1 : -1) + radius
        let theta = asin(corner / centerRadius) * 180 / .pi
        let centerAngle = angle + sign * theta
        return Tangent(
            center: point(cx: cx, cy: cy, radius: centerRadius, angle: centerAngle),
            circleTangency: point(cx: cx, cy: cy, radius: radius, angle: centerAngle),
            lineTangency: point(cx: cx, cy: cy, radius: centerRadius * cos(theta * .pi / 180), angle: angle),
            theta: theta
        )
    }

    /// Short arc on the corner circle from `a` to `b` (both on the circle).
    private static func cornerArc(_ c: ChartPoint, _ r: Double, from a: ChartPoint, to b: ChartPoint) -> ChartPathCommand {
        let start = atan2(a.y - c.y, a.x - c.x) * 180 / .pi
        let end = atan2(b.y - c.y, b.x - c.x) * 180 / .pi
        var sweep = end - start
        while sweep > 180 { sweep -= 360 }
        while sweep <= -180 { sweep += 360 }
        return .arc(center: c, radius: r, startDegrees: start, sweepDegrees: sweep)
    }

    /// Index of the slice under a tap at `(x, y)`, or nil (outside the ring or in a padding gap).
    public static func hitTest(x: Double, y: Double, cx: Double, cy: Double, innerRadius: Double,
                               outerRadius: Double, slices: [Slice]) -> Int? {
        let dx = x - cx, dy = y - cy
        let distance = (dx * dx + dy * dy).squareRoot()
        guard distance >= innerRadius, distance <= outerRadius else { return nil }
        var angle = atan2(-dy, dx) * 180 / .pi // counter-clockwise from 3 o'clock
        if angle < 0 { angle += 360 }
        for (i, s) in slices.enumerated() {
            let lo = Swift.min(s.startAngle, s.endAngle), hi = Swift.max(s.startAngle, s.endAngle)
            if (angle >= lo && angle <= hi) || (angle + 360 >= lo && angle + 360 <= hi) { return i }
        }
        return nil
    }
}
