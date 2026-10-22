package io.buddybudget.app.features.investments

import io.buddybudget.app.features.help.showError

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentCreateInput
import io.buddybudget.core.data.InstrumentSearchResult
import io.buddybudget.core.data.InstrumentSettingsInput
import io.buddybudget.core.data.InvestmentsIncome
import io.buddybudget.core.data.InvestmentsPerformance
import io.buddybudget.core.data.InvestmentsTaxes
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.OperationResult
import io.buddybudget.core.data.SaleSimulation
import io.buddybudget.core.data.TitleItem
import io.buddybudget.core.domain.investments.BackfillRead
import io.buddybudget.core.domain.investments.ChartRange
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.InvestmentsGate
import io.buddybudget.core.domain.investments.InvestmentsPeriod
import io.buddybudget.core.domain.investments.InvestmentsQuery
import io.buddybudget.core.domain.investments.InvestmentsTab
import io.buddybudget.core.domain.investments.InvestmentsUiState
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

/**
 * State of Investimenti (07-investments): the tab frame, the shared view per query, Performance, Dividendi, Tasse, the
 * watched titles, the price-history backfill and every mutation. Logic lives in :core (`InvestmentsRules`,
 * `InvestmentsUiState`, `OperationForm`); this model only sequences API calls. Same fields as `InvestmentsModel` on iOS.
 */
class InvestmentsModel(val env: AppEnvironment) {
    /** DE Tasse / Dividendi: the German plan (13-planning-de), shared by both tabs. */
    val planning = io.buddybudget.app.features.planningde.GermanPlanningModel(env.planning)
    var state by mutableStateOf(InvestmentsUiState.initial(todayKey()))
        private set
    /** Views by query (INV-005). */
    val views = mutableStateMapOf<InvestmentsQuery, InvestmentsView>()
    private val failedQueries = mutableStateMapOf<InvestmentsQuery, Boolean>()
    var performance by mutableStateOf<Loadable<InvestmentsPerformance>>(Loadable.Loading)
        private set
    /** INV-035: a range picked on the returns chart. */
    var selection by mutableStateOf<ChartRange?>(null)
        private set
    /** INV-034: chart point being inspected. */
    var inspectIndex by mutableStateOf<Int?>(null)
    var benchmarkBackfill by mutableStateOf<BackfillRead>(BackfillRead.NotRead)
        private set
    var income by mutableStateOf<Loadable<InvestmentsIncome>>(Loadable.Loading)
        private set
    var taxes by mutableStateOf<Loadable<InvestmentsTaxes>>(Loadable.Loading)
        private set
    /** INV-027 / SEC-010: null on error (section hidden). */
    var titles by mutableStateOf<List<TitleItem>?>(null)
        private set
    /** INV-024. */
    var backfilling by mutableStateOf<Set<String>>(emptySet())
        private set
    var registerForm by mutableStateOf<OperationForm?>(null)
    /** «Importa» / «Importa da file CSV» (INV-001, INV-010): opens the broker import, set by the shell. */
    var openImport: (() -> Unit)? = null
    var editing by mutableStateOf<OperationResult?>(null)
    /** "" = the Investimenti frame presents the register dialog, else the security page's instrument id. */
    var registerHost by mutableStateOf("")
    var manualPriceFor by mutableStateOf<Instrument?>(null)
    var logosShown by mutableStateOf(false)

    private val scope = MainScope()
    private var backfillJob: Job? = null
    private var benchmarkJob: Job? = null
    private var incomePolls = 0

    private fun tr(italian: String, values: Map<String, String> = emptyMap()) = env.session.strings().lookup(italian, values)

    val currency: String get() = env.session.currency
    val countryContent: InvestmentsCountryContent get() = InvestmentsCountryContent.of(env.session.features)
    val showsInflation: Boolean get() = env.session.features?.inflation ?: true
    val productCountry: String get() = env.session.bootstrap?.profile?.productCountry ?: "IT"

    // ---------------------------------------------------------------- Tabs and periods

    fun select(tab: InvestmentsTab) {
        state = state.copy(tab = tab)
        ensureBaseView()
        scope.launch { load(tab) }
    }

    /** The broker chip and the pickers need a view even on Performance / Dividendi / Tasse. */
    private fun ensureBaseView() {
        if (anyView == null && state.tab !in setOf(InvestmentsTab.Portfolio, InvestmentsTab.Diversification, InvestmentsTab.Operations)) {
            scope.launch { loadView(state.baseQuery) }
        }
    }

    fun leaveSection() {
        if (state.excludedBrokers.isNotEmpty()) state = state.copy(excludedBrokers = emptySet())
    }

    private fun refreshTabs() {
        val visible = InvestmentsTab.visible(env.session.sections)
        state = state.copy(visibleTabs = visible, tab = if (state.tab in visible) state.tab else InvestmentsTab.Portfolio)
    }

    fun setPeriod(period: InvestmentsPeriod) {
        state = state.copy(period = period)
        scope.launch { loadPortfolio() }
    }

    fun applyCustomRange(range: ChartRange) {
        state = state.copy(customRange = range, period = InvestmentsPeriod.Custom)
        scope.launch { loadPortfolio() }
    }

    /** INV-036. */
    fun setPerformancePeriod(period: InvestmentsPeriod) {
        state = state.copy(performancePeriod = period)
        selection = null
        inspectIndex = null
        scope.launch { loadPerformance() }
    }

    fun applyPerformanceRange(range: ChartRange) {
        state = state.copy(performanceCustomRange = range, performancePeriod = InvestmentsPeriod.Custom)
        selection = null
        inspectIndex = null
        scope.launch { loadPerformance() }
    }

    fun selectRange(range: ChartRange?) {
        selection = range
        inspectIndex = null
        scope.launch { loadPerformance() }
    }

    fun toggleBroker(id: String) {
        val next = if (id in state.excludedBrokers) state.excludedBrokers - id else state.excludedBrokers + id
        state = state.copy(excludedBrokers = next)
        scope.launch { load(state.tab) }
    }

    fun showAllBrokers() {
        state = state.copy(excludedBrokers = emptySet())
        scope.launch { load(state.tab) }
    }

    fun setReinvest(fees: Boolean? = null, taxes: Boolean? = null) {
        state = state.copy(reinvestFees = fees ?: state.reinvestFees, reinvestTaxes = taxes ?: state.reinvestTaxes)
    }

    // ---------------------------------------------------------------- Loading

    val portfolioView: InvestmentsView? get() = views[state.portfolioQuery]
    val baseView: InvestmentsView? get() = views[state.baseQuery]
    val anyView: InvestmentsView? get() = portfolioView ?: baseView ?: views.values.firstOrNull()

    fun gate(query: InvestmentsQuery, countsCash: Boolean): InvestmentsGate {
        val view = views[query]
        return InvestmentsGate.of(view != null, failedQueries[query] == true, view?.hasTransactions ?: false, view?.brokerCash?.isNotEmpty() ?: false,
            countsCash, state.excludedBrokers.isNotEmpty())
    }

    suspend fun start() {
        state = state.copy(today = todayKey())
        refreshTabs()
        ensureBaseView()
        load(state.tab)
    }

    suspend fun load(tab: InvestmentsTab) {
        when (tab) {
            InvestmentsTab.Portfolio -> loadPortfolio()
            InvestmentsTab.Performance -> loadPerformance()
            InvestmentsTab.Diversification, InvestmentsTab.Operations -> loadView(state.baseQuery)
            InvestmentsTab.Income -> loadIncome()
            InvestmentsTab.Taxes -> loadTaxes()
        }
    }

    /** INV-007. */
    suspend fun reloadAll() {
        views.clear()
        failedQueries.clear()
        performance = Loadable.Loading
        income = Loadable.Loading
        taxes = Loadable.Loading
        if (countryContent == InvestmentsCountryContent.GermanPlan && (state.tab == InvestmentsTab.Income || state.tab == InvestmentsTab.Taxes)) {
            planning.load()
        }
        load(state.tab)
    }

    suspend fun loadPortfolio() {
        val titlesJob = scope.launch { loadTitles() }
        loadView(state.portfolioQuery)
        titlesJob.join()
        portfolioView?.let { startBackfillPolling(it.instruments.map { i -> i.id }) }
    }

    suspend fun loadView(query: InvestmentsQuery) {
        failedQueries.remove(query)
        try {
            views[query] = env.investments.view(query)
        } catch (e: Exception) {
            if (views[query] == null) failedQueries[query] = true
        }
    }

    suspend fun loadTitles() {
        titles = runCatching { env.investments.titles() }.getOrNull()
    }

    suspend fun loadPerformance() {
        val query = state.performanceQuery(selection)
        if (performance !is Loadable.Loaded) performance = Loadable.Loading
        try {
            val result = env.investments.performance(query)
            performance = Loadable.Loaded(result)
            result.benchmark?.id?.let { pollBenchmark(it) }
        } catch (e: Exception) {
            if (performance !is Loadable.Loaded) performance = Loadable.Failed
        }
    }

    /** INV-039. */
    private suspend fun pollBenchmark(id: String) {
        benchmarkJob?.cancel()
        val first = runCatching { env.instruments.backfill(listOf(id)) }.getOrNull()?.firstOrNull()
        benchmarkBackfill = BackfillRead.Read(first)
        if (first?.isRunning != true) return
        benchmarkJob = scope.launch {
            repeat(150) {
                delay(2000)
                val next = runCatching { env.instruments.backfill(listOf(id)) }.getOrNull()?.firstOrNull()
                benchmarkBackfill = BackfillRead.Read(next)
                if (next?.isRunning != true) {
                    loadPerformance()
                    return@launch
                }
            }
        }
    }

    /** INV-081: every 4 s (max 6 times) while dividend histories download. */
    suspend fun loadIncome() {
        if (countryContent != InvestmentsCountryContent.Italian) return
        try {
            val result = env.investments.income(state.baseQuery)
            income = Loadable.Loaded(result)
            if (result.pendingDividendHistory > 0 && incomePolls < 6) {
                incomePolls += 1
                delay(4000)
                if (state.tab == InvestmentsTab.Income) loadIncome()
            } else {
                incomePolls = 0
            }
        } catch (e: Exception) {
            if (income !is Loadable.Loaded) income = Loadable.Failed
        }
    }

    suspend fun loadTaxes() {
        if (countryContent != InvestmentsCountryContent.Italian) return
        try {
            taxes = Loadable.Loaded(env.investments.taxes(state.baseQuery))
        } catch (e: Exception) {
            if (taxes !is Loadable.Loaded) taxes = Loadable.Failed
        }
    }

    /** INV-024. */
    private fun startBackfillPolling(ids: List<String>) {
        backfillJob?.cancel()
        backfillJob = scope.launch {
            var wasRunning = false
            repeat(90) {
                val states = runCatching { env.instruments.backfill(ids) }.getOrDefault(emptyList())
                val running = states.filter { it.isRunning }.map { it.instrumentId }.toSet()
                backfilling = running
                if (running.isEmpty()) {
                    if (wasRunning) reloadAll()
                    return@launch
                }
                wasRunning = true
                delay(2000)
            }
        }
    }

    // ---------------------------------------------------------------- Mutations

    private fun message(e: Exception): String {
        val text = (e as? ApiError.Http)?.body?.message
        return if (!text.isNullOrEmpty()) text else tr("Qualcosa è andato storto. Riprova.")
    }

    private suspend fun afterMutation() {
        reloadAll()
        if (state.tab != InvestmentsTab.Portfolio) loadTitles()
    }

    fun openRegister(form: OperationForm? = null) {
        editing = null
        var f = form ?: OperationForm(date = todayKey())
        if (f.held == null) f.instrument?.id?.let { f = f.copy(held = heldQuantity(it)) }
        registerForm = f
    }

    fun openEdit(op: OperationResult) {
        val instrument = anyView?.instrument(op.transaction.instrumentId)
        editing = op
        registerForm = OperationForm.editing(op.transaction, instrument,
            heldQuantity(op.transaction.instrumentId)?.let { it + if (op.transaction.type == "vendita") op.transaction.quantityValue else 0.0 })
    }

    fun heldQuantity(instrumentId: String): Double? {
        val view = anyView ?: return null
        return view.summary.rows.firstOrNull { it.instrument.id == instrumentId }?.quantity ?: 0.0
    }

    /** Returns the server error on failure (INV-070). */
    suspend fun save(form: OperationForm): String? {
        val input = form.input(todayKey()) ?: return form.validate(todayKey())
        return try {
            val current = editing
            if (current != null) env.investments.updateOperation(current.transaction.id, input) else env.investments.createOperation(input)
            registerForm = null
            editing = null
            registerHost = ""
            afterMutation()
            null
        } catch (e: Exception) {
            message(e)
        }
    }

    suspend fun delete(op: OperationResult) {
        try {
            env.investments.deleteOperation(op.transaction.id)
            afterMutation()
        } catch (e: Exception) {
            env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Operazione)
        }
    }

    suspend fun saveManualPrice(instrument: Instrument, date: String, close: Double): String? = try {
        env.instruments.setManualPrice(instrument.id, date, close)
        manualPriceFor = null
        afterMutation()
        null
    } catch (e: Exception) {
        message(e)
    }

    suspend fun saveTargets(targets: List<InvestmentsView.Target>): String? = try {
        env.investments.setTargets(targets)
        afterMutation()
        null
    } catch (e: Exception) {
        message(e)
    }

    suspend fun setBenchmark(instrumentId: String?): String? = try {
        env.investments.setBenchmark(instrumentId)
        performance = Loadable.Loading
        loadPerformance()
        null
    } catch (e: Exception) {
        message(e)
    }

    suspend fun setBenchmark(hit: InstrumentSearchResult.MarketHit): String? = try {
        val instrument = env.instruments.create(InstrumentCreateInput.Yahoo(hit.symbol, hit.name, hit.type, null), deferHistory = true)
        setBenchmark(instrument.id)
    } catch (e: Exception) {
        message(e)
    }

    suspend fun setRegime(regime: String) {
        try {
            env.investments.setTaxRegime(regime)
            loadTaxes()
        } catch (e: Exception) {
            env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Salvataggio)
        }
    }

    suspend fun addCarryforward(year: Int, amount: Double, note: String?): String? = try {
        env.investments.addCarryforward(year, amount, note)
        loadTaxes()
        null
    } catch (e: Exception) {
        message(e)
    }

    suspend fun deleteCarryforward(id: String) {
        try {
            env.investments.deleteCarryforward(id)
            loadTaxes()
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e))
        }
    }

    suspend fun saveSettings(instrumentId: String, input: InstrumentSettingsInput): String? = try {
        env.instruments.saveSettings(instrumentId, input)
        loadTaxes()
        loadIncome()
        null
    } catch (e: Exception) {
        message(e)
    }

    suspend fun saveBreakdown(instrumentId: String, sectors: Map<String, Double>?, areas: Map<String, Double>?): String? = try {
        env.instruments.saveBreakdown(instrumentId, sectors, areas)
        reloadAll()
        null
    } catch (e: Exception) {
        message(e)
    }

    /** INV-078 with undo. */
    suspend fun dismiss(items: List<InvestmentsIncome.Missing>) {
        val pairs = items.map { it.instrumentId to it.date }
        try {
            env.investments.dismissDividends(pairs)
            loadIncome()
            val text = if (items.size == 1) tr("Proposta ignorata") else tr("{0} proposte ignorate", mapOf("0" to items.size.toString()))
            env.toasts.show(BBToastKind.Plain, text, tr("Annulla"), onAction = {
                scope.launch {
                    runCatching { env.investments.restoreDividends(pairs) }
                    loadIncome()
                }
            })
        } catch (e: Exception) {
            env.toasts.showError(message(e), io.buddybudget.core.domain.support.ReportErrorArea.Operazione)
        }
    }

    /** INV-086. */
    suspend fun simulateSale(instrumentId: String, quantity: Double): SaleSimulation? =
        runCatching { env.investments.simulateSale(instrumentId, quantity, state.baseQuery) }.getOrNull()

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    companion object {
        fun todayKey(): String = CalendarDate.of(Instant.now(), ZoneId.systemDefault()).iso
    }
}
