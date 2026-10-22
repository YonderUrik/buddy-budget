import Foundation

/// Files handed to BuddyBudget from another app («Apri in…» / share from Files, Mail…): which ones the app takes, how
/// much it reads, where each goes and when (IMP-064…069). Pure logic, twin of `IncomingFiles` on Android.
public enum IncomingFiles {
    /// IMP-064: MIME types the app takes. A generic type (`application/octet-stream`) only with a known name.
    public static let mimeTypes = [
        "text/csv", "text/comma-separated-values", "text/tab-separated-values", "application/csv",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    /// File extensions the imports read or explain (`.xls` gets the web's «Salva con nome» message, IMP-019).
    public static let extensions = ["csv", "txt", "tsv", "xlsx", "xls"]

    /// IMP-064: whether an incoming item is an import file. A spreadsheet/CSV MIME type is enough; a generic one
    /// (`application/octet-stream`, missing, `text/plain`) needs a `.csv`, `.txt`, `.tsv`, `.xlsx` or `.xls` name.
    public static func accepts(name: String?, mime: String?) -> Bool {
        if let mime {
            let type = mime.lowercased().split(separator: ";").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
            if mimeTypes.contains(type) { return true }
        }
        guard let name, let dot = name.lastIndex(of: ".") else { return false }
        return extensions.contains(String(name[name.index(after: dot)...]).lowercased())
    }

    /// IMP-065: bytes read from an incoming file. One byte over the largest import limit (25 MB) is enough to give the
    /// web's size message without loading a huge file in memory; the real size comes from the file system.
    public static let readLimit = PersonalImportRules.maxBytes + 1

    /// Where the files go (IMP-066).
    public enum Route: Equatable, Sendable {
        /// A supported broker export (or several files: only the broker wizard takes a batch) → Investimenti wizard.
        case broker
        /// Anything else → the personal CSV / Excel import (Liquidità › Importa).
        case personal
    }

    /// IMP-066 (Phase 4c rule, web: the broker wizard and the personal import are two separate entries): several files
    /// or a first file whose text a broker parser recognises go to the broker wizard, everything else to the personal
    /// import. `firstText` is the first file decoded (an `.xlsx` already converted to CSV).
    public static func route(fileCount: Int, firstText: String) -> Route {
        fileCount > 1 || ImportProviders.detect(firstText) != nil ? .broker : .personal
    }

    /// IMP-067: files wait until the app is usable — signed in, past onboarding, legal acceptance and reactivation —
    /// and are then routed once; before that they are kept (also across sign-in).
    public static func canDeliver(_ route: AppRoute) -> Bool { route == .main }

    /// IMP-068: the step a personal import opens on with a shared file. The file is already chosen, so the form goes to
    /// the first step still missing something: the source when it needs a name, the file step when the file was refused
    /// (its error is shown there), otherwise the consent — never skipped (web: consent on every upload, IMP-022).
    public static func personalStartStep(isNewFormat: Bool, name: String, fileOk: Bool) -> PersonalImportRules.UploadStep {
        if !PersonalImportRules.missing(step: .source, isNew: isNewFormat, name: name, hasFile: fileOk, consent: false).isEmpty { return .source }
        return fileOk ? .consent : .file
    }

    /// IMP-069: a shared personal file is sent as soon as the user has given what the web asks for (source and consent):
    /// ticking the consent on the consent step uploads it straight away, then the receipt shows (IMP-024).
    public static func submitsOnConsent(fromShare: Bool, step: PersonalImportRules.UploadStep, isNewFormat: Bool, name: String,
                                        fileOk: Bool, consent: Bool) -> Bool {
        fromShare && consent && fileOk && step == .consent
            && PersonalImportRules.missing(step: .source, isNew: isNewFormat, name: name, hasFile: fileOk, consent: consent).isEmpty
    }
}
