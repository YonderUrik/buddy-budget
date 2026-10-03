/**
 * Costi ricorrenti del portafoglio: TER dei fondi (inserito a mano) e bollo, e quanto pesano nel tempo.
 */
import { BOLLO_RATE } from "./taxes";

export interface CostPosition {
  id: string;
  name: string;
  value: number;
  /** TER annuo come frazione (0,002 = 0,20%), null se non indicato. */
  ter: number | null;
  /** Soggetto a bollo (titoli e fondi in deposito titoli; non crypto né strumenti fuori deposito). */
  subjectToBollo: boolean;
}

export interface CostRow {
  id: string;
  name: string;
  value: number;
  terCost: number;
  bolloCost: number;
  total: number;
  /** Costo totale in % del valore della posizione. */
  pct: number;
}

export interface CostSummary {
  rows: CostRow[];
  totalValue: number;
  annualCost: number;
  /** Costo annuo medio in % del patrimonio investito. */
  annualPct: number | null;
  /** Valore delle posizioni senza TER indicato: il costo vero è più alto. */
  missingTerValue: number;
}

/** Costo annuo per posizione (TER × valore + bollo) e totale. */
export function summarizeCosts(positions: CostPosition[]): CostSummary {
  const rows = positions
    .filter((p) => p.value > 0)
    .map((p) => {
      const terCost = p.value * (p.ter ?? 0);
      const bolloCost = p.subjectToBollo ? p.value * BOLLO_RATE : 0;
      const total = terCost + bolloCost;
      return { id: p.id, name: p.name, value: p.value, terCost, bolloCost, total, pct: total / p.value };
    })
    .sort((a, b) => b.total - a.total);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const annualCost = rows.reduce((s, r) => s + r.total, 0);
  return {
    rows,
    totalValue,
    annualCost,
    annualPct: totalValue > 0 ? annualCost / totalValue : null,
    missingTerValue: positions.filter((p) => p.value > 0 && p.ter === null).reduce((s, p) => s + p.value, 0),
  };
}

export interface CostDragPoint {
  year: number;
  withoutCosts: number;
  withCosts: number;
  lost: number;
}

/** Quanto i costi erodono il patrimonio in `years` anni (nessun versamento): stesso rendimento lordo, con e senza costo annuo. */
export function costDrag(value: number, grossReturn: number, annualCostPct: number, years: number): CostDragPoint[] {
  const out: CostDragPoint[] = [];
  for (let year = 0; year <= years; year++) {
    const withoutCosts = value * (1 + grossReturn) ** year;
    const withCosts = value * (1 + grossReturn - annualCostPct) ** year;
    out.push({ year, withoutCosts, withCosts, lost: withoutCosts - withCosts });
  }
  return out;
}
