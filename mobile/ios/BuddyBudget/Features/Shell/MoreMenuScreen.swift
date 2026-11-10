import BuddyBudgetKit
import SwiftUI

/// «Altro» (SHELL-018…021), root of the fifth tab: account row, other sections, support, hide amounts, sign out,
/// «Il tuo quadro» (InsightsSection), legal links and version.
struct MoreMenuScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.openURL) private var openURL
    @State private var legal: LegalMeta?

    var body: some View {
        BBScreen(title: L10n.more_ef204e) {
            VStack(alignment: .leading, spacing: 0) {
                if InsightsSection.debugOnTop { InsightsSection() }
                accountRow
                let others = Navigation.otherSections(env.session.sections)
                if !others.isEmpty {
                    MoreSectionTitle(L10n.otherSections)
                    ForEach(others, id: \.self) { destination in
                        let icon = BBIcon.forKey(destination.iconKey ?? "") ?? .circleDashed
                        if destination.isLocked(in: env.session.sections) {
                            // SHELL-061: closed in the user's country — dimmed, «Presto», opens the explanation.
                            MoreRow(icon: icon, title: L10n.lookup(italian: destination.title),
                                    hint: L10n.lookup(italian: Navigation.lockHint), lockBadge: L10n.lookup(italian: Navigation.lockBadge)) {
                                shell.push(.destination(.countryUnavailable))
                            }
                        } else {
                            MoreRow(icon: icon, title: L10n.lookup(italian: destination.title),
                                    hint: destination.moreMenuHint.map { L10n.lookup(italian: $0) }) {
                                shell.push(.destination(destination))
                            }
                        }
                    }
                }
                MoreSectionTitle(L10n.support)
                MoreRow(icon: .slidersHorizontal, title: L10n.settings, hint: L10n.appearanceNotificationsPrivacyAndDat) {
                    shell.push(.destination(.settings))
                }
                MoreRow(icon: .lifeBuoy, title: L10n.helpAndFeedback, hint: L10n.questionsProblemsAndIdeas) {
                    shell.push(.destination(.help))
                }
                hideAmountsRow.padding(.top, BBSpacing.space2)
                if !InsightsSection.debugOnTop { InsightsSection() }

                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    Button { Task { await env.session.signOut() } } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBIconView(.logOut, size: .lg, color: .bbNeg)
                            BBText(L10n.signOut, style: BBTypography.bodyLarge.with(size: 15, weight: 500), color: .bbNeg)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(minHeight: 56)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
                    HStack(spacing: BBSpacing.space1) {
                        ForEach(ExternalLinks.legalDocuments, id: \.self) { id in
                            Button {
                                if let url = URL(string: ExternalLinks.legal(id, meta: legal)) { openURL(url) }
                            } label: {
                                BBText(legalLabel(id), style: BBTypography.caption, color: .bbText2)
                                    .padding(.horizontal, BBSpacing.space2)
                                    .frame(minHeight: BBLayout.minTouchTarget)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer(minLength: 0)
                        BBText(AppVersion.label, style: BBTypography.caption, color: .bbText3)
                            .accessibilityLabel(L10n.version0(AppVersion.label))
                    }
                    .padding(.horizontal, BBSpacing.space1)
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel(L10n.legalInformation)
                }
                .padding(.top, BBSpacing.space3)
                .padding(.top, BBSpacing.space4)
            }
        }
        .task { legal = await env.session.loadLegal() }
    }

    private func legalLabel(_ id: String) -> String {
        switch id {
        case "privacy": L10n.privacy
        case "termini": L10n.terms
        default: L10n.cookies_e4f819
        }
    }

    private var accountRow: some View {
        let name = env.session.bootstrap?.user.name ?? ""
        let display = name.isEmpty ? L10n.yourAccount_d59755 : name
        let email = env.session.bootstrap?.user.email
        return Button { shell.push(.destination(.settings)) } label: {
            HStack(spacing: BBSpacing.space3) {
                BBText(Initials.of(display), style: BBTypography.bodyStrong.with(weight: 600), color: .bbPrimaryForeground)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.bbPrimary))
                VStack(alignment: .leading, spacing: 0) {
                    BBText(display, style: BBTypography.bodyLarge.with(size: 15, lineHeight: 19, weight: 600), lineLimit: 1)
                    BBText(email ?? L10n.profileAndSettings, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                BBIconView(.settings, size: .lg, color: .bbText3)
            }
            .padding(.horizontal, BBSpacing.space3)
            .padding(.vertical, BBSpacing.space2)
            .frame(minHeight: 64)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted60))
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
    }

    private var hideAmountsRow: some View {
        HStack(spacing: BBSpacing.space3) {
            BBIconView(.eyeOff, size: .lg, color: .bbText2)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbMuted))
            VStack(alignment: .leading, spacing: 0) {
                BBText(L10n.hideAmounts, style: BBTypography.bodyLarge.with(size: 15, lineHeight: 19, weight: 600))
                BBText(L10n.usefulWhenSomeoneCanSeeYourScreen, style: BBTypography.caption, color: .bbText2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBSwitch(isOn: Binding(get: { env.privacy.hideAmounts }, set: { value in Task { await env.session.setHideAmounts(value) } }),
                     accessibilityLabel: L10n.hideAmounts)
        }
        .padding(.horizontal, BBSpacing.space3)
        .padding(.vertical, BBSpacing.space2)
        .frame(minHeight: 56)
    }
}

/// Group title in «Altro» (text-sm medium `--text-3`, pt 20 pb 4).
struct MoreSectionTitle: View {
    let title: String
    init(_ title: String) { self.title = title }

    var body: some View {
        BBText(title, style: BBTypography.bodyStrong, color: .bbText3)
            .padding(.horizontal, BBSpacing.space3)
            .padding(.top, BBSpacing.space5)
            .padding(.bottom, BBSpacing.space1)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Navigation row of «Altro» and the Settings hub: tinted icon tile 40, title 15 semibold, hint, chevron.
struct MoreRow: View {
    let icon: BBIcon
    let title: String
    var hint: String?
    var danger = false
    var badge: String? = nil
    /// SHELL-061: a section closed in the user's country (web locked `NavItem`): dimmed, muted badge, no chevron.
    var lockBadge: String? = nil
    let action: () -> Void

    var body: some View {
        let locked = lockBadge != nil
        Button(action: action) {
            HStack(spacing: BBSpacing.space3) {
                BBIconView(icon, size: .lg, color: locked ? .bbText3 : danger ? .bbNeg : .bbPrimary)
                    .frame(width: 40, height: 40)
                    .background(RoundedRectangle.bb(BBRadius.xl).fill(locked ? Color.bbMuted : danger ? Color.bbNegSoft : Color.bbAlphaPrimary10))
                VStack(alignment: .leading, spacing: 0) {
                    BBText(title, style: BBTypography.bodyLarge.with(size: 15, lineHeight: 19, weight: 600),
                           color: locked ? .bbText2 : danger ? .bbNeg : .bbForeground)
                    if let hint { BBText(hint, style: BBTypography.caption, color: .bbText2) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let badge {
                    BBText(badge, style: BBTypography.caption.with(weight: 700), color: .bbPrimaryForeground)
                        .padding(.horizontal, BBSpacing.space2).padding(.vertical, 2)
                        .background(Capsule().fill(Color.bbPrimary))
                }
                if let lockBadge {
                    BBText(lockBadge, style: BBTypography.caption.with(weight: 500), color: .bbText2)
                        .padding(.horizontal, BBSpacing.space2).padding(.vertical, 2)
                        .background(Capsule().fill(Color.bbMuted))
                } else {
                    BBIconView(.chevronRight, size: .md, color: .bbText3)
                }
            }
            .padding(.horizontal, BBSpacing.space3)
            .padding(.vertical, BBSpacing.space2)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
    }
}
