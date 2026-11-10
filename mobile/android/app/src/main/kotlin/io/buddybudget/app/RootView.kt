package io.buddybudget.app

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBLogoMark
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.AuthScaffold
import io.buddybudget.app.features.auth.DeactivatedScreen
import io.buddybudget.app.features.auth.LegalAcceptanceScreen
import io.buddybudget.app.features.auth.LoginScreen
import io.buddybudget.app.features.onboarding.OnboardingScreen
import io.buddybudget.app.features.shell.AppShell
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.domain.shell.AppRoute
import kotlinx.coroutines.launch

/**
 * Top-level router: one screen per `AppRoute` (SHELL-001…004, AUTH-022). Re-reads the bootstrap when the app comes
 * back to the foreground (api/auth.md §3.5).
 */
@Composable
fun RootView(env: AppEnvironment) {
    val session = env.session
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { session.launch() }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (session.route != AppRoute.SignedOut && session.route != AppRoute.Launching) scope.launch { session.refresh() }
    }
    // DEBUG `--es bbRoute onboarding`: shows the onboarding wizard for a signed-in account (screenshots; no-op in release).
    val shown = if (session.route == AppRoute.Main && io.buddybudget.app.debug.DebugLaunch.value("bbRoute") == "onboarding") AppRoute.Onboarding else session.route
    Crossfade(shown, animationSpec = tween(BBMotion.durationFast), label = "route") { route ->
        when (route) {
            AppRoute.Launching -> LaunchView()
            AppRoute.SignedOut -> LoginScreen()
            AppRoute.Onboarding -> key(session.generation) { OnboardingScreen() }
            AppRoute.LegalAcceptance -> LegalAcceptanceScreen()
            AppRoute.AccountDeactivated -> DeactivatedScreen()
            AppRoute.Main -> key(session.generation) { AppShell() }
            AppRoute.Unavailable -> UnavailableScreen()
        }
    }
}

/** Launch placeholder: background + spinner while the token and bootstrap are read. */
@Composable
private fun LaunchView() {
    val c = BuddyBudgetTheme.colors
    val loading = l10n(L10n.loading)
    Column(
        Modifier.fillMaxSize().background(c.background).semantics { contentDescription = loading },
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space4, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BBLogoMark(48.dp)
        BBSpinner(20.dp, c.text3)
    }
}

/** Bootstrap failed for a non-auth reason (offline, server down): retry or sign out. */
@Composable
private fun UnavailableScreen() {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var retrying by remember { mutableStateOf(false) }
    AuthScaffold(showsLanguagePicker = false) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(L10n.serverUnreachable), BBTextStyle.PageTitle)
                BBText(l10n(L10n.offlineMessage), BBTextStyle.BodyLarge, color = c.text2)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBButton(l10n(L10n.retry), {
                    retrying = true
                    scope.launch { env.session.refresh(); retrying = false }
                }, size = BBButtonSize.Touch, fullWidth = true, isLoading = retrying)
                BBButton(l10n(io.buddybudget.app.R.string.sign_out_0f7014), { scope.launch { env.session.signOut() } },
                    variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
            }
        }
    }
}
