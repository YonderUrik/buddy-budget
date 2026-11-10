package io.buddybudget.core.domain.periods

import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.FormatLocaleData

/**
 * Pure logic behind the shared `PeriodSelector`'s custom range (web `lib/calc/calendar-range.ts`, decision
 * 2026-10-17-selettore-del-periodo, #408): calendar grids, picking a range by tapping two dates and the short label of a
 * chosen range. Keys are strings that sort chronologically: `YYYY-MM-DD` for days, `YYYY-MM` for months.
 * Twin of `CalendarRange` in BuddyBudgetKit on iOS.
 */
enum class RangeGranularity { Day, Month }

/** A range being picked: [to] is null after the first tap, until the second one. */
data class RangeDraft(val from: String, val to: String?)

/** A complete range of keys (`from` ≤ `to`). */
data class DateKeyRange(val from: String, val to: String)

data class CalendarDay(
    val key: String,
    val day: Int,
    /** False for the leading/trailing days of the neighbouring months that fill the grid. */
    val inMonth: Boolean,
)

object CalendarRange {
    /** `YYYY-MM` of a year and zero-based month, normalising overflow (month 12 is January of the next year). */
    fun monthKey(year: Int, monthIndex: Int): String = CalendarDate.js(year, monthIndex, 1).monthKey

    /** Year and zero-based month of a day or month key. */
    fun parseMonth(key: String): Pair<Int, Int> {
        val parts = key.split("-")
        val year = parts.getOrNull(0)?.toIntOrNull() ?: 1970
        val month = parts.getOrNull(1)?.toIntOrNull() ?: 1
        return year to month - 1
    }

    /** Six Monday-first weeks covering the month: a fixed height, so the sheet does not jump between months. */
    fun monthGrid(year: Int, monthIndex: Int): List<CalendarDay> {
        val first = CalendarDate.js(year, monthIndex, 1)
        val lead = first.isoWeekday - 1
        return (0 until 42).map { index ->
            val date = first.plusDays(index - lead)
            CalendarDay(date.iso, date.day, date.month == first.month && date.year == first.year)
        }
    }

    /**
     * Next draft after tapping [key]: the first tap starts a new range, the second closes it. A second tap before the
     * start moves the start instead, so the range never ends before it begins.
     */
    fun pick(draft: RangeDraft, key: String): RangeDraft = when {
        draft.to != null -> RangeDraft(key, null)
        key >= draft.from -> RangeDraft(draft.from, key)
        else -> RangeDraft(key, null)
    }

    /** Whether [key] falls inside the draft (both ends included); a half-picked draft only contains its start. */
    fun inDraft(draft: RangeDraft, key: String): Boolean {
        val to = draft.to ?: return key == draft.from
        return key >= draft.from && key <= to
    }

    /** Length of a range in its own unit, both ends included (days or months). */
    fun span(from: String, to: String, granularity: RangeGranularity): Int {
        val (ay, am) = parseMonth(from)
        val (by, bm) = parseMonth(to)
        if (granularity == RangeGranularity.Month) return (by - ay) * 12 + (bm - am) + 1
        val start = CalendarDate.parse(from) ?: return 0
        val end = CalendarDate.parse(to) ?: return 0
        return end.epochDay - start.epochDay + 1
    }

    /** Key outside [min, max]: such dates are shown but cannot be tapped. */
    fun outOfBounds(key: String, min: String?, max: String?): Boolean =
        (min != null && key < min) || (max != null && key > max)

    /** Month of a key, as `YYYY-MM`. */
    fun monthOf(key: String): String = key.take(7)

    /** Narrow weekday initials, Monday first (`Intl` `weekday: "narrow"`). */
    fun weekdayInitials(locale: BBLocale): List<String> = FormatLocaleData.table(locale).weekdaysShort.map { it.take(1).uppercase() }

    /** Calendar page title: «ottobre 2026». */
    fun monthTitle(key: String, locale: BBLocale): String {
        val (y, m) = parseMonth(key)
        return BBFormat.formatDate(CalendarDate.js(y, m, 1), BBDateSkeleton.MMMM_Y, locale)
    }

    /** Short month name for the month grid («ott», without the trailing dot some locales add). */
    fun shortMonth(year: Int, monthIndex: Int, locale: BBLocale): String {
        val date = CalendarDate.js(year, monthIndex, 1)
        return BBFormat.formatDate(date, BBDateSkeleton.MMM_Y, locale).replace(" ${date.year}", "").replace(".", "")
    }

    /** One end of the range in the sheet's «Dal» / «Al» boxes: «3 mar 2026» for days, «marzo 2026» for months. */
    fun endLabel(key: String, granularity: RangeGranularity, locale: BBLocale): String {
        val (y, m) = parseMonth(key)
        if (granularity == RangeGranularity.Month) return BBFormat.formatDate(CalendarDate.js(y, m, 1), BBDateSkeleton.MMMM_Y, locale)
        val date = CalendarDate.parse(key) ?: return key
        return BBFormat.formatDate(date, BBDateSkeleton.D_MMM_Y, locale)
    }

    /**
     * Short label of a range for the selector («3 mar – 17 ott», «gen 2025 – dic 2025»). The year is written only when
     * it is not the current one or the two ends are in different years, so the label stays short in the common case.
     */
    fun shortLabel(from: String, to: String, granularity: RangeGranularity, locale: BBLocale, currentYear: Int): String {
        val (ay, am) = parseMonth(from)
        val (by, bm) = parseMonth(to)
        if (granularity == RangeGranularity.Month) {
            val one = BBFormat.formatDate(CalendarDate.js(ay, am, 1), BBDateSkeleton.MMM_Y, locale)
            if (from == to) return one
            return "$one – ${BBFormat.formatDate(CalendarDate.js(by, bm, 1), BBDateSkeleton.MMM_Y, locale)}"
        }
        val withYear = ay != by || by != currentYear
        val skeleton = if (withYear) BBDateSkeleton.D_MMM_Y else BBDateSkeleton.D_MMM
        val start = CalendarDate.parse(from) ?: return "$from – $to"
        val end = CalendarDate.parse(to) ?: return "$from – $to"
        val one = BBFormat.formatDate(start, skeleton, locale)
        return if (from == to) one else "$one – ${BBFormat.formatDate(end, skeleton, locale)}"
    }
}
