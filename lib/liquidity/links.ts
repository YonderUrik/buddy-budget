/**
 * Address parameters that open Movimenti already filtered by account, category or text, and on a given year or month,
 * from anywhere in the app («Cerca», Conti, Panoramica). Liquidità applies them, also when it is already open, then
 * takes them out of the address.
 */
export const LIQUIDITY_LINK_PARAMS = { account: "conto", category: "categoria", text: "testo" } as const;
/** Period parameters: `periodo` is `anno` or `mese`, `data` any day inside it (ISO). */
export const LIQUIDITY_PERIOD_PARAMS = { period: "periodo", date: "data" } as const;

export type LiquidityLinkFilter = keyof typeof LIQUIDITY_LINK_PARAMS;
/** Periods a link can open Movimenti on (the calendar year or month of `date`). */
export interface LiquidityLinkPeriod {
  kind: "anno" | "mese";
  date: string;
}

/** Link to Movimenti filtered by one account, one category or a text (or nothing), optionally on a year or a month. */
export function movementsLink(filter: LiquidityLinkFilter | null, value: string, period?: LiquidityLinkPeriod): string {
  const params = new URLSearchParams();
  if (filter !== null) params.set(LIQUIDITY_LINK_PARAMS[filter], value);
  if (period) {
    params.set(LIQUIDITY_PERIOD_PARAMS.period, period.kind);
    params.set(LIQUIDITY_PERIOD_PARAMS.date, period.date);
  }
  return `/liquidita?${params.toString().replace(/\+/g, "%20")}`;
}
