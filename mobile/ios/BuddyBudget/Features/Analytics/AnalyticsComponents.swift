import BuddyBudgetKit
import SwiftUI

// Building blocks of Analitiche (web components/domain/analytics/{analytics-card,question-section,explainer,term,
// glossed-text}.tsx). Android: AnalyticsComponents.kt.

/// Opens a glossary term or explainer in the bottom sheet (ANA-032).
private struct AnalyticsTermAction: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: (String) -> Void = { _ in }
}

extension EnvironmentValues {
    var analyticsTerm: (String) -> Void {
        get { self[AnalyticsTermAction.self] }
        set { self[AnalyticsTermAction.self] = newValue }
    }
}

/// Text with glossary terms underlined (dotted, `--primary @ 60%`); tapping a term opens its definition.
struct GlossedText: View {
    let parts: [AnalyticsTextPart]
    var style: BBTextStyle = BBTypography.bodyLarge
    var color: Color = .bbMutedForeground
    @Environment(\.analyticsTerm) private var openTerm

    init(_ parts: [AnalyticsTextPart], style: BBTextStyle = BBTypography.bodyLarge, color: Color = .bbMutedForeground) {
        self.parts = parts
        self.style = style
        self.color = color
    }

    var body: some View {
        Text(attributed)
            .bbTextStyle(style)
            .foregroundStyle(color)
            .tint(color)
            .fixedSize(horizontal: false, vertical: true)
            .environment(\.openURL, OpenURLAction { url in
                openTerm(url.host() ?? "")
                return .handled
            })
    }

    private var attributed: AttributedString {
        var out = AttributedString()
        for part in parts {
            switch part {
            case .text(let s):
                out += AttributedString(s)
            case .term(let id, let s):
                var t = AttributedString(s)
                t.link = URL(string: "bbterm://\(id)")
                t.underlineStyle = Text.LineStyle(pattern: .dot, color: Color.bbPrimary.opacity(0.6))
                t.foregroundColor = color
                out += t
            }
        }
        return out
    }
}

/// `Metric`: border-t, label (optionally a glossary term), value font-heading text-2xl tabular, note text-xs.
struct AnalyticsMetric: View {
    let label: String
    let value: String
    var sub: String?
    var tone: AnalyticsVerdict.Tone = .default
    var term: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let term {
                GlossedText([.term(id: term, text: label)], style: BBTypography.body)
            } else {
                BBText(label, style: BBTypography.body, color: .bbMutedForeground)
            }
            BBText(value, style: BBTypography.amountLarge, color: tone == .pos ? .bbPos : tone == .neg ? .bbNeg : .bbForeground)
                .monospacedDigit()
            if let sub { BBText(sub, style: BBTypography.caption, color: .bbMutedForeground) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, BBSpacing.space3)
    }
}

/// `AnalyticsCard`: rule, overline title, content, optional explainer.
struct AnalyticsBlock<Content: View>: View {
    let title: String
    var explainer: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(title, style: BBTypography.overline, color: .bbMutedForeground).accessibilityAddTraits(.isHeader)
            content()
            if let explainer { AnalyticsExplainerBox(id: explainer) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, BBSpacing.space4)
    }
}

/// `MissingData`: dashed box saying what is needed.
struct AnalyticsMissing: View {
    let text: String

    var body: some View {
        BBText(text, style: BBTypography.body, color: .bbMutedForeground)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(BBSpacing.space4)
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    }
}

/// «Come leggere e come è calcolata»: the short «what», details on demand.
struct AnalyticsExplainerBox: View {
    let id: String
    @State private var open = false

    var body: some View {
        if let e = AnalyticsContent.explainer(id) {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: e.what), style: BBTypography.body, color: .bbMutedForeground)
                Button { open.toggle() } label: {
                    HStack(spacing: BBSpacing.space1) {
                        BBIconView(.chevronRight, size: .md, color: .bbForeground).rotationEffect(.degrees(open ? 90 : 0))
                        BBText(L10n.lookup(italian: "Come leggerla e come è calcolata"), style: BBTypography.bodyStrong)
                    }
                    .frame(minHeight: 28)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if open {
                    VStack(alignment: .leading, spacing: BBSpacing.space2_5) {
                        item("Come leggerla", e.read)
                        item("Come è calcolata", e.how)
                        item("Limiti", e.limits)
                        if !e.sources.isEmpty {
                            VStack(alignment: .leading, spacing: 2) {
                                BBText(L10n.lookup(italian: "Fonti"), style: BBTypography.bodyStrong)
                                ForEach(e.sources, id: \.label) { s in
                                    BBText("• " + L10n.lookup(italian: s.label), style: BBTypography.body, color: .bbMutedForeground)
                                }
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, BBSpacing.space3_5)
            .padding(.vertical, BBSpacing.space3)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.4)))
        }
    }

    private func item(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(L10n.lookup(italian: title), style: BBTypography.bodyStrong)
            BBText(L10n.lookup(italian: text), style: BBTypography.body, color: .bbMutedForeground)
        }
    }
}

/// `QuestionSection`: the plain answer, then the collapsible «Per esperti · {hint}» (ANA-026, collapsed by default).
struct AnalyticsQuestionSection<Content: View, Expert: View>: View {
    let hint: String
    let expertOpen: Bool
    let onToggle: () -> Void
    @ViewBuilder let content: () -> Content
    @ViewBuilder let expert: () -> Expert

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            if debugShows(3) { content() }
            VStack(alignment: .leading, spacing: 0) {
                Button(action: onToggle) {
                    HStack(spacing: BBSpacing.space2) {
                        BBIconView(.chevronRight, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(expertOpen ? 90 : 0))
                        (Text(L10n.lookup(italian: "Per esperti")).fontWeight(.semibold)
                            + Text(" · " + L10n.lookup(italian: hint)))
                            .bbTextStyle(BBTypography.body)
                            .foregroundStyle(Color.bbMutedForeground)
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, minHeight: BBLayout.minTouchTarget, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(expertOpen ? .isSelected : [])
                if expertOpen {
                    expert().padding(.top, BBSpacing.space3)
                }
            }
            .padding(.top, BBSpacing.space3)
        }
    }
}

/// Thin progress bar (h 12 or 8, `--muted` track, `--primary` fill).
struct AnalyticsProgress: View {
    let value: Double
    var height: CGFloat = 12
    var color: Color = .bbPrimary

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.bbMuted)
                Capsule().fill(color).frame(width: geo.size.width * min(1, max(0, value)))
            }
        }
        .frame(height: height)
    }
}

/// Info button that opens a hint in the term sheet (`InfoHint`).
struct AnalyticsInfoButton: View {
    let label: String
    let text: String
    @State private var open = false

    var body: some View {
        Button { open = true } label: {
            BBIconView(.info, points: 14, color: .bbMutedForeground)
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .bbSheet(isPresented: $open, title: label) {
            BBText(text, style: BBTypography.body, color: .bbMutedForeground)
        }
    }
}
