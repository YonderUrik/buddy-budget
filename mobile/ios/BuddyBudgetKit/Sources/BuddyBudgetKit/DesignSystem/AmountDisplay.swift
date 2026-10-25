import Foundation

/// How an amount is colored (spec: design/components.md §3.1, §3.9, §3.10). Same cases on Android (`AmountTone`).
public enum AmountTone: String, CaseIterable, Sendable {
    /// Always `--foreground`.
    case neutral
    /// Web `StatCard` `tone="auto"`: `value < 0` → `--neg`, else `--pos`.
    case auto
    /// Gains and deltas: `> 0` → `--pos`, `< 0` → `--neg`, zero → `--foreground`.
    case signed
    /// Movement rows: income (`> 0`) in `--pos`, everything else `--foreground`.
    case income
    /// Forced `--pos`.
    case pos
    /// Forced `--neg`.
    case neg
}

/// The color token an amount resolves to. The UI maps it to `Color.bb*` / `BBColors.*`.
public enum AmountColorRole: String, Sendable {
    case foreground, pos, neg
}

/// Text and color of an amount, computed once for both platforms (`AmountText`, `StatCard`, `MoneyHero`).
public struct AmountDisplay: Equatable, Sendable {
    /// Integer part (with currency prefix and sign) — or the whole text when not split, or `••••` when masked.
    public let main: String
    /// Decimal separator, decimals and a trailing currency symbol, rendered at 0.55 em in `--muted-foreground`
    /// (hero amounts). Empty when not split or masked.
    public let tail: String
    public let role: AmountColorRole
    public let isMasked: Bool

    public var text: String { main + tail }

    public init(main: String, tail: String, role: AmountColorRole, isMasked: Bool) {
        self.main = main
        self.tail = tail
        self.role = role
        self.isMasked = isMasked
    }

    /// Color rule per tone. Privacy masking never changes the color (web keeps the tone classes on the mask).
    public static func role(for value: Double, tone: AmountTone) -> AmountColorRole {
        switch tone {
        case .neutral: .foreground
        case .pos: .pos
        case .neg: .neg
        case .auto: value < 0 ? .neg : .pos
        case .signed: value > 0 ? .pos : (value < 0 ? .neg : .foreground)
        case .income: value > 0 ? .pos : .foreground
        }
    }

    /// - Parameters:
    ///   - signed: explicit "+" / "−" (U+2212) like `formatSignedCurrency`.
    ///   - maximumFractionDigits: 2 by default; 0 for axes, legends and `StatCard`.
    ///   - split: hero layout (`splitMoney`): main + muted tail. Ignored when `maximumFractionDigits == 0`.
    ///   - masked: privacy mode (`hideAmounts`): the text becomes `BBFormat.amountMask`, no tail.
    public static func make(value: Double, currency: String, locale: BBLocale, tone: AmountTone = .neutral,
                            signed: Bool = false, maximumFractionDigits: Int = 2, split: Bool = false,
                            masked: Bool = false) -> AmountDisplay {
        let role = role(for: value, tone: tone)
        if masked { return AmountDisplay(main: BBFormat.amountMask, tail: "", role: role, isMasked: true) }
        if split && maximumFractionDigits > 0 {
            let magnitude = signed ? Swift.abs(value) : value
            let parts = BBFormat.splitMoney(magnitude, currency: currency, locale: locale)
            let sign = signed ? (value < 0 ? BBFormat.minusSign : "+") : ""
            return AmountDisplay(main: sign + parts.main, tail: parts.tail, role: role, isMasked: false)
        }
        let text: String
        if signed {
            let sign = value < 0 ? BBFormat.minusSign : "+"
            text = sign + BBFormat.formatCurrency(Swift.abs(value), currency: currency, locale: locale,
                                                  maximumFractionDigits: maximumFractionDigits)
        } else {
            text = BBFormat.formatCurrency(value, currency: currency, locale: locale,
                                           maximumFractionDigits: maximumFractionDigits)
        }
        return AmountDisplay(main: text, tail: "", role: role, isMasked: false)
    }
}

/// Placeholder shown by `MerchantLogo` while loading / on failure (components.md §3.7): the first letter or digit
/// of the name, uppercased; `·` if there is none.
public enum MerchantInitial {
    public static func of(_ name: String) -> String {
        for character in name where character.isLetter || character.isNumber {
            return String(character).uppercased()
        }
        return "\u{00B7}"
    }
}

/// Live normalization of an amount typed in `BBTextField(keyboard: .amount)` (components.md §1.4): keeps ASCII
/// digits, a leading minus (also U+2212) and one decimal separator — "," or "." typed, the locale's one written.
public enum AmountInput {
    public static func normalize(_ raw: String, locale: BBLocale) -> String {
        let decimal: Character = locale == .enGB ? "." : ","
        var out = ""
        var hasDecimal = false
        for (i, ch) in raw.enumerated() {
            if ch.isASCII && ch.isNumber {
                out.append(ch)
            } else if (ch == "-" || ch == "\u{2212}") && i == 0 {
                out.append("-")
            } else if (ch == "," || ch == "."), !hasDecimal {
                hasDecimal = true
                out.append(decimal)
            }
        }
        return out
    }
}
