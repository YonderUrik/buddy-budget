/**
 * Da dove arriva la crescita del patrimonio: dal risparmio (entrate meno uscite) o dal resto (mercato, interessi,
 * variazioni di valore). Il "resto" è per differenza: include anche ciò che non è nei movimenti, quindi è una stima.
 */

export interface GrowthSplitPoint {
  /** Fine del mese, "YYYY-MM". */
  month: string;
  netWorth: number;
  /** Entrate meno uscite del mese. */
  savings: number;
}

export interface GrowthSplitRow extends GrowthSplitPoint {
  /** Variazione del patrimonio rispetto al mese precedente. */
  delta: number;
  fromSavings: number;
  fromMarket: number;
}

export interface GrowthSplit {
  rows: GrowthSplitRow[];
  totalDelta: number;
  totalFromSavings: number;
  totalFromMarket: number;
  /** Quota della crescita dovuta al risparmio (0-1), null se la crescita totale è nulla o negativa. */
  savingsShare: number | null;
}

/** Divide la variazione mensile del patrimonio tra risparmio e mercato/altro. Il primo mese è il punto di partenza. */
export function splitGrowth(points: GrowthSplitPoint[]): GrowthSplit {
  const rows: GrowthSplitRow[] = [];
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].netWorth - points[i - 1].netWorth;
    rows.push({ ...points[i], delta, fromSavings: points[i].savings, fromMarket: delta - points[i].savings });
  }
  const totalDelta = rows.reduce((s, r) => s + r.delta, 0);
  const totalFromSavings = rows.reduce((s, r) => s + r.fromSavings, 0);
  return {
    rows,
    totalDelta,
    totalFromSavings,
    totalFromMarket: totalDelta - totalFromSavings,
    savingsShare: totalDelta > 0 ? totalFromSavings / totalDelta : null,
  };
}
