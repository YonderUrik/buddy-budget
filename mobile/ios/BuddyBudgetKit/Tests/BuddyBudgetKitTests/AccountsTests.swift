import Foundation
import Testing
@testable import BuddyBudgetKit

// Liquidità · Conti (spec: features/04-accounts-bank-sync.md) with the spec fixtures. Twin: AccountsTest.kt.

private func accountsFixture() throws -> [Account] {
    try JSONDecoder().decode([Account].self, from: try fixture("accounts-include.json"))
}

/// `gocardless-native-flow.json` (copied next to this file until the spec submodule is bumped).
private func nativeFlow(_ path: [String]) throws -> Data {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/gocardless-native-flow.json")
    var value: Any = try JSONSerialization.jsonObject(with: Data(contentsOf: url))
    for key in path { value = (value as! [String: Any])[key]! }
    return try JSONSerialization.data(withJSONObject: value)
}

private let utc = TimeZone(identifier: "UTC")!

private func linked(_ id: String, bank: String?, health: AccountHealth? = nil, balance: Double = 10) -> Account {
    Account(id: id, name: id, type: "Conto corrente", balance: balance, source: .auto, bankName: bank, health: health)
}

private func health(_ connection: String, _ state: ConnectionHealthState, days: Int? = nil, eligible: Bool = false,
                    next: String? = nil, remaining: Int = 2, bank: String = "Fineco") -> AccountHealth {
    AccountHealth(connectionId: connection, institutionName: bank, state: state,
                  needsRenewal: ConnectionHealth.needsRenewal(state), daysLeft: days, eligible: eligible,
                  nextEligibleAt: next, syncsRemainingToday: remaining)
}

// MARK: Data

@Test func ACC001_decodesAccountsWithExtras() async throws {
    let transport = StubTransport(status: 200, body: String(decoding: try fixture("accounts-include.json"), as: UTF8.self))
    let accounts = try await AccountsAPI(client: makeClient(transport)).list(today: CalendarDate(year: 2026, month: 10, day: 18))
    let query = transport.last?.url?.query ?? ""
    #expect(query.contains("include=trend,health") && query.contains("today=2026-10-18"))
    let linkedAccount = try #require(accounts.first { $0.isLinked })
    #expect(linkedAccount.balance == 5050.34)
    #expect(linkedAccount.bankName == "Banca Demo")
    #expect(linkedAccount.trend?.count == 31)
    #expect(linkedAccount.health?.state == .expiring && linkedAccount.health?.daysLeft == 6)
    #expect(linkedAccount.status == AccountStatusLine(tone: .warning, label: "Da riconnettere"))
    #expect(accounts.first { !$0.isLinked }?.status?.label == "Aggiornato da te")
}

@Test func ACC001_decodesRawAccountsWithoutExtras() throws {
    let accounts = try JSONDecoder().decode([Account].self, from: try fixture("accounts.json"))
    #expect(!accounts.isEmpty)
    #expect(accounts.allSatisfy { $0.status == nil && $0.health == nil })
}

@Test func ACC030_createSendsNumbersAndAppearance() async throws {
    let transport = StubTransport(status: 201, body: #"{"id":"a","name":"Contanti","type":"Contanti","balance":"150.00","color":"green","icon":"banknote","source":"manuale"}"#)
    let created = try await AccountsAPI(client: makeClient(transport)).create(
        NewAccountRequest(name: "Contanti", type: "Contanti", balance: -20.5, color: "green", icon: "banknote"))
    #expect(created.balance == 150)
    let body = try #require(transport.last?.httpBody).utf8
    #expect(body == #"{"balance":-20.5,"color":"green","icon":"banknote","name":"Contanti","type":"Contanti"}"#)
}

@Test func ACC035_patchSendsOnlySetFields() async throws {
    let transport = StubTransport(status: 200, body: #"{"id":"a","name":"Nuovo","type":"x","balance":1,"source":"auto"}"#)
    _ = try await AccountsAPI(client: makeClient(transport)).update(id: "a", AccountPatch(name: "Nuovo"))
    #expect(transport.last?.httpMethod == "PATCH")
    #expect(try #require(transport.last?.httpBody).utf8 == #"{"name":"Nuovo"}"#)
}

@Test func ACC021_startsNativeConnection() async throws {
    let transport = StubTransport(status: 200, body: String(decoding: try nativeFlow(["start", "body"]), as: UTF8.self))
    let institution = Institution(id: "SANDBOXFINANCE_SFIN0000", name: "Sandbox Finance", transactionTotalDays: "90")
    let start = try await GoCardlessAPI(client: makeClient(transport)).startConnection(institution)
    #expect(start.connectionId == "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b")
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? NSDictionary
    let expected = try JSONSerialization.jsonObject(with: try nativeFlow(["start", "request", "body"])) as? NSDictionary
    #expect(sent == expected)
}

@Test func ACC023_completeReturnsAccountsToSelect() async throws {
    let transport = StubTransport(status: 200, body: String(decoding: try nativeFlow(["complete", "body"]), as: UTF8.self))
    let done = try await GoCardlessAPI(client: makeClient(transport)).complete(connectionId: "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b")
    #expect(transport.last?.url?.path == "/api/gocardless/connections/3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b/complete")
    #expect(done.status == "linked")
    #expect(done.accounts.externalAccounts.count == 2)
    #expect(done.accounts.existingAutoAccounts.first?.name == "Conto corrente")
}

@Test func ACC026_finalizeBodyMatchesContract() async throws {
    let done = try JSONDecoder().decode(ConnectionCompletion.self, from: try nativeFlow(["complete", "body"]))
    let accounts = done.accounts.externalAccounts
    let selections = FoundAccounts.selections(accounts, selected: Set(accounts.map(\.externalAccountId)),
                                              targets: [accounts[1].externalAccountId: "1d7e4c2b-5a6f-4b8c-9d0e-1f2a3b4c5d6e"])
    let transport = StubTransport(status: 201, body: #"{"jobId":"7c2e9f1a-3b4d-4e5f-8a6b-7c8d9e0f1a2b"}"#)
    let job = try await GoCardlessAPI(client: makeClient(transport)).finalize(connectionId: done.connectionId, selections: selections)
    #expect(job.jobId == "7c2e9f1a-3b4d-4e5f-8a6b-7c8d9e0f1a2b")
    let sent = try JSONSerialization.jsonObject(with: try #require(transport.last?.httpBody)) as? NSDictionary
    let expected = try JSONSerialization.jsonObject(with: try nativeFlow(["finalize", "request", "body"])) as? NSDictionary
    #expect(sent == expected)
}

@Test func ACC012_decodesCapacityAndInstitutions() throws {
    let capacity = try JSONDecoder().decode(BankCapacity.self, from: Data(#"{"canConnectNew":false,"reason":"user_attempts","renewableInstitutionIds":[]}"#.utf8))
    #expect(capacity.reason == .userAttempts)
    let banks = try JSONDecoder().decode([Institution].self, from: Data(#"[{"id":"A","name":"Fineco","transaction_total_days":"730","logo":"https://x/a.png"},{"id":"B","name":"N26","transaction_total_days":540}]"#.utf8))
    #expect(banks.map(\.transactionTotalDays) == ["730", "540"])
}

@Test func ACC046_decodesSyncJobs() throws {
    let json = #"[{"id":"j","userId":"u","kind":"initial-import","status":"running","dismissed":false,"startedAt":"2026-10-18T09:30:00.000Z","updatedAt":"2026-10-18T09:30:12.000Z","interrupted":false,"accounts":[{"accountId":"1","name":"Conto Fineco","phase":"saving","total":412,"processed":200,"inserted":198,"categorized":150,"uncategorized":48},{"accountId":"2","name":"Risparmio","phase":"error","total":null,"processed":0,"inserted":0,"categorized":0,"uncategorized":0,"errorReason":"already-running"}]}]"#
    let jobs = try JSONDecoder().decode([SyncJob].self, from: Data(json.utf8))
    #expect(jobs[0].kind == .initialImport && jobs[0].accounts[1].errorReason == "already-running")
    #expect(SyncJobs.shouldPoll(jobs))
    #expect(SyncJobs.isSyncing(jobs, accountId: "1"))
    #expect(!SyncJobs.isSyncing(jobs, accountId: "2"))
    #expect(SyncJobs.overallProgress(jobs[0]) == .determinate(value: 200, max: 412))
    #expect(!SyncJobs.shouldPoll([]))
}

// MARK: Grouping & status

@Test func ACC001_groupsByBankAlphabeticallyThenManual() throws {
    let accounts = try accountsFixture()
    let groups = AccountGrouping.group(accounts)
    #expect(groups.map(\.label) == ["Banca Demo", "Manuali"])
    #expect(groups[1].hint == "Li aggiorni tu" && groups[0].hint == "Si aggiorna da solo")
    #expect(groups[1].total == accounts.filter { !$0.isLinked }.reduce(0) { $0 + $1.balance })

    let mixed = [linked("z", bank: "Zeta"), linked("u", bank: nil), linked("a", bank: "Àlfa"), linked("b", bank: "Zeta")]
    let labels = AccountGrouping.group(mixed).map(\.label)
    #expect(labels == ["Àlfa", "Banca collegata", "Zeta"])
    #expect(AccountGrouping.group(mixed).last?.accounts.map(\.id) == ["z", "b"])
}

@Test func ACC003_statusPrecedence() {
    let manual = Account(id: "m", name: "m", type: "Contanti", balance: 1)
    #expect(AccountRowStatus.resolve(manual, syncing: true).label == "Aggiornato da te")
    let renew = linked("r", bank: "B", health: health("c", .expired))
    #expect(AccountRowStatus.resolve(renew, syncing: true) == AccountStatusLine(tone: .warning, label: "Da riconnettere"))
    let ok = Account(id: "o", name: "o", type: "x", balance: 1, source: .auto, health: health("c", .ok),
                     status: AccountStatusLine(tone: .ok, label: "Aggiornato 3 ore fa"))
    #expect(AccountRowStatus.resolve(ok, syncing: true).tone == .progress)
    #expect(AccountRowStatus.resolve(ok, syncing: false).label == "Aggiornato 3 ore fa")
}

// MARK: Renewal

@Test func ACC007_renewalAlertsOnePerConnectionUrgentFirst() throws {
    let accounts = [linked("1", bank: "A", health: health("c1", .expiring, days: 1, bank: "Fineco")),
                    linked("2", bank: "A", health: health("c1", .expiring, days: 1, bank: "Fineco")),
                    linked("3", bank: "B", health: health("c2", .error, bank: "Intesa")),
                    linked("4", bank: "C", health: health("c3", .ok, days: 40, bank: "N26"))]
    let alerts = RenewalAlerts.build(accounts)
    #expect(alerts.map(\.connectionId) == ["c2", "c1"])
    #expect(RenewalAlerts.message(alerts[0]) == AccountsText("Il collegamento con {0} non è andato a buon fine.", ["0": "Intesa"]))
    #expect(RenewalAlerts.message(alerts[1]) == AccountsText("Il collegamento con {0} scade domani.", ["0": "Fineco"]))
    let six = RenewalAlert(connectionId: "x", institutionName: "Banca Demo", state: .expiring, daysLeft: 6)
    #expect(RenewalAlerts.message(six) == AccountsText("Il collegamento con {0} scade tra {1} giorni.", ["0": "Banca Demo", "1": "6"]))
    let expired = RenewalAlert(connectionId: "x", institutionName: "N26", state: .expired, daysLeft: nil)
    #expect(RenewalAlerts.message(expired).source == "Il collegamento con {0} è scaduto: i conti non si aggiornano.")
}

@Test func ACC008_fixtureLinkedAccountNeedsRenewal() throws {
    let alerts = RenewalAlerts.build(try accountsFixture())
    #expect(alerts.count == 1 && alerts[0].daysLeft == 6 && alerts[0].institutionName == "Banca Demo")
}

// MARK: Manual form

@Test func ACC029_manualFormValidation() {
    var draft = ManualAccountDraft()
    #expect(draft.validateNameAndType().name == "Dai un nome al conto, per riconoscerlo nell'elenco.")
    draft.name = "  Conto Intesa "
    draft.typePreset = nil
    #expect(draft.validateNameAndType() == ManualAccountErrors(type: "Scrivi di che tipo di conto si tratta."))
    draft.customType = "Wallet crypto"
    #expect(draft.validateNameAndType().isEmpty)
    draft.balanceText = ""
    #expect(draft.validateBalance().balance == "Inserisci il saldo di oggi (anche 0).")
    draft.balanceText = "-12,5"
    #expect(draft.request() == NewAccountRequest(name: "Conto Intesa", type: "Wallet crypto", balance: -12.5, color: "slate", icon: "wallet"))
    draft.balanceText = "0"
    #expect(draft.request()?.balance == 0)
    #expect(ManualAccountDraft.clampName(String(repeating: "a", count: 90)).count == 80)
    #expect(AccountOptions.icons.count == 30 && AccountOptions.colors.count == 16)
}

// MARK: Detail edits

@Test func ACC032_renameOnlyWhenChangedAndNotEmpty() {
    let a = Account(id: "a", name: "Conto", type: "Contanti", balance: 10)
    #expect(AccountEdits.rename(a, draft: "  ") == nil)
    #expect(AccountEdits.rename(a, draft: "Conto ") == nil)
    #expect(AccountEdits.rename(a, draft: " Cassa ") == AccountPatch(name: "Cassa"))
}

@Test func ACC034_manualTypeAndBalanceEdits() {
    let a = Account(id: "a", name: "Conto", type: "Contanti", balance: 10)
    #expect(AccountEdits.retype(a, draft: "Contanti") == nil)
    #expect(AccountEdits.retype(a, draft: "Conto deposito") == AccountPatch(type: "Conto deposito"))
    #expect(AccountEdits.rebalance(a, draft: "10") == nil)
    #expect(AccountEdits.rebalance(a, draft: "abc") == nil)
    #expect(AccountEdits.rebalance(a, draft: "-3,25") == AccountPatch(balance: -3.25))
}

@Test func ACC035_linkedNeverSendsTypeOrBalance() {
    let a = linked("l", bank: "B")
    #expect(AccountEdits.retype(a, draft: "Altro") == nil)
    #expect(AccountEdits.rebalance(a, draft: "99") == nil)
    #expect(AccountEdits.appearance(a, color: "blue", icon: "wallet") == AccountPatch(color: "blue", icon: "wallet"))
}

@Test func ACC040_removalCopyMentionsMovements() {
    let manual = AccountRemoval.copy(for: Account(id: "a", name: "Cassa", type: "Contanti", balance: 1))
    #expect(manual.title == "Eliminare questo conto?" && manual.confirm == "Elimina")
    #expect(manual.message.source.contains("movimenti") && manual.message.values == ["0": "Cassa"])
    let unlink = AccountRemoval.copy(for: linked("l", bank: "B"))
    #expect(unlink.title == "Scollegare questo conto?" && unlink.confirm == "Scollega" && unlink.message.source.contains("movimenti"))
}

// MARK: Sync availability & errors

@Test func ACC036_syncAvailabilitySentence() {
    let next = "2026-10-18T15:55:23.447Z"
    func s(_ h: AccountHealth?, syncing: Bool = false) -> AccountsText {
        SyncAvailability.sentence(health: h, syncing: syncing, locale: .itIT, timeZone: utc)
    }
    #expect(s(health("c", .ok), syncing: true).source == "Sincronizzazione in corso.")
    #expect(s(health("c", .expired)).source == "Riconnetti la banca per sincronizzare.")
    #expect(s(nil).source == "Informazioni di sincronizzazione non disponibili.")
    #expect(s(health("c", .ok, eligible: true)).source == "Puoi sincronizzare adesso.")
    #expect(s(health("c", .ok)).source == "Sincronizzazione non disponibile.")
    #expect(s(health("c", .ok, next: next, remaining: 0))
        == AccountsText("Hai raggiunto il limite di {0} sincronizzazioni al giorno. Prossima alle {1}.", ["0": "4", "1": "15:55"]))
    #expect(s(health("c", .ok, next: next, remaining: 2)) == AccountsText("Prossima sincronizzazione disponibile alle {0}.", ["0": "15:55"]))
}

@Test func ACC037_syncButtonEnablement() {
    #expect(SyncAvailability.canSync(health: health("c", .ok, eligible: true), syncing: false, starting: false))
    #expect(!SyncAvailability.canSync(health: health("c", .ok, eligible: true), syncing: true, starting: false))
    #expect(!SyncAvailability.canSync(health: health("c", .ok, eligible: true), syncing: false, starting: true))
    #expect(!SyncAvailability.canSync(health: health("c", .expiring, eligible: true), syncing: false, starting: false))
    #expect(!SyncAvailability.canSync(health: health("c", .ok), syncing: false, starting: false))
    #expect(!SyncAvailability.canSync(health: nil, syncing: false, starting: false))
}

@Test func ACC044_syncStartErrorMessages() {
    func m(_ status: Int?, _ next: String? = nil) -> String {
        SyncStartError.message(status: status, nextEligibleAt: next, locale: .itIT, timeZone: utc).source
    }
    #expect(SyncStartError.message(status: 429, nextEligibleAt: "2026-10-18T10:00:00.000Z", locale: .itIT, timeZone: utc)
        == AccountsText("Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {0}.", ["0": "10:00"]))
    #expect(m(429) == "Sync non disponibile al momento. Riprova più tardi.")
    #expect(m(409) == "Sincronizzazione già in corso per questo conto.")
    #expect(m(503) == "Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.")
    #expect(m(404) == "Conto non trovato o non collegato")
    #expect(m(500) == "Impossibile completare la sincronizzazione. Riprova più tardi.")
    #expect(m(nil) == "Impossibile completare la sincronizzazione. Riprova più tardi.")
}

// MARK: Job texts

@Test func ACC047_phaseTexts() {
    func d(_ phase: SyncAccountPhase, total: Int? = nil, processed: Int = 0, interrupted: Bool = false, reason: String? = nil,
           inserted: Int = 0, cat: Int = 0, unc: Int = 0) -> SyncAccountProgress {
        SyncJobs.describe(SyncJobAccount(accountId: "a", name: "A", phase: phase, total: total, processed: processed,
                                         inserted: inserted, categorized: cat, uncategorized: unc, errorReason: reason),
                          interrupted: interrupted)
    }
    #expect(d(.queued).text.source == "In attesa" && d(.queued).bar == .none)
    #expect(d(.balance).text.source == "Aggiorno il saldo…" && d(.balance).bar == .indeterminate)
    #expect(d(.fetching).text.source == "Scarico i movimenti dalla banca…")
    let saving = d(.saving, total: 412, processed: 200)
    #expect(saving.text == AccountsText("Importati {0} di {1} movimenti", ["0": "200", "1": "412"]))
    #expect(saving.bar == .determinate(value: 200, max: 412))
    #expect(d(.saving, total: 1).text.source == "Importati {0} di {1} movimento")
    #expect(d(.done).text.source == "Nessuna nuova transazione trovata. Saldo aggiornato." && d(.done).tone == .success)
    #expect(d(.limited).tone == .error)
    #expect(d(.expired).text.source == "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.")
    #expect(d(.error, reason: "already-running").text.source == "Sincronizzazione già in corso per questo conto.")
    #expect(d(.error).text.source == "Sincronizzazione non riuscita. Riprova più tardi.")
}

@Test func ACC048_interruptedText() {
    let account = SyncJobAccount(accountId: "a", name: "A", phase: .error)
    #expect(SyncJobs.describe(account, interrupted: true).text.source
        == "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.")
    let job = SyncJob(id: "j", status: .failed, interrupted: true, accounts: [account])
    #expect(SyncJobs.title(job).source == "Sincronizzazione interrotta")
    #expect(SyncJobs.isFinished(job) && SyncJobs.hasErrors(job))
}

@Test func ACC047_summaryAndTitles() {
    #expect(SyncJobs.summary(inserted: 1, categorized: 0, uncategorized: 0).source == "{0} nuova transazione. Saldo aggiornato.")
    let many = SyncJobs.summary(inserted: 12, categorized: 1, uncategorized: 3)
    #expect(many.source == "{0} nuove transazioni ({1}). Saldo aggiornato.")
    #expect(many.lists["1"] == [AccountsText("{0} categorizzata da sola", ["0": "1"]), AccountsText("{0} da decidere", ["0": "3"])])
    let a = SyncJobAccount(accountId: "a", name: "A", phase: .fetching)
    #expect(SyncJobs.title(SyncJob(id: "j", status: .running, accounts: [a])) == AccountsText("Sincronizzazione in corso · {0} conto", ["0": "1"]))
    #expect(SyncJobs.title(SyncJob(id: "j", status: .running, accounts: [a, a])).source == "Sincronizzazione in corso · {0} conti")
    #expect(SyncJobs.title(SyncJob(id: "j", status: .done, accounts: [a])).source == "Sincronizzazione completata")
    #expect(SyncJobs.title(SyncJob(id: "j", status: .failed, accounts: [a])).source == "Sincronizzazione non riuscita")
}

@Test func ACC050_ACC051_finishedJobsAndCategorize() {
    let running = SyncJob(id: "j", status: .running, accounts: [SyncJobAccount(accountId: "a", name: "A", phase: .saving, total: 3)])
    let previous = SyncJobs.runningIds([running])
    let done = SyncJob(id: "j", status: .done, accounts: [SyncJobAccount(accountId: "a", name: "A", phase: .done, uncategorized: 2)])
    #expect(SyncJobs.finishedSince(previous: previous, current: [done]))
    #expect(!SyncJobs.finishedSince(previous: previous, current: [running]))
    #expect(SyncJobs.uncategorized(done) == 2)
}

// MARK: Bank picker

@Test func ACC013_capacityCopyPerReason() {
    #expect(BankCapacityCopy.unavailable(BankCapacity(canConnectNew: true, reason: nil)) == nil)
    #expect(BankCapacityCopy.unavailable(BankCapacity(canConnectNew: false, reason: .userLimit))?.badge == "Una per persona")
    #expect(BankCapacityCopy.unavailable(BankCapacity(canConnectNew: false, reason: .userAttempts))?.badge == "Più avanti")
    #expect(BankCapacityCopy.unavailable(BankCapacity(canConnectNew: false, reason: .providerLimit))?.badge == "In arrivo")
    #expect(BankCapacityCopy.unavailable(BankCapacity(canConnectNew: false, reason: .globalLimit))?.badge == "In arrivo")
}

@Test func ACC017_countriesDefaultToProductCountry() {
    #expect(BankCountries.all.map(\.code) == ["IT", "DE", "FR", "ES", "GB"])
    #expect(BankCountries.defaultCode(productCountry: "DE") == "DE")
    #expect(BankCountries.defaultCode(productCountry: nil) == "IT")
    #expect(BankCountries.all[0].flag == "🇮🇹")
}

@Test func ACC018_institutionSearch() {
    let banks = [Institution(id: "1", name: "Intesa Sanpaolo", transactionTotalDays: "540"),
                 Institution(id: "2", name: "FinecoBank", transactionTotalDays: "730"),
                 Institution(id: "3", name: "N26", transactionTotalDays: "")]
    #expect(InstitutionSearch.filter(banks, query: "  FINE ").map(\.id) == ["2"])
    #expect(InstitutionSearch.filter(banks, query: "").count == 3)
    #expect(InstitutionSearch.countLabel(1) == AccountsText("1 banca"))
    #expect(InstitutionSearch.countLabel(3) == AccountsText("{0} banche", ["0": "3"]))
    #expect(InstitutionSearch.emptyTitle(query: " xyz ") == AccountsText("Nessuna banca trovata per «{0}».", ["0": "xyz"]))
    #expect(InstitutionSearch.emptyTitle(query: "").source == "Nessuna banca disponibile in questo paese.")
}

@Test func ACC019_historyLabel() {
    #expect(InstitutionHistory.label("90") == AccountsText("Storico fino a {0} giorni", ["0": "90"]))
    #expect(InstitutionHistory.label("365") == AccountsText("Storico fino a 1 anno"))
    #expect(InstitutionHistory.label("540") == AccountsText("Storico fino a 1 anno"))
    #expect(InstitutionHistory.label("730") == AccountsText("Storico fino a {0} anni", ["0": "2"]))
    #expect(InstitutionHistory.label("0") == nil)
    #expect(InstitutionHistory.label("") == nil)
    #expect(InstitutionHistory.label("abc") == nil)
}

// MARK: Consent return

@Test func ACC027_parsesNativeReturn() throws {
    func location(_ key: String) throws -> URL {
        let headers = try JSONSerialization.jsonObject(with: try nativeFlow(["consentRedirect", key, "headers"])) as! [String: Any]
        return URL(string: headers["location"] as! String)!
    }
    #expect(BankLinkReturn.parse(try location("returned")) == BankLinkReturn(ref: "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", status: .returned))
    #expect(BankLinkReturn.parse(try location("cancelled"))?.status == .cancelled)
    #expect(BankLinkReturn.parse(try location("failed"))?.error == "InstitutionTechnicalError")
    #expect(BankLinkReturn.parse(try location("invalidRef")) == BankLinkReturn(ref: nil, status: .invalidRef))
    #expect(BankLinkReturn.parse(URL(string: "https://buddybudget.io/bank/return?ref=x")!) == nil)
}

@Test func ACC027_completeErrorMessages() {
    #expect(BankLinkMessages.completeError(status: 422, serverMessage: "x") == BankLinkMessages.consentFailed)
    #expect(BankLinkMessages.completeError(status: 404, serverMessage: nil) == BankLinkMessages.notFound)
    #expect(BankLinkMessages.completeError(status: 502, serverMessage: nil) == BankLinkMessages.unavailable)
    #expect(BankLinkMessages.completeError(status: 409, serverMessage: "Il consenso con la banca non è ancora completo")
        == "Il consenso con la banca non è ancora completo")
}

@Test func ACC024_foundAccountsNamesAndSelections() throws {
    let done = try JSONDecoder().decode(ConnectionCompletion.self, from: try nativeFlow(["complete", "body"]))
    let accounts = done.accounts.externalAccounts
    #expect(accounts.map(FoundAccounts.displayName) == ["Conto principale", "Carta"])
    let ibanOnly = ExternalBankAccount(externalAccountId: "e", details: .init(iban: "IT00"))
    #expect(FoundAccounts.displayName(ibanOnly) == "IT00")
    #expect(FoundAccounts.displayName(ExternalBankAccount(externalAccountId: "e", details: .init())) == "e")
    #expect(FoundAccounts.selections([ibanOnly], selected: ["e"], targets: [:]).first?.name == "IT00")
    #expect(FoundAccounts.selections(accounts, selected: [], targets: [:]).isEmpty)
}

private extension Data {
    var utf8: String { String(decoding: self, as: UTF8.self) }
}
