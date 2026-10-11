export interface EvalPrediction {
  /** Categoria confermata dall'utente (verità di riferimento). */
  expected: string;
  /** Categoria proposta dal modello, oppure `null` se non ha risposto. */
  predicted: string | null;
  confidence: number;
  /** Peso: quanti movimenti rappresenta l'esercente, per misurare l'effetto sul lavoro dell'utente. */
  weight: number;
}

export interface ThresholdRow {
  threshold: number;
  /** Quota dei movimenti per cui esiste una proposta con confidenza almeno pari alla soglia. */
  coverage: number;
  /** Quota di proposte (sopra soglia) coincidenti con la categoria confermata. */
  precision: number;
}

export const EVAL_THRESHOLDS = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99] as const;

/**
 * Copertura e precisione per soglia di confidenza, pesate sui movimenti. Serve a scegliere la soglia oltre
 * la quale una proposta arriva già selezionata in Categorizza (la conferma resta comunque dell'utente).
 */
export function summarizeByThreshold(
  predictions: EvalPrediction[],
  thresholds: readonly number[] = EVAL_THRESHOLDS
): ThresholdRow[] {
  const total = predictions.reduce((sum, p) => sum + p.weight, 0);
  return thresholds.map((threshold) => {
    const proposed = predictions.filter((p) => p.predicted !== null && p.confidence >= threshold);
    const proposedWeight = proposed.reduce((sum, p) => sum + p.weight, 0);
    const correctWeight = proposed
      .filter((p) => p.predicted === p.expected)
      .reduce((sum, p) => sum + p.weight, 0);
    return {
      threshold,
      coverage: total === 0 ? 0 : proposedWeight / total,
      precision: proposedWeight === 0 ? 0 : correctWeight / proposedWeight,
    };
  });
}

/** Coppie (verità → proposta) più frequenti fra gli errori, per capire dove il modello confonde. */
export function topConfusions(predictions: EvalPrediction[], limit = 10) {
  const counts = new Map<string, number>();
  for (const p of predictions) {
    if (p.predicted === null || p.predicted === p.expected) continue;
    const key = `${p.expected} -> ${p.predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + p.weight);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
