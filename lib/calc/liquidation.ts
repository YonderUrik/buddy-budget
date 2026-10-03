/**
 * Se vendessi tutto oggi: imposta latente sulle plusvalenze non realizzate e patrimonio netto dopo le imposte.
 * Stima semplificata: aliquota per strumento, minusvalenze compensate tra strumenti a pari aliquota non considerate
 * (ogni posizione in perdita vale zero imposta), zaino fiscale non considerato.
 */

export interface LiquidationPosition {
  id: string;
  name: string;
  value: number;
  unrealizedGain: number;
  /** Aliquota effettiva (0,26 o 0,125). */
  taxRate: number;
}

export interface LiquidationResult {
  latentTax: number;
  grossValue: number;
  netValue: number;
  /** Imposta latente in % del valore (serve a gonfiare il numero FIRE: F / (1 − τ)). */
  taxRatio: number | null;
  byPosition: { id: string; name: string; tax: number }[];
}

/** Imposta latente se si vendesse tutto oggi, solo sulle posizioni in guadagno. */
export function computeLiquidation(positions: LiquidationPosition[]): LiquidationResult {
  const byPosition = positions
    .map((p) => ({ id: p.id, name: p.name, tax: Math.max(0, p.unrealizedGain) * p.taxRate }))
    .filter((p) => p.tax > 0)
    .sort((a, b) => b.tax - a.tax);
  const latentTax = byPosition.reduce((s, p) => s + p.tax, 0);
  const grossValue = positions.reduce((s, p) => s + p.value, 0);
  return { latentTax, grossValue, netValue: grossValue - latentTax, taxRatio: grossValue > 0 ? latentTax / grossValue : null, byPosition };
}
