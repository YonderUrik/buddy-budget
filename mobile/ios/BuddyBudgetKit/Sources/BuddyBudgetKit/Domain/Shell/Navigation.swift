import Foundation

/// Every in-app destination, identified by its web path (deep links and `homePage` use the same paths).
/// Same cases and raw values as `AppDestination` on Android. A feature screen is registered in the app's
/// `FeatureRegistry`; destinations without a screen yet show a placeholder with their title.
public enum AppDestination: String, CaseIterable, Sendable {
    case overview = "/panoramica"
    case liquidity = "/liquidita"
    case accounts = "/liquidita/conti"
    case spendingAnalysis = "/liquidita/analisi"
    case subscriptions = "/liquidita/abbonamenti"
    case categories = "/liquidita/categorie"
    case rules = "/liquidita/regole"
    case categorize = "/categorizza"
    /// Personal CSV / Excel imports (14-imports), pushed on the Liquidità stack.
    case imports = "/importazioni"
    case investments = "/investimenti"
    case pension = "/pensione"
    case debts = "/debiti"
    case analytics = "/analitiche"
    case settings = "/impostazioni"
    case help = "/aiuto"
    case countryUnavailable = "/country-unavailable"

    /// Title (Italian source; translate with the catalog).
    public var title: String {
        switch self {
        case .overview: "Panoramica"
        case .liquidity: "Liquidità"
        case .accounts: "Conti"
        case .spendingAnalysis: "Analisi dei movimenti"
        case .subscriptions: "Abbonamenti"
        case .categories, .rules: "Categorie e regole"
        case .categorize: "Categorizza"
        case .imports: "Importa da CSV o Excel"
        case .investments: "Investimenti"
        case .pension: "Pensione"
        case .debts: "Debiti"
        case .analytics: "Analitiche"
        case .settings: "Impostazioni"
        case .help: "Aiuto e segnalazioni"
        case .countryUnavailable: LocaleRules.unavailableMessage
        }
    }

    /// Tab whose stack hosts this destination (SHELL-014: everything outside the four sections lives under «Altro»).
    public var tab: AppTab {
        switch self {
        case .overview: .overview
        case .liquidity, .accounts, .spendingAnalysis, .subscriptions, .categories, .rules, .categorize, .imports: .liquidity
        case .investments: .investments
        case .debts: .debts
        case .pension, .analytics, .settings, .help, .countryUnavailable: .more
        }
    }

    /// Lucide icon key of the primary sections (web `NAV_ITEMS`).
    public var iconKey: String? {
        switch self {
        case .overview: "layout-dashboard"
        case .liquidity: "wallet"
        case .investments: "trending-up"
        case .pension: "umbrella"
        case .debts: "credit-card"
        case .analytics: "chart-column"
        default: nil
        }
    }

    /// One-line hint in «Altro» › «Altre sezioni» (web `MORE_MENU_HINTS`).
    public var moreMenuHint: String? {
        switch self {
        case .pension: "Fondi, rendimento e a quanto arriverai"
        case .analytics: "Quando arrivi al traguardo e cosa cambia con le tue ipotesi"
        default: nil
        }
    }

    /// SHELL-007 / SHELL-008: route policy from the server's `capabilities.sections`.
    public func isAvailable(in sections: MeBootstrap.Sections) -> Bool {
        switch self {
        case .pension: sections.pension
        case .analytics: sections.analytics
        default: true
        }
    }

    /// SHELL-061 (web `withCountryLocks`, #465): a section the user's country does not have yet stays in the menus,
    /// dimmed with the «Presto» badge and `Navigation.lockHint`, and opens the country-unavailable screen.
    public func isLocked(in sections: MeBootstrap.Sections) -> Bool { !isAvailable(in: sections) }

    /// Parses a web path (also subpaths, `?query`), e.g. a deep link. Unknown paths → nil.
    public init?(path: String) {
        let clean = String(path.split(separator: "?").first ?? "")
        if let exact = AppDestination(rawValue: clean) {
            self = exact
            return
        }
        // Longest matching prefix (`/analitiche/obiettivi` belongs to Analitiche).
        let match = AppDestination.allCases
            .filter { clean.hasPrefix($0.rawValue + "/") }
            .max { $0.rawValue.count < $1.rawValue.count }
        guard let match else { return nil }
        self = match
    }
}

/// Bottom-bar tabs (SHELL-013), identical order and icons on both platforms.
public enum AppTab: String, CaseIterable, Sendable {
    case overview, liquidity, investments, debts, more

    public var root: AppDestination? {
        switch self {
        case .overview: .overview
        case .liquidity: .liquidity
        case .investments: .investments
        case .debts: .debts
        case .more: nil
        }
    }

    public var title: String { root?.title ?? "Altro" }
    public var iconKey: String { root?.iconKey ?? "ellipsis" }
}

public enum Navigation {
    /// Badge and one-line hint of a section closed in the user's country (web `countryLock`, SHELL-061).
    public static let lockBadge = "Presto"
    public static let lockHint = "Non ancora disponibile nel tuo paese"

    /// SHELL-012 / SHELL-061: primary sections in order; a section closed in the country stays, locked.
    public static func primarySections(_ sections: MeBootstrap.Sections) -> [AppDestination] {
        [.overview, .liquidity, .investments, .pension, .debts, .analytics]
    }

    /// SHELL-013: Panoramica, Liquidità, Investimenti, Debiti + «Altro»; a locked section never goes in the bar.
    public static func tabs(_ sections: MeBootstrap.Sections) -> [AppTab] {
        AppTab.allCases.filter { $0.root.map { $0.isAvailable(in: sections) } ?? true }
    }

    /// SHELL-018/019/061: «Altre sezioni» = sections that are not in the bottom bar, the locked ones included.
    public static func otherSections(_ sections: MeBootstrap.Sections) -> [AppDestination] {
        primarySections(sections).filter { $0.tab == .more }
    }
}

/// SHELL-005 / SET-014: the user's home page.
public enum HomePage {
    /// Options in Settings, in order (`HOME_PAGE_OPTIONS`).
    public static let options: [AppDestination] = [.overview, .liquidity, .accounts, .spendingAnalysis, .investments]

    private static let legacy: [String: AppDestination] = [
        "/conti": .accounts,
        "/movimenti": .liquidity,
        "/movimenti/analisi": .spendingAnalysis,
    ]

    /// Maps the stored value (legacy paths included) to a destination; anything else → Panoramica.
    public static func resolve(_ stored: String?) -> AppDestination {
        guard let stored else { return .overview }
        if let mapped = legacy[stored] { return mapped }
        if let option = options.first(where: { $0.rawValue == stored }) { return option }
        return .overview
    }
}

/// Initials of the account avatar (web `initialsOf`): first letter of the first two words, uppercased.
public enum Initials {
    public static func of(_ name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

/// Public website links (web `LANDING_URL`, `legalHref`, auth foot links). Legal URLs prefer `GET /api/legal`.
public enum ExternalLinks {
    public static let landing = "https://buddybudget.io"
    public static let security = landing + "/sicurezza"
    public static let openSource = landing + "/#codice"
    public static let help = landing + "/#domande"

    /// `privacy` | `termini` | `cookie`; `meta` (from `GET /api/legal`) wins when available.
    public static func legal(_ id: String, meta: LegalMeta? = nil) -> String {
        meta?.document(id)?.url ?? "\(landing)/\(id)"
    }

    public static let legalDocuments = ["privacy", "termini", "cookie"]
}
