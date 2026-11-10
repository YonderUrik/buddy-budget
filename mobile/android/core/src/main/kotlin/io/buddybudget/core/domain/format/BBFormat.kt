package io.buddybudget.core.domain.format

import io.buddybudget.core.domain.periods.CalendarDate
import java.time.Instant
import java.time.ZoneId

/**
 * Deterministic number, currency, percent, date and relative-time formatting, identical to the web
 * (`lib/format.ts`, `lib/localization/format.ts`, Node 25 / ICU 78 / CLDR 48) byte for byte.
 *
 * Never uses `DecimalFormat` / `NumberFormat` / `DateTimeFormatter` / `android.icu`: output is built from
 * the bundled `locale-data.json` so Android, iOS and the web agree regardless of the OS's CLDR version.
 * Function names and options mirror the web's `localizedFormats(locale)`; the locale is always explicit.
 * Spec: `spec/domain/formatting-localization.md` § "Native API". Golden vectors: `formatting.json`.
 */
object BBFormat {
    /** Shown instead of every `formatCurrency` output while amounts are hidden (4 × U+2022). */
    const val AMOUNT_MASK = "\u2022\u2022\u2022\u2022"

    /** U+2212, used by the signed formatters. */
    const val MINUS_SIGN = "\u2212"

    /** Currency digits: 2 for every currency the app supports (EUR, USD, GBP, CHF). */
    private const val CURRENCY_DIGITS = 2

    /** Raw text of the bundled `locale-data.json` (to check it matches the spec copy). */
    fun bundledLocaleData(): String? = FormatLocaleData.bundledText()

    // region Numbers

    /** `Intl.NumberFormat(locale, {minimumFractionDigits, maximumFractionDigits})` (decimal style). */
    fun formatNumber(value: Double, locale: BBLocale, minimumFractionDigits: Int = 0, maximumFractionDigits: Int = 3): String {
        val t = FormatLocaleData.table(locale)
        if (!value.isFinite()) return nonFinite(value, t)
        return sign(value, t) + digitsString(value, minimumFractionDigits, maximumFractionDigits, t.minimumGroupingDigits, t)
    }

    /** `formatRatio(value, digits = 1)`: plain decimal with exactly [digits] decimals. */
    fun formatRatio(value: Double, locale: BBLocale, digits: Int = 1): String =
        formatNumber(value, locale, minimumFractionDigits = digits, maximumFractionDigits = digits)

    /** `formatPct(ratio, digits = 1)`: **input is a ratio** (0.1234 → "12,3%"). */
    fun formatPct(ratio: Double, locale: BBLocale, digits: Int = 1): String {
        val t = FormatLocaleData.table(locale)
        if (!ratio.isFinite()) return nonFinite(ratio, t)
        val d = FormatDecimal.of(ratio).shifted(2).rounded(digits)
        return sign(ratio, t) + t.percentPattern.replace("#", render(d, digits, t.minimumGroupingDigits, t))
    }

    /** `formatSignedPct(ratio)`: "+" or "−" (U+2212) then `formatPct(|ratio|)`. Zero shows "+". */
    fun formatSignedPct(ratio: Double, locale: BBLocale): String =
        (if (ratio < 0) MINUS_SIGN else "+") + formatPct(Math.abs(ratio), locale)

    /**
     * `formatCompactAmount(value)`: `notation:"compact", maximumFractionDigits:1`, no currency
     * ("1,2K", "2,5 Mln", "1.2bn", de "15.300", "2,5 Mio.").
     */
    fun formatCompactAmount(value: Double, locale: BBLocale): String {
        val t = FormatLocaleData.table(locale)
        if (!value.isFinite()) return nonFinite(value, t)
        val d = FormatDecimal.of(value)
        var prefix = ""
        var suffix = ""
        var rounded = d.rounded(1)
        if (!d.isZero) {
            var magnitude = d.magnitude
            var divisor = compactDivisor(magnitude, t)
            rounded = d.shifted(-divisor).rounded(1)
            if (!rounded.isZero) {
                val newMagnitude = rounded.magnitude + divisor
                if (newMagnitude > magnitude && compactDivisor(newMagnitude, t) != divisor) {
                    magnitude = newMagnitude
                    divisor = compactDivisor(magnitude, t)
                    rounded = d.shifted(-divisor).rounded(1)
                }
            }
            val entry = t.compact[minOf(magnitude, 14)]
            if (entry != null && magnitude >= 3) {
                prefix = entry.prefix
                suffix = entry.suffix
            }
        }
        // ICU uses minimum grouping 2 for compact notation in every locale (de "1234" but "15.300").
        return sign(value, t) + prefix + render(rounded, 0, 2, t) + suffix
    }

    private fun compactDivisor(magnitude: Int, t: FormatLocaleTable): Int =
        if (magnitude < 3) 0 else t.compact[minOf(magnitude, 14)]?.divisorExponent ?: 0

    // endregion

    // region Currency

    /**
     * `formatCurrency(value, currency, {maximumFractionDigits = 2})`. The minimum fraction digits come from the
     * currency (2), capped by the maximum. Negative values (and negative zero after rounding, "-0,00 €") use the
     * ASCII hyphen. [masked] returns [AMOUNT_MASK] (privacy mode).
     */
    fun formatCurrency(
        value: Double,
        currency: String,
        locale: BBLocale,
        maximumFractionDigits: Int = 2,
        masked: Boolean = false,
    ): String {
        if (masked) return AMOUNT_MASK
        val t = FormatLocaleData.table(locale)
        val minimum = minOf(CURRENCY_DIGITS, maximumFractionDigits)
        val body = when {
            value.isNaN() -> "NaN"
            value.isInfinite() -> "\u221E"
            else -> digitsString(value, minimum, maximumFractionDigits, t.minimumGroupingDigits, t)
        }
        val negative = !value.isNaN() && isNegative(value)
        return (if (negative) t.minusSign else "") + currencyPattern(currency, t).replace("#", body)
    }

    /** `formatSignedCurrency(value, currency)`: "+" or "−" (U+2212) then `formatCurrency(|value|)`. Zero shows "+". */
    fun formatSignedCurrency(value: Double, currency: String, locale: BBLocale, masked: Boolean = false): String =
        (if (value < 0) MINUS_SIGN else "+") + formatCurrency(Math.abs(value), currency, locale, masked = masked)

    /** `formatPrice(value, currency)`: 4 decimals when |value| < 10, else 2. */
    fun formatPrice(value: Double, currency: String, locale: BBLocale, masked: Boolean = false): String =
        formatCurrency(value, currency, locale, maximumFractionDigits = if (Math.abs(value) < 10) 4 else 2, masked = masked)

    /** `getCurrencySymbol(currency)`: the currency format of 0 without digits, spaces and separators. */
    fun getCurrencySymbol(currency: String, locale: BBLocale): String =
        currencyPattern(currency, FormatLocaleData.table(locale))
            .filter { c -> !(c == '#' || c == '.' || c == ',' || c in '0'..'9' || Character.isWhitespace(c) || Character.isSpaceChar(c)) }

    /** Result of [splitMoney]. */
    data class MoneyParts(val main: String, val tail: String)

    /**
     * Hero amounts with a muted tail (`splitMoney`): `main` before the decimal separator, `tail` = separator,
     * decimals and any trailing currency. it `("1234", ",50 €")`, en `("€1,234", ".50")`.
     */
    fun splitMoney(value: Double, currency: String, locale: BBLocale): MoneyParts {
        val t = FormatLocaleData.table(locale)
        val formatted = formatCurrency(value, currency, locale)
        val body = digitsString(value, CURRENCY_DIGITS, CURRENCY_DIGITS, t.minimumGroupingDigits, t)
        val bodyAt = formatted.indexOf(body)
        if (bodyAt < 0) return MoneyParts(formatted, "")
        val decimalAt = formatted.indexOf(t.decimal, bodyAt)
        if (decimalAt < 0 || decimalAt >= bodyAt + body.length) return MoneyParts(formatted, "")
        return MoneyParts(formatted.substring(0, decimalAt), formatted.substring(decimalAt))
    }

    private fun currencyPattern(currency: String, t: FormatLocaleTable): String {
        t.currency[currency]?.let { return it.pattern }
        // Unknown currency: ICU shows the ISO code; reuse the EUR layout with the code as symbol.
        val eur = t.currency.getValue("EUR")
        return eur.pattern.replace(eur.symbol, currency)
    }

    // endregion

    // region Parsing

    /**
     * Web `parseAmount` (`lib/debts/add-form.ts`): Italian-style input. With a comma, dots are thousands separators
     * and the comma is the decimal ("1.250,50" → 1250.5); without a comma the text is a JS number
     * ("1250.5", "1.250" → 1.25). Empty or invalid → null.
     */
    fun parseAmount(text: String): Double? {
        val trimmed = JSNumber.trim(text)
        if (trimmed.isEmpty()) return null
        val normalized = if (trimmed.contains(',')) trimmed.replace(".", "").replaceFirst(",", ".") else trimmed
        return JSNumber.parse(normalized)?.takeIf { it.isFinite() }
    }

    /**
     * Web account-form `parseAmount` (`lib/validation/accounts.ts`): the first comma becomes the decimal point,
     * dots are kept ("1.250,50" → null, "12,5" → 12.5). Empty or invalid → null.
     */
    fun parseAccountAmount(raw: String): Double? {
        val normalized = JSNumber.trim(raw).replaceFirst(",", ".")
        if (normalized.isEmpty()) return null
        return JSNumber.parse(normalized)?.takeIf { it.isFinite() }
    }

    // endregion

    // region Dates

    /**
     * Formats a calendar date with one of the web's skeletons ("d MMM" → "26 set" / "26 Sept" / "26. Sept.").
     * [hour]/[minute] are only used by [BBDateSkeleton.HH_MM].
     */
    fun formatDate(date: CalendarDate, skeleton: BBDateSkeleton, locale: BBLocale, hour: Int = 0, minute: Int = 0): String {
        val t = FormatLocaleData.table(locale)
        val template = t.dateTemplates[skeleton] ?: return date.iso
        val values = mapOf(
            "EEEE" to t.weekdaysLong[date.isoWeekday - 1],
            "EEE" to t.weekdaysShort[date.isoWeekday - 1],
            "MMMM" to t.monthsLong[date.month - 1],
            "MMM" to t.monthsAbbreviated[date.month - 1],
            "yy" to CalendarDate.pad(((date.year % 100) + 100) % 100, 2),
            "y" to date.year.toString(),
            "dd" to CalendarDate.pad(date.day, 2),
            "d" to date.day.toString(),
            "HH" to CalendarDate.pad(hour, 2),
            "mm" to CalendarDate.pad(minute, 2),
        )
        return Regex("\\{(\\w+)\\}").replace(template) { m -> values[m.groupValues[1]] ?: m.value }
    }

    /** `HH:mm`. */
    fun formatTime(hour: Int, minute: Int, locale: BBLocale): String =
        formatDate(CalendarDate(2000, 1, 1), BBDateSkeleton.HH_MM, locale, hour, minute)

    /** `formatShortDate("2026-09-26")` → "26 set". Invalid input is returned unchanged. */
    fun formatShortDate(iso: String, locale: BBLocale): String =
        CalendarDate.parse(iso)?.let { formatDate(it, BBDateSkeleton.D_MMM, locale) } ?: iso

    /** `formatDateWithYear("2026-09-26")` → "26 set 2026". Invalid input is returned unchanged. */
    fun formatDateWithYear(iso: String, locale: BBLocale): String =
        CalendarDate.parse(iso)?.let { formatDate(it, BBDateSkeleton.D_MMM_Y, locale) } ?: iso

    /** `formatLongDate(date)` → "29 ottobre 2026". */
    fun formatLongDate(date: CalendarDate, locale: BBLocale): String = formatDate(date, BBDateSkeleton.D_MMMM_Y, locale)

    /** `formatMonthLabel("2026-03")` → "marzo 2026" (lower case as in CLDR; callers capitalize if needed). */
    fun formatMonthLabel(key: String, locale: BBLocale): String {
        val parts = key.split("-")
        val y = parts.getOrNull(0)?.toIntOrNull() ?: return key
        val m = parts.getOrNull(1)?.toIntOrNull() ?: return key
        return formatDate(CalendarDate.js(y, m - 1, 1), BBDateSkeleton.MMMM_Y, locale)
    }

    /** Debts' `formatMonthYear`: "febbraio 2027". */
    fun formatMonthYear(date: CalendarDate, locale: BBLocale): String =
        formatDate(date.startOfMonth, BBDateSkeleton.MMMM_Y, locale)

    /** `shortMonthLabel(month)` with a 1-based month (stand-alone abbreviation, first "." removed): it "gen", en "Sept", de "Mär". */
    fun shortMonthLabel(month: Int, locale: BBLocale): String =
        FormatLocaleData.table(locale).monthsShort[Math.floorMod(month - 1, 12)].replaceFirst(".", "")

    /** `shortMonthLabel("YYYY-MM")`. */
    fun shortMonthLabel(key: String, locale: BBLocale): String =
        shortMonthLabel(key.drop(5).take(2).toIntOrNull() ?: 1, locale)

    /** Stand-alone month name (`{month:"long"}`), lower case in it. */
    fun monthName(month: Int, locale: BBLocale): String = FormatLocaleData.table(locale).monthsLong[Math.floorMod(month - 1, 12)]

    /** Stand-alone abbreviated month (`{month:"short"}`, without the dot removal of [shortMonthLabel]). */
    fun monthNameShort(month: Int, locale: BBLocale): String =
        FormatLocaleData.table(locale).monthsShort[Math.floorMod(month - 1, 12)]

    /** Upper-cases only the first character ("ottobre 2026" → "Ottobre 2026"), like the web's `capitalize`. */
    fun capitalize(text: String): String =
        if (text.isEmpty()) text else text.substring(0, 1).uppercase() + text.substring(1)

    /**
     * Movement-feed day header (`dayLabel`): "Oggi" / "Ieri" (Italian **catalog keys**, translate them in the UI),
     * otherwise "lunedì 5 ottobre", with the year when it is not the current one.
     */
    fun dayLabel(date: CalendarDate, today: CalendarDate, locale: BBLocale): String = when {
        date == today -> "Oggi"
        date == today.plusDays(-1) -> "Ieri"
        else -> formatDate(date, if (date.year != today.year) BBDateSkeleton.EEEE_D_MMMM_Y else BBDateSkeleton.EEEE_D_MMMM, locale)
    }

    // endregion

    // region Relative time

    /**
     * `formatRelativeTime(date, now)`. it-IT: "adesso", "5 min fa", "3 h fa", "1 giorno fa", "2 giorni fa";
     * en/de: `Intl.RelativeTimeFormat(numeric:"auto")` ("now", "yesterday", "vor 5 Minuten", "vorgestern").
     * From 7 days on: `d MMM` of [date] in [zone] (the device zone in the app).
     */
    fun formatRelativeTime(date: Instant, now: Instant, locale: BBLocale, zone: ZoneId = ZoneId.systemDefault()): String {
        val diffMs = now.toEpochMilli() - date.toEpochMilli()
        val minuteMs = 60_000L
        val hourMs = 3_600_000L
        val dayMs = 86_400_000L
        val fallback = { formatDate(CalendarDate.of(date, zone), BBDateSkeleton.D_MMM, locale) }
        if (locale == BBLocale.IT_IT) {
            return when {
                diffMs < minuteMs -> "adesso"
                diffMs < hourMs -> "${Math.floorDiv(diffMs, minuteMs)} min fa"
                diffMs < dayMs -> "${Math.floorDiv(diffMs, hourMs)} h fa"
                diffMs < 7 * dayMs -> Math.floorDiv(diffMs, dayMs).let { if (it == 1L) "1 giorno fa" else "$it giorni fa" }
                else -> fallback()
            }
        }
        val minutes = maxOf(0L, Math.floorDiv(diffMs, minuteMs))
        val r = RelativeStrings.of(locale)
        return when {
            minutes < 1 -> r.now
            minutes < 60 -> (if (minutes == 1L) r.minuteOne else r.minuteOther).replace("{0}", minutes.toString())
            minutes < 1440 -> (minutes / 60).let { h -> (if (h == 1L) r.hourOne else r.hourOther).replace("{0}", h.toString()) }
            minutes < 10080 -> (minutes / 1440).let { d ->
                when {
                    d == 1L -> r.yesterday
                    d == 2L && r.dayBeforeYesterday != null -> r.dayBeforeYesterday
                    else -> r.dayOther.replace("{0}", d.toString())
                }
            }
            else -> fallback()
        }
    }

    /** CLDR 48 relative-time strings for the past (`numeric:"auto"`). it-IT uses the custom web strings. */
    private class RelativeStrings(
        val now: String, val minuteOne: String, val minuteOther: String, val hourOne: String, val hourOther: String,
        val yesterday: String, val dayBeforeYesterday: String?, val dayOther: String,
    ) {
        companion object {
            fun of(locale: BBLocale): RelativeStrings = when (locale) {
                BBLocale.DE_DE -> RelativeStrings(
                    "jetzt", "vor {0} Minute", "vor {0} Minuten", "vor {0} Stunde", "vor {0} Stunden",
                    "gestern", "vorgestern", "vor {0} Tagen",
                )
                else -> RelativeStrings(
                    "now", "{0} minute ago", "{0} minutes ago", "{0} hour ago", "{0} hours ago",
                    "yesterday", null, "{0} days ago",
                )
            }
        }
    }

    // endregion

    // region Durations, lists, interpolation

    /** Two-item conjunction list (`Intl.ListFormat(long, conjunction)`): "A e B", "A and B", "A und B". */
    fun formatList(items: List<String>, locale: BBLocale): String = when (items.size) {
        0 -> ""
        1 -> items[0]
        2 -> {
            val pattern = FormatLocaleData.table(locale).listConjunction2
            val a = pattern.indexOf('A')
            val b = pattern.lastIndexOf('B')
            pattern.substring(0, a) + items[0] + pattern.substring(a + 1, b) + items[1] + pattern.substring(b + 1)
        }
        // Not used by the web today; CLDR it/en/de: "A, B e C".
        else -> items.dropLast(1).joinToString(", ") + formatList(listOf("", items.last()), locale)
    }

    /** Catalog keys used by [formatDuration], with their en/de translations (web catalogs). */
    private val durationKeys: Map<String, Map<BBLanguage, String>> = mapOf(
        "{0} anno" to mapOf(BBLanguage.EN to "{0} year", BBLanguage.DE to "{0} Jahr"),
        "{0} anni" to mapOf(BBLanguage.EN to "{0} years", BBLanguage.DE to "{0} Jahre"),
        "{0} mese" to mapOf(BBLanguage.EN to "{0} month", BBLanguage.DE to "{0} Monat"),
        "{0} mesi" to mapOf(BBLanguage.EN to "{0} months", BBLanguage.DE to "{0} Monate"),
        "0 mesi" to mapOf(BBLanguage.EN to "0 months", BBLanguage.DE to "0 Monate"),
    )

    /**
     * `formatDuration(months)`: "2 anni e 1 mese", "2 years and 1 month", "2 Jahre und 1 Monat"; 0 → "0 mesi".
     * Pass [translate] to resolve the catalog keys through the generated string catalog instead.
     */
    fun formatDuration(months: Int, language: BBLanguage, translate: ((String) -> String)? = null): String {
        fun tr(key: String, n: Int?): String {
            val template = translate?.invoke(key)
                ?: if (language == BBLanguage.IT) key else durationKeys[key]?.get(language) ?: key
            return if (n == null) template else interpolate(template, mapOf("0" to n.toString()))
        }
        val years = months / 12
        val rest = months % 12
        val parts = buildList {
            if (years > 0) add(tr(if (years == 1) "{0} anno" else "{0} anni", years))
            if (rest > 0) add(tr(if (rest == 1) "{0} mese" else "{0} mesi", rest))
        }
        return if (parts.isEmpty()) tr("0 mesi", null) else formatList(parts, BBLocale.of(language))
    }

    /** `{name}` placeholder replacement of the web's `translate` (regex `\{(\w+)\}`); unknown placeholders stay. */
    fun interpolate(template: String, values: Map<String, String>): String =
        Regex("\\{([A-Za-z0-9_]+)\\}").replace(template) { m -> values[m.groupValues[1]] ?: m.value }

    // endregion

    // region Internals

    private fun isNegative(value: Double): Boolean = value < 0 || (value == 0.0 && 1.0 / value < 0)

    private fun sign(value: Double, t: FormatLocaleTable): String = if (isNegative(value)) t.minusSign else ""

    private fun nonFinite(value: Double, t: FormatLocaleTable): String =
        if (value.isNaN()) "NaN" else (if (value < 0) t.minusSign else "") + "\u221E"

    private fun digitsString(value: Double, min: Int, max: Int, minGrouping: Int, t: FormatLocaleTable): String =
        render(FormatDecimal.of(value).rounded(max), min, minGrouping, t)

    private fun render(d: FormatDecimal, min: Int, minGrouping: Int, t: FormatLocaleTable): String {
        val intDigits = d.integerDigits
        val count = intDigits.length
        val integer = if (count >= 3 + minGrouping) {
            buildString {
                intDigits.forEachIndexed { i, ch ->
                    if (i > 0 && (count - i) % 3 == 0) append(t.group)
                    append(ch)
                }
            }
        } else {
            intDigits
        }
        val fraction = d.fractionDigits(min)
        return if (fraction.isEmpty()) integer else integer + t.decimal + fraction
    }

    // endregion
}
