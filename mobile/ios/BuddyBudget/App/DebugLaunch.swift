#if DEBUG
import BuddyBudgetKit
import Foundation

/// DEBUG-only launch arguments for verification and screenshots (never in release builds):
/// `-BBSignOut`, `-BBToken <bearer>`, `-BBEmail <email>` (prefill), `-BBTheme light|dark|system`,
/// `-BBLanguage it|en|de` (signed-out language), `-BBOpen <path>` (e.g. `/impostazioni?sezione=account`).
@MainActor
enum DebugLaunch {
    static func value(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    static func flag(_ name: String) -> Bool { ProcessInfo.processInfo.arguments.contains(name) }

    static var openPath: String? { value("-BBOpen") }

    static func apply(to env: AppEnvironment) {
        if let theme = value("-BBTheme").flatMap(BBThemePreference.init(rawValue:)) { env.preferences.theme = theme }
        if let language = value("-BBLanguage").flatMap(AppLanguage.init(rawValue:)) { env.preferences.signedOutLanguage = language }
        env.session.applyDebugLaunch(token: value("-BBToken"), email: value("-BBEmail"), signOut: flag("-BBSignOut"))
    }
}
#endif
