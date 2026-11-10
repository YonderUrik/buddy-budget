import Foundation
import Testing
@testable import BuddyBudgetKit

// Phase 4e: the web changes since `0.69.1` (spec CHANGELOG), one test per requirement. Same tests on Android (`CatchUpTest`).

/// Template substitution standing in for the catalog: Italian sources, `{0}` filled.
nonisolated(unsafe) private let tr: CategorizationText.Translate = { BBFormat.interpolate($0, $1) }
private let itIT = BBLocale(language: .it)

// MARK: Categorisation (web #456)

@Test func CAT043_autoApplyThresholdIs70() {
    #expect(CategorizationText.autoApplyThreshold == 0.7)
    #expect(CategorizationText.autoApplyPercent == "70")
}

@Test func CAT047_CAT098_bankOrigin() throws {
    #expect(CategorySource.banca.isAutomatic)
    #expect(CategorizationText.autoOriginDescription(.banca, confidence: nil, bankCategory: "Alimentari", tr: tr)
        == "Messa dall'app: nel file la banca la chiama «Alimentari»")
    #expect(CategorizationText.autoOriginDescription(.banca, confidence: nil, bankCategory: nil, tr: tr)
        == "Messa dall'app con la categoria scritta dalla banca nel file")
    #expect(CategorizationText.autoOriginDescription(.assistente, confidence: 0.82, bankCategory: nil, tr: tr)
        == "Messa dall'app: proposta dell'AI (sicura al 82%)")
    #expect(CategorizationText.autoOriginDescription(.storico, confidence: nil, bankCategory: nil, tr: tr)
        == "Messa dall'app: la scegli sempre per questo esercente")
    #expect(CategorizationText.autoOriginDescription(.utente, confidence: nil, bankCategory: nil, tr: tr) == nil)
    #expect(try JSONDecoder().decode(CategorySource.self, from: Data(#""banca""#.utf8)) == .banca)
}

@Test func CAT077_summaryVariants() {
    #expect(AutoReviewText.summary(total: 12, fromBank: false, autoApplyEnabled: true, tr: tr)
        == "Negli ultimi 30 giorni, 12 movimenti hanno la categoria messa dall'app, con le tue regole o perché era abbastanza sicura. Non serve confermarle: se una non va, toccala e cambiala.")
    #expect(AutoReviewText.summary(total: 1, fromBank: true, autoApplyEnabled: false, tr: tr)
        == "Negli ultimi 30 giorni, 1 movimento ha la categoria messa dall'app, con le tue regole o con la categoria della banca. Non serve confermarle: se una non va, toccala e cambiala.")
    #expect(AutoReviewText.reasonSource(autoApplyEnabled: true, fromBank: true)
        == ", con le tue regole, con la categoria della banca o perché era abbastanza sicura")
    #expect(AutoReviewText.reasonSource(autoApplyEnabled: false, fromBank: false) == ", con le tue regole")
}

// MARK: Movement detail (web #455)

@Test func TX064_detailDecodes() throws {
    let body = #"""
    {"transaction":{"id":"t1","accountId":"a1","categoryId":"c1","description":"Esselunga","rawDescription":"POS ESSELUNGA MILANO",
    "amount":"-42.90","excludedAmount":"0.00","categorySource":"banca","bankCategory":"Spesa","merchantCategoryCode":"5411","date":"2026-10-13",
    "source":"manuale","createdAt":"2026-10-14T08:00:00.000Z","logoPath":null},"account":{"id":"a1","name":"Conto corrente"},
    "origin":{"kind":"file","format":"Banca Prova"},"rule":null,"merchant":{"count":3,"total":-120.5,"recent":[{"id":"t0","date":"2026-09-13","amount":-40.1}]}}
    """#
    let detail = try JSONDecoder().decode(MovementDetail.self, from: Data(body.utf8))
    #expect(detail.transaction.amount == -42.9)
    #expect(detail.transaction.bankCategory == "Spesa")
    #expect(detail.transaction.merchantCategoryCode == "5411")
    #expect(detail.account?.name == "Conto corrente")
    #expect(detail.merchant?.count == 3)
    #expect(detail.merchant?.recent.first?.amount == -40.1)
}

@Test func TX067_whoChoseTheCategory() {
    #expect(MovementDetailText.categoryOriginText(.utente, confidence: nil, rule: nil, uncategorized: false, bankCategory: nil, tr: tr) == "Scelta da te")
    #expect(MovementDetailText.categoryOriginText(.regola, confidence: nil, rule: DetailRule(id: "r", matchType: "merchant", pattern: "esselunga"),
                                                  uncategorized: false, bankCategory: nil, tr: tr) == "Messa dalla tua regola per «esselunga»")
    #expect(MovementDetailText.categoryOriginText(.regola, confidence: nil, rule: DetailRule(id: "r", matchType: "contains", pattern: "netflix"),
                                                  uncategorized: false, bankCategory: nil, tr: tr) == "Messa dalla tua regola: il testo contiene «netflix»")
    #expect(MovementDetailText.categoryOriginText(.regola, confidence: nil, rule: nil, uncategorized: false, bankCategory: nil, tr: tr)
        == "Messa dall'app con una tua regola")
    #expect(MovementDetailText.categoryOriginText(.utente, confidence: nil, rule: nil, uncategorized: true, bankCategory: nil, tr: tr) == nil)
    #expect(MovementDetailText.categoryOriginText(nil, confidence: nil, rule: nil, uncategorized: false, bankCategory: nil, tr: tr) == nil)
}

@Test func TX068_askTheAi() {
    let selectable: Set<String> = ["c1", "c2"]
    #expect(MovementDetailText.aiAnswer(SingleSuggestion(status: "ok", categoryId: "c1", confidence: 0.9), currentCategoryId: "c1", selectableIds: selectable) == .agrees)
    #expect(MovementDetailText.aiAnswer(SingleSuggestion(status: "ok", categoryId: "c2", confidence: 0.874), currentCategoryId: "c1", selectableIds: selectable)
        == .proposes(categoryId: "c2", percent: 87))
    #expect(MovementDetailText.aiAnswer(SingleSuggestion(status: "limited"), currentCategoryId: "c1", selectableIds: selectable)
        == .message(source: "Hai chiesto molte volte nell'ultima ora: riprova più tardi.", offersSettings: false))
    #expect(MovementDetailText.aiAnswer(SingleSuggestion(status: "disabled"), currentCategoryId: "c1", selectableIds: selectable)
        == .message(source: "L'assistente per le categorie è spento.", offersSettings: true))
    // A category the movement cannot take counts as no answer.
    #expect(MovementDetailText.aiAnswer(SingleSuggestion(status: "ok", categoryId: "zz", confidence: 0.9), currentCategoryId: "c1", selectableIds: selectable)
        == .message(source: "L'AI non ha risposto. Riprova tra poco.", offersSettings: false))
    if case .message(_, let offers) = MovementDetailText.aiOff { #expect(offers) } else { Issue.record("aiOff is a message") }
}

@Test func TX069_whereItCameFrom() {
    #expect(MovementDetailText.originText(MovementOrigin(kind: "banca", institution: "Intesa"), tr: tr) == "Dalla banca collegata, Intesa")
    #expect(MovementDetailText.originText(MovementOrigin(kind: "banca"), tr: tr) == "Dalla banca collegata")
    #expect(MovementDetailText.originText(MovementOrigin(kind: "file", format: "Banca Prova"), tr: tr) == "Da un file importato, formato «Banca Prova»")
    #expect(MovementDetailText.originText(MovementOrigin(kind: "broker", broker: "Trade Republic"), tr: tr) == "Dall'estratto conto di Trade Republic")
    #expect(MovementDetailText.originText(MovementOrigin(kind: "esempio"), tr: tr) == "Dai dati d'esempio")
    #expect(MovementDetailText.originText(MovementOrigin(kind: "manuale"), tr: tr) == "Aggiunto da te")
}

// MARK: Primi passi (web #444, #452)

private func status(_ steps: StartStatus.Steps, _ ids: [String], skipped: [String] = [], focus: [String]? = nil) -> StartStatus {
    StartStatus(steps: steps, stepIds: ids, focus: focus, skipped: skipped)
}

@Test func OV033_stepsFollowTheFocus() {
    #expect(StartChecklist.stepsFor(nil, pensionAvailable: true) == StartStepId.defaults)
    #expect(StartChecklist.stepsFor([.pensione, .debiti], pensionAvailable: true) == [.conto, .debito, .pensione, .obiettivo])
    #expect(StartChecklist.stepsFor([.pensione], pensionAvailable: false) == [.conto, .obiettivo])
    // An older server without `stepIds` asks the default four.
    #expect(StartStatus(steps: StartStatus.Steps()).askedSteps == StartStepId.defaults)
}

@Test func OV045_OV046_nextStepAndSkips() {
    let s = status(StartStatus.Steps(conto: true), ["conto", "import", "debito", "obiettivo"], skipped: ["import"])
    #expect(StartChecklist.nextStep(s) == .debito)
    #expect(StartChecklist.rowState(s, .import) == .skipped)
    #expect(StartChecklist.rowState(s, .conto) == .done)
    #expect(!StartChecklist.canSkip(.conto))
    #expect(StartChecklist.canSkip(.pensione))
    let allSkipped = status(StartStatus.Steps(conto: true), ["conto", "import", "debito", "obiettivo"], skipped: ["import", "debito", "obiettivo"])
    #expect(StartChecklist.nextStep(allSkipped) == nil)
}

@Test func OV038_pollWhileIncomplete() {
    #expect(StartChecklist.shouldPoll(StartStatus(steps: StartStatus.Steps())))
    #expect(!StartChecklist.shouldPoll(StartStatus(steps: StartStatus.Steps(), completed: true)))
    #expect(!StartChecklist.shouldPoll(StartStatus(steps: StartStatus.Steps(), dismissed: true)))
    #expect(StartChecklist.pollSeconds == 15)
}

@Test func SHELL060_newlyDoneSteps() {
    let now = status(StartStatus.Steps(conto: true, import: true), ["conto", "import", "investimento", "obiettivo"])
    #expect(StartChecklist.newlyDone(before: [.conto], now) == [.import])
    #expect(StartChecklist.newlyDone(before: [.conto, .import], now).isEmpty)
}

@Test func OV031_goalsInviteHiddenWhileChecklistShows() {
    let empty = GoalsView(currency: "EUR", goals: [])
    #expect(GoalsTile.mode(empty, inviteDismissed: false) == .invite)
    #expect(GoalsTile.mode(empty, inviteDismissed: false, checklistShown: true) == .hidden)
}

@Test func AUTH058_focusOptions() {
    #expect(StartFocus.options(pensionAvailable: true).count == 4)
    #expect(!StartFocus.options(pensionAvailable: false).contains(.pensione))
}

@Test func SHELL036_noFireHintForANewUser() {
    #expect(SidebarInsights.fireState(SidebarFire(currency: "EUR", wealth: 0, target: nil, progress: nil, yearsToFire: nil)) == .hidden)
    #expect(SidebarInsights.fireState(SidebarFire(currency: "EUR", wealth: 1200, target: nil, progress: nil, yearsToFire: nil)) == .invite)
}

// MARK: Liquidità without accounts, chart refresh (web #444, #447)

@Test func TX022_tabsWithoutAccounts() {
    #expect(LiquidityNoAccounts.content(.movements)?.title == "Prima serve un conto")
    #expect(LiquidityNoAccounts.content(.analysis)?.title == "Qui vedrai dove vanno i soldi")
    #expect(LiquidityNoAccounts.content(.subscriptions)?.title == "Qui troverai i tuoi abbonamenti")
    #expect(LiquidityNoAccounts.content(.accounts) == nil)
    #expect(LiquidityNoAccounts.applies(0))
    #expect(!LiquidityNoAccounts.applies(nil))
}

@Test func OV044_TX076_chartRefresh() {
    let t = { (s: TimeInterval) in Date(timeIntervalSince1970: s) }
    #expect(ChartRefresh.state(importing: true, pendingSince: nil, dataUpdatedAt: t(0), isFetching: false) == .importing)
    #expect(ChartRefresh.state(importing: false, pendingSince: t(100), dataUpdatedAt: t(50), isFetching: false) == .updating)
    #expect(ChartRefresh.state(importing: false, pendingSince: t(100), dataUpdatedAt: t(150), isFetching: true) == .updating)
    #expect(ChartRefresh.state(importing: false, pendingSince: t(100), dataUpdatedAt: t(150), isFetching: false) == nil)
    #expect(ChartRefresh.isSettled(pendingSince: t(100), dataUpdatedAt: t(150), isFetching: false))
    #expect(ChartRefresh.freshPending(t(0), now: t(ChartRefresh.pendingMaxAge + 1)) == nil)
    #expect(ChartRefresh.State.updating.message == "Aggiorno il grafico con i nuovi movimenti…")
}

// MARK: «Dall'ultima visita» (web #457)

@Test func SHELL059_welcomeToast() throws {
    let join: ([String]) -> String = { BBFormat.formatList($0, locale: itIT) }
    let summary = WelcomeSummary(since: "2026-10-18T10:00:00.000Z",
                                 happened: [WelcomeItem(kind: "movements", count: 12), WelcomeItem(kind: "price_alerts", count: 1)],
                                 waiting: [WelcomeItem(kind: "to_decide", count: 7), WelcomeItem(kind: "import_review", count: 1, jobId: "j1")])
    let content = try #require(WelcomeText.content(summary, tr: tr, join: join))
    #expect(content.lines == ["Mentre eri via: 12\u{00a0}movimenti nuovi e 1\u{00a0}avviso di prezzo scattato",
                              "Da sistemare: 7\u{00a0}movimenti senza categoria e 1\u{00a0}import da controllare"])
    #expect(content.actionLabel == "Decidi")
    #expect(content.actionPath == "/categorizza")
    let onlyHappened = try #require(WelcomeText.content(WelcomeSummary(since: "x", happened: [WelcomeItem(kind: "price_rises", count: 2)]), tr: tr, join: join))
    #expect(onlyHappened.actionLabel == "Vedi")
    #expect(onlyHappened.actionPath == "/liquidita/abbonamenti")
    #expect(WelcomeText.content(WelcomeSummary(since: "x"), tr: tr, join: join) == nil)
    #expect(WelcomeText.path(WelcomeItem(kind: "import_review", count: 1, jobId: "j1")) == "/importazioni?job=j1")
}

// MARK: Imports (web #456, #461)

@Test func IMP030_receiptSummary() {
    func r(_ rows: Int?, _ present: Int?, bank: Int = 0) -> PersonalImportListing.Results {
        PersonalImportListing.Results(cash: 3, investments: 0, skipped: 0, bankCategorized: bank, rows: rows, alreadyPresent: present)
    }
    #expect(PersonalImportRules.importSummary(r(40, 40)).template == "Tutti i {0} movimenti del file c'erano già: non abbiamo aggiunto niente.")
    #expect(PersonalImportRules.importSummary(r(1, 1)).template == "Il movimento del file c'era già: non abbiamo aggiunto niente.")
    #expect(PersonalImportRules.importSummary(r(40, 12)).values == ["0": "28", "1": "40"])
    #expect(PersonalImportRules.importSummary(r(nil, nil)).template == "I dati sono già nel tuo conto.")
    #expect(PersonalImportRules.receiptTitle("imported", results: r(5, 5)) == "Niente di nuovo da importare")
    #expect(!PersonalImportRules.showsAddedLines(r(5, 5)))
    // Bank categories (web #456) and the generic line only for older jobs.
    #expect(PersonalImportRules.receiptNotes(r(10, 0, bank: 4)).map(\.template)
        == ["{0} movimenti hanno già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi."])
    #expect(PersonalImportRules.receiptNotes(r(nil, nil)).last?.template == "Le righe già presenti sono state saltate, senza doppioni.")
}

@Test func IMP063_listAndIsland() {
    let nothing = PersonalImportListing.Job(id: "j", formatId: "f", status: "imported", createdAt: "",
                                            results: PersonalImportListing.Results(cash: 0, investments: 0, skipped: 0, rows: 8, alreadyPresent: 8))
    #expect(PersonalImportRules.describe(nothing).message.template == "Niente di nuovo: {0} movimenti c'erano già")
    let island = PersonalImportRules.islandText(nothing, source: "Banca")
    #expect(island.title.template == "{0}: niente di nuovo")
    #expect(island.detail.template == "I movimenti c'erano già tutti.")
    let partial = PersonalImportListing.Job(id: "j", formatId: "f", status: "imported", createdAt: "",
                                            results: PersonalImportListing.Results(cash: 0, investments: 0, skipped: 0, rows: 8, alreadyPresent: 3))
    #expect(PersonalImportRules.describe(partial).message.values == ["0": "5", "1": "8"])
}

@Test func IMP062_alreadyImportedIsANotice() {
    #expect(ImportAPIFailure(message: "Questo file è già stato importato", status: 409, code: "already_imported").alreadyImported)
    #expect(!ImportAPIFailure(message: "x", status: 400).alreadyImported)
}

@Test func IMP049_correctionsOffUntilTheWebShipsThem() {
    #expect(!PersonalImportRules.correctionsEnabled)
}

// MARK: Budgets (web #432)

@Test func CAT099_CAT100_budgetField() {
    #expect(CategoryBudgetField.commit("1.250,50", saved: nil, locale: itIT) == .save(1250.5))
    #expect(CategoryBudgetField.commit("300", saved: 250, locale: itIT) == .save(300))
    #expect(CategoryBudgetField.commit("1,250.50", saved: nil, locale: BBLocale(language: .en)) == .save(1250.5))
    #expect(CategoryBudgetField.commit("300", saved: 300, locale: itIT) == .unchanged)
    #expect(CategoryBudgetField.commit(" ", saved: 300, locale: itIT) == .remove)
    #expect(CategoryBudgetField.commit("", saved: nil, locale: itIT) == .unchanged)
    #expect(CategoryBudgetField.commit("-5", saved: nil, locale: itIT) == .invalid)
    #expect(CategoryBudgetField.commit("abc", saved: nil, locale: itIT) == .invalid)
    #expect(CategoryBudgetField.appliesTo(type: .dovuta, isFallback: false))
    #expect(!CategoryBudgetField.appliesTo(type: .entrata, isFallback: false))
    #expect(!CategoryBudgetField.appliesTo(type: .dovuta, isFallback: true))
    #expect(CategoryBudgetField.inputText(1250.5, locale: itIT) == "1250,5")
}

// MARK: Goals (web #382)

@Test func GOAL017_emergencyFundFromMonthlySpending() {
    var draft = GoalWizard.withKind(GoalDraft(), .emergenza, essentialMonthly: nil)
    #expect(draft.emergencyMonths == 6)
    #expect(draft.target == nil)
    draft = GoalWizard.withMonthlySpend(draft, value: 1430)
    #expect(draft.target == 8600)
    draft = GoalWizard.withEmergencyMonths(draft, months: 3, essentialMonthly: 2000)
    #expect(draft.target == 4300)
    #expect(GoalWizard.spendNote(draft, essentialBasis: "dovute") == "Scrivi quanto spendi in un mese: la cifra si aggiorna da sola.")
    let computed = GoalWizard.withKind(GoalDraft(), .emergenza, essentialMonthly: 1428)
    #expect(computed.target == 8600)
    #expect(GoalWizard.spendNote(computed, essentialBasis: "tutte").hasPrefix("Media di tutte le tue uscite"))
}

@Test func GOAL006_suggestionByBasis() {
    #expect(GoalsRules.emergencySuggestionSource(GoalsView(currency: "EUR", goals: [], essentialBasis: "tutte")).hasPrefix("Con {0} mesi delle tue spese"))
    #expect(GoalsRules.emergencySuggestionSource(GoalsView(currency: "EUR", goals: [], essentialBasis: "dovute")).hasPrefix("Con {0} mesi di spese dovute"))
}

// MARK: Investments (web #438, #445, #448)

@Test func INV111_heldInstruments() throws {
    // The spec fixture plus the field the server sends since web #445.
    var raw = try JSONSerialization.jsonObject(with: try fixture("investments-view.json")) as! [String: Any]
    raw["heldInstrumentIds"] = ["a"]
    let view = try JSONDecoder().decode(InvestmentsView.self, from: try JSONSerialization.data(withJSONObject: raw))
    #expect(view.heldInstrumentIds == ["a"])
}

@Test func INV112_quantitiesPricesAndFeesMasked() {
    let masked = InvestmentsText(locale: itIT, masked: true) { $0 }
    #expect(masked.quantity(3.5) == BBFormat.amountMask)
    #expect(masked.price(101.2, "EUR") == BBFormat.amountMask)
    #expect(InvestmentsText(locale: itIT) { $0 }.quantity(3.5) == "3,5")
}

@Test func SEC_etcShowsItsIssuer() {
    let etc = InstrumentIcons.spec(type: .etc, name: "iShares Physical Gold")
    #expect(etc == InstrumentIcons.spec(type: .etf, name: "iShares Physical Gold"))
    #expect(InstrumentIcons.wantsRemoteLogo(type: .etc, name: "iShares Physical Gold"))
}

// MARK: Sign-in, locale, AI settings (web #394, #397, #398, #460)

@Test func AUTH059_maskedEmail() {
    #expect(ReturningUser.mask("daniele@gmail.com") == "dan•••@gmail.com")
    #expect(ReturningUser.mask("ab@b.it") == "a•••@b.it")
    #expect(ReturningUser.parse("not-an-email") == nil)
    #expect(ReturningUser.parse(" x@y.z ") == "x@y.z")
}

@Test func AUTH060_languagePreview() {
    let today = CalendarDate(year: 2026, month: 10, day: 20)
    // Italian does not group four-digit numbers (Intl `minimumGroupingDigits`), German does.
    #expect(LocaleRules.languagePreview("it", currency: "EUR", today: today) == "20 ott 2026 · 1234,56\u{00a0}€")
    #expect(LocaleRules.languagePreview("de", currency: "EUR", today: today) == "20. Okt. 2026 · 1.234,56\u{00a0}€")
    #expect(LocaleRules.countryOf("de") == "DE")
    #expect(LocaleRules.allLanguages == ["it", "en", "de"])
}

@Test func SET050_whereTheAppUsesAi() {
    #expect(AiUsage.items.count == 3)
    #expect(AiUsage.items.first?.title == "Proposte di categoria")
    #expect(AiUsage.zeroDataRetention.hasPrefix("Zero data retention"))
}
