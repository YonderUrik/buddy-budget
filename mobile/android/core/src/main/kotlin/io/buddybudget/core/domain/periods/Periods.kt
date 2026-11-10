package io.buddybudget.core.domain.periods

import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import java.time.Instant
import java.time.ZoneOffset

/** Inclusive calendar range. */
data class DateRange(val from: CalendarDate, val to: CalendarDate)

/** Liquidità / Spese period selector (`ExpensePeriod`). */
enum class ExpensePeriod(val key: String) {
    SETTIMANA("settimana"), MESE("mese"), TRE_MESI("3mesi"), ANNO("anno");

    companion object {
        fun fromKey(key: String): ExpensePeriod? = entries.firstOrNull { it.key == key }
    }
}

/** Cash flow period selector (`CashflowPeriod`). */
enum class CashflowPeriod(val key: String, val months: Int) {
    TRE_MESI("3mesi", 3), SEI_MESI("6mesi", 6), DODICI_MESI("12mesi", 12), VENTIQUATTRO_MESI("24mesi", 24);

    companion object {
        fun fromKey(key: String): CashflowPeriod? = entries.firstOrNull { it.key == key }
    }
}

/** Net-worth chart period (`NetWorthPeriod`). */
enum class NetWorthPeriod(val key: String) {
    UN_MESE("1mese"), TRE_MESI("3mesi"), UN_ANNO("1anno"), MAX("max");

    companion object {
        fun fromKey(key: String): NetWorthPeriod? = entries.firstOrNull { it.key == key }
    }
}

/** Analitiche data period (`DataPeriod`): the last 12/24 full months, or custom `YYYY-MM` keys. */
sealed interface DataPeriod {
    data class Ultimi(val months: Int) : DataPeriod
    data class Personalizzato(val from: String, val to: String) : DataPeriod
}

/** Range in whole months (`PeriodRange`). */
data class PeriodRange(val from: CalendarDate, val to: CalendarDate, val months: Int)

/** ISO-8601 week and its year. */
data class IsoWeek(val year: Int, val week: Int)

/**
 * Period ranges, navigation and month arithmetic, ported 1:1 from the web (including its quirks).
 * Two month-arithmetic flavours exist (spec domain/README.md §3): `plusMonthsOverflow` (JS `new Date`
 * overflow, 31 Jan + 1 = 3 Mar) and `plusMonthsClamped` (31 Jan + 1 = 28 Feb). Each function says which.
 */
object Periods {
    // region Expenses (lib/calc/expenses.ts)

    /** `getPeriodRange`: ISO week (Mon–Sun), calendar month, 3 months ending with the reference month, calendar year. */
    fun getPeriodRange(period: ExpensePeriod, referenceDate: CalendarDate): DateRange = when (period) {
        ExpensePeriod.SETTIMANA -> referenceDate.plusDays(-(referenceDate.isoWeekday - 1)).let { DateRange(it, it.plusDays(6)) }
        ExpensePeriod.MESE -> DateRange(referenceDate.startOfMonth, referenceDate.endOfMonth)
        ExpensePeriod.TRE_MESI -> DateRange(referenceDate.plusMonthsOverflow(-2).startOfMonth, referenceDate.endOfMonth)
        ExpensePeriod.ANNO -> DateRange(CalendarDate(referenceDate.year, 1, 1), CalendarDate(referenceDate.year, 12, 31))
    }

    /** `getPreviousPeriodRange`. Overflow arithmetic: the previous month of 31 March is March itself (web quirk). */
    fun getPreviousPeriodRange(period: ExpensePeriod, referenceDate: CalendarDate): DateRange {
        val shifted = when (period) {
            ExpensePeriod.SETTIMANA -> referenceDate.plusDays(-7)
            ExpensePeriod.MESE -> referenceDate.plusMonthsOverflow(-1)
            ExpensePeriod.TRE_MESI -> referenceDate.plusMonthsOverflow(-3)
            ExpensePeriod.ANNO -> CalendarDate.js(referenceDate.year - 1, referenceDate.month - 1, referenceDate.day)
        }
        return getPeriodRange(period, shifted)
    }

    /** `shiftReferenceDate` (overflow arithmetic: 31 Jan + 1 month = 3 Mar). */
    fun shiftReferenceDate(period: ExpensePeriod, referenceDate: CalendarDate, direction: Int): CalendarDate = when (period) {
        ExpensePeriod.SETTIMANA -> referenceDate.plusDays(7 * direction)
        ExpensePeriod.MESE -> referenceDate.plusMonthsOverflow(direction)
        ExpensePeriod.TRE_MESI -> referenceDate.plusMonthsOverflow(3 * direction)
        ExpensePeriod.ANNO -> CalendarDate.js(referenceDate.year + direction, referenceDate.month - 1, referenceDate.day)
    }

    /** `scaleBudgetForPeriod`: week = monthly / 30 × 7. */
    fun scaleBudgetForPeriod(monthlyTotal: Double, period: ExpensePeriod): Double = when (period) {
        ExpensePeriod.SETTIMANA -> (monthlyTotal / 30) * 7
        ExpensePeriod.MESE -> monthlyTotal
        ExpensePeriod.TRE_MESI -> monthlyTotal * 3
        ExpensePeriod.ANNO -> monthlyTotal * 12
    }

    /** `formatPeriodLabel`: "Ottobre 2026", "12–18 ott", "28 set – 4 ott", "Nov 2025 – Gen 2026", "2026". */
    fun formatPeriodLabel(period: ExpensePeriod, range: DateRange, locale: BBLocale): String {
        val sameYear = range.from.year == range.to.year
        return when (period) {
            ExpensePeriod.MESE -> "${BBFormat.capitalize(BBFormat.monthName(range.from.month, locale))} ${range.from.year}"
            ExpensePeriod.ANNO -> "${range.from.year}"
            ExpensePeriod.SETTIMANA ->
                if (sameYear && range.from.month == range.to.month) {
                    "${range.from.day}\u2013${BBFormat.formatDate(range.to, BBDateSkeleton.D_MMM, locale)}"
                } else {
                    val skeleton = if (sameYear) BBDateSkeleton.D_MMM else BBDateSkeleton.D_MMM_Y
                    "${BBFormat.formatDate(range.from, skeleton, locale)} \u2013 ${BBFormat.formatDate(range.to, skeleton, locale)}"
                }
            ExpensePeriod.TRE_MESI -> monthSpanLabel(range, locale)
        }
    }

    // endregion

    // region Cash flow (lib/calc/cashflow.ts, lib/calc/movements.ts)

    /** `getCashflowPeriodRange`: `months` calendar months up to the reference month (clamped arithmetic). */
    fun getCashflowPeriodRange(period: CashflowPeriod, referenceDate: CalendarDate): DateRange =
        DateRange(referenceDate.plusMonthsClamped(-(period.months - 1)).startOfMonth, referenceDate.endOfMonth)

    /** `getPreviousCashflowPeriodRange`. */
    fun getPreviousCashflowPeriodRange(period: CashflowPeriod, referenceDate: CalendarDate): DateRange =
        getCashflowPeriodRange(period, referenceDate.plusMonthsClamped(-period.months))

    /** `shiftCashflowReferenceDate` (clamped: 31 May − 3 months = 28 Feb). */
    fun shiftCashflowReferenceDate(period: CashflowPeriod, referenceDate: CalendarDate, direction: Int): CalendarDate =
        referenceDate.plusMonthsClamped(period.months * direction)

    /**
     * `formatCashflowPeriodLabel`: "Ago – Ott 2026", "Nov 2025 – Ott 2026". The web hard-codes it-IT; mobile passes
     * the account locale (known web i18n gap, spec formatting-localization.md §5).
     */
    fun formatCashflowPeriodLabel(range: DateRange, locale: BBLocale = BBLocale.IT_IT): String = monthSpanLabel(range, locale)

    /** `getTrendRange`: monthly charts window, 6 months (12 for "anno") ending with the reference month. */
    fun getTrendRange(period: ExpensePeriod, referenceDate: CalendarDate): DateRange {
        val months = if (period == ExpensePeriod.ANNO) 12 else 6
        return DateRange(referenceDate.startOfMonth.plusMonthsOverflow(-(months - 1)).startOfMonth, referenceDate.endOfMonth)
    }

    private fun monthSpanLabel(range: DateRange, locale: BBLocale): String {
        val toLabel = BBFormat.capitalize(BBFormat.formatDate(range.to, BBDateSkeleton.MMM_Y, locale))
        val fromLabel = if (range.from.year == range.to.year) {
            BBFormat.monthNameShort(range.from.month, locale)
        } else {
            BBFormat.formatDate(range.from, BBDateSkeleton.MMM_Y, locale)
        }
        return "${BBFormat.capitalize(fromLabel)} \u2013 $toLabel"
    }

    // endregion

    // region Net worth (lib/calc/net-worth.ts)

    /** `getNetWorthPeriodRange`: back 1/3/12 months (clamped) from today; `max` from the earliest date (or today). */
    fun getNetWorthPeriodRange(period: NetWorthPeriod, today: CalendarDate, earliestDate: CalendarDate?): DateRange = when (period) {
        NetWorthPeriod.MAX -> DateRange(earliestDate ?: today, today)
        NetWorthPeriod.UN_MESE -> DateRange(today.plusMonthsClamped(-1), today)
        NetWorthPeriod.TRE_MESI -> DateRange(today.plusMonthsClamped(-3), today)
        NetWorthPeriod.UN_ANNO -> DateRange(today.plusMonthsClamped(-12), today)
    }

    // endregion

    // region Analitiche (lib/analitiche/period.ts)

    /** `monthSpan("2025-11", "2026-02")` = 4 (both ends included). */
    fun monthSpan(from: String, to: String): Int {
        val (fy, fm) = yearMonth(from)
        val (ty, tm) = yearMonth(to)
        return (ty - fy) * 12 + (tm - fm) + 1
    }

    /** `resolvePeriodRange`: whole months only; the current (partial) month never counts. */
    fun resolvePeriodRange(period: DataPeriod, today: CalendarDate): PeriodRange {
        val lastFull = today.plusMonthsOverflow(-1).endOfMonth
        return when (period) {
            is DataPeriod.Ultimi ->
                PeriodRange(lastFull.plusMonthsOverflow(-(period.months - 1)).startOfMonth, lastFull, period.months)
            is DataPeriod.Personalizzato -> {
                val (fy, fm) = yearMonth(period.from)
                val (ty, tm) = yearMonth(period.to)
                val from = CalendarDate.js(fy, fm - 1, 1)
                val wantedTo = CalendarDate.js(ty, tm - 1, 1).endOfMonth
                val to = if (wantedTo > lastFull) lastFull else wantedTo
                val months = if (to < from) 0 else (to.year - from.year) * 12 + (to.month - from.month) + 1
                PeriodRange(from, to, months)
            }
        }
    }

    // endregion

    // region Month keys and misc. date helpers

    /** Goals' `monthsBetween`: whole months between the months of two `YYYY-MM[-DD]` keys (day ignored). */
    fun monthsBetween(from: String, to: String): Int {
        val (fy, fm) = yearMonth(from)
        val (ty, tm) = yearMonth(to)
        return ty * 12 + tm - (fy * 12 + fm)
    }

    /** Goals' `addMonthsKey`: the `YYYY-MM` month `months` after the month of `from`. */
    fun addMonthsKey(from: String, months: Int): String {
        val (y, m) = yearMonth(from)
        val index = y * 12 + (m - 1) + months
        val year = Math.floorDiv(index, 12)
        return "$year-${CalendarDate.pad(index - year * 12 + 1, 2)}"
    }

    /** Pension's `wholeYearsBetween`: completed years (≥ 0), comparing `MM-DD` as strings. */
    fun wholeYearsBetween(from: String, to: String): Int {
        var years = (to.take(4).toIntOrNull() ?: 0) - (from.take(4).toIntOrNull() ?: 0)
        if (to.drop(5) < from.drop(5)) years -= 1
        return maxOf(0, years)
    }

    /** Returns' `daysBetween`: calendar days from [from] to [to]. */
    fun daysBetween(from: CalendarDate, to: CalendarDate): Int = to.epochDay - from.epochDay

    /** ISO-8601 week (Thursday rule) and its year. */
    fun isoWeek(date: CalendarDate): IsoWeek {
        fun monday(d: CalendarDate) = d.plusDays(-(d.isoWeekday - 1))
        val thursday = monday(date).plusDays(3)
        val firstThursday = monday(CalendarDate(thursday.year, 1, 4)).plusDays(3)
        return IsoWeek(thursday.year, (thursday.epochDay - firstThursday.epochDay) / 7 + 1)
    }

    /** Debts' `todayIso`: the **UTC** calendar date of [now]. */
    fun todayUTC(now: Instant): CalendarDate = CalendarDate.of(now, ZoneOffset.UTC)

    private fun yearMonth(key: String): Pair<Int, Int> {
        val parts = key.split("-")
        return (parts.getOrNull(0)?.toIntOrNull() ?: 0) to (parts.getOrNull(1)?.toIntOrNull() ?: 0)
    }

    // endregion
}
