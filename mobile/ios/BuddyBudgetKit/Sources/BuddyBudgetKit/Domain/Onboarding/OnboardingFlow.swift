import Foundation

/// Steps of the onboarding (AUTH-024). Same cases on Android (`OnboardingStep`).
public enum OnboardingStep: String, CaseIterable, Sendable {
    case currency = "valuta"
    /// «Cosa vuoi tenere sotto controllo?» (AUTH-058, web #444).
    case interests = "interessi"
    case categories = "categorie"
    case assistant = "assistente"
    case notifications = "notifiche"
    case confirmations = "conferme"

    /// The assistant step exists only when the server has the AI service.
    public static func steps(aiAvailable: Bool) -> [OnboardingStep] {
        aiAvailable ? [.currency, .interests, .categories, .assistant, .notifications, .confirmations]
            : [.currency, .interests, .categories, .notifications, .confirmations]
    }
}

/// The email kinds of the notification choices (onboarding step and Settings › Notifiche).
public enum NotificationKind: String, CaseIterable, Sendable {
    case digest, budget, deadlines, goals

    /// Label (Italian source).
    public var label: String {
        switch self {
        case .digest: "Riepilogo periodico"
        case .budget: "Avvisi sul budget"
        case .deadlines: "Avvisi sulle scadenze"
        case .goals: "Promemoria sugli obiettivi"
        }
    }

    /// Hint in onboarding (`ONBOARDING_NOTIFICATION_INFO`).
    public var onboardingHint: String {
        switch self {
        case .digest: "Speso, entrato e investimenti, in poche righe."
        case .budget: "Quando una categoria si avvicina al limite del mese."
        case .deadlines: "Prima della rata di un finanziamento."
        case .goals: "A che punto sono i tuoi obiettivi di risparmio."
        }
    }

    /// Hint in Settings (`NOTIFICATION_KIND_INFO`).
    public var settingsHint: String {
        switch self {
        case .digest: "Entrate, uscite e investimenti del periodo appena concluso, in poche righe."
        case .budget: "Una email quando una categoria arriva all'80% del budget mensile e quando lo supera."
        case .deadlines: "Una email quando manca poco alla rata di un finanziamento, o quando è scaduta."
        case .goals: "A inizio mese a che punto sono i tuoi obiettivi, e una email quando ne raggiungi uno o quando la data si avvicina."
        }
    }

    public var iconKey: String {
        switch self {
        case .digest: "calendar-range"
        case .budget: "chart-pie"
        case .deadlines: "calendar-clock"
        case .goals: "target"
        }
    }

    public func isOn(_ preferences: NotificationPreferences) -> Bool {
        switch self {
        case .digest: preferences.digestEnabled
        case .budget: preferences.budgetAlertsEnabled
        case .deadlines: preferences.deadlineAlertsEnabled
        case .goals: preferences.goalAlertsEnabled
        }
    }

    public func set(_ on: Bool, in preferences: inout NotificationPreferences) {
        switch self {
        case .digest: preferences.digestEnabled = on
        case .budget: preferences.budgetAlertsEnabled = on
        case .deadlines: preferences.deadlineAlertsEnabled = on
        case .goals: preferences.goalAlertsEnabled = on
        }
    }

    public func patch(_ on: Bool) -> NotificationPreferencesPatch {
        switch self {
        case .digest: NotificationPreferencesPatch(digestEnabled: on)
        case .budget: NotificationPreferencesPatch(budgetAlertsEnabled: on)
        case .deadlines: NotificationPreferencesPatch(deadlineAlertsEnabled: on)
        case .goals: NotificationPreferencesPatch(goalAlertsEnabled: on)
        }
    }

    /// Onboarding offers digest, budget and deadlines (no goal reminders, AUTH-036).
    public static let onboarding: [NotificationKind] = [.digest, .budget, .deadlines]

    /// SET-023/024: goal reminders only where goals exist (hidden for DE).
    public static func settings(goalsAvailable: Bool) -> [NotificationKind] {
        goalsAvailable ? allCases : [.digest, .budget, .deadlines]
    }
}

/// One row of the «Nella tua casella» preview (AUTH-037): Italian sources plus the `{0}` values.
public struct InboxPreviewItem: Equatable, Sendable {
    public let kind: NotificationKind
    public let title: String
    public let when: String
    public let whenValues: [String]
}

public enum NotificationChoices {
    public static let budgetAlertThresholds = (80, 100)
    public static let deadlineAlertDaysBefore = 3

    /// Digest frequency labels: segmented control in onboarding, select in Settings.
    public static func onboardingLabel(_ frequency: DigestFrequency) -> String {
        frequency == .settimanale ? "Ogni settimana" : "Ogni mese"
    }

    public static func settingsLabel(_ frequency: DigestFrequency) -> String {
        frequency == .settimanale ? "Ogni settimana (lunedì)" : "Ogni mese (primi giorni)"
    }

    /// The emails that will arrive with these preferences, in display order (web `inboxPreview`).
    public static func inboxPreview(_ preferences: NotificationPreferences) -> [InboxPreviewItem] {
        var items: [InboxPreviewItem] = []
        if preferences.digestEnabled {
            let weekly = preferences.digestFrequency == .settimanale
            items.append(InboxPreviewItem(kind: .digest, title: weekly ? "Riepilogo della settimana" : "Riepilogo del mese",
                                          when: weekly ? "Ogni lunedì" : "Nei primi giorni del mese", whenValues: []))
        }
        if preferences.budgetAlertsEnabled {
            items.append(InboxPreviewItem(kind: .budget, title: NotificationKind.budget.label, when: "All'{0}% e al {1}% di un budget",
                                          whenValues: [String(budgetAlertThresholds.0), String(budgetAlertThresholds.1)]))
        }
        if preferences.deadlineAlertsEnabled {
            items.append(InboxPreviewItem(kind: .deadlines, title: NotificationKind.deadlines.label,
                                          when: "{0} giorni prima di una rata", whenValues: [String(deadlineAlertDaysBefore)]))
        }
        if preferences.goalAlertsEnabled {
            items.append(InboxPreviewItem(kind: .goals, title: NotificationKind.goals.label, when: "Nei primi giorni del mese",
                                          whenValues: []))
        }
        return items
    }
}
