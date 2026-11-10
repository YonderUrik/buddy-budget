package io.buddybudget.app.features.overview

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.core.data.SidebarDeadlines
import io.buddybudget.core.data.SidebarFire
import io.buddybudget.core.data.SidebarSummary
import io.buddybudget.core.domain.overview.FreshnessClock
import io.buddybudget.core.domain.overview.OverviewPreferenceKeys
import io.buddybudget.core.domain.overview.SidebarModuleId
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/** One module's data in «Il tuo quadro»: never loaded, loading, loaded, or failed (renders nothing, SHELL-037). */
sealed class InsightState<out T> {
    data object Idle : InsightState<Nothing>()
    data object Loading : InsightState<Nothing>()
    data class Loaded<T>(val value: T) : InsightState<T>()
    data object Failed : InsightState<Nothing>()

    val valueOrNull: T? get() = (this as? Loaded<T>)?.value
    val isLoading: Boolean get() = this == Loading
}

/**
 * «Il tuo quadro» in «Altro» (SHELL-020, SHELL-028…038): collapsed by default, no request until opened; each enabled
 * module loads its data with its freshness window and is never retried. Same fields as `InsightsModel` on iOS.
 */
class InsightsModel(private val env: AppEnvironment) {
    var isOpen by mutableStateOf(false)
        private set
    var summary by mutableStateOf<InsightState<SidebarSummary>>(InsightState.Idle)
        private set
    var deadlines by mutableStateOf<InsightState<SidebarDeadlines>>(InsightState.Idle)
        private set
    var fire by mutableStateOf<InsightState<SidebarFire>>(InsightState.Idle)
        private set

    private val scope = MainScope()
    private var summaryClock = FreshnessClock()
    private var deadlinesClock = FreshnessClock()
    private var fireClock = FreshnessClock()

    init {
        // DEBUG `--es bbQuadro open` opens «Il tuo quadro» at launch for screenshots.
        if (DebugLaunch.value("bbQuadro") in setOf("open", "top")) toggleOpen()
    }

    val retirement: Boolean get() = env.session.bootstrap?.capabilities?.features?.retirement ?: true

    fun isEnabled(module: SidebarModuleId): Boolean = env.preferences.flag(module.preferenceKey, SidebarModuleId.ENABLED_BY_DEFAULT)

    fun setEnabled(module: SidebarModuleId, enabled: Boolean) {
        env.preferences.setFlag(module.preferenceKey, enabled)
        if (enabled && isOpen) load()
    }

    /** SHELL-029: enabled modules in render order. */
    val modules: List<SidebarModuleId> get() = SidebarModuleId.renderOrder(::isEnabled, retirement)

    /** Section open state, remembered per device like the web's `section-open:<id>`. */
    fun isSectionOpen(module: SidebarModuleId): Boolean = env.preferences.flag("section-open:${module.raw}", module.openByDefault)

    fun toggleSection(module: SidebarModuleId) = env.preferences.setFlag("section-open:${module.raw}", !isSectionOpen(module))

    val includePension: Boolean get() = env.preferences.flag(OverviewPreferenceKeys.INCLUDE_PENSION, true)

    /** SHELL-020: the first open triggers the requests. */
    fun toggleOpen() {
        isOpen = !isOpen
        if (isOpen) load()
    }

    /** Demo data changed: everything is stale. */
    fun invalidate() {
        summaryClock = FreshnessClock()
        deadlinesClock = FreshnessClock()
        fireClock = FreshnessClock()
        if (isOpen) load()
    }

    /** SHELL-028 / SHELL-037: only the enabled modules, only when not fresh, no retry; in parallel. */
    fun load() {
        val now = System.currentTimeMillis()
        val active = modules
        if (SidebarModuleId.needsSummary(active) && !summaryClock.isFresh(now, SidebarModuleId.Oggi.freshSeconds)) {
            summaryClock.mark(now)
            if (summary.valueOrNull == null) summary = InsightState.Loading
            scope.launch { summary = runCatching { env.sidebar.summary() }.map { InsightState.Loaded(it) }.getOrDefault(InsightState.Failed) }
        }
        if (SidebarModuleId.Scadenze in active && !deadlinesClock.isFresh(now, SidebarModuleId.Scadenze.freshSeconds)) {
            deadlinesClock.mark(now)
            if (deadlines.valueOrNull == null) deadlines = InsightState.Loading
            scope.launch { deadlines = runCatching { env.sidebar.deadlines() }.map { InsightState.Loaded(it) }.getOrDefault(InsightState.Failed) }
        }
        if (SidebarModuleId.Fire in active && !fireClock.isFresh(now, SidebarModuleId.Fire.freshSeconds)) {
            fireClock.mark(now)
            if (fire.valueOrNull == null) fire = InsightState.Loading
            scope.launch { fire = runCatching { env.sidebar.fire() }.map { InsightState.Loaded(it) }.getOrDefault(InsightState.Failed) }
        }
    }
}
