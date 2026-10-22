package io.buddybudget.app.features.shell

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.features.liquidity.LiquidityScreen
import io.buddybudget.app.features.overview.OverviewScreen
import io.buddybudget.app.features.categories.CategoriesScreen
import io.buddybudget.app.features.categories.CategoriesTab
import io.buddybudget.app.features.categorize.CategorizeScreen
import io.buddybudget.app.features.settings.SettingsGroupScreen
import io.buddybudget.app.features.settings.SettingsScreen
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.domain.shell.AppDestination

/**
 * Route registry: the one place that maps a destination to its screen. Adding a feature screen = add its file and
 * replace the `PlaceholderScreen` line here. Twin of `FeatureRegistry` on iOS.
 */
object FeatureRegistry {
    @Composable
    fun Screen(route: ShellRoute) {
        when (route) {
            is ShellRoute.SettingsGroupRoute -> SettingsGroupScreen(route.group)
            is ShellRoute.InstrumentRoute -> io.buddybudget.app.features.investments.SecurityScreen(route.instrumentId)
            is ShellRoute.DebtRoute -> io.buddybudget.app.features.debts.DebtDetailScreen(route.debtId)
            is ShellRoute.GoalRoute -> io.buddybudget.app.features.analytics.GoalDetailScreen(route.goalId)
            is ShellRoute.Destination -> when (route.destination) {
                AppDestination.Settings -> SettingsScreen()
                AppDestination.CountryUnavailable -> CountryUnavailableScreen()
                AppDestination.Overview -> OverviewScreen()
                AppDestination.Liquidity, AppDestination.Accounts, AppDestination.SpendingAnalysis, AppDestination.Subscriptions,
                -> LiquidityScreen()
                AppDestination.Categories -> CategoriesScreen(CategoriesTab.Categories)
                AppDestination.Rules -> CategoriesScreen(CategoriesTab.Rules)
                AppDestination.Categorize -> CategorizeScreen()
                AppDestination.Imports -> io.buddybudget.app.features.imports.ImportsScreen()
                AppDestination.Investments -> io.buddybudget.app.features.investments.InvestmentsScreen()
                AppDestination.Debts -> io.buddybudget.app.features.debts.DebtsScreen()
                AppDestination.Pension -> io.buddybudget.app.features.pension.PensionScreen()
                AppDestination.Analytics -> io.buddybudget.app.features.analytics.AnalyticsScreen()
                AppDestination.Help -> io.buddybudget.app.features.help.HelpScreen()
            }
        }
    }
}

/** Placeholder for an area whose screen arrives in a later phase. */
@Composable
fun PlaceholderScreen(destination: AppDestination) {
    BBScreen(tr(destination.title), onBack = LocalShellBack.current) {
        EmptyState(
            destination.iconKey?.let(BBIcon::forKey) ?: BBIcon.CircleDashed, l10n(R.string.coming_soon_b13ad3),
            l10n(R.string.this_section_is_coming_to_the_app_soon_490353), Modifier.padding(top = BBSpacing.space4),
        )
    }
}

/**
 * SHELL-010 (web `/country-unavailable`, #465): a section the user's country does not have yet — the shared message,
 * the country's note, where to change the country, and links to Panoramica and Impostazioni.
 */
@Composable
fun CountryUnavailableScreen() {
    val shell = LocalShell.current
    val env = io.buddybudget.app.LocalEnv.current
    val note = io.buddybudget.core.domain.shell.LocaleRules.unavailableNote(env.session.country)
    BBScreen(null, onBack = LocalShellBack.current) {
        EmptyState(
            BBIcon.TriangleAlert, tr(io.buddybudget.core.domain.shell.LocaleRules.UNAVAILABLE_MESSAGE),
            listOfNotNull(note?.let { tr(it) }, tr("Il paese si cambia in Impostazioni.")).joinToString("\n\n"),
            Modifier.padding(top = BBSpacing.space4),
            primary = BBStateAction(l10n(R.string.overview_f38c9a)) { shell.open(AppDestination.Overview) },
            secondary = BBStateAction(l10n(R.string.settings_8f710a)) { shell.push(ShellRoute.Destination(AppDestination.Settings)) },
            color = BuddyBudgetTheme.colors.swatchAmber,
        )
    }
}

/** SHELL-011: a section's own «not in your country» state (its API answered `403 country_feature_unavailable`). */
@Composable
fun CountryUnavailableState(modifier: Modifier = Modifier) {
    val env = io.buddybudget.app.LocalEnv.current
    val note = io.buddybudget.core.domain.shell.LocaleRules.unavailableNote(env.session.country)
    EmptyState(
        BBIcon.TriangleAlert, tr(io.buddybudget.core.domain.shell.LocaleRules.UNAVAILABLE_MESSAGE),
        listOfNotNull(note?.let { tr(it) }, tr("Il paese si cambia in Impostazioni.")).joinToString("\n\n"),
        modifier, color = BuddyBudgetTheme.colors.swatchAmber,
    )
}
