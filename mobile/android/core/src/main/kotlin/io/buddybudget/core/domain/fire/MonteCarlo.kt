package io.buddybudget.core.domain.fire

import io.buddybudget.core.domain.format.JSNumber

// Port of lib/calc/monte-carlo.ts (domain/fire-and-simulations.md). Pure and deterministic: same seed → same paths,
// bit-exact PRNG (mulberry32, Int arithmetic wraps like Math.imul). Immutable inputs: safe on any dispatcher.

/** Withdrawal rules (`WithdrawalRule`); [key] is the web's value. */
enum class WithdrawalRule(val key: String) {
    FISSA("fissa"),
    PERCENTUALE("percentuale"),
    GUYTON_KLINGER("guyton-klinger"),
    VANGUARD("vanguard"),
    ;

    companion object {
        fun fromKey(key: String): WithdrawalRule? = entries.firstOrNull { it.key == key }
    }
}

/** Public pension that reduces the portfolio withdrawal after `startsAfterYears` years of retirement. */
data class MonteCarloPublicPension(val annual: Double, val startsAfterYears: Double)

/** `MonteCarloInput`. `inflation` null → 0.02, `paths` null → [MonteCarlo.defaultPaths], `seed` null → 1. */
data class MonteCarloInput(
    val startingWealth: Double,
    val annualSavings: Double,
    val accumulationYears: Double,
    val retirementYears: Double,
    val annualSpending: Double,
    val expectedReturn: Double,
    val volatility: Double,
    val inflation: Double? = null,
    val rule: WithdrawalRule,
    val publicPension: MonteCarloPublicPension? = null,
    val paths: Double? = null,
    val seed: UInt? = null,
)

data class MonteCarloWealthBand(val year: Int, val p10: Double, val p25: Double, val p50: Double, val p75: Double, val p90: Double)

data class MonteCarloSpendingBand(val year: Int, val p10: Double, val p50: Double, val p90: Double)

/** Ending wealth percentiles over the paths. */
data class MonteCarloEnding(val p10: Double, val p50: Double, val p90: Double)

/** Largest spending cut vs. the first year: median and 90th percentile over the paths (0-1). */
data class MonteCarloMaxCut(val median: Double, val p90: Double)

/** `MonteCarloResult`. */
data class MonteCarloResult(
    val rule: WithdrawalRule,
    val paths: Int,
    val successRate: Double,
    val wealth: List<MonteCarloWealthBand>,
    val ruinByYear: List<Double>,
    val spending: List<MonteCarloSpendingBand>,
    val endingWealth: MonteCarloEnding,
    val maxCut: MonteCarloMaxCut,
)

/** mulberry32 32-bit PRNG; [next] is the web's returned closure. */
class Mulberry32(seed: UInt) {
    private var a: Int = seed.toInt()

    fun next(): Double {
        a += 0x6D2B79F5
        var t = a
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        return ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }
}

object MonteCarlo {
    val withdrawalRules: List<WithdrawalRule> = WithdrawalRule.entries
    const val defaultPaths = 3000
    const val maxPaths = 10000
    const val gkBand = 0.2
    const val gkAdjustment = 0.1
    const val gkNoCutLastYears = 15
    const val vanguardCeiling = 0.05
    const val vanguardFloor = 0.025

    fun mulberry32(seed: UInt): Mulberry32 = Mulberry32(seed)

    /** Standard normal (Box-Muller, cosine branch); consumes two uniforms. */
    fun gaussian(rand: Mulberry32): Double {
        val u = Math.max(rand.next(), Math.ulp(1.0))
        val v = rand.next()
        return StrictMath.sqrt(-2 * StrictMath.log(u)) * StrictMath.cos(2 * Math.PI * v)
    }

    /** Percentile (0-100) with linear interpolation on an already sorted array. */
    fun percentile(sorted: List<Double>, p: Double): Double = percentile(sorted.toDoubleArray(), p)

    private fun percentile(sorted: DoubleArray, p: Double): Double {
        if (sorted.isEmpty()) return 0.0
        val pos = (Math.min(Math.max(p, 0.0), 100.0) / 100) * (sorted.size - 1)
        val lo = Math.floor(pos).toInt()
        val hi = Math.ceil(pos).toInt()
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
    }

    /** Per-path seed (private in the web; exposed for the vectors). */
    fun pathSeed(seed: UInt, index: Int): UInt =
        ((seed.toInt() xor 0x9E3779B9.toInt()) * 0x85EBCA6B.toInt() + (index + 1) * 0xC2B2AE35.toInt()).toUInt()

    /** Lognormal parameters with arithmetic mean `1 + r` and deviation `sigma`. */
    fun lognormalParams(expectedReturn: Double, volatility: Double): Pair<Double, Double> {
        val mean = 1 + expectedReturn
        val variance = StrictMath.log(1 + StrictMath.pow(volatility / mean, 2.0))
        return Pair(StrictMath.log(mean) - variance / 2, StrictMath.sqrt(variance))
    }

    /**
     * [isCancelled] is polled once per path so a superseded run stops early instead of keeping a CPU busy (the caller
     * discards that partial result).
     */
    fun runMonteCarlo(input: MonteCarloInput, isCancelled: () -> Boolean = { false }): MonteCarloResult {
        val paths = Math.min(Math.max(JSNumber.round(input.paths ?: defaultPaths.toDouble()), 1.0), maxPaths.toDouble()).toInt()
        val seed = input.seed ?: 1u
        val accum = Math.max(0.0, JSNumber.round(input.accumulationYears)).toInt()
        val ret = Math.max(1.0, JSNumber.round(input.retirementYears)).toInt()
        val inflation = input.inflation ?: 0.02
        val (mu, sd) = lognormalParams(input.expectedReturn, input.volatility)
        val pension = input.publicPension?.takeIf { it.annual > 0 }
        val pensionStart = pension?.let { Math.max(0.0, JSNumber.round(it.startsAfterYears)) } ?: Double.POSITIVE_INFINITY
        val pensionAnnual = pension?.annual ?: 0.0

        val total = accum + ret
        val wealthCols = Array(total + 1) { DoubleArray(paths) }
        val spendCols = Array(ret) { DoubleArray(paths) }
        val ruinCounts = IntArray(ret)
        val endings = DoubleArray(paths)
        val cuts = DoubleArray(paths)
        var successes = 0

        for (i in 0 until paths) {
            if (isCancelled()) break
            val rand = mulberry32(pathSeed(seed, i))
            var wealth = input.startingWealth
            wealthCols[0][i] = wealth
            for (y in 0 until accum) {
                wealth = Math.max(0.0, wealth * StrictMath.exp(mu + sd * gaussian(rand)) + input.annualSavings)
                wealthCols[y + 1][i] = wealth
            }

            val retirementWealth = wealth
            val need0 = Math.max(0.0, input.annualSpending - (if (pensionStart == 0.0) pensionAnnual else 0.0))
            val rate0 = if (retirementWealth > 0) need0 / retirementWealth else 0.0
            var prev = need0
            var rate = rate0
            var lastReturn = 0.0
            var ruined = false
            var minSpend = input.annualSpending

            for (k in 0 until ret) {
                val kd = k.toDouble()
                val pensionNow = if (kd >= pensionStart) pensionAnnual else 0.0
                val remaining = ret - k
                var withdrawal: Double
                if (k > 0 && kd == pensionStart) {
                    val rebased = Math.max(0.0, prev - pensionAnnual)
                    if (prev > 0) rate *= rebased / prev
                    prev = rebased
                }
                if (ruined || wealth <= 0) {
                    withdrawal = 0.0
                } else {
                    when (input.rule) {
                        WithdrawalRule.FISSA -> withdrawal = Math.max(0.0, input.annualSpending - pensionNow)
                        WithdrawalRule.PERCENTUALE -> withdrawal = rate * wealth
                        WithdrawalRule.GUYTON_KLINGER -> {
                            withdrawal = if (k == 0) need0 else if (lastReturn < 0 && prev / wealth > rate0) prev / (1 + inflation) else prev
                            val current = withdrawal / wealth
                            if (current > rate0 * (1 + gkBand) && remaining > gkNoCutLastYears) withdrawal *= 1 - gkAdjustment
                            else if (current < rate0 * (1 - gkBand)) withdrawal *= 1 + gkAdjustment
                        }
                        WithdrawalRule.VANGUARD -> {
                            val target = rate0 * wealth
                            withdrawal = if (k == 0) need0
                            else Math.min(Math.max(target, prev * (1 - vanguardFloor)), prev * (1 + vanguardCeiling))
                        }
                    }
                }
                withdrawal = Math.min(withdrawal, wealth)
                prev = withdrawal

                val spent = withdrawal + pensionNow
                spendCols[k][i] = spent
                minSpend = Math.min(minSpend, spent)

                wealth -= withdrawal
                val growth = StrictMath.exp(mu + sd * gaussian(rand))
                lastReturn = growth - 1
                wealth *= growth
                if (!ruined && (wealth <= 0 || (input.rule == WithdrawalRule.FISSA && withdrawal < input.annualSpending - pensionNow - 1e-9))) {
                    ruined = true
                    for (r in k until ret) ruinCounts[r]++
                }
                if (ruined) wealth = 0.0
                wealthCols[accum + k + 1][i] = wealth
            }

            val firstSpend = spendCols[0][i]
            cuts[i] = if (firstSpend > 0) Math.max(0.0, 1 - minSpend / Math.max(firstSpend, input.annualSpending)) else 1.0
            endings[i] = wealth
            if (!ruined) successes++
        }

        val wealthBands = wealthCols.mapIndexed { year, col ->
            val s = col.sortedArray()
            MonteCarloWealthBand(year, percentile(s, 10.0), percentile(s, 25.0), percentile(s, 50.0), percentile(s, 75.0), percentile(s, 90.0))
        }
        val spending = spendCols.mapIndexed { year, col ->
            val s = col.sortedArray()
            MonteCarloSpendingBand(year, percentile(s, 10.0), percentile(s, 50.0), percentile(s, 90.0))
        }
        val endSorted = endings.sortedArray()
        val cutSorted = cuts.sortedArray()
        val n = paths.toDouble()
        return MonteCarloResult(
            rule = input.rule,
            paths = paths,
            successRate = successes / n,
            wealth = wealthBands,
            ruinByYear = ruinCounts.map { it / n },
            spending = spending,
            endingWealth = MonteCarloEnding(percentile(endSorted, 10.0), percentile(endSorted, 50.0), percentile(endSorted, 90.0)),
            maxCut = MonteCarloMaxCut(percentile(cutSorted, 50.0), percentile(cutSorted, 90.0)),
        )
    }

    /** All rules on the same paths (same seed). */
    fun compareRules(input: MonteCarloInput, isCancelled: () -> Boolean = { false }): List<MonteCarloResult> =
        withdrawalRules.map { runMonteCarlo(input.copy(rule = it), isCancelled) }
}
