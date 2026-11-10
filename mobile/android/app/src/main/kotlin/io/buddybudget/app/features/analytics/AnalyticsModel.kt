package io.buddybudget.app.features.analytics

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.AnalyticsAssumptionsPatch
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.NotificationPreferencesPatch
import io.buddybudget.core.domain.analytics.AnalyticsPeriodChoice
import io.buddybudget.core.domain.analytics.AnalyticsQuestion
import io.buddybudget.core.domain.analytics.AnalyticsRules
import io.buddybudget.core.domain.analytics.AnalyticsUiState
import io.buddybudget.core.domain.analytics.AnalyticsValidation
import io.buddybudget.core.domain.fire.FireRetireAt
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.fire.MonteCarlo
import io.buddybudget.core.domain.fire.MonteCarloInput
import io.buddybudget.core.domain.fire.MonteCarloResult
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.goals.GoalDraft
import io.buddybudget.core.domain.goals.GoalFormStep
import io.buddybudget.core.domain.goals.GoalKind
import io.buddybudget.core.domain.goals.GoalWizard
import io.buddybudget.core.domain.goals.GoalsRules
import io.buddybudget.core.domain.goals.GoalsUiState
import io.buddybudget.core.domain.overview.CatalogText
import io.buddybudget.core.domain.periods.DataPeriod
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

/** The two views of Analitiche (`ANALYTICS_TABS`). */
enum class AnalyticsTab(val title: String, val subtitle: String, val viewDescription: String, val iconKey: String) {
    Risposte("Risposte", "Muovi le ipotesi e guarda cosa cambia. I numeri tecnici sono in «Per esperti».",
        "Quanto ti serve, quando ci arrivi, quanto dura", "message-circle-question-mark"),
    Obiettivi("Obiettivi", "Per cosa metti da parte, quando ci arrivi e cosa cambia per il traguardo.",
        "Per cosa metti da parte e quando ci arrivi", "target"),
}

/** The goal form being shown (create or edit, start step, preset kind). */
data class GoalFormRequest(val goalId: String? = null, val startStep: GoalFormStep = GoalFormStep.TIPO, val presetKind: GoalKind? = null)

/**
 * State of Analitiche (11-analytics, 12-goals): one `GET /api/analytics/base` for «Risposte» (ANA-002), one
 * `GET /api/goals` for «Obiettivi» (GOAL-004), every mutation and the Monte Carlo off the main thread. Logic lives in
 * :core (`AnalyticsUiState`, `AnalyticsRules`, `GoalsRules`, `GoalWizard`); this model only sequences calls. Same fields
 * as `AnalyticsModel` on iOS.
 */
class AnalyticsModel(val env: AppEnvironment) {
    var tab by mutableStateOf(AnalyticsTab.Risposte)
    var state by mutableStateOf(AnalyticsUiState())
        private set
    var goals by mutableStateOf(GoalsUiState())
        private set
    /** Monte Carlo over the four rules, retiring today (ANA-023); null while computing or without spending. */
    var results by mutableStateOf<List<MonteCarloResult>?>(null)
        private set
    /** Expert simulation with the retire-at toggle (ANA-029). */
    var expertResult by mutableStateOf<MonteCarloResult?>(null)
        private set
    var updatingPeriod by mutableStateOf(false)
        private set
    var walkthroughOpen by mutableStateOf(false)
    var walkthroughStep by mutableStateOf(0)
    var targetDialogOpen by mutableStateOf(false)
    var assumptionsOpen by mutableStateOf(false)
    /** Glossary term shown in the bottom sheet (ANA-032). */
    var termId by mutableStateOf<String?>(null)
    val terDrafts = mutableStateMapOf<String, String>()
    var terError by mutableStateOf<String?>(null)
    // Goals
    var goalForm by mutableStateOf<GoalFormRequest?>(null)
    var goalFormError by mutableStateOf<String?>(null)
    var goalSaving by mutableStateOf(false)
        private set
    var confirmDeleteGoal by mutableStateOf<String?>(null)
    var deleteError by mutableStateOf<String?>(null)
    var goalBusy by mutableStateOf(false)
        private set
    /** Goal emails off: the summary step offers «Ricordamelo per email» (GOAL-023). */
    var offerReminders by mutableStateOf(false)
        private set
    /** DEBUG: step the new-goal form jumps to. */
    var debugStartStep by mutableStateOf<GoalFormStep?>(null)
        private set

    private val scope = MainScope()
    private var started = false
    private var autoOpened = false
    /** Arrived from «Primi passi» (`?traguardo=1`): the walkthrough does not open on top (ANA-007). */
    var fromGoalLink = false
    private var simulationKey: MonteCarloInput? = null
    private var expertKey: MonteCarloInput? = null
    private var simulationJob: Job? = null
    private var expertJob: Job? = null
    private var debugDialogOpened = false

    val currency: String get() = state.view?.currency ?: env.session.currency
    val todayYear: Int get() = state.today.year

    private fun tr(italian: String, values: Map<String, String> = emptyMap()) = env.session.strings().lookup(italian, values)

    private fun message(e: Exception): String {
        val text = (e as? ApiError.Http)?.body?.message
        return if (!text.isNullOrEmpty()) tr(text) else env.session.strings().get(L10n.genericError)
    }

    suspend fun start() {
        if (started) return
        started = true
        scope.launch { load() }.join()
    }

    fun refresh() = scope.launch { if (tab == AnalyticsTab.Risposte) load() else loadGoals(force = true) }

    // MARK: Risposte

    /** ANA-002 (403 → country-unavailable, ANA-001). Keeps the previous view when a refresh fails. */
    suspend fun load() {
        try {
            val view = env.analytics.base(todayKey())
            state = state.copy(view = view, failed = false, unavailable = false)
            terDrafts.clear()
            terDrafts.putAll(AnalyticsRules.terDrafts(view.storedAssumptions.terByInstrument))
            scheduleSimulation()
            // ANA-005: the walkthrough opens by itself on the first visit, not when arriving for «Il tuo traguardo».
            if (!view.walkthroughSeen && !autoOpened && !fromGoalLink) {
                autoOpened = true
                walkthroughStep = 0
                walkthroughOpen = true
            }
            openDebugDialog()
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: ApiError.Http) {
            if (e.body.code == ApiErrorCode.CountryFeatureUnavailable) state = state.copy(unavailable = true)
            else if (state.view == null) state = state.copy(failed = true)
        } catch (e: Exception) {
            if (state.view == null) state = state.copy(failed = true)
        }
        updatingPeriod = false
    }

    fun retry() {
        state = state.copy(failed = false)
        scope.launch { load() }
    }

    fun select(question: AnalyticsQuestion) {
        state = state.copy(selected = question)
    }

    fun toggleExpert(question: AnalyticsQuestion) {
        val open = state.expertOpen
        state = state.copy(expertOpen = if (question in open) open - question else open + question)
        scheduleExpertSimulation()
    }

    /** ANA-014. */
    fun move(field: FireScenarioField, value: Double) {
        state = state.moving(field, value)
        scheduleSimulation()
    }

    /** ANA-019 «Ripristina». */
    fun resetScenario() {
        state = state.copy(overrides = FireScenarioOverrides())
        scheduleSimulation()
    }

    /** ANA-019 «Salva queste ipotesi». */
    fun saveScenario() = scope.launch {
        if (save(AnalyticsAssumptionsPatch.scenario(state.overrides))) state = state.copy(overrides = FireScenarioOverrides())
    }

    /** ANA-016. */
    fun useData(field: FireScenarioField) = scope.launch { save(AnalyticsAssumptionsPatch.useData(field)) }
    fun useHistoryReturn() = scope.launch { save(AnalyticsAssumptionsPatch.useHistoryReturn) }

    /** ANA-011: 12/24 save at once; «Scegli i mesi» shows the selects. */
    fun choosePeriod(choice: AnalyticsPeriodChoice) {
        when (choice) {
            AnalyticsPeriodChoice.CUSTOM -> state = state.choosingCustomPeriod()
            else -> {
                state = state.copy(periodChoice = choice)
                scope.launch { savePeriod(DataPeriod.Ultimi(if (choice == AnalyticsPeriodChoice.TWENTY_FOUR) 24 else 12)) }
            }
        }
    }

    fun setCustom(from: String? = null, to: String? = null) {
        state = state.copy(customFrom = from ?: state.customFrom, customTo = to ?: state.customTo)
    }

    /** ANA-013: a range applied from the month calendar (already validated by the sheet). */
    fun applyCustomPeriod(range: io.buddybudget.core.domain.periods.DateKeyRange) {
        state = state.copy(customFrom = range.from, customTo = range.to, periodChoice = io.buddybudget.core.domain.analytics.AnalyticsPeriodChoice.CUSTOM)
        applyCustomPeriod()
    }

    fun applyCustomPeriod() = scope.launch {
        if (state.customError == null && !state.customUnchanged) savePeriod(DataPeriod.Personalizzato(state.customFrom, state.customTo))
    }

    private suspend fun savePeriod(period: DataPeriod) {
        updatingPeriod = true
        if (!save(AnalyticsAssumptionsPatch.period(period))) updatingPeriod = false
        state = state.copy(periodChoice = null)
    }

    fun setRetireAt(retireAt: FireRetireAt) {
        state = state.copy(retireAt = retireAt)
        scheduleExpertSimulation()
    }

    fun selectRule(rule: WithdrawalRule) {
        state = state.copy(withdrawalRule = rule)
    }

    /** ANA-031: validates and saves all TERs together. */
    fun saveTers() = scope.launch {
        val view = state.view ?: return@launch
        when (val r = AnalyticsRules.validateTers(terDrafts.toMap(), view.base.positions)) {
            is AnalyticsValidation.Error<*> -> (r.error as CatalogText).let { terError = tr(it.source, it.values) }
            is AnalyticsValidation.Ok -> {
                terError = null
                save(AnalyticsAssumptionsPatch.ters(r.value))
            }
        }
    }

    /** Every `PUT /api/analytics/assumptions` then refetch (the period changes which data count) and drop the goals cache. */
    suspend fun save(patch: AnalyticsAssumptionsPatch): Boolean {
        state = state.copy(saving = true, saveError = null)
        return try {
            env.analytics.update(patch)
            goals = goals.copy(loadedAt = null)
            load()
            state = state.copy(saving = false)
            true
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            state = state.copy(saving = false, saveError = message(e))
            false
        }
    }

    /** ANA-005: closing (finished or skipped) marks the walkthrough seen. */
    fun closeWalkthrough() {
        walkthroughOpen = false
        val view = state.view ?: return
        if (!view.walkthroughSeen) scope.launch { runCatching { env.analytics.markWalkthroughSeen() } }
    }

    fun openWalkthrough() {
        walkthroughStep = 0
        walkthroughOpen = true
    }

    // MARK: Monte Carlo off the main thread (same seed and algorithm as the web)

    /** True while the «Regge» compare runs (the tile and the answer show a loading state, not «serve la spesa annua»). */
    val simulating: Boolean get() = state.simulationInput != null && results == null

    private fun scheduleSimulation() {
        val input = state.simulationInput
        // Same input already computed or still computing: keep it (restarting would throw the work away).
        if (input == simulationKey && (results != null || input == null || simulationJob?.isActive == true)) {
            scheduleExpertSimulation()
            return
        }
        simulationKey = input
        simulationJob?.cancel()
        if (input == null) {
            results = null
            scheduleExpertSimulation()
            return
        }
        simulationJob = scope.launch {
            // Debounce: the sliders move continuously; the heavy part runs once they rest.
            delay(120)
            val computed = compareRulesInParallel(input)
            results = computed
            scheduleExpertSimulation()
        }
        scheduleExpertSimulation()
    }

    /**
     * The four rules are independent runs on the same paths: one coroutine each on [Dispatchers.Default] (about 4× faster
     * on a 4-core device). Each run polls cancellation per path, so a superseded compare frees the CPU at once.
     */
    private suspend fun compareRulesInParallel(input: MonteCarloInput): List<MonteCarloResult> = coroutineScope {
        MonteCarlo.withdrawalRules.map { rule ->
            async(Dispatchers.Default) {
                val job = coroutineContext.job
                MonteCarlo.runMonteCarlo(input.copy(rule = rule)) { !job.isActive }
            }
        }.awaitAll().also { ensureActive() }
    }

    private fun scheduleExpertSimulation() {
        if (AnalyticsQuestion.REGGERA !in state.expertOpen) return
        val input = state.expertSimulationInput
        if (input == expertKey && (expertResult != null || expertJob?.isActive == true)) return
        expertKey = input
        expertJob?.cancel()
        if (input == null) {
            expertResult = null
            return
        }
        // Retiring today = the saved rule of the compare already computed (same seed, same paths).
        val match = if (input == simulationKey) results?.firstOrNull { it.rule == input.rule } else null
        if (match != null) {
            expertResult = match
            return
        }
        expertJob = scope.launch {
            delay(120)
            val computed = withContext(Dispatchers.Default) {
                val job = coroutineContext.job
                MonteCarlo.runMonteCarlo(input) { !job.isActive }
            }
            ensureActive()
            expertResult = computed
        }
    }

    // MARK: Obiettivi

    /** GOAL-004: reused for 5 minutes; mutations force a refetch. */
    suspend fun loadGoals(force: Boolean = false) {
        if (!force && goals.isFresh(System.currentTimeMillis())) return
        try {
            goals = goals.copy(view = env.goals.list(), loadedAt = System.currentTimeMillis(), failed = false, unavailable = false)
            openDebugGoalDialog()
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: ApiError.Http) {
            if (e.body.code == ApiErrorCode.CountryFeatureUnavailable) goals = goals.copy(unavailable = true)
            else if (goals.view == null) goals = goals.copy(failed = true)
        } catch (e: Exception) {
            if (goals.view == null) goals = goals.copy(failed = true)
        }
    }

    fun loadGoalsAsync(force: Boolean = false) = scope.launch { loadGoals(force) }

    fun retryGoals() {
        goals = goals.copy(failed = false)
        scope.launch { loadGoals(force = true) }
    }

    /** GOAL-009 / GOAL-010: optimistic swap, full order to the server, refetch; 409 shows the server message. */
    fun moveGoal(openIndex: Int, delta: Int) = scope.launch {
        val view = goals.view ?: return@launch
        if (goals.reordering) return@launch
        val ids = GoalsRules.reorder(view, openIndex, delta) ?: return@launch
        goals = goals.copy(view = GoalsRules.applying(ids, view), reordering = true)
        try {
            env.goals.reorder(ids)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e))
        }
        loadGoals(force = true)
        goals = goals.copy(reordering = false)
    }

    /** GOAL-003 / GOAL-029 / GOAL-030: opens the form (reminder offer read from the notification settings). */
    fun openGoalForm(request: GoalFormRequest) {
        goalFormError = null
        goalForm = request
        if (request.goalId == null) scope.launch {
            offerReminders = runCatching { !env.user.notifications().goalAlertsEnabled }.getOrDefault(false)
        }
    }

    /** GOAL-024 / GOAL-025 (GOAL-023: reminders turned on only after a successful create, open question 1). */
    suspend fun submitGoal(draft: GoalDraft, remind: Boolean): Boolean {
        val request = goalForm ?: return false
        goalSaving = true
        goalFormError = null
        return try {
            val payload = GoalWizard.toPayload(draft)
            val id = request.goalId
            if (id != null) {
                env.goals.update(id, payload)
            } else {
                env.goals.create(payload)
                if (remind && offerReminders) runCatching { env.user.updateNotifications(NotificationPreferencesPatch(goalAlertsEnabled = true)) }
            }
            goalForm = null
            loadGoals(force = true)
            true
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            goalFormError = message(e)
            false
        } finally {
            goalSaving = false
        }
    }

    /** GOAL-031: no confirmation. */
    fun toggleAchieved(goal: GoalView) = scope.launch {
        goalBusy = true
        try {
            env.goals.setAchieved(goal.id, goal.achievedAt == null)
            loadGoals(force = true)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e))
        } finally {
            goalBusy = false
        }
    }

    /** GOAL-032: after the confirmation; back to the list on success. */
    suspend fun deleteGoal(id: String): Boolean {
        goalBusy = true
        deleteError = null
        return try {
            env.goals.delete(id)
            confirmDeleteGoal = null
            loadGoals(force = true)
            true
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            deleteError = message(e)
            false
        } finally {
            goalBusy = false
        }
    }

    fun launch(block: suspend () -> Unit) = scope.launch { block() }

    // MARK: DEBUG

    /** DEBUG-only `--es bbDialog walkthrough|assumptions|target|term:<id>|expert:<question>` (Risposte), once. */
    private fun openDebugDialog() {
        if (debugDialogOpened) return
        DebugLaunch.value("bbQuestion")?.let { key -> AnalyticsQuestion.entries.firstOrNull { it.key == key }?.let { select(it) } }
        val name = DebugLaunch.value("bbDialog") ?: return
        debugDialogOpened = true
        when {
            name == "walkthrough" -> openWalkthrough()
            name == "assumptions" -> assumptionsOpen = true
            name == "target" -> targetDialogOpen = true
            name.startsWith("term:") -> termId = name.removePrefix("term:")
            name.startsWith("expert:") -> AnalyticsQuestion.entries.firstOrNull { it.key == name.removePrefix("expert:") }?.let { q ->
                state = state.copy(selected = q, expertOpen = state.expertOpen + q)
                scheduleExpertSimulation()
            }
            else -> debugDialogOpened = false
        }
    }

    /** DEBUG-only `--es bbDialog goal:<step>[:edit]` opens the goal form at a step for screenshots. */
    private fun openDebugGoalDialog() {
        if (debugDialogOpened) return
        val name = DebugLaunch.value("bbDialog") ?: return
        if (!name.startsWith("goal")) return
        debugDialogOpened = true
        val parts = name.split(":")
        val step = parts.getOrNull(1)?.let { k -> GoalFormStep.entries.firstOrNull { it.key == k } } ?: GoalFormStep.TIPO
        val id = if (parts.size > 2) goals.view?.goals?.firstOrNull()?.id else null
        openGoalForm(GoalFormRequest(id, if (id == null) GoalFormStep.TIPO else step, if (id == null && step != GoalFormStep.TIPO) GoalKind.VIAGGIO else null))
        debugStartStep = step
    }

    companion object {
        /** The device's local day (`today=` of the base call). */
        fun todayKey(): String = LocalDate.now().toString()
    }
}
