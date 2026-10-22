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

    /// SHELL-056 (api/auth.md §3.5): a `403 legal_acceptance_required` / `account_deactivated` from ANY call while
    /// signed in routes straight to the gate screen (no generic load error), before the bootstrap confirms it.
    /// Nil for any other code, or when no session screen is showing (signed out, launching).
    public static func forGateError(_ code: APIErrorCode?, current: AppRoute) -> AppRoute? {
        if current == .signedOut || current == .launching { return nil }
        switch code {
        case .accountDeactivated: return .accountDeactivated
        // Legal re-acceptance applies after onboarding only (new users accept during onboarding).
        case .legalAcceptanceRequired: return current == .onboarding || current == .accountDeactivated ? nil : .legalAcceptance
        default: return nil
        }
    }

    /// SHELL-056: leaving a gate screen for the app reloads the shell (its data failed while the gate was up).
    public static func reloadsShell(previous: AppRoute, next: AppRoute) -> Bool {
        next == .main && (previous == .legalAcceptance || previous == .accountDeactivated)
    }
}

/// Supported product countries, languages and currencies (user.md "Enums"; web `COUNTRY_LANGUAGES`,
/// `SUPPORTED_CURRENCIES`). Same names on Android (`LocaleRules`).
public enum LocaleRules {
    /// Web `PRODUCT_COUNTRIES` (#465): `OTHER` is every country whose tax and pension rules the app does not model yet.
    public static let countries = ["IT", "DE", "OTHER"]
    public static let currencies = ["EUR", "USD", "GBP", "CHF"]
    public static let defaultCurrency = "EUR"

    /// Web `COUNTRY_LANGUAGES`: IT → it, en; DE → en, de; OTHER → en, it, de (SHELL-006, SET-017).
    public static func languages(country: String) -> [String] {
        switch country {
        case "DE": ["en", "de"]
        case "OTHER": ["en", "it", "de"]
        default: ["it", "en"]
        }
    }

    /// AUTH-027 / SET-017: switching to a country that doesn't support the current language selects English.
    public static func languageAfterSwitching(to country: String, current: String) -> String {
        languages(country: country).contains(current) ? current : "en"
    }

    /// SHELL-006 (web `resolveProfile`): `DE` and `OTHER` as stored, anything else IT.
    public static func resolveCountry(_ stored: String?) -> String {
        if let stored, stored == "DE" || stored == "OTHER" { return stored }
        return "IT"
    }

    /// Country label (web `PRODUCT_COUNTRY_NAMES`, Italian source, translate with the catalog).
    public static func countryLabel(_ country: String) -> String {
        switch country {
        case "DE": "Germania"
        case "OTHER": "Altro paese"
        default: "Italia"
        }
    }

    /// Web `COUNTRY_FLAGS`: the drawn flag next to each product country; `WORLD` is a globe for «Altro paese».
    public static func flagCode(_ country: String) -> String {
        switch country {
        case "DE": "DE"
        case "OTHER": "WORLD"
        default: "IT"
        }
    }

    /// Web `COUNTRY_UNAVAILABLE_MESSAGE` (SHELL-010): title of the country-unavailable screen and of the API error.
    public static let unavailableMessage = "Non ancora disponibile nel tuo paese. Arriverà presto."

    /// Web `COUNTRY_UNAVAILABLE_NOTES` (SHELL-010, SET-017, AUTH-027): what the country does not have yet; nil for IT.
    public static func unavailableNote(_ country: String) -> String? {
        switch country {
        case "DE": "Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati."
        case "OTHER": "Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona."
        default: nil
        }
    }

    /// Languages spoken in the countries that have one of ours; the first is the default (web `COUNTRY_LOCAL_LANGUAGES`).
    private static let localLanguages: [String: [String]] = [
        "IT": ["it"], "SM": ["it"], "VA": ["it"],
        "DE": ["de"], "AT": ["de"], "LI": ["de"],
        "CH": ["de", "it"],
    ]

    /// Web `productCountryFor`: Italy and Germany have their rules, every other region gets `OTHER`.
    public static func productCountryFor(_ region: String) -> String {
        let code = region.uppercased()
        return code == "IT" || code == "DE" ? code : "OTHER"
    }

    /// Web `detectLanguage`: the most preferred supported language of the device (`de-AT` counts as `de`); only
    /// unsupported languages → English; no preference at all → Italian.
    public static func detectLanguage(_ preferred: [String]) -> String {
        let primaries = preferred.map { tag in
            String(tag.lowercased().split(whereSeparator: { $0 == "-" || $0 == "_" }).first ?? "")
        }.filter { !$0.isEmpty && $0 != "*" }
        if primaries.isEmpty { return "it" }
        return primaries.first { allLanguages.contains($0) } ?? "en"
    }

    /// AUTH-061 (web `proposedProfile`/`detectProfile`, #465): country and language proposed to a user who has not
    /// finished onboarding. The device region stands in for the web's `CF-IPCountry`: IT/SM/VA → Italian, DE/AT/LI →
    /// German, CH → German or Italian following the device languages, anything else English; the product country is
    /// IT or DE only for those two regions, `OTHER` otherwise. Without a region the device language decides (German
    /// implies DE, else IT). A language picked by hand (`chosen`) wins, keeping the country when it offers it.
    public static func proposedProfile(region: String?, preferred: [String], chosen: String? = nil) -> (country: String, language: String) {
        let code = region?.trimmingCharacters(in: .whitespaces).uppercased()
        let valid = code.flatMap { $0.count == 2 && $0.allSatisfy({ $0.isASCII && $0.isLetter }) && $0 != "XX" && $0 != "ZZ" ? $0 : nil }
        let detected: (country: String, language: String)
        if let valid {
            let local = localLanguages[valid] ?? ["en"]
            let device = preferred.isEmpty ? nil : detectLanguage(preferred)
            detected = (productCountryFor(valid), device.flatMap { local.contains($0) ? $0 : nil } ?? local[0])
        } else {
            detected = profileForLanguage(detectLanguage(preferred))
        }
        guard let pick = chosen, allLanguages.contains(pick), pick != detected.language else { return detected }
        return languages(country: detected.country).contains(pick) ? (detected.country, pick) : profileForLanguage(pick)
    }

    /// Web `profileForLanguage`: German implies the German rules, anything else the Italian ones.
    public static func profileForLanguage(_ language: String) -> (country: String, language: String) {
        (language == "de" ? "DE" : "IT", language)
    }

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
