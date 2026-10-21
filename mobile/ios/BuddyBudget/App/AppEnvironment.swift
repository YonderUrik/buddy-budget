import BuddyBudgetKit
import Foundation
import Observation
import UIKit

/// Manual dependency container. Same name and role as `AppEnvironment` in the Android app
/// (spec: platform/architecture.md), so features are wired identically on both platforms.
@MainActor @Observable
final class AppEnvironment {
    let api: APIClient
    let health: HealthAPI
    let auth: AuthAPI
    let me: MeAPI
    let legalAPI: LegalAPI
    let user: UserAPI
    let attention: AttentionAPI
    let overview: OverviewAPI
    let start: StartAPI
    let whatsNew: WhatsNewAPI
    let welcome: WelcomeAPI
    let sidebar: SidebarAPI
    let goals: GoalsAPI
    let analytics: AnalyticsAPI
    let subscriptions: SubscriptionsAPI
    let accounts: AccountsAPI
    let goCardless: GoCardlessAPI
    let syncJobs: SyncJobsAPI
    let transactions: TransactionsAPI
    let liquidityAPI: LiquidityAPI
    let categoriesAPI: CategoriesAPI
    let budgets: BudgetsAPI
    let rulesAPI: CategorizationRulesAPI
    let investments: InvestmentsAPI
    let instruments: InstrumentsAPI
    let debts: DebtsAPI
    let pension: PensionAPI
    let personalImports: PersonalImportsAPI
    let brokerImports: BrokerImportAPI
    let planning: FinancialPlanningAPI
    /// «Scrivici» / «Segnala questo problema» (16-help-support).
    let quickReport: QuickReportCenter
    /// SUP-024: screen failures reported once to `POST /api/client-errors`.
    let clientErrors: ClientErrorReporter
    let logoLoader: LogoLoader
    let preferences: DevicePreferences
    let toasts = ToastCenter()
    let privacy = PrivacyStore()
    let session: SessionModel
    /// A file or link handed to the app from outside (share sheet, «Apri in», email links); the shell consumes it.
    var incoming: IncomingItem?

    init(api: APIClient, preferences: DevicePreferences) {
        self.api = api
        self.preferences = preferences
        health = HealthAPI(client: api)
        auth = AuthAPI(client: api)
        me = MeAPI(client: api)
        legalAPI = LegalAPI(client: api)
        user = UserAPI(client: api)
        attention = AttentionAPI(client: api)
        overview = OverviewAPI(client: api)
        start = StartAPI(client: api)
        whatsNew = WhatsNewAPI(client: api)
        welcome = WelcomeAPI(client: api)
        sidebar = SidebarAPI(client: api)
        goals = GoalsAPI(client: api)
        analytics = AnalyticsAPI(client: api)
        subscriptions = SubscriptionsAPI(client: api)
        accounts = AccountsAPI(client: api)
        goCardless = GoCardlessAPI(client: api)
        syncJobs = SyncJobsAPI(client: api)
        transactions = TransactionsAPI(client: api)
        liquidityAPI = LiquidityAPI(client: api)
        categoriesAPI = CategoriesAPI(client: api)
        budgets = BudgetsAPI(client: api)
        rulesAPI = CategorizationRulesAPI(client: api)
        investments = InvestmentsAPI(client: api)
        instruments = InstrumentsAPI(client: api)
        debts = DebtsAPI(client: api)
        pension = PensionAPI(client: api)
        personalImports = PersonalImportsAPI(client: api)
        brokerImports = BrokerImportAPI(client: api)
        planning = FinancialPlanningAPI(client: api)
        let quickReport = QuickReportCenter(api: SupportAPI(client: api))
        self.quickReport = quickReport
        let clientErrors = ClientErrorReporter(api: ClientErrorsAPI(client: api))
        self.clientErrors = clientErrors
        let store = api.session
        logoLoader = LogoLoader(baseURL: api.baseURL) { store.readToken() }
        session = SessionModel(api: api, preferences: preferences)
        session.environment = self
        toasts.reportAction = { [weak quickReport] error in quickReport?.open(source: .errore, error: error) }
        // SUP-024/025: a response the screen cannot read is the native «page did not render»; best effort, silent.
        api.events.set(onDecodingFailure: { endpoint in
            Task { @MainActor [weak quickReport] in
                guard let quickReport, api.session.readToken() != nil else { return }
                await clientErrors.report(.decodingFailure(screenPath: quickReport.currentPath(), endpoint: endpoint))
            }
        })
    }

    static func live() -> AppEnvironment {
        let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        let url = raw.flatMap(URL.init(string:)) ?? URL(string: "https://buddybudget.io/")!
        let api = APIClient(baseURL: url, session: KeychainSessionStore(), userAgent: AppVersion.userAgent,
                            acceptLanguage: { LocalizedStrings.shared.language.rawValue })
        return AppEnvironment(api: api, preferences: DevicePreferences())
    }
}

/// What another app or the system handed to BuddyBudget.
enum IncomingItem: Equatable {
    /// In-app path from a link (`/importazioni?job=…`).
    case link(String)
    /// Files shared to the app (CSV / Excel), routed to the right import flow.
    case files([PickedFile])

    /// From a URL received by `onOpenURL`: a local file or a BuddyBudget link.
    static func from(_ url: URL) -> IncomingItem? {
        if url.isFileURL { return ImportFileTypes.read(url).map { .files([$0]) } }
        return ImportsRoutes.inAppPath(url: url).map(IncomingItem.link)
    }
}

/// App version shown in «Altro» and Impostazioni (SHELL-026 native: marketing version + build number).
@MainActor
enum AppVersion {
    static var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0" }
    static var build: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0" }
    /// `v0.1.0 (1)`.
    static var label: String { "v\(version) (\(build))" }

    /// `BuddyBudget-iOS/0.1.0 (iPhone; iOS 26.0)` (api/README.md §4, shown in Settings › Sessions).
    static var userAgent: String {
        "BuddyBudget-iOS/\(version) (\(UIDevice.current.model); iOS \(UIDevice.current.systemVersion))"
    }
}
