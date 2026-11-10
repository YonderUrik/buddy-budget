import Foundation
import Testing
@testable import BuddyBudgetKit

private func bootstrap(gate: String?, completed: Bool = true, needsLegal: Bool = false, deactivated: Bool = false,
                       pension: Bool = true, analytics: Bool = true) throws -> MeBootstrap {
    var json = try JSONSerialization.jsonObject(with: try fixture("me-bootstrap.json")) as! [String: Any]
    json["gate"] = gate ?? NSNull()
    json["onboarding"] = ["completed": completed]
    var legal = json["legal"] as! [String: Any]
    legal["needsAcceptance"] = needsLegal
    json["legal"] = legal
    var account = json["account"] as! [String: Any]
    account["deactivated"] = deactivated
    json["account"] = account
    var caps = json["capabilities"] as! [String: Any]
    var sections = caps["sections"] as! [String: Any]
    sections["pension"] = pension
    sections["analytics"] = analytics
    caps["sections"] = sections
    json["capabilities"] = caps
    return try JSONDecoder().decode(MeBootstrap.self, from: JSONSerialization.data(withJSONObject: json))
}

// MARK: Route gate

@Test func SHELL001_noTokenShowsLogin() {
    #expect(AppRoute.resolve(hasToken: false, bootstrap: nil) == .signedOut)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: nil) == .launching)
}

@Test func AUTH022_gateOrderFollowsBootstrap() throws {
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "account_deactivated")) == .accountDeactivated)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "legal_acceptance_required")) == .legalAcceptance)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "onboarding_required", completed: false)) == .onboarding)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: nil)) == .main)
}

@Test func AUTH022_unknownGateFallsBackToFieldsInProxyOrder() throws {
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "future", deactivated: true)) == .accountDeactivated)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "future", needsLegal: true)) == .legalAcceptance)
    #expect(AppRoute.resolve(hasToken: true, bootstrap: try bootstrap(gate: "future", completed: false, needsLegal: true)) == .onboarding)
}

// MARK: Home & navigation

@Test func SHELL005_homePageMapping() {
    #expect(HomePage.resolve("/panoramica") == .overview)
    #expect(HomePage.resolve("/liquidita/conti") == .accounts)
    #expect(HomePage.resolve("/conti") == .accounts)
    #expect(HomePage.resolve("/movimenti") == .liquidity)
    #expect(HomePage.resolve("/movimenti/analisi") == .spendingAnalysis)
    #expect(HomePage.resolve("/debiti") == .overview)
    #expect(HomePage.resolve(nil) == .overview)
    #expect(HomePage.resolve("/investimenti") == .investments)
}

@Test func SHELL012_primarySectionsInOrderFilteredByCountry() {
    let it = MeBootstrap.Sections()
    #expect(Navigation.primarySections(it) == [.overview, .liquidity, .investments, .pension, .debts, .analytics])
    let de = MeBootstrap.Sections(pension: false, analytics: false, goals: false, fire: false)
    #expect(Navigation.primarySections(de) == [.overview, .liquidity, .investments, .debts])
}

@Test func SHELL013_bottomBarTabs() {
    #expect(Navigation.tabs(MeBootstrap.Sections()) == [.overview, .liquidity, .investments, .debts, .more])
    #expect(AppTab.more.title == "Altro")
    #expect(AppTab.more.iconKey == "ellipsis")
}

@Test func SHELL018_SHELL019_otherSections() {
    #expect(Navigation.otherSections(MeBootstrap.Sections()) == [.pension, .analytics])
    #expect(Navigation.otherSections(MeBootstrap.Sections(pension: false, analytics: false)).isEmpty)
}

@Test func SHELL014_destinationsOutsideBottomBarBelongToMore() {
    #expect(AppDestination.settings.tab == .more)
    #expect(AppDestination.accounts.tab == .liquidity)
    #expect(AppDestination(path: "/analitiche/obiettivi?nuovo=1") == .analytics)
    #expect(AppDestination(path: "/liquidita/conti?rinnova=sidebar") == .accounts)
    #expect(AppDestination(path: "/nope") == nil)
}

@Test func SHELL008_deHidesPensionAndAnalytics() {
    let de = MeBootstrap.Sections(pension: false, analytics: false)
    #expect(!AppDestination.pension.isAvailable(in: de))
    #expect(!AppDestination.analytics.isAvailable(in: de))
    #expect(AppDestination.investments.isAvailable(in: de))
}

@Test func initials() {
    #expect(Initials.of("Giulia Demo") == "GD")
    #expect(Initials.of("mario") == "M")
    #expect(Initials.of("Anna Maria Rossi") == "AM")
    #expect(Initials.of("") == "")
}

// MARK: Locale rules

@Test func SHELL006_localeRules() {
    #expect(LocaleRules.languages(country: "IT") == ["it", "en"])
    #expect(LocaleRules.languages(country: "DE") == ["en", "de"])
    #expect(LocaleRules.resolveCountry("de") == "IT")
    #expect(LocaleRules.resolveCountry("DE") == "DE")
}

@Test func AUTH027_switchingCountryForcesEnglishWhenUnsupported() {
    #expect(LocaleRules.languageAfterSwitching(to: "DE", current: "it") == "en")
    #expect(LocaleRules.languageAfterSwitching(to: "DE", current: "en") == "en")
    #expect(LocaleRules.languageAfterSwitching(to: "IT", current: "de") == "en")
    #expect(LocaleRules.languageAfterSwitching(to: "IT", current: "it") == "it")
}

// MARK: Sign-in

@Test func AUTH003_emailValidation() {
    #expect(SignIn.isValidEmail("mobile-dev@buddybudget.test"))
    #expect(SignIn.isValidEmail("  a.b+c@d.it "))
    #expect(!SignIn.isValidEmail("a@"))
    #expect(!SignIn.isValidEmail("a b@c.it"))
    #expect(!SignIn.isValidEmail("nome"))
    #expect(SignIn.normalizeEmail(" Mario@Example.COM ") == "mario@example.com")
}

@Test func otpSanitize() {
    #expect(SignIn.sanitizeCode("482 913") == "482913")
    #expect(SignIn.sanitizeCode("Codice: 4829137") == "482913")
    #expect(SignIn.isCompleteCode("482913"))
    #expect(!SignIn.isCompleteCode("48291"))
}

@Test func AUTH007_sendErrors() {
    #expect(SignIn.sendFailure(APIError.http(APIErrorBody(status: 429))) == .rateLimited)
    #expect(SignIn.sendFailure(APIError.transport("offline")) == .network)
    #expect(SignIn.sendFailure(APIError.http(APIErrorBody(status: 500))) == .sendFailed)
    #expect(SignIn.Failure.rateLimited.message == "Troppi tentativi ravvicinati. Riprova tra qualche minuto.")
}

@Test func otpVerifyErrorsMapToCatalogStrings() {
    #expect(SignIn.verifyFailure(APIError.http(APIErrorBody(status: 400, code: .invalidOTP))) == .wrongCode)
    #expect(SignIn.verifyFailure(APIError.http(APIErrorBody(status: 400, code: .otpExpired))) == .codeExpired)
    #expect(SignIn.verifyFailure(APIError.http(APIErrorBody(status: 403, code: .tooManyAttempts))) == .codeBurnt)
    #expect(SignIn.verifyFailure(APIError.http(APIErrorBody(status: 429))) == .rateLimited)
    #expect(SignIn.Failure.codeBurnt.needsNewCode)
    #expect(!SignIn.Failure.wrongCode.needsNewCode)
}

@Test func AUTH005_resendCountdown() {
    let sent = Date(timeIntervalSince1970: 1000)
    let cooldown = ResendCooldown(sentAt: sent)
    #expect(cooldown.remaining(at: sent) == 30)
    #expect(cooldown.remaining(at: sent.addingTimeInterval(0.4)) == 30)
    #expect(cooldown.remaining(at: sent.addingTimeInterval(29.5)) == 1)
    #expect(cooldown.remaining(at: sent.addingTimeInterval(31)) == 0)
}

// MARK: Onboarding

@Test func AUTH024_stepsDependOnAi() {
    #expect(OnboardingStep.steps(aiAvailable: true).map(\.rawValue) == ["valuta", "interessi", "categorie", "assistente", "notifiche", "conferme"])
    #expect(OnboardingStep.steps(aiAvailable: false).count == 5)
}

@Test func AUTH030_proposal() {
    let proposal = CategorySetup.proposal()
    #expect(proposal.count == 29)
    #expect(CategorySetup.activeCount(proposal) == 24)
    #expect(proposal.filter(\.optional).count == 5)
    #expect(CategorySetup.proposal(country: "DE").first { $0.key == "tasse" }?.description == "Imposte e tributi")
    #expect(CategorySetup.groups.map(\.type) == ["dovuta", "voluta", "futuro", "saltuaria", "trasferimento", "entrata"])
}

@Test func AUTH032_validation() {
    var items = CategorySetup.proposal()
    #expect(CategorySetup.rename(&items, at: 0, to: "Spesa")?.source == "«{0}» c'è già.")
    #expect(CategorySetup.rename(&items, at: 0, to: "da categorizzare")?.value == "da categorizzare")
    #expect(CategorySetup.rename(&items, at: 0, to: String(repeating: "x", count: 41))?.value == String(repeating: "x", count: 20))
    #expect(items[0].name == "Affitto & Mutuo")
    #expect(CategorySetup.rename(&items, at: 24, to: "Figli") == nil)
    #expect(items[24].enabled)
    #expect(CategorySetup.add(&items, type: "voluta", name: "Gatti") == nil)
    #expect(items.last?.icon == "package")
    #expect(CategorySetup.add(&items, type: "voluta", name: " gatti ")?.source == "«{0}» c'è già.")
    items[1].name = " "
    #expect(CategorySetup.validate(items)?.source == "Ogni categoria accesa deve avere un nome.")
}

@Test func AUTH033_customizedAgainstSameLanguageProposal() {
    let proposal = CategorySetup.localizedProposal(country: "IT") { $0 == "Spesa" ? "Groceries" : $0 }
    var items = proposal
    #expect(!CategorySetup.isCustomized(items, proposal: proposal))
    #expect(CategorySetup.payload(items, proposal: proposal) == nil)
    items[0].enabled = false
    #expect(CategorySetup.isCustomized(items, proposal: proposal))
    #expect(CategorySetup.payload(items, proposal: proposal)?.count == 29)
}

@Test func AUTH036_AUTH037_inboxPreview() {
    var prefs = NotificationPreferences.defaults
    #expect(NotificationChoices.inboxPreview(prefs).isEmpty)
    prefs.digestEnabled = true
    prefs.budgetAlertsEnabled = true
    prefs.deadlineAlertsEnabled = true
    let items = NotificationChoices.inboxPreview(prefs)
    #expect(items.map(\.title) == ["Riepilogo del mese", "Avvisi sul budget", "Avvisi sulle scadenze"])
    #expect(items[1].whenValues == ["80", "100"])
    prefs.digestFrequency = .settimanale
    #expect(NotificationChoices.inboxPreview(prefs)[0].when == "Ogni lunedì")
}

@Test func AUTH038_legalConsentNeedsAllThree() {
    var consent = LegalConsent()
    consent.ageConfirmed = true
    consent.termsAccepted = true
    #expect(consent.payload(version: "v") == nil)
    consent.specificClausesAccepted = true
    #expect(consent.payload(version: "2026-10-12") == LegalAcceptance(version: "2026-10-12"))
}

// MARK: Settings

@Test func SET003_deepLinks() {
    #expect(SettingsGroup.from(deepLink: "/impostazioni?sezione=notifiche#impostazioni-notifiche") == .notifiche)
    #expect(SettingsGroup.from(deepLink: "/impostazioni#impostazioni-zona-pericolosa") == .pericolo)
    #expect(SettingsGroup.from(deepLink: "/impostazioni?sezione=boh") == nil)
    #expect(SettingsGroup.from(deepLink: "/impostazioni") == nil)
    #expect(SettingsGroup.allCases.map(\.rawValue) == ["account", "aspetto", "notifiche", "privacy", "pericolo"])
}

@Test func SET023_SET024_notificationKinds() {
    #expect(NotificationKind.settings(goalsAvailable: true).count == 4)
    #expect(NotificationKind.settings(goalsAvailable: false) == [.digest, .budget, .deadlines])
}

@Test func SET039_recentLogin() {
    let now = ISODate.parse("2026-10-18T09:35:00.000Z")!
    #expect(RecentLogin.isRecent(until: "2026-10-18T09:40:00.000Z", now: now))
    #expect(!RecentLogin.isRecent(until: "2026-10-18T09:30:00Z", now: now))
    #expect(!RecentLogin.isRecent(until: nil, now: now))
}

@Test func SET043_SET046_typedConfirmations() {
    #expect(DangerConfirmation.resetMatches("RESETTA"))
    #expect(!DangerConfirmation.resetMatches("resetta"))
    #expect(DangerConfirmation.deleteMatches("  Mario@Example.com ", email: "mario@example.com"))
    #expect(!DangerConfirmation.deleteMatches("mario@example.it", email: "mario@example.com"))
}

@Test func SET037_dataSummaryKeepsZerosAndPlurals() {
    let summary = UserDataSummary(accounts: 1, bankConnections: 0, transactions: 345, categories: 25, rules: 1, budgets: 1,
                                  investmentOperations: 0, debts: 3, pensionFunds: 1, netWorthDays: 0)
    let items = DataSummaryItems.items(summary)
    #expect(items.count == 10)
    #expect(items[0].label == "conto")
    #expect(items[1].label == "banche collegate")
    #expect(items[5].label == "budget")
    #expect(items[9].value == 0)
}

@Test func SET036_privacyRequestMailto() {
    let mailto = PrivacyRequest.options[0].mailto(accountEmail: "a@b.it")
    #expect(mailto.hasPrefix("mailto:privacy@buddybudget.io?subject=Richiesta%20privacy%3A%20Correggere%20un%20dato&body="))
    #expect(mailto.contains("a%40b.it"))
    #expect(PrivacyRequest.options.map(\.article) == ["art. 16", "art. 18", "art. 21", "art. 15"])
}
