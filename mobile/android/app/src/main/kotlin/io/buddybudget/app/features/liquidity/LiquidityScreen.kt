package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.accounts.AccountsScreen
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.subscriptions.SubscriptionsScreen
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.domain.shell.LiquiditySegment

/** Selected Liquidità view and its setter; null outside the Liquidità frame. */
class LiquiditySegmentState(val selection: LiquiditySegment, val select: (LiquiditySegment) -> Unit)

val LocalLiquiditySegment = compositionLocalOf<LiquiditySegmentState?> { null }

/**
 * Liquidità section frame (TX-001): one root screen whose views are segments. Each view is its own screen
 * (`BBScreen` titled «Liquidità») and puts `LiquiditySegmentBar()` first in its content, so it keeps its own
 * refresh, actions and sheets. Twin of `LiquidityScreen` on iOS.
 */
@Composable
fun LiquidityScreen() {
    val shell = LocalShell.current
    CompositionLocalProvider(LocalLiquiditySegment provides LiquiditySegmentState(shell.liquiditySegment) { shell.liquiditySegment = it }) {
        when (shell.liquiditySegment) {
            LiquiditySegment.Movements -> MovementsScreen()
            LiquiditySegment.Analysis -> AnalysisScreen()
            LiquiditySegment.Accounts -> AccountsScreen()
            LiquiditySegment.Subscriptions -> SubscriptionsScreen()
        }
    }
}

/**
 * Liquidità heading (web `LiquidityHeader` on the phone, #405/#427): the current view as the title, opening the views
 * sheet (the four views plus «Categorie e regole»), and the yellow «Aggiungi» button with the add menu ([trailing]).
 * Renders nothing outside the Liquidità frame.
 */
@Composable
fun LiquiditySegmentBar(trailing: @Composable () -> Unit = { LiquidityAddButton(LocalShell.current.liquidity) }) {
    val state = LocalLiquiditySegment.current ?: return
    val shell = LocalShell.current
    val items = LiquiditySegment.entries.map { view ->
        io.buddybudget.app.designsystem.components.SectionViewItem(
            view.name, tr(view.title), tr(view.viewDescription), BBIcon.forKey(view.iconKey), view == state.selection,
        ) { state.select(view) }
    } + io.buddybudget.app.designsystem.components.SectionViewItem(
        "categorie", l10n(R.string.categories_and_rules_d6e929), tr("Gruppi di spesa e regole automatiche"), BBIcon.Tags,
    ) { shell.push(io.buddybudget.app.features.shell.ShellRoute.Destination(io.buddybudget.core.domain.shell.AppDestination.Categories)) }
    io.buddybudget.app.designsystem.components.SectionViewsHeading(
        l10n(R.string.cash_84f6d5), items, Modifier.padding(top = BBSpacing.space4, bottom = BBSpacing.space4), trailing,
    )
}

/**
 * TX-022 (web #444): before the first account, Movimenti, Analisi and Abbonamenti say what they will show, with
 * «Aggiungi un conto» (new-account sheet in Conti) and «Importa un file» (Importazioni).
 */
@Composable
fun LiquidityNoAccountsState(segment: LiquiditySegment) {
    val shell = LocalShell.current
    val content = io.buddybudget.core.domain.shell.LiquidityNoAccounts.content(segment) ?: return
    EmptyState(
        BBIcon.forKey(content.iconKey) ?: BBIcon.Landmark, tr(content.title), tr(content.description),
        primary = io.buddybudget.app.designsystem.components.BBStateAction(tr("Aggiungi un conto")) { shell.open("/liquidita/conti?nuovo=1") },
        secondary = io.buddybudget.app.designsystem.components.BBStateAction(tr("Importa un file")) { shell.open(io.buddybudget.core.domain.shell.AppDestination.Imports) },
    )
}
