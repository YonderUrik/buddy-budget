package io.buddybudget.core.domain.periods

import java.time.Instant
import java.time.ZoneId

/**
 * A calendar date (`YYYY-MM-DD`) with no time and no time zone: how the web's data dates work
 * (`parseDateOnly`). Arithmetic is pure proleptic-Gregorian, so it never shifts across DST or time
 * zones. [month] is 1-based (unlike JS `getMonth()`). Same algorithm as the Swift `CalendarDate`.
 */
data class CalendarDate(val year: Int, val month: Int, val day: Int) : Comparable<CalendarDate> {

    /** Days since 1970-01-01 (Howard Hinnant's days_from_civil). */
    val epochDay: Int
        get() {
            val y = if (month <= 2) year - 1 else year
            val era = (if (y >= 0) y else y - 399) / 400
            val yoe = y - era * 400
            val doy = (153 * (month + if (month > 2) -3 else 9) + 2) / 5 + day - 1
            val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
            return era * 146_097 + doe - 719_468
        }

    /** `YYYY-MM-DD`. */
    val iso: String get() = "${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}"

    /** `YYYY-MM`. */
    val monthKey: String get() = "${pad(year, 4)}-${pad(month, 2)}"

    override fun toString(): String = iso

    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    val isoWeekday: Int get() = ((epochDay % 7 + 7) % 7 + 3) % 7 + 1

    fun plusDays(days: Int): CalendarDate = ofEpochDay(epochDay + days)

    /** JS `new Date(y, m + months, d)`: the day overflows (31 Jan + 1 month = 3 Mar). Web `addMonths` in `lib/calc/expenses.ts`. */
    fun plusMonthsOverflow(months: Int): CalendarDate = js(year, month - 1 + months, day)

    /**
     * Month arithmetic clamping the day to the target month (31 Jan + 1 month = 28/29 Feb).
     * [anchorDay] replaces the day before clamping (debts' `addMonthsClamped`).
     */
    fun plusMonthsClamped(months: Int, anchorDay: Int? = null): CalendarDate {
        val total = year * 12 + (month - 1) + months
        val y = Math.floorDiv(total, 12)
        val m = total - y * 12 + 1
        return CalendarDate(y, m, minOf(anchorDay ?: day, daysInMonth(y, m)))
    }

    val startOfMonth: CalendarDate get() = CalendarDate(year, month, 1)
    val endOfMonth: CalendarDate get() = CalendarDate(year, month, daysInMonth(year, month))

    override fun compareTo(other: CalendarDate): Int = epochDay.compareTo(other.epochDay)

    companion object {
        /** Parses `YYYY-MM-DD` (anything after the day, like a time, is ignored); null if invalid. */
        fun parse(iso: String): CalendarDate? {
            val parts = iso.take(10).split("-")
            if (parts.size != 3) return null
            val y = parts[0].toIntOrNull() ?: return null
            val m = parts[1].toIntOrNull() ?: return null
            val d = parts[2].toIntOrNull() ?: return null
            if (m !in 1..12 || d < 1 || d > daysInMonth(y, m)) return null
            return CalendarDate(y, m, d)
        }

        /** `new Date(year, monthIndex, day)`: 0-based month; month and day overflow like JS. */
        fun js(year: Int, monthIndex: Int, day: Int): CalendarDate {
            val total = year * 12 + monthIndex
            val y = Math.floorDiv(total, 12)
            val m = total - y * 12
            return ofEpochDay(CalendarDate(y, m + 1, 1).epochDay + day - 1)
        }

        /** Howard Hinnant's civil_from_days. */
        fun ofEpochDay(epochDay: Int): CalendarDate {
            val z = epochDay + 719_468
            val era = (if (z >= 0) z else z - 146_096) / 146_097
            val doe = z - era * 146_097
            val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
            val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
            val mp = (5 * doy + 2) / 153
            val d = doy - (153 * mp + 2) / 5 + 1
            val m = if (mp < 10) mp + 3 else mp - 9
            return CalendarDate(yoe + era * 400 + if (m <= 2) 1 else 0, m, d)
        }

        /** The calendar date of [instant] in [zone] (device-local "today": `ZoneId.systemDefault()`). */
        fun of(instant: Instant, zone: ZoneId): CalendarDate {
            val offset = zone.rules.getOffset(instant).totalSeconds.toLong()
            return ofEpochDay(Math.floorDiv(instant.epochSecond + offset, 86_400L).toInt())
        }

        fun isLeapYear(year: Int): Boolean = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0

        fun daysInMonth(year: Int, month: Int): Int = when (month) {
            2 -> if (isLeapYear(year)) 29 else 28
            4, 6, 9, 11 -> 30
            else -> 31
        }

        internal fun pad(value: Int, width: Int): String {
            val s = Math.abs(value).toString().padStart(width, '0')
            return if (value < 0) "-$s" else s
        }
    }
}
