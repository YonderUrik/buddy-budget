package io.buddybudget.core.domain.format

/** JavaScript numeric helpers (`Number(string)`, `Math.round`), ported literally. Same as Swift `JSNumber`. */
object JSNumber {
    private fun isJsSpace(c: Char): Boolean = when (c.code) {
        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, in 0x2000..0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF -> true
        else -> false
    }

    /** JS `String.prototype.trim` (WhiteSpace + LineTerminator, incl. U+00A0, U+FEFF, U+202F). */
    fun trim(s: String): String = s.trim { isJsSpace(it) }

    private val decimalLiteral = Regex("[+-]?(Infinity|([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][+-]?[0-9]+)?)")

    /** JS `Number(text)`; null where JS gives NaN. Empty/blank → 0 (as in JS). */
    fun parse(text: String): Double? {
        val s = trim(text)
        if (s.isEmpty()) return 0.0
        val lower = s.lowercase()
        for ((prefix, radix) in listOf("0x" to 16, "0o" to 8, "0b" to 2)) {
            if (lower.startsWith(prefix)) {
                val body = s.substring(2)
                if (body.isEmpty() || body.any { Character.digit(it, radix) < 0 || it.code > 127 }) return null
                var v = 0.0
                for (c in body) v = v * radix + Character.digit(c, radix)
                return v
            }
        }
        if (!decimalLiteral.matches(s)) return null
        val negative = s.startsWith("-")
        val unsigned = s.removePrefix("+").removePrefix("-")
        if (unsigned == "Infinity") return if (negative) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
        // Java's Double.parseDouble is correctly rounded, like JS; the regex already rejected Java-only forms (1d, 0x1p3).
        val v = unsigned.toDouble()
        return if (negative) -v else v
    }

    /** JS `Math.round`: half toward +∞ (`Math.round(-2.5) == -2`). */
    fun round(x: Double): Double {
        if (!x.isFinite() || x == 0.0) return x
        val r = Math.floor(x + 0.5)
        // Guard the 0.49999999999999994 case (x + 0.5 rounds up to 1 in binary).
        if (r - x > 0.5) return r - 1
        return if (r == 0.0 && x < 0) -0.0 else r
    }

    /** `Math.round(x * 100) / 100`. */
    fun round2(x: Double): Double = round(x * 100) / 100

    /** `Math.round((x + Number.EPSILON) * 100) / 100` (debts' `round2`). */
    fun round2Epsilon(x: Double): Double = round((x + Math.ulp(1.0)) * 100) / 100
}
