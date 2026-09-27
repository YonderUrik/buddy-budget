import type { CategoryType } from "@/lib/categories/groups";
import type { SupportedCurrency } from "@/lib/validation/currency";

/**
 * Eventi di prodotto inviati a Umami, con props solo categoriche o conteggi: mai importi,
 * nomi, descrizioni o id. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface ProductEvents {
  onboarding_completed: { currency: SupportedCurrency };
  bank_connect_started: undefined;
  bank_connect_completed: { accounts: number };
  account_sync_manual: undefined;
  transaction_added: { direction: "entrata" | "uscita" };
  transaction_category_changed: { source: "row" | "categorizza" };
  categorization_applied: { groups: number };
  categorization_rule_saved: { matchType: "merchant" | "contains" };
  transaction_split: undefined;
  category_created: { group: CategoryType };
  pwa_installed: undefined;
}

export type ProductEventName = keyof ProductEvents;

type UmamiTracker = { track: (event: string, data?: Record<string, string | number | boolean>) => unknown };

function getUmami(): UmamiTracker | undefined {
  if (typeof window === "undefined") return undefined;
  const umami = (window as unknown as { umami?: UmamiTracker }).umami;
  return typeof umami?.track === "function" ? umami : undefined;
}

/**
 * Invia un evento di prodotto a Umami. No-op lato server o se lo script Umami non è caricato
 * (sviluppo, Vercel, ad-blocker); un errore del tracker non deve mai rompere la UI.
 */
export function track<E extends ProductEventName>(
  ...args: ProductEvents[E] extends undefined ? [event: E] : [event: E, props: ProductEvents[E]]
): void {
  const [event, props] = args as [E, Record<string, string | number | boolean> | undefined];
  const umami = getUmami();
  if (!umami) return;
  try {
    if (props) umami.track(event, props);
    else umami.track(event);
  } catch {
    // Analytics best-effort.
  }
}
