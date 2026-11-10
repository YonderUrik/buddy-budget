package io.buddybudget.core.data

import kotlinx.serialization.Serializable

// «Il tuo quadro» modules in «Altro» (spec: api/endpoints/sidebar.md, features/00 SHELL-028…038).
// Same names on iOS (`SidebarAPI`).

/** `GET /api/sidebar/summary`. */
@Serializable
data class SidebarSummary(
    val currency: String = "EUR",
    val netWorth: NetWorth? = null,
    val portfolio: Portfolio? = null,
    val watchlist: List<WatchItem> = emptyList(),
    val triggeredAlerts: Int = 0,
) {
    @Serializable data class PensionPart(val total: FlexDouble, val monthChange: FlexDouble? = null)

    @Serializable data class NetWorth(val total: FlexDouble, val monthChange: FlexDouble? = null, val pension: PensionPart? = null)

    @Serializable
    data class Holding(
        val instrumentId: String,
        val label: String,
        val name: String,
        val value: FlexDouble? = null,
        val dayChangePct: FlexDouble? = null,
        val spark: List<Double> = emptyList(),
        val triggeredAlerts: Int = 0,
    )

    @Serializable
    data class Portfolio(
        val totalValue: FlexDouble,
        val dayChange: FlexDouble? = null,
        val dayChangePct: FlexDouble? = null,
        val totalGain: FlexDouble,
        val totalGainPct: FlexDouble? = null,
        val holdings: List<Holding> = emptyList(),
    )

    @Serializable
    data class WatchItem(
        val instrumentId: String,
        val label: String,
        val name: String,
        val currency: String,
        val lastClose: FlexDouble? = null,
        val dayChangePct: FlexDouble? = null,
        val spark: List<Double> = emptyList(),
        val triggeredAlerts: Int = 0,
    )
}

/** `GET /api/sidebar/deadlines`. */
@Serializable
data class SidebarDeadlines(val currency: String = "EUR", val items: List<Item> = emptyList()) {
    @Serializable
    data class Item(
        val id: String,
        val kind: String,
        val label: String,
        val date: String,
        val amount: FlexDouble? = null,
        val overdue: Boolean = false,
        val href: String,
    )
}

/** `GET /api/sidebar/fire` (IT only; DE → 403). */
@Serializable
data class SidebarFire(
    val currency: String = "EUR",
    val wealth: FlexDouble,
    val target: FlexDouble? = null,
    val progress: FlexDouble? = null,
    val yearsToFire: FlexDouble? = null,
)

class SidebarApi(private val client: ApiClient) {
    suspend fun summary(): SidebarSummary = client.get("api/sidebar/summary", SidebarSummary.serializer())
    suspend fun deadlines(): SidebarDeadlines = client.get("api/sidebar/deadlines", SidebarDeadlines.serializer())
    suspend fun fire(): SidebarFire = client.get("api/sidebar/fire", SidebarFire.serializer())
}
