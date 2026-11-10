package io.buddybudget.core.domain.imports

import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

// Personal CSV / Excel imports (14-imports, IMP-*): pure rules ported from the web's `components/domain/personal-import/*`,
// `lib/personal-import/{island,preview-groups,review-groups}.ts`, `lib/queries/personal-imports.ts` and the import
// history of Investimenti (`components/domain/investments/import-history.ts`, INV-106). Same names on iOS
// (`PersonalImport.swift`). Italian strings are catalog sources.

// ---------------------------------------------------------------- API model

@Serializable
data class PersonalImportListing(val formats: List<Format> = emptyList(), val jobs: List<Job> = emptyList()) {
    @Serializable
    data class Format(val id: String, val name: String)

    /**
     * Counts of a finished import. `rows` (movements in the file) and `alreadyPresent` exist since web #461 (older jobs
     * have neither); `bankCategorized` since web #456.
     */
    @Serializable
    data class Results(
        val cash: Int = 0,
        val investments: Int = 0,
        val skipped: Int = 0,
        val bankCategorized: Int = 0,
        val rows: Int? = null,
        val alreadyPresent: Int? = null,
    )

    @Serializable
    data class Job(
        val id: String,
        val formatId: String = "",
        val status: String,
        val correctionOf: String? = null,
        val estimatedAt: String = "",
        val expiresAt: String = "",
        val createdAt: String = "",
        val error: String? = null,
        val results: Results? = null,
    )

    fun formatName(id: String): String? = formats.firstOrNull { it.id == id }?.name
}

@Serializable
data class PersonalImportPreview(val headers: List<String> = emptyList(), val currency: String = "EUR", val records: List<Record> = emptyList()) {
    @Serializable
    data class Outcome(
        val row: Int = 0,
        val kind: String,
        val date: String? = null,
        val currency: String? = null,
        val description: String? = null,
        val amount: Double? = null,
        val transfer: Boolean? = null,
        val type: String? = null,
        val name: String? = null,
        val quantity: Double? = null,
        val price: Double? = null,
        val grossAmount: Double? = null,
        val reason: String? = null,
    )

    @Serializable
    data class Record(val key: String, val source: List<String> = emptyList(), val line: Int? = null, val rate: Double? = null, val outcome: Outcome) {
        val id: String get() = key
    }
}

@Serializable
data class PersonalImportCorrection(
    val currency: String = "EUR",
    val before: List<CashRow> = emptyList(),
    val tradesBefore: List<Trade> = emptyList(),
    val after: List<CashRow> = emptyList(),
    val investmentsBefore: Int = 0,
    val investmentsAfter: Int = 0,
) {
    @Serializable
    data class CashRow(val date: String, val description: String, val amount: Double, val investment: Trade? = null)

    @Serializable
    data class Trade(
        val date: String? = null, val description: String? = null, val currency: String, val grossAmount: Double? = null,
        val type: String, val quantity: Double = 0.0, val price: Double = 0.0, val fees: Double = 0.0, val taxes: Double = 0.0,
    )

    val cashBefore: Double get() = before.sumOf { it.amount }
    val cashAfter: Double get() = after.sumOf { it.amount }
    val tradesAfter: List<Trade> get() = after.mapNotNull { row -> row.investment?.copy(date = row.date, description = row.description) }
}

@Serializable
data class PersonalImportDeletion(
    val token: String = "",
    val name: String = "",
    val cashCount: Int = 0,
    val investmentCount: Int = 0,
    val uploads: List<Upload> = emptyList(),
) {
    @Serializable
    data class Upload(val id: String, val createdAt: String)
}

// ---------------------------------------------------------------- Rules

data class PersonalImportReceiptFile(val name: String, val size: Int? = null, val rows: Int? = null, val source: String)

enum class PersonalImportIslandState { Running, Done, Failed, Review }

data class PersonalImportLoadedFile(val name: String, val size: Int, val csv: String)

/** A catalog source with its `{n}` values. */
data class ImportText(val template: String, val values: Map<String, String> = emptyMap(), val verbatim: Boolean = false)

object PersonalImportRules {
    const val MAX_BYTES = 25 * 1024 * 1024
    const val MAX_ROWS = 50_000
    const val CONSENT_VERSION = "openrouter-raw-zdr-v3"
    const val POLL_INTERVAL_MS = 3000L
    const val ISLAND_VISIBLE_SECONDS = 24 * 60 * 60L
    const val MAX_DISMISSED = 50
    const val REVIEW_ROWS_PER_REASON = 5
    const val ROWS_PAGE_SIZE = 25
    const val NAME_MAX_LENGTH = 80
    const val FEEDBACK_MAX_LENGTH = 2000
    val activeStatuses = setOf("queued", "processing", "ready")

    fun statusLabel(status: String): String = when (status) {
        "queued" -> "In attesa di analisi"
        "processing" -> "Stiamo analizzando il CSV"
        "correction_ready" -> "Correzione da confermare"
        "ready" -> "Salvataggio in corso"
        "review_failed" -> "Righe da controllare"
        "failed" -> "Analisi non riuscita"
        "imported" -> "Importato"
        "expired" -> "File scaduto"
        else -> status
    }

    fun isActive(job: PersonalImportListing.Job?): Boolean = job != null && job.status in activeStatuses

    fun shouldPoll(listing: PersonalImportListing?): Boolean = listing?.jobs?.any { isActive(it) } ?: false

    fun islandState(status: String): PersonalImportIslandState? = when {
        status == "correction_ready" -> PersonalImportIslandState.Review
        status in activeStatuses -> PersonalImportIslandState.Running
        status == "imported" -> PersonalImportIslandState.Done
        status == "failed" || status == "review_failed" -> PersonalImportIslandState.Failed
        else -> null
    }

    fun islandJobs(jobs: List<PersonalImportListing.Job>, dismissed: Set<String>, now: Instant): List<PersonalImportListing.Job> =
        jobs.filter { job ->
            val created = instant(job.createdAt) ?: return@filter false
            islandState(job.status) != null && job.id !in dismissed && now.epochSecond - created.epochSecond < ISLAND_VISIBLE_SECONDS
        }.sortedByDescending { instant(it.createdAt) }

    fun runningIds(jobs: List<PersonalImportListing.Job>): Set<String> =
        jobs.filter { islandState(it.status) == PersonalImportIslandState.Running }.map { it.id }.toSet()

    fun finishedSince(previous: Set<String>, jobs: List<PersonalImportListing.Job>): Boolean {
        val running = runningIds(jobs)
        return previous.any { it !in running }
    }

    fun addDismissed(id: String, list: List<String>): List<String> = (list.filter { it != id } + id).takeLast(MAX_DISMISSED)

    /** `importOverlap` (web #461): how many movements of the file were already there. */
    enum class Overlap { NothingNew, Partial, AllNew, Unknown }

    fun overlap(results: PersonalImportListing.Results?): Overlap {
        val rows = results?.rows ?: return Overlap.Unknown
        val present = results.alreadyPresent ?: return Overlap.Unknown
        return when {
            present == 0 -> Overlap.AllNew
            present >= rows -> Overlap.NothingNew
            else -> Overlap.Partial
        }
    }

    /** IMP-030: the line under the receipt title of a finished import (`importSummary`). */
    fun importSummary(results: PersonalImportListing.Results?): ImportText = when (overlap(results)) {
        Overlap.NothingNew -> if (results!!.rows == 1) ImportText("Il movimento del file c'era già: non abbiamo aggiunto niente.")
            else ImportText("Tutti i {0} movimenti del file c'erano già: non abbiamo aggiunto niente.", mapOf("0" to results.rows.toString()))
        Overlap.Partial -> ImportText("{0} su {1} movimenti importati: gli altri c'erano già.",
            mapOf("0" to (results!!.rows!! - results.alreadyPresent!!).toString(), "1" to results.rows.toString()))
        else -> ImportText("I dati sono già nel tuo conto.")
    }

    /** IMP-030: «Niente di nuovo da importare» replaces «Importazione completata» when every movement was already there. */
    fun receiptTitle(status: String?, results: PersonalImportListing.Results?): String =
        if (status == "imported" && overlap(results) == Overlap.NothingNew) "Niente di nuovo da importare" else receiptTitle(status)

    /** IMP-030: the receipt lists what was added unless nothing was new. */
    fun showsAddedLines(results: PersonalImportListing.Results): Boolean = overlap(results) != Overlap.NothingNew

    /**
     * IMP-030: the notes under the added counts — skipped rows, movements that took the bank's category (web #456) and,
     * only for older jobs without the counts, the generic «already there» line.
     */
    fun receiptNotes(results: PersonalImportListing.Results): List<ImportText> = buildList {
        if (results.skipped > 0) add(
            if (results.skipped == 1) ImportText("1 riga non riconosciuta è stata saltata, come hai scelto: non entra nei conti.")
            else ImportText("{0} righe non riconosciute sono state saltate, come hai scelto: non entrano nei conti.", mapOf("0" to results.skipped.toString())),
        )
        if (results.bankCategorized > 0) add(
            if (results.bankCategorized == 1) ImportText("1 movimento ha già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.")
            else ImportText("{0} movimenti hanno già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.", mapOf("0" to results.bankCategorized.toString())),
        )
        if (overlap(results) == Overlap.Unknown) add(ImportText("Le righe già presenti sono state saltate, senza doppioni."))
    }

    /** IMP-062: the server refused a file already imported (`409 {code:"already_imported"}`): a notice, not a fault. */
    const val ALREADY_IMPORTED_CODE = "already_imported"

    /**
     * IMP-049…054 (correction of a wrong AI import) are not on web `main` (decision 0004: only on the unmerged web
     * branch `codex/import-result-correction`): the entry point stays off until the web ships it.
     */
    const val CORRECTIONS_ENABLED = false

    /** Island card title and detail. */
    fun islandText(job: PersonalImportListing.Job, source: String): Pair<ImportText, ImportText> {
        val state = islandState(job.status)
        val correctionReady = job.status == "correction_ready"
        val review = job.status == "review_failed" || correctionReady
        val title = ImportText(
            when {
                state == PersonalImportIslandState.Running -> "{0}: importo il file"
                review -> "{0}: da controllare"
                state == PersonalImportIslandState.Failed -> "{0}: non riuscito"
                overlap(job.results) == Overlap.NothingNew -> "{0}: niente di nuovo"
                else -> "{0}: completato"
            },
            mapOf("0" to source),
        )
        val results = job.results
        val detail = when {
            correctionReady -> ImportText("Confronta la correzione prima di confermare.")
            state == PersonalImportIslandState.Running -> ImportText("Puoi continuare a usare l'app.")
            review -> ImportText("Vedi quali righe e scegli cosa fare.")
            state == PersonalImportIslandState.Failed -> ImportText("Vedi cosa fare.")
            results != null && overlap(results) == Overlap.NothingNew -> ImportText("I movimenti c'erano già tutti.")
            results != null && overlap(results) == Overlap.Partial -> ImportText("{0} su {1} movimenti importati",
                mapOf("0" to (results.rows!! - results.alreadyPresent!!).toString(), "1" to results.rows.toString()))
            results != null -> ImportText("{0} movimenti · {1} operazioni", mapOf("0" to results.cash.toString(), "1" to results.investments.toString()))
            else -> ImportText("Dati aggiunti.")
        }
        return title to detail
    }

    /** `describeImportJob` (IMP-007): message and action. */
    fun describe(job: PersonalImportListing.Job): Pair<ImportText, String?> {
        val r = job.results
        return when (job.status) {
            "queued", "processing" -> ImportText("Analisi in corso") to null
            "correction_ready" -> ImportText("Correzione da confermare") to "Confronta"
            "ready" -> ImportText("Salvataggio in corso") to null
            "imported" -> (when {
                r == null -> ImportText("Importato")
                overlap(r) == Overlap.NothingNew -> ImportText("Niente di nuovo: {0} movimenti c'erano già", mapOf("0" to r.alreadyPresent.toString()))
                overlap(r) == Overlap.Partial -> ImportText("{0} su {1} movimenti importati", mapOf("0" to (r.rows!! - r.alreadyPresent!!).toString(), "1" to r.rows.toString()))
                else -> ImportText("{0} movimenti · {1} operazioni", mapOf("0" to r.cash.toString(), "1" to r.investments.toString()))
            }) to "Dettaglio"
            "review_failed" -> (job.error?.let { ImportText(it, verbatim = true) } ?: ImportText("Qualche riga da correggere")) to "Controlla"
            "failed" -> (job.error?.let { ImportText(it, verbatim = true) } ?: ImportText("Formato non riconosciuto")) to "Riprova"
            "expired" -> ImportText("File scaduto: caricalo di nuovo") to "Riprova"
            else -> ImportText(job.status, verbatim = true) to null
        }
    }

    fun tapRetries(job: PersonalImportListing.Job): Boolean = describe(job).second == "Riprova" && job.correctionOf == null

    fun receiptStage(status: String?): Int = when (status) {
        "imported" -> 4
        "ready" -> 2
        else -> 1
    }

    val receiptStages = listOf("File ricevuto", "Analisi del formato", "Controlli e salvataggio", "Importato")

    fun receiptTitle(status: String?): String = when {
        status == "imported" -> "Importazione completata"
        isFailed(status) -> "Non siamo riusciti a importare il file"
        else -> "File ricevuto"
    }

    fun isFailed(status: String?): Boolean = status in setOf("failed", "review_failed", "expired")

    fun reportJob(jobs: List<PersonalImportListing.Job>?, selected: String?, receiptJobId: String?): PersonalImportListing.Job? {
        if (receiptJobId != null) return jobs?.firstOrNull { it.id == receiptJobId } ?: PersonalImportListing.Job(receiptJobId, "", "queued")
        if (selected != null) return jobs?.firstOrNull { it.id == selected }
        return jobs?.firstOrNull { isActive(it) }
    }

    enum class ReportKind { Correction, Review, Receipt }

    fun reportKind(job: PersonalImportListing.Job, correcting: String?): ReportKind = when {
        correcting == job.id || (job.correctionOf != null && job.status != "imported") -> ReportKind.Correction
        job.status == "review_failed" -> ReportKind.Review
        else -> ReportKind.Receipt
    }

    fun showsUploadForm(report: PersonalImportListing.Job?, hasReceipt: Boolean, correcting: String?): Boolean {
        if (hasReceipt || correcting != null) return false
        if (report != null && report.correctionOf != null && report.status != "imported") return false
        return true
    }

    /** `formatFileSize`. */
    fun fileSize(bytes: Int, locale: BBLocale): ImportText =
        if (bytes >= 1024 * 1024) ImportText("{0} MB", mapOf("0" to BBFormat.formatNumber(bytes / 1024.0 / 1024.0, locale, 0, 1)))
        else ImportText("{0} KB", mapOf("0" to maxOf(1, JSNumber.round(bytes / 1024.0).toInt()).toString()))

    fun countCsvRows(csv: String): Int = maxOf(0, csv.split(Regex("\r?\n")).count { JSNumber.trim(it).isNotEmpty() } - 1)

    enum class FileKind { Xlsx, Xls, Text }

    fun fileKind(name: String): FileKind {
        val lower = name.lowercase()
        return when {
            lower.endsWith(".xlsx") -> FileKind.Xlsx
            lower.endsWith(".xls") -> FileKind.Xls
            else -> FileKind.Text
        }
    }

    fun sizeText(bytes: Int, locale: BBLocale): String = fileSize(bytes, locale).let { it.template.replace("{0}", it.values.getValue("0")) }

    fun fileError(name: String, size: Int, locale: BBLocale): ImportText? = when (fileKind(name)) {
        FileKind.Xlsx -> if (size > ImportXlsx.MAX_FILE_BYTES) ImportText("Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.",
            mapOf("0" to sizeText(size, locale), "1" to sizeText(ImportXlsx.MAX_FILE_BYTES, locale))) else null
        FileKind.Xls -> ImportText("I file .xls (Excel antico) non si leggono. In Excel scegli «Salva con nome» e poi «Cartella di lavoro di Excel (.xlsx)» o «CSV».")
        FileKind.Text -> if (size > MAX_BYTES) ImportText("Il file pesa {0}: il massimo è {1}.", mapOf("0" to sizeText(size, locale), "1" to sizeText(MAX_BYTES, locale))) else null
    }

    fun decodeText(data: ByteArray): String = data.decodeToString()

    /** `readPersonalImportFile`. */
    fun read(name: String, data: ByteArray): PersonalImportLoadedFile = when (fileKind(name)) {
        FileKind.Xlsx -> PersonalImportLoadedFile(name, data.size, ImportXlsx.csv(data))
        else -> PersonalImportLoadedFile(name, data.size, decodeText(data))
    }

    enum class UploadStep { Source, File, Consent }

    fun missing(step: UploadStep, isNew: Boolean, name: String, hasFile: Boolean, consent: Boolean): List<String> = when (step) {
        UploadStep.Source -> if (isNew && JSNumber.trim(name).isEmpty()) listOf("scrivi da dove arriva il file") else emptyList()
        UploadStep.File -> if (hasFile) emptyList() else listOf("scegli il file")
        UploadStep.Consent -> if (consent) emptyList() else listOf("dai il consenso all'analisi")
    }

    enum class PreviewTab { Importable, Ignored, Errors }

    data class PreviewGroups(
        val importable: List<PersonalImportPreview.Record> = emptyList(),
        val ignored: List<PersonalImportPreview.Record> = emptyList(),
        val errors: List<PersonalImportPreview.Record> = emptyList(),
        val cash: Int = 0,
        val investments: Int = 0,
    ) {
        fun records(tab: PreviewTab) = when (tab) {
            PreviewTab.Importable -> importable
            PreviewTab.Ignored -> ignored
            PreviewTab.Errors -> errors
        }

        val tabs: List<PreviewTab>
            get() = listOf(PreviewTab.Importable) + (if (ignored.isEmpty()) emptyList() else listOf(PreviewTab.Ignored)) +
                (if (errors.isEmpty()) emptyList() else listOf(PreviewTab.Errors))

        val defaultTab: PreviewTab get() = if (errors.isEmpty()) PreviewTab.Importable else PreviewTab.Errors
    }

    fun groups(records: List<PersonalImportPreview.Record>): PreviewGroups {
        val importable = mutableListOf<PersonalImportPreview.Record>()
        val ignored = mutableListOf<PersonalImportPreview.Record>()
        val errors = mutableListOf<PersonalImportPreview.Record>()
        var cash = 0
        var investments = 0
        for (record in records) {
            when (record.outcome.kind) {
                "cash" -> { importable.add(record); cash += 1 }
                "investment" -> { importable.add(record); investments += 1 }
                "ignore" -> ignored.add(record)
                else -> errors.add(record)
            }
        }
        return PreviewGroups(importable, ignored, errors, cash, investments)
    }

    data class ErrorReasonGroup(val reason: String, val records: List<PersonalImportPreview.Record>) {
        val id: String get() = reason
    }

    /** `groupErrorsByReason`. */
    fun errorsByReason(records: List<PersonalImportPreview.Record>): List<ErrorReasonGroup> {
        val groups = LinkedHashMap<String, MutableList<PersonalImportPreview.Record>>()
        for (record in records) {
            if (record.outcome.kind != "error") continue
            val reason = JSNumber.trim(record.outcome.reason ?: "").ifEmpty { "Riga non riconosciuta" }
            groups.getOrPut(reason) { mutableListOf() }.add(record)
        }
        return groups.entries.mapIndexed { i, e -> i to ErrorReasonGroup(e.key, e.value) }
            .sortedWith(compareByDescending<Pair<Int, ErrorReasonGroup>> { it.second.records.size }.thenBy { it.first }).map { it.second }
    }

    fun sourceLine(record: PersonalImportPreview.Record): Int = record.line ?: (record.outcome.row + 1)

    fun sourceText(record: PersonalImportPreview.Record): String = JSNumber.trim(record.source.joinToString(" · "))

    data class RowSummary(
        val date: String?, val title: String, val kind: String?, val quantity: Double?, val price: Double?, val line: Int,
        val amount: Double?, val currency: String?, val positive: Boolean,
    )

    fun rowSummary(record: PersonalImportPreview.Record): RowSummary {
        val o = record.outcome
        val line = record.line ?: (o.row + 2)
        return when (o.kind) {
            "cash" -> {
                val amount = o.amount ?: 0.0
                RowSummary(o.date, o.description ?: "", if (o.transfer == true) "Giroconto" else "Movimento", null, null, line, amount, o.currency, amount >= 0)
            }
            "investment" -> {
                val quantity = o.quantity ?: 0.0
                val price = o.price ?: 0.0
                val gross = o.grossAmount
                val amount = gross ?: (-(quantity * price) * (if (o.type == "vendita") -1 else 1))
                RowSummary(o.date, o.name ?: "", ImportOperationTypes.label(o.type ?: ""), quantity.takeIf { it != 0.0 }, price.takeIf { quantity != 0.0 },
                    line, amount, o.currency, gross != null)
            }
            else -> RowSummary(o.date, o.reason ?: "", null, null, null, line, null, null, false)
        }
    }

    fun instant(iso: String): Instant? = runCatching { Instant.parse(iso) }.getOrNull()

    /** List day label (IMP-007): `oggi HH:mm`, `ieri`, or `d MMM`. */
    fun dayLabel(iso: String, now: Instant, zone: ZoneId, locale: BBLocale): ImportText {
        val date = instant(iso) ?: return ImportText("{0}", mapOf("0" to iso))
        val day = CalendarDate.of(date, zone)
        val days = CalendarDate.of(now, zone).epochDay - day.epochDay
        if (days <= 0) {
            val z = ZonedDateTime.ofInstant(date, zone)
            return ImportText("oggi {0}", mapOf("0" to BBFormat.formatTime(z.hour, z.minute, locale)))
        }
        if (days == 1) return ImportText("ieri")
        return ImportText("{0}", mapOf("0" to BBFormat.formatDate(day, BBDateSkeleton.D_MMM, locale)))
    }

    fun dayMonthTime(iso: String, zone: ZoneId, locale: BBLocale): String {
        val date = instant(iso) ?: return iso
        val z = ZonedDateTime.ofInstant(date, zone)
        return "${BBFormat.formatDate(CalendarDate.of(date, zone), BBDateSkeleton.D_MMMM, locale)}, ${BBFormat.formatTime(z.hour, z.minute, locale)}"
    }

    fun dayMonth(iso: String, zone: ZoneId, locale: BBLocale): String =
        instant(iso)?.let { BBFormat.formatDate(CalendarDate.of(it, zone), BBDateSkeleton.D_MMMM, locale) } ?: ""
}

// ---------------------------------------------------------------- Import history (INV-106)

@Serializable
data class BrokerStatementRecord(
    val id: String,
    val accountKey: String = "",
    val portfolioId: String = "",
    val createdAt: String = "",
    val statement: Statement,
) {
    @Serializable
    data class Statement(
        val provider: String? = null,
        val account: String = "",
        val from: String = "",
        val to: String = "",
        val positions: List<JsonElement> = emptyList(),
        val ledger: List<JsonElement> = emptyList(),
        val issues: List<String> = emptyList(),
    )
}

enum class ImportStatusTone { Ok, Warning, Error, Pending }

data class ImportHistoryDetail(val one: String, val many: String, val count: Int?)

data class ImportHistoryItem(
    val key: String,
    val kind: Kind,
    val id: String,
    val source: String,
    val period: Pair<String, String>?,
    val createdAt: String,
    val details: List<ImportHistoryDetail>,
    val statusLabel: String,
    val warnings: Int?,
    val tone: ImportStatusTone,
) {
    enum class Kind { Broker, Personal }
}

data class ImportHistoryGroup(val source: String, val items: List<ImportHistoryItem>) {
    val id: String get() = source
}

object ImportHistory {
    const val VISIBLE = 6
    const val RESET_CONFIRMATION = "AZZERA INVESTIMENTI"

    private fun brokerSource(s: BrokerStatementRecord.Statement): String = when (s.provider) {
        "trade-republic" -> ImportProviders.info(ImportProviderId.TradeRepublic).name
        "degiro" -> ImportProviders.info(ImportProviderId.Degiro).name
        else -> "${ImportProviders.info(ImportProviderId.InteractiveBrokers).name} · conto …${s.account.takeLast(4)}"
    }

    fun isIbkrSource(source: String): Boolean = source.startsWith("Interactive Brokers · conto …")

    /** `buildImportHistory`. */
    fun build(statements: List<BrokerStatementRecord>, personal: PersonalImportListing?): List<ImportHistoryItem> {
        val broker = statements.map { record ->
            val s = record.statement
            val details = buildList {
                if (s.positions.isNotEmpty()) add(ImportHistoryDetail("posizione", "posizioni", s.positions.size))
                if (s.ledger.isNotEmpty()) add(ImportHistoryDetail("movimento di cassa", "movimenti di cassa", s.ledger.size))
            }
            val warnings = s.issues.size
            ImportHistoryItem("broker:${record.id}", ImportHistoryItem.Kind.Broker, record.id, brokerSource(s), s.from to s.to, record.createdAt, details,
                if (warnings > 0) "avvisi" else "Importato", warnings.takeIf { it > 0 }, if (warnings > 0) ImportStatusTone.Warning else ImportStatusTone.Ok)
        }
        val custom = personal?.jobs.orEmpty().map { job ->
            val tone = when (job.status) {
                "imported" -> ImportStatusTone.Ok
                "failed", "review_failed" -> ImportStatusTone.Error
                "expired" -> ImportStatusTone.Warning
                else -> ImportStatusTone.Pending
            }
            ImportHistoryItem("personal:${job.id}", ImportHistoryItem.Kind.Personal, job.id, personal?.formatName(job.formatId) ?: "CSV personale", null,
                job.createdAt, listOf(ImportHistoryDetail("CSV personale", "CSV personale", null)), PersonalImportRules.statusLabel(job.status), null, tone)
        }
        return (broker + custom).sortedByDescending { PersonalImportRules.instant(it.createdAt) ?: Instant.MIN }
    }

    fun group(items: List<ImportHistoryItem>): List<ImportHistoryGroup> =
        items.groupBy { it.source }.map { (source, grouped) -> ImportHistoryGroup(source, grouped) }

    fun affectedStatements(id: String, statements: List<BrokerStatementRecord>): List<BrokerStatementRecord> {
        val selected = statements.firstOrNull { it.id == id } ?: return emptyList()
        return statements.filter { it.accountKey == selected.accountKey && it.statement.from >= selected.statement.from }
    }

    fun date(value: String, zone: ZoneId, locale: BBLocale): String {
        if (value.length == 10) CalendarDate.parse(value)?.let { return BBFormat.formatDate(it, BBDateSkeleton.D_MMM_Y, locale) }
        val instant = PersonalImportRules.instant(value) ?: return value
        return BBFormat.formatDate(CalendarDate.of(instant, zone), BBDateSkeleton.D_MMM_Y, locale)
    }

    fun period(from: String, to: String, zone: ZoneId, locale: BBLocale): String =
        if (from == to) date(from, zone, locale) else "${date(from, zone, locale)} – ${date(to, zone, locale)}"
}

@Serializable
data class InvestmentResetPreview(
    val revision: String,
    val operations: Int = 0,
    val untrackedOperations: Int = 0,
    val statements: Int = 0,
    val prices: Int = 0,
    val cashAccounts: Int = 0,
)

@Serializable
data class ImportRunResult(
    val rows: List<Row> = emptyList(),
    val counts: Counts = Counts(),
    val error: String? = null,
    val inserted: Int = 0,
    val instrumentsCreated: Int = 0,
    val replacement: Replacement? = null,
) {
    @Serializable
    data class Row(val line: Int, val status: String, val message: String? = null)

    @Serializable
    data class Counts(val new: Int = 0, val duplicate: Int = 0, val error: Int = 0)

    @Serializable
    data class Replacement(val statements: Int, val operations: Int, val from: String, val to: String)
}

// ---------------------------------------------------------------- Routes

object ImportsRoutes {
    /** `/importazioni?job={id}` (IMP-004). */
    fun jobId(path: String): String? {
        val query = path.split("?", limit = 2).getOrNull(1) ?: return null
        for (pair in query.split("&")) {
            val parts = pair.split("=", limit = 2)
            if (parts.size == 2 && parts[0] == "job" && parts[1].isNotEmpty()) return java.net.URLDecoder.decode(parts[1], "UTF-8")
        }
        return null
    }

    /** In-app path of a link opened from outside (`https://buddybudget.io/importazioni?job=…`, `buddybudget://…`). */
    fun inAppPath(url: String): String? {
        val uri = runCatching { java.net.URI(url) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        var path = when (scheme) {
            "https", "http" -> {
                val host = uri.host?.lowercase() ?: return null
                if (host != "buddybudget.io" && host != "www.buddybudget.io" && host != "app.buddybudget.io") return null
                uri.rawPath ?: ""
            }
            "buddybudget" -> {
                if (uri.host == "bank") return null
                "/" + ((uri.host ?: "") + (uri.rawPath ?: "")).trim('/')
            }
            else -> return null
        }
        if (path.isEmpty()) path = "/"
        uri.rawQuery?.takeIf { it.isNotEmpty() }?.let { path += "?$it" }
        return path
    }
}
