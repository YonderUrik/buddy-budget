package io.buddybudget.app.features.debts

import io.buddybudget.app.features.help.showError

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.bbLocale
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.DebtEventInput
import io.buddybudget.core.data.DebtEventView
import io.buddybudget.core.data.DebtPlanRow
import io.buddybudget.core.data.DebtView
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.domain.debts.DebtCreateInput
import io.buddybudget.core.domain.debts.DebtEventDialogKind
import io.buddybudget.core.domain.debts.DebtsRules
import io.buddybudget.core.domain.debts.DebtsText
import io.buddybudget.core.domain.debts.DebtsUiState
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset

/**
 * State of Debiti (10-debts): the one `GET /api/debts?include=insights` response shared by the overview and the loan
 * detail (DEBT-001), the dialogs and every mutation (refetch after each, DEBT-037). Logic lives in :core
 * (`DebtsUiState`, `DebtsRules`, `DebtCalc`); this model only sequences API calls. Same fields as `DebtsModel` on iOS.
 */
class DebtsModel(val env: AppEnvironment) {
    var state by mutableStateOf(DebtsUiState(today = todayKey()))
        private set
    var addOpen by mutableStateOf(false)
    /** Pay-installment dialog: debt id + row. */
    var paying by mutableStateOf<Pair<String, DebtPlanRow>?>(null)
    var eventKind by mutableStateOf<DebtEventDialogKind?>(null)
    var earlyOpen by mutableStateOf(false)
    var confirmDelete by mutableStateOf(false)
    /** Events hidden while their undo toast runs (decision 0003). */
    var pendingEventRemovals by mutableStateOf<Set<String>>(emptySet())
        private set
    var bulkBusy by mutableStateOf(false)
        private set
    var categories by mutableStateOf<List<MovementCategory>>(emptyList())
        private set

    private val scope = MainScope()
    private var started = false
    private var debugDialogOpened = false

    val currency: String get() = env.session.currency

    private fun tr(italian: String, values: Map<String, String> = emptyMap()) = env.session.strings().lookup(italian, values)

    private fun message(e: Exception): String {
        val text = (e as? ApiError.Http)?.body?.message
        return if (!text.isNullOrEmpty()) text else tr("Qualcosa è andato storto. Riprova.")
    }

    suspend fun start() {
        if (started) return
        started = true
        // Own scope: a screen effect cancelled by recomposition must not fail the first load.
        scope.launch { load() }.join()
    }

    /** DEBT-001: keeps the previous data when a refresh fails. */
    suspend fun load() {
        state = state.copy(today = todayKey())
        try {
            state = state.copy(data = env.debts.view(), failed = false)
            openDebugDialog()
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (state.data == null) state = state.copy(failed = true)
        }
    }

    fun retry() {
        state = state.copy(failed = false)
        scope.launch { load() }
    }

    fun select(id: String?) {
        state = state.copy(selectedId = id)
    }

    fun setExitExtra(value: Double) {
        state = state.copy(exitExtra = value)
    }

    /** DEBUG-only `--es bbDialog add|pay|rate|balance|early|delete` opens a dialog for screenshots. */
    private fun openDebugDialog() {
        if (debugDialogOpened) return
        val name = DebugLaunch.value("bbDialog") ?: return
        debugDialogOpened = true
        val debt = state.selected
        when (name) {
            "add" -> addOpen = true
            "pay" -> debt?.plan?.rows?.firstOrNull { it.status != io.buddybudget.core.domain.debts.DebtInstallmentStatus.PAGATA }?.let { paying = debt.id to it }
            "rate" -> eventKind = DebtEventDialogKind.RateChange
            "balance" -> eventKind = DebtEventDialogKind.BalanceCorrection
            "early", "early-filled" -> earlyOpen = true
            "delete" -> confirmDelete = true
        }
    }

    /** DEBT-016. */
    suspend fun create(input: DebtCreateInput): String? = try {
        env.debts.create(input)
        addOpen = false
        env.toasts.show(BBToastKind.Success, tr("Debito aggiunto"))
        load()
        null
    } catch (e: Exception) {
        message(e)
    }

    /** DEBT-023/025/026/034. */
    suspend fun addEvent(debtId: String, input: DebtEventInput): String? = try {
        env.debts.addEvent(debtId, input)
        paying = null
        eventKind = null
        earlyOpen = false
        load()
        null
    } catch (e: Exception) {
        message(e)
    }

    /** DEBT-020. */
    fun markAllPaid(debt: DebtView) {
        val upTo = DebtsRules.unsettled(debt).lastOrNull()?.number ?: return
        if (bulkBusy) return
        bulkBusy = true
        scope.launch {
            try {
                val count = env.debts.bulkPay(debt.id, upTo)
                env.toasts.show(BBToastKind.Success, DebtsText(env.session.strings().language.bbLocale) { env.session.strings().lookup(it) }.bulkDone(count))
                load()
            } catch (e: Exception) {
                env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Debito)
            } finally {
                bulkBusy = false
            }
        }
    }

    /** DEBT-027 + decision 0003: hidden at once; the DELETE is sent when the undo toast expires. */
    fun removeEvent(debtId: String, event: DebtEventView) {
        pendingEventRemovals = pendingEventRemovals + event.id
        env.toasts.showUndo(tr("Evento eliminato"), tr("Annulla"),
            onUndo = { pendingEventRemovals = pendingEventRemovals - event.id },
            onCommit = {
                scope.launch {
                    try {
                        env.debts.deleteEvent(debtId, event.id)
                    } catch (e: Exception) {
                        env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Debito)
                    }
                    load()
                    pendingEventRemovals = pendingEventRemovals - event.id
                }
            })
    }

    /** DEBT-028: after the confirmation; back to the overview. */
    fun delete(debt: DebtView, done: () -> Unit) {
        scope.launch {
            try {
                env.debts.delete(debt.id)
                confirmDelete = false
                state = state.copy(selectedId = null)
                done()
                load()
            } catch (e: Exception) {
                confirmDelete = false
                env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Debito)
            }
        }
    }

    /** DEBT-024. */
    suspend fun candidates(dueDate: String): List<Movement> {
        if (categories.isEmpty()) categories = runCatching { env.categoriesApi.list() }.getOrDefault(emptyList())
        return runCatching { env.debts.candidates(dueDate) }.getOrDefault(emptyList())
    }

    companion object {
        /** "Today" of the plans: the UTC date, as the server. */
        fun todayKey(): String = CalendarDate.of(Instant.now(), ZoneOffset.UTC).iso
    }
}
