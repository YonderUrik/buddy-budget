import BuddyBudgetKit
import SwiftUI

/// Top-level router: one screen per `AppRoute` (SHELL-001…004, AUTH-022). Re-reads the bootstrap when the app comes
/// back to the foreground (api/auth.md §3.5).
struct RootView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        content
            .animation(.easeInOut(duration: BBMotion.durationFast), value: env.session.route)
            .task {
                #if DEBUG
                DebugLaunch.apply(to: env)
                #endif
                await env.session.launch()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active, env.session.route != .signedOut, env.session.route != .launching {
                    Task { await env.session.refresh() }
                }
            }
    }

    /// DEBUG `-BBRoute onboarding`: shows the onboarding wizard for a signed-in account (screenshots only).
    private var route: AppRoute {
        #if DEBUG
        if env.session.route == .main, DebugLaunch.value("-BBRoute") == "onboarding" { return .onboarding }
        #endif
        return env.session.route
    }

    @ViewBuilder private var content: some View {
        switch route {
        case .launching:
            LaunchView()
        case .signedOut:
            LoginScreen()
        case .onboarding:
            OnboardingScreen().id(env.session.generation)
        case .legalAcceptance:
            LegalAcceptanceScreen()
        case .accountDeactivated:
            DeactivatedScreen()
        case .main:
            AppShell().id(env.session.generation)
        case .unavailable:
            UnavailableScreen()
        }
    }
}

/// Launch placeholder: background + spinner while the token and bootstrap are read.
private struct LaunchView: View {
    var body: some View {
        VStack(spacing: BBSpacing.space4) {
            BBLogoMark(height: 48)
            BBSpinner(size: .lg, color: .bbText3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.bbBackground.ignoresSafeArea())
        .accessibilityElement()
        .accessibilityLabel(L10n.loading)
    }
}

/// Bootstrap failed for a non-auth reason (offline, server down): retry or sign out.
private struct UnavailableScreen: View {
    @Environment(AppEnvironment.self) private var env
    @State private var retrying = false

    var body: some View {
        AuthScaffold(showsLanguagePicker: false) {
            VStack(alignment: .leading, spacing: BBSpacing.space6) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.serverUnreachable, style: BBTypography.pageTitle)
                    BBText(L10n.offlineMessage, style: BBTypography.bodyLarge, color: .bbText2)
                }
                VStack(spacing: BBSpacing.space3) {
                    BBButton(L10n.retry, size: .touch, fullWidth: true, isLoading: retrying) {
                        retrying = true
                        Task {
                            await env.session.refresh()
                            retrying = false
                        }
                    }
                    BBButton(L10n.signOut, variant: .outline, size: .touch, fullWidth: true) {
                        Task { await env.session.signOut() }
                    }
                }
            }
        }
    }
}
