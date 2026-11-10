import BuddyBudgetKit
import SwiftUI

/// «Aiuto e segnalazioni» (`/aiuto`, SUP-001…007): status line, then Scrivici (report form), Risposte rapide (FAQ) and
/// Su GitHub. `?da=` / `?tipo=` arrive through `ShellModel.helpLaunch`. Twin of `HelpScreen` on Android.
struct HelpScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openURL) private var openURL
    @State private var launch: HelpLaunch?
    @State private var model: ReportFormModel?
    @State private var openFaq: Set<String> = []

    var body: some View {
        BBScreen(title: L10n.lookup(italian: "Aiuto e segnalazioni"), onBack: back) {
            let context = ReportContextFactory.make(path: (launch ?? HelpLaunch()).contextPath, scheme: scheme)
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                if debugShows(0) { intro }
                if debugShows(1) {
                    HelpSection(icon: .messageSquare, title: L10n.lookup(italian: "Scrivici"),
                                description: L10n.lookup(italian: "Un problema, una domanda o un'idea: ti rispondiamo via email.")) {
                        if let model { ReportFormView(model: model, context: context) }
                    }
                }
                if debugShows(2) {
                    HelpSection(icon: .circleQuestionMark, title: L10n.lookup(italian: "Risposte rapide"),
                                description: L10n.lookup(italian: "Le domande che riceviamo più spesso.")) {
                        faq
                    }
                }
                HelpSection(image: Image("github-mark"), title: L10n.lookup(italian: "Su GitHub"),
                            description: L10n.lookup(italian: "BuddyBudget è open source: puoi seguire e segnalare anche da lì.")) {
                    githubLinks(context)
                }
            }
        }
        .onAppear {
            guard model == nil else { return }
            let next = shell.takeHelpLaunch() ?? HelpLaunch()
            launch = next
            let form = ReportFormModel(api: env.quickReport.api, source: .pagina, initialKind: next.kind)
            model = form
            #if DEBUG
            form.applyDebugLaunch(context: ReportContextFactory.make(path: next.contextPath, scheme: scheme))
            if let id = DebugLaunch.value("-BBFaqOpen") { openFaq = [id] }
            #endif
        }
    }

    /// Subtitle and the service-status line (SUP-004).
    private var intro: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(L10n.lookup(italian: "Puoi scriverci anche da qualsiasi pagina, con l'icona del fumetto, e dai messaggi d'errore."),
                   style: BBTypography.body, color: .bbMutedForeground)
            BBLinkText(parts: [
                .text(L10n.lookup(italian: "L'app è lenta o non risponde? Guarda prima lo") + " "),
                .link(L10n.lookup(italian: "stato del servizio"), URL(string: Support.statusURL)!),
                .text("."),
            ], style: BBTypography.body, color: .bbMutedForeground, linkColor: .bbForeground, linkWeight: 500)
        }
    }

    /// SUP-006: each answer opens and closes on its own.
    private var faq: some View {
        VStack(spacing: 0) {
            ForEach(Support.faq) { item in
                let open = openFaq.contains(item.id)
                VStack(alignment: .leading, spacing: 0) {
                    Button {
                        if open { openFaq.remove(item.id) } else { openFaq.insert(item.id) }
                    } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBText(L10n.lookup(italian: item.question), style: BBTypography.bodyStrong)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .multilineTextAlignment(.leading)
                            BBIconView(.plus, size: .md, color: .bbMutedForeground)
                                .rotationEffect(.degrees(open ? 45 : 0))
                                .animation(.easeOut(duration: BBMotion.durationFast), value: open)
                        }
                        .frame(minHeight: 36)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(open ? [.isButton, .isSelected] : .isButton)
                    if open {
                        BBText(L10n.lookup(italian: item.answer), style: BBTypography.body, color: .bbMutedForeground)
                            .padding(.top, BBSpacing.space2)
                            .padding(.trailing, BBSpacing.space6)
                    }
                }
                .padding(.vertical, BBSpacing.space3)
            }
        }
    }

    /// SUP-007: the four external links with their hints, opened in the browser.
    private func githubLinks(_ context: ReportContext) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            ForEach(Support.githubLinks(context: context)) { link in
                Button {
                    if let url = URL(string: link.href) { openURL(url) }
                } label: {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: BBSpacing.space1_5) {
                            if link.id == .issue {
                                Image("github-mark").renderingMode(.template).resizable().frame(width: 16, height: 16)
                                    .foregroundStyle(Color.bbForeground)
                            }
                            BBText(L10n.lookup(italian: link.label), style: BBTypography.bodyStrong)
                            BBIconView(.externalLink, points: 14, color: .bbMutedForeground)
                        }
                        BBText(L10n.lookup(italian: link.hint), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                    .padding(.vertical, BBSpacing.space1)
                    .frame(maxWidth: .infinity, minHeight: BBLayout.minTouchTarget, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint(L10n.lookup(italian: "(si apre in una nuova scheda)"))
            }
        }
    }
}

/// Open section of the help page (web `Section`): title in the display face, description text-sm muted, gap 16.
private struct HelpSection<Content: View>: View {
    var icon: BBIcon?
    var image: Image?
    let title: String
    let description: String
    @ViewBuilder let content: () -> Content

    init(icon: BBIcon, title: String, description: String, @ViewBuilder content: @escaping () -> Content) {
        self.icon = icon
        self.title = title
        self.description = description
        self.content = content
    }

    init(image: Image, title: String, description: String, @ViewBuilder content: @escaping () -> Content) {
        self.image = image
        self.title = title
        self.description = description
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            // #427: the title stands alone, no icon tile (`icon`/`image` are kept for the call sites).
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(title, style: BBTextStyle.sectionHeading).accessibilityAddTraits(.isHeader)
                BBText(description, style: BBTypography.body, color: .bbMutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            content()
        }
    }
}
