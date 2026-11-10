package io.buddybudget.core.domain.networth

/**
 * What a history chart says while imported data is on its way into it (OV-044, TX-076, web #447
 * `lib/net-worth/refresh-status.ts`). Pure rules; the apps feed them the import/sync state and the chart's load times.
 * Same names on iOS (`ChartRefresh`).
 */
object ChartRefresh {
    /** `Importing`: a file import or bank sync is running; `Updating`: it finished and the chart is reloading. */
    enum class State(val message: String) {
        Importing("Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco."),
        Updating("Aggiorno il grafico con i nuovi movimenti…"),
    }

    /** A finished import whose chart never reloads stops counting after this long (ms). */
    const val PENDING_MAX_AGE_MS = 2 * 60_000L

    /**
     * [importing]: an import or sync of the user is running; [pendingSince]: when one last finished (ms), until the chart
     * has newer data; [dataUpdatedAt]: when the chart's data was last received (0 before the first load).
     */
    fun state(importing: Boolean, pendingSince: Long?, dataUpdatedAt: Long, isFetching: Boolean): State? = when {
        importing -> State.Importing
        pendingSince != null && (isFetching || dataUpdatedAt < pendingSince) -> State.Updating
        else -> null
    }

    /** True once the chart holds data received after the import finished: the pending mark can go. */
    fun isSettled(pendingSince: Long?, dataUpdatedAt: Long, isFetching: Boolean): Boolean =
        pendingSince != null && !isFetching && dataUpdatedAt >= pendingSince

    /** A pending mark older than [PENDING_MAX_AGE_MS] is dropped (the chart was never reloaded). */
    fun freshPending(pendingSince: Long?, now: Long): Long? = pendingSince?.takeIf { now - it < PENDING_MAX_AGE_MS }
}
