import BuddyBudgetKit
import SwiftUI

// Form controls added in Phase 1 (spec: design/components.md §1.4–1.6). Android: BBForms.kt.

// MARK: - BBCheckbox

/// 16×16, radius 4, border `--input`; checked = `--primary` fill + white `check` 14 (§1.5). Hit area extended.
struct BBCheckbox: View {
    @Binding var isOn: Bool
    var accessibilityLabel: String = ""
    var isDisabled = false

    var body: some View {
        Button { isOn.toggle() } label: {
            ZStack {
                RoundedRectangle.bb(4)
                    .fill(isOn ? Color.bbPrimary : Color.clear)
                RoundedRectangle.bb(4)
                    .strokeBorder(isOn ? Color.bbPrimary : Color.bbInput, lineWidth: 1)
                if isOn { BBIconView(.check, points: 14, color: .bbPrimaryForeground) }
            }
            .frame(width: 16, height: 16)
            .bbHitArea(height: 16, width: 16)
        }
        .buttonStyle(.plain)
        .bbDisabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isOn ? "1" : "0")
        .accessibilityAddTraits(.isToggle)
    }
}

// MARK: - BBSelect

/// Select (§1.6): trigger like an input (h 32, or 44 on primary forms) with chevron-down; the options open in a
/// `BBSheet` list with a check on the selected one. Same parameters as `BBSelect` on Android.
struct BBSelect<Value: Hashable>: View {
    var label: String?
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var title: String?
    var height: CGFloat = BBLayout.inputHeight
    var isDisabled = false
    var onChange: ((Value) -> Void)? = nil
    /// Optional leading view of an option (e.g. the country flag, web `<Flag/>` in `SelectItem`), also in the field.
    var leading: ((Value) -> AnyView)? = nil

    @State private var open = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if let label {
                BBText(label, style: BBTypography.bodyStrong.with(lineHeight: 14))
            }
            Button { open = true } label: {
                HStack(spacing: BBSpacing.space2) {
                    if let leading, options.contains(where: { $0.value == selection }) { leading(selection) }
                    BBText(currentLabel, style: BBTypography.body, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                }
                .padding(.horizontal, BBSpacing.space3)
                .frame(height: height)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.clear))
                .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbInput, lineWidth: 1))
                .contentShape(Rectangle())
                .bbHitArea(height: height)
            }
            .buttonStyle(.plain)
            .bbDisabled(isDisabled)
            .accessibilityLabel(label ?? title ?? currentLabel)
            .accessibilityValue(currentLabel)
        }
        .bbSheet(isPresented: $open, title: title ?? label) {
            VStack(spacing: BBSpacing.space1) {
                ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                    let selected = option.value == selection
                    Button {
                        open = false
                        guard option.value != selection else { return }
                        selection = option.value
                        onChange?(option.value)
                    } label: {
                        HStack(spacing: BBSpacing.space3) {
                            if let leading { leading(option.value) }
                            BBText(option.label, style: BBTypography.bodyLarge)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if selected { BBIconView(.check, size: .md, color: .bbPrimary) }
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(background: selected ? .bbAccent : .clear, pressedBackground: .bbAccent,
                                                  shape: AnyShape(RoundedRectangle.bb(BBRadius.md)), translate: false))
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }

    private var currentLabel: String {
        options.first { $0.value == selection }?.label ?? ""
    }
}

// MARK: - BBTextArea

/// Multiline input (§1.4): min height 64, grows with the text, padding 10×8, same borders as `BBTextField`.
struct BBTextArea: View {
    var label: String?
    @Binding var text: String
    var placeholder: String = ""
    var maxLength: Int?
    /// Minimum height (64 by default; the report form uses 112, 96 in the sheet).
    var minHeight: CGFloat = 64
    var isDisabled = false
    /// Called when the field loses focus (save-on-blur fields, e.g. the movement note, TX-070).
    var onBlur: (() -> Void)?

    @FocusState private var focused: Bool
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if let label {
                BBText(label, style: BBTypography.bodyStrong.with(lineHeight: 14))
            }
            // Placeholder drawn as an overlay: a TextField prompt is cut to the field's current lines (long placeholders
            // ended with «…»), while the web textarea wraps it fully.
            TextField("", text: $text, axis: .vertical)
                .lineLimit(3...12)
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(verbatim: placeholder).font(BBTypography.bodyLarge.font).foregroundStyle(Color.bbMutedForeground)
                            .fixedSize(horizontal: false, vertical: true)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .font(BBTypography.bodyLarge.font)
                .foregroundStyle(Color.bbForeground)
                .tint(.bbPrimary)
                .focused($focused)
                .padding(.horizontal, BBSpacing.space2_5)
                .padding(.vertical, BBSpacing.space2)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .contentShape(Rectangle())
                .onTapGesture { focused = true }
                .background(RoundedRectangle.bb(BBRadius.lg).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.clear))
                .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(focused ? Color.bbRing : Color.bbInput, lineWidth: 1))
                .background(RoundedRectangle.bb(BBRadius.lg + 3).stroke(focused ? Color.bbAlphaRing50 : .clear, lineWidth: 3).padding(-1.5))
                .bbDisabled(isDisabled)
                .onChange(of: text) { _, new in
                    if let maxLength, new.count > maxLength { text = String(new.prefix(maxLength)) }
                }
                .onChange(of: focused) { was, now in if was && !now { onBlur?() } }
        }
    }
}

// MARK: - BBLinkText

/// A paragraph made of plain fragments and underlined links (legal notes, consents). Fragments are already
/// translated; spaces between them are added like the web's JSX (`{" "}`).
struct BBLinkText: View {
    enum Part {
        case text(String)
        case link(String, URL)
    }

    let parts: [Part]
    var style: BBTextStyle = BBTypography.caption
    var color: Color = .bbText3
    var alignment: TextAlignment = .leading
    /// Links in another colour / weight (e.g. `text-foreground font-medium` on the help page); default = like the text.
    var linkColor: Color?
    var linkWeight: Int?

    var body: some View {
        Text(attributed)
            .bbTextStyle(style)
            .foregroundStyle(color)
            .tint(linkColor ?? color)
            .multilineTextAlignment(alignment)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var attributed: AttributedString {
        var result = AttributedString()
        for part in parts {
            switch part {
            case .text(let text):
                result += AttributedString(text)
            case .link(let text, let url):
                var link = AttributedString(text)
                link.link = url
                link.underlineStyle = .single
                link.foregroundColor = linkColor ?? color
                if let linkWeight { link.font = style.with(weight: linkWeight).font }
                result += link
            }
        }
        return result
    }
}

// MARK: - Brand

/// The «BB» logo mark (`public/brand/logo-mark.svg`, 24×29 in headers), fixed brand colours in both themes.
struct BBLogoMark: View {
    var height: CGFloat = 29

    var body: some View {
        Image("brand-logo-mark")
            .resizable()
            .interpolation(.high)
            .aspectRatio(378.1462 / 463.8719, contentMode: .fit)
            .frame(height: height)
            .accessibilityHidden(true)
    }
}

// MARK: - Error box

/// Inline error box (web `rounded-lg bg-neg-soft p-3 text-sm text-neg`).
struct BBErrorBox: View {
    let message: String
    /// With an area, `Segnala questo problema` follows the box (web `ErrorWithReport`, 16-help-support).
    var reportArea: ReportErrorArea?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(message, style: BBTypography.body, color: .bbNeg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(BBSpacing.space3)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbNegSoft))
                .accessibilityAddTraits(.isStaticText)
            if let reportArea { ReportErrorLink(area: reportArea, error: message) }
        }
    }
}

// MARK: - SearchField

/// Search box of lists (web `MovementsToolbar`): 44 high, radius xl, 1 pt `--input` border on `--card`, search icon.
struct SearchField: View {
    @Binding var text: String
    var placeholder: String
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: BBSpacing.space2) {
            BBIconView(.search, size: .md, color: .bbMutedForeground)
            TextField("", text: $text, prompt: Text(verbatim: placeholder).foregroundStyle(Color.bbMutedForeground))
                .font(BBTypography.bodyLarge.font)
                .foregroundStyle(Color.bbForeground)
                .tint(.bbPrimary)
                .focused($focused)
                .submitLabel(.search)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, BBSpacing.space3)
        .frame(height: BBLayout.minTouchTarget)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbCard))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(focused ? Color.bbRing : Color.bbInput, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
    }
}

// MARK: - Flag

/// Small 3:2 flag drawn by the app (web `Flag`, #397): IT, DE and GB (English uses the British flag, matching the en-GB
/// formats); `WORLD` is a small globe in the muted colour for «Altro paese» (web #465). Flag colours are part of the
/// flag, not of the theme; a hairline ring keeps white stripes visible.
struct BBFlag: View {
    enum Code: String, Sendable {
        case it = "IT", de = "DE", gb = "GB", world = "WORLD"

        /// Web `COUNTRY_FLAGS` from `LocaleRules.flagCode`.
        static func of(_ code: String) -> Code { Code(rawValue: code) ?? .it }
    }
    enum Size: Sendable {
        case sm, md, lg
        var width: CGFloat { switch self { case .sm: 14; case .md: 20; case .lg: 24 } }
        var height: CGFloat { switch self { case .sm: 10; case .md: 14; case .lg: 16 } }
    }

    let code: Code
    var size: Size = .md

    var body: some View {
        Canvas { context, canvas in
            // 30×20 viewBox, `xMidYMid slice`.
            let s = max(canvas.width / 30, canvas.height / 20)
            context.translateBy(x: (canvas.width - 30 * s) / 2, y: (canvas.height - 20 * s) / 2)
            context.scaleBy(x: s, y: s)
            switch code {
            case .world:
                // Not a flag: a globe in the theme's muted colour, so it follows light and dark mode.
                let muted = Color.bbMutedForeground
                context.fill(Path(CGRect(x: 0, y: 0, width: 30, height: 20)), with: .color(muted.opacity(0.12)))
                let stroke = StrokeStyle(lineWidth: 1.4)
                context.stroke(Path(ellipseIn: CGRect(x: 8, y: 3, width: 14, height: 14)), with: .color(muted), style: stroke)
                context.stroke(Path(ellipseIn: CGRect(x: 12, y: 3, width: 6, height: 14)), with: .color(muted), style: stroke)
                var line = Path()
                line.move(to: CGPoint(x: 8, y: 10))
                line.addLine(to: CGPoint(x: 22, y: 10))
                context.stroke(line, with: .color(muted), style: stroke)
            case .it:
                for (i, hex) in [0x009246, 0xFFFFFF, 0xCE2B37].enumerated() {
                    context.fill(Path(CGRect(x: CGFloat(i) * 10, y: 0, width: 10, height: 20)), with: .color(Self.color(hex)))
                }
            case .de:
                for (i, hex) in [0x000000, 0xDD0000, 0xFFCE00].enumerated() {
                    context.fill(Path(CGRect(x: 0, y: CGFloat(i) * 20 / 3, width: 30, height: 20 / 3 + 0.01)), with: .color(Self.color(hex)))
                }
            case .gb:
                context.translateBy(x: -5, y: 0)
                context.scaleBy(x: 0.6667, y: 0.6667)
                context.fill(Path(CGRect(x: 0, y: 0, width: 60, height: 30)), with: .color(Self.color(0x012169)))
                var diagonals = Path()
                diagonals.move(to: CGPoint(x: 0, y: 0)); diagonals.addLine(to: CGPoint(x: 60, y: 30))
                diagonals.move(to: CGPoint(x: 60, y: 0)); diagonals.addLine(to: CGPoint(x: 0, y: 30))
                context.stroke(diagonals, with: .color(.white), lineWidth: 6)
                var clip = Path()
                for tri in [[(30, 15), (60, 15), (60, 30)], [(30, 15), (30, 30), (0, 30)], [(30, 15), (0, 15), (0, 0)], [(30, 15), (30, 0), (60, 0)]] {
                    clip.move(to: CGPoint(x: tri[0].0, y: tri[0].1))
                    clip.addLine(to: CGPoint(x: tri[1].0, y: tri[1].1))
                    clip.addLine(to: CGPoint(x: tri[2].0, y: tri[2].1))
                    clip.closeSubpath()
                }
                var red = context
                red.clip(to: clip)
                red.stroke(diagonals, with: .color(Self.color(0xC8102E)), lineWidth: 4)
                var cross = Path()
                cross.move(to: CGPoint(x: 30, y: 0)); cross.addLine(to: CGPoint(x: 30, y: 30))
                cross.move(to: CGPoint(x: 0, y: 15)); cross.addLine(to: CGPoint(x: 60, y: 15))
                context.stroke(cross, with: .color(.white), lineWidth: 10)
                context.stroke(cross, with: .color(Self.color(0xC8102E)), lineWidth: 6)
            }
        }
        .frame(width: size.width, height: size.height)
        .clipShape(RoundedRectangle.bb(3))
        .overlay(RoundedRectangle.bb(3).strokeBorder(Color.bbForeground.opacity(0.15), lineWidth: 1))
        .accessibilityHidden(true)
    }

    private static func color(_ hex: Int) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
