import Foundation

/// Settings groups (SET-001), ids usable as deep link `?sezione=` (SET-003). Same cases on Android (`SettingsGroup`).
public enum SettingsGroup: String, CaseIterable, Sendable {
    case account, aspetto, notifiche, privacy, pericolo

    /// Label and summary (Italian sources, current web copy).
    public var label: String {
        switch self {
        case .account: "Account"
        case .aspetto: "Aspetto e uso"
        case .notifiche: "Notifiche e AI"
        case .privacy: "Privacy e dati"
        case .pericolo: "Zona pericolosa"
        }
    }

    public var summary: String {
        switch self {
        case .account: "Il tuo profilo e i dispositivi collegati"
        case .aspetto: "Valuta, tema, pagina iniziale e barra laterale"
        case .notifiche: "Email di riepilogo e avvisi, assistente per le categorie e dove l'app usa l'AI"
        case .privacy: "Statistiche anonime, esportazione e informative"
        case .pericolo: "Azzera i dati, disattiva o elimina l'account"
        }
    }

    public var iconKey: String {
        switch self {
        case .account: "user-round"
        case .aspetto: "palette"
        case .notifiche: "bell"
        case .privacy: "shield-check"
        case .pericolo: "triangle-alert"
        }
    }

    public var isDanger: Bool { self == .pericolo }

    private static let legacyAnchors: [String: SettingsGroup] = [
        "#impostazioni-notifiche": .notifiche,
        "#impostazioni-assistente-categorie": .notifiche,
        "#impostazioni-privacy": .privacy,
        "#impostazioni-dati": .privacy,
        "#impostazioni-barra-laterale": .aspetto,
        "#impostazioni-preferenze": .aspetto,
        "#impostazioni-profilo": .account,
        "#impostazioni-sessioni": .account,
        "#impostazioni-zona-pericolosa": .pericolo,
    ]

    /// SET-003: `/impostazioni?sezione=<id>` or a legacy `#impostazioni-*` anchor → group; unknown → nil (the list).
    public static func from(deepLink: String) -> SettingsGroup? {
        if let hashIndex = deepLink.firstIndex(of: "#") {
            let anchor = String(deepLink[hashIndex...])
            if let group = legacyAnchors[anchor], !deepLink.contains("sezione=") { return group }
        }
        guard let query = deepLink.split(separator: "?", maxSplits: 1).last, deepLink.contains("?") else { return nil }
        for pair in query.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2, parts[0] == "sezione" {
                let value = parts[1].split(separator: "#").first.map(String.init) ?? ""
                return SettingsGroup(rawValue: value)
            }
        }
        return nil
    }
}

/// Recent-login window for export/reset/deactivate/delete (SET-039/040).
public enum RecentLogin {
    public static let maxAgeMinutes = 10
    public static let recheckSeconds: TimeInterval = 15

    public static func isRecent(until iso: String?, now: Date) -> Bool {
        guard let iso, let until = ISODate.parse(iso) else { return false }
        return now < until
    }
}

/// Typed confirmations of the danger zone (SET-043, SET-046).
public enum DangerConfirmation {
    /// `RESET_CONFIRMATION_WORD`: Italian, not localized, exact and case-sensitive.
    public static let resetWord = "RESETTA"
    public static let deactivationGraceDays = 30
    public static let sessionIdleDays = 7

    public static func resetMatches(_ typed: String) -> Bool { typed == resetWord }

    public static func deleteMatches(_ typed: String, email: String) -> Bool {
        typed.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == email.lowercased()
    }
}

/// One count of «I tuoi dati» (SET-037): value and the singular/plural label (Italian source).
public struct DataSummaryItem: Equatable, Sendable {
    public let label: String
    public let value: Int
}

public enum DataSummaryItems {
    public static func items(_ s: UserDataSummary) -> [DataSummaryItem] {
        func item(_ value: Int, _ singular: String, _ plural: String) -> DataSummaryItem {
            DataSummaryItem(label: value == 1 ? singular : plural, value: value)
        }
        return [
            item(s.accounts, "conto", "conti"),
            item(s.bankConnections, "banca collegata", "banche collegate"),
            item(s.transactions, "transazione", "transazioni"),
            item(s.categories, "categoria", "categorie"),
            item(s.rules, "regola di categorizzazione", "regole di categorizzazione"),
            item(s.budgets, "budget", "budget"),
            item(s.investmentOperations, "operazione di investimento", "operazioni di investimento"),
            item(s.debts, "debito", "debiti"),
            item(s.pensionFunds, "fondo pensione", "fondi pensione"),
            item(s.netWorthDays, "giorno di storico del patrimonio", "giorni di storico del patrimonio"),
        ]
    }
}

/// The pre-filled GDPR request emails (SET-036, web `PRIVACY_REQUEST_OPTIONS` / `buildPrivacyRequestHref`).
public struct PrivacyRequest: Equatable, Sendable {
    public let type: String
    public let label: String
    public let description: String
    public let article: String

    public static let options: [PrivacyRequest] = [
        PrivacyRequest(type: "rettifica", label: "Correggere un dato", description: "Per esempio l'indirizzo email dell'account.", article: "art. 16"),
        PrivacyRequest(type: "limitazione", label: "Limitare il trattamento", description: "Chiedi di sospendere l'uso dei tuoi dati mentre verifichiamo una contestazione.", article: "art. 18"),
        PrivacyRequest(type: "opposizione", label: "Oppormi al trattamento", description: "Per i trattamenti basati sul nostro legittimo interesse, come le statistiche d'uso.", article: "art. 21"),
        PrivacyRequest(type: "accesso", label: "Altre informazioni sui miei dati", description: "Oltre all'archivio ZIP: fonti, destinatari, tempi di conservazione.", article: "art. 15"),
    ]

    public static let privacyEmail = "privacy@buddybudget.io"

    /// `mailto:` URL string with subject and body (Italian, like the web: the request goes to the Italian controller).
    public func mailto(accountEmail: String, to address: String = PrivacyRequest.privacyEmail) -> String {
        let subject = "Richiesta privacy: \(label)"
        let body = [
            "Buongiorno,",
            "",
            "ai sensi del GDPR (\(article)) chiedo: \(label.lowercased()).",
            "",
            "Dettagli della richiesta:",
            "",
            "",
            "Email dell'account: \(accountEmail)",
        ].joined(separator: "\n")
        return "mailto:\(address)?subject=\(PrivacyRequest.encode(subject))&body=\(PrivacyRequest.encode(body))"
    }

    /// `encodeURIComponent`.
    static func encode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-_.!~*'()")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

/// ISO-8601 timestamps of the API (`2026-10-18T10:00:00.000Z`, milliseconds optional).
public enum ISODate {
    public static func parse(_ iso: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: iso)
    }

    /// Local calendar day of a timestamp (for `BBFormat.formatLongDate`).
    public static func localDay(_ iso: String, timeZone: TimeZone = .current) -> CalendarDate? {
        parse(iso).map { CalendarDate.of($0, in: timeZone) }
    }
}

/// «Dove l'app usa l'AI» (SET-050, web #394/#460): the places where data can reach an AI model, what is sent and where it
/// is allowed. Italian catalog sources, translated by the UI. Same names on Android (`AiUsage`).
public enum AiUsage {
    public struct Item: Equatable, Sendable {
        public let title: String
        public let sent: String
        public let `where`: String
    }

    public static let items: [Item] = [
        Item(title: "Proposte di categoria",
             sent: "Invia il nome pulito dell'esercente, se è un'entrata o un'uscita, le tue categorie e le tue istruzioni: mai importi, date, IBAN, note o nomi di persone.",
             where: "Lo attivi qui sotto, con «Proponi le categorie con l'AI»; vale anche per «Chiedi all'AI» nel dettaglio di un movimento."),
        Item(title: "Importazione di un estratto conto in un formato nuovo",
             sent: "Invia il file intero, per capire come sono fatte le colonne. Con un formato già salvato lo invia solo se la lettura non riesce.",
             where: "Te lo chiede a ogni file, nell'ultimo passo dell'importazione in Liquidità."),
        Item(title: "Importazione degli investimenti, se la lettura non riesce",
             sent: "Invia il file intero, solo per quell'importazione.",
             where: "Solo se spunti la casella nell'importazione in Investimenti."),
    ]

    public static let noAiWithoutConsent = "Senza il tuo sì non parte niente. Tutto il resto dell'app (calcoli, regole, sincronizzazione con la banca, avvisi) non usa l'AI."
    public static let zeroDataRetention = "Zero data retention: i dati passano da OpenRouter solo verso fornitori che non li conservano dopo la risposta e non li usano per l'addestramento. Se nessuno è disponibile, la richiesta non parte."

    /// Anchor of the privacy policy section about zero data retention («Come funziona»).
    public static let zdrAnchor = "#zero-data-retention"
}
