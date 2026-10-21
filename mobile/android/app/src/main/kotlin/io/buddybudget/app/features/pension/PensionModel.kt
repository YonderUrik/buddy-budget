package io.buddybudget.app.features.pension

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.PensionImportCounts
import io.buddybudget.core.data.PensionImportRowInput
import io.buddybudget.core.data.PensionSnapshot
import io.buddybudget.core.domain.pension.PensionTab
import io.buddybudget.core.domain.pension.PensionUiState
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset

/**
 * State of Pensione (09-pension): one `GET /api/pension/view` per selected fund feeds every tab (PEN-002), funds and
 * snapshots CRUD, the paste import. Logic lives in :core (`PensionUiState`, `PensionRules`, `PensionImport`,
 * `PensionCalc`); this model only sequences API calls. Same fields as `PensionModel` on iOS.
 */
class PensionModel(val env: AppEnvironment) {
    var state by mutableStateOf(PensionUiState())
        private set
    var pendingSnapshotRemovals by mutableStateOf<Set<String>>(emptySet())
        private set
    var importOpen by mutableStateOf(false)
    var confirmDeleteFund by mutableStateOf(false)
    var busy by mutableStateOf(false)
        private set

    private val scope = MainScope()
    private var started = false
    private var debugDialogOpened = false

    val today: String get() = state.view?.today ?: todayKey()
    val currency: String get() = state.view?.currency ?: env.session.currency

    private fun tr(italian: String, values: Map<String, String> = emptyMap()) = env.session.strings().lookup(italian, values)

    private fun message(e: Exception): String {
        val text = (e as? ApiError.Http)?.body?.message
        return if (!text.isNullOrEmpty()) text else tr("Operazione non riuscita")
    }

    suspend fun start() {
        if (started) return
        started = true
        scope.launch { load() }.join()
    }

    /** PEN-002 (403 → country-unavailable, PEN-001). */
    suspend fun load() {
        try {
            val view = env.pension.view(state.fundId)
            state = state.copy(view = view, fundId = view.fund?.id, failed = false, unavailable = false)
            // DEBUG-only `--es bbDialog import`: opens the paste import for screenshots (once).
            if (!debugDialogOpened && io.buddybudget.app.debug.DebugLaunch.value("bbDialog")?.startsWith("import") == true) {
                debugDialogOpened = true
                importOpen = true
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: ApiError.Http) {
            if (e.body.code == ApiErrorCode.CountryFeatureUnavailable) state = state.copy(unavailable = true)
            else if (state.view == null) state = state.copy(failed = true)
        } catch (e: Exception) {
            if (state.view == null) state = state.copy(failed = true)
        }
    }

    fun retry() {
        state = state.copy(failed = false)
        scope.launch { load() }
    }

    fun select(tab: PensionTab) {
        state = state.copy(tab = tab)
    }

    /** PEN-003. */
    fun selectFund(id: String) {
        if (id == state.fundId) return
        state = state.selectingFund(id)
        scope.launch { load() }
    }

    fun setSimulatedYears(years: Int?) {
        state = state.copy(simulatedYears = years)
    }

    fun setProjection(years: Int? = null, quarterly: Double? = null) {
        state = state.copy(projectionYears = years ?: state.projectionYears, projectionQuarterly = quarterly ?: state.projectionQuarterly)
    }

    /** PEN-006. */
    suspend fun createFund(name: String, adhesionDate: String): String? {
        busy = true
        return try {
            val id = env.pension.createFund(name, adhesionDate)
            state = state.selectingFund(id)
            load()
            null
        } catch (e: Exception) {
            message(e)
        } finally {
            busy = false
        }
    }

    /** PEN-008. */
    suspend fun updateFund(name: String, adhesionDate: String): String? {
        val fund = state.fund ?: return null
        busy = true
        return try {
            env.pension.updateFund(fund.id, name.takeIf { it != fund.name }, adhesionDate.takeIf { it != fund.adhesionDate })
            load()
            null
        } catch (e: Exception) {
            message(e)
        } finally {
            busy = false
        }
    }

    /** PEN-009. */
    suspend fun deleteFund(): String? {
        val fund = state.fund ?: return null
        confirmDeleteFund = false
        return try {
            env.pension.deleteFund(fund.id)
            val next = state.view?.funds?.firstOrNull { it.id != fund.id }?.id
            state = state.selectingFund(next).copy(tab = PensionTab.Overview)
            load()
            null
        } catch (e: Exception) {
            message(e)
        }
    }

    /** PEN-010. */
    suspend fun saveSnapshot(date: String, netContributions: Double, value: Double): String? {
        val fund = state.fund ?: return null
        return try {
            env.pension.saveSnapshot(fund.id, date, netContributions, value)
            load()
            null
        } catch (e: Exception) {
            message(e)
        }
    }

    /** PEN-012 + decision 0003. */
    fun removeSnapshot(snapshot: PensionSnapshot) {
        val fund = state.fund ?: return
        pendingSnapshotRemovals = pendingSnapshotRemovals + snapshot.id
        env.toasts.showUndo(tr("Fotografia eliminata"), tr("Annulla"),
            onUndo = { pendingSnapshotRemovals = pendingSnapshotRemovals - snapshot.id },
            onCommit = {
                scope.launch {
                    try {
                        env.pension.deleteSnapshot(fund.id, snapshot.id)
                    } catch (e: Exception) {
                        env.toasts.show(BBToastKind.Error, message(e))
                    }
                    load()
                    pendingSnapshotRemovals = pendingSnapshotRemovals - snapshot.id
                }
            })
    }

    /** PEN-017: counts, or the server message. */
    suspend fun importRows(rows: List<PensionImportRowInput>): Pair<PensionImportCounts?, String?> {
        val fund = state.fund ?: return null to ""
        return try {
            val counts = env.pension.importSnapshots(fund.id, rows)
            load()
            counts to null
        } catch (e: Exception) {
            null to message(e)
        }
    }

    companion object {
        fun todayKey(): String = CalendarDate.of(Instant.now(), ZoneOffset.UTC).iso
    }
}
