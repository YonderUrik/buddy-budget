import BuddyBudgetKit
import Foundation
import Observation

/// State of the personal imports (14-imports): the job list polled while something runs (IMP-002/003), the report
/// shown on `/importazioni` (IMP-004…006), the upload form (IMP-012…025), the island (IMP-058…060) and the actions on
/// a job (review, correction). Rules live in `PersonalImportRules`; this model only sequences API calls.
/// Owned by the shell (the island is on every screen). Same fields as `ImportsModel` on Android.
@MainActor @Observable
final class ImportsModel {
    struct UploadForm: Equatable {
        var step: PersonalImportRules.UploadStep = .source
        /// nil = «Nuova banca o broker».
        var formatId: String?
        var name = ""
        var regenerate = false
        var file: PersonalImportLoadedFile?
        var fileError: ImportText?
        var reading = false
        var consent = false
        var uploading = false
        var uploadError: String?
        /// IMP-062: the error is the «already imported» notice (info, no report link).
        var uploadNotice = false
    }

    enum ScrollTarget: Equatable { case form, list, top }

    private(set) var listing: PersonalImportListing?
    private(set) var loading = false
    private(set) var loadFailed = false
    /// Job opened from the list, the island or `?job=` (IMP-004).
    var selected: String?
    /// File just uploaded: its receipt replaces the form (IMP-024).
    private(set) var receipt: (jobId: String, file: PersonalImportReceiptFile)?
    /// «Il risultato è sbagliato» started on this job (IMP-049).
    var correcting: String?
    var form = UploadForm()
    /// One-shot scroll request for the page (form, list).
    var scrollTarget: ScrollTarget?
    /// Island dismissals kept on the device (IMP-059).
    private(set) var dismissed: [String] = []
    /// Bumped when a running job finishes (IMP-060): screens showing data reload.
    var onFinished: (() -> Void)?

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var pollTask: Task<Void, Never>?
    @ObservationIgnored private var previousRunning: Set<String> = []
    @ObservationIgnored private var foreground = true
    static let dismissedKey = "bb-personal-import-dismissed"

    init(env: AppEnvironment) {
        self.env = env
        if let raw = env.preferences.string(Self.dismissedKey), let data = raw.data(using: .utf8),
           let ids = try? JSONDecoder().decode([String].self, from: data) {
            dismissed = ids
        }
    }

    var jobs: [PersonalImportListing.Job] { listing?.jobs ?? [] }
    var formats: [PersonalImportListing.Format] { listing?.formats ?? [] }

    var reportJob: PersonalImportListing.Job? {
        PersonalImportRules.reportJob(jobs: listing?.jobs, selected: selected, receiptJobId: receipt?.jobId)
    }

    /// The file row of the report: the uploaded file, else `Importazione del {d MMMM}` and the format name (IMP-027).
    func reportFile(locale: BBLocale) -> PersonalImportReceiptFile {
        if let receipt { return receipt.file }
        let job = reportJob
        let day = job.map { PersonalImportRules.dayMonth($0.createdAt, timeZone: .current, locale: locale) } ?? ""
        let name = JSNumber.trim(L10n.lookup(italian: "Importazione del {0}", ["0": day]))
        return PersonalImportReceiptFile(name: name, source: job.flatMap { listing?.formatName($0.formatId) } ?? "File")
    }

    var showsForm: Bool {
        PersonalImportRules.showsUploadForm(report: reportJob, hasReceipt: receipt != nil, correcting: correcting)
    }

    var islandJobs: [PersonalImportListing.Job] {
        PersonalImportRules.islandJobs(jobs, dismissed: Set(dismissed), now: Date())
    }

    func source(of job: PersonalImportListing.Job) -> String { listing?.formatName(job.formatId) ?? "File" }

    // MARK: Loading and polling (IMP-002, IMP-003, IMP-060)

    func start() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in await self?.pollLoop() }
    }

    /// Foreground only (mobile note): stop polling in background, refresh once on return.
    func setForeground(_ active: Bool) {
        foreground = active
        if active {
            Task { await load() }
            start()
        } else {
            pollTask?.cancel()
            pollTask = nil
        }
    }

    private func pollLoop() async {
        await load()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(PersonalImportRules.pollInterval))
            guard foreground, PersonalImportRules.shouldPoll(listing) else {
                if !PersonalImportRules.shouldPoll(listing) { pollTask = nil; return }
                continue
            }
            await load()
        }
    }

    func load() async {
        if listing == nil { loading = true }
        do {
            let next = try await env.personalImports.list()
            let finished = PersonalImportRules.finishedSince(previous: previousRunning, now: next.jobs)
            previousRunning = PersonalImportRules.runningIds(next.jobs)
            listing = next
            loadFailed = false
            if finished { onFinished?() }
            if PersonalImportRules.shouldPoll(next), pollTask == nil, foreground { start() }
        } catch {
            if listing == nil { loadFailed = true }
        }
        loading = false
    }

    func retry() async {
        loadFailed = false
        await load()
    }

    // MARK: Navigation on the page

    /// `/importazioni?job={id}` (IMP-004) or the island's «Dettaglio».
    func open(jobId: String?) {
        receipt = nil
        correcting = nil
        selected = jobId
        scrollTarget = .top
    }

    /// List row tap (IMP-009).
    func tap(_ job: PersonalImportListing.Job) {
        if PersonalImportRules.tapRetries(job) {
            anotherFile()
        } else {
            open(jobId: job.id)
        }
    }

    /// «Carica un altro file» / «Carica un file corretto»: clear the selection and go to the form.
    func anotherFile() {
        fromShare = false
        receipt = nil
        selected = nil
        correcting = nil
        scrollTarget = .form
    }

    func dismissIsland(_ id: String) {
        dismissed = PersonalImportRules.addDismissed(id, to: dismissed)
        if let data = try? JSONEncoder().encode(dismissed), let raw = String(data: data, encoding: .utf8) {
            env.preferences.setString(Self.dismissedKey, raw)
        }
    }

    // MARK: Upload form (IMP-012…025)

    var isNewFormat: Bool { form.formatId == nil }

    var stepMissing: [String] {
        PersonalImportRules.missing(step: form.step, isNew: isNewFormat, name: form.name, hasFile: form.file != nil, consent: form.consent)
    }

    func selectFormat(_ id: String?) {
        form.formatId = id
        form.regenerate = false
    }

    /// A picked or shared file (IMP-017…019); `.xlsx` becomes CSV text on the device (IMP-018).
    func pick(_ picked: PickedFile, locale: BBLocale) {
        form.fileError = nil
        if let error = PersonalImportRules.fileError(name: picked.name, size: picked.size, locale: locale) {
            form.file = nil
            form.fileError = error
            return
        }
        form.reading = true
        defer { form.reading = false }
        do {
            form.file = try PersonalImportRules.read(name: picked.name, data: picked.data)
        } catch let failure as ImportXlsxError {
            form.file = nil
            form.fileError = ImportText(failure.text)
        } catch {
            form.file = nil
            form.fileError = ImportText("Non riesco a leggere questo file.")
        }
    }

    /// A file shared to the app: open the form on the file step with it (mobile note).
    /// A file shared to the app (IMP-068): chosen and read at once (size/type errors show immediately), the form opens
    /// on the first step still missing something — the source if it needs a name, else the consent.
    func receiveShared(_ picked: PickedFile, locale: BBLocale) {
        anotherFile()
        pick(picked, locale: locale)
        fromShare = form.file != nil
        form.consent = false
        form.step = IncomingFiles.personalStartStep(isNewFormat: isNewFormat, name: form.name, fileOk: form.file != nil)
        #if DEBUG
        // `-BBImportAuto <name>`: fills the source and ticks the consent, which uploads (E2E on the simulator, no taps).
        // `-BBImportStep consent`: stops on the consent step (screenshots).
        if let name = DebugLaunch.value("-BBImportAuto"), form.file != nil {
            form.name = name
            form.step = .consent
            setConsent(true)
        } else if DebugLaunch.value("-BBImportStep") == "consent", form.file != nil {
            form.name = "Banca Prova"
            form.step = .consent
        }
        #endif
    }

    /// The file in the form arrived from another app (IMP-068/069): the form skips what is done and sends on consent.
    private(set) var fromShare = false

    /// Consent checkbox; for a shared file, ticking it (with the source given) uploads straight away (IMP-069).
    func setConsent(_ on: Bool) {
        form.consent = on
        if IncomingFiles.submitsOnConsent(fromShare: fromShare, step: form.step, isNewFormat: isNewFormat, name: form.name,
                                          fileOk: form.file != nil, consent: form.consent), !form.uploading {
            fromShare = false
            Task { await submit() }
        }
    }

    func removeFile() {
        fromShare = false
        form.file = nil
        form.fileError = nil
    }

    func next() {
        guard stepMissing.isEmpty, var next = PersonalImportRules.UploadStep(rawValue: form.step.rawValue + 1) else { return }
        // IMP-068: a shared file is already chosen — from the source go straight to the consent.
        if fromShare, next == .file, form.file != nil { next = .consent }
        form.step = next
    }

    func back() {
        if let previous = PersonalImportRules.UploadStep(rawValue: form.step.rawValue - 1) { form.step = previous }
    }

    /// IMP-023/024: upload, reset the form, show the receipt for the new job, refresh the list.
    func submit() async {
        guard stepMissing.isEmpty, let file = form.file else { return }
        let source = form.formatId.flatMap { listing?.formatName($0) } ?? JSNumber.trim(form.name)
        form.uploading = true
        form.uploadError = nil
        form.uploadNotice = false
        do {
            let id = try await env.personalImports.enqueue(csv: file.csv, name: source, formatId: form.formatId, regenerate: form.regenerate)
            let sent = PersonalImportReceiptFile(name: file.name, size: file.size, rows: PersonalImportRules.countCsvRows(file.csv), source: source)
            form = UploadForm(formatId: form.formatId, name: form.name)
            selected = id
            receipt = (id, sent)
            await load()
            start()
        } catch {
            let failure = ImportAPIFailure(error)
            form.uploadError = failure.message ?? L10n.lookup(italian: "Operazione non riuscita. Riprova.")
            form.uploadNotice = failure.alreadyImported
        }
        form.uploading = false
    }

    // MARK: Review and correction actions (IMP-037…054)

    func preview(_ id: String) async throws -> PersonalImportPreview { try await env.personalImports.preview(id) }

    func comparison(_ id: String) async throws -> PersonalImportCorrection { try await env.personalImports.correction(id) }

    /// `import_skipping_errors` (IMP-037/038).
    func importSkipping(_ id: String) async -> String? {
        do {
            try await env.personalImports.act(id, action: "import_skipping_errors")
            await load()
            return nil
        } catch {
            return ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita. Riprova.")
        }
    }

    /// IMP-039: the new job replaces the old one and its receipt is shown.
    func reanalyze(_ id: String, file: PersonalImportReceiptFile) async -> String? {
        do {
            let next = try await env.personalImports.reanalyze(id)
            selected = next
            receipt = (next, file)
            await load()
            start()
            return nil
        } catch {
            return ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita. Riprova.")
        }
    }

    /// IMP-049: a correction of an imported job; selects the new correction job.
    func startCorrection(of id: String, feedback: String, file: PickedFile) async -> String? {
        do {
            let loaded = try PersonalImportRules.read(name: file.name, data: file.data)
            let next = try await env.personalImports.enqueue(csv: loaded.csv, name: "Correzione", correctionOf: id, feedback: feedback)
            correcting = nil
            receipt = nil
            selected = next
            await load()
            start()
            return nil
        } catch let failure as ImportXlsxError {
            return L10n.lookup(italian: failure.text)
        } catch {
            return ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
        }
    }

    /// IMP-051 / IMP-052.
    func finishCorrection(_ job: PersonalImportListing.Job, replace: Bool) async -> String? {
        do {
            try await env.personalImports.act(job.id, action: replace ? "replace_import" : "discard_correction")
            correcting = nil
            receipt = nil
            selected = replace ? job.id : job.correctionOf
            await load()
            if replace { onFinished?() }
            return nil
        } catch {
            return ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
        }
    }
}
