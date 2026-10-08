import type { CategoryType } from "@/lib/categories/groups";
import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { SupportedCurrency } from "@/lib/validation/currency";

/**
 * Eventi di prodotto inviati a Umami, con props solo categoriche o conteggi: mai importi,
 * nomi, descrizioni o id. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface ProductEvents {
  investment_dividends_details_opened: { source: "portfolio" | "year" | "instrument" };
  investment_chart_period_changed: { period: "1mese" | "3mesi" | "1anno" | "max" | "ytd" | "custom" };
  onboarding_completed: { currency: SupportedCurrency };
  account_created: undefined;
  budget_set: undefined;
  bank_connect_started: undefined;
  bank_connect_completed: { accounts: number };
  account_sync_manual: undefined;
  /** Modifica di un conto dalla finestra dei dettagli; `field`: cosa è cambiato, `kind`: conto manuale o collegato alla banca. */
  account_updated: { field: "name" | "type" | "balance" | "appearance"; kind: "manuale" | "collegato" };
  /** Eliminazione di un conto manuale o scollegamento di uno collegato. */
  account_removed: { kind: "manuale" | "collegato" };
  /** Apertura dei dettagli di un conto dalla lista (serve a capire se la riga cliccabile viene usata). */
  account_details_opened: { kind: "manuale" | "collegato" };
  /** Clic su "Rinnova"/"Riconnetti" per un collegamento bancario; `source`: dove (banner in Conti, riga del conto, link dell'email, banner in Panoramica). */
  bank_renew_started: { source: "banner" | "row" | "email" | "panoramica" };
  transaction_added: { direction: "entrata" | "uscita" };
  transaction_category_changed: { source: "row" | "categorizza" };
  categorization_applied: { groups: number };
  categorization_rule_saved: { matchType: "merchant" | "contains" };
  transaction_split: undefined;
  /** Scheda di Liquidità aperta (sostituisce Conti e Movimenti dal 2026-10-08); `tab`: quale. */
  liquidity_tab_viewed: { tab: "movimenti" | "analisi" | "conti" | "categorie" | "regole" };
  /** Conto scelto come filtro dai chip di Liquidità; `scope`: un conto o tutti. */
  liquidity_account_filtered: { scope: "conto" | "tutti" };
  /** Categoria cambiata dall'icona del movimento; `remembered`: l'utente ha chiesto di ricordarla con una regola. */
  liquidity_category_remembered: { remembered: boolean };
  category_created: { group: CategoryType };
  pwa_installed: undefined;
  instrument_added: { source: "yahoo" | "coingecko" | "isin" | "manuale" };
  investment_operation_added: { type: InvestmentTransactionType };
  investment_operation_updated: { type: InvestmentTransactionType };
  debt_added: { startMode: "nuovo" | "origine" | "fotografia" };
  debt_event_added: { type: "payment" | "rate_change" | "balance_correction" | "early_repayment" };
  /** Scelta di un'ipotesi nel foglio "E se…" di un debito (`kind`: quale). */
  debt_simulation_opened: { kind: "extra" | "estinzione" | "surroga" };
  /** Primo uso dello slider "Come uscirne prima" nella panoramica dei debiti. */
  debt_exit_plan_used: undefined;
  /** `filter`: quali filtri erano attivi quando l'utente ha collegato la transazione alla rata. */
  debt_installment_transaction_linked: { filter: "nessuno" | "testo" | "categoria" | "entrambi" };
  pension_fund_added: undefined;
  pension_fund_updated: undefined;
  pension_fund_deleted: undefined;
  /** `existing`: quante fotografie aveva già il fondo (0 = la prima). */
  pension_snapshot_saved: { existing: number };
  pension_snapshot_deleted: undefined;
  /** Import di fotografie da file: righe aggiunte e aggiornate, e `format` del file (csv, xlsx o testo incollato). */
  pension_snapshots_imported: { created: number; updated: number; format: "csv" | "xlsx" | "incollato" };
  /** Simulazione locale dell'aliquota in uscita (chip trascinato o mosso da tastiera); `years`: anni di partecipazione simulati. */
  pension_rate_simulated: { years: number };
  investment_broker_filter_changed: { action: "toggle" | "all"; selected?: number };
  investment_broker_overlay_changed: { enabled: boolean };
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
  investments_import_reset: { operations: number; statements: number };
  investments_import_deleted: { statements: number; operations: number };
  investments_imported: { operations: number; format: string };
  /** File letto nel primo passo dell'import. `provider`: formato (`interactive-brokers`, `yahoo-portfolio`, `generic`); `chosen`: scelto a mano o riconosciuto dal file. */
  investments_import_file_read: { provider: string; chosen: boolean };
  /** `from`: dove si è cliccato per aprire la categorizzazione dall'avviso "Da sistemare". */
  attention_link_clicked: { from: "home" | "sidebar" };
  /** Clic su una voce della legenda del patrimonio netto per mostrarla o nasconderla; `visible`: lo stato dopo il clic. */
  net_worth_class_toggled: { assetClass: "liquidita" | "investimenti" | "previdenza" | "altro"; visible: boolean };
  /** Clic su una tessera della Panoramica; `tile`: quale (mese, scadenze, investimenti). */
  overview_tile_clicked: { tile: "mese" | "scadenze" | "investimenti" };
  /** `context`: onboarding (nuovo account) o aggiornamento (nuova versione dei documenti per un utente esistente). */
  terms_accepted: { context: "onboarding" | "aggiornamento" };
  /** Clic su una richiesta privacy (apre la bozza di email al titolare); `type`: quale diritto. */
  privacy_request_started: { type: "rettifica" | "limitazione" | "opposizione" | "accesso" };
  /** Clic dal logo o dal link "Torna al sito" delle pagine di accesso verso la landing; `from`: quale dei due. */
  landing_link_clicked: { from: "logo" | "back_link" };
  /** Pagina di Analitiche aperta (sostituisce le sei schede, dal 2026-10-04). */
  analytics_page_viewed: undefined;
  /** Voce dell'indice delle domande cliccata; `question`: quale. */
  analytics_question_nav: { question: "dove-sono" | "quando" | "reggera" | "costi" };
  /** Apertura/chiusura di «Per esperti» di una domanda. */
  analytics_expert_toggled: { question: "dove-sono" | "quando" | "reggera" | "costi"; state: "aperta" | "chiusa" };
  /** Ipotesi salvate; `fields`: quanti campi sono cambiati. */
  analytics_assumptions_saved: { fields: number };
  /** Guida iniziale: `step` è l'ultimo passo visto (1-based), `outcome` come è finita. */
  analytics_guide_closed: { step: number; outcome: "completata" | "chiusa" };
  /** Riapertura della guida dal pulsante "Guida". */
  analytics_guide_reopened: undefined;
  /** Apertura di "Come è calcolato" di un'analitica; `analysis`: quale. */
  analytics_explainer_opened: { analysis: string };
  /** Apertura/chiusura della «Guida passo passo» di una scheda. */
  analytics_reading_toggled: { tab: string; state: "aperta" | "chiusa" };
  /** Popup di una parola o cifra sottolineata aperto; `term`: quale voce del glossario. */
  analytics_term_opened: { term: string };
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
