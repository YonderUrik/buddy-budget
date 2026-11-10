import BuddyBudgetKit
import Foundation
import Observation

/// Load state of one async block of the Settings screens.
enum Loadable<T> {
    case loading
    case failed
    case loaded(T)

    var value: T? { if case .loaded(let v) = self { return v } else { return nil } }
}

/// State of Impostazioni (SET-001…049). One instance per Settings visit, shared by the hub and its groups.
/// Same fields as `SettingsModel` on Android.
@MainActor @Observable
final class SettingsModel {
    private(set) var settings: Loadable<UserSettings> = .loading
    private(set) var sessions: Loadable<[UserSessionView]> = .loading
    private(set) var notifications: Loadable<NotificationPreferences> = .loading
    private(set) var ai: Loadable<AiCategorizationState> = .loading
    private(set) var dataSummary: Loadable<UserDataSummary> = .loading
    /// Re-evaluated every 15 s (SET-040).
    private(set) var now = Date()
    /// A server `reauth_required` forces the Reauth panel even if the clock says recent.
    var forcedReauth = false

    var savingSettings = false
    var settingsError: String?
    var nameSaved = false
    var revoking: String?
    var sessionsError: String?
    var savingNotifications = false
    var notificationsError: String?
    var exampleState: ExampleState = .idle
    var savingAi = false
    var aiError: String?
    var instructionsSaved = false

    enum ExampleState: Equatable { case idle, sending, sent, failed(String) }

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private var ticker: Task<Void, Never>?

    init(env: AppEnvironment) {
        self.env = env
    }

    var recentLogin: Bool {
        !forcedReauth && RecentLogin.isRecent(until: settings.value?.recentLoginUntil, now: now)
    }

    func start() async {
        if ticker == nil {
            ticker = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(RecentLogin.recheckSeconds))
                    self?.now = Date()
                }
            }
        }
        await loadSettings()
    }

    func stop() { ticker?.cancel(); ticker = nil }

    func loadSettings() async {
        if settings.value == nil { settings = .loading }
        do { settings = .loaded(try await env.user.settings()) } catch { if settings.value == nil { settings = .failed } }
        now = Date()
    }

    func loadGroup(_ group: SettingsGroup) async {
        switch group {
        case .account: await loadSessions()
        case .notifiche:
            async let n: Void = loadNotifications()
            async let a: Void = loadAi()
            _ = await (n, a)
        case .privacy: await loadDataSummary()
        case .aspetto, .pericolo: break
        }
    }

    // MARK: Profile & preferences

    func saveName(_ name: String) async {
        await patch(UserSettingsPatch(name: name.trimmingCharacters(in: .whitespaces)))
        nameSaved = settingsError == nil
    }

    /// SET-013/014/016: saves immediately; country/language and currency re-read the bootstrap (whole app reformats).
    func patch(_ patch: UserSettingsPatch) async {
        savingSettings = true
        settingsError = nil
        defer { savingSettings = false }
        do {
            try await env.user.updateSettings(patch)
            await loadSettings()
            await env.session.refresh()
        } catch {
            settingsError = message(error)
        }
    }

    func setLocale(country: String, language: String) async {
        await patch(UserSettingsPatch(productCountry: country, language: language))
    }

    // MARK: Sessions

    func loadSessions() async {
        do { sessions = .loaded(try await env.user.sessions()) } catch { sessions = .failed }
    }

    func revoke(_ id: String?) async {
        revoking = id ?? "*"
        sessionsError = nil
        defer { revoking = nil }
        do {
            if let id { try await env.user.revokeSession(id: id) } else { try await env.user.revokeOtherSessions() }
            await loadSessions()
        } catch {
            sessionsError = message(error)
        }
    }

    // MARK: Notifications & AI

    func loadNotifications() async {
        do { notifications = .loaded(try await env.user.notifications()) } catch { notifications = .failed }
    }

    func setNotification(_ patch: NotificationPreferencesPatch) async {
        savingNotifications = true
        notificationsError = nil
        defer { savingNotifications = false }
        do { notifications = .loaded(try await env.user.updateNotifications(patch)) } catch { notificationsError = message(error) }
    }

    func sendExample() async {
        exampleState = .sending
        do {
            try await env.user.sendNotificationExample()
            exampleState = .sent
        } catch {
            exampleState = .failed(message(error))
        }
    }

    func loadAi() async {
        do { ai = .loaded(try await env.user.aiCategorization()) } catch { ai = .failed }
    }

    func setAi(_ patch: AiCategorizationPatch) async {
        savingAi = true
        aiError = nil
        defer { savingAi = false }
        do {
            ai = .loaded(try await env.user.updateAiCategorization(patch))
            if patch.instructions != nil { instructionsSaved = true }
        } catch {
            aiError = message(error)
        }
    }

    // MARK: Data

    func loadDataSummary() async {
        dataSummary = .loading
        do { dataSummary = .loaded(try await env.user.dataSummary()) } catch { dataSummary = .failed }
    }

    /// After a successful reauth the new session counts as recent.
    func reauthenticated() async {
        forcedReauth = false
        await loadSettings()
    }

    /// Server message for validation-style errors (README §5 rule 2), else a localized generic one.
    func message(_ error: Error) -> String {
        guard let api = error as? APIError else { return L10n.genericError }
        if api.isTransport { return L10n.connectionFailedCheckYourNetworkAnd }
        if api.code == .reauthRequired { forcedReauth = true }
        if let body = api.body, [400, 403, 409, 422, 429, 502].contains(body.status), let text = body.message { return text }
        return L10n.genericError
    }
}
