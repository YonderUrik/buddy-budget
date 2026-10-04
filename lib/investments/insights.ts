import type { CompositionSlice, PortfolioSummary, PositionRow } from "@/lib/calc/investments";

/** Soglia oltre la quale una singola posizione è segnalata come concentrazione. */
export const CONCENTRATION_THRESHOLD = 0.5;
/** Esposizione valutaria sotto la quale non vale la pena segnalarla. */
export const CURRENCY_EXPOSURE_THRESHOLD = 0.05;

/**
 * Scomposizione del valore di oggi: quanto hai pagato per quello che possiedi e quanto ha aggiunto (o tolto) il
 * mercato. Le due parti sommano al valore delle sole posizioni con un prezzo.
 */
export interface ValueBreakdown {
  paid: number;
  market: number;
  value: number;
  /** Quota del valore dovuta al mercato (0-1), 0 se in perdita. */
  marketShare: number;
  /** Vendite e dividendi già incassati (non sono più nel valore). */
  cashedIn: number;
}

/** Scompone il valore: costo delle posizioni con prezzo + guadagno non realizzato; a parte realizzato e proventi. */
export function computeValueBreakdown(summary: PortfolioSummary): ValueBreakdown {
  const priced = summary.rows.filter((r) => r.value !== null);
  const paid = priced.reduce((sum, r) => sum + r.costBasis, 0);
  const value = priced.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const market = value - paid;
  return {
    paid,
    market,
    value,
    marketShare: value > 0 && market > 0 ? market / value : 0,
    cashedIn: summary.realizedGain + summary.income,
  };
}

/** Lettura della concentrazione: una posizione dominante, oppure quanto pesano le prime tre. */
export interface ConcentrationInsight {
  kind: "single" | "dominant" | "spread";
  name: string | null;
  share: number;
}

export function computeConcentration(rows: PositionRow[]): ConcentrationInsight | null {
  const weighted = rows.filter((r) => r.weight !== null).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  if (weighted.length === 0) return null;
  if (weighted.length === 1) return { kind: "single", name: weighted[0].instrument.name, share: 1 };
  const top = weighted[0];
  if ((top.weight ?? 0) >= CONCENTRATION_THRESHOLD) return { kind: "dominant", name: top.instrument.name, share: top.weight ?? 0 };
  const topThree = weighted.slice(0, 3).reduce((sum, r) => sum + (r.weight ?? 0), 0);
  return { kind: "spread", name: null, share: topThree };
}

/** Quota del portafoglio in valute diverse da quella dell'utente (0-1). */
export function computeCurrencyExposure(byCurrency: CompositionSlice[], userCurrency: string): number {
  return byCurrency.filter((s) => s.key !== userCurrency).reduce((sum, s) => sum + s.share, 0);
}

/** Giorni di calendario da `today` a `date`. */
export function daysUntil(date: Date, today: Date): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86_400_000);
}
