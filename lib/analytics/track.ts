import type { CategoryType } from "@/lib/categories/groups";
import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { SupportedCurrency } from "@/lib/validation/currency";
import type { SidebarModuleId } from "@/lib/sidebar/modules";

/**
 * Eventi di prodotto inviati a Umami, con props solo categoriche o conteggi: mai importi,
 * nomi, descrizioni o id. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface ProductEvents {
  /** Segnalazione inviata da «Aiuto e segnalazioni»; `withContext`: l'utente ha lasciato il contesto tecnico allegato. */
  support_report_sent: { kind: "problema" | "domanda" | "idea"; withContext: boolean };
  /** Clic su un collegamento esterno di «Aiuto» (GitHub, novità, sicurezza). */
  support_link_opened: { link: "issue" | "issue_aperte" | "novita" | "sicurezza" | "repo" };
  /** Domanda aperta tra le risposte rapide di «Aiuto». */
  support_faq_opened: { id: string };
  personal_csv_requested: { reuse: boolean };
  personal_csv_deleted: { cash: number; investments: number };
  personal_csv_imported: { rows: number };
  investment_dividends_details_opened: { source: "portfolio" | "year" | "instrument" };
  /** Fetta della torta "Dove sta il patrimonio" bloccata con un clic (solo la classe di asset). */
  overview_composition_slice_selected: { assetClass: "liquidita" | "investimenti" | "previdenza" };
  investment_chart_period_changed: { period: "1mese" | "3mesi" | "1anno" | "max" | "ytd" | "custom" };
  /** Interruttore «Rimetti costi/imposte nel portafoglio» in Investimenti; `reinvested`: acceso o spento. */
  investment_reinvest_toggled: { kind: "costi" | "imposte"; reinvested: boolean };
  investment_title_searched: { type: "etf" | "azione" | "obbligazione" | "fondo" | "crypto" | "etc" };
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
  /** Scelta nel dialog «Nuovo conto»: quale strada prende l'utente. */
  account_add_path_chosen: { path: "banca" | "manuale" | "importa" };
  /** Clic su "Rinnova"/"Riconnetti" per un collegamento bancario; `source`: dove (banner in Conti, riga del conto, link dell'email, banner in Panoramica). */
  bank_renew_started: { source: "banner" | "row" | "email" | "panoramica" | "sidebar" };
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
  investment_benchmark_set: undefined;
  investment_targets_set: { instruments: number };
  instrument_breakdown_saved: undefined;
  investment_tax_regime_set: { regime: "amministrato" | "dichiarativo" };
  instrument_settings_saved: undefined;
  /** Strumento importato (solo ISIN, prezzi manuali) collegato a una quotazione con prezzi automatici. */
  instrument_quotation_linked: undefined;
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
  /** `from`: dove si è cliccato per aprire la categorizzazione dall'avviso in Panoramica. */
  attention_link_clicked: { from: "home" };
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
  /** Scheda di risposta scelta (sostituisce l'indice delle domande); `view`: quale. */
  analytics_view_selected: { view: "dove-sono" | "quando" | "reggera" | "costi" };
  /** Un cursore «e se…» lasciato; `field`: quale ipotesi. */
  analytics_scenario_changed: { field: "annualSavings" | "annualSpending" | "expectedReturn" | "withdrawalRate" };
  /** Cursori riportati alle ipotesi salvate. */
  analytics_scenario_reset: undefined;
  /** Valori dei cursori salvati come ipotesi; `fields`: quanti. */
  analytics_scenario_saved: { fields: number };
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
  /** Modulo della barra laterale acceso o spento dalle Impostazioni (`barra_in_basso`: la navigazione mobile). */
  sidebar_module_toggled: { module: SidebarModuleId | "barra_in_basso"; enabled: boolean };
  /** Clic su un elemento dei moduli della barra laterale (scadenza o obiettivo FIRE). */
  sidebar_module_clicked: { module: "scadenze" | "fire" };
  /** Tocco su una scheda della barra in basso su mobile. */
  bottom_nav_clicked: { tab: "panoramica" | "liquidita" | "investimenti" | "debiti" | "altro" };
  /** Menu «Altro» a tutto schermo (mobile): cosa è stato toccato. */
  more_menu_clicked: { target: "sezione" | "impostazioni" | "tema" | "importi" | "esci" | "informativa" | "quadro" };
  /** Interruttore di un tipo di email (riepilogo, avvisi budget/scadenze) in Impostazioni → Notifiche. */
  notifications_toggled: { kind: "digest" | "budget" | "deadlines"; enabled: boolean };
  notifications_frequency_changed: { frequency: "settimanale" | "mensile" };
  /** Email di esempio del riepilogo richiesta dal pulsante in Impostazioni. */
  notifications_test_sent: undefined;
  /** Disiscrizione dalla pagina aperta dal link dell'email; `kind`: tipo disattivato o tutti. */
  notifications_unsubscribed: { kind: "digest" | "budget" | "deadlines" | "all" };
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
