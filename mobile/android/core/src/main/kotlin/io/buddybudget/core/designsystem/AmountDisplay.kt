package io.buddybudget.core.designsystem

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale

/** How an amount is colored (spec: design/components.md §3.1, §3.9, §3.10). Same cases on iOS (`AmountTone`). */
enum class AmountTone {
    /** Always `--foreground`. */
    Neutral,

    /** Web `StatCard` `tone="auto"`: `value < 0` → `--neg`, else `--pos`. */
    Auto,

    /** Gains and deltas: `> 0` → `--pos`, `< 0` → `--neg`, zero → `--foreground`. */
    Signed,

    /** Movement rows: income (`> 0`) in `--pos`, everything else `--foreground`. */
    Income,

    /** Forced `--pos`. */
    Pos,

    /** Forced `--neg`. */
    Neg,
}

/** The color token an amount resolves to. The UI maps it to `BBColors.*`. */
enum class AmountColorRole { Foreground, Pos, Neg }

/** Text and color of an amount, computed once for both platforms (`AmountText`, `StatCard`, `MoneyHero`). */
data class AmountDisplay(
    /** Integer part (with currency prefix and sign) — or the whole text when not split, or `••••` when masked. */
    val main: String,
    /** Decimal separator, decimals and a trailing currency symbol (0.55 em, `--muted-foreground`). */
    val tail: String,
    val role: AmountColorRole,
    val isMasked: Boolean,
) {
    val text: String get() = main + tail

    companion object {
        /** Color rule per tone. Privacy masking never changes the color (web keeps the tone classes on the mask). */
        fun role(value: Double, tone: AmountTone): AmountColorRole = when (tone) {
            AmountTone.Neutral -> AmountColorRole.Foreground
            AmountTone.Pos -> AmountColorRole.Pos
            AmountTone.Neg -> AmountColorRole.Neg
            AmountTone.Auto -> if (value < 0) AmountColorRole.Neg else AmountColorRole.Pos
            AmountTone.Signed -> when {
                value > 0 -> AmountColorRole.Pos
                value < 0 -> AmountColorRole.Neg
                else -> AmountColorRole.Foreground
            }
            AmountTone.Income -> if (value > 0) AmountColorRole.Pos else AmountColorRole.Foreground
        }

        /**
         * @param signed explicit "+" / "−" (U+2212) like `formatSignedCurrency`.
         * @param maximumFractionDigits 2 by default; 0 for axes, legends and `StatCard`.
         * @param split hero layout (`splitMoney`): main + muted tail. Ignored when `maximumFractionDigits == 0`.
         * @param masked privacy mode (`hideAmounts`): the text becomes [BBFormat.AMOUNT_MASK], no tail.
         */
        fun make(
            value: Double,
            currency: String,
            locale: BBLocale,
            tone: AmountTone = AmountTone.Neutral,
            signed: Boolean = false,
            maximumFractionDigits: Int = 2,
            split: Boolean = false,
            masked: Boolean = false,
        ): AmountDisplay {
            val role = role(value, tone)
            if (masked) return AmountDisplay(BBFormat.AMOUNT_MASK, "", role, true)
            if (split && maximumFractionDigits > 0) {
                val parts = BBFormat.splitMoney(if (signed) Math.abs(value) else value, currency, locale)
                val sign = if (signed) (if (value < 0) BBFormat.MINUS_SIGN else "+") else ""
                return AmountDisplay(sign + parts.main, parts.tail, role, false)
            }
            val text = if (signed) {
                (if (value < 0) BBFormat.MINUS_SIGN else "+") +
                    BBFormat.formatCurrency(Math.abs(value), currency, locale, maximumFractionDigits)
            } else {
                BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits)
            }
            return AmountDisplay(text, "", role, false)
        }
    }
}

/**
 * Placeholder shown by `MerchantLogo` while loading / on failure (components.md §3.7): the first letter or digit
 * of the name (`[\p{L}\p{N}]`), uppercased; `·` if there is none.
 */
object MerchantInitial {
    fun of(name: String): String {
        var i = 0
        while (i < name.length) {
            val cp = name.codePointAt(i)
            val type = Character.getType(cp)
            val isNumber = type == Character.DECIMAL_DIGIT_NUMBER.toInt() ||
                type == Character.LETTER_NUMBER.toInt() || type == Character.OTHER_NUMBER.toInt()
            if (Character.isLetter(cp) || isNumber) return String(Character.toChars(cp)).uppercase()
            i += Character.charCount(cp)
        }
        return "·"
    }
}

/**
 * Live normalization of an amount typed in `BBTextField(keyboard = Amount)` (components.md §1.4): keeps ASCII
 * digits, a leading minus (also U+2212) and one decimal separator — "," or "." typed, the locale's one written.
 */
object AmountInput {
    fun normalize(raw: String, locale: BBLocale): String {
        val decimal = if (locale == BBLocale.EN_GB) '.' else ','
        val out = StringBuilder()
        var hasDecimal = false
        raw.forEachIndexed { i, ch ->
            when {
                ch in '0'..'9' -> out.append(ch)
                (ch == '-' || ch == '−') && i == 0 -> out.append('-')
                (ch == ',' || ch == '.') && !hasDecimal -> {
                    hasDecimal = true
                    out.append(decimal)
                }
            }
        }
        return out.toString()
    }
}
