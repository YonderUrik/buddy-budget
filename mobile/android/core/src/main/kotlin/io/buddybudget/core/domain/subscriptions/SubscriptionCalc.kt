package io.buddybudget.core.domain.subscriptions

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

enum class SubscriptionCadence(
    val key: String,
    /** Months between charges (0 for weekly, which goes by days). */
    val months: Int,
    /** Charges per month (for the monthly equivalent), same doubles as `CADENCE_RULES[c].perMonth`. */
    val perMonth: Double,
) {
    SETTIMANALE("settimanale", 0, 52.0 / 12),
    MENSILE("mensile", 1, 1.0),
    TRIMESTRALE("trimestrale", 3, 1.0 / 3),
    SEMESTRALE("semestrale", 6, 1.0 / 6),
    ANNUALE("annuale", 12, 1.0 / 12);

    companion object {
        fun fromKey(key: String): SubscriptionCadence? = entries.firstOrNull { it.key == key }
    }
}

/** The two optimistic-UI subscription helpers (`lib/calc/subscriptions.ts`); detection stays on the server. Same as Swift. */
object SubscriptionCalc {
    /** `iso` + `months`, day clamped to the month's length (`addMonthsIso`). */
    fun addMonthsIso(iso: String, months: Int, day: Int? = null): String {
        val d = CalendarDate.parse(iso) ?: return iso
        val anchor = day ?: d.day
        val monthIndex = d.month - 1 + months
        val last = CalendarDate.js(d.year, monthIndex + 1, 0).day
        return CalendarDate.js(d.year, monthIndex, Math.min(anchor, last)).iso
    }

    /** Next charge after `lastDate`, keeping the typical day of the month. */
    fun nextChargeDate(lastDate: String, cadence: SubscriptionCadence, day: Int? = null): String {
        if (cadence.months == 0) return CalendarDate.parse(lastDate)?.plusDays(7)?.iso ?: lastDate
        return addMonthsIso(lastDate, cadence.months, day)
    }

    /** Monthly equivalent cost, JS `round2`. */
    fun monthlyEquivalent(amount: Double, cadence: SubscriptionCadence): Double = JSNumber.round2(amount * cadence.perMonth)
}
