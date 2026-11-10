import Foundation

/// Deterministic number, currency, percent, date and relative-time formatting, identical to the web
/// (`lib/format.ts`, `lib/localization/format.ts`, Node 25 / ICU 78 / CLDR 48) byte for byte.
///
/// Never uses `NumberFormatter` / `DateFormatter` / `FormatStyle`: output is built from the bundled
/// `locale-data.json` so iOS, Android and the web agree regardless of the OS's CLDR version.
/// Function names and options mirror the web's `localizedFormats(locale)`; the locale is always
/// explicit (the web defaults to `it-IT`, mobile always passes the account locale).
/// Spec: `spec/domain/formatting-localization.md` § "Native API". Golden vectors: `formatting.json`.
public enum BBFormat {
    /// Shown instead of every `formatCurrency` output while amounts are hidden (4 × U+2022).
    public static let amountMask = "\u{2022}\u{2022}\u{2022}\u{2022}"
    /// U+2212, used by the signed formatters.
    public static let minusSign = "\u{2212}"

    /// Raw bytes of the bundled `locale-data.json` (to check it matches the spec copy).
    public static func bundledLocaleData() -> Data? { FormatLocaleData.bundledData() }

    // MARK: Numbers

    /// `Intl.NumberFormat(locale, {minimumFractionDigits, maximumFractionDigits})` (decimal style,
    /// half-expand rounding on the shortest decimal representation, locale grouping).
    public static func formatNumber(_ value: Double, minimumFractionDigits: Int = 0, maximumFractionDigits: Int = 3,
                                    locale: BBLocale) -> String {
        let t = FormatLocaleData.table(locale)
        return signed(value, t, body: digitsString(value, min: minimumFractionDigits, max: maximumFractionDigits,
                                                   minGrouping: t.minimumGroupingDigits, t))
    }

    /// `formatRatio(value, digits = 1)`: plain decimal with exactly `digits` decimals.
    public static func formatRatio(_ value: Double, digits: Int = 1, locale: BBLocale) -> String {
        formatNumber(value, minimumFractionDigits: digits, maximumFractionDigits: digits, locale: locale)
    }

    /// `formatPct(ratio, digits = 1)`: **input is a ratio** (0.1234 → "12,3%").
    public static func formatPct(_ ratio: Double, digits: Int = 1, locale: BBLocale) -> String {
        let t = FormatLocaleData.table(locale)
        if !ratio.isFinite { return nonFinite(ratio, t) }
        let d = FormatDecimal(ratio).shifted(by: 2).rounded(fractionDigits: digits)
        let body = render(d, min: digits, minGrouping: t.minimumGroupingDigits, t)
        return (ratio.sign == .minus ? t.minusSign : "") + t.percentPattern.replacingOccurrences(of: "#", with: body)
    }

    /// `formatSignedPct(ratio)`: "+" or "−" (U+2212) then `formatPct(|ratio|)`. Zero shows "+".
    public static func formatSignedPct(_ ratio: Double, locale: BBLocale) -> String {
        (ratio < 0 ? minusSign : "+") + formatPct(Swift.abs(ratio), locale: locale)
    }

    /// `formatCompactAmount(value)`: `notation:"compact", maximumFractionDigits:1`, no currency
    /// ("1,2K", "2,5 Mln", "1.2bn", de "15.300", "2,5 Mio.").
    public static func formatCompactAmount(_ value: Double, locale: BBLocale) -> String {
        let t = FormatLocaleData.table(locale)
        if !value.isFinite { return nonFinite(value, t) }
        let d = FormatDecimal(value)
        var prefix = "", suffix = ""
        var rounded = d.rounded(fractionDigits: 1)
        if !d.isZero {
            var magnitude = d.magnitude
            var divisor = compactDivisor(magnitude, t)
            rounded = d.shifted(by: -divisor).rounded(fractionDigits: 1)
            if !rounded.isZero {
                let newMagnitude = rounded.magnitude + divisor
                if newMagnitude > magnitude, compactDivisor(newMagnitude, t) != divisor {
                    magnitude = newMagnitude
                    divisor = compactDivisor(magnitude, t)
                    rounded = d.shifted(by: -divisor).rounded(fractionDigits: 1)
                }
            }
            if let entry = t.compact[min(magnitude, 14)], magnitude >= 3 {
                prefix = entry.prefix
                suffix = entry.suffix
            }
        }
        // ICU uses minimum grouping 2 for compact notation in every locale (de "1234" but "15.300").
        let body = render(rounded, min: 0, minGrouping: 2, t)
        return (value.sign == .minus ? t.minusSign : "") + prefix + body + suffix
    }

    private static func compactDivisor(_ magnitude: Int, _ t: FormatLocaleTable) -> Int {
        magnitude < 3 ? 0 : (t.compact[min(magnitude, 14)]?.divisorExponent ?? 0)
    }

    // MARK: Currency

    /// `formatCurrency(value, currency, {maximumFractionDigits = 2})`. The minimum fraction digits come
    /// from the currency (2), capped by the maximum. Negative values (and negative zero after rounding,
    /// "-0,00 €") use the ASCII hyphen. `masked` returns `amountMask` (privacy mode).
    public static func formatCurrency(_ value: Double, currency: String, locale: BBLocale,
                                      maximumFractionDigits: Int = 2, masked: Bool = false) -> String {
        if masked { return amountMask }
        let t = FormatLocaleData.table(locale)
        let minimum = min(currencyDigits, maximumFractionDigits)
        let body = value.isFinite
            ? digitsString(value, min: minimum, max: maximumFractionDigits, minGrouping: t.minimumGroupingDigits, t)
            : (value.isNaN ? "NaN" : "\u{221E}")
        let pattern = currencyPattern(currency, t)
        return (value.sign == .minus && !value.isNaN ? t.minusSign : "") + pattern.replacingOccurrences(of: "#", with: body)
    }

    /// `formatSignedCurrency(value, currency)`: "+" or "−" (U+2212) then `formatCurrency(|value|)`. Zero shows "+".
    public static func formatSignedCurrency(_ value: Double, currency: String, locale: BBLocale, masked: Bool = false) -> String {
        (value < 0 ? minusSign : "+") + formatCurrency(Swift.abs(value), currency: currency, locale: locale, masked: masked)
    }

    /// `formatPrice(value, currency)`: 4 decimals when |value| < 10, else 2.
    public static func formatPrice(_ value: Double, currency: String, locale: BBLocale, masked: Bool = false) -> String {
        formatCurrency(value, currency: currency, locale: locale,
                       maximumFractionDigits: Swift.abs(value) < 10 ? 4 : 2, masked: masked)
    }

    /// `getCurrencySymbol(currency)`: the currency format of 0 without digits, spaces and separators
    /// (it "USD", en "US$", de "$").
    public static func getCurrencySymbol(_ currency: String, locale: BBLocale) -> String {
        let pattern = currencyPattern(currency, FormatLocaleData.table(locale))
        return String(pattern.unicodeScalars.filter { scalar in
            !(scalar == "#" || scalar == "." || scalar == "," || CharacterSet.decimalDigits.contains(scalar)
                || CharacterSet.whitespacesAndNewlines.contains(scalar))
        }.map(Character.init))
    }

    /// Hero amounts with a muted tail (`splitMoney`): `main` before the decimal separator, `tail` = separator,
    /// decimals and any trailing currency. it `{"1234", ",50 €"}`, en `{"€1,234", ".50"}`.
    public static func splitMoney(_ value: Double, currency: String, locale: BBLocale) -> (main: String, tail: String) {
        let t = FormatLocaleData.table(locale)
        let formatted = formatCurrency(value, currency: currency, locale: locale)
        let body = digitsString(value, min: currencyDigits, max: currencyDigits, minGrouping: t.minimumGroupingDigits, t)
        guard let bodyRange = formatted.range(of: body),
              let decimalRange = formatted.range(of: t.decimal, range: bodyRange) else { return (formatted, "") }
        return (String(formatted[..<decimalRange.lowerBound]), String(formatted[decimalRange.lowerBound...]))
    }

    /// Currency digits: 2 for every currency the app supports (EUR, USD, GBP, CHF).
    static let currencyDigits = 2

    private static func currencyPattern(_ currency: String, _ t: FormatLocaleTable) -> String {
        if let known = t.currency[currency] { return known.pattern }
        // Unknown currency: ICU shows the ISO code; reuse the EUR layout with the code as symbol.
        let eur = t.currency["EUR"]!
        return eur.pattern.replacingOccurrences(of: eur.symbol, with: currency)
    }

    // MARK: Parsing

    /// Web `parseAmount` (`lib/debts/add-form.ts`): Italian-style input. With a comma, dots are thousands
    /// separators and the comma is the decimal ("1.250,50" → 1250.5); without a comma the text is a JS number
    /// ("1250.5", "1.250" → 1.25). Empty or invalid → nil.
    public static func parseAmount(_ text: String) -> Double? {
        let trimmed = JSNumber.trim(text)
        if trimmed.isEmpty { return nil }
        let normalized: String
        if trimmed.contains(",") {
            let noDots = trimmed.replacingOccurrences(of: ".", with: "")
            if let comma = noDots.firstIndex(of: ",") {
                normalized = noDots.replacingCharacters(in: comma...comma, with: ".")
            } else {
                normalized = noDots
            }
        } else {
            normalized = trimmed
        }
        guard let value = JSNumber.parse(normalized), value.isFinite else { return nil }
        return value
    }

    /// Web account-form `parseAmount` (`lib/validation/accounts.ts`): the first comma becomes the decimal
    /// point, dots are kept ("1.250,50" → nil, "12,5" → 12.5). Empty or invalid → nil.
    public static func parseAccountAmount(_ raw: String) -> Double? {
        var normalized = JSNumber.trim(raw)
        if let comma = normalized.firstIndex(of: ",") { normalized.replaceSubrange(comma...comma, with: ".") }
        if normalized.isEmpty { return nil }
        guard let value = JSNumber.parse(normalized), value.isFinite else { return nil }
        return value
    }

    // MARK: Internals

    static func digitsString(_ value: Double, min: Int, max: Int, minGrouping: Int, _ t: FormatLocaleTable) -> String {
        render(FormatDecimal(value).rounded(fractionDigits: max), min: min, minGrouping: minGrouping, t)
    }

    static func render(_ d: FormatDecimal, min: Int, minGrouping: Int, _ t: FormatLocaleTable) -> String {
        let intDigits = d.integerDigits
        var integer = ""
        let count = intDigits.count
        if count >= 3 + minGrouping {
            for (i, ch) in intDigits.enumerated() {
                if i > 0, (count - i) % 3 == 0 { integer += t.group }
                integer.append(ch)
            }
        } else {
            integer = intDigits
        }
        let fraction = d.fractionDigits(minimum: min)
        return fraction.isEmpty ? integer : integer + t.decimal + fraction
    }

    private static func signed(_ value: Double, _ t: FormatLocaleTable, body: String) -> String {
        if !value.isFinite { return nonFinite(value, t) }
        return (value.sign == .minus ? t.minusSign : "") + body
    }

    private static func nonFinite(_ value: Double, _ t: FormatLocaleTable) -> String {
        value.isNaN ? "NaN" : (value < 0 ? t.minusSign : "") + "\u{221E}"
    }
}

/// JavaScript numeric helpers (`Number(string)`, `Math.round`), ported literally.
public enum JSNumber {
    /// JS `String.prototype.trim` whitespace: WhiteSpace + LineTerminator (incl. U+00A0, U+FEFF, U+202F, Zs).
    public static func trim(_ s: String) -> String {
        func isJSSpace(_ u: Unicode.Scalar) -> Bool {
            switch u.value {
            case 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
                return true
            default:
                return false
            }
        }
        let scalars = Array(s.unicodeScalars)
        var start = 0, end = scalars.count
        while start < end, isJSSpace(scalars[start]) { start += 1 }
        while end > start, isJSSpace(scalars[end - 1]) { end -= 1 }
        var out = String.UnicodeScalarView()
        out.append(contentsOf: scalars[start..<end])
        return String(out)
    }

    /// JS `Number(text)`; nil where JS gives NaN. Empty/blank → 0 (as in JS).
    public static func parse(_ text: String) -> Double? {
        let s = trim(text)
        if s.isEmpty { return 0 }
        let lower = s.lowercased()
        for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] where lower.hasPrefix(prefix) {
            let body = s.dropFirst(2)
            guard !body.isEmpty, body.allSatisfy({ $0.isASCII && $0.hexDigitValue.map { $0 < radix } == true }) else { return nil }
            var v = 0.0
            for c in body { v = v * Double(radix) + Double(c.hexDigitValue!) }
            return v
        }
        var chars = Substring(s)
        var negative = false
        if let first = chars.first, first == "+" || first == "-" {
            negative = first == "-"
            chars = chars.dropFirst()
        }
        if chars == "Infinity" { return negative ? -.infinity : .infinity }
        // StrDecimalLiteral: digits [. digits] | . digits, optional exponent.
        var i = chars.startIndex
        var intDigits = 0, fracDigits = 0
        while i < chars.endIndex, chars[i].isASCII, chars[i].isNumber { intDigits += 1; i = chars.index(after: i) }
        if i < chars.endIndex, chars[i] == "." {
            i = chars.index(after: i)
            while i < chars.endIndex, chars[i].isASCII, chars[i].isNumber { fracDigits += 1; i = chars.index(after: i) }
        }
        if intDigits + fracDigits == 0 { return nil }
        if i < chars.endIndex, chars[i] == "e" || chars[i] == "E" {
            i = chars.index(after: i)
            if i < chars.endIndex, chars[i] == "+" || chars[i] == "-" { i = chars.index(after: i) }
            var expDigits = 0
            while i < chars.endIndex, chars[i].isASCII, chars[i].isNumber { expDigits += 1; i = chars.index(after: i) }
            if expDigits == 0 { return nil }
        }
        if i != chars.endIndex { return nil }
        // Swift's Double(String) is correctly rounded, like JS.
        guard let v = Double(String(chars)) ?? Double("0" + chars) else { return nil }
        return negative ? -v : v
    }

    /// JS `Math.round`: half toward +∞ (`Math.round(-2.5) == -2`).
    public static func round(_ x: Double) -> Double {
        if !x.isFinite || x == 0 { return x }
        let r = (x + 0.5).rounded(.down)
        // Guard the 0.49999999999999994 case (x + 0.5 rounds up to 1 in binary).
        if r - x > 0.5 { return r - 1 }
        return r == 0 && x < 0 ? -0.0 : r
    }

    /// `Math.round(x * 100) / 100`.
    public static func round2(_ x: Double) -> Double { round(x * 100) / 100 }

    /// `Math.round((x + Number.EPSILON) * 100) / 100` (debts' `round2`).
    public static func round2Epsilon(_ x: Double) -> Double { round((x + Double.ulpOfOne) * 100) / 100 }
}
