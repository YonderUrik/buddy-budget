package io.buddybudget.core.data

import kotlinx.serialization.Serializable

// Overview (spec: api/endpoints/overview.md, features/02-overview.md). The server computes everything; the app only
// renders it. Same names on iOS (`OverviewAPI`, `OverviewView`).

/** Chart window of `GET /api/overview` (OV-009). [raw] values are the API's. */
enum class OverviewPeriod(val raw: String, val label: String, val changePhrase: String) {
    OneMonth("1mese", "1M", "nell'ultimo mese"),
    ThreeMonths("3mesi", "3M", "negli ultimi 3 mesi"),
    OneYear("1anno", "1A", "nell'ultimo anno"),
    Max("max", "Max", "dall'inizio");

    companion object {
        /** OV-009: `3M` on every visit. */
        val Default = ThreeMonths
    }
}

/** `GET /api/overview` → `OverviewView` (amounts are numbers; debts negative everywhere). */
@Serializable
data class OverviewView(
    val currency: String,
    val today: String,
    val period: String,
    val includePension: Boolean,
    val isEmpty: Boolean,
    val todayByClass: Map<String, Double> = emptyMap(),
    val series: List<SeriesPoint> = emptyList(),
    val change: Change,
    val composition: List<CompositionItem> = emptyList(),
    val monthLabel: String,
    val monthPace: MonthPace,
    val voice: List<VoiceLine> = emptyList(),
    val investments: Investments? = null,
    val pension: Pension? = null,
    val debts: Debts? = null,
    val renewalAlerts: List<RenewalAlert> = emptyList(),
) {
    @Serializable
    data class SeriesPoint(val date: String, val value: FlexDouble, val byClass: Map<String, Double> = emptyMap(), val isEstimated: Boolean = false)

    @Serializable
    data class Change(val start: FlexDouble, val end: FlexDouble, val delta: FlexDouble, val deltaPct: FlexDouble? = null)

    @Serializable
    data class Highlight(val amount: FlexDouble, val ratio: FlexDouble? = null, val label: String)

    @Serializable
    data class CompositionItem(
        val key: String,
        val label: String,
        val detail: String,
        val amount: FlexDouble,
        val share: FlexDouble,
        val isLiability: Boolean,
        val highlight: Highlight? = null,
    )

    @Serializable
    data class MonthPace(
        val spentSoFar: FlexDouble,
        val typicalSoFar: FlexDouble? = null,
        val income: FlexDouble,
        val budgetTotal: FlexDouble? = null,
        val budgetSpent: FlexDouble,
        val dayOfMonth: Int,
        val daysInMonth: Int,
        val current: List<Double> = emptyList(),
        val typical: List<Double>? = null,
    )

    @Serializable
    data class VoiceSegment(val text: String, val strong: Boolean = false)

    @Serializable
    data class VoiceLine(val key: String, val segments: List<VoiceSegment> = emptyList())

    @Serializable
    data class Investments(val value: FlexDouble, val positions: Int, val paid: FlexDouble, val marketGain: FlexDouble)

    @Serializable
    data class Pension(val value: FlexDouble, val funds: Int, val included: Boolean)

    @Serializable
    data class NextDue(val debtId: String, val name: String, val date: String, val amount: FlexDouble, val overdue: Boolean)

    @Serializable
    data class Debts(val total: FlexDouble, val count: Int, val debtFreeDate: String? = null, val nextDue: List<NextDue> = emptyList())

    @Serializable
    data class RenewalAlert(
        val connectionId: String,
        val institutionName: String,
        val state: String,
        val daysLeft: Int? = null,
        val message: String,
    )
}

class OverviewApi(private val client: ApiClient) {
    /** `GET /api/overview?period=&includePension=&today=` — `today` is the device's local day (`YYYY-MM-DD`). */
    suspend fun view(period: OverviewPeriod, includePension: Boolean, today: String): OverviewView =
        client.get("api/overview", OverviewView.serializer(), query(period, includePension, today))

    companion object {
        fun query(period: OverviewPeriod, includePension: Boolean, today: String): Map<String, String> =
            mapOf("period" to period.raw, "includePension" to if (includePension) "1" else "0", "today" to today)
    }
}
