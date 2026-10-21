package io.buddybudget.app.features.liquidity

import io.buddybudget.app.features.help.showError

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.Account
import io.buddybudget.core.data.isManual
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.CreateTransactionBody
import io.buddybudget.core.data.LiquidityAnalysis
import io.buddybudget.core.data.LiquidityMonth
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.MovementType
import io.buddybudget.core.data.RecategorizeBody
import io.buddybudget.core.data.RecategorizeResult
import io.buddybudget.core.data.RuleCreateBody
import io.buddybudget.core.data.RuleMatchType
import io.buddybudget.core.data.RuleSaveResult
import io.buddybudget.core.data.TransactionPatch
import io.buddybudget.core.data.TransactionQuery
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.DateRange
import io.buddybudget.core.domain.periods.ExpensePeriod
import io.buddybudget.core.domain.periods.Periods
import io.buddybudget.core.domain.transactions.MovementEdit
import io.buddybudget.core.domain.transactions.MovementFeed
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

/** Load state of the feed. */
enum class FeedState { Loading, Loaded, Failed }

/**
 * State of Liquidità · Movimenti and Analisi (TX-003…061): shared filters, the month view, the paged feed, the period
 * analysis and every movement mutation. One instance per signed-in session (kept by `ShellModel`). Same fields as
 * `LiquidityModel` on iOS.
 */
class LiquidityModel(val env: AppEnvironment) {
    /** True while the Analisi view is on screen (its data then follows the filters). */
    var analysisActive = false

    // Shared filters (TX-003, TX-013…017)
    var accountId by mutableStateOf<String?>(null)
        private set
    var categoryFilter by mutableStateOf<MovementCategory?>(null)
        private set
    var search by mutableStateOf("")
    var type by mutableStateOf(MovementType.tutte)
        private set
    var uncategorizedOnly by mutableStateOf(false)
        private set

    // Analisi period (TX-052)
    var period by mutableStateOf(ExpensePeriod.MESE)
        private set
    var reference by mutableStateOf(today())
        private set

    // Data
    var categories by mutableStateOf<List<MovementCategory>>(emptyList())
        private set
    var usage by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var accounts by mutableStateOf<List<Account>?>(null)
        private set
    var month by mutableStateOf<Loadable<LiquidityMonth>>(Loadable.Loading)
        private set
    /** TX-076: when the month view (hero chart) arrived and whether it is reloading. */
    var monthUpdatedAt by mutableStateOf(0L)
        private set
    var fetchingMonth by mutableStateOf(false)
        private set
    var feed by mutableStateOf(MovementFeed())
        private set
    var feedState by mutableStateOf(FeedState.Loading)
        private set
    var loadingMore by mutableStateOf(false)
        private set
    var analysis by mutableStateOf<Loadable<LiquidityAnalysis>>(Loadable.Loading)
        private set

    /** Movements with a save in flight / a failed save (row status line). */
    var savingIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var failedIds by mutableStateOf<Set<String>>(emptySet())
        private set

    /** TX-020: a remote merchant logo was displayed in the feed. */
    var remoteLogoShown by mutableStateOf(false)

    // Hero chart (TX-009…011)
    var heroPeriod by mutableStateOf(io.buddybudget.core.domain.liquidity.LiquidityHero.defaultPeriod)
        private set
    var heroPoints by mutableStateOf<List<io.buddybudget.core.domain.liquidity.LiquidityHeroPoint>?>(null)
        private set
    private var heroGeneration = 0

    /** Refreshes the «da decidere» badge of the bottom bar after a change (set by the screen). */
    var onAttentionChanged: (suspend () -> Unit)? = null

    private val scope = MainScope()
    private var started = false
    private var searchJob: Job? = null
    private var feedGeneration = 0
    private var analysisGeneration = 0
    private var categoryIndex by mutableStateOf<Map<String, MovementCategory>>(emptyMap())

    val today: CalendarDate get() = today()
    val currency: String get() = env.session.currency

    val query: TransactionQuery
        get() = TransactionQuery(type, accountId, categoryFilter?.id, search, uncategorizedOnly)

    fun category(id: String?): MovementCategory? = id?.let { categoryIndex[it] }
    fun account(id: String?): Account? = accounts?.firstOrNull { it.id == id }
    val selectedAccount: Account? get() = account(accountId)
    val manualAccounts: List<Account> get() = accounts.orEmpty().filter { it.isManual }
    val uncategorizedCount: Int get() = month.valueOrNull?.toFix ?: 0

    // ---------------------------------------------------------------- Loading

    /** First open: everything; later opens: refresh. Marks movements as seen every time (TX-004). */
    suspend fun start() {
        scope.launch { runCatching { env.transactions.markSeen() } }
        started = true
        refresh()
    }

    suspend fun refresh() {
        val meta = scope.async { loadMeta() }
        val m = scope.async { loadMonth() }
        val f = scope.async { reloadFeed() }
        val h = scope.async { loadHero() }
        meta.await(); m.await(); f.await(); h.await()
        if (analysisActive) loadAnalysis()
    }

    /** TX-011: all accounts = the liquidity class of the server's net-worth series; one account = rebuilt backwards from
     *  its balance and its movements in the period (flat for a manual account). */
    suspend fun loadHero() {
        val hero = io.buddybudget.core.domain.liquidity.LiquidityHero
        heroGeneration += 1
        val generation = heroGeneration
        val period = heroPeriod
        val todayKey = today.iso
        try {
            val account = selectedAccount
            val points = if (account != null) {
                val follows = hero.followsTransactions(account)
                val movements = ArrayList<Pair<String, Double>>()
                if (follows) {
                    val from = if (period == io.buddybudget.core.data.OverviewPeriod.Max) null else hero.periodStart(period, today, null)
                    val query = TransactionQuery(accountId = account.id, limit = 200, from = from)
                    var cursor: String? = null
                    var pages = 0
                    do {
                        val page = env.transactions.page(query, cursor)
                        page.items.forEach { movements.add(it.date to it.amount) }
                        cursor = page.nextCursor
                        pages += 1
                    } while (cursor != null && pages < HERO_MAX_PAGES)
                }
                val earliest = movements.minOfOrNull { it.first }
                hero.accountSeries(account.balance, follows, movements, hero.periodStart(period, today, earliest), todayKey)
            } else {
                hero.totalSeries(env.overview.view(period, true, todayKey))
            }
            if (generation != heroGeneration) return
            heroPoints = points
        } catch (e: Exception) {
            if (generation != heroGeneration) return
            if (heroPoints == null) heroPoints = emptyList()
        }
    }

    fun updateHeroPeriod(next: io.buddybudget.core.data.OverviewPeriod) {
        if (next == heroPeriod) return
        heroPeriod = next
        scope.launch { loadHero() }
    }

    suspend fun loadMeta() {
        // Each part is applied as soon as it arrives (the account tiles never wait for the categories).
        val a = scope.async {
            val acc = runCatching { env.accounts.list(today()) }.getOrNull()
            if (acc != null) accounts = acc else if (accounts == null) accounts = emptyList()
        }
        val c = scope.async {
            runCatching { env.categoriesApi.list() }.getOrNull()?.let { list ->
                categories = list
                categoryIndex = list.associateBy { it.id }
            }
        }
        val u = scope.async { runCatching { env.categoriesApi.usage() }.getOrNull()?.let { usage = it } }
        a.await(); c.await(); u.await()
    }

    suspend fun loadMonth() {
        fetchingMonth = true
        try {
            month = Loadable.Loaded(env.liquidityApi.month(accountId, today))
        } catch (e: Exception) {
            if (month.valueOrNull == null) month = Loadable.Failed
        } finally {
            monthUpdatedAt = System.currentTimeMillis()
            fetchingMonth = false
        }
    }

    suspend fun reloadFeed() {
        feedGeneration += 1
        val generation = feedGeneration
        if (feed.isEmpty) feedState = FeedState.Loading
        try {
            val page = env.transactions.page(query)
            if (generation != feedGeneration) return
            feed = feed.reset(page)
            feedState = FeedState.Loaded
        } catch (e: Exception) {
            if (generation != feedGeneration) return
            feedState = FeedState.Failed
        }
    }

    /** TX-019: «Mostra altri movimenti» loads the next server page. */
    suspend fun loadMore() {
        val cursor = feed.nextCursor ?: return
        if (loadingMore) return
        loadingMore = true
        val generation = feedGeneration
        try {
            val page = runCatching { env.transactions.page(query, cursor) }.getOrNull()
            if (page != null && generation == feedGeneration) feed = feed.append(page)
        } finally {
            loadingMore = false
        }
    }

    suspend fun loadAnalysis() {
        analysisGeneration += 1
        val generation = analysisGeneration
        if (analysis.valueOrNull == null) analysis = Loadable.Loading
        try {
            val result = env.liquidityApi.analysis(period.key, reference, accountId, today)
            if (generation != analysisGeneration) return
            analysis = Loadable.Loaded(result)
        } catch (e: Exception) {
            if (generation != analysisGeneration) return
            analysis = Loadable.Failed
        }
    }

    // ---------------------------------------------------------------- Filters

    fun selectAccount(id: String?) {
        if (id == accountId) return
        accountId = id
        scope.launch {
            val m = async { loadMonth() }
            val f = async { reloadFeed() }
            val h = async { loadHero() }
            m.await(); f.await(); h.await()
        }
        if (analysisActive || analysis.valueOrNull != null) scope.launch { loadAnalysis() }
    }

    fun updateType(next: MovementType) {
        if (next == type) return
        type = next
        scope.launch { reloadFeed() }
    }

    fun toggleUncategorized() {
        uncategorizedOnly = !uncategorizedOnly
        scope.launch { reloadFeed() }
    }

    fun updateCategoryFilter(category: MovementCategory?) {
        categoryFilter = category
        scope.launch { reloadFeed() }
    }

    /** TX-057: a category tapped in Analisi filters Movimenti (the caller switches to the Movimenti segment). */
    fun showCategory(id: String, name: String) {
        categoryFilter = category(id) ?: MovementCategory(id, name, type = CategoryType.unknown)
        scope.launch { reloadFeed() }
    }

    /** Search with a short debounce (the server filters, TX-014). */
    fun searchChanged(text: String) {
        search = text
        searchJob?.cancel()
        searchJob = scope.launch {
            delay(300)
            reloadFeed()
        }
    }

    // ---------------------------------------------------------------- Analisi period (TX-052)

    val periodRange: DateRange get() = Periods.getPeriodRange(period, reference)
    val canGoForward: Boolean
        get() = !(periodRange.from <= today && today <= periodRange.to) && periodRange.to < today

    fun updatePeriod(next: ExpensePeriod) {
        if (next == period) return
        period = next
        scope.launch { loadAnalysis() }
    }

    fun shiftPeriod(direction: Int) {
        if (direction > 0 && !canGoForward) return
        reference = Periods.shiftReferenceDate(period, reference, direction)
        scope.launch { loadAnalysis() }
    }

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    // ---------------------------------------------------------------- Mutations

    private fun afterMutation() {
        scope.launch {
            loadMonth()
            if (analysis.valueOrNull != null) loadAnalysis()
        }
        scope.launch { onAttentionChanged?.invoke() }
    }

    private suspend fun patch(movement: Movement, body: TransactionPatch): Movement? {
        savingIds = savingIds + movement.id
        failedIds = failedIds - movement.id
        try {
            val updated = env.transactions.update(movement.id, body)
            // The PATCH response has no logoPath: keep the one already shown.
            val merged = updated.copy(logoPath = movement.logoPath)
            feed = feed.replace(merged)
            afterMutation()
            return merged
        } catch (e: Exception) {
            failedIds = failedIds + movement.id
            return null
        } finally {
            savingIds = savingIds - movement.id
        }
    }

    /** TX-030/031: change category, toast with undo, optional merchant rule and its feedback. */
    suspend fun changeCategory(movement: Movement, category: MovementCategory, remember: Boolean) {
        if (category.id == movement.categoryId) return
        val strings = env.session.strings()
        val previous = movement.categoryId
        val updated = patch(movement, TransactionPatch(categoryId = category.id))
        if (updated == null) {
            env.toasts.showError(strings.get(R.string.save_failed_try_again_17edad), io.buddybudget.core.domain.support.ReportErrorArea.Movimento)
            return
        }
        if (uncategorizedOnly && !category.isFallback) feed = feed.remove(updated.id)
        env.toasts.show(BBToastKind.Success, strings.get(R.string.moved_to_0_85405c, category.name), strings.get(R.string.cancel_6c3de5), onAction = {
            if (previous != null) scope.launch {
                val current = feed.items.firstOrNull { it.id == updated.id } ?: updated
                patch(current, TransactionPatch(categoryId = previous))
                if (uncategorizedOnly) reloadFeed()
            }
        })
        if (!remember || category.isFallback) return
        try {
            val result = env.rulesApi.create(RuleCreateBody(RuleMatchType.merchant, movement.description, category.id, replaceExisting = true))
            if (result.applied > 0) {
                val others = result.applied
                env.toasts.show(
                    BBToastKind.Success,
                    if (others == 1) strings.get(R.string.also_put_one_more_transaction_in_0_4321b6, category.name)
                    else strings.get(R.string.also_put_1_more_transactions_in_0_3ceb9e, category.name, others.toString()),
                )
                reloadFeed()
            }
            RuleFeedback.offerPastMatches(result, env) { refresh() }
        } catch (e: Exception) {
            // The category change succeeded; a failed rule is not blocking.
        }
    }

    /** TX-036: `excludedAmount = full − own` (positive). */
    suspend fun saveSplit(movement: Movement, excluded: Double): Boolean = patch(movement, TransactionPatch(excludedAmount = excluded)) != null

    /** TX-038. */
    suspend fun saveNote(movement: Movement, text: String): Boolean {
        val note = MovementEdit.notePatch(movement, text) ?: return true
        return patch(movement, TransactionPatch(note = note)) != null
    }

    /** TX-039. */
    suspend fun saveEdit(movement: Movement, body: TransactionPatch): Boolean {
        val updated = patch(movement, body) ?: return false
        if (body.date != null) reloadFeed() else feed = feed.replace(updated)
        return true
    }

    /** TX-041 (after the confirmation). */
    suspend fun delete(movement: Movement): Boolean = try {
        env.transactions.delete(movement.id)
        feed = feed.remove(movement.id)
        afterMutation()
        true
    } catch (e: Exception) {
        env.toasts.show(BBToastKind.Error, (e as? ApiError.Http)?.body?.message ?: env.session.strings().get(L10n.genericError))
        false
    }

    /** TX-042…048: returns the server error message on failure (e.g. demo data, 409). */
    suspend fun create(body: CreateTransactionBody): String? = try {
        env.transactions.create(body)
        reloadFeed()
        afterMutation()
        null
    } catch (e: Exception) {
        (e as? ApiError.Http)?.body?.message ?: env.session.strings().get(L10n.genericError)
    }

    companion object {
        fun today(): CalendarDate = CalendarDate.of(Instant.now(), ZoneId.systemDefault())
    }
}

/** Rule feedback shared by Movimenti «Ricordala» and the Regole screen (TX-031, CAT-034/035). Same as iOS. */
object RuleFeedback {
    private val scope = MainScope()

    /** CAT-035: persistent prompt to apply the rule to past movements as well («Cambiali» / «Lasciali così»). */
    fun offerPastMatches(result: RuleSaveResult, env: AppEnvironment, onChanged: suspend () -> Unit) {
        if (result.pastMatches <= 0) return
        val strings = env.session.strings()
        val one = result.pastMatches == 1
        val message = if (one) strings.get(R.string.this_also_applies_to_one_past_transactio_75258b)
        else strings.get(R.string.this_also_applies_to_0_past_transactions_420540, result.pastMatches.toString())
        env.toasts.show(
            BBToastKind.Info, message,
            strings.get(if (one) R.string.change_it_e01819 else R.string.change_them_675653),
            onAction = {
                scope.launch {
                    try {
                        val run = env.transactions.recategorize(RecategorizeBody("regola", ruleId = result.id))
                        showRecategorized(run, env, onChanged)
                        onChanged()
                    } catch (e: Exception) {
                        env.toasts.showError(strings.get(L10n.genericError), io.buddybudget.core.domain.support.ReportErrorArea.Movimento)
                    }
                }
            },
            durationMs = 600_000,
        )
    }

    /** CAT-087 result toast (10 s) with «Annulla» (CAT-088). */
    fun showRecategorized(run: RecategorizeResult, env: AppEnvironment, onChanged: suspend () -> Unit) {
        val strings = env.session.strings()
        val runId = run.runId
        if (runId == null || run.changed <= 0) {
            env.toasts.show(BBToastKind.Info, strings.get(R.string.nothing_to_change_these_transactions_hav_4897de))
            return
        }
        val message = if (run.changed == 1) strings.get(R.string.one_transaction_changed_category_90c2bf)
        else strings.get(R.string.s_0_transactions_changed_category_3a1dca, run.changed.toString())
        env.toasts.show(BBToastKind.Success, message, strings.get(R.string.cancel_6c3de5), onAction = {
            scope.launch {
                undo(runId, env)
                onChanged()
            }
        }, durationMs = 10_000)
    }

    suspend fun undo(runId: String, env: AppEnvironment) {
        val strings = env.session.strings()
        try {
            when (val restored = env.transactions.undoRecategorize(runId)) {
                0 -> env.toasts.show(BBToastKind.Info, strings.get(R.string.no_transactions_to_undo_you_have_already_d3a856))
                1 -> env.toasts.show(BBToastKind.Success, strings.get(R.string.one_transaction_was_restored_11ea8d))
                else -> env.toasts.show(BBToastKind.Success, strings.get(R.string.s_0_transactions_were_restored_163b6d, restored.toString()))
            }
        } catch (e: Exception) {
            env.toasts.showError(
                (e as? ApiError.Http)?.body?.message ?: strings.get(R.string.this_recategorisation_can_no_longer_be_u_ec39c3),
                io.buddybudget.core.domain.support.ReportErrorArea.Movimento,
            )
        }
    }
}

/** Pages of 200 movements read for one account's curve (enough for years of a personal account). */
private const val HERO_MAX_PAGES = 25
