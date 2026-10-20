import Foundation

// Liquidità · Conti logic (spec: features/04-accounts-bank-sync.md). Same names and behaviour on Android
// (`io.buddybudget.core.domain.accounts`). Copy is returned as Italian catalog sources (`AccountsText`), translated by
// the UI with `L10n.lookup(italian:)` / `tr()`.

/// A sentence to show: an Italian catalog source with `{name}` values. `lists` are placeholders filled with other texts,
/// each translated and joined with ", " (e.g. the sync summary's details).
public struct AccountsText: Equatable, Sendable {
    public let source: String
    public let values: [String: String]
    public let lists: [String: [AccountsText]]

    public init(_ source: String, _ values: [String: String] = [:], lists: [String: [AccountsText]] = [:]) {
        self.source = source
        self.values = values
        self.lists = lists
    }
}

// MARK: - Options (lib/validation/accounts.ts)

public enum AccountOptions {
    /// Type presets of the select (free text otherwise, `Altro…`).
    public static let typePresets = ["Conto corrente", "Conto risparmio", "Conto deposito", "Contanti"]
    /// `ACCOUNT_ICONS`, picker order.
    public static let icons = ["wallet", "credit-card", "banknote", "building-2", "piggy-bank", "trending-up", "home", "car",
                               "plane", "shopping-cart", "briefcase", "dollar-sign", "bitcoin", "landmark", "coins", "receipt",
                               "package", "gift", "heart", "star", "zap", "coffee", "shopping-bag", "user", "globe",
                               "smartphone", "watch", "graduation-cap", "flame", "music"]
    /// `SWATCH_BASE_COLORS`: the only colours offered by the picker.
    public static let colors = ["slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
                                "pink", "indigo", "cyan", "lime", "amber", "rose", "violet", "emerald"]
    public static let defaultColor = "slate"
    public static let defaultIcon = "wallet"
    public static let nameMaxLength = 80
    /// Type given to accounts created from a bank (web `Conto corrente`).
    public static let linkedAccountType = "Conto corrente"

    /// Italian colour names read by screen readers (`Colore {0}`), as the web does.
    public static func colorName(_ key: String) -> String {
        let names = ["slate": "grigio", "blue": "blu", "green": "verde", "yellow": "giallo", "purple": "viola",
                     "orange": "arancione", "red": "rosso", "teal": "verde acqua", "pink": "rosa", "indigo": "indaco",
                     "cyan": "azzurro", "lime": "lime", "amber": "ambra", "rose": "rosa scuro", "violet": "violetto",
                     "emerald": "smeraldo"]
        return names[key] ?? key
    }
}

// MARK: - Grouping (ACC-001)

/// One section of the Conti list: a bank, or the manual accounts.
public struct AccountGroup: Equatable, Identifiable, Sendable {
    public let key: String
    /// Bank name (verbatim), `Banca collegata` or `Manuali` (Italian sources; translate with lookup like the web).
    public let label: String
    /// `Si aggiorna da solo` / `Li aggiorni tu`.
    public let hint: String
    public let isManual: Bool
    public let accounts: [Account]
    public var id: String { key }

    /// Sum of the group's balances (header amount).
    public var total: Double { accounts.reduce(0) { $0 + $1.balance } }
}

public enum AccountGrouping {
    public static let unknownBank = "Banca collegata"
    public static let manualKey = "manuali"

    /// Banks in alphabetical order (Italian collation), accounts in the received order; manual accounts last.
    public static func group(_ accounts: [Account]) -> [AccountGroup] {
        var order: [String] = []
        var banks: [String: [Account]] = [:]
        var manual: [Account] = []
        for account in accounts {
            guard account.isLinked else { manual.append(account); continue }
            let bank = account.bankName ?? account.health?.institutionName ?? unknownBank
            if banks[bank] == nil { order.append(bank) }
            banks[bank, default: []].append(account)
        }
        let italian = Locale(identifier: "it")
        var groups = order
            .sorted { $0.compare($1, locale: italian) == .orderedAscending }
            .map { AccountGroup(key: "banca-\($0)", label: $0, hint: "Si aggiorna da solo", isManual: false, accounts: banks[$0] ?? []) }
        if !manual.isEmpty {
            groups.append(AccountGroup(key: manualKey, label: "Manuali", hint: "Li aggiorni tu", isManual: true, accounts: manual))
        }
        return groups
    }
}

// MARK: - Row status (ACC-003)

public enum AccountRowStatus {
    /// The server's localized line, except that a running job seen by the client wins over «Aggiornato …» / «Mai
    /// sincronizzato» (`Da riconnettere` keeps precedence). Labels go through lookup: server text is returned as is.
    public static func resolve(_ account: Account, syncing: Bool) -> AccountStatusLine {
        if !account.isLinked { return account.status ?? AccountStatusLine(tone: .neutral, label: "Aggiornato da te") }
        if account.health?.needsRenewal == true { return AccountStatusLine(tone: .warning, label: "Da riconnettere") }
        if syncing || account.health?.syncing == true { return AccountStatusLine(tone: .progress, label: "Sincronizzazione in corso") }
        return account.status ?? AccountStatusLine(tone: .neutral, label: "Mai sincronizzato")
    }
}

// MARK: - Renewal banner (ACC-007 / ACC-008)

public struct RenewalAlert: Equatable, Sendable {
    public let connectionId: String
    public let institutionName: String
    public let state: ConnectionHealthState
    public let daysLeft: Int?
}

public enum RenewalAlerts {
    /// One alert per connection that needs renewal; expired/error before expiring.
    public static func build(_ accounts: [Account]) -> [RenewalAlert] {
        var seen = Set<String>()
        var alerts: [RenewalAlert] = []
        for account in accounts {
            guard let health = account.health, health.needsRenewal || ConnectionHealth.needsRenewal(health.state),
                  !seen.contains(health.connectionId) else { continue }
            seen.insert(health.connectionId)
            alerts.append(RenewalAlert(connectionId: health.connectionId, institutionName: health.institutionName,
                                       state: health.state, daysLeft: health.daysLeft))
        }
        let urgent = alerts.filter { $0.state != .expiring }
        return urgent + alerts.filter { $0.state == .expiring }
    }

    public static func message(_ alert: RenewalAlert) -> AccountsText {
        let bank = alert.institutionName
        switch alert.state {
        case .expiring:
            if alert.daysLeft == 1 { return AccountsText("Il collegamento con {0} scade domani.", ["0": bank]) }
            return AccountsText("Il collegamento con {0} scade tra {1} giorni.", ["0": bank, "1": String(alert.daysLeft ?? 0)])
        case .error:
            return AccountsText("Il collegamento con {0} non è andato a buon fine.", ["0": bank])
        default:
            return AccountsText("Il collegamento con {0} è scaduto: i conti non si aggiornano.", ["0": bank])
        }
    }
}

// MARK: - Manual account form (ACC-029 / ACC-030)

public struct ManualAccountErrors: Equatable, Sendable {
    public var name: String?
    public var type: String?
    public var balance: String?

    public init(name: String? = nil, type: String? = nil, balance: String? = nil) {
        self.name = name
        self.type = type
        self.balance = balance
    }

    public var isEmpty: Bool { name == nil && type == nil && balance == nil }
}

/// The two-step «Conto manuale» form. `typePreset == nil` means `Altro…` (free text in `customType`).
public struct ManualAccountDraft: Equatable, Sendable {
    public var name = ""
    public var typePreset: String? = AccountOptions.typePresets[0]
    public var customType = ""
    /// Text of the amount field (locale decimal separator); "0" by default, may be negative.
    public var balanceText = "0"
    public var color = AccountOptions.defaultColor
    public var icon = AccountOptions.defaultIcon

    public init() {}

    public var type: String { typePreset ?? customType }

    /// Step 1: name and type required.
    public func validateNameAndType() -> ManualAccountErrors {
        var errors = ManualAccountErrors()
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors.name = "Dai un nome al conto, per riconoscerlo nell'elenco."
        }
        if type.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors.type = "Scrivi di che tipo di conto si tratta."
        }
        return errors
    }

    public var balance: Double? { BBFormat.parseAccountAmount(balanceText) }

    /// Step 2: today's balance required (0 and negatives allowed).
    public func validateBalance() -> ManualAccountErrors {
        balance == nil ? ManualAccountErrors(balance: "Inserisci il saldo di oggi (anche 0).") : ManualAccountErrors()
    }

    /// The `POST /api/accounts` body, or nil while invalid.
    public func request() -> NewAccountRequest? {
        guard validateNameAndType().isEmpty, let balance else { return nil }
        return NewAccountRequest(name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                                 type: type.trimmingCharacters(in: .whitespacesAndNewlines),
                                 balance: balance, color: color, icon: icon)
    }

    /// Name field limited to 80 characters.
    public static func clampName(_ text: String) -> String { String(text.prefix(AccountOptions.nameMaxLength)) }
}

// MARK: - Account detail edits (ACC-032…035)

public enum AccountEdits {
    /// Rename on field exit: only when changed and non-empty (otherwise the field reverts, no request).
    public static func rename(_ account: Account, draft: String) -> AccountPatch? {
        let next = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !next.isEmpty, next != account.name else { return nil }
        return AccountPatch(name: next)
    }

    /// Manual accounts only; ignored when empty or unchanged.
    public static func retype(_ account: Account, draft: String) -> AccountPatch? {
        guard !account.isLinked else { return nil }
        let next = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !next.isEmpty, next != account.type else { return nil }
        return AccountPatch(type: next)
    }

    /// Manual accounts only; saved on field exit when valid and changed.
    public static func rebalance(_ account: Account, draft: String) -> AccountPatch? {
        guard !account.isLinked, let value = BBFormat.parseAccountAmount(draft), value != account.balance else { return nil }
        return AccountPatch(balance: value)
    }

    /// Icon and colour, saved immediately for any account.
    public static func appearance(_ account: Account, color: String, icon: String) -> AccountPatch? {
        guard color != account.color || icon != account.icon else { return nil }
        return AccountPatch(color: color, icon: icon)
    }

    /// The account with a successful patch applied locally (optimistic list update).
    public static func apply(_ patch: AccountPatch, to a: Account) -> Account {
        Account(id: a.id, name: patch.name ?? a.name, type: patch.type ?? a.type, balance: patch.balance ?? a.balance,
                color: patch.color ?? a.color, icon: patch.icon ?? a.icon, source: a.source, isDemo: a.isDemo,
                createdAt: a.createdAt, updatedAt: a.updatedAt, bankName: a.bankName, trend: a.trend, health: a.health,
                status: a.status)
    }
}

// MARK: - Delete / unlink (ACC-040 / ACC-041)

public struct AccountRemovalCopy: Equatable, Sendable {
    public let action: String
    public let title: String
    public let message: AccountsText
    public let confirm: String
}

public enum AccountRemoval {
    /// Decision 0003 / web bug: the confirmation says that the account's movements are deleted too.
    public static func copy(for account: Account) -> AccountRemovalCopy {
        if account.isLinked {
            return AccountRemovalCopy(
                action: "Scollega il conto", title: "Scollegare questo conto?",
                message: AccountsText("\"{0}\" verrà scollegato e tutti i suoi movimenti verranno eliminati. L'azione non è reversibile.",
                                      ["0": account.name]),
                confirm: "Scollega")
        }
        return AccountRemovalCopy(
            action: "Elimina il conto", title: "Eliminare questo conto?",
            message: AccountsText("\"{0}\" verrà eliminato definitivamente, insieme al suo saldo e a tutti i suoi movimenti.",
                                  ["0": account.name]),
            confirm: "Elimina")
    }
}

// MARK: - Navigation

public enum AccountsPaths {
    /// Movimenti filtered on one account (ACC-002 / ACC-039).
    public static func movements(accountId: String) -> String { "/liquidita?conto=\(accountId)" }
    public static let imports = "/importazioni"
    public static let categorize = "/categorizza"
}
