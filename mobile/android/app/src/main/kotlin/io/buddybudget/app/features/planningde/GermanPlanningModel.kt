package io.buddybudget.app.features.planningde

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.FinancialPlanningApi
import io.buddybudget.core.data.PlanningPortfolio
import io.buddybudget.core.data.PlanningResults
import io.buddybudget.core.domain.planningde.GermanPlanEditor
import io.buddybudget.core.domain.planningde.GermanTaxSettings
import io.buddybudget.core.domain.planningde.PlanJson
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * State of the German Tax and Income screens (13-planning-de, PLAN-007…031): the plan editor, the server results of the
 * saved plan, debounced results of the edited plan, and the instrument names. Logic lives in :core (`GermanPlanEditor`,
 * `GermanPlanValidation`, `GermanPlanningText`); this model only sequences API calls. One per signed-in session (kept
 * by `InvestmentsModel`), shared by the `Tasse` and `Dividendi` tabs. Same fields as `GermanPlanningModel` on iOS.
 */
class GermanPlanningModel(private val api: FinancialPlanningApi) {
    enum class Phase { LOADING, FAILED, LOADED }

    var phase by mutableStateOf(Phase.LOADING)
        private set
    var editor by mutableStateOf<GermanPlanEditor?>(null)
        private set
    /** Results of the saved plan (`?include=results`); Income always shows these. */
    var savedResults by mutableStateOf<PlanningResults?>(null)
        private set
    /** Results of the edited plan (`POST /api/financial-planning/results`), while the draft differs from the saved plan. */
    var previewResults by mutableStateOf<PlanningResults?>(null)
        private set
    var portfolio by mutableStateOf<PlanningPortfolio?>(null)
        private set
    /** Unsaved-changes sheet: what to do once the user saved or discarded. */
    var pendingLeave by mutableStateOf<(() -> Unit)?>(null)
    /** 409 «Reload» confirmation. */
    var reloadPrompt by mutableStateOf(false)

    private val scope = MainScope()
    private var previewJob: Job? = null

    /** Results shown by the Tax screen: the edited plan's when available, else the saved plan's. */
    val taxResults: PlanningResults?
        get() = previewResults.takeIf { editor?.isDirty == true } ?: savedResults

    val isDirty: Boolean get() = editor?.isDirty ?: false

    suspend fun start() {
        if (phase == Phase.LOADED && editor != null) return
        load()
    }

    /** PLAN-007, PLAN-008: plan + results and the instrument names; either failing shows «Could not load the plan.». */
    suspend fun load() {
        if (editor == null) phase = Phase.LOADING
        try {
            val planLoad = scope.async { api.load() }
            val portfolioLoad = scope.async { api.portfolio() }
            val envelope = planLoad.await()
            val names = portfolioLoad.await()
            // A refresh keeps the user's edits (and their revision: a stale save gets the 409 message, PLAN-013).
            if (editor?.isDirty != true) editor = GermanPlanEditor(envelope.plan, envelope.revision)
            savedResults = envelope.results
            portfolio = names
            phase = Phase.LOADED
            schedulePreview()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (editor == null) phase = Phase.FAILED
        }
    }

    fun retry() {
        phase = Phase.LOADING
        scope.launch { load() }
    }

    fun updateTax(change: (GermanTaxSettings) -> GermanTaxSettings) {
        editor = editor?.updateTax(change)
        schedulePreview()
    }

    /** Debounced results of the edited plan (only when it is valid: the server rejects invalid plans). */
    private fun schedulePreview() {
        previewJob?.cancel()
        val current = editor
        if (current == null || !current.isDirty) {
            previewResults = null
            return
        }
        if (!current.isValid) return
        val plan = current.draft
        previewJob = scope.launch {
            delay(400)
            val results = try { api.preview(plan) } catch (e: CancellationException) { throw e } catch (e: Exception) { return@launch }
            if (editor?.draft == plan) previewResults = results
        }
    }

    /** PLAN-012, PLAN-013. Returns true when saved. */
    suspend fun save(): Boolean {
        val saving = editor?.beginSave() ?: return false
        editor = saving
        return try {
            val saved = api.save(saving.draft, saving.revision)
            val next = saving.saveSucceeded(saved.plan, saved.revision)
            editor = next
            val preview = previewResults
            if (preview != null && PlanJson.same(saving.draft, saved.plan)) savedResults = preview
            previewResults = null
            previewJob?.cancel()
            // The results of the saved plan (Income reads them).
            try {
                val fresh = api.load()
                if (fresh.revision == next.revision) savedResults = fresh.results
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
            }
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            editor = saving.saveFailed(conflict = (e as? ApiError.Http)?.status == 409)
            false
        }
    }

    /** Unsaved-changes sheet «Discard changes». */
    fun discard() {
        editor = editor?.discard()
        previewResults = null
        previewJob?.cancel()
    }

    /** 409 «Reload»: the server's plan replaces the edits (after confirmation). */
    suspend fun reload() {
        editor = null
        previewResults = null
        load()
    }

    /** Runs [action] now, or after the unsaved-changes sheet when the plan has unsaved edits. */
    fun confirmLeave(action: () -> Unit) {
        if (isDirty) pendingLeave = action else action()
    }

    suspend fun resolveLeave(save: Boolean) {
        val action = pendingLeave ?: return
        pendingLeave = null
        if (save) {
            if (!save()) return
        } else {
            discard()
        }
        action()
    }

    fun launch(block: suspend () -> Unit) = scope.launch { block() }
}
