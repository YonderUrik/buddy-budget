import BuddyBudgetKit
import SwiftUI

// Text & numbers (spec: design/components.md §1.2, §3.1–3.2, §3.6, §3.10). Android: BBTextComponents.kt.

// MARK: - AmountText

/// An amount formatted through `BBFormat` (via `AmountDisplay`): tone coloring, tabular digits, privacy mask
/// (`hideAmounts` → `••••`) and the hero layout (`splitMoney`: decimals and trailing symbol at 0.55 em, muted).
struct AmountText: View {
    let value: Double
    let currency: String
    var tone: AmountTone = .neutral
    var signed = false
    var maximumFractionDigits = 2
    var style: BBTextStyle = .rowAmount
    var hero = false

    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let d = AmountDisplay.make(value: value, currency: currency, locale: locale, tone: tone, signed: signed,
                                   maximumFractionDigits: maximumFractionDigits, split: hero, masked: hideAmounts)
        let color = d.role.color
        Group {
            if d.tail.isEmpty {
                Text(verbatim: d.main).foregroundStyle(color)
            } else {
                Text(verbatim: d.main).foregroundStyle(color)
                    + Text(verbatim: d.tail)
                    .font(style.with(size: (style.size * 0.55).rounded()).font)
                    .foregroundStyle(Color.bbMutedForeground)
            }
        }
        .bbTextStyle(style)
        .lineLimit(1)
        .accessibilityLabel(d.text)
    }
}

/// Hero amount (net worth, portfolio, liquidity): 48 pt on phone with a muted tail; `••••` when hidden.
struct MoneyHero: View {
    let value: Double
    let currency: String
    var tone: AmountTone = .neutral

    var body: some View {
        AmountText(value: value, currency: currency, tone: tone, style: .hero, hero: true)
    }
}

// MARK: - BBBadge

/// `soft`: primary @10% with primary text (the «Usa l'AI» tag).
enum BBBadgeVariant: Sendable { case `default`, secondary, destructive, outline, ghost, soft }

/// Height 20, capsule, padding 8, text-xs medium, icon 12 (components.md §1.2).
struct BBBadge: View {
    let text: String
    var variant: BBBadgeVariant = .default
    var icon: BBIcon?

    @Environment(\.colorScheme) private var scheme

    init(_ text: String, variant: BBBadgeVariant = .default, icon: BBIcon? = nil) {
        self.text = text
        self.variant = variant
        self.icon = icon
    }

    var body: some View {
        let (bg, fg) = colors
        HStack(spacing: BBSpacing.space1) {
            if let icon { BBIconView(icon, size: .xs, color: fg) }
            BBText(text, style: BBTypography.badge, color: fg, lineLimit: 1)
        }
        .padding(.horizontal, BBSpacing.space2)
        .frame(height: BBLayout.badgeHeight)
        .background(Capsule().fill(bg))
        .overlay {
            if variant == .outline { Capsule().strokeBorder(Color.bbBorder, lineWidth: 1) }
        }
    }

    private var colors: (Color, Color) {
        switch variant {
        case .default: (.bbPrimary, .bbPrimaryForeground)
        case .secondary: (.bbSecondary, .bbSecondaryForeground)
        case .destructive: (scheme == .dark ? .bbAlphaDestructive20 : .bbAlphaDestructive10, .bbDestructive)
        case .outline: (.clear, .bbForeground)
        case .ghost: (.clear, .bbForeground)
        case .soft: (.bbAlphaPrimary10, .bbPrimary)
        }
    }
}

/// "Manuale": category set by hand. Shown in the transaction detail only (hidden in phone rows, §1.2).
struct ManualBadge: View {
    var body: some View { BBBadge(L10n.manual_58ab84, variant: .outline) }
}

/// Where an automatic category came from (§3.6): rule, the user's past choices, or the assistant.
enum AutoOrigin: String, Sendable {
    case regola, storico, assistente
    /// The bank's category from an imported file (CAT-047, web #456).
    case banca

    /// The badge of an automatic category origin; nil for the user's choice and legacy rows.
    static func of(_ source: CategorySource?) -> AutoOrigin? {
        guard let source, source.isAutomatic else { return nil }
        return AutoOrigin(rawValue: source.rawValue)
    }

    var icon: BBIcon {
        switch self {
        case .regola: .bookmarkCheck
        case .storico: .history
        case .assistente: .sparkles
        case .banca: .landmark
        }
    }

    var label: String {
        switch self {
        case .regola: L10n.rule
        case .storico: L10n.yourChoices
        case .assistente: L10n.ai
        case .banca: L10n.bank
        }
    }
}

/// "Auto" source badge: icon 14 + label, text-xs `--text-2`; `compact` = icon only (movement rows).
struct AutoOriginBadge: View {
    let source: AutoOrigin
    var compact = false

    var body: some View {
        HStack(spacing: BBSpacing.space1) {
            BBIconView(source.icon, size: .sm, color: .bbText2)
            if !compact { BBText(source.label, style: BBTypography.caption, color: .bbText2, lineLimit: 1) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(source.label)
    }
}

// MARK: - BBChip

/// Selectable chip (filters, account chips): capsule, min height 36 (44 pt hit area), text-sm medium.
/// Active: `--primary` border + `--primary @ 10%` fill; inactive: `--foreground @ 4%` fill.
struct BBChip: View {
    let label: String
    var icon: BBIcon?
    var isSelected = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space1_5) {
                if let icon { BBIconView(icon, size: .md, color: isSelected ? .bbPrimary : .bbText2) }
                BBText(label, style: BBTypography.bodyStrong, color: isSelected ? .bbPrimary : .bbForeground, lineLimit: 1)
            }
            .padding(.horizontal, BBSpacing.space3_5)
            .frame(height: 36)
            .background(Capsule().fill(isSelected ? Color.bbAlphaPrimary10 : Color.bbForeground.opacity(0.04)))
            .overlay(Capsule().strokeBorder(isSelected ? Color.bbPrimary : Color.clear, lineWidth: 1.5))
            .bbHitArea(height: 36)
        }
        .buttonStyle(BBPressableStyle(translate: false))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
