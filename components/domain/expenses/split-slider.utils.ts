/** Riporta un importo escluso nel range valido [0, totalAmount], sostituendo NaN con 0. */
export function clampExcluded(rawExcluded: number, totalAmount: number): number {
  if (Number.isNaN(rawExcluded)) return 0;
  return Math.min(Math.max(rawExcluded, 0), totalAmount);
}

/** Calcola l'importo escluso per dividere un totale in n quote uguali, tenendone una come spesa effettiva. */
export function computeSplitExcluded(totalAmount: number, n: number): number {
  return clampExcluded(totalAmount - totalAmount / n, totalAmount);
}
