package io.buddybudget.core.domain.support

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ClientErrorReporter
import io.buddybudget.core.data.ClientErrorsApi
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.ReportSendError
import io.buddybudget.core.data.SupportApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.int
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Help & support (16-help-support, SUP-*). Real dev-server responses in resources/fixtures/support.json (copied from
// spec/api/fixtures until the submodule is bumped). Twin: SupportTests.swift.

private val root: JsonObject by lazy {
    Json.parseToJsonElement(SupportTest::class.java.getResource("/fixtures/support.json")!!.readText()).jsonObject
}

private val context = ReportContext.make("/liquidita/conti", "ios-0.1.0 (1)", 402.0, 874.0, dark = true)
private val json = ApiClient.DefaultJson

private fun encode(input: ReportInput): JsonElement = Json.parseToJsonElement(json.encodeToString(ReportInput.serializer(), input))

class SupportTest {
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()

    @AfterTest fun tearDown() = server.close()

    private fun client() = ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore("t"), userAgent = "BuddyBudget-Android/test")

    private fun enqueue(name: String, entry: JsonObject = root.getValue(name).jsonObject) {
        val body = entry["body"]?.takeIf { it !is JsonNull }?.toString() ?: ""
        server.enqueue(MockResponse.Builder().code(entry.getValue("status").jsonPrimitive.int).body(body).build())
    }

    // Help screen

    @Test fun SUP002_fromParameterIsTheContextPath() {
        assertEquals("/liquidita/conti", HelpLaunch.fromPath("/aiuto?da=%2Fliquidita%2Fconti").contextPath)
        assertEquals("/aiuto", HelpLaunch.fromPath("/aiuto").contextPath)
        assertNull(HelpLaunch.fromPath("/aiuto?da=").from)
    }

    @Test fun SUP003_kindParameterIsPreselectedAndInvalidValuesIgnored() {
        assertEquals(ReportKind.Idea, HelpLaunch.fromPath("/aiuto?tipo=idea").kind)
        assertEquals(ReportKind.Domanda, HelpLaunch.fromPath("/aiuto?da=/debiti&tipo=domanda").kind)
        assertEquals(ReportKind.Problema, HelpLaunch.fromPath("/aiuto?tipo=altro").kind)
        assertEquals(ReportKind.Problema, HelpLaunch.fromPath("/aiuto").kind)
        assertNull(ReportKind.parse("PROBLEMA"))
    }

    @Test fun SUP004_statusPageLink() = assertEquals("https://stats.uptimerobot.com/BCuTWm0Ukg", Support.STATUS_URL)

    @Test fun SUP006_fiveQuickAnswersVerbatim() {
        assertEquals(listOf("banca-scaduta", "import-csv", "categoria-sbagliata", "dati-miei", "stime-fiscali"), Support.faq.map { it.id })
        assertEquals("Il collegamento con la banca non si aggiorna più", Support.faq[0].question)
        assertEquals("Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi.", Support.faq[3].answer)
    }

    @Test fun SUP007_githubLinksWithPrefilledIssue() {
        val links = Support.githubLinks(context)
        assertEquals(listOf(GithubLink.Id.Issue, GithubLink.Id.IssueAperte, GithubLink.Id.Novita, GithubLink.Id.Sicurezza), links.map { it.id })
        // Same string as the web's `new URLSearchParams(...).toString()` for this context.
        assertEquals(
            "https://github.com/YonderUrik/buddy-budget/issues/new?template=bug.yml&ambiente=BuddyBudget+ios-0.1.0+%281%29%2C+pagina+%2Fliquidita%2Fconti%2C+schermo+402x874%2C+tema+scuro",
            links[0].href,
        )
        assertEquals("https://github.com/YonderUrik/buddy-budget/issues", links[1].href)
        assertEquals("https://github.com/YonderUrik/buddy-budget/releases", links[2].href)
        assertEquals("https://github.com/YonderUrik/buddy-budget/security/policy", links[3].href)
        assertEquals("In privato, mai in una issue pubblica.", links[3].hint)
        assertEquals("https://github.com/YonderUrik/buddy-budget/issues/new?template=funzionalita.yml", Support.githubIssueUrl(ReportKind.Idea, context))
        assertEquals("BuddyBudget+0.1.0+%281%29%2C+pagina+%2Fa", Support.formEncode("BuddyBudget 0.1.0 (1), pagina /a"))
    }

    // Report form

    @Test fun SUP008_kindLabelsAndPlaceholders() {
        assertEquals(listOf("Un problema", "Una domanda", "Un'idea"), ReportKind.entries.map { it.label })
        assertEquals("Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo.", ReportKind.Problema.placeholder)
        assertEquals("Cosa vuoi sapere?", ReportKind.Domanda.placeholder)
        assertEquals("Cosa ti piacerebbe poter fare?", ReportKind.Idea.placeholder)
    }

    @Test fun SUP009_messageNeedsTenCharactersAfterTrimming() {
        assertFalse(Support.canSubmit("   corto    "))
        assertFalse(Support.canSubmit("123456789"))
        assertTrue(Support.canSubmit("1234567890"))
        assertFalse(Support.canSubmit("Abbastanza lungo", pending = true))
        val input = Support.input(ReportKind.Idea, "a".repeat(4100), false, context, ReportSource.Pagina, null)
        assertEquals(Support.MESSAGE_MAX_LENGTH, input.message.length)
    }

    @Test fun SUP011_contextOmittedWhenUnchecked() {
        val with = Support.input(ReportKind.Domanda, "  Una domanda vera  ", true, context, ReportSource.Pagina, null)
        assertEquals(context, with.context)
        assertEquals("Una domanda vera", with.message)
        val without = Support.input(ReportKind.Domanda, "Una domanda vera", false, context, ReportSource.Pagina, null)
        assertNull(without.context)
        val body = encode(without).jsonObject
        assertFalse("context" in body)
        assertFalse("error" in body)
    }

    @Test fun SUP012_contextHasOnlyPathVersionScreenAndTheme() {
        val raw = ReportContext("/investimenti/titoli/abc?x=1#y", "9".repeat(50), "1x1", ReportTheme.Chiaro)
        assertEquals("/investimenti/titoli/abc", raw.path)
        assertEquals(40, raw.version.length)
        assertEquals("100x100", raw.viewport)
        assertEquals("/", Support.sanitizePath("https://evil.example"))
        assertEquals(120, Support.sanitizePath("/" + "a".repeat(200)).length)
        assertEquals("402x874", context.viewport)
        assertEquals(ReportTheme.Scuro, context.theme)
        val keys = Json.parseToJsonElement(json.encodeToString(ReportContext.serializer(), context)).jsonObject.keys.sorted()
        assertEquals(listOf("path", "theme", "version", "viewport"), keys)
    }

    @Test fun SUP013_sendReturnsTheReference() = runTest {
        enqueue("created")
        val input = Support.input(ReportKind.Domanda, "Fixture capture, dev server only", true,
            ReportContext("/aiuto", "ios-0.1.0 (1)", "402x874", ReportTheme.Chiaro), ReportSource.Pagina, null)
        assertEquals("SUP-7K2QF9", SupportApi(client()).send(input))
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/support", request.url.encodedPath)
        assertEquals(root.getValue("request"), Json.parseToJsonElement(request.body!!.utf8()))
    }

    @Test fun SUP013_twoHundredWithoutReferenceIsAFailure() = runTest {
        enqueue("createdWithoutReference")
        val error = assertFailsWith<ReportSendError> {
            SupportApi(client()).send(Support.input(ReportKind.Idea, "Un'idea lunga", false, context, ReportSource.Pagina, null))
        }
        assertNull(error.serverMessage)
    }

    @Test fun SUP015_failureKeepsTheServerMessage() = runTest {
        for ((name, expected) in listOf(
            "validation" to "Scrivi qualche parola in più.",
            "sendFailedIt" to "Non siamo riusciti a inviare la segnalazione. Riprova o scrivi a support@buddybudget.io.",
        )) {
            enqueue(name)
            val error = assertFailsWith<ReportSendError> {
                SupportApi(client()).send(Support.input(ReportKind.Idea, "Un messaggio", false, context, ReportSource.Pagina, null))
            }
            assertEquals(expected, error.message)
        }
        assertEquals("Non siamo riusciti a inviare la segnalazione.", ReportSendError(null).message)
    }

    @Test fun SUP016_rateLimitMessageFromTheServer() = runTest {
        enqueue("rateLimitedDe")
        val error = assertFailsWith<ReportSendError> {
            SupportApi(client()).send(Support.input(ReportKind.Idea, "Un messaggio", false, context, ReportSource.Pagina, null))
        }
        assertEquals("Du hast bereits mehrere Meldungen gesendet: Versuche es später erneut.", error.message)
    }

    @Test fun SUP018_sourceTagsTheReport() {
        for (source in ReportSource.entries) {
            val body = encode(Support.input(ReportKind.Idea, "Un messaggio", false, context, source, null)).jsonObject
            assertEquals(source.raw, body.getValue("source").jsonPrimitive.content)
        }
    }

    // Quick-report sheet

    @Test fun SUP020_errorForcesTheProblemKind() {
        val error = ReportError(ReportErrorArea.Abbonamento, "Hai già un abbonamento con questo nome")
        val input = Support.input(ReportKind.Idea, "Il salvataggio non va a buon fine", false, context, ReportSource.Errore, error)
        assertEquals(ReportKind.Problema, input.kind)
        assertEquals(root.getValue("requestFromError"), encode(input))
        assertEquals("Salvataggio di un abbonamento", ReportErrorArea.Abbonamento.label)
        assertEquals(13, ReportErrorArea.entries.size)
    }

    @Test fun SUP021_attachedErrorIsCutTo300Characters() {
        assertEquals(300, ReportError(ReportErrorArea.Salvataggio, "x".repeat(400)).message.length)
        assertEquals(ReportErrorArea.ImportMovimenti, ReportErrorArea.fromRaw("import_movimenti"))
        assertNull(ReportErrorArea.fromRaw("boh"))
    }

    // Crash reporting

    @Test fun SUP024_crashReportCarriesOnlyTheArea() {
        assertEquals(ClientErrorArea.Investimenti, ClientErrorArea.fromPath("/investimenti/titoli/abc"))
        assertEquals(ClientErrorArea.Liquidita, ClientErrorArea.fromPath("/liquidita/conti?nuovo=1"))
        assertEquals(ClientErrorArea.Altro, ClientErrorArea.fromPath("/country-unavailable"))
        assertEquals(ClientErrorArea.Altro, ClientErrorArea.fromPath("/"))
        val report = ClientErrorReport.decodingFailure("/panoramica", "api/overview")
        val body = Json.parseToJsonElement(json.encodeToString(ClientErrorReport.serializer(), report))
        assertEquals(root.getValue("clientErrors").jsonObject.getValue("request"), body)
        assertEquals("Risposta non leggibile: /api/debts", ClientErrorReport.decodingFailure("/debiti", "api/debts/abc-123?include=insights").message)
        val long = ClientErrorReport.make(ClientErrorReport.Kind.Sezione, "/aiuto", "n".repeat(99), "", "d".repeat(99))
        assertEquals("Errore senza messaggio", long.message)
        assertEquals(80, long.name?.length)
        assertEquals(64, long.digest?.length)
    }

    @Test fun SUP024_decodingFailureFiresTheHookOnce() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"nope":1}""").build())
        server.enqueue(MockResponse.Builder().code(204).build())
        val client = client()
        val seen = mutableListOf<String>()
        client.events.setOnDecodingFailure { seen += it }
        runCatching { client.get("api/overview", kotlinx.serialization.json.JsonArray.serializer()) }
        assertEquals(listOf("api/overview"), seen)
        val reporter = ClientErrorReporter(ClientErrorsApi(client))
        val report = ClientErrorReport.decodingFailure("/panoramica", "api/overview")
        assertTrue(reporter.report(report))
        assertFalse(reporter.report(report))
        server.takeRequest()
        assertEquals("/api/client-errors", server.takeRequest().url.encodedPath)
        assertEquals(2, server.requestCount)
    }

    @Test fun SUP025_crashReportFailuresAreSilent() = runTest {
        enqueue("invalid", root.getValue("clientErrors").jsonObject.getValue("invalid").jsonObject)
        ClientErrorsApi(client()).report(ClientErrorReport.make(ClientErrorReport.Kind.Sezione, "/aiuto", null, "x"))
        server.enqueue(MockResponse.Builder().code(429).build())
        ClientErrorsApi(client()).report(ClientErrorReport.make(ClientErrorReport.Kind.Sezione, "/aiuto", null, "x"))
    }
}
