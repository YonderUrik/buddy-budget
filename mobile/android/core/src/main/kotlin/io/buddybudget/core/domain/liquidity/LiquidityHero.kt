package io.buddybudget.core.domain.liquidity

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountSource
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.roundToLong

/** One end-of-day point of the Liquidità hero chart. */
data class LiquidityHeroPoint(val date: String, val value: Double)

/**
 * Liquidità hero under the month sentence (TX-009…011, web `LiquidityOverview` + `LiquidityHero`): the period choice,
 * the series for all accounts (liquidity class of the net-worth series) or for one account (rebuilt backwards from its
 * balance), the change over the period and its phrase. iOS: `LiquidityHero.swift`.
 */
object LiquidityHero {
    /** TX-010: `1M`, `3M`, `1A`, `Max`, default `3M`. */
    val periods: List<OverviewPeriod> = listOf(OverviewPeriod.OneMonth, OverviewPeriod.ThreeMonths, OverviewPeriod.OneYear, OverviewPeriod.Max)
    val defaultPeriod: OverviewPeriod = OverviewPeriod.ThreeMonths
    /** Net-worth class of the liquidity. */
    const val LIQUIDITY_CLASS = "liquidita"

    fun label(period: OverviewPeriod): String = when (period) {
        OverviewPeriod.OneMonth -> "1M"
        OverviewPeriod.ThreeMonths -> "3M"
        OverviewPeriod.OneYear -> "1A"
        OverviewPeriod.Max -> "Max"
    }

    /** Phrase after the change (web `PERIOD_PHRASES`, catalog keys). */
    fun phrase(period: OverviewPeriod): String = when (period) {
        OverviewPeriod.OneMonth -> "nell'ultimo mese"
        OverviewPeriod.ThreeMonths -> "negli ultimi 3 mesi"
        OverviewPeriod.OneYear -> "nell'ultimo anno"
        OverviewPeriod.Max -> "da quando c'è lo storico"
    }

    /** First day of the period (`getNetWorthPeriodRange`): today minus 1, 3 or 12 months (day clamped), or the earliest
     *  date for `max` (today when there is none). */
    fun periodStart(period: OverviewPeriod, today: CalendarDate, earliest: String?): String = when (period) {
        OverviewPeriod.OneMonth -> today.plusMonthsClamped(-1).iso
        OverviewPeriod.ThreeMonths -> today.plusMonthsClamped(-3).iso
        OverviewPeriod.OneYear -> today.plusMonthsClamped(-12).iso
        OverviewPeriod.Max -> earliest ?: today.iso
    }

    /** TX-011, all accounts: the liquidity class of the server's net-worth series (`GET /api/overview?period=`), whose
     *  last point is today's total. */
    fun totalSeries(view: OverviewView): List<LiquidityHeroPoint> =
        view.series.map { LiquidityHeroPoint(it.date, it.byClass[LIQUIDITY_CLASS] ?: 0.0) }

    /** TX-011, one account (`buildAccountBalanceSeries`): end-of-day balance from [from] to [today]. An account whose
     *  balance follows its transactions is today's balance minus the later movements (full amounts); a manual account is
     *  a flat line at today's balance. */
    fun accountSeries(balance: Double, followsTransactions: Boolean, movements: List<Pair<String, Double>>, from: String, today: String): List<LiquidityHeroPoint> {
        val start = CalendarDate.parse(from)
        val end = CalendarDate.parse(today)
        if (start == null || end == null || start > end) return listOf(LiquidityHeroPoint(today, round2(balance)))
        val byDate = HashMap<String, Double>()
        var after = 0.0
        if (followsTransactions) {
            for ((date, amount) in movements) {
                if (date > today) after += amount else byDate[date] = (byDate[date] ?: 0.0) + amount
            }
        }
        val points = ArrayList<LiquidityHeroPoint>()
        var running = after
        var cursor: CalendarDate = end
        while (cursor >= start) {
            val key = cursor.iso
            points.add(LiquidityHeroPoint(key, round2(balance - running)))
            running += byDate[key] ?: 0.0
            cursor = cursor.plusDays(-1)
        }
        return points.reversed()
    }

    /** Whether an account's balance follows its movements (`accountFollowsTransactions`). */
    fun followsTransactions(account: Account): Boolean = account.followsTransactions ?: (account.source == AccountSource.Auto)

    /** Change over the period (last − first); null with fewer than two points. */
    fun delta(points: List<LiquidityHeroPoint>): Double? =
        if (points.size < 2) null else points.last().value - points.first().value

    private fun round2(value: Double): Double = (value * 100).roundToLong() / 100.0
}
