import SwiftUI
import UIKit

// Theme glue over the generated tokens in DesignSystem/Generated/Tokens.swift
// (spec: design/tokens.md). Colors are `Color.bb*` dynamic colors: they resolve light/dark from the
// environment's color scheme, so a view picks the right value wherever it is rendered.

// MARK: - Theme preference (System / Light / Dark, default System — tokens.md §0)

enum BBThemePreference: String, CaseIterable, Sendable {
    case system, light, dark

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var interfaceStyle: UIUserInterfaceStyle {
        switch self {
        case .system: .unspecified
        case .light: .light
        case .dark: .dark
        }
    }
}

extension View {
    /// Root-level theme: in-app appearance override, accent tint and screen background.
    /// Also call `BBTheme.apply(_:)` so UIKit-backed views resolve the same appearance.
    func bbTheme(_ preference: BBThemePreference = .system) -> some View {
        preferredColorScheme(preference.colorScheme)
            .tint(.bbPrimary)
            .background(Color.bbBackground.ignoresSafeArea())
    }
}

@MainActor
enum BBTheme {
    /// Propagates the theme override to every window (`UIColor` providers in UIKit-backed views).
    static func apply(_ preference: BBThemePreference) {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows { window.overrideUserInterfaceStyle = preference.interfaceStyle }
        }
    }

    #if DEBUG
    /// PostScript names of bundled fonts that failed to register (should be empty).
    static func missingFonts() -> [String] {
        BBFontRole.allCases.flatMap(\.faces).map(\.postScriptName).filter { UIFont(name: $0, size: 12) == nil }
    }
    #endif
}

// MARK: - Typography

extension BBDynamicTypeAnchor {
    var textStyle: Font.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .title: .title
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .body: .body
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption: .caption
        case .caption2: .caption2
        }
    }
}

extension BBDynamicTypeAnchor {
    var uiTextStyle: UIFont.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .body: .body
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption: .caption1
        case .caption2: .caption2
        }
    }
}

extension Font.Weight {
    init(cssWeight: Int) {
        switch cssWeight {
        case ..<350: self = .light
        case ..<450: self = .regular
        case ..<550: self = .medium
        case ..<650: self = .semibold
        default: self = .bold
        }
    }
}

extension BBTextStyle {
    var postScriptName: String { role.postScriptName(weight: weight) }

    /// Scales with Dynamic Type relative to `anchor`; tabular figures where the token asks for them.
    /// A system role (the platform monospace, for literal codes) uses the system font of that design.
    var font: Font {
        if role.isSystem {
            return Font.system(size: UIFontMetrics(forTextStyle: anchor.uiTextStyle).scaledValue(for: size),
                               weight: Font.Weight(cssWeight: weight), design: .monospaced)
        }
        let font = Font.custom(postScriptName, size: size, relativeTo: anchor.textStyle)
        return tabularNums ? font.monospacedDigit() : font
    }

    /// Unscaled UIFont, used to compute CSS-like line spacing.
    var uiFont: UIFont {
        if role.isSystem { return .monospacedSystemFont(ofSize: size, weight: .regular) }
        return UIFont(name: postScriptName, size: size) ?? .systemFont(ofSize: size)
    }
}

extension Font {
    static func bb(_ style: BBTextStyle) -> Font { style.font }
}

private struct BBTextStyleModifier: ViewModifier {
    let style: BBTextStyle

    func body(content: Content) -> some View {
        // CSS centers glyphs in the line box (half-leading): extra line spacing + half of it above and below.
        let extra = max(0, style.lineHeight - style.uiFont.lineHeight)
        content
            .font(style.font)
            .tracking(style.letterSpacingEm * style.size)
            .textCase(style.uppercase ? .uppercase : nil)
            .lineSpacing(extra)
            .padding(.vertical, extra / 2)
    }
}

extension View {
    /// Applies a `BBTypography` style: font, tracking, case and CSS-equivalent line height.
    func bbTextStyle(_ style: BBTextStyle) -> some View {
        modifier(BBTextStyleModifier(style: style))
    }
}

// MARK: - Shape

extension RoundedRectangle {
    /// The web draws circular corners; keep `.circular` for parity with Android (tokens.md §3).
    static func bb(_ radius: CGFloat) -> RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .circular)
    }
}

// MARK: - Elevation

extension View {
    /// CSS box-shadow layers. SwiftUI has no spread: the blur radius is reduced by |spread| instead
    /// (tokens.md §5); a CSS blur of B is roughly a SwiftUI radius of B / 2.
    func bbShadow(_ layers: [BBShadowLayer]) -> some View {
        layers.reduce(AnyView(self)) { view, layer in
            AnyView(view.shadow(color: layer.color, radius: max(0, layer.blur - abs(layer.spread)) / 2, x: layer.x, y: layer.y))
        }
    }

    /// The 1 pt ring in `foreground` @ 10% that separates cards and popovers (no border, no shadow).
    func bbRing(cornerRadius: CGFloat = BBRadius.xl) -> some View {
        overlay(RoundedRectangle.bb(cornerRadius).strokeBorder(BBElevation.ringColor, lineWidth: BBElevation.ringWidth))
    }
}

// MARK: - Motion

extension Animation {
    /// Same mass-spring-damper equation as the web (tokens.md §6.1).
    static func bb(_ spring: BBSpring) -> Animation {
        .interpolatingSpring(mass: spring.mass, stiffness: spring.stiffness, damping: spring.damping, initialVelocity: 0)
    }

    static func bb(_ curve: BBCubicBezier, duration: TimeInterval) -> Animation {
        .timingCurve(curve.x1, curve.y1, curve.x2, curve.y2, duration: duration)
    }

    /// The web's default transition for every animation.
    static let bbDefault = Animation.bb(BBMotion.springSoft)
}
