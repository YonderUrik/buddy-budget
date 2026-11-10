package io.buddybudget.core

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.CategorySource
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.DetailRule
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.MovementDetail
import io.buddybudget.core.data.MovementOrigin
import io.buddybudget.core.data.SidebarFire
import io.buddybudget.core.data.SingleSuggestion
import io.buddybudget.core.data.StartStatus
import io.buddybudget.core.data.WelcomeItem
import io.buddybudget.core.data.WelcomeSummary
import io.buddybudget.core.domain.auth.ReturningUser
import io.buddybudget.core.domain.categorization.AutoReviewText
import io.buddybudget.core.domain.categorization.CategorizationText
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.goals.GoalDraft
import io.buddybudget.core.domain.goals.GoalKind
import io.buddybudget.core.domain.goals.GoalWizard
import io.buddybudget.core.domain.goals.GoalsRules
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportRules
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.domain.networth.ChartRefresh
import io.buddybudget.core.domain.overview.GoalsTile
import io.buddybudget.core.domain.overview.SidebarInsights
import io.buddybudget.core.domain.overview.StartChecklist
import io.buddybudget.core.domain.overview.StartFocus
import io.buddybudget.core.domain.overview.StartStepId
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.settings.AiUsage
import io.buddybudget.core.domain.shell.LiquidityNoAccounts
import io.buddybudget.core.domain.shell.LiquiditySegment
import io.buddybudget.core.domain.shell.LocaleRules
import io.buddybudget.core.domain.shell.WelcomeText
import io.buddybudget.core.domain.transactions.CategoryBudgetField
import io.buddybudget.core.domain.transactions.MovementDetailText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Phase 4e: the web changes since `0.69.1` (spec CHANGELOG), one test per requirement. Same tests on iOS (`CatchUpTests`). */
class CatchUpTest {
    /** Template substitution standing in for the catalog: Italian sources, `{0}` filled. */
    private val tr: (String, Map<String, String>) -> String = { s, v -> BBFormat.interpolate(s, v) }
    private val json = ApiClient.DefaultJson

    // ---------------------------------------------------------------- Categorisation (web #456)

    @Test fun CAT043_autoApplyThresholdIs70() {
        assertEquals(0.7, CategorizationText.AUTO_APPLY_THRESHOLD)
        assertEquals("70", CategorizationText.autoApplyPercent)
    }

    @Test fun CAT047_CAT098_bankOrigin() {
        assertTrue(CategorySource.banca.isAutomatic)
        assertEquals("Messa dall'app: nel file la banca la chiama «Alimentari»", CategorizationText.autoOriginDescription(CategorySource.banca, null, "Alimentari", tr))
        assertEquals("Messa dall'app con la categoria scritta dalla banca nel file", CategorizationText.autoOriginDescription(CategorySource.banca, null, null, tr))
        assertEquals("Messa dall'app: proposta dell'AI (sicura al 82%)", CategorizationText.autoOriginDescription(CategorySource.assistente, 0.82, null, tr))
        assertEquals("Messa dall'app: la scegli sempre per questo esercente", CategorizationText.autoOriginDescription(CategorySource.storico, null, null, tr))
        assertNull(CategorizationText.autoOriginDescription(CategorySource.utente, null, null, tr))
        // An unknown origin never breaks decoding.
        assertEquals(CategorySource.banca, json.decodeFromString(CategorySource.serializer(), "\"banca\""))
    }

    @Test fun CAT077_summaryVariants() {
        assertEquals(
            "Negli ultimi 30 giorni, 12 movimenti hanno la categoria messa dall'app, con le tue regole o perché era abbastanza sicura. Non serve confermarle: se una non va, toccala e cambiala.",
            AutoReviewText.summary(12, fromBank = false, autoApplyEnabled = true, tr = tr),
        )
        assertEquals(
            "Negli ultimi 30 giorni, 1 movimento ha la categoria messa dall'app, con le tue regole o con la categoria della banca. Non serve confermarle: se una non va, toccala e cambiala.",
            AutoReviewText.summary(1, fromBank = true, autoApplyEnabled = false, tr = tr),
        )
        assertEquals(", con le tue regole, con la categoria della banca o perché era abbastanza sicura", AutoReviewText.reasonSource(true, true))
        assertEquals(", con le tue regole", AutoReviewText.reasonSource(false, false))
    }

    // ---------------------------------------------------------------- Movement detail (web #455)

    @Test fun TX064_detailDecodes() {
        val body = """{"transaction":{"id":"t1","accountId":"a1","categoryId":"c1","description":"Esselunga","rawDescription":"POS ESSELUNGA MILANO",
            "amount":"-42.90","excludedAmount":"0.00","categorySource":"banca","bankCategory":"Spesa","merchantCategoryCode":"5411","date":"2026-10-13",
            "source":"manuale","createdAt":"2026-10-14T08:00:00.000Z","logoPath":null},"account":{"id":"a1","name":"Conto corrente"},
            "origin":{"kind":"file","format":"Banca Prova"},"rule":null,"merchant":{"count":3,"total":-120.5,"recent":[{"id":"t0","date":"2026-09-13","amount":-40.1}]}}"""
        val detail = json.decodeFromString(MovementDetail.serializer(), body)
        assertEquals(-42.9, detail.transaction.amount)
        assertEquals("Spesa", detail.transaction.bankCategory)
        assertEquals("5411", detail.transaction.merchantCategoryCode)
        assertEquals("Conto corrente", detail.account?.name)
        assertEquals(3, detail.merchant?.count)
        assertEquals(-40.1, detail.merchant?.recent?.first()?.amount)
    }

    @Test fun TX067_whoChoseTheCategory() {
        assertEquals("Scelta da te", MovementDetailText.categoryOriginText(CategorySource.utente, null, null, false, null, tr))
        assertEquals("Messa dalla tua regola per «esselunga»",
            MovementDetailText.categoryOriginText(CategorySource.regola, null, DetailRule("r", "merchant", "esselunga"), false, null, tr))
        assertEquals("Messa dalla tua regola: il testo contiene «netflix»",
            MovementDetailText.categoryOriginText(CategorySource.regola, null, DetailRule("r", "contains", "netflix"), false, null, tr))
        assertEquals("Messa dall'app con una tua regola", MovementDetailText.categoryOriginText(CategorySource.regola, null, null, false, null, tr))
        assertNull(MovementDetailText.categoryOriginText(CategorySource.utente, null, null, true, null, tr))
        assertNull(MovementDetailText.categoryOriginText(null, null, null, false, null, tr))
    }

    @Test fun TX068_askTheAi() {
        val selectable = setOf("c1", "c2")
        assertEquals(MovementDetailText.AiAnswer.Agrees, MovementDetailText.aiAnswer(SingleSuggestion("ok", "c1", 0.9), "c1", selectable))
        assertEquals(MovementDetailText.AiAnswer.Proposes("c2", 87), MovementDetailText.aiAnswer(SingleSuggestion("ok", "c2", 0.874), "c1", selectable))
        assertEquals(
            MovementDetailText.AiAnswer.Message("Hai chiesto molte volte nell'ultima ora: riprova più tardi.", false),
            MovementDetailText.aiAnswer(SingleSuggestion("limited"), "c1", selectable),
        )
        assertEquals(MovementDetailText.AiAnswer.Message("L'assistente per le categorie è spento.", true), MovementDetailText.aiAnswer(SingleSuggestion("disabled"), "c1", selectable))
        // A category the movement cannot take counts as no answer.
        assertEquals(MovementDetailText.AiAnswer.Message("L'AI non ha risposto. Riprova tra poco.", false), MovementDetailText.aiAnswer(SingleSuggestion("ok", "zz", 0.9), "c1", selectable))
        assertTrue((MovementDetailText.aiOff as MovementDetailText.AiAnswer.Message).offersSettings)
    }

    @Test fun TX069_whereItCameFrom() {
        assertEquals("Dalla banca collegata, Intesa", MovementDetailText.originText(MovementOrigin("banca", institution = "Intesa"), tr))
        assertEquals("Dalla banca collegata", MovementDetailText.originText(MovementOrigin("banca"), tr))
        assertEquals("Da un file importato, formato «Banca Prova»", MovementDetailText.originText(MovementOrigin("file", format = "Banca Prova"), tr))
        assertEquals("Dall'estratto conto di Trade Republic", MovementDetailText.originText(MovementOrigin("broker", broker = "Trade Republic"), tr))
        assertEquals("Dai dati d'esempio", MovementDetailText.originText(MovementOrigin("esempio"), tr))
        assertEquals("Aggiunto da te", MovementDetailText.originText(MovementOrigin("manuale"), tr))
    }

    // ---------------------------------------------------------------- Primi passi (web #444, #452)

    private fun status(steps: StartStatus.Steps, ids: List<String>, skipped: List<String> = emptyList(), focus: List<String>? = null) =
        StartStatus(steps, stepIds = ids, skipped = skipped, focus = focus)

    @Test fun OV033_stepsFollowTheFocus() {
        assertEquals(StartStepId.defaults, StartChecklist.stepsFor(null, pensionAvailable = true))
        assertEquals(
            listOf(StartStepId.Conto, StartStepId.Debito, StartStepId.Pensione, StartStepId.Obiettivo),
            StartChecklist.stepsFor(listOf(StartFocus.Pensione, StartFocus.Debiti), pensionAvailable = true),
        )
        assertEquals(listOf(StartStepId.Conto, StartStepId.Obiettivo), StartChecklist.stepsFor(listOf(StartFocus.Pensione), pensionAvailable = false))
        // An older server without `stepIds` asks the default four.
        assertEquals(StartStepId.defaults, StartStatus(StartStatus.Steps()).askedSteps)
    }

    @Test fun OV045_OV046_nextStepAndSkips() {
        val s = status(StartStatus.Steps(conto = true), listOf("conto", "import", "debito", "obiettivo"), skipped = listOf("import"))
        assertEquals(StartStepId.Debito, StartChecklist.nextStep(s))
        assertEquals(StartChecklist.RowState.Skipped, StartChecklist.rowState(s, StartStepId.Import))
        assertEquals(StartChecklist.RowState.Done, StartChecklist.rowState(s, StartStepId.Conto))
        assertFalse(StartChecklist.canSkip(StartStepId.Conto))
        assertTrue(StartChecklist.canSkip(StartStepId.Pensione))
        assertNull(StartChecklist.nextStep(s.copy(skipped = listOf("import", "debito", "obiettivo"))))
    }

    @Test fun OV038_pollWhileIncomplete() {
        assertTrue(StartChecklist.shouldPoll(StartStatus(StartStatus.Steps())))
        assertFalse(StartChecklist.shouldPoll(StartStatus(StartStatus.Steps(), completed = true)))
        assertFalse(StartChecklist.shouldPoll(StartStatus(StartStatus.Steps(), dismissed = true)))
        assertEquals(15_000L, StartChecklist.POLL_MS)
    }

    @Test fun SHELL060_newlyDoneSteps() {
        val now = status(StartStatus.Steps(conto = true, import = true), listOf("conto", "import", "investimento", "obiettivo"))
        assertEquals(listOf(StartStepId.Import), StartChecklist.newlyDone(setOf(StartStepId.Conto), now))
        assertEquals(emptyList(), StartChecklist.newlyDone(setOf(StartStepId.Conto, StartStepId.Import), now))
    }

    @Test fun OV031_goalsInviteHiddenWhileChecklistShows() {
        val empty = GoalsView()
        assertEquals(GoalsTile.Mode.Invite, GoalsTile.mode(empty, inviteDismissed = false))
        assertEquals(GoalsTile.Mode.Hidden, GoalsTile.mode(empty, inviteDismissed = false, checklistShown = true))
    }

    @Test fun AUTH058_focusOptions() {
        assertEquals(4, StartFocus.options(pensionAvailable = true).size)
        assertFalse(StartFocus.Pensione in StartFocus.options(pensionAvailable = false))
    }

    @Test fun SHELL036_noFireHintForANewUser() {
        assertEquals(SidebarInsights.FireState.Hidden, SidebarInsights.fireState(SidebarFire(wealth = 0.0)))
        assertEquals(SidebarInsights.FireState.Invite, SidebarInsights.fireState(SidebarFire(wealth = 1200.0)))
    }

    // ---------------------------------------------------------------- Liquidità without accounts, chart refresh (web #444, #447)

    @Test fun TX022_tabsWithoutAccounts() {
        assertEquals("Prima serve un conto", LiquidityNoAccounts.content(LiquiditySegment.Movements)?.title)
        assertEquals("Qui vedrai dove vanno i soldi", LiquidityNoAccounts.content(LiquiditySegment.Analysis)?.title)
        assertEquals("Qui troverai i tuoi abbonamenti", LiquidityNoAccounts.content(LiquiditySegment.Subscriptions)?.title)
        assertNull(LiquidityNoAccounts.content(LiquiditySegment.Accounts))
        assertTrue(LiquidityNoAccounts.applies(0))
        assertFalse(LiquidityNoAccounts.applies(null))
    }

    @Test fun OV044_TX076_chartRefresh() {
        assertEquals(ChartRefresh.State.Importing, ChartRefresh.state(importing = true, pendingSince = null, dataUpdatedAt = 0, isFetching = false))
        assertEquals(ChartRefresh.State.Updating, ChartRefresh.state(false, pendingSince = 100, dataUpdatedAt = 50, isFetching = false))
        assertEquals(ChartRefresh.State.Updating, ChartRefresh.state(false, pendingSince = 100, dataUpdatedAt = 150, isFetching = true))
        assertNull(ChartRefresh.state(false, pendingSince = 100, dataUpdatedAt = 150, isFetching = false))
        assertTrue(ChartRefresh.isSettled(100, 150, false))
        assertNull(ChartRefresh.freshPending(0, ChartRefresh.PENDING_MAX_AGE_MS + 1))
        assertEquals("Aggiorno il grafico con i nuovi movimenti…", ChartRefresh.State.Updating.message)
    }

    // ---------------------------------------------------------------- «Dall'ultima visita» (web #457)

    @Test fun SHELL059_welcomeToast() {
        val join: (List<String>) -> String = { BBFormat.formatList(it, BBLocale.IT_IT) }
        val summary = WelcomeSummary(
            "2026-10-18T10:00:00.000Z",
            happened = listOf(WelcomeItem("movements", 12), WelcomeItem("price_alerts", 1)),
            waiting = listOf(WelcomeItem("to_decide", 7), WelcomeItem("import_review", 1, "j1")),
        )
        val content = WelcomeText.content(summary, tr, join)!!
        assertEquals(listOf(
            "Mentre eri via: 12 movimenti nuovi e 1 avviso di prezzo scattato",
            "Da sistemare: 7 movimenti senza categoria e 1 import da controllare",
        ), content.lines)
        assertEquals("Decidi", content.actionLabel)
        assertEquals("/categorizza", content.actionPath)
        val onlyHappened = WelcomeText.content(WelcomeSummary("x", happened = listOf(WelcomeItem("price_rises", 2))), tr, join)!!
        assertEquals("Vedi", onlyHappened.actionLabel)
        assertEquals("/liquidita/abbonamenti", onlyHappened.actionPath)
        assertNull(WelcomeText.content(WelcomeSummary("x"), tr, join))
        assertEquals("/importazioni?job=j1", WelcomeText.path(WelcomeItem("import_review", 1, "j1")))
    }

    // ---------------------------------------------------------------- Imports (web #456, #461)

    @Test fun IMP030_receiptSummary() {
        fun r(rows: Int?, present: Int?, bank: Int = 0) = PersonalImportListing.Results(cash = 3, investments = 0, bankCategorized = bank, rows = rows, alreadyPresent = present)
        assertEquals("Tutti i {0} movimenti del file c'erano già: non abbiamo aggiunto niente.", PersonalImportRules.importSummary(r(40, 40)).template)
        assertEquals("Il movimento del file c'era già: non abbiamo aggiunto niente.", PersonalImportRules.importSummary(r(1, 1)).template)
        assertEquals(mapOf("0" to "28", "1" to "40"), PersonalImportRules.importSummary(r(40, 12)).values)
        assertEquals("I dati sono già nel tuo conto.", PersonalImportRules.importSummary(r(null, null)).template)
        assertEquals("Niente di nuovo da importare", PersonalImportRules.receiptTitle("imported", r(5, 5)))
        assertFalse(PersonalImportRules.showsAddedLines(r(5, 5)))
        // Bank categories (web #456) and the generic line only for older jobs.
        assertEquals(listOf("{0} movimenti hanno già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi."),
            PersonalImportRules.receiptNotes(r(10, 0, bank = 4)).map { it.template })
        assertEquals("Le righe già presenti sono state saltate, senza doppioni.", PersonalImportRules.receiptNotes(r(null, null)).last().template)
    }

    @Test fun IMP063_listAndIsland() {
        val nothing = PersonalImportListing.Job("j", "f", "imported", results = PersonalImportListing.Results(rows = 8, alreadyPresent = 8))
        assertEquals("Niente di nuovo: {0} movimenti c'erano già", PersonalImportRules.describe(nothing).first.template)
        val (title, detail) = PersonalImportRules.islandText(nothing, "Banca")
        assertEquals("{0}: niente di nuovo", title.template)
        assertEquals("I movimenti c'erano già tutti.", detail.template)
        val partial = nothing.copy(results = PersonalImportListing.Results(rows = 8, alreadyPresent = 3))
        assertEquals(mapOf("0" to "5", "1" to "8"), PersonalImportRules.describe(partial).first.values)
    }

    @Test fun IMP062_alreadyImportedIsANotice() {
        assertTrue(ImportApiFailure("Questo file è già stato importato", 409, "already_imported").alreadyImported)
        assertFalse(ImportApiFailure("x", 400).alreadyImported)
    }

    @Test fun IMP049_correctionsOffUntilTheWebShipsThem() {
        assertFalse(PersonalImportRules.CORRECTIONS_ENABLED)
    }

    // ---------------------------------------------------------------- Budgets (web #432)

    @Test fun CAT099_CAT100_budgetField() {
        val it = BBLocale.IT_IT
        assertEquals(CategoryBudgetField.Outcome.Save(1250.5), CategoryBudgetField.commit("1.250,50", null, it))
        assertEquals(CategoryBudgetField.Outcome.Save(300.0), CategoryBudgetField.commit("300", 250.0, it))
        assertEquals(CategoryBudgetField.Outcome.Save(1250.5), CategoryBudgetField.commit("1,250.50", null, BBLocale.EN_GB))
        assertEquals(CategoryBudgetField.Outcome.Unchanged, CategoryBudgetField.commit("300", 300.0, it))
        assertEquals(CategoryBudgetField.Outcome.Remove, CategoryBudgetField.commit(" ", 300.0, it))
        assertEquals(CategoryBudgetField.Outcome.Unchanged, CategoryBudgetField.commit("", null, it))
        assertEquals(CategoryBudgetField.Outcome.Invalid, CategoryBudgetField.commit("-5", null, it))
        assertEquals(CategoryBudgetField.Outcome.Invalid, CategoryBudgetField.commit("abc", null, it))
        assertTrue(CategoryBudgetField.appliesTo(CategoryType.dovuta, false))
        assertFalse(CategoryBudgetField.appliesTo(CategoryType.entrata, false))
        assertFalse(CategoryBudgetField.appliesTo(CategoryType.dovuta, true))
        assertEquals("1250,5", CategoryBudgetField.inputText(1250.5, it))
    }

    // ---------------------------------------------------------------- Goals (web #382)

    @Test fun GOAL017_emergencyFundFromMonthlySpending() {
        var draft = GoalWizard.withKind(GoalDraft(), GoalKind.EMERGENZA, essentialMonthly = null)
        assertEquals(6, draft.emergencyMonths)
        assertNull(draft.target)
        draft = GoalWizard.withMonthlySpend(draft, 1430.0)
        assertEquals(8600.0, draft.target)
        draft = GoalWizard.withEmergencyMonths(draft, 3, essentialMonthly = 2000.0)
        assertEquals(4300.0, draft.target)
        assertEquals("Scrivi quanto spendi in un mese: la cifra si aggiorna da sola.", GoalWizard.spendNote(draft, "dovute"))
        val computed = GoalWizard.withKind(GoalDraft(), GoalKind.EMERGENZA, essentialMonthly = 1428.0)
        assertEquals(8600.0, computed.target)
        assertTrue(GoalWizard.spendNote(computed, "tutte").startsWith("Media di tutte le tue uscite"))
    }

    @Test fun GOAL006_suggestionByBasis() {
        assertTrue(GoalsRules.emergencySuggestionSource(GoalsView(essentialBasis = "tutte")).startsWith("Con {0} mesi delle tue spese"))
        assertTrue(GoalsRules.emergencySuggestionSource(GoalsView(essentialBasis = "dovute")).startsWith("Con {0} mesi di spese dovute"))
    }

    // ---------------------------------------------------------------- Investments (web #438, #445, #448)

    @Test fun INV111_heldInstruments() {
        // The spec fixture plus the field the server sends since web #445.
        val raw = json.parseToJsonElement(fixture("investments-view.json")).let { it as kotlinx.serialization.json.JsonObject }
        val withHeld = kotlinx.serialization.json.JsonObject(raw + ("heldInstrumentIds" to kotlinx.serialization.json.JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive("a")))))
        assertEquals(listOf("a"), json.decodeFromJsonElement(InvestmentsView.serializer(), withHeld).heldInstrumentIds)
    }

    @Test fun INV112_quantitiesPricesAndFeesMasked() {
        val masked = io.buddybudget.core.domain.investments.InvestmentsText(BBLocale.IT_IT, masked = true) { it }
        assertEquals(BBFormat.AMOUNT_MASK, masked.quantity(3.5))
        assertEquals(BBFormat.AMOUNT_MASK, masked.price(101.2, "EUR"))
        val plain = io.buddybudget.core.domain.investments.InvestmentsText(BBLocale.IT_IT) { it }
        assertEquals("3,5", plain.quantity(3.5))
    }

    @Test fun SEC_etcShowsItsIssuer() {
        val etc = InstrumentIcons.spec(InstrumentType.Etc, "iShares Physical Gold")
        assertEquals(InstrumentIcons.spec(InstrumentType.Etf, "iShares Physical Gold"), etc)
        assertTrue(InstrumentIcons.wantsRemoteLogo(InstrumentType.Etc, "iShares Physical Gold"))
    }

    // ---------------------------------------------------------------- Sign-in, locale, AI settings (web #394, #397, #398, #460)

    @Test fun AUTH059_maskedEmail() {
        assertEquals("dan•••@gmail.com", ReturningUser.mask("daniele@gmail.com"))
        assertEquals("a•••@b.it", ReturningUser.mask("ab@b.it"))
        assertNull(ReturningUser.parse("not-an-email"))
        assertEquals("x@y.z", ReturningUser.parse(" x@y.z "))
    }

    @Test fun AUTH060_languagePreview() {
        val today = CalendarDate(2026, 10, 20)
        // Italian does not group four-digit numbers (Intl `minimumGroupingDigits`), German does.
        assertEquals("20 ott 2026 · 1234,56\u00a0€", LocaleRules.languagePreview("it", "EUR", today))
        assertEquals("20. Okt. 2026 · 1.234,56\u00a0€", LocaleRules.languagePreview("de", "EUR", today))
        assertEquals("DE", LocaleRules.countryOf("de"))
        assertEquals(listOf("it", "en", "de"), LocaleRules.allLanguages)
    }

    @Test fun SET050_whereTheAppUsesAi() {
        assertEquals(3, AiUsage.items.size)
        assertEquals("Proposte di categoria", AiUsage.items.first().title)
        assertTrue(AiUsage.ZERO_DATA_RETENTION.startsWith("Zero data retention"))
    }
}
