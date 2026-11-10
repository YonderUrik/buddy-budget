package io.buddybudget.core.domain.format

/**
 * Exact decimal view of a `Double`, as ICU sees it: the **shortest round-trip** digits
 * (`0.005` is `5e-3`, not `0.005000000000000000104…`), then rounded in decimal.
 * That is why `formatCurrency(0.005)` shows `0,01 €` and `1.005` rounds to `1.01`,
 * unlike `toFixed`. See spec/domain/formatting-localization.md.
 *
 * `digits` are significant digits without leading/trailing zeros (empty = zero);
 * value = 0.d1d2d3… × 10^exponent.
 */
internal class FormatDecimal private constructor(val digits: IntArray, val exponent: Int) {
    val isZero: Boolean get() = digits.isEmpty()

    /** floor(log10(value)) for a non-zero value. */
    val magnitude: Int get() = exponent - 1

    fun shifted(by: Int): FormatDecimal = if (isZero) this else of(digits, exponent + by)

    /** Rounds to [fractionDigits] decimals, half away from zero (ICU halfExpand) on the magnitude. */
    fun rounded(fractionDigits: Int): FormatDecimal {
        if (isZero) return this
        val keep = exponent + fractionDigits
        if (keep >= digits.size) return this
        if (keep < 0) return ZERO
        val kept = digits.copyOfRange(0, keep).toMutableList()
        var newExponent = exponent
        if (digits[keep] >= 5) {
            var i = kept.size - 1
            while (i >= 0) {
                if (kept[i] == 9) {
                    kept[i] = 0
                    i--
                } else {
                    kept[i] += 1
                    break
                }
            }
            if (i < 0) {
                kept.add(0, 1)
                newExponent += 1
            }
        }
        return of(kept.toIntArray(), newExponent)
    }

    /** Integer digits ("0" when < 1). */
    val integerDigits: String
        get() {
            if (exponent <= 0 || isZero) return "0"
            val sb = StringBuilder()
            for (i in 0 until exponent) sb.append(if (i < digits.size) digits[i] else 0)
            return sb.toString()
        }

    /** Fraction digits, padded with zeros to at least [minimum]. */
    fun fractionDigits(minimum: Int): String {
        val sb = StringBuilder()
        if (!isZero) {
            if (exponent < 0) repeat(-exponent) { sb.append('0') }
            for (i in maxOf(exponent, 0) until digits.size) sb.append(digits[i])
        }
        while (sb.length < minimum) sb.append('0')
        return sb.toString()
    }

    companion object {
        val ZERO = FormatDecimal(IntArray(0), 0)

        fun of(rawDigits: IntArray, rawExponent: Int): FormatDecimal {
            var start = 0
            var exp = rawExponent
            while (start < rawDigits.size && rawDigits[start] == 0) {
                start++
                exp--
            }
            var end = rawDigits.size
            while (end > start && rawDigits[end - 1] == 0) end--
            return if (start == end) ZERO else FormatDecimal(rawDigits.copyOfRange(start, end), exp)
        }

        /** Shortest round-trip digits of |value| (finite values only). */
        fun of(value: Double): FormatDecimal {
            val magnitude = Math.abs(value)
            if (magnitude == 0.0 || !magnitude.isFinite()) return ZERO
            // JDK 19+ Double.toString is shortest round-trip, except that it may prefer a 2-digit decimal
            // closer to the value when a 1-digit one also round-trips (ICU/Swift/V8 pick the 1-digit one).
            val d = parse(magnitude.toString())
            if (d.digits.size == 2) {
                for (candidate in intArrayOf(d.digits[0], d.digits[0] + 1)) {
                    val one = if (candidate == 10) of(intArrayOf(1), d.exponent + 1) else of(intArrayOf(candidate), d.exponent)
                    if (one.toDouble() == magnitude) return one
                }
            }
            return d
        }

        /** Parses "123.45", "1.0E-5", "1.2345E16". */
        fun parse(text: String): FormatDecimal {
            var mantissa = text
            var exp = 0
            val e = text.indexOfFirst { it == 'e' || it == 'E' }
            if (e >= 0) {
                mantissa = text.substring(0, e)
                exp = text.substring(e + 1).removePrefix("+").toInt()
            }
            val dot = mantissa.indexOf('.')
            val intPart = if (dot >= 0) mantissa.substring(0, dot) else mantissa
            val fracPart = if (dot >= 0) mantissa.substring(dot + 1) else ""
            val all = (intPart + fracPart).filter { it in '0'..'9' }.map { it - '0' }.toIntArray()
            return of(all, intPart.length + exp)
        }
    }

    private fun toDouble(): Double {
        if (isZero) return 0.0
        return ("0." + digits.joinToString("") + "E" + exponent).toDouble()
    }
}
