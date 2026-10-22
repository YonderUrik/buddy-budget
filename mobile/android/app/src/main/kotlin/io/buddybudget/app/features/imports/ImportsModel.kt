package io.buddybudget.app.features.imports

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.imports.ImportText
import io.buddybudget.core.domain.imports.ImportXlsxException
import io.buddybudget.core.domain.imports.PersonalImportCorrection
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportLoadedFile
import io.buddybudget.core.domain.imports.PersonalImportPreview
import io.buddybudget.core.domain.imports.PersonalImportReceiptFile
import io.buddybudget.core.domain.imports.IncomingFiles
import io.buddybudget.core.domain.imports.PersonalImportRules
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.ZoneId

/**
 * State of the personal imports (14-imports): the job list polled while something runs (IMP-002/003), the report
 * shown on `/importazioni` (IMP-004…006), the upload form (IMP-012…025), the island (IMP-058…060) and the actions on
 * a job. Rules live in `PersonalImportRules`; this model only sequences API calls. Owned by the shell.
 * Same fields as `ImportsModel` on iOS.
 */
class ImportsModel(val env: AppEnvironment) {
    data class UploadForm(
        val step: PersonalImportRules.UploadStep = PersonalImportRules.UploadStep.Source,
        val formatId: String? = null,
        val name: String = "",
        val regenerate: Boolean = false,
        val file: PersonalImportLoadedFile? = null,
        val fileError: ImportText? = null,
        val reading: Boolean = false,
        val consent: Boolean = false,
        val uploading: Boolean = false,
        val uploadError: String? = null,
        /** IMP-062: the error is the «already imported» notice (info, no report link). */
        val uploadNotice: Boolean = false,
    )

    enum class ScrollTarget { Form, List, Top }

    var listing by mutableStateOf<PersonalImportListing?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var loadFailed by mutableStateOf(false)
        private set
    var selected by mutableStateOf<String?>(null)
    var receipt by mutableStateOf<Pair<String, PersonalImportReceiptFile>?>(null)
        private set
    var correcting by mutableStateOf<String?>(null)
    var form by mutableStateOf(UploadForm())
    var scrollTarget by mutableStateOf<ScrollTarget?>(null)
    var dismissed by mutableStateOf<List<String>>(emptyList())
        private set
    var onFinished: (() -> Unit)? = null

    private val scope = MainScope()
    private var pollJob: Job? = null
    private var previousRunning: Set<String> = emptySet()
    private var foreground = true
    private val json = Json { ignoreUnknownKeys = true }

    init {
        env.preferences.string(DISMISSED_KEY)?.let { raw ->
            dismissed = runCatching { json.decodeFromString(ListSerializer(String.serializer()), raw) }.getOrDefault(emptyList())
        }
    }

    val jobs: List<PersonalImportListing.Job> get() = listing?.jobs.orEmpty()
    val formats: List<PersonalImportListing.Format> get() = listing?.formats.orEmpty()

    val reportJob: PersonalImportListing.Job?
        get() = PersonalImportRules.reportJob(listing?.jobs, selected, receipt?.first)

    /** The file row of the report (IMP-027). */
    fun reportFile(locale: BBLocale, translate: (String, Map<String, String>) -> String): PersonalImportReceiptFile {
        receipt?.let { return it.second }
        val job = reportJob
        val day = job?.let { PersonalImportRules.dayMonth(it.createdAt, ZoneId.systemDefault(), locale) } ?: ""
        return PersonalImportReceiptFile(JSNumber.trim(translate("Importazione del {0}", mapOf("0" to day))), source = job?.let { listing?.formatName(it.formatId) } ?: "File")
    }

    val showsForm: Boolean get() = PersonalImportRules.showsUploadForm(reportJob, receipt != null, correcting)

    val islandJobs: List<PersonalImportListing.Job> get() = PersonalImportRules.islandJobs(jobs, dismissed.toSet(), Instant.now())

    fun source(job: PersonalImportListing.Job): String = listing?.formatName(job.formatId) ?: "File"

    // ---------------------------------------------------------------- Loading and polling (IMP-002, IMP-003, IMP-060)

    fun start() {
        if (pollJob?.isActive == true) return
        pollJob = scope.launch { pollLoop() }
    }

    fun setForeground(active: Boolean) {
        foreground = active
        if (active) {
            scope.launch { load() }
            start()
        } else {
            pollJob?.cancel()
            pollJob = null
        }
    }

    private suspend fun pollLoop() {
        load()
        while (scope.isActive) {
            delay(PersonalImportRules.POLL_INTERVAL_MS)
            if (!PersonalImportRules.shouldPoll(listing)) {
                pollJob = null
                return
            }
            if (foreground) load()
        }
    }

    suspend fun load() {
        if (listing == null) loading = true
        try {
            val next = env.personalImports.list()
            val finished = PersonalImportRules.finishedSince(previousRunning, next.jobs)
            previousRunning = PersonalImportRules.runningIds(next.jobs)
            listing = next
            loadFailed = false
            if (finished) onFinished?.invoke()
            if (PersonalImportRules.shouldPoll(next) && pollJob?.isActive != true && foreground) start()
        } catch (e: Exception) {
            if (listing == null) loadFailed = true
        }
        loading = false
    }

    fun retry() {
        loadFailed = false
        scope.launch { load() }
    }

    // ---------------------------------------------------------------- Navigation on the page

    fun open(jobId: String?) {
        receipt = null
        correcting = null
        selected = jobId
        scrollTarget = ScrollTarget.Top
    }

    fun tap(job: PersonalImportListing.Job) {
        if (PersonalImportRules.tapRetries(job)) anotherFile() else open(job.id)
    }

    fun anotherFile() {
        fromShare = false
        receipt = null
        selected = null
        correcting = null
        scrollTarget = ScrollTarget.Form
    }

    fun dismissIsland(id: String) {
        dismissed = PersonalImportRules.addDismissed(id, dismissed)
        env.preferences.setString(DISMISSED_KEY, json.encodeToString(ListSerializer(String.serializer()), dismissed))
    }

    // ---------------------------------------------------------------- Upload form (IMP-012…025)

    val isNewFormat: Boolean get() = form.formatId == null

    val stepMissing: List<String>
        get() = PersonalImportRules.missing(form.step, isNewFormat, form.name, form.file != null, form.consent)

    fun selectFormat(id: String?) {
        form = form.copy(formatId = id, regenerate = false)
    }

    fun pick(picked: PickedFile, locale: BBLocale) {
        val error = PersonalImportRules.fileError(picked.name, picked.checkedSize, locale)
        if (error != null) {
            form = form.copy(file = null, fileError = error)
            return
        }
        form = try {
            form.copy(file = PersonalImportRules.read(picked.name, picked.data), fileError = null)
        } catch (e: ImportXlsxException) {
            form.copy(file = null, fileError = ImportText(e.text))
        } catch (e: Exception) {
            form.copy(file = null, fileError = ImportText("Non riesco a leggere questo file."))
        }
    }

    /** The file in the form arrived from another app (IMP-068/069): the form skips what is done and sends on consent. */
    var fromShare = false
        private set

    /**
     * A file shared to the app (IMP-068): chosen and read at once (size/type errors show immediately), the form opens
     * on the first step still missing something — the source if it needs a name, else the consent.
     */
    fun receiveShared(picked: PickedFile, locale: BBLocale) {
        anotherFile()
        pick(picked, locale)
        fromShare = form.file != null
        form = form.copy(consent = false, step = IncomingFiles.personalStartStep(isNewFormat, form.name, form.file != null))
        // `--es bbImportAuto <name>` / `--es bbImportStep consent` (debug only): see iOS `-BBImportAuto`.
        val auto = DebugLaunch.value("bbImportAuto")
        if (auto != null && form.file != null) {
            form = form.copy(name = auto, step = PersonalImportRules.UploadStep.Consent)
            setConsent(true)
        } else if (DebugLaunch.value("bbImportStep") == "consent" && form.file != null) {
            form = form.copy(name = "Banca Prova", step = PersonalImportRules.UploadStep.Consent)
        }
    }

    /** Consent checkbox; for a shared file, ticking it (with the source given) uploads straight away (IMP-069). */
    fun setConsent(on: Boolean, genericError: String = "Operazione non riuscita. Riprova.") {
        form = form.copy(consent = on)
        if (IncomingFiles.submitsOnConsent(fromShare, form.step, isNewFormat, form.name, form.file != null, form.consent) && !form.uploading) {
            fromShare = false
            submitAsync(genericError)
        }
    }

    fun removeFile() {
        fromShare = false
        form = form.copy(file = null, fileError = null)
    }

    fun next() {
        if (stepMissing.isNotEmpty()) return
        var next = PersonalImportRules.UploadStep.entries.getOrNull(form.step.ordinal + 1) ?: return
        // IMP-068: a shared file is already chosen — from the source go straight to the consent.
        if (fromShare && next == PersonalImportRules.UploadStep.File && form.file != null) next = PersonalImportRules.UploadStep.Consent
        form = form.copy(step = next)
    }

    fun back() {
        PersonalImportRules.UploadStep.entries.getOrNull(form.step.ordinal - 1)?.let { form = form.copy(step = it) }
    }

    suspend fun submit(genericError: String = "Operazione non riuscita. Riprova.") {
        val file = form.file ?: return
        if (stepMissing.isNotEmpty()) return
        val source = form.formatId?.let { listing?.formatName(it) } ?: JSNumber.trim(form.name)
        form = form.copy(uploading = true, uploadError = null)
        try {
            val id = env.personalImports.enqueue(file.csv, source, form.formatId, form.regenerate)
            val sent = PersonalImportReceiptFile(file.name, file.size, PersonalImportRules.countCsvRows(file.csv), source)
            form = UploadForm(formatId = form.formatId, name = form.name)
            selected = id
            receipt = id to sent
            load()
            start()
        } catch (e: Exception) {
            val failure = ImportApiFailure.of(e)
            form = form.copy(uploading = false, uploadError = failure.message ?: genericError, uploadNotice = failure.alreadyImported)
        }
    }

    fun submitAsync(genericError: String) {
        scope.launch { submit(genericError) }
    }

    // ---------------------------------------------------------------- Review and correction actions (IMP-037…054)

    suspend fun preview(id: String): PersonalImportPreview = env.personalImports.preview(id)

    suspend fun comparison(id: String): PersonalImportCorrection = env.personalImports.correction(id)

    suspend fun importSkipping(id: String, genericError: String): String? = try {
        env.personalImports.act(id, "import_skipping_errors")
        load()
        null
    } catch (e: Exception) {
        ImportApiFailure.of(e).message ?: genericError
    }

    suspend fun reanalyze(id: String, file: PersonalImportReceiptFile, genericError: String): String? = try {
        val next = env.personalImports.reanalyze(id)
        selected = next
        receipt = next to file
        load()
        start()
        null
    } catch (e: Exception) {
        ImportApiFailure.of(e).message ?: genericError
    }

    suspend fun startCorrection(id: String, feedback: String, file: PickedFile, genericError: String): String? = try {
        val loaded = PersonalImportRules.read(file.name, file.data)
        val next = env.personalImports.enqueue(loaded.csv, "Correzione", correctionOf = id, feedback = feedback)
        correcting = null
        receipt = null
        selected = next
        load()
        start()
        null
    } catch (e: ImportXlsxException) {
        e.text
    } catch (e: Exception) {
        ImportApiFailure.of(e).message ?: genericError
    }

    suspend fun finishCorrection(job: PersonalImportListing.Job, replace: Boolean, genericError: String): String? = try {
        env.personalImports.act(job.id, if (replace) "replace_import" else "discard_correction")
        correcting = null
        receipt = null
        selected = if (replace) job.id else job.correctionOf
        load()
        if (replace) onFinished?.invoke()
        null
    } catch (e: Exception) {
        ImportApiFailure.of(e).message ?: genericError
    }

    companion object {
        const val DISMISSED_KEY = "bb-personal-import-dismissed"
    }
}
