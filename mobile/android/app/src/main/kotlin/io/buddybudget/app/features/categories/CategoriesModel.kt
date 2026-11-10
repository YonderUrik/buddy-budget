package io.buddybudget.app.features.categories

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.features.liquidity.RuleFeedback
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.CategorizationRule
import io.buddybudget.core.data.CategoryCreateBody
import io.buddybudget.core.data.CategoryPatch
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.RuleCreateBody
import io.buddybudget.core.data.RuleMatchType
import io.buddybudget.core.data.RulePatch
import io.buddybudget.core.data.RuleSaveResult
import io.buddybudget.core.domain.format.JSNumber
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

/** State of «Categorie e regole» (CAT-001…035). Same fields as `CategoriesModel` on iOS. */
class CategoriesModel(val env: AppEnvironment) {
    var categories by mutableStateOf<Loadable<List<MovementCategory>>>(Loadable.Loading)
        private set
    var usage by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var rules by mutableStateOf<Loadable<List<CategorizationRule>>>(Loadable.Loading)
        private set
    /** CAT-099…101: monthly budget per category id (only categories that have one). */
    var budgets by mutableStateOf<Map<String, Double>>(emptyMap())
        private set

    /** Categories with a save in flight (tile dimmed, CAT-010). */
    var pending by mutableStateOf<Set<String>>(emptySet())
        private set
    var remoteLogoShown by mutableStateOf(false)

    /** Called after any change so Movimenti refreshes (CAT-023). */
    var onChanged: (suspend () -> Unit)? = null

    private val scope = MainScope()

    val list: List<MovementCategory> get() = categories.valueOrNull.orEmpty()
    fun category(id: String?): MovementCategory? = list.firstOrNull { it.id == id }

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    private fun message(e: Exception): String = (e as? ApiError.Http)?.body?.message ?: env.session.strings().get(L10n.genericError)

    suspend fun load() {
        val c = scope.async { loadCategories() }
        val r = scope.async { loadRules() }
        c.await(); r.await()
    }

    suspend fun loadCategories() {
        try {
            val l = scope.async { env.categoriesApi.list() }
            val u = scope.async { env.categoriesApi.usage() }
            val b = scope.async { runCatching { env.budgets.list() }.getOrNull() }
            val list = l.await()
            usage = u.await()
            b.await()?.let { rows -> budgets = rows.filter { it.monthlyAmount > 0 }.associate { it.categoryId to it.monthlyAmount } }
            categories = Loadable.Loaded(list)
        } catch (e: Exception) {
            if (categories.valueOrNull == null) categories = Loadable.Failed
        }
    }

    /**
     * CAT-099/100: saves or removes the monthly budget; returns the error to show (the caller restores the field), or
     * null on success.
     */
    suspend fun saveBudget(category: MovementCategory, outcome: io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome): String? {
        val strings = env.session.strings()
        return when (outcome) {
            is io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome.Unchanged -> null
            is io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome.Invalid -> strings.lookup("Scrivi un importo, per esempio 300.")
            is io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome.Remove -> try {
                env.budgets.remove(category.id)
                budgets = budgets - category.id
                onChanged?.invoke()
                null
            } catch (e: Exception) {
                strings.lookup("Non è stato possibile togliere il budget, riprova.")
            }
            is io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome.Save -> try {
                val saved = env.budgets.upsert(category.id, outcome.amount)
                budgets = if (saved.monthlyAmount > 0) budgets + (category.id to saved.monthlyAmount) else budgets - category.id
                onChanged?.invoke()
                null
            } catch (e: Exception) {
                strings.lookup("Non è stato possibile salvare il budget, riprova.")
            }
        }
    }

    suspend fun loadRules() {
        try {
            rules = Loadable.Loaded(env.rulesApi.list())
        } catch (e: Exception) {
            if (rules.valueOrNull == null) rules = Loadable.Failed
        }
    }

    private fun replace(category: MovementCategory) {
        val items = categories.valueOrNull ?: return
        categories = Loadable.Loaded(items.map { if (it.id == category.id) category else it })
    }

    private fun changed() {
        scope.launch { onChanged?.invoke() }
    }

    // ---------------------------------------------------------------- Categories

    /** CAT-011: returns the server message on failure (e.g. «Categoria già esistente»). */
    suspend fun create(name: String, type: CategoryType): String? {
        val trimmed = JSNumber.trim(name)
        if (trimmed.isEmpty()) return null
        return try {
            val created = env.categoriesApi.create(CategoryCreateBody(trimmed, type))
            categories = Loadable.Loaded(list + created)
            changed()
            null
        } catch (e: Exception) {
            message(e)
        }
    }

    /** CAT-010/015/017…019: one field at a time; returns the server message on failure (the caller reverts). */
    suspend fun update(category: MovementCategory, patch: CategoryPatch): String? {
        pending = pending + category.id
        return try {
            val updated = env.categoriesApi.update(category.id, patch)
            // The PATCH answer carries the stored (not localized) name: keep the shown one unless it was renamed.
            replace(if (patch.name == null) updated.copy(name = category.name) else updated)
            changed()
            null
        } catch (e: Exception) {
            message(e)
        } finally {
            pending = pending - category.id
        }
    }

    /** CAT-021. */
    suspend fun delete(category: MovementCategory): Boolean = try {
        env.categoriesApi.delete(category.id)
        categories = Loadable.Loaded(list.filterNot { it.id == category.id })
        changed()
        true
    } catch (e: Exception) {
        false
    }

    /** CAT-012. */
    suspend fun distributeColors(): Boolean = try {
        env.categoriesApi.distributeColors()
        loadCategories()
        changed()
        true
    } catch (e: Exception) {
        false
    }

    // ---------------------------------------------------------------- Rules

    /** CAT-030: returns the server message on failure. */
    suspend fun createRule(pattern: String, matchType: RuleMatchType, categoryId: String): String? = try {
        val result = env.rulesApi.create(RuleCreateBody(matchType, JSNumber.trim(pattern), categoryId))
        loadRules()
        feedback(result)
        null
    } catch (e: Exception) {
        message(e)
    }

    /** CAT-027. */
    suspend fun updateRule(rule: CategorizationRule, patch: RulePatch): String? = try {
        val result = env.rulesApi.update(rule.id, patch)
        loadRules()
        feedback(result)
        null
    } catch (e: Exception) {
        message(e)
    }

    /** CAT-029 (after the confirmation). */
    suspend fun deleteRule(rule: CategorizationRule) {
        try {
            env.rulesApi.delete(rule.id)
            rules.valueOrNull?.let { items -> rules = Loadable.Loaded(items.filterNot { it.id == rule.id }) }
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, env.session.strings().get(R.string.deletion_failed_try_again_80c7e8))
        }
    }

    /** CAT-034/035. */
    private fun feedback(result: RuleSaveResult) {
        val strings = env.session.strings()
        if (result.applied > 0) {
            env.toasts.show(
                BBToastKind.Success,
                if (result.applied == 1) strings.get(R.string.rule_applied_immediately_to_one_uncatego_644b5a)
                else strings.get(R.string.rule_applied_immediately_to_0_uncategori_1bd69a, result.applied.toString()),
            )
            changed()
        }
        RuleFeedback.offerPastMatches(result, env) { onChanged?.invoke() }
    }
}
