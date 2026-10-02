import type { CategoryType } from "@/lib/categories/groups";
import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { SupportedCurrency } from "@/lib/validation/currency";

/**
 * Eventi di prodotto inviati a Umami, con props solo categoriche o conteggi: mai importi,
 * nomi, descrizioni o id. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface ProductEvents {
  onboarding_completed: { currency: SupportedCurrency };
  account_created: undefined;
  budget_set: undefined;
  bank_connect_started: undefined;
  bank_connect_completed: { accounts: number };
  account_sync_manual: undefined;
  /** Clic su "Rinnova"/"Riconnetti" per un collegamento bancario; `source`: dove (banner in Conti, riga del conto, link dell'email, banner in Panoramica). */
  bank_renew_started: { source: "banner" | "row" | "email" | "panoramica" };
  transaction_added: { direction: "entrata" | "uscita" };
  transaction_category_changed: { source: "row" | "categorizza" };
  categorization_applied: { groups: number };
  categorization_rule_saved: { matchType: "merchant" | "contains" };
  transaction_split: undefined;
  category_created: { group: CategoryType };
  pwa_installed: undefined;
  instrument_added: { source: "yahoo" | "coingecko" | "isin" | "manuale" };
  investment_operation_added: { type: InvestmentTransactionType };
  investment_operation_updated: { type: InvestmentTransactionType };
  investment_plan_created: undefined;
  debt_added: { startMode: "nuovo" | "origine" | "fotografia" | "linea_di_credito" };
  debt_event_added: { type: "payment" | "rate_change" | "balance_correction" | "early_repayment" | "draw" | "repay" | "interest_charged" };
  /** `filter`: quali filtri erano attivi quando l'utente ha collegato la transazione alla rata. */
  debt_installment_transaction_linked: { filter: "nessuno" | "testo" | "categoria" | "entrambi" };
  pension_fund_added: undefined;
  pension_fund_updated: undefined;
  pension_fund_deleted: undefined;
  /** `existing`: quante fotografie aveva già il fondo (0 = la prima). */
  pension_snapshot_saved: { existing: number };
  pension_snapshot_deleted: undefined;
  /** Simulazione locale dell'aliquota in uscita (chip trascinato o mosso da tastiera); `years`: anni di partecipazione simulati. */
  pension_rate_simulated: { years: number };
  investment_benchmark_set: undefined;
  investment_targets_set: { instruments: number };
  instrument_breakdown_saved: undefined;
  investment_tax_regime_set: { regime: "amministrato" | "dichiarativo" };
  instrument_settings_saved: undefined;
  tax_carryforward_added: undefined;
  investment_dividend_dismissed: undefined;
  title_watched: undefined;
  price_alert_created: { direction: "sopra" | "sotto" };
  title_commentary_requested: undefined;
  /** `format`: id del formato riconosciuto (`IMPORT_PRESETS`) o `personalizzato`. */
  investments_imported: { operations: number; format: string };
  /** `from`: dove si è cliccato per aprire la categorizzazione dall'avviso "Da sistemare". */
  attention_link_clicked: { from: "home" | "sidebar" };
  /** Conferma in un tocco dalla card "Da sistemare" della Panoramica. */
  attention_quick_confirmed: { groups: number };
  /** `context`: onboarding (nuovo account) o aggiornamento (nuova versione dei documenti per un utente esistente). */
  terms_accepted: { context: "onboarding" | "aggiornamento" };
  /** Clic su una richiesta privacy (apre la bozza di email al titolare); `type`: quale diritto. */
  privacy_request_started: { type: "rettifica" | "limitazione" | "opposizione" | "accesso" };
  /** Clic dal logo o dal link "Torna al sito" delle pagine di accesso verso la landing; `from`: quale dei due. */
  landing_link_clicked: { from: "logo" | "back_link" };
  account_data_exported: undefined;
  account_reset: undefined;
  account_deactivated: undefined;
  account_reactivated: undefined;
  account_deleted: undefined;
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
