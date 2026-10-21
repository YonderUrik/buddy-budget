import Foundation

// «Il tuo quadro» in «Altro»: the web sidebar's insight modules (spec: features/00 SHELL-020, SHELL-028…038;
// features/15 SET-020/021; web lib/sidebar/modules.ts, components/domain/sidebar-insights). Same names on Android.

public enum SidebarModuleId: String, CaseIterable, Sendable {
    case oggi, portafoglio, watchlist, scadenze, fire

    /// Per-device switch (`bb:sidebar:module:{id}`), default on (SHELL-028, SET-020).
    public var preferenceKey: String { "bb:sidebar:module:\(rawValue)" }
    public static let enabledByDefault = true

    /// Settings label and hint (Italian sources, `SIDEBAR_MODULES`).
    public var settingsLabel: String {
        switch self {
        case .oggi: "Patrimonio netto"
        case .portafoglio: "Portafoglio"
        case .watchlist: "Watchlist"
        case .scadenze: "Prossime scadenze"
        case .fire: "Obiettivo FIRE"
        }
    }

    public var settingsHint: String {
        switch self {
        case .oggi: "Il totale di oggi e la variazione dell'ultimo mese."
        case .portafoglio: "Valore degli investimenti e posizioni principali."
        case .watchlist: "I titoli che segui, con gli avvisi di prezzo scattati."
        case .scadenze: "Rate dei finanziamenti e collegamenti bancari da rinnovare."
        case .fire: "Quanto manca al numero FIRE, con le ipotesi di Analitiche."
        }
    }

    /// Section title in «Il tuo quadro».
    public var title: String {
        switch self {
        case .oggi: "Oggi"
        case .portafoglio: "Portafoglio"
        case .watchlist: "Watchlist"
        case .scadenze: "Prossime scadenze"
        case .fire: "Obiettivo FIRE"
        }
    }

    /// SHELL-029: Watchlist starts collapsed, the others open.
    public var openByDefault: Bool { self != .watchlist }

    /// SHELL-037: summary 5 min (Oggi, Portafoglio, Watchlist), deadlines 10 min, FIRE 60 min.
    public var freshSeconds: TimeInterval {
        switch self {
        case .oggi, .portafoglio, .watchlist: 5 * 60
        case .scadenze: 10 * 60
        case .fire: 60 * 60
        }
    }

    /// SET-020 order (`SIDEBAR_MODULES`), without FIRE where `retirement` is off (SET-021).
    public static func settingsOrder(retirement: Bool) -> [SidebarModuleId] {
        [.oggi, .portafoglio, .watchlist, .scadenze, .fire].filter { $0 != .fire || retirement }
    }

    /// SHELL-029 render order of the enabled modules (FIRE only with `retirement`, SHELL-036).
    public static func renderOrder(enabled: (SidebarModuleId) -> Bool, retirement: Bool) -> [SidebarModuleId] {
        [.oggi, .scadenze, .fire, .portafoglio, .watchlist].filter { enabled($0) && ($0 != .fire || retirement) }
    }

    /// SHELL-028: which requests the enabled modules need (a disabled module makes none).
    public static func needsSummary(_ modules: [SidebarModuleId]) -> Bool {
        modules.contains(.oggi) || modules.contains(.portafoglio) || modules.contains(.watchlist)
    }
}

public enum SidebarInsights {
    public static let maxHoldings = 3
    public static let maxWatchlist = 4
    public static let mask = "••••"

    /// SHELL-030: net worth and its 30-day change, without pension when the user excluded it.
    public static func today(_ netWorth: SidebarSummary.NetWorth, pensionIncluded: Bool) -> (total: Double, change: Double?) {
        let drop = !pensionIncluded ? netWorth.pension : nil
        let total = netWorth.total - (drop?.total ?? 0)
        let change = netWorth.monthChange.map { $0 - (drop?.monthChange ?? 0) }
        return (total, change)
    }

    /// Change color: neutral when missing or ~0, else positive / negative (`changeToneClass`).
    public static func tone(_ value: Double?) -> AmountTone {
        guard let value, abs(value) >= 0.00005 else { return .neutral }
        return value < 0 ? .neg : .pos
    }

    /// SHELL-035: overdue items counted in the badge.
    public static func overdueCount(_ items: [SidebarDeadlines.Item]) -> Int { items.filter(\.overdue).count }

    /// `{n} scaduta|scadute` (Italian sources).
    public static func overdueBadge(_ count: Int) -> String? {
        guard count > 0 else { return nil }
        return count == 1 ? "scaduta" : "scadute"
    }

    /// `{n} titolo|titoli`.
    public static func watchlistSummary(_ count: Int) -> String { count == 1 ? "titolo" : "titoli" }

    /// `{n} avviso|avvisi`.
    public static func alertsWord(_ count: Int) -> String { count == 1 ? "avviso" : "avvisi" }

    /// FIRE bar fill (0…1) and `38%` text (capped at 100%, SHELL-036).
    public static func fireFraction(_ progress: Double) -> Double { min(max(progress, 0), 1) }
    public static func fireProgressText(_ progress: Double) -> String { "\(Int((fireFraction(progress) * 100).rounded()))%" }

    /// SHELL-036: `tra N anni` / `tra 1 anno` / `tra meno di un anno` / `raggiunto`; nil when unknown.
    public static func yearsToFire(_ years: Double?) -> CatalogText? {
        guard let years else { return nil }
        if years <= 0 { return CatalogText("raggiunto") }
        if years < 1 { return CatalogText("tra meno di un anno") }
        let rounded = Int(years.rounded())
        return rounded == 1 ? CatalogText("tra 1 anno") : CatalogText("tra {0} anni", ["0": String(rounded)])
    }

    public enum FireState: Equatable, Sendable {
        /// Without annual retirement spending: invitation copy.
        case invite
        /// SHELL-036 (web #444): no target and nothing set aside yet — a new user gets no FIRE hint.
        case hidden
        case reached(progress: Double)
        case progress(progress: Double, remaining: Double, years: CatalogText?)
    }

    public static func fireState(_ fire: SidebarFire) -> FireState {
        guard let target = fire.target, let progress = fire.progress else { return fire.wealth <= 0 ? .hidden : .invite }
        if progress >= 1 { return .reached(progress: progress) }
        return .progress(progress: progress, remaining: max(target - fire.wealth, 0), years: yearsToFire(fire.yearsToFire))
    }

    /// Collapsed summary of the deadlines module: next date `{d} {mon}`.
    public static func deadlineDay(_ iso: String, locale: BBLocale) -> (day: String, month: String) {
        guard let date = CalendarDate(iso: iso) else { return (iso, "") }
        return (String(date.day), BBFormat.monthNameShort(date.month, locale: locale))
    }
}

/// Web hrefs served by the API (deadlines, «Novità») mapped to an in-app path `ShellModel.open(path:)` understands.
/// Unknown paths open the section's root (api/endpoints/meta.md).
public enum InAppLinks {
    public static func nativePath(_ href: String) -> String {
        let path = String(href.split(separator: "?", maxSplits: 1).first ?? "")
        if AppDestination(path: href) != nil { return href }
        switch path {
        case "/conti/collega": return AppDestination.liquidity.rawValue
        default:
            let section = "/" + (path.split(separator: "/").first.map(String.init) ?? "")
            return AppDestination(path: section) != nil ? section : AppDestination.overview.rawValue
        }
    }

    /// SHELL-034: a deadline row — instalments open the debt (Debiti area), renewals open Conti with the renewal flow.
    public static func deadlinePath(_ item: SidebarDeadlines.Item) -> String {
        if item.kind == "rinnovo" { return "/liquidita/conti?rinnova=sidebar" }
        let id = item.id.hasPrefix("rata:") ? String(item.id.dropFirst(5)) : ""
        return id.isEmpty ? AppDestination.debts.rawValue : "/debiti/finanziamenti?id=\(id)"
    }

    /// SHELL-033: security page of a holding / watchlist row.
    public static func securityPath(_ instrumentId: String) -> String { "/investimenti/titoli/\(instrumentId)" }
}

/// SHELL-037: data fresh for a while, never retried (an error renders nothing until the next freshness window).
public struct FreshnessClock: Sendable {
    public private(set) var loadedAt: Date?

    public init(loadedAt: Date? = nil) { self.loadedAt = loadedAt }

    public func isFresh(now: Date, seconds: TimeInterval) -> Bool {
        guard let loadedAt else { return false }
        return now.timeIntervalSince(loadedAt) < seconds
    }

    public mutating func mark(_ now: Date) { loadedAt = now }
}
