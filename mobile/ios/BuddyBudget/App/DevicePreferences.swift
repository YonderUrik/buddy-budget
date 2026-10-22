import Foundation
import Observation

/// Per-device preferences (never synced to the server, like the web's localStorage): theme and the language chosen
/// on the sign-in screens. Same keys as `DevicePreferences` on Android (spec: features/00 mobile notes).
@MainActor @Observable
final class DevicePreferences {
    private let defaults: UserDefaults

    /// `bb:theme` — Chiaro / Scuro / Sistema (SHELL-053, SET-015), default Sistema.
    var theme: BBThemePreference {
        didSet { defaults.set(theme.rawValue, forKey: Keys.theme) }
    }

    /// `bb-language` — language picked before signing in (AUTH-015), default Italian.
    var signedOutLanguage: AppLanguage {
        didSet { defaults.set(signedOutLanguage.rawValue, forKey: Keys.language) }
    }

    /// Other per-device values under the web's localStorage keys (Overview, «Il tuo quadro», «Novità»): booleans are
    /// stored as `"1"` / `"0"` like the web's `usePersistedFlag`. Observable through `values`.
    private(set) var values: [String: String] = [:]

    func flag(_ key: String, default fallback: Bool) -> Bool {
        let raw = values[key] ?? defaults.string(forKey: key)
        return raw.map { $0 == "1" } ?? fallback
    }

    func setFlag(_ key: String, _ value: Bool) { setString(key, value ? "1" : "0") }

    func string(_ key: String) -> String? { values[key] ?? defaults.string(forKey: key) }

    func setString(_ key: String, _ value: String) {
        values[key] = value
        defaults.set(value, forKey: key)
    }

    func remove(_ key: String) {
        values[key] = nil
        defaults.removeObject(forKey: key)
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        theme = defaults.string(forKey: Keys.theme).flatMap(BBThemePreference.init(rawValue:)) ?? .system
        signedOutLanguage = defaults.string(forKey: Keys.language).flatMap(AppLanguage.init(rawValue:)) ?? .it
    }

    private enum Keys {
        static let theme = "bb:theme"
        static let language = "bb-language"
    }
}
