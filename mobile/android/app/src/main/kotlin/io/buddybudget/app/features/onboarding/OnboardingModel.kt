package io.buddybudget.app.features.onboarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.generated.AppLanguage
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.LegalConsent
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.data.OnboardingRequest
import io.buddybudget.core.domain.onboarding.CategoryProposalItem
import io.buddybudget.core.domain.onboarding.CategorySetup
import io.buddybudget.core.domain.onboarding.OnboardingStep
import io.buddybudget.core.domain.shell.LocaleRules
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/** State of the onboarding wizard (AUTH-024…043). Same fields as `OnboardingModel` on iOS. */
class OnboardingModel(private val env: AppEnvironment) {
    @set:JvmName("assignCountry")
    var country by mutableStateOf(LocaleRules.resolveCountry(env.session.bootstrap?.profile?.productCountry))
        private set
    @set:JvmName("assignLanguage")
    var language by mutableStateOf(
        AppLanguage.resolve(env.session.bootstrap?.profile?.language, env.session.bootstrap?.profile?.productCountry).code,
    )
        private set
    var currency by mutableStateOf(LocaleRules.DEFAULT_CURRENCY)
    var categories by mutableStateOf<List<CategoryProposalItem>>(emptyList())
        private set
    var proposal by mutableStateOf<List<CategoryProposalItem>>(emptyList())
        private set
    var aiEnabled by mutableStateOf(false)
    var aiAvailable by mutableStateOf(false)
        private set
    var notifications by mutableStateOf(NotificationPreferences.Defaults)
    var consent by mutableStateOf(LegalConsent())
    var index by mutableIntStateOf(0)
        private set
    /** +1 forward, −1 back (step transition direction). */
    var direction by mutableIntStateOf(1)
        private set
    var saving by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var legal by mutableStateOf<LegalMeta?>(null)
        private set

    private val scope = MainScope()

    init {
        rebuildProposal()
    }

    val steps: List<OnboardingStep> get() = OnboardingStep.steps(aiAvailable)

    /** AUTH-058: «Cosa vuoi tenere sotto controllo?» (pension only where the pension section exists). */
    var focus by mutableStateOf<List<io.buddybudget.core.domain.overview.StartFocus>>(emptyList())
    val focusOptions: List<io.buddybudget.core.domain.overview.StartFocus>
        get() = io.buddybudget.core.domain.overview.StartFocus.options(country != "DE")
    val step: OnboardingStep get() = steps[minOf(index, steps.size - 1)]
    val isFirst: Boolean get() = index == 0
    val isLast: Boolean get() = index == steps.size - 1
    val customized: Boolean get() = CategorySetup.isCustomized(categories, proposal)
    val problem: CategorySetup.Problem? get() = CategorySetup.validate(categories)

    suspend fun load() {
        runCatching { env.user.aiCategorization() }.getOrNull()?.let { aiAvailable = it.available }
        legal = env.session.loadLegal()
    }

    /** AUTH-027 / AUTH-029 / AUTH-034. */
    fun setCountry(next: String) {
        if (next == country) return
        country = next
        language = LocaleRules.languageAfterSwitching(next, language)
        languageDidChange()
    }

    fun setLanguage(next: String) {
        if (next == language) return
        language = next
        languageDidChange()
    }

    private fun languageDidChange() {
        env.session.applyLanguage(AppLanguage.resolve(language, country))
        rebuildProposal()
        scope.launch { legal = env.session.loadLegal() }
    }

    private fun rebuildProposal() {
        val strings = env.session.strings()
        proposal = CategorySetup.localizedProposal(country) { strings.lookup(it) }
        categories = proposal
    }

    // Categories (AUTH-031/032)

    fun toggle(index: Int, on: Boolean) {
        categories = categories.mapIndexed { i, item -> if (i == index) item.copy(enabled = on) else item }
    }

    /** Returns the translated reason when the name is rejected. */
    fun rename(index: Int, name: String): String? {
        val (next, problem) = CategorySetup.rename(categories, index, name)
        categories = next
        return message(problem)
    }

    fun add(type: String, name: String): String? {
        val (next, problem) = CategorySetup.add(categories, type, name)
        categories = next
        return message(problem)
    }

    fun resetCategories() {
        categories = proposal
    }

    fun message(problem: CategorySetup.Problem?): String? {
        problem ?: return null
        return env.session.strings().lookup(problem.source, problem.value?.let { mapOf("0" to it) } ?: emptyMap())
    }

    // Navigation

    fun back() {
        if (isFirst) return
        error = null
        direction = -1
        index -= 1
    }

    suspend fun next() {
        if (isLast) {
            submit()
            return
        }
        direction = 1
        index += 1
    }

    /** AUTH-039: `POST /api/user/onboarding`, then the session re-routes (AUTH-042). */
    private suspend fun submit() {
        val version = legal?.version ?: env.session.bootstrap?.legal?.currentVersion ?: ""
        val legalPayload = consent.payload(version) ?: return
        saving = true
        error = null
        val request = OnboardingRequest(
            currency, country, language, legalPayload, notifications,
            CategorySetup.payload(categories, proposal), if (aiAvailable) aiEnabled else null,
            // A pension answer left over from a country change is dropped (AUTH-058).
            focus.filter { it in focusOptions }.map { it.raw },
        )
        val strings = env.session.strings()
        try {
            env.user.completeOnboarding(request)
            env.session.refresh()
        } catch (e: ApiError.Transport) {
            error = strings.get(R.string.connection_failed_check_your_network_and_93acb6)
        } catch (e: Exception) {
            error = strings.get(R.string.could_not_save_your_preferences_try_agai_e6871a)
        }
        saving = false
    }
}
