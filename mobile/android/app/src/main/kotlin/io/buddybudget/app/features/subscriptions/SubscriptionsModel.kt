package io.buddybudget.app.features.subscriptions

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.CategoryChange
import io.buddybudget.core.data.ManualSubscriptionInput
import io.buddybudget.core.data.SubscriptionCategory
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionPatch
import io.buddybudget.core.data.SubscriptionStatus
import io.buddybudget.core.domain.subscriptions.SubscriptionCadence
import io.buddybudget.core.domain.subscriptions.SubscriptionDecisionRoute
import io.buddybudget.core.domain.subscriptions.SubscriptionForm
import io.buddybudget.core.domain.subscriptions.SubscriptionQuickAction
import io.buddybudget.core.domain.subscriptions.SubscriptionsUiState
import io.buddybudget.core.domain.subscriptions.SubscriptionsView
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

/**
 * State and actions of Liquidità · Abbonamenti (SUB-001…026). Logic lives in :core (`SubscriptionsView`,
 * `SubscriptionForm`, `SubscriptionsUiState`); this model only sequences API calls. Same fields as
 * `SubscriptionsModel` on iOS.
 */
class SubscriptionsModel(private val env: AppEnvironment) {
    var state by mutableStateOf(SubscriptionsUiState())
        private set
    var categories by mutableStateOf<List<SubscriptionCategory>>(emptyList())
        private set
    /** A remote merchant logo rendered: show the Logo.dev credit. */
    var logosShown by mutableStateOf(false)
    /** Archive disclosures, collapsed by default (SUB-012). */
    var endedExpanded by mutableStateOf(false)
    var excludedExpanded by mutableStateOf(false)

    /** Detail (SUB-016…022). */
    var detailOpen by mutableStateOf(false)
    var openedKey by mutableStateOf<String?>(null)
        private set
    var detailError by mutableStateOf<String?>(null)
    var detailBusy by mutableStateOf(false)
        private set

    /** Add (SUB-023…025). */
    var addOpen by mutableStateOf(false)
    var addError by mutableStateOf<String?>(null)
    var addBusy by mutableStateOf(false)
        private set

    private val api = env.subscriptions
    private val scope = MainScope()
    private var started = false

    private fun tr(italian: String): String = env.session.strings().lookup(italian)

    /** The opened item, as of the last fetch. */
    val openedItem: SubscriptionItem? get() = openedKey?.let { state.item(it) }

    suspend fun start() {
        if (started) return
        started = true
        val picker = scope.async { categories = runCatching { api.expenseCategories() }.getOrDefault(emptyList()) }
        load()
        picker.await()
    }

    /** SUB-001: one call; keeps the previous data when a refresh fails. */
    suspend fun load() {
        if (state.response == null) state = state.copy(phase = SubscriptionsUiState.Phase.Loading)
        try {
            state = state.copy(response = api.list(), phase = SubscriptionsUiState.Phase.Loaded)
        } catch (e: Exception) {
            if (state.response == null) state = state.copy(phase = SubscriptionsUiState.Phase.Failed)
        }
    }

    fun retry() {
        state = state.copy(phase = SubscriptionsUiState.Phase.Loading)
        scope.launch { load() }
    }

    // Quick actions (SUB-008, SUB-010, SUB-013, SUB-015)

    fun quick(item: SubscriptionItem, status: SubscriptionStatus) {
        if (state.isSaving) return
        when (val action = SubscriptionsView.quickAction(item, status)) {
            SubscriptionQuickAction.OpenDetail -> open(item)
            is SubscriptionQuickAction.Save -> {
                state = state.copy(isSaving = true)
                scope.launch {
                    try {
                        api.decide(action.input)
                        load()
                    } catch (e: Exception) {
                        env.toasts.show(BBToastKind.Error, message(e, "Impossibile salvare l'abbonamento"))
                    }
                    state = state.copy(isSaving = false)
                }
            }
        }
    }

    // Detail

    fun open(item: SubscriptionItem) {
        openedKey = item.key
        detailError = null
        detailOpen = true
    }

    /** SUB-017/018: PATCH a saved choice, else POST `rilevato`; closes and refetches on success. */
    fun decide(item: SubscriptionItem, status: SubscriptionStatus) {
        detailError = null
        when (val route = SubscriptionsView.decisionRoute(item, status)) {
            SubscriptionDecisionRoute.MissingData -> detailError = tr("Mancano importo e cadenza")
            is SubscriptionDecisionRoute.Patch -> runDetail { api.update(route.id, SubscriptionPatch(status = route.status)) }
            is SubscriptionDecisionRoute.Post -> runDetail { api.decide(route.input) }
        }
    }

    /** SUB-019: name and category; manual items also amount, cadence and next date. */
    fun saveEdits(item: SubscriptionItem, name: String, amountText: String, cadence: SubscriptionCadence, nextDate: String, categoryId: String?) {
        val id = item.id ?: return
        detailError = null
        when (val result = SubscriptionForm.validate(name, amountText, item.isManual)) {
            is SubscriptionForm.Result.Invalid -> detailError = tr(result.key)
            is SubscriptionForm.Result.Valid -> {
                val patch = SubscriptionPatch(
                    name = result.name,
                    categoryId = CategoryChange.Set(categoryId),
                    amount = if (item.isManual) result.amount else null,
                    cadence = if (item.isManual) cadence else null,
                    nextDate = if (item.isManual) nextDate else null,
                )
                runDetail { api.update(id, patch) }
            }
        }
    }

    private fun runDetail(call: suspend () -> Unit) {
        detailBusy = true
        scope.launch {
            try {
                call()
                detailOpen = false
                load()
            } catch (e: Exception) {
                detailError = message(e, "Impossibile aggiornare l'abbonamento")
            }
            detailBusy = false
        }
    }

    /**
     * SUB-020/021 + decision 0003: the web removes without confirmation, so the item leaves the list at once and the
     * DELETE is sent when the 5 s undo toast expires.
     */
    fun remove(item: SubscriptionItem) {
        val id = item.id ?: return
        detailOpen = false
        state = state.copy(pendingRemovals = state.pendingRemovals + id)
        val text = if (item.isManual) "Abbonamento eliminato" else "Abbonamento ripristinato com'era"
        env.toasts.showUndo(
            tr(text), env.session.strings().get(L10n.undo),
            onUndo = { state = state.copy(pendingRemovals = state.pendingRemovals - id) },
            onCommit = { scope.launch { commitRemoval(id) } },
        )
    }

    private suspend fun commitRemoval(id: String) {
        try {
            api.delete(id)
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e, "Impossibile rimuovere l'abbonamento"))
        }
        load()
        state = state.copy(pendingRemovals = state.pendingRemovals - id)
    }

    // Add (SUB-023, SUB-024)

    fun startAdding() {
        addError = null
        addOpen = true
    }

    fun add(name: String, amountText: String, cadence: SubscriptionCadence, nextDate: String, categoryId: String?) {
        addError = null
        when (val result = SubscriptionForm.validate(name, amountText, true)) {
            is SubscriptionForm.Result.Invalid -> addError = tr(result.key)
            is SubscriptionForm.Result.Valid -> {
                addBusy = true
                scope.launch {
                    try {
                        api.addManual(ManualSubscriptionInput(result.name, result.amount ?: 0.0, cadence, nextDate, categoryId))
                        addOpen = false
                        load()
                    } catch (e: Exception) {
                        addError = message(e, "Impossibile salvare l'abbonamento")
                    }
                    addBusy = false
                }
            }
        }
    }

    /** The server's message (already translated, e.g. the 409 duplicate name), else a generic one. */
    private fun message(error: Exception, fallback: String): String {
        val text = (error as? ApiError.Http)?.body?.message
        return if (!text.isNullOrEmpty()) tr(text) else tr(fallback)
    }
}
