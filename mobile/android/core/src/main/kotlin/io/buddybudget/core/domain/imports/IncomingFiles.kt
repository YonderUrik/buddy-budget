package io.buddybudget.core.domain.imports

import io.buddybudget.core.domain.shell.AppRoute

/**
 * Files handed to BuddyBudget from another app (share sheet, «Apri con» / «Apri in…»): which ones the app takes, how
 * much it reads, where each goes and when (IMP-064…069). Pure logic, twin of `IncomingFiles` on iOS.
 */
object IncomingFiles {
    /** IMP-064: MIME types the app registers for (share and open-with). `application/octet-stream` only with a known name. */
    val mimeTypes = listOf(
        "text/csv", "text/comma-separated-values", "text/tab-separated-values", "application/csv",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    /** File extensions the imports read or explain (`.xls` gets the web's «Salva con nome» message, IMP-019). */
    val extensions = listOf("csv", "txt", "tsv", "xlsx", "xls")

    /**
     * IMP-064: whether an incoming item is an import file. A spreadsheet/CSV MIME type is enough; a generic one
     * (`application/octet-stream`, missing, `text/plain`) needs a `.csv`, `.txt`, `.tsv`, `.xlsx` or `.xls` name.
     */
    fun accepts(name: String?, mime: String?): Boolean {
        val type = mime?.lowercase()?.substringBefore(';')?.trim()
        if (type != null && type in mimeTypes) return true
        val ext = name?.substringAfterLast('.', "")?.lowercase().orEmpty()
        return ext in extensions
    }

    /**
     * IMP-065: bytes read from an incoming file. One byte over the largest import limit (25 MB) is enough to give the
     * web's size message without loading a huge file in memory; the real size comes from the provider when known.
     */
    const val READ_LIMIT: Int = PersonalImportRules.MAX_BYTES + 1

    /** Where the files go (IMP-066). */
    sealed interface Route {
        /** A supported broker export (or several files: only the broker wizard takes a batch) → Investimenti wizard. */
        data object Broker : Route
        /** Anything else → the personal CSV / Excel import (Liquidità › Importa). */
        data object Personal : Route
    }

    /**
     * IMP-066 (Phase 4c rule, web: the broker wizard and the personal import are two separate entries): several files
     * or a first file whose text a broker parser recognises go to the broker wizard, everything else to the personal
     * import. [firstText] is the first file decoded (an `.xlsx` already converted to CSV).
     */
    fun route(fileCount: Int, firstText: String): Route =
        if (fileCount > 1 || ImportProviders.detect(firstText) != null) Route.Broker else Route.Personal

    /**
     * IMP-067: files wait until the app is usable — signed in, past onboarding, legal acceptance and reactivation —
     * and are then routed once; before that they are kept (also across sign-in).
     */
    fun canDeliver(route: AppRoute): Boolean = route == AppRoute.Main

    /**
     * IMP-068: the step a personal import opens on with a shared file. The file is already chosen, so the form goes to
     * the first step still missing something: the source when it needs a name, the file step when the file was refused
     * (its error is shown there), otherwise the consent — never skipped (web: consent on every upload, IMP-022).
     */
    fun personalStartStep(isNewFormat: Boolean, name: String, fileOk: Boolean): PersonalImportRules.UploadStep = when {
        PersonalImportRules.missing(PersonalImportRules.UploadStep.Source, isNewFormat, name, fileOk, false).isNotEmpty() ->
            PersonalImportRules.UploadStep.Source
        !fileOk -> PersonalImportRules.UploadStep.File
        else -> PersonalImportRules.UploadStep.Consent
    }

    /**
     * IMP-069: a shared personal file is sent as soon as the user has given what the web asks for (source and consent):
     * ticking the consent on the consent step uploads it straight away, then the receipt shows (IMP-024).
     */
    fun submitsOnConsent(fromShare: Boolean, step: PersonalImportRules.UploadStep, isNewFormat: Boolean, name: String, fileOk: Boolean, consent: Boolean): Boolean =
        fromShare && consent && fileOk && step == PersonalImportRules.UploadStep.Consent &&
            PersonalImportRules.missing(PersonalImportRules.UploadStep.Source, isNewFormat, name, fileOk, consent).isEmpty()
}
