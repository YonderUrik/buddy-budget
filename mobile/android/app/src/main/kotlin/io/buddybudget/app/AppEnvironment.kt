package io.buddybudget.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import android.os.Build
import io.buddybudget.app.designsystem.components.PrivacyStore
import io.buddybudget.app.designsystem.components.ToastCenter
import io.buddybudget.core.data.AccountsApi
import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.AttentionApi
import io.buddybudget.core.data.AuthApi
import io.buddybudget.core.data.GoalsApi
import io.buddybudget.core.data.GoCardlessApi
import io.buddybudget.core.data.HealthApi
import io.buddybudget.core.data.LegalApi
import io.buddybudget.core.data.LogoLoader
import io.buddybudget.core.data.MeApi
import io.buddybudget.core.data.OverviewApi
import io.buddybudget.core.data.SidebarApi
import io.buddybudget.core.data.StartApi
import io.buddybudget.core.data.SubscriptionsApi
import io.buddybudget.core.data.SyncJobsApi
import io.buddybudget.core.data.UserApi
import io.buddybudget.core.data.WhatsNewApi
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Manual dependency container. Same name and role as `AppEnvironment` in the iOS app
 * (spec: platform/architecture.md), so features are wired identically on both platforms.
 */
class AppEnvironment(val context: Context, val api: ApiClient, val preferences: DevicePreferences, val logoLoader: LogoLoader) {
    val health = HealthApi(api)
    val auth = AuthApi(api)
    val me = MeApi(api)
    val legalApi = LegalApi(api)
    val user = UserApi(api)
    val attention = AttentionApi(api)
    val overview = OverviewApi(api)
    val start = StartApi(api)
    val whatsNew = WhatsNewApi(api)
    val welcome = io.buddybudget.core.data.WelcomeApi(api)
    val sidebar = SidebarApi(api)
    val goals = GoalsApi(api)
    val analytics = io.buddybudget.core.data.AnalyticsApi(api)
    val subscriptions = SubscriptionsApi(api)
    val accounts = AccountsApi(api)
    val goCardless = GoCardlessApi(api)
    val syncJobs = SyncJobsApi(api)
    val transactions = io.buddybudget.core.data.TransactionsApi(api)
    val liquidityApi = io.buddybudget.core.data.LiquidityApi(api)
    val categoriesApi = io.buddybudget.core.data.CategoriesApi(api)
    val budgets = io.buddybudget.core.data.BudgetsApi(api)
    val rulesApi = io.buddybudget.core.data.CategorizationRulesApi(api)
    val investments = io.buddybudget.core.data.InvestmentsApi(api)
    val instruments = io.buddybudget.core.data.InstrumentsApi(api)
    val debts = io.buddybudget.core.data.DebtsApi(api)
    val pension = io.buddybudget.core.data.PensionApi(api)
    val personalImports = io.buddybudget.core.data.PersonalImportsApi(api)
    val brokerImports = io.buddybudget.core.data.BrokerImportApi(api)
    /** A file or link handed to the app from outside (share sheet, «Apri con», email links); the shell consumes it. */
    var incoming by androidx.compose.runtime.mutableStateOf<IncomingItem?>(null)
    val planning = io.buddybudget.core.data.FinancialPlanningApi(api)
    val toasts = ToastCenter()
    val privacy = PrivacyStore()
    val session = SessionModel(this)
    /** «Scrivici» / «Segnala questo problema» (16-help-support). */
    val quickReport = io.buddybudget.app.features.help.QuickReportCenter(io.buddybudget.core.data.SupportApi(api))
    /** SUP-024: screen failures reported once to `POST /api/client-errors`. */
    val clientErrors = io.buddybudget.core.data.ClientErrorReporter(io.buddybudget.core.data.ClientErrorsApi(api))
    private val reportScope = kotlinx.coroutines.MainScope()

    init {
        toasts.reportAction = { error -> quickReport.open(io.buddybudget.core.domain.support.ReportSource.Errore, error) }
        toasts.reportLabel = { session.strings().lookup("Segnala") }
        // SUP-024/025: a response the screen cannot read is the native «page did not render»; best effort, silent.
        api.events.setOnDecodingFailure { endpoint ->
            reportScope.launch {
                if (api.session.readToken() == null) return@launch
                clientErrors.report(io.buddybudget.core.domain.support.ClientErrorReport.decodingFailure(quickReport.currentPath(), endpoint))
            }
        }
    }

    companion object {
        fun live(context: Context): AppEnvironment {
            val http = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS)
                .build()
            val preferences = DevicePreferences(context)
            val store = KeystoreSessionStore(context)
            val holder = arrayOfNulls<AppEnvironment>(1)
            val api = ApiClient(
                BuildConfig.API_BASE_URL, http, store,
                userAgent = AppVersion.userAgent,
                acceptLanguage = { holder[0]?.session?.language?.code },
            )
            val logos = LogoLoader(BuildConfig.API_BASE_URL, LogoLoader.makeClient(http, File(context.cacheDir, "logos"))) {
                store.readToken()
            }
            return AppEnvironment(context, api, preferences, logos).also { holder[0] = it }
        }
    }
}

/** App version shown in «Altro» and Impostazioni (SHELL-026 native: version name + version code). */
object AppVersion {
    val version: String get() = BuildConfig.VERSION_NAME
    val build: String get() = BuildConfig.VERSION_CODE.toString()

    /** `v0.1.0 (1)`. */
    val label: String get() = "v$version ($build)"

    /** `BuddyBudget-Android/0.1.0 (Pixel 8; Android 16)` (api/README.md §4, shown in Settings › Sessions). */
    val userAgent: String get() = "BuddyBudget-Android/$version (${Build.MODEL}; Android ${Build.VERSION.RELEASE})"
}

/** What another app or the system handed to BuddyBudget. Twin of iOS `IncomingItem`. */
sealed interface IncomingItem {
    /** In-app path from a link (`/importazioni?job=…`). */
    data class Link(val path: String) : IncomingItem
    /** Files shared to the app (CSV / Excel), routed to the right import flow. */
    class Files(val files: List<io.buddybudget.app.features.imports.PickedFile>) : IncomingItem
}
