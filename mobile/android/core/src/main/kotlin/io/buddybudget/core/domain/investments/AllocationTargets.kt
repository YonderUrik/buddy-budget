package io.buddybudget.core.domain.investments

/** Target weight of one instrument (`TargetInput`). */
data class AllocationTarget(val instrumentId: String, val weight: Double)

/** A position's value; null = no price. */
data class AllocationPosition(val instrumentId: String, val value: Double?)

enum class AllocationStatus(val key: String) { IN_LINEA("in_linea"), SOTTO("sotto"), SOPRA("sopra") }

data class AllocationRow(
    val instrumentId: String,
    val value: Double,
    val currentWeight: Double,
    val targetWeight: Double,
    /** current − target (positive = above target). */
    val drift: Double,
    val status: AllocationStatus,
    /** false for held instruments without a target. */
    val inTarget: Boolean,
)

data class AllocationAnalysis(
    /** Most under target first. */
    val rows: List<AllocationRow>,
    val total: Double,
    val unpricedIds: List<String>,
    val maxDrift: Double,
)

/** Suggested buy for the next contribution. */
data class AllocationSuggestion(
    val instrumentId: String,
    val amount: Double,
    /** Weight after the buy (over total + contribution). */
    val weightAfter: Double,
    val targetWeight: Double,
)

/** Target-allocation editor helpers (`lib/investments/allocation.ts`). Same as Swift `AllocationTargets`. */
object AllocationTargets {
    const val ALLOCATION_TOLERANCE = 0.05
    const val MIN_SUGGESTION_SHARE = 0.1
    const val TARGET_SUM_TOLERANCE = 0.0001

    private fun statusFor(drift: Double): AllocationStatus = when {
        Math.abs(drift) <= ALLOCATION_TOLERANCE -> AllocationStatus.IN_LINEA
        drift < 0 -> AllocationStatus.SOTTO
        else -> AllocationStatus.SOPRA
    }

    /** JS comparator result → Int (NaN counts as equal). */
    private fun sign(x: Double): Int = if (x < 0) -1 else if (x > 0) 1 else 0

    /**
     * Current weights (priced positions) against the target. The app normally gets this from
     * `GET /api/investments/view`; ported because [suggestContribution] runs on it while editing.
     */
    fun analyzeAllocation(positions: List<AllocationPosition>, targets: List<AllocationTarget>): AllocationAnalysis {
        val unpriced = LinkedHashSet(positions.filter { it.value == null }.map { it.instrumentId })
        val values = LinkedHashMap<String, Double>()
        for (p in positions) if (p.value != null && p.value > 0) values[p.instrumentId] = (values[p.instrumentId] ?: 0.0) + p.value
        val total = values.values.fold(0.0) { s, v -> s + v }
        val targetById = LinkedHashMap<String, Double>().apply { for (t in targets) put(t.instrumentId, t.weight) }
        val ids = LinkedHashSet(targets.map { it.instrumentId } + values.keys).filter { it !in unpriced }
        val rows = ids.map { id ->
            val value = values[id] ?: 0.0
            val currentWeight = if (total > 0) value / total else 0.0
            val targetWeight = targetById[id] ?: 0.0
            val drift = currentWeight - targetWeight
            AllocationRow(id, value, currentWeight, targetWeight, drift, statusFor(drift), targetById.containsKey(id))
        }.sortedWith { a, b -> sign(a.drift - b.drift) }
        return AllocationAnalysis(rows, total, unpriced.toList(), rows.fold(0.0) { m, r -> Math.max(m, Math.abs(r.drift)) })
    }

    private data class Candidate(val instrumentId: String, val value: Double, val weight: Double)

    /** Water filling: level λ with Σ max(0, wᵢ·λ − vᵢ) = amount. Returns buys > 0 in fill order. */
    private fun waterFill(candidates: List<Candidate>, amount: Double): LinkedHashMap<String, Double> {
        val sorted = candidates.sortedWith { a, b -> sign(a.value / a.weight - b.value / b.weight) }
        var valueSum = 0.0
        var weightSum = 0.0
        var level = 0.0
        var count = 0
        for (k in sorted.indices) {
            valueSum += sorted[k].value
            weightSum += sorted[k].weight
            level = (amount + valueSum) / weightSum
            count = k + 1
            val next = sorted.getOrNull(k + 1)
            if (next == null || level <= next.value / next.weight) break
        }
        val result = LinkedHashMap<String, Double>()
        for (c in sorted.take(count)) {
            val buy = c.weight * level - c.value
            if (buy > 0) result[c.instrumentId] = buy
        }
        return result
    }

    /**
     * Where to put the next contribution to approach the target without selling. Buys under
     * [MIN_SUGGESTION_SHARE] of the amount are dropped and the amount redistributed.
     */
    fun suggestContribution(analysis: AllocationAnalysis, amount: Double): List<AllocationSuggestion> {
        if (!(amount > 0)) return emptyList()
        var candidates = analysis.rows.filter { it.targetWeight > 0 }.map { Candidate(it.instrumentId, it.value, it.targetWeight) }
        var buys = LinkedHashMap<String, Double>()
        while (candidates.isNotEmpty()) {
            buys = waterFill(candidates, amount)
            val smallest = buys.entries.sortedWith { a, b -> sign(a.value - b.value) }.firstOrNull()
            if (smallest == null || buys.size <= 1 || smallest.value >= amount * MIN_SUGGESTION_SHARE) break
            val current = buys
            candidates = candidates.filter { it.instrumentId != smallest.key && current.containsKey(it.instrumentId) }
        }
        val rowById = analysis.rows.associateBy { it.instrumentId }
        val newTotal = analysis.total + amount
        return buys.entries.map { (id, buy) ->
            val row = rowById[id]
            AllocationSuggestion(id, buy, if (newTotal > 0) ((row?.value ?: 0.0) + buy) / newTotal else 0.0, row?.targetWeight ?: 0.0)
        }.sortedWith { a, b -> sign(b.amount - a.amount) }
    }

    /** Target weights summing to 100% (within tolerance)? */
    fun isCompleteTarget(targets: List<AllocationTarget>): Boolean {
        val sum = targets.fold(0.0) { s, t -> s + t.weight }
        return targets.isNotEmpty() && Math.abs(sum - 1) <= TARGET_SUM_TOLERANCE
    }
}
