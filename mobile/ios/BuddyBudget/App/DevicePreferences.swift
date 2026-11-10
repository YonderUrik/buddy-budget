import BuddyBudgetKit
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

    /// Language picked by hand on the signed-out screens (`bb-language`), nil until the user picks one.
    private(set) var chosenLanguage: String?

    /// AUTH-015 / AUTH-061: language of the signed-out screens — the one picked by hand, otherwise the one the device
    /// region proposes (web: `CF-IPCountry`, #465; English outside Italy and the German-speaking countries).
    var signedOutLanguage: AppLanguage {
        get { AppLanguage(rawValue: chosenLanguage ?? proposedProfile().language) ?? .it }
        set {
            chosenLanguage = newValue.rawValue
            defaults.set(newValue.rawValue, forKey: Keys.language)
        }
    }

    /// AUTH-061: country and language proposed from the device region and preferred languages.
    func proposedProfile() -> (country: String, language: String) {
        LocaleRules.proposedProfile(region: Locale.current.region?.identifier, preferred: Locale.preferredLanguages, chosen: chosenLanguage)
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
        chosenLanguage = defaults.string(forKey: Keys.language).flatMap(AppLanguage.init(rawValue:))?.rawValue
    }

    private enum Keys {
        static let theme = "bb:theme"
        static let language = "bb-language"
    }
}
