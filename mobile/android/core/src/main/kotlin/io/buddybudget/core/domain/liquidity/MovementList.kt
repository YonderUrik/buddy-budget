package io.buddybudget.core.domain.liquidity

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

/**
 * The fields of a movement (transaction) the list helpers read. Amounts are the API decimal strings parsed
 * with `toDouble()` (= JS `Number(...)`).
 */
interface MovementFields {
    /** `YYYY-MM-DD`. */
    val date: String
    val description: String
    val note: String?
    val categoryId: String?
    val accountId: String?
    val amount: Double
    val excludedAmount: Double
}

/** `TransactionFilter` of `lib/calc/expenses.ts`. */
data class MovementFilter(
    /** null = every category; otherwise exact match. */
    val categoryId: String? = null,
    val searchText: String = "",
    /** null or empty = every account. */
    val accountId: String? = null,
)

/** One day of the movement list (`DayGroup` of `lib/liquidity/day-groups.ts`). */
data class MovementDayGroup<T>(
    /** `YYYY-MM-DD`. */
    val date: String,
    /** "Oggi", "Ieri" (catalog keys) or the localized long weekday date. */
    val label: String,
    /** Sum of the effective amounts of the day, JS `round2`. */
    val total: Double,
    val items: List<T>,
)

/** Movement list helpers: search/filter (`filterTransactions`) and day grouping (`groupByDay`). Same as Swift `MovementList`. */
object MovementList {
    /** `Number(amount) - Number(excludedAmount)`. */
    fun effectiveAmount(t: MovementFields): Double = t.amount - t.excludedAmount

    /** Exact category and/or account, then a case-insensitive substring of description or note, all in AND. */
    fun <T : MovementFields> filterTransactions(transactions: List<T>, filter: MovementFilter): List<T> {
        val normalizedSearch = JSNumber.trim(filter.searchText).lowercase()
        return transactions.filter { t ->
            if (filter.categoryId != null && t.categoryId != filter.categoryId) return@filter false
            if (!filter.accountId.isNullOrEmpty() && t.accountId != filter.accountId) return@filter false
            if (normalizedSearch.isEmpty()) return@filter true
            // Kotlin String.contains compares UTF-16 code units, like JS `includes`.
            val descriptionMatch = t.description.lowercase().contains(normalizedSearch)
            val noteMatch = (t.note ?: "").lowercase().contains(normalizedSearch)
            descriptionMatch || noteMatch
        }
    }

    /** Groups by date, most recent day first; inside a day the received order is kept. */
    fun <T : MovementFields> groupByDay(transactions: List<T>, today: CalendarDate, locale: BBLocale): List<MovementDayGroup<T>> {
        val byDate = LinkedHashMap<String, MutableList<T>>()
        for (t in transactions) byDate.getOrPut(t.date) { mutableListOf() }.add(t)
        // String.compareTo is code-unit order, like JS `<`.
        return byDate.entries.sortedWith { a, b -> b.key.compareTo(a.key) }.map { (date, items) ->
            val label = CalendarDate.parse(date)?.let { BBFormat.dayLabel(it, today, locale) } ?: date
            val sum = items.fold(0.0) { acc, t -> acc + effectiveAmount(t) }
            MovementDayGroup(date, label, JSNumber.round(sum * 100) / 100, items)
        }
    }
}
