import BuddyBudgetKit
import SwiftUI

/// Sign-in with an emailed 6-digit code (AUTH-001…010, decision 0003: Google/Apple not shown yet).
/// Step 1: email; step 2: «Controlla la tua email» with the code field, resend countdown and «Usa un'altra email».
struct LoginScreen: View {
    @Environment(AppEnvironment.self) private var env
    @State private var model: LoginModel?
    /// AUTH-059: the account remembered on this device.
    @State private var remembered: String?

    var body: some View {
        AuthScaffold {
            if let model {
                if model.step == .email, let returning = remembered, !env.session.accountDeletedNotice {
                    ReturningStep(model: model, email: returning, legal: env.session.legal) {
                        env.preferences.remove(ReturningUser.key)
                        remembered = nil
                        model.email = ""
                    }
                } else {
                    switch model.step {
                    case .email: EmailStep(model: model, legal: env.session.legal)
                    case .code: CodeStep(model: model)
                    }
                }
            }
        }
        .task {
            if model == nil {
                let session = env.session
                let preferences = env.preferences
                remembered = ReturningUser.parse(preferences.string(ReturningUser.key))
                let created = LoginModel(auth: env.auth, email: session.prefillEmail) { email in
                    // AUTH-059: remember the account on this device for «Rientra in BuddyBudget».
                    preferences.setString(ReturningUser.key, email)
                    await session.signedIn()
                }
                model = created
                #if DEBUG
                if let code = DebugLaunch.value("-BBCode") {
                    created.debugEnterCode(code)
                } else if DebugLaunch.flag("-BBAutoSend") {
                    await created.sendCode()
                }
                #endif
            }
            _ = await env.session.loadLegal()
        }
    }
}

/// AUTH-059: «Rientra in BuddyBudget» — the remembered account, one button for the code, «Non sei tu?».
private struct ReturningStep: View {
    @Bindable var model: LoginModel
    let email: String
    let legal: LegalMeta?
    let onForget: () -> Void

    var body: some View {
        let masked = ReturningUser.mask(email)
        VStack(alignment: .leading, spacing: BBSpacing.space7) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                BBText(L10n.signBackInToBuddybudget, style: .loginTitle).accessibilityAddTraits(.isHeader)
                BBText(L10n.weRememberYourAccountOnThisDevice, style: BBTypography.bodyLarge, color: .bbText2)
            }
            HStack(spacing: BBSpacing.space3) {
                BBText(String(masked.prefix(1)).uppercased(), style: BBTypography.cardTitle)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.bbMuted))
                VStack(alignment: .leading, spacing: 0) {
                    BBText(masked, style: BBTypography.bodyStrong, lineLimit: 1)
                    BBText(L10n.lastSignedInWithTheEmailedCode, style: BBTypography.body, color: .bbText3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, BBSpacing.space4)
            .padding(.vertical, BBSpacing.space3_5)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbBackground))
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBButton(model.sending ? L10n.sending_c05ed4 : L10n.sendMeTheCode, variant: .sun, size: .touch, fullWidth: true,
                         isLoading: model.sending, isDisabled: model.busy) {
                    model.email = email
                    Task { await model.sendCode() }
                }
                if let failure = model.failure {
                    BBText(L10n.lookup(italian: failure.message), style: BBTypography.body, color: .bbDestructive)
                } else {
                    BBText(L10n.theCodeGoesToThisAddressAndIsVal(String(AuthAPI.codeValidityMinutes)), style: BBTypography.body, color: .bbText3)
                }
                BBButton(L10n.notYouUseAnotherAccount, variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.busy, action: onForget)
            }
            LegalNote(legal: legal)
        }
    }
}

/// The terms line under the sign-in actions.
private struct LegalNote: View {
    let legal: LegalMeta?

    var body: some View {
        BBLinkText(parts: [
            .text(L10n.byContinuingYouAcceptThe + " "),
            .link(L10n.termsOfService, URL(string: ExternalLinks.legal("termini", meta: legal))!),
            .text(" " + L10n.andConfirmYouHaveReadThe + " "),
            .link(L10n.privacy, URL(string: ExternalLinks.legal("privacy", meta: legal))!),
            .text(L10n.weOnlyUse + " "),
            .link(L10n.technicalTools, URL(string: ExternalLinks.legal("cookie", meta: legal))!),
            .text("."),
        ], alignment: .center)
        .frame(maxWidth: .infinity)
    }
}

private struct EmailStep: View {
    @Bindable var model: LoginModel
    let legal: LegalMeta?
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space7) {
            if env.session.accountDeletedNotice {
                BBText(L10n.yourAccountAndAllYourDataHaveBeen, style: BBTypography.body, color: .bbText2)
                    .padding(.leading, BBSpacing.space3)
                    .overlay(alignment: .leading) { Rectangle().fill(Color.bbPrimary).frame(width: 2) }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                BBText("\(L10n.signInTo) \(L10n.appName)", style: .loginTitle)
                    .accessibilityAddTraits(.isHeader)
                BBText(L10n.aCodeByEmailNoPasswordIfItSYour, style: BBTypography.bodyLarge, color: .bbText2)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBTextField(label: L10n.email, text: $model.email, placeholder: L10n.nameExampleCom, keyboard: .email,
                            isDisabled: model.busy, height: BBLayout.minTouchTarget, contentType: .email, submitLabel: .send,
                            onSubmit: { Task { await model.sendCode() } }, autofocus: true)
                if let failure = model.failure {
                    BBText(L10n.lookup(italian: failure.message), style: BBTypography.body, color: .bbDestructive)
                } else {
                    BBText(L10n.theCodeIsValidFor0MinutesAndWork(String(AuthAPI.codeValidityMinutes)),
                           style: BBTypography.body, color: .bbText3)
                }
                BBButton(model.sending ? L10n.sending_c05ed4 : L10n.sendMeTheCode, variant: .sun, size: .touch, fullWidth: true,
                         isLoading: model.sending, isDisabled: model.busy) {
                    Task { await model.sendCode() }
                }
                .padding(.top, BBSpacing.space3)
            }
            BBLinkText(parts: [
                .text(L10n.byContinuingYouAcceptThe + " "),
                .link(L10n.termsOfService, URL(string: ExternalLinks.legal("termini", meta: legal))!),
                .text(" " + L10n.andConfirmYouHaveReadThe + " "),
                .link(L10n.privacy, URL(string: ExternalLinks.legal("privacy", meta: legal))!),
                .text(L10n.weOnlyUse + " "),
                .link(L10n.technicalTools, URL(string: ExternalLinks.legal("cookie", meta: legal))!),
                .text("."),
            ], alignment: .center)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct CodeStep: View {
    @Bindable var model: LoginModel

    var body: some View {
        VStack(spacing: 0) {
            BBIconView(.mailCheck, points: 28, color: .bbPos)
                .frame(width: 56, height: 56)
                .background(Circle().fill(Color.bbPosSoft))
                .padding(.bottom, BBSpacing.space6)
            BBText(L10n.checkYourEmail, style: .authTitle)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            BBText(L10n.weSentASignInCodeTo0ItStaysVal(model.normalizedEmail, String(AuthAPI.codeValidityMinutes)),
                   style: BBTypography.bodyLarge, color: .bbText2)
                .multilineTextAlignment(.center)
                .padding(.top, BBSpacing.space3)
            BBText(L10n.cannotFindItCheckYourSpamFolderTo, style: BBTypography.body, color: .bbText3)
                .multilineTextAlignment(.center)
                .padding(.top, BBSpacing.space2)

            OneTimeCodeField(code: Binding(get: { model.code }, set: { model.updateCode($0) }),
                             label: L10n.signInCode, isError: model.failure != nil, isDisabled: model.verifying)
                .padding(.top, BBSpacing.space8)
            if let failure = model.failure {
                BBText(L10n.lookup(italian: failure.message), style: BBTypography.body, color: .bbDestructive)
                    .multilineTextAlignment(.center)
                    .padding(.top, BBSpacing.space3)
            }

            VStack(spacing: BBSpacing.space2) {
                BBButton(model.verifying ? L10n.checking_0a76c7 : L10n.signIn_98745f, variant: .sun, size: .touch, fullWidth: true,
                         isLoading: model.verifying, isDisabled: !SignIn.isCompleteCode(model.code)) {
                    Task { await model.verify() }
                }
                let remaining = model.resendRemaining
                BBButton(remaining > 0 ? L10n.resendIn0S(String(remaining)) : L10n.resendCode, variant: .outline, size: .touch,
                         fullWidth: true, isLoading: model.sending, isDisabled: remaining > 0 || model.busy) {
                    Task { await model.resend() }
                }
                BBButton(L10n.useAnotherEmail, variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.busy) {
                    model.useAnotherEmail()
                }
            }
            .padding(.top, BBSpacing.space6)
        }
        .frame(maxWidth: .infinity)
    }
}

/// The 6-digit code field: one input with the one-time-code autofill hint (Mail / Messages suggest the code from the
/// email subject), digits only, large monospaced digits. Same look as `OneTimeCodeField` on Android.
struct OneTimeCodeField: View {
    @Binding var code: String
    var label: String
    var isError = false
    var isDisabled = false
    var autofocus = true

    @FocusState private var focused: Bool
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        TextField("", text: $code, prompt: Text(verbatim: "000000").foregroundStyle(Color.bbAlphaMutedForeground30))
            .font(.custom(BBTextStyle.codeDigits.postScriptName, size: 28))
            .tracking(10)
            .multilineTextAlignment(.center)
            .keyboardType(.numberPad)
            .textContentType(.oneTimeCode)
            .foregroundStyle(Color.bbForeground)
            .tint(.bbPrimary)
            .focused($focused)
            .frame(height: 56)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.bbBackground))
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(isError ? Color.bbDestructive : (focused ? Color.bbRing : Color.bbInput), lineWidth: 1))
            .background(RoundedRectangle.bb(BBRadius.xl + 3).stroke(focused ? Color.bbAlphaRing50 : .clear, lineWidth: 3).padding(-1.5))
            .bbDisabled(isDisabled)
            .accessibilityLabel(label)
            .task { if autofocus { focused = true } }
    }
}

extension BBTextStyle {
    /// Code digits: Hanken medium 28, tabular.
    static let codeDigits = BBTextStyle(role: .sans, size: 28, lineHeight: 36, weight: 500, letterSpacingEm: 0,
                                        tabularNums: true, uppercase: false, anchor: .title)
}
