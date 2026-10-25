/**
 * Address parameters that open Movimenti already filtered by account, category or text, from anywhere in the app
 * («Cerca», Conti, Panoramica). Liquidità applies them, also when it is already open, then takes them out of the address.
 */
export const LIQUIDITY_LINK_PARAMS = { account: "conto", category: "categoria", text: "testo" } as const;

export type LiquidityLinkFilter = keyof typeof LIQUIDITY_LINK_PARAMS;

/** Link to Movimenti filtered by one account, one category or a text. */
export function movementsLink(filter: LiquidityLinkFilter, value: string): string {
  return `/liquidita?${LIQUIDITY_LINK_PARAMS[filter]}=${encodeURIComponent(value)}`;
}
