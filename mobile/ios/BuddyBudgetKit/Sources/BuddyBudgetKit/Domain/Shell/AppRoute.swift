import Foundation

/// Top-level screen of the app, decided from the session and `bootstrap.gate` in the proxy's order
/// (AUTH-022: session → deactivated → legal → onboarding). Same cases as `AppRoute` on Android.
public enum AppRoute: Equatable, Sendable {
    /// Launching: reading the token / first bootstrap.
    case launching
    case signedOut
    case accountDeactivated
    case legalAcceptance
    case onboarding
    case main
    /// Bootstrap failed for a reason other than 401 (offline, server down): retry screen.
    case unavailable

    /// SHELL-001…004. A signed-in user whose bootstrap succeeded goes where `gate` says.
    public static func resolve(hasToken: Bool, bootstrap: MeBootstrap?) -> AppRoute {
        guard hasToken else { return .signedOut }
        guard let bootstrap else { return .launching }
        switch bootstrap.gate {
        case .accountDeactivated: return .accountDeactivated
        case .legalAcceptanceRequired: return .legalAcceptance
        case .onboardingRequired: return .onboarding
        case .unknown:
            // Unknown future gate: fall back to the documented fields in the same order.
            if bootstrap.account.deactivated { return .accountDeactivated }
            if bootstrap.onboarding.completed && bootstrap.legal.needsAcceptance { return .legalAcceptance }
            return bootstrap.onboarding.completed ? .main : .onboarding
        case nil: return .main
        }
    }
}

/// Supported product countries, languages and currencies (user.md "Enums"; web `COUNTRY_LANGUAGES`,
/// `SUPPORTED_CURRENCIES`). Same names on Android (`LocaleRules`).
public enum LocaleRules {
    public static let countries = ["IT", "DE"]
    public static let currencies = ["EUR", "USD", "GBP", "CHF"]
    public static let defaultCurrency = "EUR"

    /// IT → it, en; DE → en, de (SHELL-006, SET-017).
    public static func languages(country: String) -> [String] {
        country == "DE" ? ["en", "de"] : ["it", "en"]
    }

    /// AUTH-027 / SET-017: switching to a country that doesn't support the current language selects English.
    public static func languageAfterSwitching(to country: String, current: String) -> String {
        languages(country: country).contains(current) ? current : "en"
    }

    /// SHELL-006: DE only when stored as `DE`, otherwise IT.
    public static func resolveCountry(_ stored: String?) -> String { stored == "DE" ? "DE" : "IT" }

    /// Country label (Italian source, translate with the catalog).
    public static func countryLabel(_ country: String) -> String { country == "DE" ? "Germania" : "Italia" }

    /// AUTH-060 / SET-017 (web #397): every language, in the list order of the chooser.
    public static let allLanguages = ["it", "en", "de"]

    /// The country that offers `language` («Disponibile col paese {0}» for the greyed ones).
    public static func countryOf(_ language: String) -> String? { countries.first { languages(country: $0).contains(language) } }

    /// Sample amount of the preview: how numbers look in a language, not the user's money (never masked).
    public static let previewAmount = 1234.56

    /// «20 ott 2026 · 1.234,56 €»: today's date and the sample amount as `language` writes them.
    public static func languagePreview(_ language: String, currency: String, today: CalendarDate) -> String {
        let locale = BBLocale(language: BBLanguage(rawValue: language) ?? .it)
        let date = BBFormat.formatDate(today, .dMMMy, locale: locale)
        return "\(date) · \(BBFormat.formatCurrency(previewAmount, currency: currency, locale: locale))"
    }

    /// Native language names (shown untranslated, like the web's `LANGUAGE_NAMES`).
    public static func languageName(_ language: String) -> String {
        switch language {
        case "en": "English"
        case "de": "Deutsch"
        default: "Italiano"
        }
    }

    /// Currency label (Italian source) and symbol, for the onboarding tiles and the Settings select.
    public static func currencyLabel(_ currency: String) -> String {
        switch currency {
        case "USD": "Dollaro USA"
        case "GBP": "Sterlina britannica"
        case "CHF": "Franco svizzero"
        default: "Euro"
        }
    }

    public static func currencySymbol(_ currency: String) -> String {
        switch currency {
        case "USD": "$"
        case "GBP": "£"
        case "CHF": "CHF"
        default: "€"
        }
    }
}
