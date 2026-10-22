import Foundation

// New-account choice, bank picker and the native consent return (ACC-011…028, api/endpoints/gocardless.md R6).
// Same names on Android.

// MARK: - Capacity (ACC-012 / ACC-013)

public struct BankUnavailableCopy: Equatable, Sendable {
    public let badge: String
    public let description: String
}

public enum BankCapacityCopy {
    /// Badge and text of the disabled «Collega la tua banca» option (`BANK_UNAVAILABLE_COPY`); nil when linking is open.
    public static func unavailable(_ capacity: BankCapacity?) -> BankUnavailableCopy? {
        guard let capacity, !capacity.canConnectNew else { return nil }
        switch capacity.reason ?? .globalLimit {
        case .globalLimit, .providerLimit:
            return BankUnavailableCopy(badge: "In arrivo", description: "I posti per il collegamento automatico sono finiti, ne stiamo aggiungendo altri. Intanto usa un conto manuale o importa l'estratto conto.")
        case .userLimit:
            return BankUnavailableCopy(badge: "Una per persona", description: "Per ora si collega una sola banca per persona. Per gli altri conti usa un conto manuale o importa l'estratto conto.")
        case .userAttempts:
            return BankUnavailableCopy(badge: "Più avanti", description: "Hai avviato troppi collegamenti questo mese, riprova più avanti. Intanto usa un conto manuale o importa l'estratto conto.")
        }
    }
}

// MARK: - Countries (ACC-017)

public struct BankCountry: Equatable, Sendable {
    public let code: String
    /// Italian source of the name.
    public let label: String

    /// Flag emoji of the ISO code.
    public var flag: String {
        String(String.UnicodeScalarView(code.uppercased().unicodeScalars.compactMap { Unicode.Scalar(127_397 + $0.value) }))
    }
}

public enum BankCountries {
    public static let all = [BankCountry(code: "IT", label: "Italia"), BankCountry(code: "DE", label: "Germania"),
                             BankCountry(code: "FR", label: "Francia"), BankCountry(code: "ES", label: "Spagna"),
                             BankCountry(code: "GB", label: "Regno Unito")]

    /// Default = the user's product country (IT or DE).
    public static func defaultCode(productCountry: String?) -> String {
        let code = (productCountry ?? "IT").uppercased()
        return all.contains { $0.code == code } ? code : "IT"
    }
}

// MARK: - Institutions (ACC-018 / ACC-019)

public enum InstitutionSearch {
    /// Case-insensitive substring on the name (empty query = all).
    public static func filter(_ institutions: [Institution], query: String) -> [Institution] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return institutions }
        return institutions.filter { $0.name.lowercased().contains(q) }
    }

    /// `1 banca` / `{n} banche`.
    public static func countLabel(_ count: Int) -> AccountsText {
        count == 1 ? AccountsText("1 banca") : AccountsText("{0} banche", ["0": String(count)])
    }

    /// No-result title: `Nessuna banca trovata per «{q}».` or `Nessuna banca disponibile in questo paese.`
    public static func emptyTitle(query: String) -> AccountsText {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return q.isEmpty ? AccountsText("Nessuna banca disponibile in questo paese.") : AccountsText("Nessuna banca trovata per «{0}».", ["0": q])
    }
}

public enum InstitutionHistory {
    /// `Storico fino a {n} giorni`, or years from 365 days (`Math.round(days / 365)`); nil when the value is invalid.
    public static func label(_ days: String) -> AccountsText? {
        guard let total = JSNumber.parse(days), total.isFinite, total > 0 else { return nil }
        if total >= 365 {
            let years = Int(JSNumber.round(total / 365))
            return years == 1 ? AccountsText("Storico fino a 1 anno") : AccountsText("Storico fino a {0} anni", ["0": String(years)])
        }
        let text = total.rounded() == total ? String(Int(total)) : String(total)
        return AccountsText("Storico fino a {0} giorni", ["0": text])
    }
}

// MARK: - Consent return (R6)

/// `buddybudget://bank/return?ref=<connectionId>&status=returned|cancelled|failed|invalid_ref[&error=]`.
public struct BankLinkReturn: Equatable, Sendable {
    public enum Status: String, Sendable { case returned, cancelled, failed, invalidRef = "invalid_ref" }

    public let ref: String?
    public let status: Status
    public let error: String?

    public static let scheme = "buddybudget"

    public init(ref: String?, status: Status, error: String? = nil) {
        self.ref = ref
        self.status = status
        self.error = error
    }

    /// Nil for any other address. An unknown status counts as `returned` (informational only).
    public static func parse(_ url: URL) -> BankLinkReturn? {
        guard url.scheme?.lowercased() == scheme, url.host?.lowercased() == "bank", url.path == "/return",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        let items = components.queryItems ?? []
        func value(_ name: String) -> String? { items.first { $0.name == name }?.value.flatMap { $0.isEmpty ? nil : $0 } }
        let ref = value("ref")
        let status = ref == nil ? .invalidRef : (value("status").flatMap(Status.init(rawValue:)) ?? .returned)
        return BankLinkReturn(ref: ref, status: status, error: value("error"))
    }
}

public enum BankLinkMessages {
    public static let cancelled = "Hai annullato il collegamento con la banca."
    public static let consentFailed = "La banca non ha confermato il consenso: il collegamento non è stato completato."
    public static let notFound = "Non abbiamo trovato il collegamento con la banca. Riprova dall'inizio."
    public static let unavailable = "Il servizio di collegamento bancario non risponde. Riprova tra poco."

    /// Message for a failed `…/complete` (R6): 422 consent failed, 404 not found, 502 unavailable; 409 pending and
    /// other errors use the server text when present.
    public static func completeError(status: Int?, serverMessage: String?) -> String {
        switch status {
        case 422: return consentFailed
        case 404: return notFound
        case 502, 503: return unavailable
        default: return serverMessage ?? unavailable
        }
    }
}

// MARK: - «Conti trovati» (ACC-023…026)

public enum FoundAccounts {
    /// Card title: name, else IBAN, else the GoCardless id.
    public static func displayName(_ account: ExternalBankAccount) -> String {
        account.details.name ?? account.details.iban ?? account.externalAccountId
    }

    /// The finalize body for the ticked accounts; `targets[id]` = existing account to re-link to (nil = new).
    public static func selections(_ accounts: [ExternalBankAccount], selected: Set<String>,
                                  targets: [String: String]) -> [FinalizeSelection] {
        accounts.filter { selected.contains($0.externalAccountId) }.map { account in
            if let existing = targets[account.externalAccountId] {
                return FinalizeSelection(externalAccountId: account.externalAccountId, name: account.details.name ?? "Conto collegato",
                                         type: AccountOptions.linkedAccountType, mode: "existing", existingAccountId: existing)
            }
            return FinalizeSelection(externalAccountId: account.externalAccountId,
                                     name: account.details.name ?? account.details.iban ?? "Conto collegato",
                                     type: AccountOptions.linkedAccountType, mode: "new")
        }
    }

    public static let emptySelectionError = "Seleziona almeno un conto da importare"
}
