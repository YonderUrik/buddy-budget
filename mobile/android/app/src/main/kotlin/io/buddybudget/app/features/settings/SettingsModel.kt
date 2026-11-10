package io.buddybudget.app.features.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.generated.L10n
import io.buddybudget.core.data.AiCategorizationPatch
import io.buddybudget.core.data.AiCategorizationState
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.data.NotificationPreferencesPatch
import io.buddybudget.core.data.UserDataSummary
import io.buddybudget.core.data.UserSessionView
import io.buddybudget.core.data.UserSettings
import io.buddybudget.core.data.UserSettingsPatch
import io.buddybudget.core.domain.settings.RecentLogin
import io.buddybudget.core.domain.settings.SettingsGroup
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Load state of one async block of the Settings screens. */
sealed class Loadable<out T> {
    data object Loading : Loadable<Nothing>()
    data object Failed : Loadable<Nothing>()
    data class Loaded<T>(val value: T) : Loadable<T>()

    val valueOrNull: T? get() = (this as? Loaded<T>)?.value
}

/**
 * State of Impostazioni (SET-001…049). One instance per signed-in session, shared by the hub and its groups.
 * Same fields as `SettingsModel` on iOS.
 */
class SettingsModel(val env: AppEnvironment) {
    var settings by mutableStateOf<Loadable<UserSettings>>(Loadable.Loading)
        private set
    var sessions by mutableStateOf<Loadable<List<UserSessionView>>>(Loadable.Loading)
        private set
    var notifications by mutableStateOf<Loadable<NotificationPreferences>>(Loadable.Loading)
        private set
    var ai by mutableStateOf<Loadable<AiCategorizationState>>(Loadable.Loading)
        private set
    var dataSummary by mutableStateOf<Loadable<UserDataSummary>>(Loadable.Loading)
        private set
    /** Re-evaluated every 15 s (SET-040). */
    private var now by mutableLongStateOf(System.currentTimeMillis())
    /** A server `reauth_required` forces the Reauth panel even if the clock says recent. */
    var forcedReauth by mutableStateOf(false)

    var savingSettings by mutableStateOf(false)
    var settingsError by mutableStateOf<String?>(null)
    var nameSaved by mutableStateOf(false)
    var revoking by mutableStateOf<String?>(null)
    var sessionsError by mutableStateOf<String?>(null)
    var savingNotifications by mutableStateOf(false)
    var notificationsError by mutableStateOf<String?>(null)
    var exampleState by mutableStateOf<ExampleState>(ExampleState.Idle)
    var savingAi by mutableStateOf(false)
    var aiError by mutableStateOf<String?>(null)
    var instructionsSaved by mutableStateOf(false)

    sealed class ExampleState {
        data object Idle : ExampleState()
        data object Sending : ExampleState()
        data object Sent : ExampleState()
        data class Failed(val message: String) : ExampleState()
    }

    private val scope = MainScope()
    private var ticker: Job? = null

    val recentLogin: Boolean get() = !forcedReauth && RecentLogin.isRecent(settings.valueOrNull?.recentLoginUntil, now)

    suspend fun start() {
        if (ticker == null) {
            ticker = scope.launch {
                while (isActive) {
                    delay(RecentLogin.RECHECK_SECONDS * 1000)
                    now = System.currentTimeMillis()
                }
            }
        }
        loadSettings()
    }

    suspend fun loadSettings() {
        if (settings.valueOrNull == null) settings = Loadable.Loading
        try {
            settings = Loadable.Loaded(env.user.settings())
        } catch (_: Exception) {
            if (settings.valueOrNull == null) settings = Loadable.Failed
        }
        now = System.currentTimeMillis()
    }

    suspend fun loadGroup(group: SettingsGroup) {
        when (group) {
            SettingsGroup.Account -> loadSessions()
            SettingsGroup.Notifiche -> {
                val n = scope.async { loadNotifications() }
                val a = scope.async { loadAi() }
                n.await(); a.await()
            }
            SettingsGroup.Privacy -> loadDataSummary()
            SettingsGroup.Aspetto, SettingsGroup.Pericolo -> Unit
        }
    }

    // Profile & preferences

    suspend fun saveName(name: String) {
        patch(UserSettingsPatch(name = name.trim()))
        nameSaved = settingsError == null
    }

    /** SET-013/014/016: saves immediately; the bootstrap is re-read (whole app reformats / re-translates). */
    suspend fun patch(patch: UserSettingsPatch) {
        savingSettings = true
        settingsError = null
        try {
            env.user.updateSettings(patch)
            loadSettings()
            env.session.refresh()
        } catch (e: Exception) {
            settingsError = message(e)
        } finally {
            savingSettings = false
        }
    }

    suspend fun setLocale(country: String, language: String) = patch(UserSettingsPatch(productCountry = country, language = language))

    // Sessions

    suspend fun loadSessions() {
        sessions = try { Loadable.Loaded(env.user.sessions()) } catch (_: Exception) { Loadable.Failed }
    }

    suspend fun revoke(id: String?) {
        revoking = id ?: "*"
        sessionsError = null
        try {
            if (id != null) env.user.revokeSession(id) else env.user.revokeOtherSessions()
            loadSessions()
        } catch (e: Exception) {
            sessionsError = message(e)
        } finally {
            revoking = null
        }
    }

    // Notifications & AI

    suspend fun loadNotifications() {
        notifications = try { Loadable.Loaded(env.user.notifications()) } catch (_: Exception) { Loadable.Failed }
    }

    suspend fun setNotification(patch: NotificationPreferencesPatch) {
        savingNotifications = true
        notificationsError = null
        try {
            notifications = Loadable.Loaded(env.user.updateNotifications(patch))
        } catch (e: Exception) {
            notificationsError = message(e)
        } finally {
            savingNotifications = false
        }
    }

    suspend fun sendExample() {
        exampleState = ExampleState.Sending
        exampleState = try {
            env.user.sendNotificationExample()
            ExampleState.Sent
        } catch (e: Exception) {
            ExampleState.Failed(message(e))
        }
    }

    suspend fun loadAi() {
        ai = try { Loadable.Loaded(env.user.aiCategorization()) } catch (_: Exception) { Loadable.Failed }
    }

    suspend fun setAi(patch: AiCategorizationPatch) {
        savingAi = true
        aiError = null
        try {
            ai = Loadable.Loaded(env.user.updateAiCategorization(patch))
            if (patch.instructions != null) instructionsSaved = true
        } catch (e: Exception) {
            aiError = message(e)
        } finally {
            savingAi = false
        }
    }

    // Data

    suspend fun loadDataSummary() {
        dataSummary = Loadable.Loading
        dataSummary = try { Loadable.Loaded(env.user.dataSummary()) } catch (_: Exception) { Loadable.Failed }
    }

    /** After a successful reauth the new session counts as recent. */
    suspend fun reauthenticated() {
        forcedReauth = false
        loadSettings()
    }

    /** Server message for validation-style errors (README §5 rule 2), else a localized generic one. */
    fun message(error: Throwable): String {
        val strings = env.session.strings()
        if (error !is ApiError) return strings.get(L10n.genericError)
        if (error is ApiError.Transport) return strings.get(R.string.connection_failed_check_your_network_and_93acb6)
        if (error.code == ApiErrorCode.ReauthRequired) forcedReauth = true
        val body = error.errorBody
        if (body != null && body.status in setOf(400, 403, 409, 422, 429, 502) && body.message != null) return body.message!!
        return strings.get(L10n.genericError)
    }
}
