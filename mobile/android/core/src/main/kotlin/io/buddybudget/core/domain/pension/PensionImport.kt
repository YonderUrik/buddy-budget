package io.buddybudget.core.domain.pension

import io.buddybudget.core.data.PensionImportCounts
import io.buddybudget.core.data.PensionImportRowInput
import io.buddybudget.core.data.PensionSnapshot
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.imports.ImportCsv
import io.buddybudget.core.domain.imports.ImportDateOrder
import io.buddybudget.core.domain.imports.ImportDecimalSeparator
import io.buddybudget.core.domain.imports.ImportGrid
import io.buddybudget.core.domain.imports.ImportValues
import io.buddybudget.core.domain.imports.ImportXlsx
import io.buddybudget.core.domain.imports.ImportXlsxException

// Port of the web's `lib/pension/import/mapping.ts` and `plan.ts` (PEN-014…018): a CSV/TXT/XLSX file (read on the
// device, `ImportXlsx` for Excel) or pasted text, and the downloadable template. Same names on iOS (`PensionImport.swift`).

enum class PensionImportField(val label: String) { Date("Data"), NetContributions("Contributi netti"), Value("Controvalore") }

data class PensionImportTable(val headers: List<String>, val rows: List<List<String>>, val decimalFallback: ImportDecimalSeparator)

data class PensionImportMapping(val columns: Map<PensionImportField, Int>, val dateOrder: ImportDateOrder, val decimal: ImportDecimalSeparator)

data class PensionImportedSnapshot(val line: Int, val date: String, val netContributions: Double, val value: Double)

sealed interface PensionImportRow {
    val line: Int

    data class Ok(val snapshot: PensionImportedSnapshot) : PensionImportRow {
        override val line: Int get() = snapshot.line
    }

    data class Error(override val line: Int, val message: String) : PensionImportRow
}

data class PensionPlannedRow(
    val line: Int,
    val date: String,
    val status: Status,
    /** Italian source with values. */
    val message: String? = null,
    val messageValues: Map<String, String> = emptyMap(),
    val previous: Pair<Double, Double>? = null,
) {
    enum class Status { New, Update, Unchanged, Error }
}

data class PensionImportPlan(
    val rows: List<PensionPlannedRow>,
    val counts: PensionImportCounts,
    val error: String? = null,
    val errorValues: Map<String, String> = emptyMap(),
) {
    val nothingToWrite: Boolean get() = counts.new + counts.update == 0
    val blocked: Boolean get() = counts.error > 0 || error != null
}

object PensionImport {
    private val headerSynonyms = mapOf(
        PensionImportField.Date to listOf("data", "date", "datariferimento", "datadiriferimento", "dataposizione", "dataaggiornamento", "datavalore", "datavaluta"),
        PensionImportField.NetContributions to listOf("contributinetti", "contributonetto", "netcontributions", "versamentinetti", "totaleversato", "versato",
            "contributiversati", "contributi", "contributions", "versamenti"),
        PensionImportField.Value to listOf("controvalore", "controvaloreattuale", "valoreposizione", "posizionematurata", "posizione", "montante", "saldo",
            "valore", "value", "balance", "patrimonio"),
    )
    private const val MAX_AMOUNT = 1e8

    /** `PENSION_TEMPLATE_HEADERS` and the template rows (PEN-018). */
    val templateHeaders = listOf("Data", "Contributi netti", "Controvalore")
    private val templateRows = listOf(listOf("31/03/2026", "10880,00", "11250,40"), listOf("30/06/2026", "11420,00", "11890,15"))
    const val TEMPLATE_FILE_NAME = "buddybudget-modello-pensione.csv"

    /** `pensionTemplateCsv`: `;`-separated, decimal comma, day/month/year. */
    fun templateCsv(): String = (listOf(templateHeaders) + templateRows).joinToString("\n") { it.joinToString(";") }

    /** The template file as downloaded (BOM so Excel shows the accents). */
    fun templateData(): ByteArray = ("\uFEFF" + templateCsv()).encodeToByteArray()

    /** Table of an Excel sheet (`readXlsx`: decimals with the dot). */
    fun table(grid: ImportGrid): PensionImportTable = PensionImportTable(grid.headers, grid.rows, ImportDecimalSeparator.DOT)

    fun readTable(text: String): PensionImportTable {
        val table = ImportCsv.parse(text)
        return PensionImportTable(table.headers, table.rows, if (table.delimiter == ';') ImportDecimalSeparator.COMMA else ImportDecimalSeparator.DOT)
    }

    fun suggestColumns(headers: List<String>): Map<PensionImportField, Int> {
        val normalized = headers.map(ImportValues::normalizeHeader)
        val used = mutableSetOf<Int>()
        val columns = mutableMapOf<PensionImportField, Int>()
        for (exact in listOf(true, false)) {
            for (field in PensionImportField.entries) {
                if (columns[field] != null) continue
                for (synonym in headerSynonyms.getValue(field)) {
                    val index = normalized.indices.firstOrNull { i ->
                        i !in used && (if (exact) normalized[i] == synonym else synonym.length >= 6 && normalized[i].startsWith(synonym))
                    }
                    if (index != null) {
                        columns[field] = index
                        used.add(index)
                        break
                    }
                }
            }
        }
        return columns
    }

    private fun columnValues(table: PensionImportTable, column: Int?): List<String> =
        if (column == null) emptyList() else table.rows.map { it.getOrElse(column) { "" } }.filter { JSNumber.trim(it).isNotEmpty() }

    fun initialMapping(table: PensionImportTable): PensionImportMapping {
        val columns = suggestColumns(table.headers)
        val numbers = columnValues(table, columns[PensionImportField.NetContributions]) + columnValues(table, columns[PensionImportField.Value])
        return PensionImportMapping(columns, ImportValues.detectDateOrder(columnValues(table, columns[PensionImportField.Date])),
            ImportValues.detectDecimalSeparator(numbers, table.decimalFallback))
    }

    fun missingFields(mapping: PensionImportMapping): List<String> = PensionImportField.entries.filter { mapping.columns[it] == null }.map { it.label }

    fun normalizeRows(table: PensionImportTable, mapping: PensionImportMapping, today: String): List<PensionImportRow> {
        val date = mapping.columns[PensionImportField.Date] ?: return emptyList()
        val net = mapping.columns[PensionImportField.NetContributions] ?: return emptyList()
        val value = mapping.columns[PensionImportField.Value] ?: return emptyList()
        return table.rows.mapIndexed { i, cells ->
            val line = i + 2
            val iso = ImportValues.parseDate(cells.getOrElse(date) { "" }, mapping.dateOrder)
                ?: return@mapIndexed PensionImportRow.Error(line, "Data non valida")
            if (!PensionRules.isPlausibleDate(iso, today)) return@mapIndexed PensionImportRow.Error(line, "Data nel futuro o troppo vecchia")
            val n = ImportValues.parseNumber(cells.getOrElse(net) { "" }, mapping.decimal)
                ?: return@mapIndexed PensionImportRow.Error(line, "Contributi netti non validi")
            val v = ImportValues.parseNumber(cells.getOrElse(value) { "" }, mapping.decimal)
                ?: return@mapIndexed PensionImportRow.Error(line, "Controvalore non valido")
            if (n < 0 || v < 0 || n > MAX_AMOUNT || v > MAX_AMOUNT) return@mapIndexed PensionImportRow.Error(line, "Importo fuori dai limiti")
            PensionImportRow.Ok(PensionImportedSnapshot(line, iso, n, v))
        }
    }

    private fun cents(n: Double): Double = JSNumber.round(n * 100)

    fun plan(incoming: List<PensionImportedSnapshot>, existing: List<PensionSnapshot>, today: String, maxSnapshots: Int = PensionRules.MAX_SNAPSHOTS): PensionImportPlan {
        val saved = existing.associateBy { it.date }
        val seen = mutableMapOf<String, PensionImportedSnapshot>()
        fun same(a: Pair<Double, Double>, b: Pair<Double, Double>) = cents(a.first) == cents(b.first) && cents(a.second) == cents(b.second)
        val rows = incoming.map { snap ->
            if (!PensionRules.isPlausibleDate(snap.date, today)) {
                return@map PensionPlannedRow(snap.line, snap.date, PensionPlannedRow.Status.Error, "Data nel futuro o troppo vecchia")
            }
            val earlier = seen[snap.date]
            if (earlier != null) {
                val equal = same(earlier.netContributions to earlier.value, snap.netContributions to snap.value)
                return@map PensionPlannedRow(snap.line, snap.date, if (equal) PensionPlannedRow.Status.Unchanged else PensionPlannedRow.Status.Error,
                    if (equal) "Uguale alla riga {0}" else "Stessa data della riga {0} con valori diversi", mapOf("0" to earlier.line.toString()))
            }
            seen[snap.date] = snap
            val current = saved[snap.date] ?: return@map PensionPlannedRow(snap.line, snap.date, PensionPlannedRow.Status.New)
            val equal = same(current.netContributions to current.value, snap.netContributions to snap.value)
            PensionPlannedRow(snap.line, snap.date, if (equal) PensionPlannedRow.Status.Unchanged else PensionPlannedRow.Status.Update,
                previous = current.netContributions to current.value)
        }
        val counts = PensionImportCounts(
            rows.count { it.status == PensionPlannedRow.Status.New }, rows.count { it.status == PensionPlannedRow.Status.Update },
            rows.count { it.status == PensionPlannedRow.Status.Unchanged }, rows.count { it.status == PensionPlannedRow.Status.Error },
        )
        val tooMany = existing.size + counts.new > maxSnapshots
        return PensionImportPlan(rows, counts, if (tooMany) "Il fondo avrebbe più di {0} fotografie" else null,
            if (tooMany) mapOf("0" to maxSnapshots.toString()) else emptyMap())
    }
}

/** State of the «Importa le fotografie» wizard (paste → columns → summary). Same fields as `PensionImportState` on iOS. */
data class PensionImportState(
    val today: String,
    val existing: List<PensionSnapshot>,
    val step: Step = Step.File,
    val text: String = "",
    val table: PensionImportTable? = null,
    val mapping: PensionImportMapping? = null,
    val done: PensionImportCounts? = null,
    /** Name of the file read (null for pasted text). */
    val fileName: String? = null,
    /** Italian source of the file-step error (unreadable file or table without rows). */
    val error: String? = null,
) {
    enum class Step(val label: String) { File("File"), Columns("Colonne"), Summary("Riepilogo") }

    /** «Leggi»: reads the pasted rows and guesses the mapping (`Leggi` disabled with blank text). */
    fun read(): PensionImportState {
        if (JSNumber.trim(text).isEmpty()) return this
        return load(PensionImport.readTable(text), null)
    }

    /** `load`: a table from a file or pasted text; needs headers and at least one row. */
    fun load(table: PensionImportTable, name: String?): PensionImportState {
        if (table.headers.size < 2 || table.rows.isEmpty()) return copy(error = "Il file non sembra una tabella con intestazioni e almeno una riga")
        return copy(table = table, mapping = PensionImport.initialMapping(table), fileName = name, error = null, step = Step.Columns)
    }

    /** PEN-014: a picked file (CSV/TXT as UTF-8 text, XLSX first sheet). */
    fun loadFile(name: String, data: ByteArray): PensionImportState =
        if (name.lowercase().endsWith(".xlsx")) {
            try {
                load(PensionImport.table(ImportXlsx.read(data)), name)
            } catch (e: ImportXlsxException) {
                copy(error = e.text)
            }
        } else {
            load(PensionImport.readTable(data.decodeToString()), name)
        }

    val rows: List<PensionImportRow>
        get() = if (table != null && mapping != null) PensionImport.normalizeRows(table, mapping, today) else emptyList()
    val snapshots: List<PensionImportedSnapshot> get() = rows.mapNotNull { (it as? PensionImportRow.Ok)?.snapshot }
    val problems: List<PensionImportRow.Error> get() = rows.filterIsInstance<PensionImportRow.Error>()
    val missing: List<String> get() = mapping?.let(PensionImport::missingFields) ?: emptyList()
    val plan: PensionImportPlan get() = PensionImport.plan(snapshots, existing, today)
    val canContinue: Boolean get() = missing.isEmpty() && snapshots.isNotEmpty()
    val tooManyRows: Boolean get() = snapshots.size > PensionRules.IMPORT_MAX_ROWS
    val payload: List<PensionImportRowInput> get() = snapshots.map { PensionImportRowInput(it.line, it.date, it.netContributions, it.value) }

    fun back(): PensionImportState = when (step) {
        Step.Summary -> copy(step = Step.Columns)
        Step.Columns -> copy(step = Step.File)
        Step.File -> this
    }
}
