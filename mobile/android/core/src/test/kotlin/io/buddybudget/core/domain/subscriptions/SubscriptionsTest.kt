package io.buddybudget.core.domain.subscriptions

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.CategoryChange
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.ManualSubscriptionInput
import io.buddybudget.core.data.SubscriptionActivity
import io.buddybudget.core.data.SubscriptionCharge
import io.buddybudget.core.data.SubscriptionDecision
import io.buddybudget.core.data.SubscriptionDecisionInput
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionOrigin
import io.buddybudget.core.data.SubscriptionPatch
import io.buddybudget.core.data.SubscriptionPriceChange
import io.buddybudget.core.data.SubscriptionReason
import io.buddybudget.core.data.SubscriptionStatus
import io.buddybudget.core.data.SubscriptionTotals
import io.buddybudget.core.data.SubscriptionsApi
import io.buddybudget.core.data.SubscriptionsResponse
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.fixture
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.math.abs
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Abbonamenti (spec: features/06-subscriptions.md). Fixture captured from the dev server (dev user, today 2026-10-18):
// core/src/test/resources/fixtures/subscriptions.json (proposed for spec/api/fixtures/). Twin: SubscriptionsTests.swift.

private const val NBSP = " "

private fun subscriptionsFixture(): SubscriptionsResponse {
    val text = SubscriptionsTest::class.java.getResource("/fixtures/subscriptions.json")!!.readText()
    return SubscriptionsResponse.decode(ApiClient.DefaultJson, text)
}

private val italian = SubscriptionText(BBLocale.IT_IT) { it }

private fun item(
    key: String,
    id: String? = null,
    origin: SubscriptionOrigin = SubscriptionOrigin.Rilevato,
    decision: SubscriptionDecision = SubscriptionDecision.DaConfermare,
    activity: SubscriptionActivity = SubscriptionActivity.Attivo,
    cadence: SubscriptionCadence? = SubscriptionCadence.MENSILE,
    amount: Double? = 10.0,
    monthly: Double? = 10.0,
    lastDate: String? = null,
    nextDate: String? = null,
    priceChange: SubscriptionPriceChange? = null,
    charges: List<SubscriptionCharge> = emptyList(),
) = SubscriptionItem(
    key = key, id = id, name = key.replaceFirstChar { it.uppercase() }, origin = origin, decision = decision, activity = activity,
    cadence = cadence, amount = amount, monthly = monthly, lastDate = lastDate, nextDate = nextDate, priceChange = priceChange,
    charges = charges,
)

class SubscriptionsTest {
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()

    @AfterTest fun tearDown() = server.close()

    private fun api() = SubscriptionsApi(ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore(null)))

    @Test fun SUB001_decodesTheFixtureWithServerToday() {
        val r = subscriptionsFixture()
        assertEquals("2026-10-18", r.today)
        assertEquals("EUR", r.currency)
        assertEquals(8, r.items.size)
        assertEquals(SubscriptionTotals(5, 101.87, 1222.44, 1, 35.67), r.totals)
        val musica = r.items.first { it.key == "musica" }
        assertEquals(SubscriptionDecision.Confermato, musica.decision)
        assertEquals(SubscriptionPriceChange(9.99, 10.99, "2026-07-20"), musica.priceChange)
        assertTrue(SubscriptionReason.PriceChange(9.99, 10.99, "2026-07-20") in musica.reasons)
        assertEquals(12, musica.charges.size)
        assertTrue(musica.logoPath!!.startsWith("/api/merchant-logos/"))
    }

    @Test fun SUB001_decodingIsTolerant() {
        val json = """
            {"items":[{"key":"x","id":null,"name":"X","origin":"nuovo","decision":"sospeso","activity":"boh","cadence":"bimestrale",
            "amount":"12.50","monthly":null,"lastDate":null,"nextDate":null,"overdueDays":0,"priceChange":null,"charges":[],
            "reasons":[{"kind":"altro"},{"kind":"amount","mode":"variabile-lieve"}],"confidence":null,"categoryId":null}],
            "totals":{"count":0,"monthly":"0","yearly":0,"pendingCount":0,"pendingMonthly":0},"currency":"EUR","today":"2026-10-18"}
        """.trimIndent()
        val x = SubscriptionsResponse.decode(ApiClient.DefaultJson, json).items[0]
        assertEquals(SubscriptionOrigin.Unknown, x.origin)
        assertEquals(SubscriptionDecision.Unknown, x.decision)
        assertEquals(SubscriptionActivity.Unknown, x.activity)
        assertNull(x.cadence)
        assertEquals(12.5, x.amount)
        assertEquals(listOf(SubscriptionReason.Unknown, SubscriptionReason.Amount(false)), x.reasons)
        assertNull(italian.reason(SubscriptionReason.Unknown, "EUR", false))
    }

    @Test fun SUB002_SUB003_SUB004_heroSummarySentences() {
        val r = subscriptionsFixture()
        val runs = italian.heroSummary(r.totals, r.currency, false)
        assertEquals(
            "1222$NBSP€ all'anno, in 5 abbonamenti confermati. Altri 1 da confermare valgono circa 36$NBSP€ al mese.",
            runs.joinToString("") { it.text },
        )
        assertEquals(SubscriptionTextRun("1222$NBSP€", SubscriptionTextRun.Style.Amount), runs.first())
        val one = italian.heroSummary(SubscriptionTotals(count = 1, monthly = 9.99, yearly = 119.88), "EUR", false)
        assertEquals("120$NBSP€ all'anno, in 1 abbonamento confermato.", one.joinToString("") { it.text })
        assertEquals(
            listOf(SubscriptionTextRun("Conferma quelli che riconosci qui sotto e li sommiamo.")),
            italian.heroSummary(SubscriptionTotals(), "EUR", false),
        )
        assertEquals(BBFormat.AMOUNT_MASK, italian.heroSummary(r.totals, "EUR", true).first().text)
    }

    @Test fun SUB005_nextChargeWithinThirtyDays() {
        val r = subscriptionsFixture()
        val next = assertNotNull(SubscriptionsView.nextCharge(r.items, r.today))
        assertEquals("musica", next.item.key)
        assertEquals("2026-10-20", next.date)
        assertEquals(5, next.count)
        assertTrue(abs(next.total - 101.87) < 0.001)
        val line = assertNotNull(italian.nextChargeLine(next, r.today, "EUR", false))
        assertEquals(
            listOf(
                SubscriptionTextRun("Prossimo addebito: "),
                SubscriptionTextRun("Musica", SubscriptionTextRun.Style.Strong),
                SubscriptionTextRun(" tra 2 giorni"),
            ),
            line.main,
        )
        assertEquals("· nei prossimi 30 giorni 5 addebiti, 102$NBSP€", line.window)
        val items = listOf(
            item("late", decision = SubscriptionDecision.Confermato, nextDate = "2026-10-10"),
            item("far", decision = SubscriptionDecision.Confermato, nextDate = "2026-11-30"),
            item("pending", nextDate = "2026-10-19"),
        )
        val only = assertNotNull(SubscriptionsView.nextCharge(items, "2026-10-18"))
        assertEquals("late", only.item.key)
        assertEquals(1, only.count)
        assertNull(italian.nextChargeLine(only, "2026-10-18", "EUR", false)?.window)
        assertNull(SubscriptionsView.nextCharge(items.drop(1), "2026-10-18"))
    }

    @Test fun SUB006_relativeDates() {
        val today = "2026-10-18"
        assertEquals("oggi", italian.whenPhrase(today, "2026-10-18"))
        assertEquals("domani", italian.whenPhrase(today, "2026-10-19"))
        assertEquals("tra 2 giorni", italian.whenPhrase(today, "2026-10-20"))
        assertEquals("tra 14 giorni", italian.whenPhrase(today, "2026-11-01"))
        assertEquals("il 2 nov", italian.whenPhrase(today, "2026-11-02"))
        assertEquals("l'8 nov", italian.whenPhrase(today, "2026-11-08"))
        assertEquals("l'11 nov", italian.whenPhrase(today, "2026-11-11"))
        assertEquals("il 2 ott 2027", italian.whenPhrase(today, "2027-10-02"))
        assertEquals("il 10 ott", italian.whenPhrase(today, "2026-10-10"))
        assertEquals("dall'8 lug", italian.fromDate("2026-07-08"))
        val english = SubscriptionText(BBLocale.EN_GB) { mapOf("il {0}" to "on {0}", "tra {0} giorni" to "in {0} days")[it] ?: it }
        assertEquals("on 8 Nov", english.whenPhrase(today, "2026-11-08"))
        assertEquals("in 7 days", english.whenPhrase(today, "2026-10-25"))
    }

    @Test fun SUB007_emptyWhenNoItems() {
        val state = SubscriptionsUiState(SubscriptionsUiState.Phase.Loaded, SubscriptionsResponse(emptyList(), SubscriptionTotals(), "EUR", "2026-10-18"))
        assertTrue(state.isEmpty)
        assertEquals(SubscriptionSections(), state.sections)
    }

    @Test fun SUB008_SUB009_SUB010_SUB012_sectionsFromFixture() {
        val r = subscriptionsFixture()
        val s = SubscriptionsView.sections(r.items, r.today)
        assertEquals(listOf("assicurazione auto"), s.toConfirm.map { it.key })
        assertEquals(listOf("musica", "archivio cloud", "palestra", "fibra e mobile", "streaming video"), s.confirmed.map { it.key })
        assertEquals(listOf("giornale"), s.stopped.map { it.key })
        assertEquals(listOf("rata mutuo"), s.excluded.map { it.key })
        assertTrue(s.ended.isEmpty())
        val t = SubscriptionsView.sections(
            listOf(
                item("a", id = "1", decision = SubscriptionDecision.Terminato, activity = SubscriptionActivity.Fermo),
                item("b", id = "2", decision = SubscriptionDecision.Escluso, activity = SubscriptionActivity.Fermo),
            ),
            "2026-10-18",
        )
        assertEquals(listOf("a"), t.ended.map { it.key })
        assertEquals(listOf("b"), t.excluded.map { it.key })
        assertTrue(t.stopped.isEmpty())
    }

    @Test fun SUB011_priceRisesLastYearNotArchived() {
        val r = subscriptionsFixture()
        val rises = SubscriptionsView.recentPriceRises(r.items, r.today)
        assertEquals(listOf("musica"), rises.map { it.key })
        val change = rises.first().priceChange!!
        assertEquals("Da 9,99$NBSP€ a 10,99$NBSP€ dal 20 lug", italian.priceRiseHint(change, "EUR", false))
        assertEquals("+1,00$NBSP€", italian.priceRiseDelta(change, "EUR", false))
        val rise = SubscriptionPriceChange(5.0, 6.0, "2025-10-18")
        val old = SubscriptionPriceChange(5.0, 6.0, "2025-10-17")
        val drop = SubscriptionPriceChange(6.0, 5.0, "2026-10-01")
        val items = listOf(
            item("in", decision = SubscriptionDecision.Confermato, priceChange = rise),
            item("old", decision = SubscriptionDecision.Confermato, priceChange = old),
            item("drop", priceChange = drop),
            item("ex", decision = SubscriptionDecision.Escluso, priceChange = rise),
            item("end", decision = SubscriptionDecision.Terminato, priceChange = rise),
            item("stop", activity = SubscriptionActivity.Fermo, priceChange = rise),
        )
        assertEquals(listOf("in", "stop"), SubscriptionsView.recentPriceRises(items, "2026-10-18").map { it.key })
    }

    @Test fun SUB013_quickActionWithoutAmountOrCadenceOpensDetail() {
        assertEquals(
            SubscriptionQuickAction.Save(SubscriptionDecisionInput("netflix", SubscriptionStatus.Confermato, "Netflix", 13.99, SubscriptionCadence.MENSILE, null)),
            SubscriptionsView.quickAction(item("netflix", amount = 13.99), SubscriptionStatus.Confermato),
        )
        assertEquals(SubscriptionQuickAction.OpenDetail, SubscriptionsView.quickAction(item("x", amount = null), SubscriptionStatus.Escluso))
        assertEquals(SubscriptionQuickAction.OpenDetail, SubscriptionsView.quickAction(item("x", cadence = null), SubscriptionStatus.Terminato))
    }

    @Test fun SUB014_rowHintsAndTrailingLines() {
        val r = subscriptionsFixture()
        val byKey = r.items.associateBy { it.key }
        assertEquals("ogni mese · prossimo tra 2 giorni", italian.hint(byKey.getValue("musica"), r.today))
        assertEquals("ogni mese · prossimo l'8 nov", italian.hint(byKey.getValue("palestra"), r.today))
        assertEquals("ogni anno · prossimo il 2 ott 2027", italian.hint(byKey.getValue("assicurazione auto"), r.today))
        assertEquals("Ultimo addebito il 12 mag, atteso il 12 giu", italian.hint(byKey.getValue("giornale"), r.today))
        assertEquals("ogni mese · ultimo addebito il 5 ott", italian.hint(byKey.getValue("rata mutuo"), r.today))
        assertEquals("ogni mese · atteso il 15 ott", italian.hint(item("o", decision = SubscriptionDecision.Confermato, nextDate = "2026-10-15"), r.today))
        assertEquals("ogni mese · non lo vediamo più tra i movimenti", italian.hint(item("f", activity = SubscriptionActivity.Fermo), r.today))
        assertEquals("cadenza da definire", italian.hint(item("u", cadence = null), r.today))
        assertEquals("ogni 3 mesi", italian.hint(item("e", decision = SubscriptionDecision.Escluso, cadence = SubscriptionCadence.TRIMESTRALE), r.today))
        assertNotNull(SubscriptionsView.rise(byKey.getValue("musica")))
        assertEquals("era 9,99$NBSP€", italian.previousPrice(byKey.getValue("musica").priceChange!!, "EUR", false))
        assertTrue(SubscriptionsView.showsMonthlyEquivalent(byKey.getValue("assicurazione auto")))
        assertFalse(SubscriptionsView.showsMonthlyEquivalent(byKey.getValue("palestra")))
        assertEquals("35,67$NBSP€/mese", italian.monthlySuffix(35.67, "EUR", false))
    }

    @Test fun SUB014_avatarSwatchMatchesWebHash() {
        assertEquals("teal", SubscriptionsView.avatarSwatch("a"))
        assertEquals("blue", SubscriptionsView.avatarSwatch("h"))
    }

    @Test fun SUB016_detailHistoryAndReasons() {
        val musica = subscriptionsFixture().items.first { it.key == "musica" }
        val history = SubscriptionsView.history(musica)
        assertEquals(12, history.size)
        assertEquals("2026-09-21", history.first().date)
        assertEquals("2025-10-20", history.last().date)
        val many = item("m", charges = (1..20).map { SubscriptionCharge("$it", "2025-01-%02d".format(it), 1.0) })
        assertEquals((9..20).reversed().map { "$it" }, SubscriptionsView.history(many).map { it.id })
        assertEquals(
            listOf(
                "12 addebiti dello stesso esercente", "Tornano ogni mese",
                "Il prezzo è passato da 9,99$NBSP€ a 10,99$NBSP€ dal 20 lug 2026", "Sempre intorno al giorno 20 del mese",
            ),
            musica.reasons.mapNotNull { italian.reason(it, "EUR", false) },
        )
        assertEquals(
            "Tornano ogni anno (un addebito è saltato, lo abbiamo perdonato)",
            italian.reason(SubscriptionReason.Cadence(SubscriptionCadence.ANNUALE, true), "EUR", false),
        )
        assertEquals("Pesa 35,67$NBSP€ al mese", italian.monthlyWeight(35.67, "EUR", false))
    }

    @Test fun SUB017_allowedActions() {
        assertEquals(SubscriptionAllowedActions(null, true, false, SubscriptionAllowedActions.ConfirmLabel.Yes), SubscriptionsView.allowedActions(item("p")))
        assertEquals(SubscriptionAllowedActions(null, true, true, SubscriptionAllowedActions.ConfirmLabel.Yes), SubscriptionsView.allowedActions(item("p", activity = SubscriptionActivity.Fermo)))
        assertEquals(
            SubscriptionAllowedActions(SubscriptionAllowedActions.Removal.Restore, true, true, null),
            SubscriptionsView.allowedActions(item("c", id = "1", decision = SubscriptionDecision.Confermato)),
        )
        assertEquals(
            SubscriptionAllowedActions(SubscriptionAllowedActions.Removal.Restore, false, true, SubscriptionAllowedActions.ConfirmLabel.PutBack),
            SubscriptionsView.allowedActions(item("e", id = "1", decision = SubscriptionDecision.Escluso)),
        )
        assertEquals(
            SubscriptionAllowedActions(SubscriptionAllowedActions.Removal.Restore, true, false, SubscriptionAllowedActions.ConfirmLabel.PutBack),
            SubscriptionsView.allowedActions(item("t", id = "1", decision = SubscriptionDecision.Terminato)),
        )
        assertEquals(
            SubscriptionAllowedActions(SubscriptionAllowedActions.Removal.Delete, false, true, null),
            SubscriptionsView.allowedActions(item("m", id = "1", origin = SubscriptionOrigin.Manuale, decision = SubscriptionDecision.Confermato)),
        )
    }

    @Test fun SUB018_patchWhenSavedElsePost() {
        assertEquals(
            SubscriptionDecisionRoute.Patch("abc", SubscriptionStatus.Terminato),
            SubscriptionsView.decisionRoute(item("c", id = "abc", decision = SubscriptionDecision.Confermato), SubscriptionStatus.Terminato),
        )
        assertEquals(
            SubscriptionDecisionRoute.Post(SubscriptionDecisionInput("p", SubscriptionStatus.Confermato, "P", 4.5, SubscriptionCadence.MENSILE, null)),
            SubscriptionsView.decisionRoute(item("p", amount = 4.5), SubscriptionStatus.Confermato),
        )
        assertEquals(SubscriptionDecisionRoute.MissingData, SubscriptionsView.decisionRoute(item("p", amount = null), SubscriptionStatus.Confermato))
        assertEquals(
            SubscriptionDecisionRoute.Patch("9", SubscriptionStatus.Escluso),
            SubscriptionsView.decisionRoute(item("s", id = "9", cadence = null), SubscriptionStatus.Escluso),
        )
    }

    @Test fun SUB019_SUB023_formValidation() {
        val invalid = SubscriptionForm.Result::Invalid
        assertEquals(invalid("Dai un nome all'abbonamento"), SubscriptionForm.validate("  ", "5", true))
        assertEquals(invalid("Il nome è troppo lungo"), SubscriptionForm.validate("a".repeat(81), "5", true))
        assertEquals(invalid("Inserisci l'importo di ogni addebito"), SubscriptionForm.validate(" Palestra ", "", true))
        assertEquals(invalid("Inserisci l'importo di ogni addebito"), SubscriptionForm.validate("Palestra", "0", true))
        assertEquals(invalid("L'importo è troppo alto"), SubscriptionForm.validate("Palestra", "100000,01", true))
        assertEquals(SubscriptionForm.Result.Valid("Palestra", 39.9), SubscriptionForm.validate(" Palestra ", "39,90", true))
        assertEquals(SubscriptionForm.Result.Valid("Gym", 39.9), SubscriptionForm.validate("Gym", "39.90", true))
        assertEquals(SubscriptionForm.Result.Valid("Gym", null), SubscriptionForm.validate("Gym", "", false))
        assertEquals("13,99", SubscriptionForm.amountText(13.99, BBLocale.IT_IT))
        assertEquals("428.00", SubscriptionForm.amountText(428.0, BBLocale.EN_GB))
        assertEquals(80, SubscriptionForm.clampName("b".repeat(90)).length)
    }

    @Test fun SUB019_patchBodyOmitsUnsetAndClearsCategory() {
        val edit = SubscriptionPatch(name = "Gym", amount = 40.0, cadence = SubscriptionCadence.TRIMESTRALE, nextDate = "2026-11-01", categoryId = CategoryChange.Set(null))
        assertEquals("""{"amount":40.0,"cadence":"trimestrale","categoryId":null,"name":"Gym","nextDate":"2026-11-01"}""", edit.toJson().toString())
        assertEquals("""{"status":"escluso"}""", SubscriptionPatch(status = SubscriptionStatus.Escluso).toJson().toString())
    }

    @Test fun SUB020_SUB021_pendingRemovalPreview() {
        val r = subscriptionsFixture()
        val musica = r.items.first { it.key == "musica" }
        val state = SubscriptionsUiState(SubscriptionsUiState.Phase.Loaded, r, pendingRemovals = setOf(musica.id!!))
        val restored = assertNotNull(state.item("musica"))
        assertEquals(SubscriptionDecision.DaConfermare, restored.decision)
        assertNull(restored.id)
        assertEquals(listOf("musica", "assicurazione auto"), state.sections.toConfirm.map { it.key })
        assertEquals(4, state.totals.count)
        assertEquals(2, state.totals.pendingCount)
        assertTrue(abs(state.totals.monthly - 90.88) < 0.001)
        val manual = item("gym", id = "m1", origin = SubscriptionOrigin.Manuale, decision = SubscriptionDecision.Confermato)
        assertTrue(SubscriptionsView.applyingRemovals(listOf(manual), setOf("m1")).isEmpty())
    }

    @Test fun SUB023_manualAndDecisionBodies() {
        val manual = ManualSubscriptionInput("Palestra", 39.9, SubscriptionCadence.MENSILE, "2026-10-18", null)
        assertEquals(
            """{"origin":"manuale","name":"Palestra","amount":39.9,"cadence":"mensile","nextDate":"2026-10-18","categoryId":null}""",
            manual.toJson().toString(),
        )
        val decision = SubscriptionDecisionInput("musica", SubscriptionStatus.Confermato, "Musica", 10.99, SubscriptionCadence.MENSILE, "c1")
        assertEquals(
            """{"origin":"rilevato","key":"musica","status":"confermato","name":"Musica","amount":10.99,"cadence":"mensile","categoryId":"c1"}""",
            decision.toJson().toString(),
        )
        assertEquals("Ogni mese", italian.cadenceOption(SubscriptionCadence.MENSILE))
        assertEquals(
            listOf("ogni settimana", "ogni mese", "ogni 3 mesi", "ogni 6 mesi", "ogni anno"),
            SubscriptionCadence.entries.map { italian.cadenceLabel(it) },
        )
    }

    @Test fun SUB024_duplicateNameShowsServerMessage() = runTest {
        server.enqueue(MockResponse.Builder().code(409).body("""{"error":"Hai già un abbonamento con questo nome","code":"subscription_exists"}""").build())
        val error = assertFailsWith<ApiError.Http> {
            api().addManual(ManualSubscriptionInput("Palestra", 39.0, SubscriptionCadence.MENSILE, "2026-10-18", null))
        }
        assertEquals(409, error.body.status)
        assertEquals("Hai già un abbonamento con questo nome", error.body.message)
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/subscriptions", request.url.encodedPath)
    }

    @Test fun SUB025_categoryPickerExcludesIncomeAndTransfers() = runTest {
        server.enqueue(MockResponse.Builder().body(fixture("categories.json")).build())
        val categories = api().expenseCategories()
        assertTrue(categories.isNotEmpty())
        assertTrue(categories.all { it.type != "entrata" && it.type != "trasferimento" })
        assertEquals("/api/categories", server.takeRequest().url.encodedPath)
    }

    @Test fun SUB026_manualItemsAreConfirmedAndActive() {
        val manual = item("gym", id = "m1", origin = SubscriptionOrigin.Manuale, decision = SubscriptionDecision.Confermato, nextDate = "2026-11-01")
        assertEquals(listOf("gym"), SubscriptionsView.sections(listOf(manual), "2026-10-18").confirmed.map { it.key })
        assertEquals(1, SubscriptionsView.totals(listOf(manual)).count)
    }

    @Test fun SUB_apiPathsAndMethods() = runTest {
        server.enqueue(MockResponse.Builder().body("{}").build())
        server.enqueue(MockResponse.Builder().code(204).build())
        api().update("abc", SubscriptionPatch(status = SubscriptionStatus.Confermato))
        val patch = server.takeRequest()
        assertEquals("PATCH", patch.method)
        assertEquals("/api/subscriptions/abc", patch.url.encodedPath)
        api().delete("abc")
        val delete = server.takeRequest()
        assertEquals("DELETE", delete.method)
        assertEquals("/api/subscriptions/abc", delete.url.encodedPath)
    }
}
