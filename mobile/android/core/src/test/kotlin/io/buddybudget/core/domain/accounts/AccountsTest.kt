package io.buddybudget.core.domain.accounts

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountHealth
import io.buddybudget.core.data.AccountListSerializer
import io.buddybudget.core.data.AccountPatch
import io.buddybudget.core.data.AccountSource
import io.buddybudget.core.data.AccountStatusLine
import io.buddybudget.core.data.AccountStatusTone
import io.buddybudget.core.data.AccountsApi
import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.BankCapacity
import io.buddybudget.core.data.BankCapacityReason
import io.buddybudget.core.data.ConnectionCompletion
import io.buddybudget.core.data.ExternalBankAccount
import io.buddybudget.core.data.GoCardlessApi
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.Institution
import io.buddybudget.core.data.NewAccountRequest
import io.buddybudget.core.data.SyncAccountPhase
import io.buddybudget.core.data.SyncJob
import io.buddybudget.core.data.SyncJobAccount
import io.buddybudget.core.data.SyncJobKind
import io.buddybudget.core.data.SyncJobStatus
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.liquidity.ConnectionHealth
import io.buddybudget.core.domain.liquidity.ConnectionHealthState
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.fixture
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import java.time.ZoneId
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Liquidità · Conti (spec: features/04-accounts-bank-sync.md) with the spec fixtures. Twin: AccountsTests.swift.

private val json = ApiClient.DefaultJson
private val utc = ZoneId.of("UTC")

private fun accountsFixture(): List<Account> = json.decodeFromString(AccountListSerializer, fixture("accounts-include.json"))

/** `gocardless-native-flow.json` (copied to test resources until the spec submodule is bumped). */
private fun nativeFlow(vararg path: String): JsonElement {
    val text = AccountsTest::class.java.getResource("/fixtures/gocardless-native-flow.json")!!.readText()
    var value: JsonElement = Json.parseToJsonElement(text)
    for (key in path) value = value.jsonObject.getValue(key)
    return value
}

private fun linked(id: String, bank: String?, health: AccountHealth? = null, balance: Double = 10.0) =
    Account(id, id, "Conto corrente", balance, source = AccountSource.Auto, bankName = bank, health = health)

private fun health(
    connection: String, state: ConnectionHealthState, days: Int? = null, eligible: Boolean = false, next: String? = null,
    remaining: Int = 2, bank: String = "Fineco",
) = AccountHealth(connection, bank, state, ConnectionHealth.needsRenewal(state), days, eligible = eligible, nextEligibleAt = next,
    syncsRemainingToday = remaining)

class AccountsTest {
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()

    @AfterTest fun tearDown() = server.close()

    private fun client() = ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore("t"), acceptLanguage = { "it" })

    private fun reply(body: String, code: Int = 200) = server.enqueue(MockResponse.Builder().code(code).body(body).build())

    private fun sentBody(): JsonElement = Json.parseToJsonElement(server.takeRequest().body!!.utf8())

    // ------------------------------------------------------------------------------------------------ Data

    @Test fun ACC001_decodesAccountsWithExtras() = runTest {
        reply(fixture("accounts-include.json"))
        val accounts = AccountsApi(client()).list(CalendarDate(2026, 10, 18))
        val request = server.takeRequest()
        assertEquals("trend,health", request.url.queryParameter("include"))
        assertEquals("2026-10-18", request.url.queryParameter("today"))
        val linkedAccount = accounts.first { it.isLinked }
        assertEquals(5050.34, linkedAccount.balance)
        assertEquals("Banca Demo", linkedAccount.bankName)
        assertEquals(31, linkedAccount.trend?.size)
        assertEquals(ConnectionHealthState.EXPIRING, linkedAccount.health?.state)
        assertEquals(6, linkedAccount.health?.daysLeft)
        assertEquals(AccountStatusLine(AccountStatusTone.Warning, "Da riconnettere"), linkedAccount.status)
        assertEquals("Aggiornato da te", accounts.first { !it.isLinked }.status?.label)
    }

    @Test fun ACC001_decodesRawAccountsWithoutExtras() {
        val accounts = json.decodeFromString(AccountListSerializer, fixture("accounts.json"))
        assertTrue(accounts.isNotEmpty())
        assertTrue(accounts.all { it.status == null && it.health == null })
    }

    @Test fun ACC030_createSendsNumbersAndAppearance() = runTest {
        reply("""{"id":"a","name":"Contanti","type":"Contanti","balance":"150.00","color":"green","icon":"banknote","source":"manuale"}""", 201)
        val created = AccountsApi(client()).create(NewAccountRequest("Contanti", "Contanti", -20.5, "green", "banknote"))
        assertEquals(150.0, created.balance)
        assertEquals(
            Json.parseToJsonElement("""{"name":"Contanti","type":"Contanti","balance":-20.5,"color":"green","icon":"banknote"}"""),
            sentBody(),
        )
    }

    @Test fun ACC035_patchSendsOnlySetFields() = runTest {
        reply("""{"id":"a","name":"Nuovo","type":"x","balance":1,"source":"auto"}""")
        AccountsApi(client()).update("a", AccountPatch(name = "Nuovo"))
        val request = server.takeRequest()
        assertEquals("PATCH", request.method)
        assertEquals(Json.parseToJsonElement("""{"name":"Nuovo"}"""), Json.parseToJsonElement(request.body!!.utf8()))
    }

    @Test fun ACC021_startsNativeConnection() = runTest {
        reply(nativeFlow("start", "body").toString())
        val start = GoCardlessApi(client()).startConnection(Institution("SANDBOXFINANCE_SFIN0000", "Sandbox Finance", "90"))
        assertEquals("3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", start.connectionId)
        assertEquals(nativeFlow("start", "request", "body"), sentBody())
    }

    @Test fun ACC023_completeReturnsAccountsToSelect() = runTest {
        reply(nativeFlow("complete", "body").toString())
        val done = GoCardlessApi(client()).complete("3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b")
        assertEquals("/api/gocardless/connections/3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b/complete", server.takeRequest().url.encodedPath)
        assertEquals("linked", done.status)
        assertEquals(2, done.accounts.externalAccounts.size)
        assertEquals("Conto corrente", done.accounts.existingAutoAccounts.first().name)
    }

    @Test fun ACC026_finalizeBodyMatchesContract() = runTest {
        val done = json.decodeFromString(ConnectionCompletion.serializer(), nativeFlow("complete", "body").toString())
        val accounts = done.accounts.externalAccounts
        val selections = FoundAccounts.selections(
            accounts, accounts.map { it.externalAccountId }.toSet(),
            mapOf(accounts[1].externalAccountId to "1d7e4c2b-5a6f-4b8c-9d0e-1f2a3b4c5d6e"),
        )
        reply("""{"jobId":"7c2e9f1a-3b4d-4e5f-8a6b-7c8d9e0f1a2b"}""", 201)
        val job = GoCardlessApi(client()).finalize(done.connectionId, selections)
        assertEquals("7c2e9f1a-3b4d-4e5f-8a6b-7c8d9e0f1a2b", job.jobId)
        assertEquals(nativeFlow("finalize", "request", "body"), sentBody())
    }

    @Test fun ACC012_decodesCapacityAndInstitutions() {
        val capacity = json.decodeFromString(BankCapacity.serializer(), """{"canConnectNew":false,"reason":"user_attempts","renewableInstitutionIds":[]}""")
        assertEquals(BankCapacityReason.UserAttempts, capacity.reason)
        val banks = json.decodeFromString(
            ListSerializer(Institution.serializer()),
            """[{"id":"A","name":"Fineco","transaction_total_days":"730","logo":"https://x/a.png"},{"id":"B","name":"N26","transaction_total_days":540}]""",
        )
        assertEquals(listOf("730", "540"), banks.map { it.transactionTotalDays })
    }

    @Test fun ACC046_decodesSyncJobs() {
        val text = """[{"id":"j","userId":"u","kind":"initial-import","status":"running","dismissed":false,"startedAt":"2026-10-18T09:30:00.000Z","updatedAt":"2026-10-18T09:30:12.000Z","interrupted":false,"accounts":[{"accountId":"1","name":"Conto Fineco","phase":"saving","total":412,"processed":200,"inserted":198,"categorized":150,"uncategorized":48},{"accountId":"2","name":"Risparmio","phase":"error","total":null,"processed":0,"inserted":0,"categorized":0,"uncategorized":0,"errorReason":"already-running"}]}]"""
        val jobs = json.decodeFromString(ListSerializer(SyncJob.serializer()), text)
        assertEquals(SyncJobKind.InitialImport, jobs[0].kind)
        assertEquals("already-running", jobs[0].accounts[1].errorReason)
        assertTrue(SyncJobs.shouldPoll(jobs))
        assertTrue(SyncJobs.isSyncing(jobs, "1"))
        assertFalse(SyncJobs.isSyncing(jobs, "2"))
        assertEquals(SyncBar.Determinate(200.0, 412.0), SyncJobs.overallProgress(jobs[0]))
        assertFalse(SyncJobs.shouldPoll(emptyList()))
    }

    // ------------------------------------------------------------------------------------------------ Grouping & status

    @Test fun ACC001_groupsByBankAlphabeticallyThenManual() {
        val accounts = accountsFixture()
        val groups = AccountGrouping.group(accounts)
        assertEquals(listOf("Banca Demo", "Manuali"), groups.map { it.label })
        assertEquals("Li aggiorni tu", groups[1].hint)
        assertEquals("Si aggiorna da solo", groups[0].hint)
        assertEquals(accounts.filter { !it.isLinked }.sumOf { it.balance }, groups[1].total)

        val mixed = listOf(linked("z", "Zeta"), linked("u", null), linked("a", "Àlfa"), linked("b", "Zeta"))
        assertEquals(listOf("Àlfa", "Banca collegata", "Zeta"), AccountGrouping.group(mixed).map { it.label })
        assertEquals(listOf("z", "b"), AccountGrouping.group(mixed).last().accounts.map { it.id })
    }

    @Test fun ACC003_statusPrecedence() {
        val manual = Account("m", "m", "Contanti", 1.0)
        assertEquals("Aggiornato da te", AccountRowStatus.resolve(manual, true).label)
        val renew = linked("r", "B", health("c", ConnectionHealthState.EXPIRED))
        assertEquals(AccountStatusLine(AccountStatusTone.Warning, "Da riconnettere"), AccountRowStatus.resolve(renew, true))
        val ok = Account("o", "o", "x", 1.0, source = AccountSource.Auto, health = health("c", ConnectionHealthState.OK),
            status = AccountStatusLine(AccountStatusTone.Ok, "Aggiornato 3 ore fa"))
        assertEquals(AccountStatusTone.Progress, AccountRowStatus.resolve(ok, true).tone)
        assertEquals("Aggiornato 3 ore fa", AccountRowStatus.resolve(ok, false).label)
    }

    // ------------------------------------------------------------------------------------------------ Renewal

    @Test fun ACC007_renewalAlertsOnePerConnectionUrgentFirst() {
        val accounts = listOf(
            linked("1", "A", health("c1", ConnectionHealthState.EXPIRING, days = 1, bank = "Fineco")),
            linked("2", "A", health("c1", ConnectionHealthState.EXPIRING, days = 1, bank = "Fineco")),
            linked("3", "B", health("c2", ConnectionHealthState.ERROR, bank = "Intesa")),
            linked("4", "C", health("c3", ConnectionHealthState.OK, days = 40, bank = "N26")),
        )
        val alerts = RenewalAlerts.build(accounts)
        assertEquals(listOf("c2", "c1"), alerts.map { it.connectionId })
        assertEquals(AccountsText("Il collegamento con {0} non è andato a buon fine.", mapOf("0" to "Intesa")), RenewalAlerts.message(alerts[0]))
        assertEquals(AccountsText("Il collegamento con {0} scade domani.", mapOf("0" to "Fineco")), RenewalAlerts.message(alerts[1]))
        val six = RenewalAlert("x", "Banca Demo", ConnectionHealthState.EXPIRING, 6)
        assertEquals(AccountsText("Il collegamento con {0} scade tra {1} giorni.", mapOf("0" to "Banca Demo", "1" to "6")), RenewalAlerts.message(six))
        val expired = RenewalAlert("x", "N26", ConnectionHealthState.EXPIRED, null)
        assertEquals("Il collegamento con {0} è scaduto: i conti non si aggiornano.", RenewalAlerts.message(expired).source)
    }

    @Test fun ACC008_fixtureLinkedAccountNeedsRenewal() {
        val alerts = RenewalAlerts.build(accountsFixture())
        assertEquals(1, alerts.size)
        assertEquals(6, alerts[0].daysLeft)
        assertEquals("Banca Demo", alerts[0].institutionName)
    }

    // ------------------------------------------------------------------------------------------------ Manual form

    @Test fun ACC029_manualFormValidation() {
        var draft = ManualAccountDraft()
        assertEquals("Dai un nome al conto, per riconoscerlo nell'elenco.", draft.validateNameAndType().name)
        draft = draft.copy(name = "  Conto Intesa ", typePreset = null)
        assertEquals(ManualAccountErrors(type = "Scrivi di che tipo di conto si tratta."), draft.validateNameAndType())
        draft = draft.copy(customType = "Wallet crypto")
        assertTrue(draft.validateNameAndType().isEmpty)
        draft = draft.copy(balanceText = "")
        assertEquals("Inserisci il saldo di oggi (anche 0).", draft.validateBalance().balance)
        draft = draft.copy(balanceText = "-12,5")
        assertEquals(NewAccountRequest("Conto Intesa", "Wallet crypto", -12.5, "slate", "wallet"), draft.request())
        assertEquals(0.0, draft.copy(balanceText = "0").request()?.balance)
        assertEquals(80, ManualAccountDraft.clampName("a".repeat(90)).length)
        assertEquals(30, AccountOptions.icons.size)
        assertEquals(16, AccountOptions.colors.size)
    }

    // ------------------------------------------------------------------------------------------------ Detail edits

    @Test fun ACC032_renameOnlyWhenChangedAndNotEmpty() {
        val a = Account("a", "Conto", "Contanti", 10.0)
        assertNull(AccountEdits.rename(a, "  "))
        assertNull(AccountEdits.rename(a, "Conto "))
        assertEquals(AccountPatch(name = "Cassa"), AccountEdits.rename(a, " Cassa "))
    }

    @Test fun ACC034_manualTypeAndBalanceEdits() {
        val a = Account("a", "Conto", "Contanti", 10.0)
        assertNull(AccountEdits.retype(a, "Contanti"))
        assertEquals(AccountPatch(type = "Conto deposito"), AccountEdits.retype(a, "Conto deposito"))
        assertNull(AccountEdits.rebalance(a, "10"))
        assertNull(AccountEdits.rebalance(a, "abc"))
        assertEquals(AccountPatch(balance = -3.25), AccountEdits.rebalance(a, "-3,25"))
    }

    @Test fun ACC035_linkedNeverSendsTypeOrBalance() {
        val a = linked("l", "B")
        assertNull(AccountEdits.retype(a, "Altro"))
        assertNull(AccountEdits.rebalance(a, "99"))
        assertEquals(AccountPatch(color = "blue", icon = "wallet"), AccountEdits.appearance(a, "blue", "wallet"))
    }

    @Test fun ACC040_removalCopyMentionsMovements() {
        val manual = AccountRemoval.copy(Account("a", "Cassa", "Contanti", 1.0))
        assertEquals("Eliminare questo conto?", manual.title)
        assertEquals("Elimina", manual.confirm)
        assertTrue(manual.message.source.contains("movimenti"))
        assertEquals(mapOf("0" to "Cassa"), manual.message.values)
        val unlink = AccountRemoval.copy(linked("l", "B"))
        assertEquals("Scollegare questo conto?", unlink.title)
        assertEquals("Scollega", unlink.confirm)
        assertTrue(unlink.message.source.contains("movimenti"))
    }

    // ------------------------------------------------------------------------------------------------ Sync availability & errors

    @Test fun ACC036_syncAvailabilitySentence() {
        val next = "2026-10-18T15:55:23.447Z"
        fun s(h: AccountHealth?, syncing: Boolean = false) = SyncAvailability.sentence(h, syncing, BBLocale.IT_IT, utc)
        assertEquals("Sincronizzazione in corso.", s(health("c", ConnectionHealthState.OK), syncing = true).source)
        assertEquals("Riconnetti la banca per sincronizzare.", s(health("c", ConnectionHealthState.EXPIRED)).source)
        assertEquals("Informazioni di sincronizzazione non disponibili.", s(null).source)
        assertEquals("Puoi sincronizzare adesso.", s(health("c", ConnectionHealthState.OK, eligible = true)).source)
        assertEquals("Sincronizzazione non disponibile.", s(health("c", ConnectionHealthState.OK)).source)
        assertEquals(
            AccountsText("Hai raggiunto il limite di {0} sincronizzazioni al giorno. Prossima alle {1}.", mapOf("0" to "4", "1" to "15:55")),
            s(health("c", ConnectionHealthState.OK, next = next, remaining = 0)),
        )
        assertEquals(
            AccountsText("Prossima sincronizzazione disponibile alle {0}.", mapOf("0" to "15:55")),
            s(health("c", ConnectionHealthState.OK, next = next, remaining = 2)),
        )
    }

    @Test fun ACC037_syncButtonEnablement() {
        assertTrue(SyncAvailability.canSync(health("c", ConnectionHealthState.OK, eligible = true), false, false))
        assertFalse(SyncAvailability.canSync(health("c", ConnectionHealthState.OK, eligible = true), true, false))
        assertFalse(SyncAvailability.canSync(health("c", ConnectionHealthState.OK, eligible = true), false, true))
        assertFalse(SyncAvailability.canSync(health("c", ConnectionHealthState.EXPIRING, eligible = true), false, false))
        assertFalse(SyncAvailability.canSync(health("c", ConnectionHealthState.OK), false, false))
        assertFalse(SyncAvailability.canSync(null, false, false))
    }

    @Test fun ACC044_syncStartErrorMessages() {
        fun m(status: Int?, next: String? = null) = SyncStartError.message(status, next, BBLocale.IT_IT, utc).source
        assertEquals(
            AccountsText("Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {0}.", mapOf("0" to "10:00")),
            SyncStartError.message(429, "2026-10-18T10:00:00.000Z", BBLocale.IT_IT, utc),
        )
        assertEquals("Sync non disponibile al momento. Riprova più tardi.", m(429))
        assertEquals("Sincronizzazione già in corso per questo conto.", m(409))
        assertEquals("Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.", m(503))
        assertEquals("Conto non trovato o non collegato", m(404))
        assertEquals("Impossibile completare la sincronizzazione. Riprova più tardi.", m(500))
        assertEquals("Impossibile completare la sincronizzazione. Riprova più tardi.", m(null))
    }

    // ------------------------------------------------------------------------------------------------ Job texts

    @Test fun ACC047_phaseTexts() {
        fun d(
            phase: SyncAccountPhase, total: Int? = null, processed: Int = 0, interrupted: Boolean = false, reason: String? = null,
        ) = SyncJobs.describe(SyncJobAccount.of("a", "A", phase, total, processed, errorReason = reason), interrupted)
        assertEquals("In attesa", d(SyncAccountPhase.Queued).text.source)
        assertEquals(SyncBar.None, d(SyncAccountPhase.Queued).bar)
        assertEquals("Aggiorno il saldo…", d(SyncAccountPhase.Balance).text.source)
        assertEquals(SyncBar.Indeterminate, d(SyncAccountPhase.Balance).bar)
        assertEquals("Scarico i movimenti dalla banca…", d(SyncAccountPhase.Fetching).text.source)
        val saving = d(SyncAccountPhase.Saving, total = 412, processed = 200)
        assertEquals(AccountsText("Importati {0} di {1} movimenti", mapOf("0" to "200", "1" to "412")), saving.text)
        assertEquals(SyncBar.Determinate(200.0, 412.0), saving.bar)
        assertEquals("Importati {0} di {1} movimento", d(SyncAccountPhase.Saving, total = 1).text.source)
        assertEquals("Nessuna nuova transazione trovata. Saldo aggiornato.", d(SyncAccountPhase.Done).text.source)
        assertEquals(SyncTone.Success, d(SyncAccountPhase.Done).tone)
        assertEquals(SyncTone.Error, d(SyncAccountPhase.Limited).tone)
        assertEquals("Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.", d(SyncAccountPhase.Expired).text.source)
        assertEquals("Sincronizzazione già in corso per questo conto.", d(SyncAccountPhase.Error, reason = "already-running").text.source)
        assertEquals("Sincronizzazione non riuscita. Riprova più tardi.", d(SyncAccountPhase.Error).text.source)
    }

    @Test fun ACC048_interruptedText() {
        val account = SyncJobAccount.of("a", "A", SyncAccountPhase.Error)
        assertEquals(
            "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.",
            SyncJobs.describe(account, true).text.source,
        )
        val job = SyncJob.of("j", SyncJobStatus.Failed, listOf(account), interrupted = true)
        assertEquals("Sincronizzazione interrotta", SyncJobs.title(job).source)
        assertTrue(SyncJobs.isFinished(job) && SyncJobs.hasErrors(job))
    }

    @Test fun ACC047_summaryAndTitles() {
        assertEquals("{0} nuova transazione. Saldo aggiornato.", SyncJobs.summary(1, 0, 0).source)
        val many = SyncJobs.summary(12, 1, 3)
        assertEquals("{0} nuove transazioni ({1}). Saldo aggiornato.", many.source)
        assertEquals(
            listOf(AccountsText("{0} categorizzata da sola", mapOf("0" to "1")), AccountsText("{0} da decidere", mapOf("0" to "3"))),
            many.lists["1"],
        )
        val a = SyncJobAccount.of("a", "A", SyncAccountPhase.Fetching)
        assertEquals(AccountsText("Sincronizzazione in corso · {0} conto", mapOf("0" to "1")), SyncJobs.title(SyncJob.of("j", SyncJobStatus.Running, listOf(a))))
        assertEquals("Sincronizzazione in corso · {0} conti", SyncJobs.title(SyncJob.of("j", SyncJobStatus.Running, listOf(a, a))).source)
        assertEquals("Sincronizzazione completata", SyncJobs.title(SyncJob.of("j", SyncJobStatus.Done, listOf(a))).source)
        assertEquals("Sincronizzazione non riuscita", SyncJobs.title(SyncJob.of("j", SyncJobStatus.Failed, listOf(a))).source)
    }

    @Test fun ACC050_ACC051_finishedJobsAndCategorize() {
        val running = SyncJob.of("j", SyncJobStatus.Running, listOf(SyncJobAccount.of("a", "A", SyncAccountPhase.Saving, total = 3)))
        val previous = SyncJobs.runningIds(listOf(running))
        val done = SyncJob.of("j", SyncJobStatus.Done, listOf(SyncJobAccount.of("a", "A", SyncAccountPhase.Done, uncategorized = 2)))
        assertTrue(SyncJobs.finishedSince(previous, listOf(done)))
        assertFalse(SyncJobs.finishedSince(previous, listOf(running)))
        assertEquals(2, SyncJobs.uncategorized(done))
    }

    // ------------------------------------------------------------------------------------------------ Bank picker

    @Test fun ACC013_capacityCopyPerReason() {
        assertNull(BankCapacityCopy.unavailable(BankCapacity.of(true, null)))
        assertEquals("Una per persona", BankCapacityCopy.unavailable(BankCapacity.of(false, BankCapacityReason.UserLimit))?.badge)
        assertEquals("Più avanti", BankCapacityCopy.unavailable(BankCapacity.of(false, BankCapacityReason.UserAttempts))?.badge)
        assertEquals("In arrivo", BankCapacityCopy.unavailable(BankCapacity.of(false, BankCapacityReason.ProviderLimit))?.badge)
        assertEquals("In arrivo", BankCapacityCopy.unavailable(BankCapacity.of(false, BankCapacityReason.GlobalLimit))?.badge)
    }

    @Test fun ACC017_countriesDefaultToProductCountry() {
        assertEquals(listOf("IT", "DE", "FR", "ES", "GB"), BankCountries.all.map { it.code })
        assertEquals("DE", BankCountries.defaultCode("DE"))
        assertEquals("IT", BankCountries.defaultCode(null))
        assertEquals("🇮🇹", BankCountries.all[0].flag)
    }

    @Test fun ACC018_institutionSearch() {
        val banks = listOf(Institution("1", "Intesa Sanpaolo", "540"), Institution("2", "FinecoBank", "730"), Institution("3", "N26", ""))
        assertEquals(listOf("2"), InstitutionSearch.filter(banks, "  FINE ").map { it.id })
        assertEquals(3, InstitutionSearch.filter(banks, "").size)
        assertEquals(AccountsText("1 banca"), InstitutionSearch.countLabel(1))
        assertEquals(AccountsText("{0} banche", mapOf("0" to "3")), InstitutionSearch.countLabel(3))
        assertEquals(AccountsText("Nessuna banca trovata per «{0}».", mapOf("0" to "xyz")), InstitutionSearch.emptyTitle(" xyz "))
        assertEquals("Nessuna banca disponibile in questo paese.", InstitutionSearch.emptyTitle("").source)
    }

    @Test fun ACC019_historyLabel() {
        assertEquals(AccountsText("Storico fino a {0} giorni", mapOf("0" to "90")), InstitutionHistory.label("90"))
        assertEquals(AccountsText("Storico fino a 1 anno"), InstitutionHistory.label("365"))
        assertEquals(AccountsText("Storico fino a 1 anno"), InstitutionHistory.label("540"))
        assertEquals(AccountsText("Storico fino a {0} anni", mapOf("0" to "2")), InstitutionHistory.label("730"))
        assertNull(InstitutionHistory.label("0"))
        assertNull(InstitutionHistory.label(""))
        assertNull(InstitutionHistory.label("abc"))
    }

    // ------------------------------------------------------------------------------------------------ Consent return

    @Test fun ACC027_parsesNativeReturn() {
        fun location(key: String) = nativeFlow("consentRedirect", key, "headers").jsonObject.getValue("location").jsonPrimitive.content
        assertEquals(
            BankLinkReturn("3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", BankLinkReturn.Status.Returned),
            BankLinkReturn.parse(location("returned")),
        )
        assertEquals(BankLinkReturn.Status.Cancelled, BankLinkReturn.parse(location("cancelled"))?.status)
        assertEquals("InstitutionTechnicalError", BankLinkReturn.parse(location("failed"))?.error)
        assertEquals(BankLinkReturn(null, BankLinkReturn.Status.InvalidRef), BankLinkReturn.parse(location("invalidRef")))
        assertNull(BankLinkReturn.parse("https://buddybudget.io/bank/return?ref=x"))
    }

    @Test fun ACC027_completeErrorMessages() {
        assertEquals(BankLinkMessages.CONSENT_FAILED, BankLinkMessages.completeError(422, "x"))
        assertEquals(BankLinkMessages.NOT_FOUND, BankLinkMessages.completeError(404, null))
        assertEquals(BankLinkMessages.UNAVAILABLE, BankLinkMessages.completeError(502, null))
        assertEquals("Il consenso con la banca non è ancora completo", BankLinkMessages.completeError(409, "Il consenso con la banca non è ancora completo"))
    }

    @Test fun ACC024_foundAccountsNamesAndSelections() {
        val done = json.decodeFromString(ConnectionCompletion.serializer(), nativeFlow("complete", "body").toString())
        val accounts = done.accounts.externalAccounts
        assertEquals(listOf("Conto principale", "Carta"), accounts.map(FoundAccounts::displayName))
        val ibanOnly = ExternalBankAccount("e", ExternalBankAccount.Details(iban = "IT00"))
        assertEquals("IT00", FoundAccounts.displayName(ibanOnly))
        assertEquals("e", FoundAccounts.displayName(ExternalBankAccount("e")))
        assertEquals("IT00", FoundAccounts.selections(listOf(ibanOnly), setOf("e"), emptyMap()).first().name)
        assertTrue(FoundAccounts.selections(accounts, emptySet(), emptyMap()).isEmpty())
    }
}
