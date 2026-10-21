package io.buddybudget.app.features.imports

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.core.data.BrokerImportApi
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.domain.imports.ActivityStatement
import io.buddybudget.core.domain.imports.FinecoImport
import io.buddybudget.core.domain.imports.ImportBatch
import io.buddybudget.core.domain.imports.ImportChoices
import io.buddybudget.core.domain.imports.ImportCsv
import io.buddybudget.core.domain.imports.ImportCsvTable
import io.buddybudget.core.domain.imports.ImportField
import io.buddybudget.core.domain.imports.ImportFormatMetadata
import io.buddybudget.core.domain.imports.ImportIdentityCount
import io.buddybudget.core.domain.imports.ImportMapping
import io.buddybudget.core.domain.imports.ImportMappingRules
import io.buddybudget.core.domain.imports.ImportNormalize
import io.buddybudget.core.domain.imports.ImportPresets
import io.buddybudget.core.domain.imports.ImportProviderId
import io.buddybudget.core.domain.imports.ImportProviders
import io.buddybudget.core.domain.imports.ImportRow
import io.buddybudget.core.domain.imports.ImportRunResult
import io.buddybudget.core.domain.imports.ImportXlsx
import io.buddybudget.core.domain.imports.ImportXlsxException
import io.buddybudget.core.domain.imports.InstrumentChoice
import io.buddybudget.core.domain.imports.PersonalImportRules
import io.buddybudget.core.domain.imports.PreparedStatementFile
import io.buddybudget.core.domain.imports.RunImportRequest
import io.buddybudget.core.domain.imports.StoredImportMapping
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.ZoneId

/**
 * «Importa operazioni» (07-investments §8, INV-092…105): one wizard per file (File → Anteprima → Strumenti →
 * Conferma), several broker statements one at a time, optional AI recovery. Same fields as `BrokerImportModel` on iOS.
 */
class BrokerImportModel(val env: AppEnvironment) {
    enum class Step(val label: String, val hint: String) {
        File("File", "Carica il file esportato dal tuo broker."),
        Mapping("Anteprima", "Controlla cosa ho letto dal file. Non è ancora stato importato nulla."),
        Instruments("Strumenti", "Verifica che ogni titolo del file sia quello giusto."),
        Summary("Conferma", "Ultimo controllo: poi importo tutto in una volta."),
    }

    var isOpen by mutableStateOf(false)
    var aiFallback by mutableStateOf(false)
    var fallbackJobs by mutableStateOf<List<Pair<String, String>>>(emptyList())
        private set
    var batch by mutableStateOf<List<PreparedStatementFile>>(emptyList())
        private set
    var batchIndex by mutableStateOf(0)
        private set
    var fileError by mutableStateOf<String?>(null)
        private set
    var loadingFiles by mutableStateOf(false)
        private set

    var step by mutableStateOf(Step.File)
        private set
    var provider by mutableStateOf<ImportProviderId?>(null)
    var showGuide by mutableStateOf(false)
    var fileName by mutableStateOf<String?>(null)
        private set
    var table by mutableStateOf<ImportCsvTable?>(null)
        private set
    var presetLabel by mutableStateOf<String?>(null)
        private set
    var presetId by mutableStateOf<String?>(null)
        private set
    var statement by mutableStateOf<ActivityStatement?>(null)
        private set
    var statementCsv by mutableStateOf<String?>(null)
        private set
    var mapping by mutableStateOf<ImportMapping?>(null)
        private set
    var choices by mutableStateOf<Map<String, InstrumentChoice>>(emptyMap())
        private set
    var excluded by mutableStateOf<Set<String>>(emptySet())
        private set
    var order by mutableStateOf<List<String>>(emptyList())
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var done by mutableStateOf(false)
        private set
    var fallbackJobId by mutableStateOf<String?>(null)
        private set
    var reading by mutableStateOf(false)
        private set
    var resolving by mutableStateOf(false)
        private set
    var running by mutableStateOf(false)
        private set
    var result by mutableStateOf<ImportRunResult?>(null)
        private set
    var portfolios by mutableStateOf<List<BrokerImportApi.Portfolio>>(emptyList())
        private set
    var portfolioId by mutableStateOf("")

    var onImported: (() -> Unit)? = null
    /** Catalog lookup for messages built here with values (set by the UI). */
    var translate: (String, Map<String, String>) -> String = { s, v -> v.entries.fold(s) { acc, e -> acc.replace("{${e.key}}", e.value) } }
    private val scope = MainScope()
    private val json = Json { ignoreUnknownKeys = true }

    val today: String get() = CalendarDate.of(Instant.now(), ZoneId.systemDefault()).iso
    val isBatch: Boolean get() = batch.isNotEmpty()
    val batchFinished: Boolean get() = isBatch && batchIndex >= batch.size

    val rows: List<ImportRow>
        get() {
            statement?.let { return it.rows }
            val t = table ?: return emptyList()
            val m = mapping ?: return emptyList()
            return ImportNormalize.rows(t, m, today)
        }
    val warnings: List<ActivityStatement.Issue> get() = statement?.warnings.orEmpty()
    val identities: List<ImportIdentityCount> get() = ImportNormalize.identities(rows)
    val missing: List<String> get() = mapping?.let(ImportMappingRules::missingFields).orEmpty()
    val cashCount: Int get() = statement?.cashMovements?.size ?: 0
    val validRows: Int get() = rows.count { it.isOk } + cashCount
    val included: List<ImportIdentityCount>
        get() = identities.filter { choices[it.identity.key]?.isUsable == true && it.identity.key !in excluded }
    val newInstruments: Int get() = included.count { choices[it.identity.key] is InstrumentChoice.Create }
    val busy: Boolean get() = reading || resolving || running || loadingFiles

    // ---------------------------------------------------------------- Session

    fun present(files: List<PickedFile> = emptyList()) {
        resetSession()
        isOpen = true
        if (files.isNotEmpty()) scope.launch {
            pick(files)
            debugAdvance()
        }
    }

    fun close() {
        isOpen = false
    }

    private fun resetSession() {
        aiFallback = false
        fallbackJobs = emptyList()
        batch = emptyList()
        batchIndex = 0
        fileError = null
        resetWizard(null)
        scope.launch { portfolios = runCatching { env.brokerImports.portfolios() }.getOrDefault(emptyList()) }
    }

    private fun resetWizard(initial: PreparedStatementFile?) {
        step = if (initial == null) Step.File else Step.Mapping
        provider = initial?.parsed?.provider
        showGuide = false
        fileName = initial?.name
        table = null
        presetLabel = null
        presetId = null
        statement = initial?.parsed
        statementCsv = initial?.text
        mapping = null
        choices = emptyMap()
        excluded = emptySet()
        order = emptyList()
        error = null
        done = false
        fallbackJobId = null
        result = null
        portfolioId = ""
    }

    fun nextFile() {
        batchIndex += 1
        if (batchIndex < batch.size) resetWizard(batch[batchIndex])
    }

    fun finish() {
        if (isBatch) nextFile() else close()
    }

    fun selectProvider(next: ImportProviderId?) {
        provider = next
        error = null
    }

    // ---------------------------------------------------------------- File step (INV-093…096, INV-103, INV-104)

    fun pickAsync(files: List<PickedFile>) {
        scope.launch { pick(files) }
    }

    suspend fun pick(files: List<PickedFile>) {
        if (busy || files.isEmpty()) return
        fileError = null
        ImportBatch.validate(files.map { it.data.size.toLong() })?.let {
            fileError = it
            return
        }
        loadingFiles = true
        try {
            if (files.size > 1) {
                loadBatch(files)
                return
            }
            val file = files[0]
            if (PersonalImportRules.fileKind(file.name) == PersonalImportRules.FileKind.Xlsx) {
                try {
                    loadText(ImportXlsx.csv(file.data), file.name)
                } catch (e: ImportXlsxException) {
                    fileError = e.text
                }
            } else {
                loadText(PersonalImportRules.decodeText(file.data), file.name)
            }
        } finally {
            loadingFiles = false
        }
    }

    private suspend fun loadBatch(files: List<PickedFile>) {
        val prepared = mutableListOf<PreparedStatementFile>()
        for (file in files) {
            val text = PersonalImportRules.decodeText(file.data)
            val detected = ImportProviders.detect(text)
            if (detected?.isServerStatement != true) {
                if (aiFallback && detected == null) {
                    if (enqueueFallback(text, file.name)) continue
                    return
                }
                fileError = translate("{0}: l'import multiplo supporta rendiconti IBKR, DEGIRO e Trade Republic. Importa gli altri CSV singolarmente.", mapOf("0" to file.name))
                return
            }
            try {
                prepared.add(PreparedStatementFile(file.name, text, env.brokerImports.parse(text)))
            } catch (e: Exception) {
                if (!aiFallback) {
                    fileError = "${file.name}: ${ImportApiFailure.of(e).message ?: "File non valido"}"
                    return
                }
                if (!enqueueFallback(text, file.name)) return
            }
        }
        try {
            val ordered = ImportBatch.order(prepared)
            batch = ordered
            batchIndex = 0
            ordered.firstOrNull()?.let { resetWizard(it) }
        } catch (e: ImportXlsxException) {
            fileError = e.text
        }
    }

    private suspend fun enqueueFallback(text: String, name: String): Boolean = try {
        val id = env.personalImports.enqueue(text, "CSV da riconoscere", brokerFallback = true)
        fallbackJobs = fallbackJobs.filter { it.second != id } + (name to id)
        true
    } catch (e: Exception) {
        fileError = ImportApiFailure.of(e).message ?: "Impossibile avviare l'analisi AI. Riprova il caricamento."
        false
    }

    suspend fun loadText(text: String, name: String?) {
        fallbackJobId = null
        val detected = ImportProviders.detect(text)
        val chosen = provider
        if (chosen != null) {
            ImportProviders.mismatchMessage(chosen, detected)?.let { mismatch ->
                if (detected == null) failed(mismatch, text) else error = mismatch
                return
            }
        }
        if (detected?.isServerStatement == true) {
            reading = true
            try {
                val parsed = env.brokerImports.parse(text)
                if (parsed.operations.isEmpty() && parsed.cashMovements.orEmpty().isEmpty() && parsed.issues.none { it.severity == "error" }) {
                    error = "Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare"
                    return
                }
                statement = parsed
                statementCsv = text
                table = null
                mapping = null
                presetLabel = null
                presetId = null
                provider = detected
                fileName = name
                error = null
                step = Step.Mapping
            } catch (e: Exception) {
                failed(ImportApiFailure.of(e).message ?: "Impossibile leggere il file", text)
            } finally {
                reading = false
            }
            return
        }
        if (detected == ImportProviderId.Fineco) {
            try {
                val fineco = FinecoImport.parseTable(text)
                val finecoMapping = FinecoImport.mapping(fineco)
                if (aiFallback && ImportNormalize.rows(fineco, finecoMapping, today).any { it is ImportRow.Error }) {
                    failed("Alcune righe Fineco non sono state riconosciute", text)
                    return
                }
                if (fineco.rows.isEmpty()) {
                    error = "Nel file Fineco non ci sono movimenti da importare"
                    return
                }
                setTable(fineco, finecoMapping, null, null, name)
                provider = ImportProviderId.Fineco
            } catch (e: ImportXlsxException) {
                failed(e.text, text)
            }
            return
        }
        val parsed = ImportCsv.parse(text)
        if (parsed.headers.size < 2 || parsed.rows.isEmpty()) {
            failed("Il file non sembra un CSV con intestazioni e almeno una riga", text)
            return
        }
        val (initial, preset) = ImportPresets.initialMapping(parsed)
        if (aiFallback && detected == null && ImportMappingRules.missingFields(initial).isNotEmpty()) {
            failed("Non è stato possibile riconoscere le colonne del CSV", text)
            return
        }
        setTable(parsed, savedMapping(parsed) ?: initial, preset?.id, preset?.label, name)
    }

    private fun setTable(t: ImportCsvTable, m: ImportMapping, id: String?, label: String?, name: String?) {
        statement = null
        statementCsv = null
        table = t
        mapping = m
        presetId = id
        presetLabel = label
        fileName = name
        error = null
        step = Step.Mapping
    }

    private suspend fun failed(message: String, text: String) {
        if (!aiFallback) {
            error = message
            return
        }
        reading = true
        try {
            val name = provider?.takeIf { it != ImportProviderId.Generic }?.let { ImportProviders.info(it).name } ?: "CSV da riconoscere"
            fallbackJobId = env.personalImports.enqueue(text, name, brokerFallback = true)
            error = null
        } catch (e: Exception) {
            error = "$message ${ImportApiFailure.of(e).message ?: "Impossibile avviare l'analisi AI"}"
        } finally {
            reading = false
        }
    }

    // ---------------------------------------------------------------- Mapping (INV-098)

    private fun savedMapping(t: ImportCsvTable): ImportMapping? {
        val raw = env.preferences.string(ImportMappingRules.storageKey(t.headers)) ?: return null
        val saved = runCatching { json.decodeFromString(StoredImportMapping.serializer(), raw).mapping() }.getOrNull() ?: return null
        return saved.takeIf { ImportMappingRules.savedMappingIsValid(it, t.headers) }
    }

    private fun saveMapping() {
        val t = table ?: return
        val m = mapping ?: return
        env.preferences.setString(ImportMappingRules.storageKey(t.headers), json.encodeToString(StoredImportMapping.serializer(), StoredImportMapping.of(m)))
    }

    fun setColumn(field: ImportField, column: Int?) {
        val t = table ?: return
        val m = mapping ?: return
        mapping = ImportMappingRules.settingColumn(m, field, column, t)
        result = null
    }

    fun updateMapping(change: (ImportMapping) -> ImportMapping) {
        val m = mapping ?: return
        mapping = change(m)
        result = null
    }

    // ---------------------------------------------------------------- Instruments (INV-099)

    fun goToInstrumentsAsync(tooMany: (Int) -> String, generic: String) {
        scope.launch { goToInstruments(tooMany, generic) }
    }

    suspend fun goToInstruments(tooMany: (Int) -> String = { "Il file ha $it strumenti: al massimo ${ImportBatch.MAX_IDENTITIES} per import" },
                                generic: String = "Impossibile riconoscere gli strumenti") {
        if (statement == null && (table == null || mapping == null)) return
        val ids = identities
        if (ids.size > ImportBatch.MAX_IDENTITIES) {
            error = tooMany(ids.size)
            return
        }
        if (table != null) saveMapping()
        error = null
        if (ids.isEmpty() && cashCount > 0) {
            order = emptyList()
            step = Step.Instruments
            return
        }
        resolving = true
        try {
            val matches = env.brokerImports.resolve(ids.map { it.identity })
            val next = matches.mapValues { InstrumentChoice.of(it.value) }
            choices = next
            excluded = emptySet()
            order = ids.withIndex().sortedWith(compareBy({ ImportChoices.attentionRank(next[it.value.identity.key]) }, { it.index })).map { it.value.identity.key }
            step = Step.Instruments
        } catch (e: Exception) {
            error = ImportApiFailure.of(e).message ?: generic
        } finally {
            resolving = false
        }
    }

    fun choose(key: String, instrument: Instrument) {
        choices = choices + (key to InstrumentChoice.Known(instrument))
        excluded = excluded - key
    }

    fun setExcluded(key: String, exclude: Boolean) {
        excluded = if (exclude) excluded + key else excluded - key
    }

    // ---------------------------------------------------------------- Summary (INV-100…102)

    fun previewAsync(noOperations: String, generic: String) {
        scope.launch { submit(true, noOperations, generic) }
    }

    fun confirmAsync(noOperations: String, generic: String) {
        scope.launch { submit(false, noOperations, generic) }
    }

    suspend fun submit(dryRun: Boolean, noOperations: String = "Nessuna operazione da importare: scegli almeno uno strumento",
                       generic: String = "Import non riuscito") {
        val preset = statement?.preset ?: if (table != null && provider == ImportProviderId.Fineco) "fineco" else presetId
        var request = RunImportRequest.build(rows, choices, excluded, dryRun, preset)
        val st = statement
        if (request == null && st != null && cashCount > 0) request = RunImportRequest(dryRun, st.preset, emptyList(), emptyList())
        if (request == null) {
            error = noOperations
            return
        }
        statementCsv?.let { request = request!!.copy(statementCsv = it) }
        val t = table
        val m = mapping
        if (t != null && m != null) request = request!!.copy(formatMetadata = ImportFormatMetadata.mapped(t, m, provider))
        if (st != null && portfolioId.isNotEmpty()) request = request!!.copy(portfolioId = portfolioId)
        error = null
        running = true
        try {
            val outcome = env.brokerImports.run(request!!)
            result = outcome
            outcome.error?.let { error = it }
            if (dryRun && outcome.error == null) step = Step.Summary
            if (!dryRun && outcome.error == null && outcome.counts.error == 0) {
                done = true
                onImported?.invoke()
            }
        } catch (e: Exception) {
            error = ImportApiFailure.of(e).message ?: generic
        } finally {
            running = false
        }
    }

    fun back() {
        error = null
        result = null
        step = when (step) {
            Step.Summary -> Step.Instruments
            Step.Instruments -> Step.Mapping
            else -> Step.File
        }
    }

    /** `--es bbBrokerStep instruments|summary|done` (debug only): walks the wizard without taps. */
    private suspend fun debugAdvance() {
        val target = DebugLaunch.value("bbBrokerStep") ?: return
        if (step != Step.Mapping) return
        goToInstruments()
        if (target == "instruments" || step != Step.Instruments) return
        submit(true)
        if (target != "done" || step != Step.Summary || result?.counts?.error != 0) return
        submit(false)
    }
}
