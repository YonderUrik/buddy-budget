/**
 * Allocazione obiettivo per strumento: confronto con i pesi attuali e suggerimento su dove mettere il prossimo
 * versamento (solo acquisti, niente vendite). Tutto puro.
 */

/** Entro questo scostamento (in punti di peso) uno strumento è "in linea" con l'obiettivo. */
export const ALLOCATION_TOLERANCE = 0.05;
/** Acquisti suggeriti sotto questa quota del versamento si scartano (commissioni fisse su ordini piccoli). */
export const MIN_SUGGESTION_SHARE = 0.1;
/** Tolleranza sulla somma dei pesi obiettivo (100%). */
export const TARGET_SUM_TOLERANCE = 0.0001;

export interface TargetInput {
  instrumentId: string;
  weight: number;
}

export type AllocationStatus = "in_linea" | "sotto" | "sopra";

export interface AllocationRow {
  instrumentId: string;
  value: number;
  currentWeight: number;
  targetWeight: number;
  /** Peso attuale − obiettivo (positivo = sopra obiettivo). */
  drift: number;
  status: AllocationStatus;
  /** false per gli strumenti posseduti ma senza obiettivo (obiettivo 0). */
  inTarget: boolean;
}

export interface AllocationAnalysis {
  /** Dal più sotto obiettivo al più sopra. */
  rows: AllocationRow[];
  /** Valore delle posizioni con un prezzo. */
  total: number;
  /** Strumenti posseduti o in obiettivo senza prezzo: esclusi dal confronto. */
  unpricedIds: string[];
  /** Scostamento massimo in valore assoluto. */
  maxDrift: number;
}

function statusFor(drift: number): AllocationStatus {
  if (Math.abs(drift) <= ALLOCATION_TOLERANCE) return "in_linea";
  return drift < 0 ? "sotto" : "sopra";
}

/** Confronta i pesi attuali (dalle posizioni con prezzo) con l'obiettivo. */
export function analyzeAllocation(
  positions: { instrumentId: string; value: number | null }[],
  targets: TargetInput[]
): AllocationAnalysis {
  const unpriced = new Set(positions.filter((p) => p.value === null).map((p) => p.instrumentId));
  const values = new Map<string, number>();
  for (const p of positions) if (p.value !== null && p.value > 0) values.set(p.instrumentId, (values.get(p.instrumentId) ?? 0) + p.value);
  const total = [...values.values()].reduce((s, v) => s + v, 0);
  const targetById = new Map(targets.map((t) => [t.instrumentId, t.weight]));
  const ids = [...new Set([...targets.map((t) => t.instrumentId), ...values.keys()])].filter((id) => !unpriced.has(id));

  const rows = ids.map((instrumentId) => {
    const value = values.get(instrumentId) ?? 0;
    const currentWeight = total > 0 ? value / total : 0;
    const targetWeight = targetById.get(instrumentId) ?? 0;
    const drift = currentWeight - targetWeight;
    return { instrumentId, value, currentWeight, targetWeight, drift, status: statusFor(drift), inTarget: targetById.has(instrumentId) };
  });
  rows.sort((a, b) => a.drift - b.drift);
  return {
    rows,
    total,
    unpricedIds: [...unpriced],
    maxDrift: rows.reduce((m, r) => Math.max(m, Math.abs(r.drift)), 0),
  };
}

/** Acquisto suggerito per il prossimo versamento. */
export interface ContributionSuggestion {
  instrumentId: string;
  amount: number;
  /** Peso dopo l'acquisto (sul totale più il versamento). */
  weightAfter: number;
  targetWeight: number;
}

/**
 * Riempimento "ad acqua": trova il livello λ per cui Σ max(0, peso_i·λ − valore_i) = importo, comprando per primo
 * lo strumento più sotto obiettivo in proporzione al suo peso. Restituisce gli importi per strumento (> 0).
 */
function waterFill(candidates: { instrumentId: string; value: number; weight: number }[], amount: number): Map<string, number> {
  const sorted = [...candidates].sort((a, b) => a.value / a.weight - b.value / b.weight);
  let valueSum = 0;
  let weightSum = 0;
  let level = 0;
  let count = 0;
  for (let k = 0; k < sorted.length; k += 1) {
    valueSum += sorted[k].value;
    weightSum += sorted[k].weight;
    level = (amount + valueSum) / weightSum;
    count = k + 1;
    const next = sorted[k + 1];
    if (!next || level <= next.value / next.weight) break;
  }
  const result = new Map<string, number>();
  for (const c of sorted.slice(0, count)) {
    const buy = c.weight * level - c.value;
    if (buy > 0) result.set(c.instrumentId, buy);
  }
  return result;
}

/**
 * Dove mettere il prossimo versamento per avvicinarsi all'obiettivo senza vendere. Gli acquisti sotto
 * `MIN_SUGGESTION_SHARE` dell'importo si scartano e l'importo si ridistribuisce sugli altri.
 */
export function suggestContribution(analysis: AllocationAnalysis, amount: number): ContributionSuggestion[] {
  if (!(amount > 0)) return [];
  let candidates = analysis.rows
    .filter((r) => r.targetWeight > 0)
    .map((r) => ({ instrumentId: r.instrumentId, value: r.value, weight: r.targetWeight }));
  let buys = new Map<string, number>();
  while (candidates.length > 0) {
    buys = waterFill(candidates, amount);
    const smallest = [...buys.entries()].sort((a, b) => a[1] - b[1])[0];
    if (!smallest || buys.size <= 1 || smallest[1] >= amount * MIN_SUGGESTION_SHARE) break;
    candidates = candidates.filter((c) => c.instrumentId !== smallest[0] && buys.has(c.instrumentId));
  }
  const targetById = new Map(analysis.rows.map((r) => [r.instrumentId, r]));
  const newTotal = analysis.total + amount;
  return [...buys.entries()]
    .map(([instrumentId, buy]) => {
      const row = targetById.get(instrumentId);
      return {
        instrumentId,
        amount: buy,
        weightAfter: newTotal > 0 ? ((row?.value ?? 0) + buy) / newTotal : 0,
        targetWeight: row?.targetWeight ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Pesi obiettivo che sommano a 100% (entro la tolleranza)? */
export function isCompleteTarget(targets: TargetInput[]): boolean {
  const sum = targets.reduce((s, t) => s + t.weight, 0);
  return targets.length > 0 && Math.abs(sum - 1) <= TARGET_SUM_TOLERANCE;
}

/**
 * Pesi attuali arrotondati al punto percentuale, che sommano esattamente a 100: punto di partenza del dialog
 * "Obiettivo". Il resto dell'arrotondamento va alla posizione più grande.
 */
export function roundedCurrentWeights(positions: { instrumentId: string; value: number | null }[]): TargetInput[] {
  const priced = positions.filter((p): p is { instrumentId: string; value: number } => p.value !== null && p.value > 0);
  const total = priced.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return [];
  const rows = priced
    .map((p) => ({ instrumentId: p.instrumentId, percent: Math.round((p.value / total) * 100) }))
    .filter((r) => r.percent > 0)
    .sort((a, b) => b.percent - a.percent);
  if (rows.length === 0) return [];
  const diff = 100 - rows.reduce((s, r) => s + r.percent, 0);
  rows[0].percent += diff;
  return rows.map((r) => ({ instrumentId: r.instrumentId, weight: r.percent / 100 }));
}
