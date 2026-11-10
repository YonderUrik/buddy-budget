import BuddyBudgetKit
import SwiftUI

/// Demo-data banner (SHELL-048, OV-041/042): mounted once in the shell above the tab content, shown on every
/// authenticated screen while `GET /api/start` says `demoActive`. One-tap reset (as the web), snackbar afterwards.
/// Twin of `DemoBanner` on Android.
struct DemoBanner: View {
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let model = shell.overview
        if model.demoActive {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                HStack(alignment: .center, spacing: BBSpacing.space3) {
                    BBIconView(.flaskConical, size: .md, color: .bbPrimary)
                    (Text(verbatim: L10n.lookup(italian: "Dati d'esempio.")).font(BBTypography.body.with(weight: 600).font)
                        + Text(verbatim: " " + L10n.lookup(italian: "Quello che vedi è inventato. Azzera per aggiungere i tuoi conti e movimenti."))
                        .font(BBTypography.body.font))
                        .foregroundColor(.bbForeground)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                BBButton(model.demoClearing ? L10n.lookup(italian: "Azzero…") : L10n.lookup(italian: "Azzera e inizia"), size: .touch,
                         isDisabled: model.demoClearing) {
                    Task { await model.clearDemo() }
                }
                if let error = model.demoClearError {
                    BBText(error, style: BBTypography.body, color: .bbNeg)
                }
            }
            .padding(.horizontal, BBSpacing.space4)
            .padding(.vertical, BBSpacing.space3)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaPrimary5))
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbPrimary.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            .padding(.horizontal, BBSpacing.space4)
            .padding(.top, BBSpacing.space2)
            .accessibilityElement(children: .contain)
        }
    }
}

/// «Novità» chip next to the date (SHELL-049) opening a sheet with title, summary, `Non mostrare più` and the CTA
/// (SHELL-050). Twin of `WhatsNewChip` on Android.
struct WhatsNewChip: View {
    let entry: WhatsNewEntry
    let model: OverviewModel
    @Environment(ShellModel.self) private var shell
    @State private var open = Self.debugOpen
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// DEBUG `-BBSheet whatsnew` opens the sheet at launch for screenshots.
    private static var debugOpen: Bool {
        #if DEBUG
        DebugLaunch.value("-BBSheet") == "whatsnew"
        #else
        false
        #endif
    }

    var body: some View {
        Button { open = true } label: {
            HStack(spacing: BBSpacing.space1_5) {
                BBIconView(.sparkles, points: 14, color: .bbPrimary)
                    .rotationEffect(.degrees(appeared || reduceMotion ? 0 : -90))
                    .scaleEffect(appeared || reduceMotion ? 1 : 0.6)
                BBText(L10n.lookup(italian: "Novità:") + " " + entry.title, style: BBTypography.bodyStrong, color: .bbPrimary, lineLimit: 1)
            }
            .bbHitArea(height: 20)
        }
        .buttonStyle(.plain)
        .opacity(appeared || reduceMotion ? 1 : 0)
        .onAppear {
            guard !appeared else { return }
            withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.6).delay(0.6)) { appeared = true }
        }
        .bbSheet(isPresented: $open) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.sparkles, size: .md, color: .bbPrimary)
                    BBText(entry.title, style: BBTypography.cardTitle)
                }
                BBText(entry.summary, style: BBTypography.body.with(lineHeight: 23), color: .bbMutedForeground)
                HStack(spacing: BBSpacing.space2) {
                    BBButton(L10n.lookup(italian: "Non mostrare più"), variant: .ghost, size: .touch) {
                        open = false
                        model.dismissWhatsNew(entry.id)
                    }
                    Spacer(minLength: 0)
                    BBButton(entry.ctaLabel, size: .touch) {
                        open = false
                        shell.open(path: InAppLinks.nativePath(entry.href))
                    }
                }
                .padding(.top, BBSpacing.space1)
            }
            .padding(.bottom, BBSpacing.space4)
        }
    }
}
