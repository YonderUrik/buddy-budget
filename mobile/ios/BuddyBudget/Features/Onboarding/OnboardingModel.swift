import BuddyBudgetKit
import Foundation
import Observation

/// State of the onboarding wizard (AUTH-024…043). Same fields as `OnboardingModel` on Android.
@MainActor @Observable
final class OnboardingModel {
    var country: String
    var language: String
    var currency = LocaleRules.defaultCurrency
    var categories: [CategoryProposalItem] = []
    private(set) var proposal: [CategoryProposalItem] = []
    var aiEnabled = false
    private(set) var aiAvailable = false
    var notifications = NotificationPreferences.defaults
    var consent = LegalConsent()
    private(set) var index = 0
    /// +1 forward, −1 back (step transition direction).
    private(set) var direction = 1
    private(set) var saving = false
    private(set) var error: String?
    private(set) var legal: LegalMeta?

    @ObservationIgnored private let env: AppEnvironment

    init(env: AppEnvironment) {
        self.env = env
        // AUTH-061: starts from the profile proposed for the device region (web `proposedProfile`, #465).
        let proposed = env.session.onboardingProfile ?? env.preferences.proposedProfile()
        country = LocaleRules.resolveCountry(proposed.country)
        language = AppLanguage.resolve(language: proposed.language, productCountry: proposed.country).rawValue
        rebuildProposal()
    }

    var steps: [OnboardingStep] { OnboardingStep.steps(aiAvailable: aiAvailable) }

    /// AUTH-058: «Cosa vuoi tenere sotto controllo?» (pension only where the pension section exists).
    var focus: [StartFocus] = []
    var focusOptions: [StartFocus] { StartFocus.options(pensionAvailable: country == "IT") }
    var step: OnboardingStep { steps[min(index, steps.count - 1)] }
    var isFirst: Bool { index == 0 }
    var isLast: Bool { index == steps.count - 1 }
    var customized: Bool { CategorySetup.isCustomized(categories, proposal: proposal) }
    var problem: CategorySetup.Problem? { CategorySetup.validate(categories) }

    func load() async {
        if let state = try? await env.user.aiCategorization() { aiAvailable = state.available }
        legal = await env.session.loadLegal()
    }

    #if DEBUG
    /// DEBUG `-BBOnboarding "country=DE,lang=en,step=2,consent,submit"`: drives the wizard for screenshots and the
    /// end-to-end check without touch input (simulator).
    func applyDebug(_ spec: String) async {
        for part in spec.split(separator: ",") {
            let kv = part.split(separator: "=", maxSplits: 1).map(String.init)
            switch kv[0] {
            case "country": setCountry(kv[1])
            case "lang": setLanguage(kv[1])
            case "currency": currency = kv[1]
            case "digest": notifications.digestEnabled = true
            case "step": index = min(Int(kv[1]) ?? 0, steps.count - 1)
            case "consent":
                consent.ageConfirmed = true
                consent.termsAccepted = true
                consent.specificClausesAccepted = true
            case "submit":
                index = steps.count - 1
                await next()
            default: break
            }
        }
    }
    #endif

    // MARK: Step 1

    /// AUTH-027 / AUTH-029 / AUTH-034: country switch may force English; the UI re-renders in the new language and the
    /// category proposal is rebuilt (customisations discarded).
    func setCountry(_ next: String) {
        guard next != country else { return }
        country = next
        language = LocaleRules.languageAfterSwitching(to: next, current: language)
        languageDidChange()
    }

    func setLanguage(_ next: String) {
        guard next != language else { return }
        language = next
        languageDidChange()
    }

    private func languageDidChange() {
        env.session.onboardingProfile = (country, language)
        env.session.applyLanguage(AppLanguage.resolve(language: language, productCountry: country))
        rebuildProposal()
        Task { legal = await env.session.loadLegal() }
    }

    private func rebuildProposal() {
        proposal = CategorySetup.localizedProposal(country: country) { L10n.lookup(italian: $0) }
        categories = proposal
    }

    // MARK: Categories (AUTH-031/032)

    func toggle(_ index: Int, _ on: Bool) { categories[index].enabled = on }

    /// Returns the translated reason when the name is rejected.
    func rename(_ index: Int, _ name: String) -> String? {
        message(CategorySetup.rename(&categories, at: index, to: name))
    }

    func add(type: String, name: String) -> String? {
        message(CategorySetup.add(&categories, type: type, name: name))
    }

    func resetCategories() { categories = proposal }

    func message(_ problem: CategorySetup.Problem?) -> String? {
        guard let problem else { return nil }
        return L10n.lookup(italian: problem.source, problem.value.map { ["0": $0] } ?? [:])
    }

    // MARK: Navigation

    func back() {
        guard !isFirst else { return }
        error = nil
        direction = -1
        index -= 1
    }

    func next() async {
        guard !isLast else {
            await submit()
            return
        }
        direction = 1
        index += 1
    }

    /// AUTH-039: `POST /api/user/onboarding`, then the session re-routes (AUTH-042).
    private func submit() async {
        let version = legal?.version ?? env.session.bootstrap?.legal.currentVersion ?? ""
        guard let legalPayload = consent.payload(version: version) else { return }
        saving = true
        error = nil
        let request = OnboardingRequest(
            currency: currency, productCountry: country, language: language, legal: legalPayload,
            notifications: notifications, categories: CategorySetup.payload(categories, proposal: proposal),
            aiCategorization: aiAvailable ? aiEnabled : nil,
            // A pension answer left over from a country change is dropped (AUTH-058).
            focus: focus.filter { focusOptions.contains($0) }.map(\.rawValue)
        )
        do {
            try await env.user.completeOnboarding(request)
            await env.session.refresh()
        } catch let api as APIError where api.isTransport {
            error = L10n.connectionFailedCheckYourNetworkAnd
        } catch {
            self.error = L10n.couldNotSaveYourPreferencesTryAgai
        }
        saving = false
    }
}
