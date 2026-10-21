package io.buddybudget.core.domain.liquidity

import java.text.Collator
import java.util.Locale

/** Expense group of a category, in donut order (`EXPENSE_GROUP_KEYS` + `daCategorizzare`). */
enum class LegendGroup(val key: String) {
    DOVUTA("dovuta"), VOLUTA("voluta"), FUTURO("futuro"), SALTUARIA("saltuaria"), DA_CATEGORIZZARE("daCategorizzare");

    companion object {
        fun fromKey(key: String): LegendGroup? = entries.firstOrNull { it.key == key }
    }
}

/** `CategoryAmount` of `lib/calc/expenses.ts`. */
data class LegendCategoryAmount(
    val categoryId: String,
    val name: String,
    val group: LegendGroup,
    val amount: Double,
    val color: String,
    val icon: String,
)

data class LegendBudgetStats(
    /** spent / budget × 100; null when the budget is 0. */
    val saturazionePct: Double?,
    /** spent / total spent × 100; null when the total is 0. */
    val quotaPct: Double?,
)

data class LegendEntry(
    val category: LegendCategoryAmount,
    val budgetAmount: Double,
    val saturazionePct: Double?,
    val quotaPct: Double?,
)

enum class LegendSortDirection(val key: String) { ASC("asc"), DESC("desc") }

enum class LegendSortCriterion(val key: String) {
    PERCENTUALE("percentuale"), VALORE("valore"), BUDGET("budget"), NOME("nome");

    /** `LEGEND_SORT_DEFAULT_DIRECTION`. */
    val defaultDirection: LegendSortDirection get() = if (this == NOME) LegendSortDirection.ASC else LegendSortDirection.DESC
}

/** Category legend and budget saturation (`components/domain/expenses/category-breakdown-donut.utils.ts`). Same as Swift. */
object CategoryLegend {
    fun computeBudgetStats(amount: Double, budgetAmount: Double, totalSpeso: Double): LegendBudgetStats = LegendBudgetStats(
        saturazionePct = if (budgetAmount > 0) (amount / budgetAmount) * 100 else null,
        quotaPct = if (totalSpeso > 0) (amount / totalSpeso) * 100 else null,
    )

    /** Donut slices: by group (Dovute → Volute → Te futuro → Saltuarie → Da categorizzare), then amount descending. Stable. */
    fun sortCategoryAmounts(amounts: List<LegendCategoryAmount>): List<LegendCategoryAmount> = amounts.sortedWith { a, b ->
        if (a.group != b.group) a.group.ordinal - b.group.ordinal else sign(b.amount - a.amount)
    }

    /** Legend rows by the chosen criterion; null percentages always go last whatever the direction. Stable. */
    fun sortLegendEntries(entries: List<LegendEntry>, criterion: LegendSortCriterion, direction: LegendSortDirection): List<LegendEntry> =
        entries.sortedWith { a, b ->
            when (criterion) {
                LegendSortCriterion.PERCENTUALE -> compareNullable(a.quotaPct, b.quotaPct, direction)
                LegendSortCriterion.BUDGET -> compareNullable(a.saturazionePct, b.saturazionePct, direction)
                LegendSortCriterion.VALORE ->
                    sign(if (direction == LegendSortDirection.DESC) b.category.amount - a.category.amount else a.category.amount - b.category.amount)
                LegendSortCriterion.NOME ->
                    if (direction == LegendSortDirection.DESC) italian.compare(b.category.name, a.category.name)
                    else italian.compare(a.category.name, b.category.name)
            }
        }

    private fun compareNullable(a: Double?, b: Double?, direction: LegendSortDirection): Int = when {
        a == null && b == null -> 0
        a == null -> 1
        b == null -> -1
        else -> sign(if (direction == LegendSortDirection.DESC) b - a else a - b)
    }

    /** JS comparator result → Int (NaN counts as equal). */
    private fun sign(x: Double): Int = if (x < 0) -1 else if (x > 0) 1 else 0

    /** `a.localeCompare(b, "it")` (tertiary strength). */
    private val italian: Collator get() = Collator.getInstance(Locale.ITALIAN).apply { strength = Collator.TERTIARY }
}
