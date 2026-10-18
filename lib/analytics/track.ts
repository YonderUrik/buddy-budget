import type { CategoryType } from "@/lib/categories/groups";
import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { SupportedCurrency } from "@/lib/validation/currency";
import type { SidebarModuleId } from "@/lib/sidebar/modules";
import type { ReportErrorArea, ReportSource } from "@/lib/support/constants";
import type { GoalKind } from "@/lib/goals/constants";
import type { Attribution } from "./attribution";

/** Percorsi a passi tracciati da `form_step_completed` / `form_step_back`. */
export type FormFlow = "onboarding" | "account_manual" | "transaction" | "operation" | "debt_add" | "pension_fund" | "personal_import" | "goal";
/** Screens whose period selector offers a custom range, for the calendar events. */
export type PeriodSurface = "investimenti" | "performance" | "analitiche";
/** Sezioni con più viste, per gli eventi del selettore delle viste su telefono. */
export type SectionViewsKey = "liquidita" | "investimenti" | "pensione" | "analitiche";

/**
 * Eventi di prodotto inviati a Umami, con props solo categoriche o conteggi: mai importi,
 * nomi, descrizioni o id. Aggiungere un evento qui prima di usarlo (il tipo è chiuso di proposito).
 */
export interface ProductEvents {
  financial_sale_simulated: { country: "DE" };
  financial_plan_saved: { country: "DE"; section: "tax" | "income" | "pension" | "retirement" };
  /** Segnalazione inviata da «Aiuto e segnalazioni»; `withContext`: l'utente ha lasciato il contesto tecnico allegato. */
  support_report_sent: { kind: "problema" | "domanda" | "idea"; withContext: boolean; source: ReportSource; area?: ReportErrorArea };
  /** Apertura del foglio «Scrivici» (pulsante fisso o link sotto un errore), anche se poi non si invia. */
  support_sheet_opened: { source: Exclude<ReportSource, "pagina">; area?: ReportErrorArea };
  /** Clic su un collegamento esterno di «Aiuto» (GitHub, novità, sicurezza). */
  support_link_opened: { link: "issue" | "issue_aperte" | "novita" | "sicurezza" | "repo" | "stato" };
  /** Domanda aperta tra le risposte rapide di «Aiuto». */
  support_faq_opened: { id: string };
  personal_csv_requested: { reuse: boolean };
  investments_import_ai_fallback: Record<string, never>;
  personal_csv_deleted: { cash: number; investments: number };
  /** Import confermato; `skipped`: righe non riconosciute saltate per scelta dell'utente. */
  personal_csv_imported: { rows: number; skipped?: number };
  /** Scelta nella schermata «Righe da controllare» dell'import personale. */
  personal_csv_review_action: { action: "importa_saltando" | "rianalizza" | "file_corretto" };
  /** Azione scelta nella schermata «File ricevuto» dell'import personale. */
  personal_csv_receipt_action: { action: "lista" | "altro_file" | "vai_ai_dati" };
  investment_dividends_details_opened: { source: "portfolio" | "year" | "instrument" };
  /** Fetta della torta "Dove sta il patrimonio" bloccata con un clic (solo la classe di asset). */
  overview_composition_slice_selected: { assetClass: "liquidita" | "investimenti" | "previdenza" };
  investment_chart_period_changed: { period: "1mese" | "3mesi" | "1anno" | "max" | "ytd" | "custom" };
  /** Interruttore «Rimetti costi/imposte nel portafoglio» in Investimenti; `reinvested`: acceso o spento. */
  investment_reinvest_toggled: { kind: "costi" | "imposte"; reinvested: boolean };
  investment_title_searched: { type: "etf" | "azione" | "obbligazione" | "fondo" | "crypto" | "etc" };
  /**
   * Action of a «Primi passi» step pressed; `placement`: the big «next step» block in Panoramica, the list under it, or
   * the «done, next» toast shown elsewhere in the app.
   */
  start_step_clicked: { step: "conto" | "import" | "investimento" | "debito" | "pensione" | "obiettivo"; placement?: "hero" | "list" | "toast" };
  /** A step of the user's checklist became done (seen by the app, once per step and device). */
  start_step_completed: { step: "conto" | "import" | "investimento" | "debito" | "pensione" | "obiettivo" };
  /** «Cosa vuoi tenere sotto controllo?» answered at the end of onboarding; `count` 0 = skipped (default steps). */
  onboarding_focus_chosen: { count: number; spese: boolean; investimenti: boolean; debiti: boolean; pensione: boolean };
  /** The same choice changed later from the checklist's «Cambia». */
  start_focus_changed: { count: number };
  /** Action pressed in the «no account yet» state of a Liquidità tab (`area`). */
  empty_state_action_clicked: { area: "movimenti" | "analisi" | "abbonamenti"; action: "conto" | "import" };
  /** Checklist closed; `done`: how many of the user's steps were already done. */
  start_checklist_dismissed: { done: number };
  start_checklist_reopened: undefined;
  /** Tutti i passi fatti, registrato una sola volta per utente. */
  start_checklist_completed: undefined;
  /** «Esplora con dati d'esempio» avviato. */
  demo_started: undefined;
  /** Dati d'esempio azzerati; `from`: banner sempre visibile o Panoramica. */
  demo_cleared: { from: "banner" | "panoramica" };
  /** Public demo (`/demo`) opened, once per browser session; `language` and `country` are the demo's. */
  public_demo_viewed: { language: "it" | "en" | "de"; country: "IT" | "DE" };
  /** «Crea il tuo account» pressed in the public demo's strip. */
  public_demo_signup_clicked: { language: "it" | "en" | "de"; country: "IT" | "DE" };
  /** Country or language changed in the public demo's footer (`changed`); `language` and `country` are the new ones. */
  public_demo_profile_changed: { changed: "country" | "language"; language: "it" | "en" | "de"; country: "IT" | "DE" };
  /** `languageKept`: the language proposed on arrival (picked on the sign-in page or detected from the browser) was not changed. */
  /** `source`/`medium`/`campaign`/`content`: the campaign the visitor arrived from (slugs from `utm_*`), when the link carried one. */
  onboarding_completed: { currency: SupportedCurrency; language: "it" | "en" | "de"; languageKept: boolean } & Attribution;
  /** Foglio «Personalizza» aperto nel passo «Categorie» dell'onboarding. */
  onboarding_categories_opened: undefined;
  /**
   * Categorie scelte nell'onboarding (alla fine dell'onboarding): `customized` false = confermata la proposta;
   * conteggi di categorie attive, tolte, rinominate, facoltative accese e aggiunte a mano.
   */
  onboarding_categories_chosen: { customized: boolean; active: number; removed: number; renamed: number; optionalAdded: number; custom: number };
  account_created: undefined;
  /** Monthly budget of a category saved (created or changed) from the category's detail window. */
  budget_set: undefined;
  /** Monthly budget of a category removed (field emptied in the category's detail window). */
  budget_removed: undefined;
  bank_connect_started: undefined;
  bank_connect_completed: { accounts: number };
  /** «Collega la tua banca» mostrato come non disponibile nel dialog «Nuovo conto» (una volta per apertura); `reason`: posti finiti o limite per persona. */
  bank_connect_unavailable_seen: { reason: "user_limit" | "user_attempts" | "global_limit" | "provider_limit" };
  account_sync_manual: undefined;
  /** Modifica di un conto dalla finestra dei dettagli; `field`: cosa è cambiato, `kind`: conto manuale o collegato alla banca. */
  account_updated: { field: "name" | "type" | "balance" | "appearance"; kind: "manuale" | "collegato" };
  /** Eliminazione di un conto manuale o scollegamento di uno collegato. */
  account_removed: { kind: "manuale" | "collegato" };
  /** Apertura dei dettagli di un conto dalla lista (serve a capire se la riga cliccabile viene usata). */
  account_details_opened: { kind: "manuale" | "collegato" };
  /** Scelta nel dialog «Nuovo conto»: quale strada prende l'utente. */
  account_add_path_chosen: { path: "banca" | "manuale" | "importa" };
  /** Un passo di un form a passi è stato completato (`step` parte da 1): serve a vedere dove ci si ferma. */
  form_step_completed: { flow: FormFlow; step: number };
  /** «Indietro» in un form a passi, dal passo `step` (parte da 1). */
  form_step_back: { flow: FormFlow; step: number };
  /** Clic su "Rinnova"/"Riconnetti" per un collegamento bancario; `source`: dove (banner in Conti, riga del conto, link dell'email, banner in Panoramica). */
  bank_renew_started: { source: "banner" | "row" | "email" | "panoramica" | "sidebar" };
  transaction_added: { direction: "entrata" | "uscita" };
  transaction_category_changed: { source: "row" | "categorizza" };
  categorization_applied: { groups: number };
  categorization_rule_saved: { matchType: "merchant" | "contains"; applied: number };
  transaction_split: undefined;
  /** Su telefono: foglio delle viste aperto toccando il titolo della sezione. */
  section_views_opened: { section: SectionViewsKey };
  /** Su telefono: vista scelta dal foglio aperto dal titolo (diversa da quella corrente). */
  section_view_chosen: { section: SectionViewsKey };
  /** Scheda di Liquidità aperta (sostituisce Conti e Movimenti dal 2026-10-08); `tab`: quale. */
  liquidity_tab_viewed: { tab: "movimenti" | "analisi" | "conti" | "abbonamenti" | "categorie" | "regole" };
  /** Conto scelto come filtro dai chip di Liquidità; `scope`: un conto o tutti. */
  liquidity_account_filtered: { scope: "conto" | "tutti" };
  /** Categoria cambiata dall'icona del movimento; `remembered`: l'utente ha chiesto di ricordarla con una regola. */
  liquidity_category_remembered: { remembered: boolean };
  /** Scelta su un abbonamento: confermato, escluso («non è un abbonamento»), terminato o rimesso tra i rilevati; `origin`: rilevato o aggiunto a mano. */
  subscription_decided: { decision: "confermato" | "escluso" | "terminato" | "ripristinato"; origin: "rilevato" | "manuale" };
  subscription_added: { cadence: "settimanale" | "mensile" | "trimestrale" | "semestrale" | "annuale" };
  subscription_updated: undefined;
  subscription_removed: undefined;
  /** Obiettivo di risparmio creato; `sources`: quante parti di conti e titoli, `dated`: ha una data. */
  goal_created: { kind: GoalKind; sources: number; dated: boolean };
  goal_updated: { kind: GoalKind; sources: number };
  goal_deleted: { kind: GoalKind };
  /** Segnato come raggiunto (`achieved: true`) o rimesso tra quelli aperti. */
  goal_achieved: { kind: GoalKind; achieved: boolean };
  goal_reordered: { count: number };
  /** Da dove si è aperta la vista Obiettivi: Panoramica, novità, email o Analitiche. */
  goals_opened: { from: "panoramica" | "novita" | "email" | "analitiche" };
  /** Dettaglio di un abbonamento aperto dalla lista; `decision`: lo stato in cui era. */
  subscription_details_opened: { decision: "da-confermare" | "confermato" | "escluso" | "terminato" };
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
  /** Popover «come si calcola» di un indicatore nella pagina titolo; `indicator`: chiave statica (pe, roe, ter...). */
  title_indicator_opened: { indicator: string };
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
  /** Clic su una tessera della Panoramica; `tile`: quale (mese, scadenze, investimenti, obiettivi). */
  overview_tile_clicked: { tile: "mese" | "scadenze" | "investimenti" | "obiettivi" };
  /** `context`: onboarding (nuovo account) o aggiornamento (nuova versione dei documenti per un utente esistente). */
  terms_accepted: { context: "onboarding" | "aggiornamento" };
  /** Clic su una richiesta privacy (apre la bozza di email al titolare); `type`: quale diritto. */
  privacy_request_started: { type: "rettifica" | "limitazione" | "opposizione" | "accesso" };
  /** Clic dal logo o dal link "Torna al sito" delle pagine di accesso verso la landing; `from`: quale dei due. */
  landing_link_clicked: { from: "logo" | "back_link" | "security" | "source" | "help" };
  /** Pagina di Analitiche aperta (sostituisce le sei schede, dal 2026-10-04). */
  analytics_page_viewed: undefined;
  /** Scheda di risposta scelta (sostituisce l'indice delle domande); `view`: quale. */
  analytics_view_selected: { view: "dove-sono" | "quando" | "reggera" | "costi" };
  /** Un cursore «e se…» lasciato; `field`: quale ipotesi. */
  analytics_scenario_changed: { field: "annualSavings" | "annualSpending" | "expectedReturn" | "withdrawalRate" };
  /** Rendimento atteso passato dallo storico a un valore scelto a mano o viceversa; `source`: quello nuovo. */
  analytics_return_source_changed: { source: "storico" | "manuale" };
  /** Origine del rendimento atteso mostrato all'apertura di Analitiche (una volta per visita): storico (con il periodo scelto), valore prudente o scelto a mano. */
  analytics_return_source_shown: { source: "storico-24" | "storico-12" | "storico-personalizzato" | "prudente" | "manuale" };
  /** Calendar of the shared period selector opened; `surface`: which screen. */
  period_calendar_opened: { surface: PeriodSurface };
  /** Custom range applied from that calendar; `span`: its length in days or months (a count, never the dates). */
  period_range_applied: { surface: PeriodSurface; granularity: "day" | "month"; span: number };
  /** Periodo dei dati di Analitiche cambiato; `period`: quello nuovo. */
  analytics_period_changed: { period: "ultimi-12" | "ultimi-24" | "personalizzato" };
  /** Spesa o risparmio scritti a mano riportati al dato dei movimenti; `field`: quale. */
  analytics_figure_reset_to_data: { field: "annualSavings" | "annualSpending" };
  /** Origine di spesa e risparmio all'apertura di Analitiche (una volta per visita): dai movimenti, scritti a mano o mancanti. */
  analytics_cashflow_source_shown: { spending: "dati" | "ipotesi" | "manca"; savings: "dati" | "ipotesi" | "manca" };
  /** Cursori riportati alle ipotesi salvate. */
  analytics_scenario_reset: undefined;
  /** Valori dei cursori salvati come ipotesi; `fields`: quanti. */
  analytics_scenario_saved: { fields: number };
  /** Apertura/chiusura di «Per esperti» di una domanda. */
  analytics_expert_toggled: { question: "dove-sono" | "quando" | "reggera" | "costi"; state: "aperta" | "chiusa" };
  /** «Il tuo traguardo» aperto; `from`: da dove (oggi solo dai Primi passi della Panoramica). */
  analytics_goal_opened: { from: "primi-passi" };
  /** Traguardo salvato; `source`: spesa lasciata ai movimenti o scritta dall'utente. */
  analytics_goal_saved: { source: "dati" | "scritta" };
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
  amounts_hidden_toggled: { enabled: boolean; source: "menu_utente" };
  theme_changed: { choice: "chiaro" | "scuro" | "sistema"; source: "menu_utente" };
  /** Interface language chosen from the sign-in footer (cookie) or from Impostazioni (account). Onboarding is counted by `onboarding_completed`. */
  language_changed: { from: "login" | "settings"; language: "it" | "en" | "de" };
  settings_group_opened: { group: "account" | "aspetto" | "notifiche" | "privacy" | "pericolo" };
  more_menu_clicked: { target: "sezione" | "impostazioni" | "aiuto" | "importi" | "esci" | "informativa" | "quadro" };
  /** Interruttore di un tipo di email (riepilogo, avvisi budget/scadenze) in Impostazioni → Notifiche. */
  notifications_toggled: { kind: "digest" | "budget" | "deadlines" | "goals"; enabled: boolean };
  /** Consenso alle proposte dell'assistente in Impostazioni. */
  ai_categorization_instructions_saved: undefined;
  ai_categorization_toggled: { enabled: boolean };
  /** Pulsante «Categorizza con l'AI» in Categorizza; `missing` = esercenti senza proposta in quel momento. */
  ai_suggestions_generate_clicked: { missing: number; consentGiven: boolean };
  /** Riquadro «Novità» della Panoramica: clic sul pulsante o chiusura (`id` = identificativo della voce). */
  whats_new_clicked: { id: string };
  whats_new_dismissed: { id: string };
  whats_new_opened: { id: string };
  /** Clic sull'invito «Categorizza con l'AI» che porta a Categorizza. */
  categorize_ai_link_clicked: { from: "movimenti" };
  /** Tour delle carte: passo visto, saltato o concluso. */
  categorize_tour: { action: "avanti" | "salta" | "fine" | "riapri"; step: number };
  /** Carta della categorizzazione rapida: scelta dell'utente; `source` = da dove veniva la proposta. */
  categorize_card_decided: { action: "conferma" | "cambia" | "salta" | "annulla"; source: "regola" | "storico" | "assistente" | "nessuna"; remember: boolean };
  /** Interruttore «Lascia che l'app scelga quando è quasi certa»; `from` = dove l'utente l'ha cambiato. */
  categorization_auto_apply_toggled: { enabled: boolean; from: "categorizza" | "impostazioni" };
  /** Movimenti categorizzati da soli quando la pagina Categorizza ha trovato proposte sicure pronte. */
  categorization_auto_applied: { count: number; groups: number };
  /** «Va tutto bene» in «Messe dall'app»: movimenti controllati in un colpo. */
  categorization_auto_reviewed: { count: number };
  /** L'utente ha cambiato una categoria applicata da sola; `source` = da dove veniva. */
  categorization_auto_corrected: { source: "regola" | "storico" | "assistente"; count: number; remember: boolean; from: "categorizza" | "movimenti" };
  /** Anteprima di «Ricategorizza» aperta; `scope` = tutto (Categorizza) o una regola appena salvata, `changes` = movimenti che cambierebbero. */
  recategorize_previewed: { scope: "tutto" | "regola"; changes: number };
  /** «Ricategorizza» applicata: movimenti spostati e gruppi scelti; `legacy` = inclusi i movimenti categorizzati prima che se ne segnasse l'origine. */
  recategorize_applied: { scope: "tutto" | "regola"; count: number; groups: number; legacy: boolean };
  /** Annulla dell'ultima «Ricategorizza»: movimenti riportati com'erano. */
  recategorize_undone: { count: number };
  notifications_frequency_changed: { frequency: "settimanale" | "mensile" };
  /** Email di esempio del riepilogo richiesta dal pulsante in Impostazioni. */
  notifications_test_sent: undefined;
  /** Email facoltative scelte nel passo «Notifiche» dell'onboarding (anche nessuna); `digest`: frequenza o `off`. */
  onboarding_notifications_chosen: { digest: "settimanale" | "mensile" | "off"; budget: boolean; deadlines: boolean; goals?: boolean };
  /** Disiscrizione dalla pagina aperta dal link dell'email; `kind`: tipo disattivato o tutti. */
  notifications_unsubscribed: { kind: "digest" | "budget" | "deadlines" | "goals" | "all" };
  /** «‹» back button; `section`/`to`: first segment of the current and destination address, `target`: previous screen or logical parent, `place`: phone top bar or above the page on desktop. */
  back_link_clicked: { section: string; target: "precedente" | "madre"; to: string; place: "barra" | "pagina" };
  /**
   * Magic link requested from the sign-in form. `entry`: the page was opened from a «sign up» button (`signup`) or from
   * «Entra» (`login`); `source`/`medium`/`campaign`/`content`: the campaign of the arrival, when the link carried one.
   */
  login_link_requested: { entry: "signup" | "login" } & Attribution;
  /** «Continua con Google» on the sign-in page; same props as `login_link_requested`. */
  google_login_started: { entry: "signup" | "login" } & Attribution;
  /** Signed in with email and password (instances with password sign-in, i.e. self-hosted ones). */
  password_login_completed: undefined;
  /** Account created with email and password; `first` = the first account of the instance. */
  password_signup_completed: { first: boolean };
  /** Password changed or set from Impostazioni → Account. */
  password_changed: { kind: "change" | "set" };
  /** «Rientra in BuddyBudget» on the login page: the one-tap way back in was used (link sent or Google opened). */
  returning_login_used: { method: "email" | "google" };
  /** «Non sei tu?» on the login page: the remembered account was forgotten on this device. */
  returning_login_forgotten: undefined;
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
