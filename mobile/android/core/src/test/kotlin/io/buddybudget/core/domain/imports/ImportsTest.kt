package io.buddybudget.core.domain.imports

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.BrokerImportApi
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.pension.PensionImport
import io.buddybudget.core.domain.pension.PensionImportField
import io.buddybudget.core.domain.pension.PensionImportState
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.shell.AppTab
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Imports (14-imports IMP-*, 07-investments INV-092…110, 09-pension PEN-014/018). Golden vectors of the web TypeScript
// (`imports/import-rules-vectors.json`, sample files) and real responses of the dev server (2026-10-19), copied from
// spec/api/fixtures into core/src/test/resources/fixtures until the spec submodule is bumped. Twin: ImportsTests.swift.

private fun bytes(name: String): ByteArray = ImportsTest::class.java.getResource("/fixtures/$name")!!.readBytes()
private fun text(name: String): String = bytes(name).decodeToString()
private val json = ApiClient.DefaultJson
private val vectors: JsonObject by lazy { json.parseToJsonElement(text("imports/import-rules-vectors.json")).jsonObject["vectors"]!!.jsonObject }
private const val TODAY = "2026-10-19"

/** Numbers compared as doubles (Kotlin writes 10 as 10.0, JS as 10). */
private fun norm(e: JsonElement): Any? = when (e) {
    is JsonNull -> null
    is JsonPrimitive -> if (e.isString) e.content else e.booleanOrNull ?: e.doubleOrNull
    is JsonArray -> e.map(::norm)
    is JsonObject -> e.mapValues { norm(it.value) }
}

private fun JsonElement.str(key: String): String? = (jsonObject[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun rowJson(row: ImportRow): Any? = when (row) {
    is ImportRow.Ok -> mapOf(
        "line" to row.line.toDouble(), "status" to "ok",
        "identity" to mapOf("key" to row.identity.key, "symbol" to row.identity.symbol, "isin" to row.identity.isin, "name" to row.identity.name,
            "currency" to row.identity.currency, "symbolIsYahoo" to row.identity.symbolIsYahoo),
        "operation" to mapOf("type" to row.operation.type, "date" to row.operation.date, "quantity" to row.operation.quantity, "price" to row.operation.price,
            "grossAmount" to row.operation.grossAmount, "fees" to row.operation.fees, "taxes" to row.operation.taxes, "note" to row.operation.note),
        "warnings" to row.warnings,
    )
    is ImportRow.Skipped -> mapOf("line" to row.line.toDouble(), "status" to "skipped", "message" to row.text)
    is ImportRow.Error -> mapOf("line" to row.line.toDouble(), "status" to "error", "message" to row.text)
}

private fun mappingJson(m: ImportMapping): Any? = mapOf(
    "columns" to m.columns.entries.associate { it.key.raw to it.value.toDouble() }, "dateOrder" to m.dateOrder.name.lowercase(),
    "decimal" to m.decimal.symbol.toString(), "typeValues" to m.typeValues, "defaultType" to m.defaultType, "symbolIsYahoo" to m.symbolIsYahoo,
)

private fun job(status: String, id: String = "j", created: String = "2026-10-19T10:00:00.000Z", correctionOf: String? = null, error: String? = null,
                results: PersonalImportListing.Results? = null) = PersonalImportListing.Job(id, "f", status, correctionOf, createdAt = created, error = error, results = results)

class ImportsTest {
    // ---------------------------------------------------------------- XLSX (IMP-018, PEN-014)

    @Test fun IMP018_readsTheFirstSheetLikeTheWeb() {
        val v = vectors["xlsx"]!!.jsonObject
        val grid = ImportXlsx.read(bytes("imports/sample.xlsx"))
        assertEquals(norm(v["headers"]!!), grid.headers)
        assertEquals(norm(v["rows"]!!), grid.rows)
        assertEquals(v.str("csv"), ImportXlsx.csv(bytes("imports/sample.xlsx")))
    }

    @Test fun IMP019_rejectsFilesThatAreNotXlsx() {
        val e = assertFailsWith<ImportXlsxException> { ImportXlsx.read("not a zip".encodeToByteArray()) }
        assertEquals("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV", e.text)
        assertTrue(PersonalImportRules.fileError("vecchio.XLS", 10, BBLocale.IT_IT)!!.template.startsWith("I file .xls (Excel antico)"))
        assertEquals(ImportText("Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.", mapOf("0" to "6 MB", "1" to "5 MB")),
            PersonalImportRules.fileError("big.xlsx", 6 * 1024 * 1024, BBLocale.IT_IT))
        assertEquals(mapOf("0" to "26 MB", "1" to "25 MB"), PersonalImportRules.fileError("a.csv", 26 * 1024 * 1024, BBLocale.IT_IT)?.values)
        assertNull(PersonalImportRules.fileError("a.csv", 100, BBLocale.IT_IT))
    }

    @Test fun IMP018_jsNumberToStringMatchesJavaScript() {
        assertEquals("10880", ImportXlsx.jsToString(10880.0))
        assertEquals("11250.4", ImportXlsx.jsToString(11250.4))
        assertEquals("0.30000000000000004", ImportXlsx.jsToString(0.1 + 0.2))
        assertEquals("1e-7", ImportXlsx.jsToString(1e-7))
        assertEquals("0.000001", ImportXlsx.jsToString(0.000001))
        assertEquals("1e+21", ImportXlsx.jsToString(1e21))
        assertEquals("-2.5e-8", ImportXlsx.jsToString(-2.5e-8))
        assertEquals("123456789012345680000", ImportXlsx.jsToString(123456789012345680000.0))
        assertEquals("2025-12-31", ImportXlsx.excelSerialToIso(46022.0))
        assertNull(ImportXlsx.excelSerialToIso(0.5))
    }

    // ---------------------------------------------------------------- Broker files (INV-093…099)

    @Test fun INV094_detectsTheFormatFromContent() {
        vectors["detect"]!!.jsonArray.forEach { v ->
            val content = v.str("file")?.let(::text) ?: v.str("text")!!
            assertEquals(v.str("provider"), ImportProviders.detect(content)?.raw, v.toString())
        }
    }

    @Test fun INV095_warnsWhenTheFileDoesNotMatchTheChosenProvider() {
        vectors["mismatch"]!!.jsonArray.forEach { v ->
            val chosen = ImportProviderId.of(v.str("chosen")!!)!!
            val detected = v.str("detected")?.let(ImportProviderId::of)
            assertEquals(v.str("message"), ImportProviders.mismatchMessage(chosen, detected))
        }
        assertEquals(listOf(ImportProviderId.TradeRepublic, ImportProviderId.Degiro, ImportProviderId.Fineco, ImportProviderId.InteractiveBrokers,
            ImportProviderId.YahooPortfolio), ImportProviders.all.map { it.id })
    }

    @Test fun INV098_mapsGenericFilesLikeTheWeb() {
        vectors["generic"]!!.jsonArray.forEach { v ->
            val table = ImportCsv.parse(text(v.str("file")!!))
            assertEquals(v.str("delimiter"), table.delimiter.toString())
            val (mapping, preset) = ImportPresets.initialMapping(table)
            assertEquals(v.str("preset"), preset?.id)
            assertEquals(norm(v.jsonObject["mapping"]!!), mappingJson(mapping), v.str("file"))
            assertEquals(norm(v.jsonObject["missing"]!!), ImportMappingRules.missingFields(mapping))
            val rows = ImportNormalize.rows(table, mapping, TODAY)
            assertEquals(norm(v.jsonObject["rows"]!!), rows.map(::rowJson), v.str("file"))
            val ids = v.jsonObject["identities"]!!.jsonArray
            val identities = ImportNormalize.identities(rows)
            assertEquals(ids.map { it.str("key") }, identities.map { it.identity.key })
            assertEquals(ids.map { it.jsonObject["count"]!!.jsonPrimitive.intOrNull }, identities.map { it.count })
            assertEquals(norm(v.jsonObject["metadata"]!!), norm(ImportFormatMetadata.mapped(table, mapping, null)))
        }
    }

    @Test fun INV098_readsTheFinecoDossierTable() {
        val v = vectors["fineco"]!!.jsonObject
        val content = text(v["file"]!!.jsonPrimitive.content)
        assertEquals(true, v["looksLike"]!!.jsonPrimitive.booleanOrNull)
        assertTrue(FinecoImport.looksLikeFineco(content))
        val table = FinecoImport.parseTable(content)
        assertEquals(norm(v["table"]!!.jsonObject["headers"]!!), table.headers)
        assertEquals(norm(v["table"]!!.jsonObject["rows"]!!), table.rows)
        val mapping = FinecoImport.mapping(table)
        assertEquals(norm(v["mapping"]!!), mappingJson(mapping))
        assertEquals(norm(v["rows"]!!), ImportNormalize.rows(table, mapping, TODAY).map(::rowJson))
    }

    @Test fun INV098_suggestsColumnsAndRemembersTheMappingPerHeaders() {
        vectors["suggestColumns"]!!.jsonArray.forEach { v ->
            val headers = v.jsonObject["headers"]!!.jsonArray.map { it.jsonPrimitive.content }
            assertEquals(norm(v.jsonObject["columns"]!!), ImportMappingRules.suggestColumns(headers).entries.associate { it.key.raw to it.value.toDouble() })
        }
        assertEquals("bb-import-mapping:data|quantitan", ImportMappingRules.storageKey(listOf("Data", "Quantità (n.)")))
        val table = ImportCsv.parse(text("imports/generic-operazioni.csv"))
        val mapping = ImportPresets.initialMapping(table).first
        val stored = json.decodeFromString(StoredImportMapping.serializer(), json.encodeToString(StoredImportMapping.serializer(), StoredImportMapping.of(mapping)))
        assertEquals(mapping, stored.mapping())
        assertTrue(ImportMappingRules.savedMappingIsValid(mapping, table.headers))
        assertFalse(ImportMappingRules.savedMappingIsValid(mapping, listOf("a")))
        assertEquals("acquisto", ImportMappingRules.settingColumn(mapping, ImportField.Type, 1, table).typeValues["a"])
    }

    @Test fun INV095_explainsRowAndFileMessagesLikeTheWeb() {
        vectors["explainRow"]!!.jsonArray.forEach { e ->
            val explained = ImportMessages.explainRow(e.str("message")!!)
            assertEquals(e.str("text"), explained.text)
            assertEquals(e.str("hint"), explained.hint)
        }
        vectors["explainFile"]!!.jsonArray.forEach { e ->
            val explained = ImportMessages.explainFile(e.str("message")!!)
            assertEquals(e.str("text"), explained.text)
            assertEquals(e.str("hint"), explained.hint)
        }
    }

    @Test fun INV093_validatesTheSelection() {
        assertEquals("Seleziona al massimo 20 file alla volta.", ImportBatch.validate(List(21) { 10L }))
        assertEquals("Ogni file deve essere più piccolo di 5 MB.", ImportBatch.validate(listOf(6L * 1024 * 1024)))
        assertEquals("La selezione supera 25 MB. Seleziona meno file.", ImportBatch.validate(List(7) { 4L * 1024 * 1024 }))
        assertNull(ImportBatch.validate(listOf(1L, 2L)))
    }

    private fun degiro(): ActivityStatement = json.decodeFromString(ActivityStatement.serializer(), text("investments-import-parse-degiro.json"))

    @Test fun INV096_decodesTheServerStatementPreview() {
        val parsed = degiro()
        assertEquals(ImportProviderId.Degiro, parsed.provider)
        assertFalse(parsed.isEmpty)
        val rows = parsed.rows
        assertEquals(listOf(5, 9, 10), rows.map { it.line })
        assertTrue(rows.all { it.isOk })
        assertEquals(5.0, (rows.first() as ImportRow.Ok).operation.grossAmount)
        assertTrue(parsed.warnings.isEmpty())
        assertEquals(listOf(3), ImportNormalize.identities(rows).map { it.count })
        assertEquals("2025-01-01", parsed.statement?.from)
    }

    @Test fun INV103_ordersStatementsIbkrFirstThenByAccountAndPeriod() {
        val files = listOf(PreparedStatementFile("b.csv", "", degiro()), PreparedStatementFile("a.csv", "", degiro()))
        assertEquals(listOf("b.csv", "a.csv"), ImportBatch.order(files).map { it.name })
    }

    @Test fun INV099_resolvesInstrumentsAndDescribesTheChoice() {
        val resolved = BrokerImportApi.parseResolve(text("investments-import-resolve.json"))
        val choice = InstrumentChoice.of(resolved.values.first())
        assertEquals("Da controllare", ImportChoices.describe(choice).title)
        assertEquals(1, ImportChoices.attentionRank(choice))
        assertEquals("Fonti non raggiungibili", ImportChoices.describe(InstrumentChoice.Skip("unavailable")).title)
        assertEquals("Non trovato", ImportChoices.describe(null).title)
        assertTrue(ImportChoices.describe(InstrumentChoice.Known(Instrument("1", isin = "IT1", name = "X", priceMode = "manuale"))).text.startsWith("Ha i prezzi manuali"))
    }

    @Test fun INV100_decodesTheDryRunAndBuildsTheRequest() {
        val result = json.decodeFromString(ImportRunResult.serializer(), text("investments-import-dry-run.json"))
        assertEquals(3, result.counts.new)
        assertEquals(0, result.inserted)
        val parsed = degiro()
        val key = parsed.identities[0].key
        val input = JsonObject(mapOf("source" to JsonPrimitive("yahoo"), "yahooSymbol" to JsonPrimitive("VWCE.MI")))
        val request = assertNotNull(RunImportRequest.build(parsed.rows, mapOf(key to InstrumentChoice.Create(input, "", "", "etf", "guess", "yahoo")), emptySet(), true, "degiro"))
            .copy(statementCsv = "csv")
        val body = request.json()
        assertEquals(true, body["dryRun"]!!.jsonPrimitive.booleanOrNull)
        assertEquals(3, body["operations"]!!.jsonArray.size)
        assertEquals("VWCE.MI", body["instruments"]!!.jsonArray[0].jsonObject["create"]!!.jsonObject["yahooSymbol"]!!.jsonPrimitive.content)
        assertNull(RunImportRequest.build(parsed.rows, mapOf(key to InstrumentChoice.Skip("not_found")), emptySet(), true, null))
        assertNull(RunImportRequest.build(parsed.rows, mapOf(key to InstrumentChoice.Known(Instrument("i", name = "x"))), setOf(key), true, null))
    }

    // ---------------------------------------------------------------- Import management (INV-106…110)

    private fun statements(): List<BrokerStatementRecord> =
        json.parseToJsonElement(text("investments-statements.json")).jsonObject["statements"]!!.let {
            json.decodeFromJsonElement(ListSerializer(BrokerStatementRecord.serializer()), it)
        }

    @Test fun INV106_listsBrokerAndPersonalImportsGroupedBySource() {
        val personal = json.decodeFromString(PersonalImportListing.serializer(), text("personal-imports-imported.json"))
        val history = ImportHistory.build(statements(), personal)
        assertEquals(listOf(ImportHistoryItem.Kind.Personal, ImportHistoryItem.Kind.Broker), history.map { it.kind })
        assertEquals("DEGIRO", history[1].source)
        assertEquals(listOf(8), history[1].details.map { it.count })
        assertEquals("Banca Prova", history[0].source)
        assertEquals("Importato", history[0].statusLabel)
        assertEquals(listOf("Banca Prova", "DEGIRO"), ImportHistory.group(history).map { it.source })
        assertEquals("1 gen 2025 – 5 gen 2025", ImportHistory.period("2025-01-01", "2025-01-05", ZoneId.of("Europe/Rome"), BBLocale.IT_IT))
        assertEquals("1 gen 2025", ImportHistory.period("2025-01-01", "2025-01-01", ZoneId.systemDefault(), BBLocale.IT_IT))
    }

    @Test fun INV107_deletesLaterStatementsOfTheSameAccountToo() {
        val base = statements()[0]
        fun record(id: String, account: String, from: String) = base.copy(id = id, accountKey = account, statement = base.statement.copy(from = from, to = from))
        val all = listOf(record("a", "x", "2024-01-01"), record("b", "x", "2025-01-01"), record("c", "y", "2026-01-01"), record("d", "x", "2023-01-01"))
        assertEquals(listOf("a", "b"), ImportHistory.affectedStatements("a", all).map { it.id })
        assertTrue(ImportHistory.affectedStatements("zz", all).isEmpty())
    }

    @Test fun INV108_decodesThePersonalDeletionPreview() {
        val preview = json.decodeFromString(PersonalImportDeletion.serializer(), text("personal-import-deletion.json"))
        assertEquals("Banca Prova", preview.name)
        assertEquals(6, preview.cashCount)
        assertEquals(64, preview.token.length)
    }

    @Test fun INV109_resetNeedsTheExactLiteral() {
        assertEquals("AZZERA INVESTIMENTI", ImportHistory.RESET_CONFIRMATION)
    }

    // ---------------------------------------------------------------- Personal imports (IMP-*)

    @Test fun IMP002_decodesFormatsAndJobsNewestFirst() {
        val listing = json.decodeFromString(PersonalImportListing.serializer(), text("personal-imports-review.json"))
        assertEquals(listOf("Banca Prova"), listing.formats.map { it.name })
        assertEquals("review_failed", listing.jobs[0].status)
        assertEquals("Banca Prova", listing.formatName(listing.jobs[0].formatId))
        val imported = json.decodeFromString(PersonalImportListing.serializer(), text("personal-imports-imported.json"))
        assertEquals(PersonalImportListing.Results(6, 0, 0), imported.jobs[0].results)
    }

    @Test fun IMP003_pollsOnlyWhileAJobRuns() {
        assertTrue(PersonalImportRules.shouldPoll(PersonalImportListing(emptyList(), listOf(job("processing")))))
        assertTrue(PersonalImportRules.shouldPoll(PersonalImportListing(emptyList(), listOf(job("ready")))))
        assertFalse(PersonalImportRules.shouldPoll(PersonalImportListing(emptyList(), listOf(job("imported"), job("review_failed")))))
        assertFalse(PersonalImportRules.shouldPoll(null))
    }

    @Test fun IMP004_opensAJobFromItsPathOrLink() {
        assertEquals("abc-1", ImportsRoutes.jobId("/importazioni?job=abc-1"))
        assertNull(ImportsRoutes.jobId("/importazioni"))
        assertEquals("/importazioni?job=x", ImportsRoutes.inAppPath("https://buddybudget.io/importazioni?job=x"))
        assertEquals("/importazioni?job=x", ImportsRoutes.inAppPath("buddybudget://importazioni?job=x"))
        assertNull(ImportsRoutes.inAppPath("buddybudget://bank/return?ref=1"))
        assertNull(ImportsRoutes.inAppPath("https://example.com/importazioni"))
        assertEquals(AppDestination.Imports, AppDestination.fromPath("/importazioni?job=x"))
        assertEquals(AppTab.Liquidity, AppDestination.Imports.tab)
    }

    @Test fun IMP005_reportJobFollowsUploadSelectionThenFirstActive() {
        val jobs = listOf(job("imported", "a"), job("processing", "b"))
        assertEquals("b", PersonalImportRules.reportJob(jobs, null, null)?.id)
        assertEquals("a", PersonalImportRules.reportJob(jobs, "a", null)?.id)
        assertEquals("new", PersonalImportRules.reportJob(jobs, "a", "new")?.id)
        assertNull(PersonalImportRules.reportJob(listOf(job("imported")), null, null))
    }

    @Test fun IMP006_choosesCorrectionReviewOrReceipt() {
        assertEquals(PersonalImportRules.ReportKind.Review, PersonalImportRules.reportKind(job("review_failed"), null))
        assertEquals(PersonalImportRules.ReportKind.Correction, PersonalImportRules.reportKind(job("imported"), "j"))
        assertEquals(PersonalImportRules.ReportKind.Correction, PersonalImportRules.reportKind(job("correction_ready", correctionOf = "o"), null))
        assertEquals(PersonalImportRules.ReportKind.Receipt, PersonalImportRules.reportKind(job("imported", correctionOf = "o"), null))
        assertEquals(PersonalImportRules.ReportKind.Receipt, PersonalImportRules.reportKind(job("failed"), null))
        assertFalse(PersonalImportRules.showsUploadForm(null, true, null))
        assertFalse(PersonalImportRules.showsUploadForm(job("queued", correctionOf = "o"), false, null))
        assertTrue(PersonalImportRules.showsUploadForm(job("imported"), false, null))
    }

    @Test fun IMP007_describesRowsAndDays() {
        assertEquals(ImportText("Analisi in corso"), PersonalImportRules.describe(job("processing")).first)
        assertEquals(ImportText("{0} movimenti · {1} operazioni", mapOf("0" to "3", "1" to "1")) to "Dettaglio",
            PersonalImportRules.describe(job("imported", results = PersonalImportListing.Results(3, 1, 0))))
        assertEquals(ImportText("x", verbatim = true), PersonalImportRules.describe(job("review_failed", error = "x")).first)
        assertEquals("Riprova", PersonalImportRules.describe(job("expired")).second)
        val rome = ZoneId.of("Europe/Rome")
        val now = Instant.parse("2026-10-19T18:00:00.000Z")
        assertEquals(ImportText("oggi {0}", mapOf("0" to "10:05")), PersonalImportRules.dayLabel("2026-10-19T08:05:00.000Z", now, rome, BBLocale.IT_IT))
        assertEquals(ImportText("ieri"), PersonalImportRules.dayLabel("2026-10-18T08:05:00.000Z", now, rome, BBLocale.IT_IT))
        assertEquals(ImportText("{0}", mapOf("0" to "2 ott")), PersonalImportRules.dayLabel("2026-10-02T08:05:00Z", now, rome, BBLocale.IT_IT))
        assertEquals("Correzione da confermare", PersonalImportRules.statusLabel("correction_ready"))
    }

    @Test fun IMP009_failedRowsGoToTheForm() {
        assertTrue(PersonalImportRules.tapRetries(job("failed")))
        assertTrue(PersonalImportRules.tapRetries(job("expired")))
        assertFalse(PersonalImportRules.tapRetries(job("failed", correctionOf = "o")))
        assertFalse(PersonalImportRules.tapRetries(job("review_failed")))
    }

    @Test fun IMP013_listsWhatTheStepMisses() {
        assertEquals(listOf("scrivi da dove arriva il file"), PersonalImportRules.missing(PersonalImportRules.UploadStep.Source, true, "  ", false, false))
        assertTrue(PersonalImportRules.missing(PersonalImportRules.UploadStep.Source, false, "", false, false).isEmpty())
        assertEquals(listOf("scegli il file"), PersonalImportRules.missing(PersonalImportRules.UploadStep.File, true, "x", false, false))
        assertEquals(listOf("dai il consenso all'analisi"), PersonalImportRules.missing(PersonalImportRules.UploadStep.Consent, true, "x", true, false))
    }

    @Test fun IMP021_showsTheFileSizeAndRows() {
        assertEquals(ImportText("{0} KB", mapOf("0" to "1")), PersonalImportRules.fileSize(500, BBLocale.IT_IT))
        assertEquals(ImportText("{0} MB", mapOf("0" to "1,5")), PersonalImportRules.fileSize(1536 * 1024, BBLocale.IT_IT))
        assertEquals(2, PersonalImportRules.countCsvRows("a;b\n1;2\n\n3;4\n"))
        assertEquals(6, PersonalImportRules.countCsvRows(PersonalImportRules.read("banca-prova.csv", bytes("imports/banca-prova.csv")).csv))
        assertTrue(PersonalImportRules.read("sample.xlsx", bytes("imports/sample.xlsx")).csv.startsWith("Data;Contributi netti;Controvalore"))
    }

    @Test fun IMP028_derivesTheReceiptStage() {
        assertEquals(1, PersonalImportRules.receiptStage("queued"))
        assertEquals(1, PersonalImportRules.receiptStage("processing"))
        assertEquals(2, PersonalImportRules.receiptStage("ready"))
        assertEquals(4, PersonalImportRules.receiptStage("imported"))
        assertEquals("Non siamo riusciti a importare il file", PersonalImportRules.receiptTitle("expired"))
        assertEquals("File ricevuto", PersonalImportRules.receiptTitle("ready"))
    }

    private fun preview() = json.decodeFromString(PersonalImportPreview.serializer(), text("personal-import-preview.json"))

    @Test fun IMP034_groupsThePreviewByOutcome() {
        val groups = PersonalImportRules.groups(preview().records)
        assertEquals(6, groups.errors.size)
        assertEquals(1, groups.ignored.size)
        assertTrue(groups.importable.isEmpty())
        assertEquals(listOf(PersonalImportRules.PreviewTab.Importable, PersonalImportRules.PreviewTab.Ignored, PersonalImportRules.PreviewTab.Errors), groups.tabs)
        assertEquals(PersonalImportRules.PreviewTab.Errors, groups.defaultTab)
    }

    @Test fun IMP042_groupsErrorsByReasonMostFrequentFirst() {
        val reasons = PersonalImportRules.errorsByReason(preview().records)
        assertEquals(6, reasons.sumOf { it.records.size })
        assertEquals("Divisa mancante o non valida.", reasons[0].reason)
        fun err(key: String, reason: String) = PersonalImportPreview.Record(key, listOf("x"), outcome = PersonalImportPreview.Outcome(0, "error", reason = reason))
        val ordered = PersonalImportRules.errorsByReason(listOf(err("1", "A"), err("2", "B"), err("3", "B"), err("4", " "), err("5", "A")))
        assertEquals(listOf("A", "B", "Riga non riconosciuta"), ordered.map { it.reason })
    }

    @Test fun IMP043_lineNumbersReferToTheOriginalFile() {
        val record = PersonalImportPreview.Record("k", listOf(" a ", "b"), outcome = PersonalImportPreview.Outcome(3, "error", reason = "x"))
        assertEquals(4, PersonalImportRules.sourceLine(record))
        assertEquals("a  · b", PersonalImportRules.sourceText(record))
        assertEquals(9, PersonalImportRules.sourceLine(record.copy(line = 9)))
    }

    @Test fun IMP046_summarisesEachRow() {
        val cash = PersonalImportPreview.Record("c", emptyList(), 2, outcome = PersonalImportPreview.Outcome(1, "cash", "2026-10-02", "EUR", "Stipendio", 2150.0, false))
        assertEquals(PersonalImportRules.RowSummary("2026-10-02", "Stipendio", "Movimento", null, null, 2, 2150.0, "EUR", true), PersonalImportRules.rowSummary(cash))
        val buy = PersonalImportPreview.Record("b", emptyList(), outcome = PersonalImportPreview.Outcome(4, "investment", "2026-10-03", "USD", type = "acquisto", name = "ETF",
            quantity = 2.0, price = 10.0))
        val s = PersonalImportRules.rowSummary(buy)
        assertEquals(-20.0, s.amount)
        assertEquals(6, s.line)
        assertEquals("Acquisto", s.kind)
        val sell = PersonalImportPreview.Record("s", emptyList(), outcome = PersonalImportPreview.Outcome(4, "investment", type = "vendita", name = "ETF", quantity = 2.0, price = 10.0))
        assertEquals(20.0, PersonalImportRules.rowSummary(sell).amount)
    }

    @Test fun IMP058_islandShowsRecentNotDismissedJobs() {
        val now = Instant.parse("2026-10-19T18:00:00.000Z")
        val jobs = listOf(job("imported", "old", "2026-10-18T17:00:00.000Z"), job("processing", "a", "2026-10-19T10:00:00.000Z"),
            job("failed", "b", "2026-10-19T12:00:00.000Z"), job("expired", "c", "2026-10-19T13:00:00.000Z"))
        assertEquals(listOf("b", "a"), PersonalImportRules.islandJobs(jobs, emptySet(), now).map { it.id })
        assertEquals(listOf("a"), PersonalImportRules.islandJobs(jobs, setOf("b"), now).map { it.id })
        val (title, detail) = PersonalImportRules.islandText(job("imported", results = PersonalImportListing.Results(6, 0, 0)), "Banca Prova")
        assertEquals(ImportText("{0}: completato", mapOf("0" to "Banca Prova")), title)
        assertEquals(ImportText("{0} movimenti · {1} operazioni", mapOf("0" to "6", "1" to "0")), detail)
        assertEquals(ImportText("Confronta la correzione prima di confermare."), PersonalImportRules.islandText(job("correction_ready"), "x").second)
        assertEquals(PersonalImportIslandState.Failed, PersonalImportRules.islandState("review_failed"))
    }

    @Test fun IMP059_remembersTheLast50Dismissals() {
        var list = emptyList<String>()
        repeat(60) { list = PersonalImportRules.addDismissed("id$it", list) }
        assertEquals(50, list.size)
        assertEquals("id10", list.first())
        assertEquals("id20", PersonalImportRules.addDismissed("id20", list).last())
    }

    @Test fun IMP060_detectsFinishedJobs() {
        assertTrue(PersonalImportRules.finishedSince(setOf("a"), listOf(job("imported", "a"))))
        assertFalse(PersonalImportRules.finishedSince(setOf("a"), listOf(job("ready", "a"))))
        assertFalse(PersonalImportRules.finishedSince(emptySet(), listOf(job("imported", "a"))))
    }

    // ---------------------------------------------------------------- Pensione (PEN-014, PEN-018)

    @Test fun PEN014_readsSnapshotsFromCsvAndExcelFiles() {
        val state = PensionImportState(TODAY, emptyList()).loadFile("sample.xlsx", bytes("imports/sample.xlsx"))
        assertEquals(PensionImportState.Step.Columns, state.step)
        assertEquals("sample.xlsx", state.fileName)
        assertEquals(io.buddybudget.core.domain.imports.ImportDecimalSeparator.DOT, state.table?.decimalFallback)
        assertEquals(0, state.mapping?.columns?.get(PensionImportField.Date))
        val csv = PensionImportState(TODAY, emptyList()).loadFile("modello.csv", PensionImport.templateData())
        assertEquals(2, csv.snapshots.size)
        assertEquals(11250.4, csv.snapshots[0].value)
        val bad = PensionImportState(TODAY, emptyList()).loadFile("x.xlsx", "nope".encodeToByteArray())
        assertEquals("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV", bad.error)
        assertEquals("Il file non sembra una tabella con intestazioni e almeno una riga", bad.loadFile("x.csv", "solo".encodeToByteArray()).error)
    }

    @Test fun PEN018_buildsTheDownloadableTemplate() {
        assertEquals("Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11420,00;11890,15", PensionImport.templateCsv())
        assertEquals(listOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()), PensionImport.templateData().take(3))
        assertEquals("buddybudget-modello-pensione.csv", PensionImport.TEMPLATE_FILE_NAME)
    }
}
