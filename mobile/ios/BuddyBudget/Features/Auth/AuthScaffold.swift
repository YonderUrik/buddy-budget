import BuddyBudgetKit
import SwiftUI

/// Frame of the sign-in, onboarding, legal and deactivated screens (web `AuthFrame` on a phone): `--card` surface,
/// brand row with the language picker, the form centred vertically (max 400) and the links to the website at the
/// bottom (AUTH-015, AUTH-016). Same parameters as `AuthScaffold` on Android.
struct AuthScaffold<Content: View>: View {
    var showsLanguagePicker = true
    var showsFootLinks = true
    let content: Content

    init(showsLanguagePicker: Bool = true, showsFootLinks: Bool = true, @ViewBuilder content: () -> Content) {
        self.showsLanguagePicker = showsLanguagePicker
        self.showsFootLinks = showsFootLinks
        self.content = content()
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // #397: the language chooser moved from next to the brand to the end of the foot links.
                    HStack(spacing: BBSpacing.space4) {
                        BrandRow()
                        Spacer(minLength: 0)
                        if showsLanguagePicker && !showsFootLinks { LanguagePicker() }
                    }
                    Spacer(minLength: BBSpacing.space10)
                    content
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 400, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Spacer(minLength: BBSpacing.space10)
                    if showsFootLinks { AuthFootLinks(showsLanguagePicker: showsLanguagePicker) }
                }
                .padding(.horizontal, BBSpacing.space5)
                .padding(.top, BBSpacing.space6)
                .padding(.bottom, BBSpacing.space8)
                .frame(minHeight: proxy.size.height, alignment: .top)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollIndicators(.hidden)
        }
        .background(Color.bbCard.ignoresSafeArea())
    }
}

/// Logo mark + «BuddyBudget» (web `BrandLink`), opening the website.
private struct BrandRow: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let url = URL(string: ExternalLinks.landing) { openURL(url) }
        } label: {
            HStack(spacing: BBSpacing.space2_5) {
                BBLogoMark(height: 29)
                BBText(L10n.appName, style: BBTextStyle(role: .sans, size: 18, lineHeight: 28, weight: 700, letterSpacingEm: 0,
                                                         tabularNums: false, uppercase: false, anchor: .title3))
            }
            .bbHitArea(height: 29)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.lookup(italian: "{0}: torna al sito", ["0": L10n.appName]))
    }
}

/// Language selector of the auth screens (AUTH-015): Italiano / English / Deutsch, opens a sheet.
struct LanguagePicker: View {
    @Environment(AppEnvironment.self) private var env
    @State private var open = false

    var body: some View {
        let current = LocalizedStrings.shared.language
        Button { open = true } label: {
            HStack(spacing: BBSpacing.space1_5) {
                BBFlag(code: LanguagePicker.flag(current), size: .sm)
                BBText(LanguagePicker.name(current), style: BBTypography.caption, color: .bbText3)
            }
            .contentShape(Rectangle())
            .bbHitArea(height: 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.language)
        .accessibilityValue(LanguagePicker.name(current))
        .bbSheet(isPresented: $open, title: L10n.language) {
            VStack(spacing: BBSpacing.space1) {
                ForEach(AppLanguage.allCases, id: \.self) { language in
                    let selected = language == current
                    Button {
                        open = false
                        if env.session.route == .signedOut {
                            env.session.chooseSignedOutLanguage(language)
                        } else {
                            env.session.applyLanguage(language)
                        }
                    } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBFlag(code: LanguagePicker.flag(language), size: .lg)
                            BBText(LanguagePicker.name(language), style: BBTypography.bodyLarge)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if selected { BBIconView(.check, size: .md, color: .bbPrimary) }
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(background: selected ? .bbAccent : .clear, pressedBackground: .bbAccent,
                                                  shape: AnyShape(RoundedRectangle.bb(BBRadius.md)), translate: false))
                }
            }
        }
    }

    static func flag(_ language: AppLanguage) -> BBFlag.Code {
        switch language {
        case .it: .it
        case .en: .gb
        case .de: .de
        }
    }

    static func name(_ language: AppLanguage) -> String {
        switch language {
        case .it: L10n.italiano
        case .en: L10n.english
        case .de: L10n.deutsch
        }
    }
}

/// «Torna al sito · Sicurezza · Codice aperto · Aiuto» (AUTH-016).
struct AuthFootLinks: View {
    var showsLanguagePicker = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        FlowRow(spacing: BBSpacing.space4, lineSpacing: BBSpacing.space2) {
            link(L10n.backToWebsite, ExternalLinks.landing, icon: .arrowLeft)
            link(L10n.security_d480e3, ExternalLinks.security)
            link(L10n.openSource, ExternalLinks.openSource)
            link(L10n.help, ExternalLinks.help)
            if showsLanguagePicker { LanguagePicker() }
        }
        .accessibilityElement(children: .contain)
    }

    private func link(_ title: String, _ url: String, icon: BBIcon? = nil) -> some View {
        Button {
            if let url = URL(string: url) { openURL(url) }
        } label: {
            HStack(spacing: BBSpacing.space1) {
                if let icon { BBIconView(icon, points: 14, color: .bbText3) }
                BBText(title, style: BBTypography.caption, color: .bbText3)
            }
            .bbHitArea(height: 16)
        }
        .buttonStyle(.plain)
    }
}

/// Wrapping row (flex-wrap) for short links and chips.
struct FlowRow: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

/// Title of the sign-in pages (web `AUTH_TITLE`, #405): the landing's tall, light display face, 52 pt, leading 0.95.
extension BBTextStyle {
    static let authTitle = BBTypography.pageTitle.with(size: 52, lineHeight: 49)
    static let loginTitle = authTitle
}

/// The three legal declarations (AUTH-038 / AUTH-044): bordered box, checkbox + text with links.
struct LegalConsentFields: View {
    @Binding var consent: LegalConsent
    let legal: LegalMeta?
    var isDisabled = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            row($consent.ageConfirmed, label: L10n.iConfirmThatIAmAtLeast18YearsOl) {
                BBLinkText(parts: [.text(L10n.iConfirmThatIAmAtLeast18YearsOl)], style: BBTypography.body, color: .bbText2)
            }
            row($consent.termsAccepted, label: L10n.iAcceptThe, tapToggles: false) {
                BBLinkText(parts: [
                    .text(L10n.iAcceptThe + " "),
                    .link(L10n.termsOfService, url("termini")),
                    .text(" " + L10n.andConfirmIHaveReadThe + " "),
                    .link(L10n.privacy, url("privacy")),
                    .text(" " + L10n.andThePolicyOn + " "),
                    .link(L10n.cookies_59c826, url("cookie")),
                    .text("."),
                ], style: BBTypography.body, color: .bbText2)
            }
            row($consent.specificClausesAccepted, label: L10n.iSpecificallyApprovePursuantToArtic) {
                let sections = (legal?.specificClauseSections ?? [
                    "Responsabilità", "Sospensione e chiusura", "Modifiche ai termini", "Legge applicabile, foro e contatti",
                ].map { L10n.lookup(italian: $0) }).joined(separator: ", ")
                BBLinkText(parts: [.text(L10n.iSpecificallyApprovePursuantToArtic + " " + sections + ".")],
                           style: BBTypography.body, color: .bbText2)
            }
        }
        .padding(BBSpacing.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
    }

    private func url(_ id: String) -> URL { URL(string: ExternalLinks.legal(id, meta: legal))! }

    private func row(_ isOn: Binding<Bool>, label: String, tapToggles: Bool = true, @ViewBuilder text: () -> some View) -> some View {
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBCheckbox(isOn: isOn, accessibilityLabel: label, isDisabled: isDisabled)
                .padding(.top, 2)
            if tapToggles {
                text()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture { if !isDisabled { isOn.wrappedValue.toggle() } }
            } else {
                text().frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
