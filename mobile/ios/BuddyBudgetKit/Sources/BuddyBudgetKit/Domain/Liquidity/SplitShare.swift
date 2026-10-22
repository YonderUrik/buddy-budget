import Foundation

/// A «Dividi» option: how much of a movement really counts as yours (`lib/liquidity/split.ts`).
public struct SplitPreset: Hashable, Sendable {
    public let key: String
    /// Italian catalog key ("Tutta", "Metà", …): translate through the string catalog.
    public let label: String
    /// Number of equal parts the amount is split into (1 = all yours).
    public let parts: Int
}

/// «Dividi» split maths, ported 1:1 from `lib/liquidity/split.ts`. Every result uses JS `round2`.
public enum SplitShare {
    public static let presets: [SplitPreset] = [
        SplitPreset(key: "tutta", label: "Tutta", parts: 1),
        SplitPreset(key: "meta", label: "Metà", parts: 2),
        SplitPreset(key: "terzo", label: "Un terzo", parts: 3),
        SplitPreset(key: "quarto", label: "Un quarto", parts: 4),
    ]

    /// Clamps your share to `[0, total]`; NaN means the whole total.
    public static func clampOwnShare(_ share: Double, total: Double) -> Double {
        if share.isNaN { return total }
        return JSNumber.round2(jsMin(jsMax(share, 0), total))
    }

    /// Your share for a preset: the amount divided by the number of parts.
    public static func ownShareForPreset(total: Double, parts: Int) -> Double {
        clampOwnShare(total / Double(parts), total: total)
    }

    /// Part excluded from the count (the one that is saved) given your share.
    public static func excludedFromOwnShare(total: Double, ownShare: Double) -> Double {
        JSNumber.round2(total - clampOwnShare(ownShare, total: total))
    }

    /// The preset matching your share exactly (within half a cent), if any.
    public static func matchPreset(total: Double, ownShare: Double) -> SplitPreset? {
        presets.first { abs(ownShareForPreset(total: total, parts: $0.parts) - ownShare) < 0.005 }
    }

    /// JS `Math.min` / `Math.max` (NaN propagates).
    static func jsMin(_ a: Double, _ b: Double) -> Double { a.isNaN || b.isNaN ? .nan : Swift.min(a, b) }
    static func jsMax(_ a: Double, _ b: Double) -> Double { a.isNaN || b.isNaN ? .nan : Swift.max(a, b) }
}
