package io.buddybudget.core.domain.planningde

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.FinancialPlanningApi
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.PlanningEnvelope
import io.buddybudget.core.data.PlanningPortfolio
import io.buddybudget.core.data.PlanningResults
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.planningde.PlanJson.bool
import io.buddybudget.core.domain.planningde.PlanJson.get
import io.buddybudget.core.domain.planningde.PlanJson.num
import io.buddybudget.core.domain.planningde.PlanJson.str
import io.buddybudget.core.fixture
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// German Tax and Income screens (spec: features/13-planning-de.md, PLAN-001…031). Results fixtures come from
// spec/api/fixtures (financial-planning-results-*.json, German demo user); the instrument names / operations come from
// core/src/test/resources/fixtures/planning-portfolio-de.json (trimmed `GET /api/investments/overview` of the same user,
// captured 2026-10-19). The validation cases were checked against zod `germanPlanSchema.safeParse`. Twin:
// PlanningDEScreensTests.swift.

private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

private fun envelope(): PlanningEnvelope = json.decodeFromString(PlanningEnvelope.serializer(), fixture("financial-planning-results-de.json"))
private fun preview(): PlanningResults = json.decodeFromString(PlanningResults.serializer(), fixture("financial-planning-results-preview-de.json"))
private fun portfolio(): PlanningPortfolio {
    val text = PlanningDEScreensTest::class.java.getResource("/fixtures/planning-portfolio-de.json")!!.readText()
    return json.decodeFromString(PlanningPortfolio.serializer(), text)
}

private fun node(text: String): JsonElement = Json.parseToJsonElement(text)

private fun plan(change: (MutableMap<String, JsonElement>) -> Unit): JsonElement {
    val root = envelope().plan.jsonObject.toMutableMap()
    change(root)
    return JsonObject(root)
}

private fun setting(section: String, key: String, value: JsonElement): JsonElement = plan { root ->
    val o = (root[section] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
    o[key] = value
    root[section] = JsonObject(o)
}

private fun n(v: Number) = JsonPrimitive(v)
private fun s(v: String) = JsonPrimitive(v)
private fun b(v: Boolean) = JsonPrimitive(v)
private fun arr(vararg items: String) = JsonArray(items.map { node(it) })

private val english = GermanPlanningText(BBLocale.EN_GB) { it }
private const val NBSP = " "

class PlanningDEScreensTest {
    // ------------------------------------------------------------ Gating (PLAN-001…004)

    @Test fun PLAN001_PLAN002_countryDecidesTheGermanScreens() {
        // The product country decides (web `productCountry === "DE"`); the language plays no part.
        assertEquals(InvestmentsCountryContent.GermanPlan, InvestmentsCountryContent.of("DE"))
        assertEquals(InvestmentsCountryContent.Italian, InvestmentsCountryContent.of("IT"))
    }

    @Test fun PLAN003_germanSubpathsOfTaxAndIncomeAreBlocked() {
        assertTrue(InvestmentsCountryContent.GermanPlan.blocksPath("/investimenti/tasse/simulazione"))
        assertTrue(InvestmentsCountryContent.GermanPlan.blocksPath("/investimenti/proventi/calendario?x=1"))
        assertFalse(InvestmentsCountryContent.GermanPlan.blocksPath("/investimenti/tasse"))
        assertFalse(InvestmentsCountryContent.GermanPlan.blocksPath("/investimenti/proventi?anno=2026"))
        assertFalse(InvestmentsCountryContent.Italian.blocksPath("/investimenti/tasse/simulazione"))
    }

    @Test fun PLAN004_onlyTaxAndIncomeSectionsAreOn() {
        assertEquals(PlanningResults.Sections(tax = true, income = true, pension = false, retirement = false, simulations = false),
            envelope().results!!.sections)
    }

    // ------------------------------------------------------------ Document and saving (PLAN-007…017)

    @Test fun PLAN007_decodesPlanRevisionAndResults() {
        val e = envelope()
        assertEquals(0, e.revision)
        assertEquals("DE", e.plan["country"].str())
        assertEquals(2026.0, e.plan["tax"]["year"].num())
        val results = assertNotNull(e.results)
        assertTrue(results.supported)
        assertEquals(9, results.tax?.report?.events?.size)
        assertEquals(listOf(2026, 2025), results.income?.history?.map { it.year })
        assertTrue(GermanPlanValidation.isValid(e.plan))
    }

    @Test fun PLAN007_PLAN012_PLAN008_apiPaths() = runTest {
        MockWebServer().use { server ->
            server.start()
            val api = FinancialPlanningApi(ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore(null)))
            server.enqueue(MockResponse.Builder().body(fixture("financial-planning-results-de.json")).build())
            api.load()
            val get = server.takeRequest()
            assertEquals("/api/financial-planning", get.url.encodedPath)
            assertEquals("include=results", get.url.encodedQuery)

            server.enqueue(MockResponse.Builder().body(fixture("financial-planning-results-de.json")).build())
            api.save(envelope().plan, 3)
            val put = server.takeRequest()
            assertEquals("PUT", put.method)
            val sent = Json.parseToJsonElement(put.body!!.utf8()).jsonObject
            assertEquals(3, sent["revision"]!!.jsonPrimitive.int)
            assertEquals(2026.0, sent["plan"]["tax"]["year"].num())
            assertTrue(put.body!!.utf8().contains("\"year\":2026"))

            server.enqueue(MockResponse.Builder().body(fixture("financial-planning-results-preview-de.json")).build())
            api.preview(envelope().plan)
            val post = server.takeRequest()
            assertEquals("POST", post.method)
            assertEquals("/api/financial-planning/results", post.url.encodedPath)

            server.enqueue(MockResponse.Builder().body("""{"currency":"EUR","instruments":[],"transactions":[],"prices":[{"x":1}]}""").build())
            api.portfolio()
            val overview = server.takeRequest()
            assertEquals("/api/investments/overview", overview.url.encodedPath)
            assertEquals("period=1mese", overview.url.encodedQuery)
        }
    }

    @Test fun PLAN008_portfolioNamesAndOperations() {
        val p = portfolio()
        assertEquals(15, p.instruments.size)
        assertEquals(53, p.transactions.size)
        assertEquals("ETF Euro Stoxx Dividend Demo", p.name("574c06d0-e566-4aa8-a024-2701f240f174"))
    }

    @Test fun PLAN009_unsupportedCurrencyHasNoResults() {
        val text = """{"currency":"USD","supported":false,"sections":{"tax":true,"income":true,"pension":false,"retirement":false,"simulations":false},"tax":null,"income":null}"""
        val r = json.decodeFromString(PlanningResults.serializer(), text)
        assertFalse(r.supported)
        assertNull(r.tax)
        assertNull(r.income)
    }

    @Test fun PLAN010_saveBarState() {
        var editor = GermanPlanEditor(envelope().plan, 0)
        assertEquals("Plan saved", editor.statusKey)
        assertEquals("Save plan", editor.buttonKey)
        assertFalse(editor.canSave)
        editor = editor.updateTax { it.copy(historyConfirmed = true) }
        assertEquals("Unsaved changes", editor.statusKey)
        assertTrue(editor.canSave)
        val saving = assertNotNull(editor.beginSave())
        assertEquals(0, saving.revision)
        assertEquals("Saving…", saving.buttonKey)
        assertFalse(saving.canSave)
        assertNull(saving.beginSave())
        // Setting the value back makes the plan clean again (numbers compared by value).
        val back = GermanPlanEditor(envelope().plan, 0).updateTax { it.copy(historyConfirmed = true, shareLosses = 0.0) }
            .updateTax { it.copy(historyConfirmed = false) }
        assertFalse(back.isDirty)
    }

    @Test fun PLAN011_validationMatchesTheServerSchema() {
        assertTrue(GermanPlanValidation.isValid(node("{}")))
        assertTrue(GermanPlanValidation.isValid(envelope().plan))
        val invalid = listOf(
            setting("tax", "churchRate", n(0.07)),
            setting("tax", "shareLosses", n(-1)),
            setting("tax", "otherCapitalIncome", n(2e12)),
            setting("tax", "year", n(2027)),
            setting("tax", "futureForecast", s("always")),
            setting("tax", "unknownKey", b(true)),
            setting("tax", "fundKinds", JsonObject(mapOf("a" to s("bond")))),
            setting("tax", "fundKinds", JsonObject(mapOf("x".repeat(101) to s("equity")))),
            setting("tax", "priorAdvancesBySale", JsonObject(mapOf("s" to n(-2)))),
            setting("tax", "joint", s("yes")),
            setting("fund", "acquisitionMonth", n(13)),
            setting("fund", "acquisitionMonth", n(1.5)),
            setting("retirement", "withdrawalRate", n(0.001)),
            plan { root ->
                root["pensionTax"] = JsonObject(root["pensionTax"]!!.jsonObject + mapOf("childless" to b(true), "childrenUnder25" to n(2)))
            },
            plan { it["country"] = s("IT") },
            plan { it["extra"] = n(1) },
            plan { it["cryptoOtherGains"] = n(-2e12) },
            plan { it["crypto"] = arr("""{"id":"a","name":"BTC","acquired":"2026-01-01","sold":"2025-12-31","proceeds":1,"cost":1}""") },
            plan { it["crypto"] = arr("""{"id":"a","name":"BTC","acquired":"2025-01-01","sold":"2025-12-31","proceeds":1,"cost":1}""") },
            plan { it["crypto"] = arr("""{"id":"a","name":"BTC","acquired":"2025-02-30","sold":"2026-01-02","proceeds":1,"cost":1}""") },
            plan { it["crypto"] = arr("""{"id":"a","name":"  ","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}""") },
            plan { it["crypto"] = arr("""{"id":"a","name":"BTC","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1}""") },
            plan {
                it["crypto"] = arr("""{"id":"a","name":"A","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}""",
                    """{"id":"a","name":"B","acquired":"2025-01-01","sold":"2026-01-02","proceeds":1,"cost":1}""")
            },
            plan { it["pensions"] = arr("""{"id":"p","name":"GRV","kind":"statutory","paymentMode":"capital"}""") },
            plan { it["pensions"] = arr("""{"id":"p","name":"X","kind":"avd","monthlyContribution":600,"yearsUntilPayment":28,"avd":{"enabled":true}}""") },
            plan { it["pensions"] = arr("""{"id":"p","name":"X","kind":"avd","yearsUntilPayment":10,"avd":{"enabled":true}}""") },
            plan { it["pensions"] = arr("""{"id":"p","name":"X","kind":"private","avd":{"payout":"drawdown","payoutStartAge":67,"payoutEndAge":85,"lumpSumRate":0.5}}""") },
            plan {
                it["pensions"] = arr("""{"id":"p","name":"X","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}""",
                    """{"id":"q","name":"Y","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}""")
            },
        )
        invalid.forEachIndexed { i, p -> assertFalse(GermanPlanValidation.isValid(p), "case $i") }
        val valid = listOf(
            setting("tax", "churchRate", n(0.09)),
            setting("tax", "fundKinds", JsonObject(mapOf("a" to s("foreign-property")))),
            plan { it["cryptoOtherGains"] = n(-500) },
            plan { it["crypto"] = arr("""{"id":"a","name":" BTC ","acquired":"2024-02-29","sold":"2026-01-02","proceeds":1,"cost":1}""") },
            // AVD: 67 - 40 + 2027 - 2026 = 28 years.
            plan {
                it["pensions"] = arr("""{"id":"p","name":"X","kind":"avd","yearsUntilPayment":28,"avd":{"enabled":true}}""",
                    """{"id":"q","name":"Y","kind":"avd","yearsUntilPayment":3,"pensionStartYear":null,"taxFreeAnnualAmount":null}""")
            },
        )
        valid.forEachIndexed { i, p -> assertTrue(GermanPlanValidation.isValid(p), "case $i") }
        val editor = GermanPlanEditor(setting("tax", "churchRate", n(0.07)), 1).updateTax { it.copy(joint = true) }
        assertEquals("Check the entered names, dates and numeric limits before saving.", editor.validationKey)
        assertFalse(editor.canSave)
    }

    @Test fun PLAN012_saveAdoptsTheServerPlanAndRevision() {
        val editor = GermanPlanEditor(envelope().plan, 4).updateTax { it.copy(shareLosses = 120.0) }
        val saving = assertNotNull(editor.beginSave())
        val saved = saving.saveSucceeded(saving.draft, 5)
        assertEquals(5, saved.revision)
        assertFalse(saved.isDirty)
        assertEquals(120.0, saved.tax.shareLosses)
        assertEquals("Plan saved", saved.statusKey)
    }

    @Test fun PLAN013_conflictAndFailureKeepTheEdits() = runTest {
        var editor = GermanPlanEditor(envelope().plan, 0).updateTax { it.copy(generalLosses = 50.0) }
        editor = editor.beginSave()!!.saveFailed(conflict = true)
        assertEquals("This plan changed in another tab. Reload before saving.", editor.message?.key)
        assertEquals(50.0, editor.tax.generalLosses)
        assertTrue(editor.canSave)
        editor = editor.beginSave()!!
        assertNull(editor.message)
        editor = editor.saveFailed(conflict = false)
        assertEquals("Could not save. Your changes are still here.", editor.message?.key)
        assertTrue(editor.isDirty)

        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse.Builder().code(409).body("""{"error":"plan_changed","code":"plan_changed"}""").build())
            val api = FinancialPlanningApi(ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore(null)))
            val error = assertFailsWith<ApiError.Http> { api.save(envelope().plan, 0) }
            assertEquals(409, error.status)
            assertEquals(ApiErrorCode.Other("plan_changed"), error.code)
        }
    }

    @Test fun PLAN014_PLAN031_savingTaxKeepsHiddenSectionsAndSettings() {
        val saved = plan { root ->
            root["retirement"] = node("""{"annualSpending":30000,"realReturn":0.03}""")
            root["pensions"] = arr("""{"id":"p","name":"GRV","kind":"statutory","points":31.5}""")
            root["tax"] = JsonObject(root["tax"]!!.jsonObject + ("futureForecast" to s("constant-2026")))
        }
        val draft = GermanPlanEditor(saved, 2).updateTax { it.copy(joint = true, churchRate = 0.08, fundKinds = it.fundKinds + ("f1" to "equity")) }.draft
        assertEquals(saved["retirement"], draft["retirement"])
        assertEquals(saved["pensions"], draft["pensions"])
        assertEquals(saved["pensionTax"], draft["pensionTax"])
        assertEquals(saved["fund"], draft["fund"])
        assertEquals("constant-2026", draft["tax"]["futureForecast"].str())
        assertEquals(2026.0, draft["tax"]["year"].num())
        assertEquals("equity", draft["tax"]["fundKinds"]["f1"].str())
        assertTrue(GermanPlanValidation.isValid(draft))
    }

    @Test fun PLAN015_numericInputsClampAndStoreFractions() {
        assertEquals(0.0, PlanningNumberInput.value(""))
        assertEquals(0.0, PlanningNumberInput.value("abc"))
        assertEquals(0.0, PlanningNumberInput.value("-5"))
        assertEquals(1250.5, PlanningNumberInput.value("1.250,50"))
        assertEquals(12.5, PlanningNumberInput.value("12,5"))
        assertEquals(1e12, PlanningNumberInput.value("5000000000000"))
        assertEquals(12.0, PlanningNumberInput.value("15", min = 1.0, max = 12.0))
        assertEquals(0.025, PlanningNumberInput.value("2,5", min = -50.0, max = 30.0, percent = true))
        assertTrue(PlanningNumberInput.needsClamp("-5"))
        assertFalse(PlanningNumberInput.needsClamp("5"))
        assertFalse(PlanningNumberInput.needsClamp(""))
        assertEquals("1250,5", PlanningNumberInput.text(1250.5, BBLocale.DE_DE))
        assertEquals("1250.5", PlanningNumberInput.text(1250.5, BBLocale.EN_GB))
        assertEquals("0", PlanningNumberInput.text(0.0, BBLocale.DE_DE))
        assertEquals("2,5", PlanningNumberInput.text(0.025, BBLocale.DE_DE, percent = true))
    }

    @Test fun PLAN016_PLAN022_PLAN023_resultRows() {
        val report = envelope().results!!.tax!!.report
        val rows = english.taxRows(report)
        assertEquals(listOf("Foreign tax credit applied", "Estimated capital income tax", "Solidarity surcharge", "Church tax",
            "Estimated total tax", "Recorded taxes (shown separately)", "Remaining share losses", "Remaining general losses"), rows.map { it.label })
        assertEquals(7, rows.count { it.value == "More information needed" })
        assertEquals("€149.72", rows[5].value)

        val complete = """{"events":[],"issues":[],"recordedTaxes":0,"shareGains":0,"generalIncome":1500,"estimate":{"taxable":500,"foreignCredit":0,"usedAllowance":1000,"remainingAllowance":0,"capitalTax":125,"solidarity":6.87,"church":0,"total":131.87,"remainingShareLosses":0,"remainingGeneralLosses":0}}"""
        val estimated = english.taxRows(json.decodeFromString(PlanningResults.TaxReport.serializer(), complete))
        assertEquals(listOf("€0.00", "€125.00", "€6.87", "€0.00", "€131.87", "€0.00", "€0.00", "€0.00"), estimated.map { it.value })
        assertEquals("131,87$NBSP€", GermanPlanningText(BBLocale.DE_DE) { it }.amount(131.87))
    }

    @Test fun PLAN017_officialSources() {
        assertEquals(listOf("EStG §32d", "InvStG §18", "InvStG §20", "RWBestV 2026", "EStG §23"), GermanPlanningText.sources.map { it.label })
        assertTrue(GermanPlanningText.sources.all { it.url.startsWith("https://www.gesetze-im-internet.de/") })
    }

    @Test fun PLAN018_taxProfileInputs() {
        val editor = GermanPlanEditor(envelope().plan, 0).updateTax {
            it.copy(joint = true, churchRate = GermanPlanningText.churchRate("0.09"), allowanceUsedElsewhere = 200.0, verifiedForeignCredit = 12.5,
                shareLosses = 1.0, generalLosses = 2.0, otherCapitalIncome = 3.0)
        }
        val tax = editor.draft["tax"]
        assertEquals(true, tax["joint"].bool())
        assertEquals(0.09, tax["churchRate"].num())
        assertEquals(200.0, tax["allowanceUsedElsewhere"].num())
        assertEquals(12.5, tax["verifiedForeignCredit"].num())
        assertEquals("0.09", GermanPlanningText.churchValue(editor.tax.churchRate))
        assertEquals(listOf("Individual (€1,000 allowance)", "Joint (€2,000 allowance)"), english.assessmentOptions.map { it.label })
        assertEquals(listOf("0", "0.08", "0.09"), english.churchOptions.map { it.value })
    }

    @Test fun PLAN019_PLAN021_PLAN026_issueLines() {
        val report = envelope().results!!.tax!!.report
        assertEquals(listOf(
            "Confirm complete acquisition history and custody accounts before calculating.",
            "ETF Euro Stoxx Dividend Demo: Confirm the fund tax classification using its documentation.",
            "ETF Euro Stoxx Dividend Demo: Confirm prior fund advances and any taxable advances received this year.",
            "Physisches Gold ETC Demo: This instrument or adjustment requires individual tax treatment.",
        ), english.issueLines(report, portfolio()))
        // Confirming the history removes the history issue (server preview of the same plan).
        val confirmed = preview().tax!!.report
        assertFalse(confirmed.issues.any { it.reason == "history" })
        assertNull(confirmed.estimate)
        assertEquals(8, GermanPlanningText.reasonKeys.size)
    }

    @Test fun PLAN020_PLAN024_realisedEvents() {
        val rows = english.realisedEvents(envelope().results!!.tax!!.report, portfolio())
        assertEquals(9, rows.size)
        assertEquals("20 Feb 2026 · Nimbus Cloud Inc.", rows[0].label)
        assertEquals("€8.16", rows[0].value)
        assertEquals("€152.00", rows[3].value)
    }

    @Test fun PLAN025_fundsAndFundSales() {
        val tax = envelope().results!!.tax!!
        assertEquals(listOf("Aktien Welt ETF Demo", "ETF S&P 500 Demo", "ETF Emerging Markets Demo", "ETF Euro Stoxx Dividend Demo",
            "Euro-Anleihen ETF Demo", "Mischfonds Demo"), english.fundRows(tax, portfolio()).map { it.name })
        assertEquals(listOf("unknown", "equity", "mixed", "property", "foreign-property", "other"), english.fundOptions.map { it.value })
        assertEquals("Foreign property fund (80% exemption)", english.fundOptions[4].label)
        assertTrue(english.fundSaleRows(tax, portfolio()).isEmpty())

        val text = """{"report":{"events":[],"issues":[],"recordedTaxes":0,"shareGains":0,"generalIncome":0,"estimate":null},"fundInstrumentIds":["f"],"fundSaleIds":["s1","gone"]}"""
        val withSale = json.decodeFromString(PlanningResults.Tax.serializer(), text)
        val p = PlanningPortfolio(instruments = listOf(PlanningPortfolio.InstrumentRef("f", "World ETF", "etf")),
            transactions = listOf(PlanningPortfolio.Operation("s1", "f", "vendita", "2026-03-05")))
        assertEquals(listOf("World ETF · 5 Mar 2026 · Prior gross advances (€)"), english.fundSaleRows(withSale, p).map { it.label })
        var editor = GermanPlanEditor(envelope().plan, 0)
        assertEquals("unknown", editor.tax.fundKind("f"))
        editor = editor.updateTax {
            it.copy(fundKinds = it.fundKinds + ("f" to "equity"), priorAdvancesBySale = it.priorAdvancesBySale + ("s1" to 42.0), fundHistoryConfirmed = true)
        }
        assertEquals("equity", editor.tax.fundKind("f"))
        assertEquals(42.0, editor.tax.priorAdvances("s1"))
        assertEquals(true, editor.draft["tax"]["fundHistoryConfirmed"].bool())
    }

    @Test fun PLAN027_recordedIncomeNewestFirst() {
        val years = english.incomeYears(envelope().results!!.income!!)
        assertEquals(listOf(2026, 2025), years.map { it.year })
        assertEquals(listOf("Gross income", "Recorded withholding and fees", "Recorded net income"), years[0].rows.map { it.label })
        assertEquals(listOf("€512.04", "€149.72", "€362.32"), years[0].rows.map { it.value })
    }

    @Test fun PLAN028_PLAN029_PLAN030_forecastCards() {
        val income = envelope().results!!.income!!
        val cards = english.forecastCards(income, portfolio())
        assertEquals(12, cards.size)
        assertEquals("12 Nov 2026", cards[0].date)
        assertEquals("ETF Euro Stoxx Dividend Demo", cards[0].instrument)
        assertEquals("€35.66", cards[0].gross)
        assertEquals("More information needed", cards[0].net)
        assertTrue(cards[0].netUnavailable)
        assertEquals("€626.63", english.amount(income.totalGross))
        assertTrue(income.bondsWithoutTerms.isEmpty())
        assertEquals(setOf("dividendo", "cedola"), income.events.map { it.kind }.toSet())
    }

    @Test fun PLAN031_noScenarioRowsWithoutSimulations() {
        assertTrue(envelope().results!!.income!!.events.none { it.benchmark })
    }
}
