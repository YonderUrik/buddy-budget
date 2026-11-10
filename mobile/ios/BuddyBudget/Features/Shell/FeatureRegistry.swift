import BuddyBudgetKit
import SwiftUI

/// Route registry: the one place that maps a destination to its screen. Adding a feature screen = add its file and
/// replace the `PlaceholderScreen` line here. Twin of `FeatureRegistry` on Android.
@MainActor
enum FeatureRegistry {
    @ViewBuilder
    static func screen(for route: ShellRoute) -> some View {
        switch route {
        case .settingsGroup(let group):
            SettingsGroupScreen(group: group)
        case .instrument(let id):
            SecurityScreen(instrumentId: id)
        case .debt(let id):
            DebtDetailScreen(debtId: id)
        case .goal(let id):
            GoalDetailScreen(goalId: id)
        case .destination(let destination):
            switch destination {
            case .settings: SettingsScreen()
            case .countryUnavailable: CountryUnavailableScreen()
            case .overview: OverviewScreen()
            case .liquidity, .accounts, .spendingAnalysis, .subscriptions: LiquidityScreen()
            case .categories: CategoriesScreen(initialTab: .categories)
            case .rules: CategoriesScreen(initialTab: .rules)
            case .categorize: CategorizeScreen()
            case .imports: ImportsScreen()
            case .investments: InvestmentsScreen()
            case .debts: DebtsScreen()
            case .pension: PensionScreen()
            case .analytics: AnalyticsScreen()
            case .help: HelpScreen()
            }
        }
    }
}

/// Placeholder for an area whose screen arrives in a later phase.
struct PlaceholderScreen: View {
    let destination: AppDestination
    @Environment(\.shellBack) private var back

    var body: some View {
        BBScreen(title: L10n.lookup(italian: destination.title), onBack: back) {
            EmptyState(icon: destination.iconKey.flatMap(BBIcon.forKey) ?? .circleDashed, title: L10n.comingSoon,
                       description: L10n.thisSectionIsComingToTheAppSoon)
                .padding(.top, BBSpacing.space4)
        }
    }
}

/// SHELL-010 (web `/country-unavailable`, #465): a section the user's country does not have yet — the shared message,
/// the country's note, where to change the country, and links to Panoramica and Impostazioni.
struct CountryUnavailableScreen: View {
    @Environment(\.shellBack) private var back
    @Environment(ShellModel.self) private var shell
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        BBScreen(title: nil, onBack: back) {
            EmptyState(icon: .triangleAlert, title: L10n.lookup(italian: LocaleRules.unavailableMessage),
                       description: CountryUnavailableState.description(country: env.session.country),
                       primary: BBStateAction(label: L10n.overview) { shell.open(.overview) },
                       secondary: BBStateAction(label: L10n.settings) { shell.push(.destination(.settings)) }, color: .bbSwatchAmber)
                .padding(.top, BBSpacing.space4)
        }
    }
}

/// SHELL-011: a section's own «not in your country» state (its API answered `403 country_feature_unavailable`).
struct CountryUnavailableState: View {
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        EmptyState(icon: .triangleAlert, title: L10n.lookup(italian: LocaleRules.unavailableMessage),
                   description: Self.description(country: env.session.country), color: .bbSwatchAmber)
    }

    /// The country's note (if any) and where to change the country.
    static func description(country: String) -> String {
        [LocaleRules.unavailableNote(country).map { L10n.lookup(italian: $0) }, L10n.lookup(italian: "Il paese si cambia in Impostazioni.")]
            .compactMap { $0 }.joined(separator: "\n\n")
    }
}
