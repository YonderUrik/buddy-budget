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

/// SHELL-010: a path not available for the product country.
struct CountryUnavailableScreen: View {
    @Environment(\.shellBack) private var back
    @Environment(ShellModel.self) private var shell

    var body: some View {
        BBScreen(title: nil, onBack: back) {
            EmptyState(icon: .triangleAlert, title: L10n.thisFeatureIsNotAvailableForGerman,
                       description: L10n.forGermanyTaxEstimatesPensionsDivid,
                       primary: BBStateAction(label: L10n.overview) { shell.open(.overview) }, color: .bbSwatchAmber)
                .padding(.top, BBSpacing.space4)
        }
    }
}
