import Foundation

// Help & support (16-help-support, SUP-*): report kinds, the technical context, the attached error, the help screen's
// static content and deep-link parameters. Port of the web's `lib/support/{constants,report}.ts`,
// `components/domain/support/{faq.data,github-links,report-form}.tsx` and `lib/client-errors`. Same names on Android
// (`io.buddybudget.core.domain.support`).

/// What the report is about (`REPORT_KINDS`). Raw values are the API values.
public enum ReportKind: String, CaseIterable, Codable, Sendable {
    case problema, domanda, idea

    /// Segmented-control label (Italian source, `REPORT_KIND_LABELS`).
    public var label: String {
        switch self {
        case .problema: "Un problema"
        case .domanda: "Una domanda"
        case .idea: "Un'idea"
        }
    }

    /// SUP-008: message placeholder for the kind.
    public var placeholder: String {
        switch self {
        case .problema: "Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo."
        case .domanda: "Cosa vuoi sapere?"
        case .idea: "Cosa ti piacerebbe poter fare?"
        }
    }

    /// SUP-003: `?tipo=` value; anything else is ignored (nil).
    public static func parse(_ raw: String?) -> ReportKind? {
        raw.flatMap(ReportKind.init(rawValue:))
    }
}

/// SUP-018: where the report started (`REPORT_SOURCES`).
public enum ReportSource: String, Codable, Sendable {
    /// The «Aiuto e segnalazioni» screen.
    case pagina
    /// The «Scrivici» button.
    case pulsante
    /// A «Segnala questo problema» link or a «Segnala» toast action.
    case errore
}

/// The failed operation attached to a report (`REPORT_ERROR_AREAS`, closed list).
public enum ReportErrorArea: String, CaseIterable, Codable, Sendable {
    case importMovimenti = "import_movimenti"
    case importInvestimenti = "import_investimenti"
    case syncBanca = "sync_banca"
    case collegaBanca = "collega_banca"
    case movimento, operazione, conto, debito, abbonamento, pensione, obiettivo, caricamento, salvataggio

    /// Label shown in the sheet's error box and in the support email (Italian source, `REPORT_ERROR_AREA_LABELS`).
    public var label: String {
        switch self {
        case .importMovimenti: "Importazione dei movimenti"
        case .importInvestimenti: "Importazione degli investimenti"
        case .syncBanca: "Aggiornamento dalla banca"
        case .collegaBanca: "Collegamento della banca"
        case .movimento: "Salvataggio di un movimento"
        case .operazione: "Salvataggio di un'operazione"
        case .conto: "Salvataggio di un conto"
        case .debito: "Salvataggio di un debito"
        case .abbonamento: "Salvataggio di un abbonamento"
        case .pensione: "Salvataggio della pensione"
        case .obiettivo: "Salvataggio di un obiettivo"
        case .caricamento: "Caricamento della pagina"
        case .salvataggio: "Salvataggio"
        }
    }
}

/// SUP-020 / SUP-021: the error a report starts from. The message (as shown to the user) is cut to 300 characters.
public struct ReportError: Codable, Equatable, Hashable, Sendable {
    public let area: ReportErrorArea
    public let message: String

    public init(area: ReportErrorArea, message: String) {
        self.area = area
        self.message = String(message.prefix(Support.errorMaxLength))
    }
}

/// Resolved theme as the server expects it (Italian enum, sent literally in every language — open question 2).
public enum ReportTheme: String, Codable, Sendable {
    case chiaro, scuro

    /// Label in the checkbox sentence (Italian source).
    public var label: String { self == .scuro ? "Scuro" : "Chiaro" }
}

/// SUP-011 / SUP-012: technical context attached to a report — never financial data, never a query string.
public struct ReportContext: Codable, Equatable, Hashable, Sendable {
    public let path: String
    public let version: String
    public let viewport: String
    public let theme: ReportTheme

    public init(path: String, version: String, viewport: String, theme: ReportTheme) {
        self.path = Support.sanitizePath(path)
        self.version = String(version.prefix(40))
        self.viewport = Support.isValidViewport(viewport) ? viewport : "100x100"
        self.theme = theme
    }

    /// `path` = logical route of the screen (web path), `width`/`height` = screen points (mobile note).
    public init(path: String, version: String, width: Double, height: Double, dark: Bool) {
        self.init(path: path, version: version, viewport: "\(Int(width.rounded()))x\(Int(height.rounded()))",
                  theme: dark ? .scuro : .chiaro)
    }
}

/// Body of `POST /api/support` (`reportInputSchema`).
public struct ReportInput: Encodable, Equatable, Sendable {
    public let kind: ReportKind
    public let message: String
    public let context: ReportContext?
    public let source: ReportSource?
    public let error: ReportError?
}

/// A quick answer of «Risposte rapide» (`FAQ_ITEMS`, Italian source).
public struct FaqItem: Equatable, Sendable, Identifiable {
    public let id: String
    public let question: String
    public let answer: String
}

/// A link of «Su GitHub» (`github-links.tsx`).
public struct GithubLink: Equatable, Sendable, Identifiable {
    public enum Id: String, Sendable { case issue, issueAperte = "issue_aperte", novita, sicurezza }
    public let id: Id
    public let label: String
    public let hint: String
    public let href: String
}

public enum Support {
    public static let messageMinLength = 10
    public static let messageMaxLength = 4000
    public static let errorMaxLength = 300
    public static let email = "support@buddybudget.io"
    public static let repoURL = "https://github.com/YonderUrik/buddy-budget"
    /// SUP-004.
    public static let statusURL = "https://stats.uptimerobot.com/BCuTWm0Ukg"
    /// Network / unknown failure and a 2xx without `reference` (open question 8).
    public static let sendFailed = "Non siamo riusciti a inviare la segnalazione."

    /// Only the path, without query or fragment, at most 120 characters; anything not starting with `/` → `/`.
    public static func sanitizePath(_ path: String) -> String {
        let clean = String(path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first ?? "")
        let noHash = String(clean.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false).first ?? "")
        return noHash.hasPrefix("/") ? String(noHash.prefix(120)) : "/"
    }

    /// `^\d{2,5}x\d{2,5}$`.
    public static func isValidViewport(_ value: String) -> Bool {
        let parts = value.split(separator: "x", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return false }
        return parts.allSatisfy { part in (2...5).contains(part.count) && part.allSatisfy { $0.isASCII && $0.isNumber } }
    }

    /// SUP-009: the submit button is enabled with at least 10 characters after trimming, while not sending.
    public static func canSubmit(message: String, pending: Bool = false) -> Bool {
        !pending && message.trimmingCharacters(in: .whitespacesAndNewlines).count >= messageMinLength
    }

    /// The request body: trimmed message, context only when the box is checked (SUP-011), kind forced to `problema`
    /// when an error is attached (SUP-020).
    public static func input(kind: ReportKind, message: String, withContext: Bool, context: ReportContext,
                             source: ReportSource, error: ReportError?) -> ReportInput {
        ReportInput(kind: error == nil ? kind : .problema,
                    message: String(message.trimmingCharacters(in: .whitespacesAndNewlines).prefix(messageMaxLength)),
                    context: withContext ? context : nil, source: source, error: error)
    }

    /// SUP-007: new-issue link; problems carry the context in «ambiente» (`githubIssueUrl`).
    public static func githubIssueURL(kind: ReportKind, context: ReportContext?) -> String {
        if kind == .idea { return "\(repoURL)/issues/new?template=funzionalita.yml" }
        var query = "template=bug.yml"
        if let context {
            let ambiente = "BuddyBudget \(context.version), pagina \(sanitizePath(context.path)), schermo \(context.viewport), tema \(context.theme.rawValue)"
            query += "&ambiente=" + formEncode(ambiente)
        }
        return "\(repoURL)/issues/new?\(query)"
    }

    /// SUP-007: the four links in order.
    public static func githubLinks(context: ReportContext) -> [GithubLink] {
        [
            GithubLink(id: .issue, label: "Apri una issue su GitHub", hint: "Pubblica: per problemi e idee senza dati personali.",
                       href: githubIssueURL(kind: .problema, context: context)),
            GithubLink(id: .issueAperte, label: "Vedi le segnalazioni aperte", hint: "Controlla se qualcuno ha già scritto la stessa cosa.",
                       href: "\(repoURL)/issues"),
            GithubLink(id: .novita, label: "Novità e correzioni", hint: "Cosa è cambiato in ogni versione.", href: "\(repoURL)/releases"),
            GithubLink(id: .sicurezza, label: "Segnala una vulnerabilità", hint: "In privato, mai in una issue pubblica.",
                       href: "\(repoURL)/security/policy"),
        ]
    }

    /// SUP-006: «Risposte rapide», verbatim.
    public static let faq: [FaqItem] = [
        FaqItem(id: "banca-scaduta", question: "Il collegamento con la banca non si aggiorna più",
                answer: "Il consenso Open Banking dura al massimo 90 giorni e poi va rinnovato. Vai in Liquidità → Conti e scegli «Rinnova» sul conto: ti avvisiamo anche per email prima della scadenza."),
        FaqItem(id: "import-csv", question: "Come importo i movimenti o le operazioni da un file?",
                answer: "Da Liquidità → Conti puoi aggiungere un conto importando un CSV, e da Investimenti → Operazioni importi gli estratti del broker. Gestisci e cancella gli import da «Gestione importazioni»."),
        FaqItem(id: "categoria-sbagliata", question: "Una transazione ha la categoria sbagliata",
                answer: "Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente."),
        FaqItem(id: "dati-miei", question: "Posso scaricare o cancellare i miei dati?",
                answer: "Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi."),
        FaqItem(id: "stime-fiscali", question: "Le stime fiscali sono una consulenza?",
                answer: "No. Imposte, aliquote e proiezioni sono stime a scopo informativo: per decisioni fiscali o di investimento rivolgiti a un professionista abilitato."),
    ]

    /// `application/x-www-form-urlencoded` like `URLSearchParams.toString()`: `*-._` and alphanumerics kept, space → `+`.
    static func formEncode(_ value: String) -> String {
        var out = ""
        for byte in value.utf8 {
            switch byte {
            case UInt8(ascii: "a")...UInt8(ascii: "z"), UInt8(ascii: "A")...UInt8(ascii: "Z"), UInt8(ascii: "0")...UInt8(ascii: "9"),
                 UInt8(ascii: "*"), UInt8(ascii: "-"), UInt8(ascii: "."), UInt8(ascii: "_"):
                out.append(Character(UnicodeScalar(byte)))
            case UInt8(ascii: " "):
                out.append("+")
            default:
                out += String(format: "%%%02X", byte)
            }
        }
        return out
    }
}

/// `/aiuto?da=<path>&tipo=<kind>` (SUP-002, SUP-003).
public struct HelpLaunch: Equatable, Sendable {
    /// Screen the user came from, used as the context path; nil → the help screen itself.
    public let from: String?
    public let kind: ReportKind

    public init(from: String? = nil, kind: ReportKind = .problema) {
        self.from = from
        self.kind = kind
    }

    public init(path: String) {
        var from: String?
        var kind: ReportKind?
        if let query = path.split(separator: "?", maxSplits: 1).dropFirst().first {
            for pair in query.split(separator: "&") {
                let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                let value = parts[1].replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? parts[1]
                switch parts[0] {
                case "da": from = value.isEmpty ? nil : value
                case "tipo": kind = ReportKind.parse(value)
                default: break
                }
            }
        }
        self.init(from: from, kind: kind ?? .problema)
    }

    /// The path recorded as context: `?da=` when present, else the help screen (SUP-002).
    public var contextPath: String { from ?? "/aiuto" }
}

// MARK: - Crash reporting (SUP-024…026)

/// First path segment sent with a crash report (`CLIENT_ERROR_AREAS`).
public enum ClientErrorArea: String, CaseIterable, Codable, Sendable {
    case panoramica, liquidita, conti, investimenti, debiti, pensione, analitiche, categorizza, importazioni, impostazioni,
         aiuto, onboarding, altro

    /// `/investimenti/titoli/abc` → `investimenti`; any other path → `altro` (`clientErrorArea`).
    public static func from(path: String) -> ClientErrorArea {
        let clean = Support.sanitizePath(path)
        let first = clean.split(separator: "/").first.map(String.init) ?? ""
        return ClientErrorArea(rawValue: first) ?? .altro
    }
}

/// Body of `POST /api/client-errors` (`buildClientErrorReport`).
public struct ClientErrorReport: Encodable, Equatable, Sendable {
    public enum Kind: String, Encodable, Sendable { case sezione, globale }

    public let kind: Kind
    public let area: ClientErrorArea
    public let name: String?
    public let message: String
    public let digest: String?

    public init(kind: Kind, path: String, name: String?, message: String, digest: String? = nil) {
        self.kind = kind
        area = ClientErrorArea.from(path: path)
        self.name = name.flatMap { $0.isEmpty ? nil : String($0.prefix(80)) }
        self.message = String((message.isEmpty ? "Errore senza messaggio" : message).prefix(500))
        self.digest = digest.flatMap { $0.isEmpty ? nil : String($0.prefix(64)) }
    }

    /// Native mapping of «a screen fails to render» (mobile note): the screen's data could not be decoded. Only the
    /// endpoint's first two segments travel (`/api/overview`), never ids or values.
    public static func decodingFailure(screenPath: String, endpoint: String) -> ClientErrorReport {
        let segments = endpoint.split(separator: "?").first.map { $0.split(separator: "/").prefix(2).joined(separator: "/") } ?? ""
        return ClientErrorReport(kind: .sezione, path: screenPath, name: "DecodingError",
                                 message: "Risposta non leggibile: /\(segments)")
    }
}
