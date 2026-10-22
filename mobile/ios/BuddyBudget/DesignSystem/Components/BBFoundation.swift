import BuddyBudgetKit
import SwiftUI

// Design system v1 foundations shared by every component (spec: design/components.md §0, §3.10;
// design/iconography-assets.md §1). Same names on Android in designsystem/components/BBFoundation.kt.

// MARK: - Environment: formatting locale, privacy, logo loader

private struct BBLocaleKey: EnvironmentKey {
    static let defaultValue: BBLocale = .itIT
}

private struct BBHideAmountsKey: EnvironmentKey {
    static let defaultValue = false
}

private struct BBLogoLoaderKey: EnvironmentKey {
    static let defaultValue: LogoLoader? = nil
}

extension EnvironmentValues {
    /// Formatting locale for `BBFormat` (follows the account language, never the device).
    var bbLocale: BBLocale {
        get { self[BBLocaleKey.self] }
        set { self[BBLocaleKey.self] = newValue }
    }

    /// Privacy mode (`hideAmounts`): every amount renders `••••`, charts blur and stop reacting to touch.
    var bbHideAmounts: Bool {
        get { self[BBHideAmountsKey.self] }
        set { self[BBHideAmountsKey.self] = newValue }
    }

    /// Authenticated image loader used by `MerchantLogo`.
    var bbLogoLoader: LogoLoader? {
        get { self[BBLogoLoaderKey.self] }
        set { self[BBLogoLoaderKey.self] = newValue }
    }
}

extension AppLanguage {
    /// `BBFormat` locale of the account language.
    var bbLocale: BBLocale { BBLocale(language: BBLanguage(rawValue: rawValue) ?? .it) }
}

/// Global privacy preference (server setting `hideAmounts`, components.md §3.10). Inject at the root and
/// propagate with `.environment(\.bbHideAmounts, privacy.hideAmounts)`.
@MainActor @Observable
final class PrivacyStore {
    var hideAmounts: Bool
    init(hideAmounts: Bool = false) { self.hideAmounts = hideAmounts }
}

// MARK: - Extra text styles (web classes not covered by the generated typography tokens)

extension BBTextStyle {
    /// Page title (`PAGE_TITLE`): the condensed display face, light, 40 pt, leading 0.95 (#405).
    static let screenTitle = BBTypography.pageTitle
    /// Compact top-bar title: font-heading text-base font-medium.
    static let topBarTitle = BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 500, letterSpacingEm: 0,
                                         tabularNums: false, uppercase: false, anchor: .headline)
    /// The Panoramica greeting: display face, 44 pt (`text-[2.75rem]`).
    static let greetingTitle = BBTypography.pageTitle.with(size: 44, lineHeight: 42)
    /// Section title (`SECTION_TITLE`): display face, light, 36 pt, no icon next to it (#411, #427).
    static let sectionHeading = BBTypography.sectionTitle
    /// A view title used as the section switcher on the phone (`SectionHeading`, «Movimenti ⌄»): 36 pt, 28 when long.
    static let viewTitleLong = BBTypography.sectionTitle.with(size: 28, lineHeight: 27)
    /// Brand name in the top bar: font-heading text-base font-bold.
    static let brandName = BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 700, letterSpacingEm: 0,
                                       tabularNums: false, uppercase: false, anchor: .headline)
    /// A highlighted figure inside a block (font-heading text-xl font-medium tabular-nums): figures never use the
    /// condensed face.
    static let figure = BBTextStyle(role: .sans, size: 20, lineHeight: 28, weight: 500, letterSpacingEm: 0,
                                    tabularNums: true, uppercase: false, anchor: .title3)
    /// Dialog and sheet titles, small block titles (font-heading text-lg font-medium).
    static let titleSmall = BBTextStyle(role: .sans, size: 18, lineHeight: 28, weight: 500, letterSpacingEm: 0,
                                        tabularNums: true, uppercase: false, anchor: .title3)
    /// List row primary line: font-semibold (text-base).
    static let rowTitle = BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 600, letterSpacingEm: 0,
                                      tabularNums: false, uppercase: false, anchor: .body)
    /// List row amount: font-heading font-semibold tabular-nums (text-base).
    static let rowAmount = BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 600, letterSpacingEm: 0,
                                       tabularNums: true, uppercase: false, anchor: .body)
    /// Hero amount (`MoneyHero`, phone): font-heading text-5xl font-medium tabular-nums.
    static let hero = BBTextStyle(role: .sans, size: 48, lineHeight: 48, weight: 500, letterSpacingEm: -0.025,
                                  tabularNums: true, uppercase: false, anchor: .largeTitle)
    /// Small link/action label: text-sm font-semibold.
    static let link = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 600, letterSpacingEm: 0,
                                  tabularNums: false, uppercase: false, anchor: .subheadline)
    /// Chart tooltip value: text-xs font-medium tabular-nums (Hanken; mono is for literal codes only).
    static let tooltipValue = BBTextStyle(role: .sans, size: 12, lineHeight: 16, weight: 500, letterSpacingEm: 0,
                                          tabularNums: true, uppercase: false, anchor: .caption)

    func tracking(_ em: CGFloat) -> BBTextStyle {
        BBTextStyle(role: role, size: size, lineHeight: lineHeight, weight: weight, letterSpacingEm: em,
                    tabularNums: tabularNums, uppercase: uppercase, anchor: anchor)
    }

    func with(size: CGFloat? = nil, lineHeight: CGFloat? = nil, weight: Int? = nil) -> BBTextStyle {
        BBTextStyle(role: role, size: size ?? self.size, lineHeight: lineHeight ?? self.lineHeight, weight: weight ?? self.weight,
                    letterSpacingEm: letterSpacingEm, tabularNums: tabularNums, uppercase: uppercase, anchor: anchor)
    }
}

/// Text in a BuddyBudget style and color.
struct BBText: View {
    let text: String
    var style: BBTextStyle = BBTypography.body
    var color: Color = .bbForeground
    var lineLimit: Int? = nil

    init(_ text: String, style: BBTextStyle = BBTypography.body, color: Color = .bbForeground, lineLimit: Int? = nil) {
        self.text = text
        self.style = style
        self.color = color
        self.lineLimit = lineLimit
    }

    var body: some View {
        Text(verbatim: text)
            .bbTextStyle(style)
            .foregroundStyle(color)
            .lineLimit(lineLimit)
    }
}

// MARK: - Colors

extension AmountColorRole {
    var color: Color {
        switch self {
        case .foreground: .bbForeground
        case .pos: .bbPos
        case .neg: .bbNeg
        }
    }
}

extension Color {
    /// Swatch by stored key (`BBSwatch.order`); unknown keys fall back to `slate`.
    static func bbSwatch(_ key: String) -> Color { BBSwatch.byKey[key] ?? .bbSwatchSlate }
}

// MARK: - Icons

/// Icon sizes in use (iconography-assets.md §1.1).
enum BBIconSize: CGFloat, Sendable {
    case xs = 12, sm = 14, md = 16, lg = 20, xl = 24
}

/// A Lucide icon as a template image tinted with `color` (stroke scales with the size, like lucide-react).
struct BBIconView: View {
    let icon: BBIcon
    var size: CGFloat = BBIconSize.md.rawValue
    var color: Color? = nil

    init(_ icon: BBIcon, size: BBIconSize = .md, color: Color? = nil) {
        self.icon = icon
        self.size = size.rawValue
        self.color = color
    }

    init(_ icon: BBIcon, points: CGFloat, color: Color? = nil) {
        self.icon = icon
        self.size = points
        self.color = color
    }

    var body: some View {
        Image(icon.assetName)
            .renderingMode(.template)
            .resizable()
            .interpolation(.high)
            .frame(width: size, height: size)
            .foregroundStyle(color ?? .primary)
            .accessibilityHidden(true)
    }
}

/// `loader-circle` spinning 360° linear 1 s (Tailwind `animate-spin`).
struct BBSpinner: View {
    var size: BBIconSize = .md
    var color: Color? = nil
    @State private var spinning = false

    var body: some View {
        BBIconView(.loaderCircle, size: size, color: color)
            .rotationEffect(.degrees(spinning ? 360 : 0))
            .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: spinning)
            .onAppear { spinning = true }
    }
}

/// Icon in a tinted circle (`SectionTitle`, `EmptyState`, avatars): fg = color, bg = color @ 16 %.
struct BBIconBadge: View {
    let icon: BBIcon
    var color: Color = .bbSwatchTeal
    var diameter: CGFloat = 36
    var iconSize: CGFloat = 18

    var body: some View {
        BBIconView(icon, points: iconSize, color: color)
            .frame(width: diameter, height: diameter)
            .background(Circle().fill(color.opacity(0.16)))
    }
}

// MARK: - Interaction

/// Hit area of at least 44 pt around a smaller control without changing its layout size (tokens.md §4).
private struct BBHitArea: ViewModifier {
    let height: CGFloat
    let width: CGFloat?

    func body(content: Content) -> some View {
        let dy = max(0, (BBLayout.minTouchTarget - height) / 2)
        let dx = max(0, (BBLayout.minTouchTarget - (width ?? BBLayout.minTouchTarget)) / 2)
        content
            .padding(.vertical, dy)
            .padding(.horizontal, dx)
            .contentShape(Rectangle())
            .padding(.vertical, -dy)
            .padding(.horizontal, -dx)
    }
}

extension View {
    func bbHitArea(height: CGFloat, width: CGFloat? = nil) -> some View {
        modifier(BBHitArea(height: height, width: width))
    }

    /// Disabled controls: 50 % opacity, not hittable (components.md §0.4).
    func bbDisabled(_ disabled: Bool) -> some View {
        opacity(disabled ? 0.5 : 1).allowsHitTesting(!disabled)
    }
}

/// Pressed feedback without the system highlight: the label gets `pressedBackground` and moves 1 pt down.
struct BBPressableStyle: ButtonStyle {
    var background: Color = .clear
    var pressedBackground: Color = .clear
    var shape: AnyShape = AnyShape(Rectangle())
    var translate: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(shape.fill(configuration.isPressed ? pressedBackground : background))
            .offset(y: configuration.isPressed && translate ? 1 : 0)
    }
}

// MARK: - Reduce motion

extension Animation {
    /// `animation` unless Reduce Motion is on (then a 150 ms fade-compatible linear).
    static func bbMotion(_ animation: Animation, reduceMotion: Bool) -> Animation {
        reduceMotion ? .linear(duration: BBMotion.durationFast) : animation
    }
}
