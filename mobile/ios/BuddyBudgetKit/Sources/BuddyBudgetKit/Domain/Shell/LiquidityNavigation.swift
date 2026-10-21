import Foundation

/// Views of the Liquidità section, in the order of TX-001 (Categorie e regole arrives with 05). Same cases on Android.
public enum LiquiditySegment: String, CaseIterable, Sendable {
    case movements, analysis, accounts, subscriptions

    /// Segment label (Italian source; translate with the catalog).
    public var title: String {
        switch self {
        case .movements: "Movimenti"
        case .analysis: "Analisi"
        case .accounts: "Conti"
        case .subscriptions: "Abbonamenti"
        }
    }

    /// One-line description in the views sheet (web `LIQUIDITY_TABS`; Italian source).
    public var viewDescription: String {
        switch self {
        case .movements: "Entrate e uscite, ricerca e categorie"
        case .analysis: "Dove vanno i soldi, mese per mese"
        case .accounts: "Saldi e collegamenti con le banche"
        case .subscriptions: "Addebiti ricorrenti, costo al mese e prossimi addebiti"
        }
    }

    /// Lucide icon key in the views sheet.
    public var iconKey: String {
        switch self {
        case .movements: "list-ordered"
        case .analysis: "chart-column"
        case .accounts: "landmark"
        case .subscriptions: "repeat"
        }
    }

    public var destination: AppDestination {
        switch self {
        case .movements: .liquidity
        case .analysis: .spendingAnalysis
        case .accounts: .accounts
        case .subscriptions: .subscriptions
        }
    }

    /// The segment a Liquidità destination opens on (nil for destinations outside Liquidità).
    public init?(destination: AppDestination) {
        guard let match = LiquiditySegment.allCases.first(where: { $0.destination == destination }) else { return nil }
        self = match
    }
}

/// One-shot request carried by a deep link into Conti (ACC-009 `rinnova=<origin>`, ACC-010 `nuovo=1`).
/// The shell keeps it until the Conti screen consumes it, then clears it ("removes the parameter").
public enum AccountsLaunchIntent: Equatable, Sendable {
    /// Open the New-account dialog (`/liquidita/conti?nuovo=1`; also `new`/`neu` — the web reads the
    /// translated key, mobile accepts all three, see 04 open question 3).
    case newAccount
    /// Open the bank renewal flow (`?rinnova=1|panoramica|sidebar`).
    case renew(origin: String)

    public init?(path: String) {
        let parts = path.split(separator: "?", maxSplits: 1)
        guard parts.count == 2, let destination = AppDestination(path: String(parts[0])),
              destination == .accounts || destination == .liquidity else { return nil }
        var query: [String: String] = [:]
        for pair in parts[1].split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            query[kv[0]] = kv.count > 1 ? (kv[1].removingPercentEncoding ?? kv[1]) : ""
        }
        if let origin = query["rinnova"] {
            self = .renew(origin: origin.isEmpty ? "1" : origin)
        } else if destination == .accounts, ["nuovo", "new", "neu"].contains(where: { query[$0] != nil }) {
            self = .newAccount
        } else {
            return nil
        }
    }
}

/// TX-022 (web #444): what Movimenti, Analisi and Abbonamenti say before the first account, instead of zeros and empty
/// charts. Italian sources; nil for Conti, which has its own empty state. Same names on Android.
public enum LiquidityNoAccounts {
    public struct Content: Equatable, Sendable {
        public let iconKey: String
        public let title: String
        public let description: String
    }

    public static func content(_ segment: LiquiditySegment) -> Content? {
        switch segment {
        case .movements: Content(iconKey: "arrow-left-right", title: "Prima serve un conto",
                                 description: "Collega la banca o crea un conto a mano, poi importa l'estratto conto: qui vedrai entrate e uscite, giorno per giorno.")
        case .analysis: Content(iconKey: "chart-column", title: "Qui vedrai dove vanno i soldi",
                                description: "Spese per categoria mese per mese, entrate e risparmio. Serve un conto con i suoi movimenti.")
        case .subscriptions: Content(iconKey: "repeat", title: "Qui troverai i tuoi abbonamenti",
                                     description: "Li cerchiamo da soli nei movimenti di un conto: quanto costano al mese e all'anno, e quando arriva il prossimo addebito.")
        case .accounts: nil
        }
    }

    /// True once the accounts are known and there are none (never while they load).
    public static func applies(_ accountCount: Int?) -> Bool { accountCount == 0 }
}
