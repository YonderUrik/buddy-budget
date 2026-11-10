package io.buddybudget.app.features.accounts

import io.buddybudget.app.features.help.showError

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.bbLocale
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.ShellModel
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.LocalizedStrings
import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountPatch
import io.buddybudget.core.data.AccountStatusLine
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.BankCapacity
import io.buddybudget.core.data.ConnectionAccounts
import io.buddybudget.core.data.Institution
import io.buddybudget.core.data.SyncJob
import io.buddybudget.core.domain.accounts.AccountEdits
import io.buddybudget.core.domain.accounts.AccountGroup
import io.buddybudget.core.domain.accounts.AccountGrouping
import io.buddybudget.core.domain.accounts.AccountRowStatus
import io.buddybudget.core.domain.accounts.AccountsPaths
import io.buddybudget.core.domain.accounts.AccountsText
import io.buddybudget.core.domain.accounts.BankCapacityCopy
import io.buddybudget.core.domain.accounts.BankCountries
import io.buddybudget.core.domain.accounts.BankLinkMessages
import io.buddybudget.core.domain.accounts.BankLinkReturn
import io.buddybudget.core.domain.accounts.BankUnavailableCopy
import io.buddybudget.core.domain.accounts.FoundAccounts
import io.buddybudget.core.domain.accounts.InstitutionSearch
import io.buddybudget.core.domain.accounts.ManualAccountDraft
import io.buddybudget.core.domain.accounts.ManualAccountErrors
import io.buddybudget.core.domain.accounts.RenewalAlert
import io.buddybudget.core.domain.accounts.RenewalAlerts
import io.buddybudget.core.domain.accounts.SyncJobs
import io.buddybudget.core.domain.accounts.SyncStartError
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.AccountsLaunchIntent
import io.buddybudget.core.domain.shell.AppDestination
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

/** Translates an [AccountsText] (Italian source + values; nested lists translated and joined with ", "). */
fun AccountsText.resolve(strings: LocalizedStrings): String {
    val all = values + lists.mapValues { (_, list) -> list.joinToString(", ") { it.resolve(strings) } }
    return strings.lookup(source, all)
}

@Composable
@ReadOnlyComposable
fun accountsText(text: AccountsText): String = text.resolve(LocalStrings.current)

/**
 * State of Liquidità · Conti (ACC-001…010, 032…051): accounts, background jobs and their 1 s polling, the open sheet
 * and the «Conti trovati» step. Same fields as `AccountsModel` on iOS.
 */
class AccountsModel(val env: AppEnvironment, val shell: ShellModel) {
    var accounts by mutableStateOf<Loadable<List<Account>>>(Loadable.Loading)
        private set
    var jobs by mutableStateOf<List<SyncJob>>(emptyList())
        private set
    var capacity by mutableStateOf<BankCapacity?>(null)
        private set
    /** Accounts whose «Sincronizza ora» request is in flight. */
    var syncStarting by mutableStateOf<Set<String>>(emptySet())
        private set
    /** Account shown in the detail sheet. */
    var detailId by mutableStateOf<String?>(null)
    /** New-account sheet (null = closed). */
    var newAccount by mutableStateOf<NewAccountModel?>(null)
    /** «Conti trovati» after the bank consent (null = the list). */
    var found by mutableStateOf<FoundAccountsModel?>(null)

    private val scope = MainScope()
    private var poller: Job? = null
    private var running: Set<String> = emptySet()

    val list: List<Account> get() = accounts.valueOrNull ?: emptyList()
    val groups: List<AccountGroup> get() = AccountGrouping.group(list)
    val alerts: List<RenewalAlert> get() = RenewalAlerts.build(list)
    val detail: Account? get() = detailId?.let { id -> list.firstOrNull { it.id == id } }
    val currency: String get() = env.session.currency
    private val strings: LocalizedStrings get() = env.session.strings()

    // ------------------------------------------------------------------------------------------------ Loading

    suspend fun start() {
        val a = scope.async { refresh() }
        val j = scope.async { loadJobs() }
        val c = scope.async { loadCapacity() }
        a.await(); j.await(); c.await()
    }

    fun stop() {
        poller?.cancel()
        poller = null
    }

    suspend fun refresh() {
        if (accounts.valueOrNull == null) accounts = Loadable.Loading
        accounts = try {
            Loadable.Loaded(env.accounts.list(CalendarDate.of(Instant.now(), ZoneId.systemDefault())))
        } catch (e: Exception) {
            if (accounts.valueOrNull == null) Loadable.Failed else accounts
        }
    }

    fun retry() {
        accounts = Loadable.Loading
        scope.launch { refresh() }
    }

    suspend fun loadCapacity() {
        capacity = runCatching { env.goCardless.capacity() }.getOrNull()
    }

    /** ACC-046: fetch the jobs and poll every second while one runs. */
    suspend fun loadJobs() {
        val next = runCatching { env.syncJobs.list() }.getOrNull() ?: return
        apply(next)
        if (SyncJobs.shouldPoll(next)) startPolling()
    }

    private fun apply(next: List<SyncJob>) {
        val finished = SyncJobs.finishedSince(running, next)
        running = SyncJobs.runningIds(next)
        jobs = next
        shell.syncRunning = running.isNotEmpty()
        if (finished) {
            // ACC-051: refresh what the job changed; the history charts reload too (OV-044, TX-076).
            shell.markHistoryPending()
            shell.dataChanged()
            scope.launch { refresh() }
        }
    }

    private fun startPolling() {
        if (poller?.isActive == true) return
        poller = scope.launch {
            while (isActive) {
                delay(SyncJobs.POLL_INTERVAL_MS)
                runCatching { env.syncJobs.list() }.getOrNull()?.let { apply(it) }
                if (!SyncJobs.shouldPoll(jobs)) break
            }
        }
    }

    fun isSyncing(account: Account): Boolean = SyncJobs.isSyncing(jobs, account.id)

    fun status(account: Account): AccountStatusLine = AccountRowStatus.resolve(account, isSyncing(account))

    // ------------------------------------------------------------------------------------------------ Navigation

    /** ACC-009 / ACC-010: consume the deep-link intent once. */
    fun consume(intent: AccountsLaunchIntent?) {
        intent ?: return
        shell.accountsIntent = null
        when (intent) {
            is AccountsLaunchIntent.NewAccount -> openNewAccount(false)
            is AccountsLaunchIntent.Renew -> openNewAccount(true)
        }
    }

    fun openNewAccount(renew: Boolean) {
        detailId = null
        newAccount = NewAccountModel(env, renew, capacity).also { model ->
            model.onCreated = {
                newAccount = null
                scope.launch { refresh() }
            }
            model.onLinked = { connectionId, accounts ->
                newAccount = null
                found = FoundAccountsModel(env, connectionId, accounts)
            }
            model.onNavigate = { path ->
                newAccount = null
                navigate(path)
            }
        }
    }

    /** In-app path; destinations not built yet (imports, categorize) say so. */
    fun navigate(path: String) {
        if (AppDestination.fromPath(path) == null) {
            env.toasts.show(BBToastKind.Info, strings.get(R.string.coming_soon_b13ad3))
            return
        }
        shell.open(path)
    }

    fun showMovements(account: Account) {
        detailId = null
        navigate(AccountsPaths.movements(account.id))
    }

    fun finishFound(started: Boolean) {
        found = null
        scope.launch {
            refresh()
            if (started) loadJobs()
        }
    }

    // ------------------------------------------------------------------------------------------------ Edits

    /** ACC-032…035: optimistic local update, rolled back with a toast on failure. */
    fun update(account: Account, patch: AccountPatch?) {
        patch ?: return
        val items = accounts.valueOrNull ?: return
        val previous = items.firstOrNull { it.id == account.id } ?: return
        accounts = Loadable.Loaded(items.map { if (it.id == account.id) AccountEdits.apply(patch, it) else it })
        scope.launch {
            try {
                env.accounts.update(account.id, patch)
            } catch (e: Exception) {
                accounts.valueOrNull?.let { current -> accounts = Loadable.Loaded(current.map { if (it.id == account.id) previous else it }) }
                env.toasts.show(BBToastKind.Error, message(e))
            }
        }
    }

    /** ACC-040…042: after the confirmation; the sheet closes optimistically. */
    fun remove(account: Account) {
        detailId = null
        accounts.valueOrNull?.let { items -> accounts = Loadable.Loaded(items.filter { it.id != account.id }) }
        scope.launch {
            try {
                env.accounts.delete(account.id)
            } catch (e: Exception) {
                env.toasts.show(BBToastKind.Error, message(e))
            }
            refresh()
            loadCapacity()
        }
    }

    /** ACC-043 / ACC-044. */
    fun sync(account: Account) {
        if (account.id in syncStarting) return
        syncStarting = syncStarting + account.id
        scope.launch {
            try {
                env.goCardless.syncAccount(account.id)
                loadJobs()
            } catch (e: Exception) {
                val status = (e as? ApiError.Http)?.status
                val text = SyncStartError.message(status, account.health?.nextEligibleAt, env.session.language.bbLocale, ZoneId.systemDefault())
                env.toasts.showError(text.resolve(strings), io.buddybudget.core.domain.support.ReportErrorArea.SyncBanca)
                if (status == 409) loadJobs()
            } finally {
                syncStarting = syncStarting - account.id
            }
        }
    }

    /** ACC-049. */
    fun dismiss(job: SyncJob) {
        jobs = jobs.filter { it.id != job.id }
        scope.launch { runCatching { env.syncJobs.dismiss(job.id) } }
    }

    fun message(error: Throwable): String {
        if (error is ApiError.Transport) return strings.get(R.string.connection_failed_check_your_network_and_93acb6)
        val body = (error as? ApiError)?.errorBody
        if (body?.message != null && body.status in 400..599) return body.message!!
        return strings.get(L10n.genericError)
    }

    /** DEBUG screenshots only. */
    fun debugApply(next: List<SyncJob>) {
        jobs = next
    }
}

/** The «Nuovo conto» sheet (ACC-011…022, 029…031): choice, bank picker with the native consent, manual form. */
class NewAccountModel(val env: AppEnvironment, val renew: Boolean, initialCapacity: BankCapacity?) {
    enum class Step { Choice, Bank, Manual }

    var step by mutableStateOf(if (renew) Step.Bank else Step.Choice)
    var capacity by mutableStateOf(initialCapacity)
        private set

    // Bank
    var country by mutableStateOf(BankCountries.defaultCode(env.session.bootstrap?.profile?.productCountry))
        private set
    var search by mutableStateOf("")
    var institutions by mutableStateOf<Loadable<List<Institution>>>(Loadable.Loading)
        private set
    var chosen by mutableStateOf<Institution?>(null)
        private set
    var linkError by mutableStateOf<String?>(null)
        private set

    // Manual
    var manualStep by mutableStateOf(0)
    var draft by mutableStateOf(ManualAccountDraft())
    var errors by mutableStateOf(ManualAccountErrors())
        private set
    var creating by mutableStateOf(false)
        private set
    var createError by mutableStateOf<String?>(null)
        private set

    var onCreated: () -> Unit = {}
    var onLinked: (String, ConnectionAccounts) -> Unit = { _, _ -> }
    var onNavigate: (String) -> Unit = {}

    private val scope = MainScope()
    private var institutionsJob: Job? = null
    /** DEBUG fixtures must not be replaced by a real load. */
    private var debugFrozen = false
    private val strings: LocalizedStrings get() = env.session.strings()

    val unavailable: BankUnavailableCopy? get() = if (renew) null else BankCapacityCopy.unavailable(capacity)
    val busy: Boolean get() = chosen != null
    val filtered: List<Institution> get() = InstitutionSearch.filter(institutions.valueOrNull ?: emptyList(), search)

    /** ACC-012: capacity is checked when the sheet opens (not in renewal mode, ACC-014). */
    suspend fun start() {
        if (!renew) capacity = runCatching { env.goCardless.capacity() }.getOrNull() ?: capacity
        if (step == Step.Bank && institutions.valueOrNull == null && !debugFrozen) loadInstitutions()
    }

    fun choose(next: Step) {
        step = next
        if (next == Step.Bank && institutions.valueOrNull == null) loadInstitutions()
        if (next == Step.Manual) {
            manualStep = 0
            errors = ManualAccountErrors()
        }
    }

    // ------------------------------------------------------------------------------------------------ Bank

    fun updateCountry(code: String) {
        if (code == country) return
        country = code
        search = ""
        loadInstitutions()
    }

    fun loadInstitutions() {
        institutionsJob?.cancel()
        institutions = Loadable.Loading
        val code = country
        institutionsJob = scope.launch {
            val result = runCatching { env.goCardless.institutions(code) }
            if (code != country) return@launch
            institutions = result.getOrNull()?.let { Loadable.Loaded(it) } ?: Loadable.Failed
        }
    }

    /** ACC-021 / ACC-022 and the R6 return: start → Custom Tab → complete → «Conti trovati». */
    fun select(context: Context, institution: Institution) {
        if (chosen != null) return
        linkError = null
        chosen = institution
        scope.launch {
            try {
                val start = env.goCardless.startConnection(institution)
                val callback = BankBrowser.authenticate(context, start.link)
                val outcome = callback?.let(BankLinkReturn::parse)
                val connectionId = outcome?.ref ?: start.connectionId ?: return@launch fail(BankLinkMessages.NOT_FOUND)
                when (outcome?.status) {
                    BankLinkReturn.Status.InvalidRef -> return@launch fail(BankLinkMessages.NOT_FOUND)
                    BankLinkReturn.Status.Cancelled -> {
                        chosen = null
                        env.toasts.show(BBToastKind.Info, strings.lookup(BankLinkMessages.CANCELLED))
                        return@launch
                    }
                    else -> complete(connectionId, closedEarly = outcome == null)
                }
            } catch (e: Exception) {
                failWith(e)
            }
        }
    }

    private suspend fun complete(connectionId: String, closedEarly: Boolean) {
        try {
            val done = env.goCardless.complete(connectionId)
            chosen = null
            onLinked(connectionId, done.accounts)
        } catch (e: Exception) {
            val http = e as? ApiError.Http
            if (closedEarly && http?.status == 409) {
                // The tab was closed before the bank answered: nothing to complete yet.
                chosen = null
                env.toasts.show(BBToastKind.Info, strings.lookup(BankLinkMessages.CANCELLED))
                return
            }
            if (e is ApiError.Transport) return failWith(e)
            fail(BankLinkMessages.completeError(http?.status, http?.body?.message))
        }
    }

    private fun fail(source: String) {
        chosen = null
        linkError = strings.lookup(source)
    }

    private fun failWith(error: Exception) {
        chosen = null
        linkError = when {
            error is ApiError.Transport -> strings.get(R.string.connection_failed_check_your_network_and_93acb6)
            error is ApiError -> error.errorBody?.message ?: strings.lookup("Impossibile avviare il collegamento con la banca")
            else -> strings.get(L10n.genericError)
        }
    }

    // ------------------------------------------------------------------------------------------------ Manual

    fun next() {
        errors = draft.validateNameAndType()
        if (errors.isEmpty) manualStep = 1
    }

    fun back() {
        errors = ManualAccountErrors()
        createError = null
        if (manualStep == 0) step = Step.Choice else manualStep = 0
    }

    /** ACC-030 / ACC-031. */
    fun create() {
        errors = draft.validateBalance()
        val request = draft.request()
        if (!errors.isEmpty || request == null || creating) return
        creating = true
        createError = null
        scope.launch {
            try {
                env.accounts.create(request)
                onCreated()
            } catch (e: Exception) {
                createError = if (e is ApiError.Transport) strings.get(R.string.connection_failed_check_your_network_and_93acb6)
                else (e as? ApiError)?.errorBody?.message ?: strings.get(L10n.genericError)
            } finally {
                creating = false
            }
        }
    }

    /** DEBUG screenshots only. */
    fun debugSet(list: List<Institution>?, error: String? = null) {
        debugFrozen = true
        institutionsJob?.cancel()
        institutions = list?.let { Loadable.Loaded(it) } ?: Loadable.Failed
        linkError = error
    }
}

/** «Conti trovati» (ACC-023…028): pick the shared accounts and how to import them. */
class FoundAccountsModel(val env: AppEnvironment, val connectionId: String, initial: ConnectionAccounts?) {
    var accounts by mutableStateOf<Loadable<ConnectionAccounts>>(initial?.let { Loadable.Loaded(it) } ?: Loadable.Loading)
        private set
    var selected by mutableStateOf<Set<String>>(emptySet())
        private set
    /** External account id → existing linked account to re-link to (absent = new account). */
    var targets by mutableStateOf<Map<String, String>>(emptyMap())
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var finalizing by mutableStateOf(false)
        private set

    private val strings: LocalizedStrings get() = env.session.strings()

    suspend fun load() {
        if (accounts.valueOrNull != null) return
        accounts = Loadable.Loading
        accounts = runCatching { env.goCardless.connectionAccounts(connectionId) }.getOrNull()?.let { Loadable.Loaded(it) } ?: Loadable.Failed
    }

    fun toggle(id: String) {
        selected = if (id in selected) selected - id else selected + id
        error = null
    }

    fun setTarget(id: String, existing: String?) {
        targets = if (existing == null) targets - id else targets + (id to existing)
    }

    /** ACC-025 / ACC-026: true when the import started. */
    suspend fun confirm(): Boolean {
        val data = accounts.valueOrNull ?: return false
        if (finalizing) return false
        val selections = FoundAccounts.selections(data.externalAccounts, selected, targets)
        if (selections.isEmpty()) {
            error = strings.lookup(FoundAccounts.EMPTY_SELECTION_ERROR)
            return false
        }
        finalizing = true
        error = null
        return try {
            env.goCardless.finalize(connectionId, selections)
            true
        } catch (e: Exception) {
            error = when (e) {
                is ApiError.Transport -> strings.get(R.string.connection_failed_check_your_network_and_93acb6)
                is ApiError -> e.errorBody?.message?.let { strings.lookup(it) } ?: strings.get(L10n.genericError)
                else -> strings.get(L10n.genericError)
            }
            false
        } finally {
            finalizing = false
        }
    }
}
