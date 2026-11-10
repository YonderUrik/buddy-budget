package io.buddybudget.core.data

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

// Liquidità month and analysis views (spec: api/endpoints/liquidity.md). Same names on iOS (`LiquidityAPI`).

/** A sentence from the server's voice engine: plain and strong (bold) segments. */
@Serializable
data class VoiceSegment(val text: String, val strong: Boolean = false)

/** `GET /api/liquidity/month` (TX-008, TX-049…051): month figures, pace, groups and budgets for Movimenti. */
@Serializable
data class LiquidityMonth(
    val currency: String = "EUR",
    val today: String = "",
    val month: Month,
    val accountId: String? = null,
    val accounts: Accounts,
    val spent: Double = 0.0,
    val income: Double = 0.0,
    val pace: Pace,
    val groups: List<Group> = emptyList(),
    val uncategorizedSpent: Double = 0.0,
    val budget: BudgetTotal? = null,
    val budgets: List<CategoryBudget> = emptyList(),
    val toFix: Int = 0,
    val voice: List<VoiceLine> = emptyList(),
) {
    @Serializable data class Month(val from: String, val to: String, val label: String)
    @Serializable data class Accounts(val total: Double = 0.0, val count: Int = 0)

    @Serializable
    data class Pace(
        val spentSoFar: Double = 0.0,
        /** «Di solito a questo punto»; null when there is no history. */
        val typicalSoFar: Double? = null,
        val dayOfMonth: Int = 1,
        val daysInMonth: Int = 30,
    )

    @Serializable data class Group(val key: String, val label: String, val amount: Double = 0.0)
    @Serializable data class BudgetTotal(val total: Double = 0.0, val spent: Double = 0.0, val remaining: Double = 0.0)

    @Serializable
    data class CategoryBudget(
        val categoryId: String,
        val name: String,
        val color: String = "slate",
        val icon: String = "package",
        val budget: Double = 0.0,
        val spent: Double = 0.0,
        val remaining: Double = 0.0,
        val progress: Double = 0.0,
    )

    @Serializable data class VoiceLine(val key: String, val segments: List<VoiceSegment> = emptyList())

    /** «Avanzo finora» = entrate − spese (TX-049). */
    val surplus: Double get() = JSNumber.round2(income - spent)
}

/** `GET /api/liquidity/analysis` (TX-052…061): everything Analisi shows for one period. */
@Serializable
data class LiquidityAnalysis(
    val currency: String = "EUR",
    val today: String = "",
    val period: String = "mese",
    val accountId: String? = null,
    val range: Range,
    val previousRange: Range,
    val isCurrentMonth: Boolean = false,
    val spent: Double = 0.0,
    val spentBefore: Double = 0.0,
    val delta: Double = 0.0,
    val curve: List<CurvePoint> = emptyList(),
    val typical: List<Double>? = null,
    val groups: List<Group> = emptyList(),
    val hasBudgets: Boolean = false,
    val incomeSources: List<IncomeSource> = emptyList(),
    val savings: List<SavingsPoint> = emptyList(),
    val saved: Double = 0.0,
    val sentence: String = "",
) {
    @Serializable data class Range(val from: String, val to: String)
    @Serializable data class CurvePoint(val date: String, val value: Double)

    @Serializable
    data class GroupCategory(
        val id: String,
        val name: String,
        val color: String = "slate",
        val icon: String = "package",
        val amount: Double = 0.0,
        val budget: Double? = null,
    )

    @Serializable data class Group(val key: String, val label: String, val amount: Double = 0.0, val categories: List<GroupCategory> = emptyList())

    @Serializable
    data class IncomeSource(
        val categoryId: String,
        val name: String,
        val color: String = "slate",
        val icon: String = "package",
        val amount: Double = 0.0,
        val quotaPct: Double? = null,
    )

    @Serializable data class SavingsPoint(val month: String, val cumulative: Double = 0.0)
}

/** Manual movements can be added only to manual accounts (TX-044). */
val Account.isManual: Boolean get() = !isLinked

class LiquidityApi(private val client: ApiClient) {
    suspend fun month(accountId: String?, today: CalendarDate): LiquidityMonth = client.get(
        "api/liquidity/month", LiquidityMonth.serializer(),
        buildMap {
            put("today", today.iso)
            accountId?.let { put("accountId", it) }
        },
    )

    /** `period`: `mese` | `3mesi` | `anno` (| `settimana`). */
    suspend fun analysis(period: String, ref: CalendarDate, accountId: String?, today: CalendarDate): LiquidityAnalysis = client.get(
        "api/liquidity/analysis", LiquidityAnalysis.serializer(),
        buildMap {
            put("period", period)
            put("ref", ref.iso)
            put("today", today.iso)
            accountId?.let { put("accountId", it) }
        },
    )

}
