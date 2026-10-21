import Foundation

/// Exact decimal view of a `Double`, as ICU sees it: the **shortest round-trip** digits
/// (`0.005` is `5e-3`, not `0.005000000000000000104…`), then rounded in decimal.
/// That is why `formatCurrency(0.005)` shows `0,01 €` and `1.005` rounds to `1.01`,
/// unlike `toFixed`. See spec/domain/formatting-localization.md.
struct FormatDecimal: Equatable {
    /// Significant digits (0…9), no leading or trailing zeros. Empty means zero.
    var digits: [UInt8]
    /// value = 0.d1d2d3… × 10^exponent
    var exponent: Int

    static let zero = FormatDecimal(digits: [], exponent: 0)

    var isZero: Bool { digits.isEmpty }

    /// floor(log10(value)) for a non-zero value.
    var magnitude: Int { exponent - 1 }

    /// Shortest round-trip digits of `|value|` (finite values only).
    init(_ value: Double) {
        let magnitude = Swift.abs(value)
        if magnitude == 0 || !magnitude.isFinite {
            self = .zero
            return
        }
        // Swift's description is the shortest round-trip representation
        // ("1234.5", "0.005", "1e-05", "1.2e+16").
        self = FormatDecimal.parse(magnitude.description)
    }

    init(digits: [UInt8], exponent: Int) {
        self.digits = digits
        self.exponent = exponent
        normalize()
    }

    /// Parses "123.45", "1e-05", "1.2345e+16".
    static func parse(_ text: String) -> FormatDecimal {
        var mantissa = Substring(text)
        var exp = 0
        if let e = text.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = text[..<e]
            exp = Int(text[text.index(after: e)...].replacingOccurrences(of: "+", with: "")) ?? 0
        }
        var intPart = mantissa
        var fracPart: Substring = ""
        if let dot = mantissa.firstIndex(of: ".") {
            intPart = mantissa[..<dot]
            fracPart = mantissa[mantissa.index(after: dot)...]
        }
        let all: [UInt8] = (intPart + fracPart).compactMap { $0.wholeNumberValue.map { UInt8($0) } }
        return FormatDecimal(digits: all, exponent: intPart.count + exp)
    }

    private mutating func normalize() {
        while let first = digits.first, first == 0 {
            digits.removeFirst()
            exponent -= 1
        }
        while let last = digits.last, last == 0 { digits.removeLast() }
        if digits.isEmpty { exponent = 0 }
    }

    /// Multiplies by 10^n (exact decimal shift, as ICU does for percent and compact scaling).
    func shifted(by n: Int) -> FormatDecimal {
        isZero ? self : FormatDecimal(digits: digits, exponent: exponent + n)
    }

    /// Rounds to `fractionDigits` decimals, half away from zero (ICU halfExpand) on the magnitude.
    func rounded(fractionDigits: Int) -> FormatDecimal {
        if isZero { return self }
        let keep = exponent + fractionDigits
        if keep >= digits.count { return self }
        if keep < 0 { return .zero }
        let roundUp = digits[keep] >= 5
        var kept = Array(digits[0..<keep])
        var newExponent = exponent
        if roundUp {
            var i = kept.count - 1
            while i >= 0 {
                if kept[i] == 9 {
                    kept[i] = 0
                    i -= 1
                } else {
                    kept[i] += 1
                    break
                }
            }
            if i < 0 {
                kept.insert(1, at: 0)
                newExponent += 1
            }
        }
        return FormatDecimal(digits: kept, exponent: newExponent)
    }

    /// Integer digits ("0" when < 1).
    var integerDigits: String {
        if exponent <= 0 || isZero { return "0" }
        var s = ""
        for i in 0..<exponent { s.append(Character(String(i < digits.count ? digits[i] : 0))) }
        return s
    }

    /// Fraction digits, padded with zeros to at least `minimum` (never trimmed below it).
    func fractionDigits(minimum: Int) -> String {
        var s = ""
        if !isZero {
            if exponent < 0 { s += String(repeating: "0", count: -exponent) }
            let start = Swift.max(exponent, 0)
            if start < digits.count {
                for i in start..<digits.count { s.append(Character(String(digits[i]))) }
            }
        }
        if s.count < minimum { s += String(repeating: "0", count: minimum - s.count) }
        return s
    }
}
