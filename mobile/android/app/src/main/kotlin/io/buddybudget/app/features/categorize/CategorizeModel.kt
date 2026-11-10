package io.buddybudget.app.features.categorize

import io.buddybudget.app.features.help.showError

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.features.liquidity.FeedState
import io.buddybudget.app.features.liquidity.LiquidityModel
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.AiCategorizationPatch
import io.buddybudget.core.data.AiCategorizationState
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.AutoCategorizedGroup
import io.buddybudget.core.data.AutoCategorizedResponse
import io.buddybudget.core.data.CategorizeApplyGroup
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.SuggestionGroup
import io.buddybudget.core.domain.categorization.CategorizeDeck
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class CategorizeTab { ToReview, Auto }

/**
 * State of /categorizza (CAT-036…089): the «Da decidere» deck with batched saves, «Messe dall'app», auto-apply, AI
 * generation polling and Ricategorizza. Same fields as `CategorizeModel` on iOS.
 */
class CategorizeModel(val env: AppEnvironment) {
    var tab by mutableStateOf(CategorizeTab.ToReview)
        private set
    private var userChoseTab = false

    var suggestionsState by mutableStateOf(FeedState.Loading)
        private set
    var deck by mutableStateOf(CategorizeDeck(emptyList()))
        private set
    var autoApplyEnabled by mutableStateOf(true)
        private set

    /** CAT-097: opens a movement's detail (set by the screen to the shell's sheet). */
    var openMovement: (String) -> Unit = {}
    var auto by mutableStateOf<Loadable<AutoCategorizedResponse>>(Loadable.Loading)
        private set
    var categories by mutableStateOf<List<MovementCategory>>(emptyList())
        private set
    var usage by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var ai by mutableStateOf<AiCategorizationState?>(null)
        private set

    /** The «Usa sempre questa categoria» checkbox of the active card (never on by default, CAT-063). */
    var remember by mutableStateOf(false)

    /** Groups of «Messe dall'app» being changed (row disabled). */
    var changingAuto by mutableStateOf<Set<String>>(emptySet())
        private set
    var remoteLogoShown by mutableStateOf(false)

    // AI generation (CAT-048…053)
    var generating by mutableStateOf(false)
        private set
    var generationTotal by mutableIntStateOf(0)
        private set
    var generationDone by mutableIntStateOf(0)
        private set
    var generationFinished by mutableStateOf(false)
        private set

    var onChanged: (suspend () -> Unit)? = null
    private val scope = MainScope()
    private var saveJob: Job? = null
    private var pollJob: Job? = null

    val today: CalendarDate get() = LiquidityModel.today()
    fun category(id: String?): MovementCategory? = categories.firstOrNull { it.id == id }

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    private fun str(id: Int, vararg args: Any): String = env.session.strings().get(id, *args)

    // ---------------------------------------------------------------- Loading

    suspend fun load() {
        val meta = scope.async { loadMeta() }
        val s = scope.async { loadSuggestions() }
        val a = scope.async { loadAuto() }
        meta.await(); s.await(); a.await()
    }

    private suspend fun loadMeta() {
        val c = scope.async { runCatching { env.categoriesApi.list() }.getOrNull() }
        val u = scope.async { runCatching { env.categoriesApi.usage() }.getOrNull() }
        val a = scope.async { runCatching { env.user.aiCategorization() }.getOrNull() }
        c.await()?.let { categories = it }
        u.await()?.let { usage = it }
        ai = a.await()
    }

    /** CAT-040…042: ready groups are hidden and auto-applied once per load. */
    suspend fun loadSuggestions() {
        try {
            val response = env.transactions.suggestions()
            autoApplyEnabled = response.autoApply.enabled
            val ready = response.autoApply.readyKeys.toSet()
            deck = CategorizeDeck.of(response.groups).remove(ready)
            suggestionsState = FeedState.Loaded
            if (ready.isNotEmpty()) {
                val readyGroups = response.groups.filter { it.groupKey in ready }
                scope.launch { autoApply(readyGroups) }
            }
        } catch (e: Exception) {
            if (suggestionsState != FeedState.Loaded) suggestionsState = FeedState.Failed
        }
    }

    private suspend fun autoApply(readyGroups: List<SuggestionGroup>) {
        try {
            val result = env.transactions.categorizeAuto()
            if (result.applied > 0) {
                val message = if (result.applied == 1) str(R.string.s_1_transaction_categorized_automatically_94a17b)
                else str(R.string.s_0_transactions_categorized_automatically_778f47, result.applied.toString())
                env.toasts.show(
                    BBToastKind.Success, "$message ${str(R.string.find_them_under_assigned_by_the_app_44a35c)}",
                    str(R.string.view_18f454), onAction = { select(CategorizeTab.Auto) },
                )
                loadAuto()
                onChanged?.invoke()
            }
        } catch (e: Exception) {
            deck = deck.restore(readyGroups)
        }
    }

    suspend fun loadAuto() {
        try {
            auto = Loadable.Loaded(env.transactions.autoCategorized())
        } catch (e: Exception) {
            if (auto.valueOrNull == null) auto = Loadable.Failed
        }
    }

    fun select(next: CategorizeTab) {
        userChoseTab = true
        tab = next
    }

    // ---------------------------------------------------------------- Deck (CAT-058…068)

    fun confirm() {
        val next = deck.confirm(remember) ?: return
        deck = next
        decided()
    }

    fun choose(category: MovementCategory) {
        deck = deck.choose(category.id, remember)
        decided()
    }

    fun skip() {
        deck = deck.skip()
        remember = false
    }

    fun undo() {
        val (next, decision) = deck.undo()
        deck = next
        decision?.let { remember = it.remember }
        scheduleSave()
    }

    private fun decided() {
        remember = false
        scheduleSave()
    }

    /** CAT-064: saved together 5 s after the last decision. */
    private fun scheduleSave() {
        saveJob?.cancel()
        if (!deck.canUndo) return
        saveJob = scope.launch {
            delay(5000)
            flush()
        }
    }

    /** Saves every pending decision now (5 s idle, leaving the screen, app in background). */
    suspend fun flush() {
        saveJob?.cancel()
        val (next, batch) = deck.beginSave()
        if (batch == null) return
        deck = next
        try {
            for (chunk in batch.chunked(25)) env.transactions.categorizeApply(chunk.map { it.applyGroup })
            deck = deck.finishSave(batch)
            loadAuto()
            onChanged?.invoke()
        } catch (e: Exception) {
            deck = deck.failSave(batch)
            env.toasts.showError((e as? ApiError.Http)?.body?.message ?: str(R.string.save_failed_try_again_17edad), io.buddybudget.core.domain.support.ReportErrorArea.Movimento)
        }
    }

    // ---------------------------------------------------------------- Auto-apply option (CAT-045)

    suspend fun enableAutoApply() {
        try {
            ai = env.user.updateAiCategorization(AiCategorizationPatch(autoApply = true))
            autoApplyEnabled = true
            loadSuggestions()
        } catch (e: Exception) {
            env.toasts.showError(str(L10n.genericError), io.buddybudget.core.domain.support.ReportErrorArea.Salvataggio)
        }
    }

    // ---------------------------------------------------------------- «Messe dall'app» (CAT-077…080, CAT-082: a 30-day history, nothing to confirm)

    suspend fun changeAuto(group: AutoCategorizedGroup, category: MovementCategory, remember: Boolean) {
        changingAuto = changingAuto + group.groupKey
        try {
            env.transactions.categorizeApply(listOf(CategorizeApplyGroup(group.transactionIds, category.id, 0.0, remember, group.merchantKey)))
            env.toasts.show(
                BBToastKind.Success,
                if (remember) str(R.string.category_changed_including_for_future_tr_337a45) else str(R.string.category_changed_feddf6),
            )
            loadAuto()
            onChanged?.invoke()
        } catch (e: Exception) {
            env.toasts.showError((e as? ApiError.Http)?.body?.message ?: str(R.string.save_failed_try_again_17edad), io.buddybudget.core.domain.support.ReportErrorArea.Movimento)
        } finally {
            changingAuto = changingAuto - group.groupKey
        }
    }

    // ---------------------------------------------------------------- AI (CAT-048…053)

    val aiAvailable: Boolean get() = ai?.available ?: false
    val aiConsented: Boolean get() = ai?.enabled ?: false

    /** CAT-048: available, on «Da decidere», something to decide, and groups without proposal or a run in progress/done. */
    val showsAI: Boolean
        get() = aiAvailable && tab == CategorizeTab.ToReview && !deck.isEmpty && (deck.withoutProposal > 0 || generating || generationFinished)

    /** CAT-050: records the consent, then starts. */
    suspend fun consentAndGenerate() {
        try {
            ai = env.user.updateAiCategorization(AiCategorizationPatch(enabled = true))
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, str(R.string.the_assistant_is_unavailable_f021f3))
            return
        }
        generate()
    }

    /** CAT-051…053: start, then poll every 4 s. */
    suspend fun generate() {
        if (generating) return
        val status = try {
            env.transactions.generateSuggestions()
        } catch (e: Exception) {
            ""
        }
        if (status != "started") {
            env.toasts.show(BBToastKind.Error, str(R.string.the_assistant_is_unavailable_f021f3))
            return
        }
        generating = true
        generationFinished = false
        generationTotal = deck.withoutProposal
        generationDone = 0
        pollJob?.cancel()
        pollJob = scope.launch { poll() }
    }

    private suspend fun poll() {
        var unchanged = 0
        var lastDone = 0
        for (i in 0 until 60) {
            delay(4000)
            val response = runCatching { env.transactions.suggestions() }.getOrNull() ?: continue
            val ready = response.autoApply.readyKeys.toSet()
            deck = deck.refresh(response.groups.filterNot { it.groupKey in ready })
            val missing = deck.withoutProposal
            generationDone = maxOf(0, generationTotal - missing)
            if (generationDone == lastDone) unchanged += 1 else unchanged = 0
            lastDone = generationDone
            if (missing == 0 || (generationDone > 0 && unchanged >= 8)) break
        }
        generating = false
        generationFinished = true
        val done = generationDone
        env.toasts.show(
            BBToastKind.Success,
            if (done == 1) str(R.string.s_1_merchant_has_a_suggestion_c0665b) else str(R.string.s_0_merchants_have_suggestions_0da855, done.toString()),
        )
        loadSuggestions()
    }

    fun stop() {
        pollJob?.cancel()
    }
}
