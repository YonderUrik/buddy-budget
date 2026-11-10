package io.buddybudget.core

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorBody
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.DigestFrequency
import io.buddybudget.core.data.LegalAcceptance
import io.buddybudget.core.data.LegalConsent
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.data.UserDataSummary
import io.buddybudget.core.domain.auth.ResendCooldown
import io.buddybudget.core.domain.auth.SignIn
import io.buddybudget.core.domain.onboarding.CategorySetup
import io.buddybudget.core.domain.onboarding.NotificationChoices
import io.buddybudget.core.domain.onboarding.NotificationKind
import io.buddybudget.core.domain.onboarding.OnboardingStep
import io.buddybudget.core.domain.settings.DangerConfirmation
import io.buddybudget.core.domain.settings.DataSummaryItems
import io.buddybudget.core.domain.settings.IsoDate
import io.buddybudget.core.domain.settings.PrivacyRequest
import io.buddybudget.core.domain.settings.RecentLogin
import io.buddybudget.core.domain.settings.SettingsGroup
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.shell.AppRoute
import io.buddybudget.core.domain.shell.AppTab
import io.buddybudget.core.domain.shell.HomePage
import io.buddybudget.core.domain.shell.Initials
import io.buddybudget.core.domain.shell.LocaleRules
import io.buddybudget.core.domain.shell.Navigation
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ShellAuthSettingsTest {
    private fun bootstrap(
        gate: String?, completed: Boolean = true, needsLegal: Boolean = false, deactivated: Boolean = false,
    ): MeBootstrap {
        val base = fixtureJson("me-bootstrap.json").jsonObject.toMutableMap()
        base["gate"] = gate?.let(::JsonPrimitive) ?: JsonNull
        base["onboarding"] = JsonObject(mapOf("completed" to JsonPrimitive(completed)))
        base["legal"] = JsonObject(base.getValue("legal").jsonObject + ("needsAcceptance" to JsonPrimitive(needsLegal)))
        base["account"] = JsonObject(base.getValue("account").jsonObject + ("deactivated" to JsonPrimitive(deactivated)))
        return ApiClient.DefaultJson.decodeFromJsonElement(MeBootstrap.serializer(), JsonObject(base))
    }

    // Route gate

    @Test fun SHELL001_noTokenShowsLogin() {
        assertEquals(AppRoute.SignedOut, AppRoute.resolve(false, null))
        assertEquals(AppRoute.Launching, AppRoute.resolve(true, null))
    }

    @Test fun AUTH022_gateOrderFollowsBootstrap() {
        assertEquals(AppRoute.AccountDeactivated, AppRoute.resolve(true, bootstrap("account_deactivated")))
        assertEquals(AppRoute.LegalAcceptance, AppRoute.resolve(true, bootstrap("legal_acceptance_required")))
        assertEquals(AppRoute.Onboarding, AppRoute.resolve(true, bootstrap("onboarding_required", completed = false)))
        assertEquals(AppRoute.Main, AppRoute.resolve(true, bootstrap(null)))
    }

    @Test fun AUTH022_unknownGateFallsBackToFieldsInProxyOrder() {
        assertEquals(AppRoute.AccountDeactivated, AppRoute.resolve(true, bootstrap("future", deactivated = true)))
        assertEquals(AppRoute.LegalAcceptance, AppRoute.resolve(true, bootstrap("future", needsLegal = true)))
        assertEquals(AppRoute.Onboarding, AppRoute.resolve(true, bootstrap("future", completed = false, needsLegal = true)))
    }

    // Home & navigation

    @Test fun SHELL005_homePageMapping() {
        assertEquals(AppDestination.Overview, HomePage.resolve("/panoramica"))
        assertEquals(AppDestination.Accounts, HomePage.resolve("/liquidita/conti"))
        assertEquals(AppDestination.Accounts, HomePage.resolve("/conti"))
        assertEquals(AppDestination.Liquidity, HomePage.resolve("/movimenti"))
        assertEquals(AppDestination.SpendingAnalysis, HomePage.resolve("/movimenti/analisi"))
        assertEquals(AppDestination.Overview, HomePage.resolve("/debiti"))
        assertEquals(AppDestination.Overview, HomePage.resolve(null))
        assertEquals(AppDestination.Investments, HomePage.resolve("/investimenti"))
    }

    @Test fun SHELL012_primarySectionsInOrderFilteredByCountry() {
        assertEquals(
            listOf(AppDestination.Overview, AppDestination.Liquidity, AppDestination.Investments, AppDestination.Pension, AppDestination.Debts, AppDestination.Analytics),
            Navigation.primarySections(MeBootstrap.Sections()),
        )
        // SHELL-061 (#465): a section closed in the country stays in place, locked.
        val de = MeBootstrap.Sections(pension = false, financialPlanning = true)
        assertEquals(Navigation.primarySections(MeBootstrap.Sections()), Navigation.primarySections(de))
    }

    @Test fun SHELL013_bottomBarTabs() {
        assertEquals(listOf(AppTab.Overview, AppTab.Liquidity, AppTab.Investments, AppTab.Debts, AppTab.More), Navigation.tabs(MeBootstrap.Sections()))
        assertEquals("Altro", AppTab.More.title)
        assertEquals("ellipsis", AppTab.More.iconKey)
    }

    @Test fun SHELL018_SHELL019_otherSections() {
        assertEquals(listOf(AppDestination.Pension, AppDestination.Analytics), Navigation.otherSections(MeBootstrap.Sections()))
        assertEquals(listOf(AppDestination.Pension, AppDestination.Analytics), Navigation.otherSections(MeBootstrap.Sections(pension = false)))
    }

    @Test fun SHELL061_pensionLockedWithPrestoOutsideItaly() {
        val it = MeBootstrap.Sections(financialPlanning = false)
        val de = MeBootstrap.Sections(pension = false)
        val other = MeBootstrap.Sections(pension = false, investmentTaxes = false, financialPlanning = false)
        assertFalse(AppDestination.Pension.isLocked(it))
        for (sections in listOf(de, other)) {
            assertTrue(AppDestination.Pension.isLocked(sections))
            // Germany and «Altro paese» keep Analitiche (and goals) since #465.
            assertFalse(AppDestination.Analytics.isLocked(sections))
            // A locked section never enters the bottom bar.
            assertEquals(listOf(AppTab.Overview, AppTab.Liquidity, AppTab.Investments, AppTab.Debts, AppTab.More), Navigation.tabs(sections))
        }
        assertEquals("Presto", Navigation.LOCK_BADGE)
        assertEquals("Non ancora disponibile nel tuo paese", Navigation.LOCK_HINT)
    }

    @Test fun SHELL010_countryUnavailableCopyAndNotes() {
        assertEquals("Non ancora disponibile nel tuo paese. Arriverà presto.", AppDestination.CountryUnavailable.title)
        assertNull(LocaleRules.unavailableNote("IT"))
        assertEquals("Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati.", LocaleRules.unavailableNote("DE"))
        assertEquals("Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona.", LocaleRules.unavailableNote("OTHER"))
    }

    @Test fun SHELL056_gate403MidSessionRoutesToTheGateScreen() {
        assertEquals(AppRoute.LegalAcceptance, AppRoute.forGateError(ApiErrorCode.LegalAcceptanceRequired, AppRoute.Main))
        assertEquals(AppRoute.AccountDeactivated, AppRoute.forGateError(ApiErrorCode.AccountDeactivated, AppRoute.Main))
        assertEquals(AppRoute.AccountDeactivated, AppRoute.forGateError(ApiErrorCode.AccountDeactivated, AppRoute.LegalAcceptance))
        // Other 403s are the screen's own business; signed out / launching never re-route.
        assertNull(AppRoute.forGateError(ApiErrorCode.CountryFeatureUnavailable, AppRoute.Main))
        assertNull(AppRoute.forGateError(ApiErrorCode.LegalAcceptanceRequired, AppRoute.SignedOut))
        assertNull(AppRoute.forGateError(ApiErrorCode.LegalAcceptanceRequired, AppRoute.Launching))
        assertNull(AppRoute.forGateError(ApiErrorCode.LegalAcceptanceRequired, AppRoute.Onboarding))
    }

    @Test fun SHELL056_backFromAGateReloadsTheShell() {
        assertTrue(AppRoute.reloadsShell(AppRoute.LegalAcceptance, AppRoute.Main))
        assertTrue(AppRoute.reloadsShell(AppRoute.AccountDeactivated, AppRoute.Main))
        assertFalse(AppRoute.reloadsShell(AppRoute.Main, AppRoute.Main))
        assertFalse(AppRoute.reloadsShell(AppRoute.LegalAcceptance, AppRoute.LegalAcceptance))
    }

    @Test fun IMP068_aSecondLaunchOnALiveSessionKeepsTheShell() {
        assertTrue(AppRoute.keepsRouteOnLaunch(AppRoute.Main, hasBootstrap = true))
        assertTrue(AppRoute.keepsRouteOnLaunch(AppRoute.Onboarding, hasBootstrap = true))
        assertFalse(AppRoute.keepsRouteOnLaunch(AppRoute.Launching, hasBootstrap = false))
        assertFalse(AppRoute.keepsRouteOnLaunch(AppRoute.SignedOut, hasBootstrap = false))
        assertFalse(AppRoute.keepsRouteOnLaunch(AppRoute.Main, hasBootstrap = false))
    }

    @Test fun SHELL014_destinationsOutsideBottomBarBelongToMore() {
        assertEquals(AppTab.More, AppDestination.Settings.tab)
        assertEquals(AppTab.Liquidity, AppDestination.Accounts.tab)
        assertEquals(AppDestination.Analytics, AppDestination.fromPath("/analitiche/obiettivi?nuovo=1"))
        assertEquals(AppDestination.Accounts, AppDestination.fromPath("/liquidita/conti?rinnova=sidebar"))
        assertNull(AppDestination.fromPath("/nope"))
    }

    @Test fun SHELL008_onlyPensionClosedOutsideItaly() {
        val de = MeBootstrap.Sections(pension = false)
        assertFalse(AppDestination.Pension.isAvailable(de))
        assertTrue(AppDestination.Analytics.isAvailable(de))
        assertTrue(AppDestination.Investments.isAvailable(de))
    }


    @Test fun initials() {
        assertEquals("GD", Initials.of("Giulia Demo"))
        assertEquals("M", Initials.of("mario"))
        assertEquals("AM", Initials.of("Anna Maria Rossi"))
        assertEquals("", Initials.of(""))
    }

    // Locale rules

    @Test fun SHELL006_localeRules() {
        assertEquals(listOf("it", "en"), LocaleRules.languages("IT"))
        assertEquals(listOf("en", "de"), LocaleRules.languages("DE"))
        assertEquals(listOf("en", "it", "de"), LocaleRules.languages("OTHER"))
        assertEquals("IT", LocaleRules.resolveCountry("de"))
        assertEquals("DE", LocaleRules.resolveCountry("DE"))
        assertEquals("OTHER", LocaleRules.resolveCountry("OTHER"))
        assertEquals("IT", LocaleRules.resolveCountry("US"))
        assertEquals(listOf("IT", "DE", "OTHER"), LocaleRules.countries)
        assertEquals(listOf("Italia", "Germania", "Altro paese"), LocaleRules.countries.map(LocaleRules::countryLabel))
        assertEquals(listOf("IT", "DE", "WORLD"), LocaleRules.countries.map(LocaleRules::flagCode))
    }

    @Test fun AUTH061_proposedProfileFromDeviceRegion() {
        fun p(region: String?, langs: List<String>, chosen: String? = null) = LocaleRules.proposedProfile(region, langs, chosen)
        // Web `detectProfile` vectors (lib/localization/config.test.ts).
        assertEquals("IT" to "it", p("IT", listOf("en-US")))
        assertEquals("OTHER" to "it", p("SM", listOf("it-SM")))
        assertEquals("DE" to "de", p("DE", listOf("it-IT")))
        assertEquals("OTHER" to "de", p("AT", listOf("de-AT")))
        assertEquals("OTHER" to "it", p("CH", listOf("it-CH", "de-CH")))
        assertEquals("OTHER" to "de", p("CH", listOf("fr-CH")))
        assertEquals("OTHER" to "en", p("US", listOf("it-IT")))
        assertEquals("OTHER" to "en", p("FR", listOf("fr-FR")))
        // No region: the device language decides (German → DE, else IT; only unsupported → English).
        assertEquals("DE" to "de", p(null, listOf("de-DE")))
        assertEquals("IT" to "en", p(null, listOf("fr-FR")))
        assertEquals("IT" to "it", p(null, emptyList()))
        // A language picked by hand wins, keeping the country when it offers it.
        assertEquals("OTHER" to "it", p("US", listOf("en-US"), chosen = "it"))
        assertEquals("IT" to "en", p("IT", listOf("it-IT"), chosen = "en"))
        assertEquals("DE" to "de", p("IT", listOf("it-IT"), chosen = "de"))
    }

    @Test fun AUTH027_switchingCountryForcesEnglishWhenUnsupported() {
        assertEquals("en", LocaleRules.languageAfterSwitching("DE", "it"))
        assertEquals("en", LocaleRules.languageAfterSwitching("DE", "en"))
        assertEquals("en", LocaleRules.languageAfterSwitching("IT", "de"))
        assertEquals("it", LocaleRules.languageAfterSwitching("IT", "it"))
        assertEquals("de", LocaleRules.languageAfterSwitching("OTHER", "de"))
        assertEquals("en", LocaleRules.languageAfterSwitching("IT", "de"))
    }

    // Sign-in

    @Test fun AUTH003_emailValidation() {
        assertTrue(SignIn.isValidEmail("mobile-dev@buddybudget.test"))
        assertTrue(SignIn.isValidEmail("  a.b+c@d.it "))
        assertFalse(SignIn.isValidEmail("a@"))
        assertFalse(SignIn.isValidEmail("a b@c.it"))
        assertFalse(SignIn.isValidEmail("nome"))
        assertEquals("mario@example.com", SignIn.normalizeEmail(" Mario@Example.COM "))
    }

    @Test fun otpSanitize() {
        assertEquals("482913", SignIn.sanitizeCode("482 913"))
        assertEquals("482913", SignIn.sanitizeCode("Codice: 4829137"))
        assertTrue(SignIn.isCompleteCode("482913"))
        assertFalse(SignIn.isCompleteCode("48291"))
    }

    @Test fun AUTH007_sendErrors() {
        assertEquals(SignIn.Failure.RateLimited, SignIn.sendFailure(ApiError.Http(ApiErrorBody(429))))
        assertEquals(SignIn.Failure.Network, SignIn.sendFailure(ApiError.Transport("offline")))
        assertEquals(SignIn.Failure.SendFailed, SignIn.sendFailure(ApiError.Http(ApiErrorBody(500))))
        assertEquals("Troppi tentativi ravvicinati. Riprova tra qualche minuto.", SignIn.Failure.RateLimited.message)
    }

    @Test fun otpVerifyErrorsMapToCatalogStrings() {
        assertEquals(SignIn.Failure.WrongCode, SignIn.verifyFailure(ApiError.Http(ApiErrorBody(400, ApiErrorCode.InvalidOtp))))
        assertEquals(SignIn.Failure.CodeExpired, SignIn.verifyFailure(ApiError.Http(ApiErrorBody(400, ApiErrorCode.OtpExpired))))
        assertEquals(SignIn.Failure.CodeBurnt, SignIn.verifyFailure(ApiError.Http(ApiErrorBody(403, ApiErrorCode.TooManyAttempts))))
        assertEquals(SignIn.Failure.RateLimited, SignIn.verifyFailure(ApiError.Http(ApiErrorBody(429))))
        assertTrue(SignIn.Failure.CodeBurnt.needsNewCode)
        assertFalse(SignIn.Failure.WrongCode.needsNewCode)
    }

    @Test fun AUTH005_resendCountdown() {
        val cooldown = ResendCooldown(1_000_000)
        assertEquals(30, cooldown.remaining(1_000_000))
        assertEquals(30, cooldown.remaining(1_000_400))
        assertEquals(1, cooldown.remaining(1_029_500))
        assertEquals(0, cooldown.remaining(1_031_000))
    }

    // Onboarding

    @Test fun AUTH024_stepsDependOnAi() {
        assertEquals(listOf("valuta", "interessi", "categorie", "assistente", "notifiche", "conferme"), OnboardingStep.steps(true).map { it.raw })
        assertEquals(5, OnboardingStep.steps(false).size)
    }

    @Test fun AUTH030_proposal() {
        val proposal = CategorySetup.proposal()
        assertEquals(29, proposal.size)
        assertEquals(24, CategorySetup.activeCount(proposal))
        assertEquals(5, proposal.count { it.optional })
        assertEquals("Imposte e tributi", CategorySetup.proposal("DE").first { it.key == "tasse" }.description)
        assertEquals(listOf("dovuta", "voluta", "futuro", "saltuaria", "trasferimento", "entrata"), CategorySetup.groups.map { it.type })
    }

    @Test fun AUTH032_validation() {
        var items = CategorySetup.proposal()
        assertEquals("«{0}» c'è già.", CategorySetup.rename(items, 0, "Spesa").second?.source)
        assertEquals("da categorizzare", CategorySetup.rename(items, 0, "da categorizzare").second?.value)
        assertEquals("x".repeat(20), CategorySetup.rename(items, 0, "x".repeat(41)).second?.value)
        assertEquals("Affitto & Mutuo", CategorySetup.rename(items, 0, "Spesa").first[0].name)
        val renamed = CategorySetup.rename(items, 24, "Figli")
        assertNull(renamed.second)
        items = renamed.first
        assertTrue(items[24].enabled)
        val added = CategorySetup.add(items, "voluta", "Gatti")
        assertNull(added.second)
        items = added.first
        assertEquals("package", items.last().icon)
        assertEquals("«{0}» c'è già.", CategorySetup.add(items, "voluta", " gatti ").second?.source)
        items = items.mapIndexed { i, it -> if (i == 1) it.copy(name = " ") else it }
        assertEquals("Ogni categoria accesa deve avere un nome.", CategorySetup.validate(items)?.source)
    }

    @Test fun AUTH033_customizedAgainstSameLanguageProposal() {
        val proposal = CategorySetup.localizedProposal("IT") { if (it == "Spesa") "Groceries" else it }
        assertFalse(CategorySetup.isCustomized(proposal, proposal))
        assertNull(CategorySetup.payload(proposal, proposal))
        val items = proposal.mapIndexed { i, it -> if (i == 0) it.copy(enabled = false) else it }
        assertTrue(CategorySetup.isCustomized(items, proposal))
        assertEquals(29, CategorySetup.payload(items, proposal)?.size)
    }

    @Test fun AUTH036_AUTH037_inboxPreview() {
        var prefs = NotificationPreferences.Defaults
        assertTrue(NotificationChoices.inboxPreview(prefs).isEmpty())
        prefs = prefs.copy(digestEnabled = true, budgetAlertsEnabled = true, deadlineAlertsEnabled = true)
        val items = NotificationChoices.inboxPreview(prefs)
        assertEquals(listOf("Riepilogo del mese", "Avvisi sul budget", "Avvisi sulle scadenze"), items.map { it.title })
        assertEquals(listOf("80", "100"), items[1].whenValues)
        assertEquals("Ogni lunedì", NotificationChoices.inboxPreview(prefs.copy(digestFrequency = DigestFrequency.settimanale))[0].`when`)
    }

    @Test fun AUTH038_legalConsentNeedsAllThree() {
        val partial = LegalConsent(ageConfirmed = true, termsAccepted = true)
        assertNull(partial.payload("v"))
        assertEquals(LegalAcceptance("2026-10-12"), partial.copy(specificClausesAccepted = true).payload("2026-10-12"))
    }

    // Settings

    @Test fun SET003_deepLinks() {
        assertEquals(SettingsGroup.Notifiche, SettingsGroup.fromDeepLink("/impostazioni?sezione=notifiche#impostazioni-notifiche"))
        assertEquals(SettingsGroup.Pericolo, SettingsGroup.fromDeepLink("/impostazioni#impostazioni-zona-pericolosa"))
        assertNull(SettingsGroup.fromDeepLink("/impostazioni?sezione=boh"))
        assertNull(SettingsGroup.fromDeepLink("/impostazioni"))
        assertEquals(listOf("account", "aspetto", "notifiche", "privacy", "pericolo"), SettingsGroup.entries.map { it.id })
    }

    @Test fun SET023_SET024_notificationKinds() {
        assertEquals(4, NotificationKind.settings(true).size)
        assertEquals(listOf(NotificationKind.Digest, NotificationKind.Budget, NotificationKind.Deadlines), NotificationKind.settings(false))
    }

    @Test fun SET039_recentLogin() {
        val now = IsoDate.parse("2026-10-18T09:35:00.000Z")!!.toEpochMilli()
        assertTrue(RecentLogin.isRecent("2026-10-18T09:40:00.000Z", now))
        assertFalse(RecentLogin.isRecent("2026-10-18T09:30:00Z", now))
        assertFalse(RecentLogin.isRecent(null, now))
    }

    @Test fun SET043_SET046_typedConfirmations() {
        assertTrue(DangerConfirmation.resetMatches("RESETTA"))
        assertFalse(DangerConfirmation.resetMatches("resetta"))
        assertTrue(DangerConfirmation.deleteMatches("  Mario@Example.com ", "mario@example.com"))
        assertFalse(DangerConfirmation.deleteMatches("mario@example.it", "mario@example.com"))
    }

    @Test fun SET037_dataSummaryKeepsZerosAndPlurals() {
        val items = DataSummaryItems.items(UserDataSummary(1, 0, 345, 25, 1, 1, 0, 3, 1, 0))
        assertEquals(10, items.size)
        assertEquals("conto", items[0].label)
        assertEquals("banche collegate", items[1].label)
        assertEquals("budget", items[5].label)
        assertEquals(0, items[9].value)
    }

    @Test fun SET036_privacyRequestMailto() {
        val mailto = PrivacyRequest.options[0].mailto("a@b.it")
        assertTrue(mailto.startsWith("mailto:privacy@buddybudget.io?subject=Richiesta%20privacy%3A%20Correggere%20un%20dato&body="))
        assertTrue(mailto.contains("a%40b.it"))
        assertEquals(listOf("art. 16", "art. 18", "art. 21", "art. 15"), PrivacyRequest.options.map { it.article })
    }
}
