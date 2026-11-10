import BuddyBudgetKit
import Foundation
import Observation

/// Owns the signed-in state and decides the top-level screen (SHELL-001…004, AUTH-017…023): reads the token, loads
/// `GET /api/me/bootstrap`, applies language / privacy / theme, reacts to 401 (sign out) and to gate 403s (re-route).
/// Same name and responsibilities as `SessionModel` on Android.
@MainActor @Observable
final class SessionModel {
    private(set) var route: AppRoute = .launching
    private(set) var bootstrap: MeBootstrap?
    /// Legal metadata (version, clauses, document URLs) in the current language; loaded on demand.
    private(set) var legal: LegalMeta?
    /// Bumped on every sign-in so the shell and feature models start from scratch (SHELL-025: no data survives).
    private(set) var generation = 0
    /// Login notice after an account deletion (AUTH-010).
    var accountDeletedNotice = false
    /// Email to prefill on the login screen (DEBUG launch argument, or after «Usa un'altra email»).
    var prefillEmail: String = ""

    @ObservationIgnored weak var environment: AppEnvironment?
    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let preferences: DevicePreferences
    @ObservationIgnored private var loading = false

    init(api: APIClient, preferences: DevicePreferences) {
        self.api = api
        self.preferences = preferences
        api.events.set(
            onUnauthorized: { [weak self] in Task { @MainActor in self?.sessionExpired() } },
            onGate: { [weak self] _ in Task { @MainActor in await self?.refresh() } }
        )
    }

    // MARK: Derived profile

    var sections: MeBootstrap.Sections { bootstrap?.capabilities.sections ?? MeBootstrap.Sections() }
    /// Engine capabilities of the product country (`taxes`, `inflation`, …); nil before the bootstrap.
    var features: MeBootstrap.Features? { bootstrap?.capabilities.features }
    var currency: String { bootstrap?.profile.currency ?? LocaleRules.defaultCurrency }
    var country: String { LocaleRules.resolveCountry(bootstrap?.profile.productCountry) }
    var homePage: AppDestination { HomePage.resolve(bootstrap?.profile.homePage) }

    // MARK: Lifecycle

    /// App launch: no token → login; otherwise load the bootstrap and route on its gate.
    func launch() async {
        applyLanguage(preferences.signedOutLanguage)
        guard api.session.readToken() != nil else {
            route = .signedOut
            return
        }
        route = .launching
        await refresh()
    }

    /// Re-reads the bootstrap (foreground, after onboarding / legal acceptance / reactivation / settings, gate 403).
    func refresh() async {
        guard api.session.readToken() != nil else {
            route = .signedOut
            return
        }
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let next = try await environment?.me.bootstrap()
            guard let next else { return }
            apply(next)
        } catch APIError.unauthorized {
            route = .signedOut
        } catch {
            // Keep the current screen if we already have one; otherwise show the retry screen.
            if bootstrap == nil { route = .unavailable }
        }
    }

    /// Called after a successful email-code sign-in (the token is already stored).
    func signedIn() async {
        generation += 1
        accountDeletedNotice = false
        bootstrap = nil
        route = .launching
        await refresh()
    }

    /// SHELL-025 / AUTH-023: ends the session on the server, wipes token and caches, back to login. No confirmation.
    func signOut(accountDeleted: Bool = false) async {
        await environment?.auth.signOut()
        reset(accountDeleted: accountDeleted)
    }

    /// After `DELETE /api/user/account` the session no longer exists: wipe locally.
    func accountDeleted() {
        api.session.clear()
        // AUTH-059: a deleted account is not offered again on the login screen.
        preferences.remove(ReturningUser.key)
        reset(accountDeleted: true)
    }

    /// SHELL-056: a 401 from any call is session expiry.
    private func sessionExpired() {
        guard route != .signedOut else { return }
        reset(accountDeleted: false)
        environment?.toasts.show(.info, L10n.sessionExpired)
    }

    private func reset(accountDeleted: Bool) {
        bootstrap = nil
        legal = nil
        generation += 1
        accountDeletedNotice = accountDeleted
        environment?.privacy.hideAmounts = false
        applyLanguage(preferences.signedOutLanguage)
        route = .signedOut
    }

    // MARK: Profile

    private func apply(_ next: MeBootstrap) {
        let languageChanged = next.profile.language != bootstrap?.profile.language
        bootstrap = next
        applyLanguage(AppLanguage.resolve(language: next.profile.language, productCountry: next.profile.productCountry))
        environment?.privacy.hideAmounts = next.profile.hideAmounts
        if languageChanged { legal = nil }
        route = AppRoute.resolve(hasToken: true, bootstrap: next)
    }

    /// Language of the UI and of `BBFormat` (AUTH-029, SET-016).
    func applyLanguage(_ language: AppLanguage) {
        LocalizedStrings.shared.setLanguage(language)
    }

    /// Signed-out language picker (AUTH-015).
    func chooseSignedOutLanguage(_ language: AppLanguage) {
        preferences.signedOutLanguage = language
        applyLanguage(language)
        legal = nil
    }

    /// Optimistic privacy toggle saved on the account, reverted on failure (SHELL-051).
    func setHideAmounts(_ hidden: Bool) async {
        guard let environment else { return }
        let previous = environment.privacy.hideAmounts
        environment.privacy.hideAmounts = hidden
        do {
            try await environment.user.updateSettings(UserSettingsPatch(hideAmounts: hidden))
        } catch {
            environment.privacy.hideAmounts = previous
            environment.toasts.show(.error, L10n.genericError)
        }
    }

    /// `GET /api/legal` in the UI language (cached until the language changes).
    func loadLegal() async -> LegalMeta? {
        let language = LocalizedStrings.shared.language.rawValue
        if let legal, legal.language == language { return legal }
        legal = try? await environment?.legalAPI.get(language: language)
        return legal
    }

    // MARK: Debug

    #if DEBUG
    /// DEBUG-only launch hooks (`-BBToken <token>`, `-BBEmail <email>`, `-BBSignOut`): see `DebugLaunch`.
    func applyDebugLaunch(token: String?, email: String?, signOut: Bool) {
        if signOut { api.session.clear() }
        if let token, !token.isEmpty { api.session.saveToken(token) }
        if let email { prefillEmail = email }
    }
    #endif
}
