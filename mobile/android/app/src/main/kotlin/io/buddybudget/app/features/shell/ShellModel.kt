package io.buddybudget.app.features.shell

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.features.overview.InsightsModel
import io.buddybudget.app.features.overview.OverviewModel
import io.buddybudget.app.features.settings.SettingsModel
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.domain.settings.SettingsGroup
import io.buddybudget.core.domain.shell.AccountsLaunchIntent
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.shell.LiquiditySegment
import io.buddybudget.core.domain.shell.AppTab
import io.buddybudget.core.domain.shell.Navigation
import io.buddybudget.app.designsystem.components.bbLocale
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** A screen pushed on a tab's stack. */
sealed class ShellRoute {
    data class Destination(val destination: AppDestination) : ShellRoute()
    data class SettingsGroupRoute(val group: SettingsGroup) : ShellRoute()
    /** Security page `/investimenti/titoli/{id}` (SEC-015). */
    data class InstrumentRoute(val instrumentId: String) : ShellRoute()
    /** Loan detail `/debiti/finanziamenti?id=` (DEBT-019). */
    data class DebtRoute(val debtId: String) : ShellRoute()
    /** Goal detail `/analitiche/obiettivi/{id}` (GOAL-027). */
    data class GoalRoute(val goalId: String) : ShellRoute()
}

/**
 * Navigation state of the signed-in app: selected tab, one stack per tab (SHELL-013…021; no Liquidità badge since web #451).
 * Same name and behaviour as `ShellModel` on iOS.
 */
class ShellModel(private val env: AppEnvironment) {
    var tab by mutableStateOf(AppTab.Overview)
        private set
    private val paths = mutableStateMapOf<AppTab, List<ShellRoute>>()
    /** TX-001: the Liquidità view shown in the Liquidità tab (its destinations are segments of one root screen). */
    var liquiditySegment by mutableStateOf(LiquiditySegment.Movements)
    /** ACC-009 / ACC-010: one-shot request for the Conti screen (`?nuovo=1`, `?rinnova=…`); Conti clears it. */
    var accountsIntent by mutableStateOf<AccountsLaunchIntent?>(null)
    /** SUP-002 / SUP-003: `?da=` / `?tipo=` of the last `/aiuto` link; the help screen takes it once. */
    private var helpLaunch: io.buddybudget.core.domain.support.HelpLaunch? = null
    private val scope = MainScope()

    /** Settings state shared by the hub and its group screens for this signed-in session. */
    val settings by lazy { SettingsModel(env) }

    /** Panoramica state; its start status also drives the demo banner and «Novità» (OV-*, SHELL-048…050). */
    val overview by lazy { OverviewModel(env) }

    /** «Il tuo quadro» in «Altro» (SHELL-020, SHELL-028…038). */
    val insights by lazy { InsightsModel(env) }

    /** Bumped after demo data starts or is cleared: screens showing data reload when it changes (OV-039, OV-042). */
    var dataVersion by mutableIntStateOf(0)
        private set
    /** Liquidità state (filters, Analisi period) kept while switching tabs (TX-003). */
    val liquidity by lazy { io.buddybudget.app.features.liquidity.LiquidityModel(env) }
    /** Investimenti state kept while switching tabs; the broker filter is reset when leaving the section (INV-009). */
    val investments by lazy { io.buddybudget.app.features.investments.InvestmentsModel(env).also { it.openImport = { brokerImport.present() } } }
    /** Personal imports and the global island (14-imports). */
    val imports by lazy {
        io.buddybudget.app.features.imports.ImportsModel(env).also {
            it.onFinished = {
                markHistoryPending()
                dataChanged()
            }
        }
    }

    /** OV-044 / TX-076: a bank sync is running (set by Conti, which polls the sync jobs). */
    var syncRunning by mutableStateOf(false)
    /** When an import or sync last finished, until the history charts have reloaded (`markHistoryRefreshPending`). */
    var historyPendingSince by mutableStateOf<Long?>(null)
        private set

    fun markHistoryPending() {
        historyPendingSince = System.currentTimeMillis()
    }

    /** What a history chart whose data was received at [dataUpdatedAt] says now (OV-044, TX-076). */
    fun chartRefresh(dataUpdatedAt: Long, isFetching: Boolean): io.buddybudget.core.domain.networth.ChartRefresh.State? {
        val importing = syncRunning || io.buddybudget.core.domain.imports.PersonalImportRules.runningIds(imports.listing?.jobs.orEmpty()).isNotEmpty()
        val pending = io.buddybudget.core.domain.networth.ChartRefresh.freshPending(historyPendingSince, System.currentTimeMillis())
        return io.buddybudget.core.domain.networth.ChartRefresh.state(importing, pending, dataUpdatedAt, isFetching)
    }

    /** Clears the pending mark once a chart holds data newer than it. */
    fun settleChart(dataUpdatedAt: Long, isFetching: Boolean) {
        if (io.buddybudget.core.domain.networth.ChartRefresh.isSettled(historyPendingSince, dataUpdatedAt, isFetching)) historyPendingSince = null
    }
    /** «Importa operazioni» (07-investments §8) and «Importazioni» (§9). */
    val brokerImport by lazy { io.buddybudget.app.features.imports.BrokerImportModel(env).also { it.onImported = { dataChanged() } } }
    val importManagement by lazy { io.buddybudget.app.features.imports.ImportManagementModel(env, imports).also { it.onChanged = { dataChanged() } } }
    /** «Importazioni» dialog open (INV-001). */
    var importManagementOpen by mutableStateOf(false)
    /** Debiti state (one `GET /api/debts` for overview and detail, DEBT-001). */
    val debts by lazy { io.buddybudget.app.features.debts.DebtsModel(env) }
    /** Pensione state (selected fund, tab, simulations). */
    val pension by lazy { io.buddybudget.app.features.pension.PensionModel(env) }
    /** Analitiche state (Risposte and Obiettivi, ANA-*, GOAL-*). */
    val analytics by lazy { io.buddybudget.app.features.analytics.AnalyticsModel(env) }

    val sections: MeBootstrap.Sections get() = env.session.sections
    val tabs: List<AppTab> get() = Navigation.tabs(sections)

    fun path(tab: AppTab): List<ShellRoute> = paths[tab] ?: emptyList()

    /** TX-064: the movement detail open over any screen (Movimenti, Categorizza, a subscription's charges). */
    var movementDetail by mutableStateOf<io.buddybudget.app.features.liquidity.MovementDetailRequest?>(null)

    fun openMovement(id: String, placeholder: io.buddybudget.core.data.Movement? = null) {
        movementDetail = io.buddybudget.app.features.liquidity.MovementDetailRequest(id, placeholder)
    }

    /** SHELL-005: open on the home page chosen in Settings. */
    fun start() {
        env.quickReport.currentPath = { currentPath }
        open(env.session.homePage)
        DebugLaunch.openPath?.let { open(it) }
        // `--es bbMovement <id>`: the movement detail over the opened screen (TX-064 screenshots, same as iOS `-BBMovement`).
        DebugLaunch.value("bbMovement")?.let { openMovement(it) }
        overview.onDataChanged = {
            dataVersion += 1
            insights.invalidate()
        }
        // SHELL-060 / OV-038: «Primi passi» progress is announced everywhere and re-read every 15 s while incomplete.
        overview.isOnOverview = { tab == AppTab.Overview && path(AppTab.Overview).isEmpty() }
        overview.openPath = { open(it) }
        // SHELL-058/059: visit heartbeat and the «Dall'ultima visita» toast.
        scope.launch {
            showWelcome()
            while (true) {
                delay(io.buddybudget.core.domain.shell.WelcomeText.HEARTBEAT_MS)
                if (foreground) heartbeat()
            }
        }
        scope.launch {
            while (true) {
                delay(io.buddybudget.core.domain.overview.StartChecklist.POLL_MS)
                if (foreground && io.buddybudget.core.domain.overview.StartChecklist.shouldPoll(overview.start)) overview.refreshStart()
            }
        }
        scope.launch { overview.refreshStart() }
        imports.start()
        // `--es bbDialog imports|broker|broker-guide` (debug only): «Importazioni» (list open) or the empty broker wizard.
        when (DebugLaunch.value("bbDialog")) {
            "imports" -> { importManagementOpen = true; importManagement.listOpen = true }
            // `--es bbDialog scrivici|segnala`: the quick-report sheet, empty or with a sample attached error (16-help-support).
            "scrivici" -> env.quickReport.open(io.buddybudget.core.domain.support.ReportSource.Pulsante)
            "segnala" -> env.quickReport.open(
                io.buddybudget.core.domain.support.ReportSource.Errore,
                io.buddybudget.core.domain.support.ReportError(io.buddybudget.core.domain.support.ReportErrorArea.Abbonamento, "Hai già un abbonamento con questo nome"),
            )
            "broker" -> brokerImport.present()
            "broker-guide" -> { brokerImport.present(); brokerImport.provider = io.buddybudget.core.domain.imports.ImportProviderId.Degiro; brokerImport.showGuide = true }
        }
    }

    /** IMP-060 / INV-101: data changed outside the visible screen (an import finished): screens reload. */
    fun dataChanged() {
        dataVersion += 1
        insights.invalidate()
        // An import, sync or edit can tick a first step (OV-038) and move the net-worth history (OV-044).
        scope.launch { overview.refreshStart() }
        scope.launch { overview.loadOverview(true) }
    }

    /** The app is in the foreground: polls run only then (imports island, «Primi passi», visits). */
    var foreground = true
        private set

    fun setForeground(value: Boolean) {
        foreground = value
        imports.setForeground(value)
        if (value) {
            scope.launch { overview.refreshStart() }
            scope.launch { heartbeat() }
        }
    }

    private var lastHeartbeat = 0L
    private var welcomeShownSince: String? = null

    /** SHELL-058: best effort; a heartbeat that starts a new visit reads the summary again. */
    private suspend fun heartbeat() {
        val now = System.currentTimeMillis()
        if (now - lastHeartbeat < io.buddybudget.core.domain.shell.WelcomeText.THROTTLE_MS) return
        lastHeartbeat = now
        val result = runCatching { env.welcome.heartbeat() }.getOrNull() ?: return
        if (result.newVisit) showWelcome()
    }

    /** SHELL-059: one toast per visit with what happened and what waits, then marked shown (best effort). */
    private suspend fun showWelcome() {
        // `GET /api/welcome` records the visit itself, so it counts as the first heartbeat.
        lastHeartbeat = System.currentTimeMillis()
        val summary = runCatching { env.welcome.summary() }.getOrNull()?.summary ?: return
        if (summary.since == welcomeShownSince) return
        welcomeShownSince = summary.since
        val strings = env.session.strings()
        val locale = strings.language.bbLocale
        val content = io.buddybudget.core.domain.shell.WelcomeText.content(
            summary, { source, values -> strings.lookup(source, values) },
            { items -> io.buddybudget.core.domain.format.BBFormat.formatList(items, locale) },
        ) ?: return
        env.toasts.show(
            io.buddybudget.app.designsystem.components.BBToastKind.Info, content.lines.joinToString("\n"),
            content.actionLabel, onAction = { open(content.actionPath) }, durationMs = io.buddybudget.core.domain.shell.WelcomeText.TOAST_MS,
        )
        runCatching { env.welcome.markShown() }
    }

    /**
     * A file or link from outside (share sheet, «Apri con», email link). Files go to the broker wizard when they look
     * like a supported broker export, else to the personal import form (mobile note).
     */
    fun receive(item: io.buddybudget.app.IncomingItem, locale: io.buddybudget.core.domain.format.BBLocale) {
        when (item) {
            is io.buddybudget.app.IncomingItem.Link -> open(item.path)
            is io.buddybudget.app.IncomingItem.Files -> {
                val first = item.files.firstOrNull() ?: return
                val rules = io.buddybudget.core.domain.imports.PersonalImportRules
                val text = if (rules.fileKind(first.name) == io.buddybudget.core.domain.imports.PersonalImportRules.FileKind.Xlsx) {
                    runCatching { io.buddybudget.core.domain.imports.ImportXlsx.csv(first.data) }.getOrDefault("")
                } else rules.decodeText(first.data)
                // IMP-066: a broker export (or a batch) → Investimenti wizard, already parsed; anything else → personal import.
                if (io.buddybudget.core.domain.imports.IncomingFiles.route(item.files.size, text) == io.buddybudget.core.domain.imports.IncomingFiles.Route.Broker) {
                    open(AppDestination.Investments)
                    brokerImport.present(item.files)
                } else {
                    open(AppDestination.Imports)
                    imports.receiveShared(first, locale)
                }
            }
        }
    }

    fun takeHelpLaunch(): io.buddybudget.core.domain.support.HelpLaunch? = helpLaunch.also { helpLaunch = null }

    /**
     * Logical web path of the visible screen, the context of a report (16-help-support mobile note) and the area of a
     * crash report (SUP-024). Ids stay in the path like on the web; queries never do.
     */
    val currentPath: String
        get() = when (val top = path(tab).lastOrNull()) {
            is ShellRoute.Destination -> top.destination.path
            is ShellRoute.SettingsGroupRoute -> AppDestination.Settings.path
            is ShellRoute.InstrumentRoute -> "/investimenti/titoli/${top.instrumentId}"
            is ShellRoute.DebtRoute -> "/debiti/finanziamenti"
            is ShellRoute.GoalRoute -> "/analitiche/obiettivi/${top.goalId}"
            null -> when (tab) {
                AppTab.Overview -> AppDestination.Overview.path
                AppTab.Liquidity -> liquiditySegment.destination.path
                AppTab.Investments -> investments.state.tab.path
                AppTab.Debts -> AppDestination.Debts.path
                AppTab.More -> "/altro"
            }
        }

    /** SHELL-015: the indicator moves immediately; tapping the active tab again pops it to its root. */
    fun select(next: AppTab) {
        if (next != tab && tab == AppTab.Investments) investments.leaveSection()
        if (next != tab && tab == AppTab.Overview) overview.leftOverview()
        if (next == tab) paths[next] = emptyList() else tab = next
    }

    /** Opens a destination in its tab (SHELL-007/010: unavailable paths show the country-unavailable screen). */
    fun open(destination: AppDestination) {
        if (!destination.isAvailable(sections)) {
            tab = AppTab.More
            paths[AppTab.More] = listOf(ShellRoute.Destination(AppDestination.CountryUnavailable))
            return
        }
        tab = destination.tab
        val segment = LiquiditySegment.fromDestination(destination)
        if (segment != null) {
            liquiditySegment = segment
            paths[AppTab.Liquidity] = emptyList()
            return
        }
        paths[destination.tab] = if (destination == destination.tab.root) emptyList() else listOf(ShellRoute.Destination(destination))
    }

    /** Pushes onto the current tab (from «Altro», Settings, feature screens). */
    fun push(route: ShellRoute) {
        paths[tab] = path(tab) + route
    }

    fun back(): Boolean {
        val current = path(tab)
        if (current.isEmpty()) return false
        paths[tab] = current.dropLast(1)
        return true
    }

    /** Deep link `/impostazioni?sezione=notifiche` and other in-app paths (SET-003); `/altro` = the More tab. */
    fun open(path: String) {
        if (path == "/altro") {
            tab = AppTab.More
            paths[AppTab.More] = emptyList()
            return
        }
        val destination = AppDestination.fromPath(path) ?: return
        if (destination == AppDestination.Help) {
            helpLaunch = io.buddybudget.core.domain.support.HelpLaunch.fromPath(path)
            open(AppDestination.Help)
            return
        }
        if (destination == AppDestination.Investments) {
            if (investments.countryContent.blocksPath(path)) {
                tab = AppTab.More
                paths[AppTab.More] = listOf(ShellRoute.Destination(AppDestination.CountryUnavailable))
                return
            }
            open(AppDestination.Investments)
            val id = io.buddybudget.core.domain.investments.InvestmentsTab.instrumentId(path)
            if (id != null) push(ShellRoute.InstrumentRoute(id))
            else io.buddybudget.core.domain.investments.InvestmentsTab.fromPath(path)?.let { investments.select(it) }
            return
        }
        if (destination == AppDestination.Debts) {
            open(AppDestination.Debts)
            // DEBT-038: the legacy simulator opens the loan detail too.
            io.buddybudget.core.domain.debts.DebtsRoutes.detailId(path)?.let { id ->
                debts.select(id.ifEmpty { null })
                push(ShellRoute.DebtRoute(id))
            }
            return
        }
        if (destination == AppDestination.Analytics) {
            openAnalytics(path)
            return
        }
        if (destination == AppDestination.Imports) {
            open(AppDestination.Imports)
            imports.open(io.buddybudget.core.domain.imports.ImportsRoutes.jobId(path))
            return
        }
        if (destination == AppDestination.Pension) {
            open(AppDestination.Pension)
            io.buddybudget.core.domain.pension.PensionTab.fromPath(path)?.let { pension.select(it) }
            return
        }
        val intent = AccountsLaunchIntent.fromPath(path)
        open(if (intent == null) destination else AppDestination.Accounts)
        if (intent != null) accountsIntent = intent
        if (destination == AppDestination.Settings) SettingsGroup.fromDeepLink(path)?.let { push(ShellRoute.SettingsGroupRoute(it)) }
    }

    /**
     * `/analitiche[?traguardo=1]`, legacy sub-routes (ANA-035), `/analitiche/obiettivi[?nuovo=1&tipo=…]` and
     * `/analitiche/obiettivi/{id}` (GOAL-001, GOAL-003).
     */
    private fun openAnalytics(path: String) {
        open(AppDestination.Analytics)
        if (!sections.analytics) return
        val intent = io.buddybudget.core.domain.goals.GoalsLaunchIntent.parse(path)
        if (intent != null) {
            analytics.tab = io.buddybudget.app.features.analytics.AnalyticsTab.Obiettivi
            analytics.loadGoalsAsync()
            when (intent) {
                is io.buddybudget.core.domain.goals.GoalsLaunchIntent.New ->
                    analytics.openGoalForm(io.buddybudget.app.features.analytics.GoalFormRequest(presetKind = intent.kind))
                is io.buddybudget.core.domain.goals.GoalsLaunchIntent.Detail -> push(ShellRoute.GoalRoute(intent.id))
                io.buddybudget.core.domain.goals.GoalsLaunchIntent.List -> Unit
            }
            return
        }
        analytics.tab = io.buddybudget.app.features.analytics.AnalyticsTab.Risposte
        io.buddybudget.core.domain.analytics.AnalyticsQuestion.fromPath(path)?.let { analytics.select(it) }
        // ANA-007: «Fissa il tuo traguardo» opens the dialog once, without the walkthrough on top.
        if (path.contains("traguardo=1")) {
            analytics.fromGoalLink = true
            analytics.targetDialogOpen = true
        }
    }
}
