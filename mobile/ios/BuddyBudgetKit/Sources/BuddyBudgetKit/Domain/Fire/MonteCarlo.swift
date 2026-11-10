import Foundation

// Port of lib/calc/monte-carlo.ts (domain/fire-and-simulations.md). Pure and deterministic: same seed → same paths,
// bit-exact PRNG (mulberry32). Value types only, so `runMonteCarlo` / `compareRules` can run on any thread.

/// Withdrawal rules (`WithdrawalRule`); raw values are the web's keys.
public enum WithdrawalRule: String, CaseIterable, Sendable {
    case fissa
    case percentuale
    case guytonKlinger = "guyton-klinger"
    case vanguard
}

/// Public pension that reduces the portfolio withdrawal after `startsAfterYears` years of retirement.
public struct MonteCarloPublicPension: Hashable, Sendable {
    public var annual: Double
    public var startsAfterYears: Double
    public init(annual: Double, startsAfterYears: Double) {
        self.annual = annual
        self.startsAfterYears = startsAfterYears
    }
}

/// `MonteCarloInput`.
public struct MonteCarloInput: Hashable, Sendable {
    public var startingWealth: Double
    public var annualSavings: Double
    public var accumulationYears: Double
    public var retirementYears: Double
    public var annualSpending: Double
    public var expectedReturn: Double
    public var volatility: Double
    /// Used only by Guyton-Klinger; nil → 0.02.
    public var inflation: Double?
    public var rule: WithdrawalRule
    public var publicPension: MonteCarloPublicPension?
    /// nil → `MonteCarlo.defaultPaths`.
    public var paths: Double?
    /// nil → 1. The web's `seed >>> 0` / `seed ^ …` see the value as 32 bits.
    public var seed: UInt32?

    public init(
        startingWealth: Double, annualSavings: Double, accumulationYears: Double, retirementYears: Double,
        annualSpending: Double, expectedReturn: Double, volatility: Double, inflation: Double? = nil,
        rule: WithdrawalRule, publicPension: MonteCarloPublicPension? = nil, paths: Double? = nil, seed: UInt32? = nil
    ) {
        self.startingWealth = startingWealth
        self.annualSavings = annualSavings
        self.accumulationYears = accumulationYears
        self.retirementYears = retirementYears
        self.annualSpending = annualSpending
        self.expectedReturn = expectedReturn
        self.volatility = volatility
        self.inflation = inflation
        self.rule = rule
        self.publicPension = publicPension
        self.paths = paths
        self.seed = seed
    }
}

public struct MonteCarloWealthBand: Hashable, Sendable {
    public let year: Int
    public let p10: Double, p25: Double, p50: Double, p75: Double, p90: Double
}

public struct MonteCarloSpendingBand: Hashable, Sendable {
    public let year: Int
    public let p10: Double, p50: Double, p90: Double
}

/// `MonteCarloResult`.
public struct MonteCarloResult: Hashable, Sendable {
    public let rule: WithdrawalRule
    public let paths: Int
    public let successRate: Double
    public let wealth: [MonteCarloWealthBand]
    public let ruinByYear: [Double]
    public let spending: [MonteCarloSpendingBand]
    public let endingWealth: MonteCarloEnding
    public let maxCut: MonteCarloMaxCut
}

/// Ending wealth percentiles over the paths.
public struct MonteCarloEnding: Hashable, Sendable {
    public let p10: Double, p50: Double, p90: Double
}

/// Largest spending cut vs. the first year: median and 90th percentile over the paths (0-1).
public struct MonteCarloMaxCut: Hashable, Sendable {
    public let median: Double, p90: Double
}

/// mulberry32 32-bit PRNG; `next()` is the web's returned closure.
public struct Mulberry32: Sendable {
    private var a: UInt32
    public init(seed: UInt32) { a = seed }

    public mutating func next() -> Double {
        a = a &+ 0x6D2B_79F5
        var t = a
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

public enum MonteCarlo {
    public static let withdrawalRules = WithdrawalRule.allCases
    public static let defaultPaths = 3000
    public static let maxPaths = 10000
    public static let gkBand = 0.2
    public static let gkAdjustment = 0.1
    public static let gkNoCutLastYears = 15
    public static let vanguardCeiling = 0.05
    public static let vanguardFloor = 0.025

    public static func mulberry32(_ seed: UInt32) -> Mulberry32 { Mulberry32(seed: seed) }

    /// Standard normal (Box-Muller, cosine branch); consumes two uniforms.
    public static func gaussian(_ rand: inout Mulberry32) -> Double {
        let u = max(rand.next(), Double.ulpOfOne)
        let v = rand.next()
        return (-2 * log(u)).squareRoot() * cos(2 * Double.pi * v)
    }

    /// Percentile (0-100) with linear interpolation on an already sorted array.
    public static func percentile(_ sorted: [Double], _ p: Double) -> Double {
        if sorted.isEmpty { return 0 }
        let pos = (min(max(p, 0), 100) / 100) * Double(sorted.count - 1)
        let lo = Int(pos.rounded(.down))
        let hi = Int(pos.rounded(.up))
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - Double(lo))
    }

    /// Per-path seed (private in the web; exposed for the vectors).
    public static func pathSeed(_ seed: UInt32, _ index: Int) -> UInt32 {
        ((seed ^ 0x9E37_79B9) &* 0x85EB_CA6B) &+ (UInt32(truncatingIfNeeded: index + 1) &* 0xC2B2_AE35)
    }

    /// Lognormal parameters with arithmetic mean `1 + r` and deviation `sigma`.
    public static func lognormalParams(expectedReturn: Double, volatility: Double) -> (mu: Double, sd: Double) {
        let mean = 1 + expectedReturn
        let variance = log(1 + pow(volatility / mean, 2))
        return (log(mean) - variance / 2, variance.squareRoot())
    }

    /// `isCancelled` is polled once per path so a superseded run stops early instead of keeping a CPU busy (the caller
    /// discards that partial result).
    public static func runMonteCarlo(_ input: MonteCarloInput, isCancelled: () -> Bool = { false }) -> MonteCarloResult {
        let paths = Int(min(max(JSNumber.round(input.paths ?? Double(defaultPaths)), 1), Double(maxPaths)))
        let seed = input.seed ?? 1
        let accum = Int(max(0, JSNumber.round(input.accumulationYears)))
        let ret = Int(max(1, JSNumber.round(input.retirementYears)))
        let inflation = input.inflation ?? 0.02
        let (mu, sd) = lognormalParams(expectedReturn: input.expectedReturn, volatility: input.volatility)
        let pension = input.publicPension.flatMap { $0.annual > 0 ? $0 : nil }
        let pensionStart: Double = pension.map { max(0, JSNumber.round($0.startsAfterYears)) } ?? .infinity
        let pensionAnnual = pension?.annual ?? 0

        let total = accum + ret
        var wealthCols = Array(repeating: [Double](repeating: 0, count: paths), count: total + 1)
        var spendCols = Array(repeating: [Double](repeating: 0, count: paths), count: ret)
        var ruinCounts = [Int](repeating: 0, count: ret)
        var endings = [Double](repeating: 0, count: paths)
        var cuts = [Double](repeating: 0, count: paths)
        var successes = 0

        for i in 0..<paths {
            if isCancelled() { break }
            var rand = mulberry32(pathSeed(seed, i))
            var wealth = input.startingWealth
            wealthCols[0][i] = wealth
            for y in 0..<accum {
                wealth = max(0, wealth * exp(mu + sd * gaussian(&rand)) + input.annualSavings)
                wealthCols[y + 1][i] = wealth
            }

            let retirementWealth = wealth
            let need0 = max(0, input.annualSpending - (pensionStart == 0 ? pensionAnnual : 0))
            let rate0 = retirementWealth > 0 ? need0 / retirementWealth : 0
            var prev = need0
            var rate = rate0
            var lastReturn = 0.0
            var ruined = false
            var minSpend = input.annualSpending

            for k in 0..<ret {
                let kd = Double(k)
                let pensionNow = kd >= pensionStart ? pensionAnnual : 0
                let remaining = ret - k
                var withdrawal: Double
                if k > 0 && kd == pensionStart {
                    let rebased = max(0, prev - pensionAnnual)
                    if prev > 0 { rate *= rebased / prev }
                    prev = rebased
                }
                if ruined || wealth <= 0 {
                    withdrawal = 0
                } else {
                    switch input.rule {
                    case .fissa:
                        withdrawal = max(0, input.annualSpending - pensionNow)
                    case .percentuale:
                        withdrawal = rate * wealth
                    case .guytonKlinger:
                        withdrawal = k == 0 ? need0 : lastReturn < 0 && prev / wealth > rate0 ? prev / (1 + inflation) : prev
                        let current = withdrawal / wealth
                        if current > rate0 * (1 + gkBand) && remaining > gkNoCutLastYears { withdrawal *= 1 - gkAdjustment }
                        else if current < rate0 * (1 - gkBand) { withdrawal *= 1 + gkAdjustment }
                    case .vanguard:
                        let target = rate0 * wealth
                        withdrawal = k == 0 ? need0 : min(max(target, prev * (1 - vanguardFloor)), prev * (1 + vanguardCeiling))
                    }
                }
                withdrawal = min(withdrawal, wealth)
                prev = withdrawal

                let spent = withdrawal + pensionNow
                spendCols[k][i] = spent
                minSpend = min(minSpend, spent)

                wealth -= withdrawal
                let growth = exp(mu + sd * gaussian(&rand))
                lastReturn = growth - 1
                wealth *= growth
                if !ruined && (wealth <= 0 || (input.rule == .fissa && withdrawal < input.annualSpending - pensionNow - 1e-9)) {
                    ruined = true
                    for r in k..<ret { ruinCounts[r] += 1 }
                }
                if ruined { wealth = 0 }
                wealthCols[accum + k + 1][i] = wealth
            }

            let firstSpend = spendCols[0][i]
            cuts[i] = firstSpend > 0 ? max(0, 1 - minSpend / max(firstSpend, input.annualSpending)) : 1
            endings[i] = wealth
            if !ruined { successes += 1 }
        }

        let wealthBands = wealthCols.enumerated().map { year, col -> MonteCarloWealthBand in
            let s = col.sorted()
            return MonteCarloWealthBand(year: year, p10: percentile(s, 10), p25: percentile(s, 25), p50: percentile(s, 50),
                                        p75: percentile(s, 75), p90: percentile(s, 90))
        }
        let spending = spendCols.enumerated().map { year, col -> MonteCarloSpendingBand in
            let s = col.sorted()
            return MonteCarloSpendingBand(year: year, p10: percentile(s, 10), p50: percentile(s, 50), p90: percentile(s, 90))
        }
        let endSorted = endings.sorted()
        let cutSorted = cuts.sorted()
        let n = Double(paths)
        return MonteCarloResult(
            rule: input.rule, paths: paths, successRate: Double(successes) / n, wealth: wealthBands,
            ruinByYear: ruinCounts.map { Double($0) / n }, spending: spending,
            endingWealth: MonteCarloEnding(p10: percentile(endSorted, 10), p50: percentile(endSorted, 50), p90: percentile(endSorted, 90)),
            maxCut: MonteCarloMaxCut(median: percentile(cutSorted, 50), p90: percentile(cutSorted, 90))
        )
    }

    /// All rules on the same paths (same seed).
    public static func compareRules(_ input: MonteCarloInput, isCancelled: () -> Bool = { false }) -> [MonteCarloResult] {
        withdrawalRules.map { rule in
            var copy = input
            copy.rule = rule
            return runMonteCarlo(copy, isCancelled: isCancelled)
        }
    }
}
