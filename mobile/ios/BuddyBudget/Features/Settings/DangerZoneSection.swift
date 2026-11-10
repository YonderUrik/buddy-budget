import BuddyBudgetKit
import SwiftUI

/// Zona pericolosa (SET-042…049): reset, deactivate, delete — each with a confirmation sheet; recent login required.
struct DangerZoneSection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @Environment(AppEnvironment.self) private var env

    enum Action: Identifiable { case reset, deactivate, delete; var id: Self { self } }
    @State private var open: Action?
    @State private var pending = false

    var body: some View {
        SettingsSection(title: L10n.dangerZone, description: L10n.actionsThatDeleteYourDataWeAskYou, icon: .triangleAlert, danger: true) {
            row(L10n.resetAllData_8ef391, L10n.deleteAccountsTransactionsInvestments, L10n.reset, first: true) { open = .reset }
            row(L10n.deactivateAccount_c32247, L10n.yourAccountIsBlockedImmediatelyAnd(String(DangerConfirmation.deactivationGraceDays)),
                L10n.deactivate) { open = .deactivate }
            row(L10n.deleteYourAccount, L10n.immediatelyAndPermanentlyDeleteTheA, L10n.delete_6b177b) { open = .delete }
        }
        .bbSheet(isPresented: Binding(get: { open != nil }, set: { if !$0 && !pending { open = nil } })) {
            if let open {
                DangerDialog(action: open, model: model, email: settings.email, pending: $pending) { self.open = nil }
            }
        }
    }

    private func row(_ title: String, _ summary: String, _ trigger: String, first: Bool = false, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                BBText(title, style: BBTypography.bodyStrong)
                BBText(summary, style: BBTypography.caption, color: .bbMutedForeground)
            }
            BBButton(trigger, variant: .destructive, action: action)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, first ? 0 : BBSpacing.space4)
    }
}

/// The confirmation sheet: description, Reauth panel or the typed confirmation, server errors inside, confirm + Annulla.
private struct DangerDialog: View {
    let action: DangerZoneSection.Action
    @Bindable var model: SettingsModel
    let email: String
    @Binding var pending: Bool
    let onClose: () -> Void

    @Environment(AppEnvironment.self) private var env
    @State private var typed = ""
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBIconBadge(icon: .triangleAlert, color: .bbDestructive, diameter: 44, iconSize: 20)
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(title, style: BBTypography.cardTitle.with(lineHeight: 24)).accessibilityAddTraits(.isHeader)
                ForEach(paragraphs, id: \.self) { BBText($0, style: BBTypography.body, color: .bbMutedForeground) }
            }
            if !model.recentLogin {
                ReauthPanel(model: model, email: email) { error = nil }
            } else {
                confirmationField
                if let error { BBText(error, style: BBTypography.body, color: .bbNeg) }
            }
            VStack(spacing: BBSpacing.space2) {
                if model.recentLogin {
                    BBButton(confirmLabel, variant: .destructive, size: .touch, fullWidth: true, isLoading: pending,
                             isDisabled: !canConfirm) { confirm() }
                }
                BBButton(L10n.cancel, variant: .outline, size: .touch, fullWidth: true, isDisabled: pending, action: onClose)
            }
        }
        .interactiveDismissDisabled(pending)
    }

    private var title: String {
        switch action {
        case .reset: L10n.resetAllData_8a4c12
        case .deactivate: L10n.deactivateAccount_d64dfa
        case .delete: L10n.permanentlyDeleteAccount
        }
    }

    private var paragraphs: [String] {
        switch action {
        case .reset: [L10n.accountsTransactionsInvestmentsCatego_050c5e, L10n.yourAccountAndSignInMethodsRemain]
        case .deactivate:
            ["\(L10n.youWillBeSignedOutOfAllOtherDevi) \(DangerConfirmation.deactivationGraceDays) \(L10n.daysYourAccountAndAllDataWillBeP)",
             L10n.ifYouChangeYourMindSignInBeforeT]
        case .delete: [L10n.yourAccountAndAllDataAreDeletedIm, L10n.toKeepACopyDownloadYourDataFirst]
        }
    }

    private var confirmLabel: String {
        switch action {
        case .reset: L10n.resetEverything
        case .deactivate: L10n.deactivateAccount_3f5247
        case .delete: L10n.deletePermanently
        }
    }

    private var canConfirm: Bool {
        switch action {
        case .reset: DangerConfirmation.resetMatches(typed)
        case .deactivate: true
        case .delete: DangerConfirmation.deleteMatches(typed, email: email)
        }
    }

    @ViewBuilder private var confirmationField: some View {
        switch action {
        case .reset:
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText("\(L10n.write) \(DangerConfirmation.resetWord) \(L10n.toConfirm_7cbc30)", style: BBTypography.bodyStrong)
                BBTextField(text: $typed, keyboard: .email, isDisabled: pending)
                    .textInputAutocapitalization(.characters)
            }
        case .delete:
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.enterYourEmailToConfirm, style: BBTypography.bodyStrong)
                BBText(email, style: BBTypography.caption, color: .bbMutedForeground)
                BBTextField(text: $typed, keyboard: .email, isDisabled: pending)
            }
        case .deactivate:
            EmptyView()
        }
    }

    private func confirm() {
        pending = true
        error = nil
        Task {
            do {
                switch action {
                case .reset:
                    try await env.user.reset(confirmation: typed)
                    pending = false
                    onClose()
                    await env.session.refresh() // SET-044: onboarding restarts
                case .deactivate:
                    _ = try await env.user.deactivate()
                    pending = false
                    onClose()
                    await env.session.refresh() // SET-045: deactivated screen
                case .delete:
                    try await env.user.deleteAccount(email: typed.trimmingCharacters(in: .whitespaces))
                    pending = false
                    onClose()
                    env.session.accountDeleted() // SET-047: login with the notice
                }
            } catch {
                self.error = model.message(error)
            }
            pending = false
        }
    }
}

/// «Per sicurezza, conferma che sei tu» (SET-039…041), native variant: a new sign-in code to the account email,
/// entered here; the new session counts as recent. (Google re-auth needs the native SDK: deferred.)
struct ReauthPanel: View {
    @Bindable var model: SettingsModel
    let email: String
    var onDone: () -> Void = {}

    @Environment(AppEnvironment.self) private var env
    @State private var sent = false
    @State private var sending = false
    @State private var verifying = false
    @State private var code = ""
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBIconView(.shieldCheck, size: .lg, color: .bbPrimary).padding(.top, 2)
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.confirmYourIdentityForSecurity, style: BBTypography.bodyStrong)
                    BBText("\(L10n.thisActionRequiresASignInWithinTh) \(RecentLogin.maxAgeMinutes) \(L10n.minutesSignInAgainToReturnHere)",
                           style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            if sent {
                BBText(L10n.weSentACodeTo0EnterItToContinue(email), style: BBTypography.body)
                OneTimeCodeField(code: Binding(get: { code }, set: { code = SignIn.sanitizeCode($0) }), label: L10n.signInCode,
                                 isError: error != nil, isDisabled: verifying, autofocus: true)
                BBButton(L10n.confirmCode, size: .sm, isLoading: verifying, isDisabled: !SignIn.isCompleteCode(code)) { verify() }
            } else {
                BBButton(L10n.sendMeASignInCode, size: .sm, isLoading: sending) { send() }
            }
            if let error { BBText(error, style: BBTypography.body, color: .bbNeg) }
        }
        .padding(BBSpacing.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbAlphaMuted60))
    }

    private func send() {
        sending = true
        error = nil
        Task {
            do {
                try await env.auth.sendCode(email: SignIn.normalizeEmail(email))
                sent = true
            } catch {
                self.error = L10n.weCouldnTSendTheCodeTryAgainShor
            }
            sending = false
        }
    }

    private func verify() {
        verifying = true
        error = nil
        Task {
            do {
                try await env.auth.verifyCode(email: SignIn.normalizeEmail(email), code: code)
                await model.reauthenticated()
                onDone()
            } catch {
                self.error = L10n.lookup(italian: SignIn.verifyFailure(error).message)
                code = ""
            }
            verifying = false
        }
    }
}
