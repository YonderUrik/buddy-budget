package io.buddybudget.app.features.overview

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.data.StartStatus
import io.buddybudget.core.data.WhatsNew
import io.buddybudget.core.data.WhatsNewEntry
import io.buddybudget.core.domain.overview.GoalsTile
import io.buddybudget.core.domain.overview.NetWorthChartState
import io.buddybudget.core.domain.overview.NetWorthChartView
import io.buddybudget.core.domain.overview.NetWorthLegend
import io.buddybudget.core.domain.overview.OverviewContent
import io.buddybudget.core.domain.overview.OverviewPreferenceKeys
import io.buddybudget.core.domain.overview.StartChecklist
import io.buddybudget.core.domain.overview.StartFocus
import io.buddybudget.core.domain.overview.StartStepDefinition
import io.buddybudget.core.domain.overview.StartStepId
import io.buddybudget.core.domain.overview.WhatsNewDismissals
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

/**
 * State of Panoramica (OV-001…043) plus the start status shared with the demo banner (SHELL-048) and «Novità»
 * (SHELL-049/050). One instance per signed-in session, owned by `ShellModel`. Same fields as `OverviewModel` on iOS.
 */
class OverviewModel(private val env: AppEnvironment) {
    /** OV-009: `3M` on every visit (reset when the Overview becomes active again). */
    var period by mutableStateOf(OverviewPeriod.Default)
        private set
    var chartView by mutableStateOf(NetWorthChartView.Total)
        private set
    var hiddenClasses by mutableStateOf(emptySet<String>())
        private set

    /** Scrubbed point of the chart (mobile adaptation of the hover tooltip, OV-020). */
    var scrubIndex by mutableStateOf<Int?>(null)

    /** Locked composition slice (OV-024). */
    var selectedSlice by mutableStateOf<Int?>(null)

    /** Last overview shown (kept while another period loads). */
    var view by mutableStateOf<OverviewView?>(null)
        private set
    var failed by mutableStateOf(false)
        private set
    /** OV-044: when the shown overview arrived from the server (ms) and whether a request is in flight. */
    var viewUpdatedAt by mutableStateOf(0L)
        private set
    var fetchingView by mutableStateOf(false)
        private set
    var start by mutableStateOf<StartStatus?>(null)
        private set
    var goals by mutableStateOf<GoalsView?>(null)
        private set
    var whatsNew by mutableStateOf<WhatsNew?>(null)
        private set

    var dismissingChecklist by mutableStateOf(false)
        private set
    /** OV-046 / OV-047: a skip, restore or focus save in flight. */
    var updatingStart by mutableStateOf(false)
        private set
    var focusError by mutableStateOf<String?>(null)
        private set
    /** OV-048: steps done since the last visit to Panoramica, acknowledged above the next step (cleared when leaving it). */
    var acknowledged by mutableStateOf<List<StartStepId>>(emptyList())
    var demoStarting by mutableStateOf(false)
        private set
    var demoStartError by mutableStateOf<String?>(null)
        private set
    var demoClearing by mutableStateOf(false)
        private set
    var demoClearError by mutableStateOf<String?>(null)
        private set

    private val scope = MainScope()
    private val cache = mutableMapOf<String, Pair<OverviewView, Long>>()
    private var loadJob: Job? = null
    private var goalsLoaded = false
    private var whatsNewLoaded = false

    /** Called after demo data starts or is cleared, so every visible screen refetches (OV-039, OV-042). */
    var onDataChanged: (() -> Unit)? = null

    // ---------------------------------------------------------------- Derived

    val content: OverviewContent get() = OverviewContent.resolve(view, failed)

    /** OV-018: per-device, default on, shared with «Il tuo quadro». */
    val includePension: Boolean get() = env.preferences.flag(OverviewPreferenceKeys.INCLUDE_PENSION, true)

    val goalsInviteDismissed: Boolean get() = env.preferences.flag(OverviewPreferenceKeys.GOALS_INVITE_DISMISSED, false)

    val demoActive: Boolean get() = start?.demoActive == true

    val chartState: NetWorthChartState?
        get() = view?.let { NetWorthChartState(it.series, it.change, chartView, hiddenClasses, it.includePension) }

    /** SHELL-049: the entry shown as a chip next to the date. */
    val whatsNewEntry: WhatsNewEntry? get() = WhatsNewDismissals.pick(whatsNew, dismissedWhatsNew)

    private val dismissedWhatsNew: List<String> get() = WhatsNewDismissals.parse(env.preferences.string(WhatsNewDismissals.KEY))

    private val retirement: Boolean get() = env.session.bootstrap?.capabilities?.features?.retirement ?: true

    val steps: List<StartStepDefinition> get() = StartChecklist.steps(retirement)

    fun step(id: StartStepId): StartStepDefinition = StartChecklist.definition(id, retirement)

    /** AUTH-058 / OV-047: the pension answer only where the pension section exists. */
    val focusOptions: List<StartFocus> get() = StartFocus.options(env.session.sections.pension)

    /** OV-031: the goals invite stays hidden while «Primi passi» is on screen (web #444). */
    private val checklistShown: Boolean
        get() = start?.let { StartChecklist.isVisible(it, forced = view?.isEmpty == true) } ?: false

    val goalsMode: GoalsTile.Mode
        get() = if (GoalsTile.isAvailable(env.session.sections)) GoalsTile.mode(goals, goalsInviteDismissed, checklistShown) else GoalsTile.Mode.Hidden

    // ---------------------------------------------------------------- Loading

    /**
     * The Overview became active (first open or back to the tab): period back to 3M, start status always refreshed
     * (OV-038), overview refetched when stale, goals and «Novità» once per session.
     */
    suspend fun activate() = coroutineScope {
        if (period != OverviewPeriod.Default) period = OverviewPeriod.Default
        scrubIndex = null
        listOf(
            async { refreshStart() },
            async { loadOverview(false) },
            async { if (!goalsLoaded) loadGoals() },
            async { if (!whatsNewLoaded) loadWhatsNew() },
        ).awaitAll()
        Unit
    }

    /** Pull-to-refresh and «Riprova» (OV-006 + start status and goals). */
    suspend fun refresh() = coroutineScope {
        cache.clear()
        listOf(async { refreshStart() }, async { loadOverview(true) }, async { loadGoals() }, async { loadWhatsNew() }).awaitAll()
        Unit
    }

    fun retry() {
        failed = false
        scope.launch { refresh() }
    }

    /** OV-038 / SHELL-048: `GET /api/start` (failure keeps the last value: the block is optional). */
    suspend fun refreshStart() {
        runCatching { env.start.status() }.getOrNull()?.let {
            start = it
            announceProgress(it)
        }
    }

    /** Set by the shell: whether Panoramica is on screen, and how to open an in-app path (SHELL-060). */
    var isOnOverview: () -> Boolean = { false }
    var openPath: (String) -> Unit = {}

    /**
     * SHELL-060 / OV-048: a step that becomes done is announced once per device — a toast with the next step outside
     * Panoramica, the acknowledgement above the next step inside it, «Primi passi completati» at the end. The first
     * status the device sees is not news; nothing is said with sample data or once the checklist was hidden.
     */
    private fun announceProgress(status: StartStatus) {
        if (status.demoActive) return
        val doneNow = status.askedSteps.filter { status.steps.isDone(it) }
        val seen = env.preferences.string(START_SEEN_KEY)?.split(",")?.mapNotNull { StartStepId.of(it) }?.toSet()
        env.preferences.setString(START_SEEN_KEY, ((seen ?: emptySet()) + doneNow).joinToString(",") { it.raw })
        if (seen == null) return
        val fresh = StartChecklist.newlyDone(seen, status)
        if (fresh.isEmpty() || status.dismissed) return
        val strings = env.session.strings()
        val doneText = fresh.joinToString(" · ") { strings.lookup(step(it).done) }
        val nextId = StartChecklist.nextStep(status)
        val onOverview = isOnOverview()
        if (nextId == null) {
            val title = strings.lookup("Primi passi completati")
            if (onOverview) env.toasts.show(BBToastKind.Success, "$title\n$doneText")
            else env.toasts.show(BBToastKind.Success, "$title\n$doneText", strings.lookup("Vai alla Panoramica"), onAction = { openPath("/panoramica") })
            return
        }
        if (onOverview) {
            acknowledged = (acknowledged + fresh).distinct()
            return
        }
        val next = step(nextId)
        env.toasts.show(
            BBToastKind.Success,
            "$doneText\n${strings.lookup("Prossimo passo: {0}", mapOf("0" to strings.lookup(next.title)))}",
            strings.lookup(next.cta), onAction = { openPath(next.path) }, durationMs = 8000,
        )
    }

    /** OV-048: the acknowledgement lasts one visit to Panoramica. */
    fun leftOverview() {
        acknowledged = emptyList()
    }

    private fun key(period: OverviewPeriod, pension: Boolean) = "${period.raw}|${if (pension) 1 else 0}"

    /** `GET /api/overview`, cached per (period, includePension). */
    suspend fun loadOverview(force: Boolean) {
        val period = this.period
        val pension = includePension
        val k = key(period, pension)
        val hit = cache[k]
        if (!force && hit != null && System.currentTimeMillis() - hit.second < STALE_MS) {
            view = hit.first
            failed = false
            return
        }
        if (hit != null) view = hit.first
        loadJob?.cancel()
        val job = scope.launch {
            fetchingView = true
            try {
                val today = CalendarDate.of(Instant.now(), ZoneId.systemDefault()).iso
                val next = env.overview.view(period, pension, today)
                cache[k] = next to System.currentTimeMillis()
                if (this@OverviewModel.period == period && includePension == pension) {
                    view = next
                    viewUpdatedAt = System.currentTimeMillis()
                    failed = false
                    if ((scrubIndex ?: -1) >= next.series.size) scrubIndex = null
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (view == null) failed = true
                viewUpdatedAt = System.currentTimeMillis()
            } finally {
                fetchingView = false
            }
        }
        loadJob = job
        job.join()
    }

    private suspend fun loadGoals() {
        if (!GoalsTile.isAvailable(env.session.sections)) return
        goalsLoaded = true
        // OV-006: a failure only hides the goals tile.
        goals = runCatching { env.goals.list() }.getOrNull()
    }

    private suspend fun loadWhatsNew() {
        whatsNewLoaded = true
        runCatching { env.whatsNew.get(dismissedWhatsNew) }.getOrNull()?.let { whatsNew = it }
    }

    // ---------------------------------------------------------------- Chart controls

    /** OV-009: a period switch is a new (cached) call. */
    fun selectPeriod(next: OverviewPeriod) {
        if (next == period) return
        period = next
        scrubIndex = null
        scope.launch { loadOverview(false) }
    }

    /** OV-014 / OV-017: back to `Totale` clears the hidden classes. */
    fun selectChartView(next: NetWorthChartView) {
        if (next == NetWorthChartView.Total) hiddenClasses = emptySet()
        chartView = next
        scrubIndex = null
    }

    /** OV-016. */
    fun toggleClass(key: String) {
        val state = chartState ?: return
        hiddenClasses = NetWorthLegend.toggle(hiddenClasses, key, state.allClasses)
    }

    fun showAllClasses() {
        hiddenClasses = emptySet()
    }

    /** OV-018: persisted per device; the overview is refetched with the new `includePension`. */
    fun setIncludePension(included: Boolean) {
        env.preferences.setFlag(OverviewPreferenceKeys.INCLUDE_PENSION, included)
        scope.launch { loadOverview(false) }
    }

    // ---------------------------------------------------------------- Actions

    /** OV-036: no confirmation; hidden right away. */
    fun dismissChecklist() {
        val current = start ?: return
        if (dismissingChecklist) return
        dismissingChecklist = true
        scope.launch {
            try {
                env.start.setDismissed(true)
                start = current.copy(dismissed = true, justCompleted = null)
            } catch (e: Exception) {
                env.toasts.show(BBToastKind.Error, env.session.strings().get(L10n.genericError))
            } finally {
                dismissingChecklist = false
            }
        }
    }

    /** OV-046: «Non mi serve» / «Rimetti». */
    fun setSkipped(step: StartStepId, skipped: Boolean) {
        if (updatingStart) return
        updatingStart = true
        scope.launch {
            try {
                env.start.setSkipped(step, skipped)
                refreshStart()
            } catch (e: Exception) {
                env.toasts.show(BBToastKind.Error, env.session.strings().get(L10n.genericError))
            } finally {
                updatingStart = false
            }
        }
    }

    /** OV-047: saves the focus; the steps asked change right away. Returns true on success (the sheet closes). */
    suspend fun saveFocus(focus: List<StartFocus>): Boolean {
        updatingStart = true
        focusError = null
        return try {
            env.start.setFocus(focus.map { it.raw })
            refreshStart()
            true
        } catch (e: Exception) {
            focusError = message(e)
            false
        } finally {
            updatingStart = false
        }
    }

    /** OV-039 / OV-040: start the sample data, then refetch everything. */
    fun startDemo() {
        if (demoStarting) return
        demoStarting = true
        demoStartError = null
        scope.launch {
            try {
                env.start.startDemo()
                dataChanged()
            } catch (e: Exception) {
                demoStartError = message(e)
            } finally {
                demoStarting = false
            }
        }
    }

    /** OV-042 / SHELL-048: one tap, no confirmation (as the web), snackbar afterwards (mobile adaptation). */
    fun clearDemo() {
        if (demoClearing) return
        demoClearing = true
        demoClearError = null
        scope.launch {
            try {
                env.start.clearDemo()
                dataChanged()
                env.toasts.show(BBToastKind.Success, env.session.strings().lookup("Dati d'esempio azzerati"))
            } catch (e: Exception) {
                demoClearError = message(e)
            } finally {
                demoClearing = false
            }
        }
    }

    private suspend fun dataChanged() {
        onDataChanged?.invoke()
        refresh()
    }

    /** OV-031: `Non ora`, remembered on this device. */
    fun dismissGoalsInvite() = env.preferences.setFlag(OverviewPreferenceKeys.GOALS_INVITE_DISMISSED, true)

    /** SHELL-050: `Non mostrare più`, remembered on this device. */
    fun dismissWhatsNew(id: String) =
        env.preferences.setString(WhatsNewDismissals.KEY, WhatsNewDismissals.adding(id, env.preferences.string(WhatsNewDismissals.KEY)))

    /** Server message of a failed call (409 demo errors are already localized), else the generic one. */
    private fun message(error: Throwable): String =
        (error as? ApiError.Http)?.body?.message ?: env.session.strings().get(L10n.genericError)

    private var debugApplied = false

    /** DEBUG-only screenshot hooks: `bbChartView byClass`, `bbHide investimenti`, `bbPeriod 1anno`, `bbScrub <index>`. */
    fun applyDebugLaunch() {
        if (debugApplied) return
        debugApplied = true
        if (DebugLaunch.value("bbChartView") == "byClass") chartView = NetWorthChartView.ByClass
        DebugLaunch.value("bbHide")?.let { hiddenClasses = it.split(",").toSet() }
        DebugLaunch.value("bbPeriod")?.let { raw -> OverviewPeriod.entries.firstOrNull { it.raw == raw }?.let(::selectPeriod) }
        DebugLaunch.value("bbScrub")?.toIntOrNull()?.let { scrubIndex = it }
    }

    private companion object {
        /** Web `staleTime` of the overview queries. */
        const val STALE_MS = 120_000L

        /** Steps already seen done on this device (`bb:start-seen-done`, SHELL-060). */
        const val START_SEEN_KEY = "bb:start-seen-done"
    }
}
