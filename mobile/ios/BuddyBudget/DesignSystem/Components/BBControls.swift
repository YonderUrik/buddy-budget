import BuddyBudgetKit
import SwiftUI

// Controls (spec: design/components.md §0.4, §1.1, §1.4, §1.5, §3.3). Android: BBControls.kt.

// MARK: - BBButton

/// `sun`: the brand yellow, for the page's main action (#405). `outline` is filled like `secondary` (#427).
enum BBButtonVariant: Sendable { case `default`, sun, outline, secondary, ghost, destructive, link }

enum BBButtonSize: Sendable {
    case xs, sm, `default`, lg
    /// 44 pt, padding 16: EmptyState actions, primary form actions on phone (§1.1).
    case touch
    case icon, iconSm, iconLg, iconTouch

    var height: CGFloat {
        switch self {
        case .xs: 24
        case .sm, .iconSm: 28
        case .default, .icon: 32
        case .lg, .iconLg: 36
        case .touch, .iconTouch: 44
        }
    }

    var isIcon: Bool { [.icon, .iconSm, .iconLg, .iconTouch].contains(self) }

    var horizontalPadding: CGFloat {
        switch self {
        case .xs: 8
        case .touch: 16
        case .icon, .iconSm, .iconLg, .iconTouch: 0
        default: 10
        }
    }

    /// Every button is a pill (#427).
    var radius: CGFloat { BBRadius.full }

    var iconSize: CGFloat {
        switch self {
        case .xs: 12
        case .sm: 14
        default: 16
        }
    }

    var textStyle: BBTextStyle {
        switch self {
        case .xs: BBTypography.button.with(size: 12, lineHeight: 16)
        case .sm: BBTypography.button.with(size: 12.8, lineHeight: 16)
        default: BBTypography.button
        }
    }
}

/// Button with the web variants and sizes. Visual size from the tokens, hit area ≥ 44 pt. `isLoading` shows the
/// spinner in the icon slot and blocks taps; disabled = 50 % opacity.
struct BBButton: View {
    let title: String
    var icon: BBIcon?
    var iconTrailing = false
    var variant: BBButtonVariant = .default
    var size: BBButtonSize = .default
    var fullWidth = false
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    @Environment(\.colorScheme) private var scheme

    init(_ title: String, icon: BBIcon? = nil, iconTrailing: Bool = false, variant: BBButtonVariant = .default,
         size: BBButtonSize = .default, fullWidth: Bool = false, isLoading: Bool = false, isDisabled: Bool = false,
         action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.iconTrailing = iconTrailing
        self.variant = variant
        self.size = size
        self.fullWidth = fullWidth
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        let c = BBButtonColors.of(variant, dark: scheme == .dark)
        Button(action: action) {
            HStack(spacing: BBSpacing.space1_5) {
                if isLoading {
                    BBSpinner(size: size.iconSize <= 12 ? .xs : (size.iconSize <= 14 ? .sm : .md), color: c.foreground)
                } else if let icon, !iconTrailing {
                    BBIconView(icon, points: size.iconSize, color: c.foreground)
                }
                if !size.isIcon {
                    BBText(title, style: size.textStyle, color: c.foreground, lineLimit: 1)
                }
                if let icon, iconTrailing, !isLoading {
                    BBIconView(icon, points: size.iconSize, color: c.foreground)
                }
            }
            .padding(.horizontal, size.horizontalPadding)
            .frame(width: size.isIcon ? size.height : nil, height: size.height)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .overlay {
                if let border = c.border {
                    Capsule().strokeBorder(border, lineWidth: 1)
                }
            }
            .contentShape(Capsule())
            .bbHitArea(height: size.height, width: size.isIcon ? size.height : nil)
        }
        .buttonStyle(BBButtonStyle(colors: c, radius: size.radius, underlineOnPress: variant == .link))
        .bbDisabled(isDisabled || isLoading)
        .accessibilityLabel(title)
    }
}

struct BBButtonColors {
    let background: Color
    let foreground: Color
    let pressed: Color
    let border: Color?

    static func of(_ variant: BBButtonVariant, dark: Bool) -> BBButtonColors {
        switch variant {
        case .default:
            BBButtonColors(background: .bbPrimary, foreground: .bbPrimaryForeground, pressed: .bbAlphaPrimary80, border: nil)
        case .sun:
            BBButtonColors(background: .bbSun, foreground: .bbOnSun, pressed: .bbSunHover, border: nil)
        case .outline:
            BBButtonColors(background: .bbSecondary, foreground: .bbSecondaryForeground, pressed: .bbStateSecondaryHover, border: nil)
        case .secondary:
            BBButtonColors(background: .bbSecondary, foreground: .bbSecondaryForeground, pressed: .bbStateSecondaryHover, border: nil)
        case .ghost:
            BBButtonColors(background: .clear, foreground: .bbForeground, pressed: dark ? .bbAlphaMuted50 : .bbMuted, border: nil)
        case .destructive:
            BBButtonColors(background: dark ? .bbAlphaDestructive20 : .bbAlphaDestructive10, foreground: .bbDestructive,
                           pressed: dark ? Color.bbDestructive.opacity(0.3) : .bbAlphaDestructive20, border: nil)
        case .link:
            BBButtonColors(background: .clear, foreground: .bbPrimary, pressed: .clear, border: nil)
        }
    }
}

private struct BBButtonStyle: ButtonStyle {
    let colors: BBButtonColors
    let radius: CGFloat
    let underlineOnPress: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(Capsule().fill(configuration.isPressed ? colors.pressed : colors.background))
            .overlay(alignment: .bottom) {
                if underlineOnPress && configuration.isPressed {
                    Rectangle().fill(colors.foreground).frame(height: 1).padding(.horizontal, 10).offset(y: -4)
                }
            }
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

// MARK: - BBTextField

/// Autofill semantics of a field (iOS `textContentType`, Android `ContentType`).
enum BBContentType: Sendable {
    case email, name, oneTimeCode

    var uiType: UITextContentType {
        switch self {
        case .email: .emailAddress
        case .name: .name
        case .oneTimeCode: .oneTimeCode
        }
    }
}

enum BBKeyboard: Sendable {
    case text, email, number
    /// Decimal pad; both "," and "." are accepted and normalized to the locale's decimal separator (§1.4).
    case amount
    /// Like `amount`, but the value may be negative (a keyboard with "-", e.g. today's balance of an account).
    case signedAmount
}

/// Label (text-sm medium) + 32 pt input (radius lg, 1 pt `--input` border, text 16) + error message.
/// Focus: `--ring` border + 3 pt `--ring @ 50%` ring; invalid: `--destructive` border + ring `@ 20%` (dark 40%).
struct BBTextField: View {
    var label: String?
    @Binding var text: String
    var placeholder: String = ""
    var error: String?
    var keyboard: BBKeyboard = .text
    /// Static prefix inside the field (currency symbol for amounts), text-xs `--muted-foreground`.
    var prefix: String?
    var isDisabled = false
    /// Visual height: 32 (default, web `h-8`) or 44 for primary phone forms (web `h-11`, login).
    var height: CGFloat = BBLayout.inputHeight
    /// Autofill hint (email, name, one-time code).
    var contentType: BBContentType? = nil
    var submitLabel: SubmitLabel = .done
    var onSubmit: (() -> Void)? = nil
    /// Focus the field when it appears.
    var autofocus = false
    /// Called when the field loses focus (save-on-exit fields).
    var onBlur: (() -> Void)? = nil

    @FocusState private var focused: Bool
    @Environment(\.colorScheme) private var scheme
    @Environment(\.bbLocale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if let label {
                BBText(label, style: BBTypography.bodyStrong.with(lineHeight: 14))
            }
            HStack(spacing: BBSpacing.space1_5) {
                if let prefix { BBText(prefix, style: BBTypography.caption, color: .bbMutedForeground) }
                TextField("", text: $text, prompt: Text(verbatim: placeholder).foregroundStyle(Color.bbMutedForeground))
                    .font(BBTypography.bodyLarge.font)
                    .foregroundStyle(Color.bbForeground)
                    .tint(.bbPrimary)
                    .focused($focused)
                    .keyboardType(keyboardType)
                    .textInputAutocapitalization(keyboard == .text ? .sentences : .never)
                    .autocorrectionDisabled(keyboard != .text)
                    .textContentType(contentType?.uiType)
                    .submitLabel(submitLabel)
                    .onSubmit { onSubmit?() }
                    .onChange(of: text) { _, new in
                        if keyboard == .amount || keyboard == .signedAmount {
                            let normalized = AmountInput.normalize(new, locale: locale)
                            if normalized != new { text = normalized }
                        }
                    }
            }
            .padding(.horizontal, height > BBLayout.inputHeight ? BBSpacing.space3_5 : BBSpacing.space2_5)
            .frame(height: height)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(fieldBackground))
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(borderColor, lineWidth: 1))
            .background(
                RoundedRectangle.bb(BBRadius.lg + 3).stroke(ringColor, lineWidth: 3).padding(-1.5)
            )
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
            .bbHitArea(height: height)
            .bbDisabled(isDisabled)
            .task { if autofocus { focused = true } }
            .onChange(of: focused) { _, now in if !now { onBlur?() } }
            if let error {
                BBText(error, style: BBTypography.body, color: .bbDestructive)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var keyboardType: UIKeyboardType {
        switch keyboard {
        case .text: .default
        case .email: .emailAddress
        case .number: .numberPad
        case .amount: .decimalPad
        case .signedAmount: .numbersAndPunctuation
        }
    }

    private var fieldBackground: Color {
        if isDisabled { return scheme == .dark ? .bbAlphaInput80 : .bbAlphaInput50 }
        return scheme == .dark ? .bbAlphaInput30 : .clear
    }

    private var borderColor: Color {
        if error != nil { return .bbDestructive }
        return focused ? .bbRing : .bbInput
    }

    private var ringColor: Color {
        if error != nil { return Color.bbDestructive.opacity(scheme == .dark ? 0.4 : 0.2) }
        return focused ? .bbAlphaRing50 : .clear
    }
}

// MARK: - BBSwitch

enum BBSwitchSize: Sendable { case `default`, sm }

/// Custom switch (not the platform one): track 32×18.4 (sm 24×14), thumb 16 (sm 12), 150 ms (§1.5).
struct BBSwitch: View {
    @Binding var isOn: Bool
    var size: BBSwitchSize = .default
    var accessibilityLabel: String = ""
    var isDisabled = false

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let (w, h, thumb): (CGFloat, CGFloat, CGFloat) = size == .sm ? (24, 14, 12) : (32, 18.4, 16)
        let inset = (h - thumb) / 2
        Button { isOn.toggle() } label: {
            ZStack(alignment: .leading) {
                Capsule().fill(isOn ? Color.bbPrimary : (scheme == .dark ? Color.bbAlphaInput80 : Color.bbInput))
                Circle()
                    .fill(thumbColor)
                    .frame(width: thumb, height: thumb)
                    .offset(x: isOn ? w - thumb - inset : inset)
            }
            .frame(width: w, height: h)
            .animation(.easeInOut(duration: BBMotion.durationFast), value: isOn)
            .bbHitArea(height: h, width: w)
        }
        .buttonStyle(.plain)
        .bbDisabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isOn ? "1" : "0")
        .accessibilityAddTraits(.isToggle)
    }

    private var thumbColor: Color {
        guard scheme == .dark else { return .bbBackground }
        return isOn ? .bbPrimaryForeground : .bbForeground
    }
}

// MARK: - BBSlider

/// Track 4 (radius full, `--muted`), filled part `--primary`, thumb 12 circle `--background` with a 1 pt `--ring`
/// border, edge-aligned; 3 pt ring `--ring @ 50%` while dragging; value updates continuously (§1.5).
struct BBSlider: View {
    @Binding var value: Double
    var range: ClosedRange<Double> = 0...1
    var step: Double = 0
    var accessibilityLabel: String = ""

    @State private var dragging = false

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let thumb: CGFloat = 12
            let span = range.upperBound - range.lowerBound
            let fraction = span > 0 ? (value - range.lowerBound) / span : 0
            let x = CGFloat(fraction) * (width - thumb)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.bbMuted).frame(height: 4)
                Capsule().fill(Color.bbPrimary).frame(width: x + thumb / 2, height: 4)
                Circle()
                    .fill(Color.bbBackground)
                    .overlay(Circle().strokeBorder(Color.bbRing, lineWidth: 1))
                    .background(Circle().stroke(Color.bbAlphaRing50, lineWidth: dragging ? 3 : 0).padding(-1.5))
                    .frame(width: thumb, height: thumb)
                    .offset(x: x)
            }
            .frame(height: proxy.size.height)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        dragging = true
                        update(x: g.location.x, width: width, thumb: thumb)
                    }
                    .onEnded { _ in dragging = false }
            )
        }
        .frame(height: BBLayout.minTouchTarget)
        .accessibilityElement()
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(String(value))
        .accessibilityAdjustableAction { direction in
            let delta = step > 0 ? step : (range.upperBound - range.lowerBound) / 20
            value = min(max(value + (direction == .increment ? delta : -delta), range.lowerBound), range.upperBound)
        }
    }

    private func update(x: CGFloat, width: CGFloat, thumb: CGFloat) {
        let usable = max(1, width - thumb)
        let fraction = min(max((x - thumb / 2) / usable, 0), 1)
        var v = range.lowerBound + Double(fraction) * (range.upperBound - range.lowerBound)
        if step > 0 { v = (v / step).rounded() * step }
        value = min(max(v, range.lowerBound), range.upperBound)
    }
}

// MARK: - SegmentedControl

/// Single choice among a few options (view toggles, §3.3): `--muted` pill container, padding 4, gap 4; segments
/// min 36, text-sm medium; the active pill (`--background`, no shadow, #427) slides with the bouncy spring.
/// `SegmentedControl` that scrolls horizontally when its options don't fit (section tabs, years, periods). The selected
/// option is scrolled into view on first appearance (e.g. a deep link to the fifth tab) and whenever the selection
/// changes. Twin of `ScrollableSegmentedControl` on Android.
struct ScrollableSegmentedControl<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var accessibilityLabel: String = ""

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                SegmentedControl(options: options, selection: $selection, accessibilityLabel: accessibilityLabel)
            }
            .scrollIndicators(.hidden)
            .onAppear {
                // After the first layout pass, so the target frame exists.
                DispatchQueue.main.async { proxy.scrollTo(selection, anchor: .center) }
            }
            .onChange(of: selection) { _, value in
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) { proxy.scrollTo(value, anchor: .center) }
            }
        }
    }
}

struct SegmentedControl<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var accessibilityLabel: String = ""
    var stretch = false

    @Namespace private var pill
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: BBSpacing.space1) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                let active = option.value == selection
                Button {
                    withAnimation(.bbMotion(.bb(BBMotion.springBouncy), reduceMotion: reduceMotion)) { selection = option.value }
                } label: {
                    BBText(option.label, style: BBTypography.bodyStrong, color: active ? .bbForeground : .bbMutedForeground, lineLimit: 1)
                        .padding(.horizontal, stretch ? BBSpacing.space2 : BBSpacing.space3)
                        .frame(maxWidth: stretch ? .infinity : nil, minHeight: 36)
                        .background {
                            if active {
                                Capsule()
                                    .fill(Color.bbBackground)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? .isSelected : [])
                .id(option.value)
            }
        }
        .padding(BBSpacing.space1)
        .frame(maxWidth: stretch ? .infinity : nil)
        .background(Capsule().fill(Color.bbMuted))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
    }
}
