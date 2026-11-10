package io.buddybudget.core.domain.liquidity

import io.buddybudget.core.domain.format.JSNumber

/** A «Dividi» option: how much of a movement really counts as yours (`lib/liquidity/split.ts`). */
data class SplitPreset(
    val key: String,
    /** Italian catalog key ("Tutta", "Metà", …): translate through the string catalog. */
    val label: String,
    /** Number of equal parts the amount is split into (1 = all yours). */
    val parts: Int,
)

/** «Dividi» split maths, ported 1:1 from `lib/liquidity/split.ts`. Every result uses JS `round2`. Same as Swift `SplitShare`. */
object SplitShare {
    val presets: List<SplitPreset> = listOf(
        SplitPreset("tutta", "Tutta", 1),
        SplitPreset("meta", "Metà", 2),
        SplitPreset("terzo", "Un terzo", 3),
        SplitPreset("quarto", "Un quarto", 4),
    )

    /** Clamps your share to `[0, total]`; NaN means the whole total. */
    fun clampOwnShare(share: Double, total: Double): Double {
        if (share.isNaN()) return total
        return JSNumber.round2(Math.min(Math.max(share, 0.0), total))
    }

    /** Your share for a preset: the amount divided by the number of parts. */
    fun ownShareForPreset(total: Double, parts: Int): Double = clampOwnShare(total / parts, total)

    /** Part excluded from the count (the one that is saved) given your share. */
    fun excludedFromOwnShare(total: Double, ownShare: Double): Double = JSNumber.round2(total - clampOwnShare(ownShare, total))

    /** The preset matching your share exactly (within half a cent), if any. */
    fun matchPreset(total: Double, ownShare: Double): SplitPreset? =
        presets.firstOrNull { Math.abs(ownShareForPreset(total, it.parts) - ownShare) < 0.005 }
}
