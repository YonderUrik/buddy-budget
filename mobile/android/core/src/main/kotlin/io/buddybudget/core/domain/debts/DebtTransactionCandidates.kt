package io.buddybudget.core.domain.debts

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.liquidity.MovementFields
import io.buddybudget.core.domain.liquidity.MovementFilter
import io.buddybudget.core.domain.liquidity.MovementList
import io.buddybudget.core.domain.periods.CalendarDate

/** Which filters were active when the user picked a transaction (`CandidateFilterUsage`). */
enum class DebtCandidateFilterUsage(val key: String) { NESSUNO("nessuno"), TESTO("testo"), CATEGORIA("categoria"), ENTRAMBI("entrambi") }

// Port of lib/debts/transaction-candidates.ts (picker of the transaction linked to an installment).

/**
 * Filters by text/category (AND, `filterTransactions`) and ranks by closeness to the installment: exact amount
 * (within one cent) first, then by days from the due date; stable on ties.
 */
fun <T : MovementFields> DebtCalc.rankInstallmentCandidates(
    transactions: List<T>,
    filter: MovementFilter,
    dueDate: String,
    expectedAmount: Double,
): List<T> {
    fun isExact(t: T) = Math.abs(Math.abs(t.amount) - expectedAmount) < 0.01
    return MovementList.filterTransactions(transactions, filter)
        .mapIndexed { index, t -> Triple(index, t, isExact(t) to candidateDayDistance(t.date, dueDate)) }
        .sortedWith { a, b ->
            val (ea, da) = a.third
            val (eb, db) = b.third
            if (ea != eb) return@sortedWith if (ea) -1 else 1
            val d = da - db
            // JS: NaN and 0 are falsy, so both fall through to the index.
            if (!d.isNaN() && d != 0.0) return@sortedWith if (d < 0) -1 else 1
            a.first.compareTo(b.first)
        }
        .map { it.second }
}

fun DebtCalc.describeFilterUsage(filter: MovementFilter): DebtCandidateFilterUsage {
    val text = JSNumber.trim(filter.searchText).isNotEmpty()
    val category = filter.categoryId != null
    return when {
        text && category -> DebtCandidateFilterUsage.ENTRAMBI
        text -> DebtCandidateFilterUsage.TESTO
        category -> DebtCandidateFilterUsage.CATEGORIA
        else -> DebtCandidateFilterUsage.NESSUNO
    }
}

/** `|Date.parse(a) − Date.parse(b)| / 86 400 000` for `YYYY-MM-DD` keys (UTC midnight); NaN if unparseable. */
internal fun candidateDayDistance(a: String, b: String): Double {
    if (a.length != 10 || b.length != 10) return Double.NaN
    val x = CalendarDate.parse(a) ?: return Double.NaN
    val y = CalendarDate.parse(b) ?: return Double.NaN
    return Math.abs(x.epochDay - y.epochDay).toDouble()
}
