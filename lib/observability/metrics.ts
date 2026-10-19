import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { APP_BUILD_INFO } from "@/lib/app-version";
import type { ProviderId } from "@/lib/db/schema/investments";
import type { FxProviderId, ProviderOutcome } from "@/lib/market-data/types";
import type { MerchantNameSource } from "@/lib/categorization/merchant-name";
import type { ClientErrorArea, ClientErrorKind } from "@/lib/client-errors";

/** Prefisso comune di tutte le metriche applicative. */
export const METRIC_PREFIX = "buddybudget_";

/** Bucket (secondi) degli istogrammi di durata: da 50ms a 5 minuti (maxDuration dei job). */
export const DURATION_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

export type SyncTrigger = "manual" | "cron" | "finalize";
export type SyncOutcome = "synced" | "limited" | "expired" | "error";
export type CronName = "gocardless_sync" | "net_worth_snapshot" | "market_prices" | "account_deletion" | "gocardless_maintenance" | "notifications" | "inactive_accounts" | "public_demo";
export type CronOutcome = "success" | "error";
export type AuthEvent =
  | "magic_link_sent"
  | "magic_link_failed"
  | "sign_in"
  | "rate_limited"
  | "signup_refused"
  | "password_reset_sent"
  | "password_reset_failed"
  | "password_reset_completed"
  | "password_sign_in_failed";
export type SupportReportKind = "problema" | "domanda" | "idea";
export type SupportReportOutcome = "sent" | "failed" | "rate_limited";
/** Esito della ricezione di un errore del browser: registrato o scartato per il limite per utente. */
export type ClientErrorOutcome = "reported" | "rate_limited";
export type DependencyName = "postgres" | "redis";
/** Scelte dell'utente sugli abbonamenti (enum chiuso, mai il nome dell'abbonamento). */
export type SubscriptionAction = "confirmed" | "excluded" | "ended" | "restored" | "added" | "updated" | "removed";
/** Azioni sugli obiettivi di risparmio (enum chiuso). */
export type GoalAction = "created" | "updated" | "deleted" | "achieved" | "reopened" | "reordered";

/** Numeri aggregati di utilizzo (nessun dato personale: solo conteggi), letti dal DB allo scrape. */
export interface UsageSnapshot {
  users: { registered: number; onboarded: number; deactivated: number };
  newUsers: { "7d": number; "30d": number };
  activeUsers: { "24h": number; "7d": number; "30d": number };
  /** Utenti con almeno un record per funzione. */
  usersWithFeature: Record<UsageFeature, number>;
  /** Righe totali per tipo di dato. */
  records: Record<UsageRecordKind, number>;
  /** Utenti per passo dei primi passi (dati veri, esclusi quelli d'esempio) e per stato della checklist. */
  activation: Record<ActivationStep, number>;
}
export type ActivationStep = "conto" | "import" | "investimento" | "obiettivo" | "completa" | "chiusa" | "demo_attiva";
export type StartEvent = "demo_started" | "demo_cleared" | "checklist_dismissed" | "checklist_reopened" | "checklist_completed" | "focus_changed";
/** Public demo (`/demo`): a visitor opened it, it was unavailable (off or not seeded yet), a write was blocked, the data was rebuilt. */
export type PublicDemoEvent = "session_started" | "unavailable" | "write_blocked" | "reset";
export type UsageFeature = "accounts" | "bank_connection" | "transactions" | "budgets" | "rules" | "investments" | "debts" | "pension" | "subscriptions" | "goals";
export type UsageRecordKind = "accounts" | "transactions" | "investment_operations" | "debts" | "pension_snapshots";

/** Template statici degli endpoint GoCardless (mai il path reale: contiene id di conto). */
export type GoCardlessEndpoint =
  | "token.new"
  | "agreements.create"
  | "institutions.list"
  | "requisitions.create"
  | "requisitions.get"
  | "requisitions.list"
  | "requisitions.delete"
  | "agreements.list"
  | "agreements.delete"
  | "accounts.details"
  | "accounts.balances"
  | "accounts.transactions";

export const CRON_NAMES: readonly CronName[] = [
  "gocardless_sync",
  "net_worth_snapshot",
  "market_prices",
  "account_deletion",
  "gocardless_maintenance",
  "notifications",
  "inactive_accounts",
  "public_demo",
];

/** Modalità del cron di pulizia GoCardless (`dry-run` conta soltanto, non elimina). */
export type CleanupMode = "dry-run" | "execute";
/** Cosa ha deciso/fatto la pulizia: `*_candidate` solo in dry-run, `*_deleted` solo in execute. */
export type CleanupAction =
  | "abandoned_attempt"
  | "orphan_connection"
  | "expired_connection"
  | "unknown_requisition"
  | "unknown_agreement"
  | "stale_requisition"
  | "approved_requisition"
  | "skipped_linked"
  | "capped"
  | "failed";
/** Perché si libera subito una connessione GoCardless rimasta senza conti: conto scollegato o consenso rinnovato. */
export type GoCardlessReleaseTrigger = "account_removed" | "renewed";
export type GoCardlessReleaseOutcome = "released" | "failed";
/** Esito di una richiesta di collegamento: avviata, bloccata da un limite, rifiutata da GoCardless (402) o fallita. */
export type GoCardlessConnectOutcome =
  | "started"
  | "user_limit"
  | "user_attempts"
  | "global_limit"
  | "provider_limit"
  | "provider_refused"
  | "failed";
/** Posti GoCardless letti allo scrape: requisition vive, consensi recenti, posti usati (il maggiore dei due), limiti e utenti oltre il limite per utente. */
export interface GoCardlessCapacityReading {
  live: number;
  recent: number;
  used: number;
  limit_global: number;
  limit_provider: number;
  users_over_limit: number;
}
/** Modalità del cron sugli account inattivi (`dry-run` conta soltanto: niente email, niente eliminazioni). */
export type InactivityMode = "dry-run" | "execute";
/** Cosa ha deciso/fatto il cron: `warned` = email di preavviso, `deleted` = account eliminato, `returned` = rientrato prima della scadenza, `exempt` = protetto, `capped` = rimandato dal tetto, `failed`. */
export type InactivityAction = "warned" | "deleted" | "returned" | "exempt" | "capped" | "failed";

/** Avvisi di consenso bancario (scadenza vicina o scaduto) per esito dell'invio email. */
export type ConsentNoticeKind = "expiring" | "expired";
export type ConsentNoticeOutcome = "sent" | "failed";

/** Email non di servizio (riepilogo, avvisi budget e scadenze) per esito: `dry_run` conta senza inviare, `capped` = rimandata dal tetto di frequenza. */
export type NotificationEmailKind = "digest" | "budget" | "deadlines" | "goals" | "test";
export type NotificationEmailOutcome = "sent" | "failed" | "dry_run" | "capped" | "empty";
/** Sezione facoltativa del riepilogo e come è andata: `included` = c'è, `absent` = l'utente non ne ha i dati, `failed` = calcolo fallito (il riepilogo parte senza). */
export type NotificationDigestSection = "investments" | "goals";
export type NotificationDigestSectionOutcome = "included" | "absent" | "failed";
/** Da dove arriva una disiscrizione: link nell'email, one-click del client di posta (RFC 8058) o preferenze in app. */
export type NotificationUnsubscribeSource = "page" | "one_click" | "settings";

/**
 * Letture fatte al momento dello scrape (gauge "asincrone"). Se una lettura lancia, la gauge
 * non emette campioni per quello scrape: meglio l'assenza del dato (gestibile con `absent()`)
 * di un valore inventato.
 */
export interface AsyncGaugeDeps {
  personalImports?: () => Promise<{ pending: number; overdue: number; failed: number; emailPending: number }>;
  dependencies?: () => Promise<Record<DependencyName, boolean>>;
  cronLastSuccess?: () => Promise<Partial<Record<CronName, number | null>>>;
  syncJobs?: () => Promise<{ active: number; stale: number }>;
  usage?: () => Promise<UsageSnapshot>;
  gocardlessCapacity?: () => Promise<GoCardlessCapacityReading>;
}

interface MetricsState {
  registry: Registry;
  deps: AsyncGaugeDeps;
  httpRequests: Counter<"route" | "method" | "status_class">;
  httpDuration: Histogram<"route" | "method">;
  syncTotal: Counter<"trigger" | "outcome">;
  syncDuration: Histogram<"trigger">;
  gcApi: Counter<"endpoint" | "status_class">;
  imported: Counter<"categorized">;
  merchantNames: Counter<"source">;
  cronRuns: Counter<"cron" | "outcome">;
  authEvents: Counter<"event">;
  supportReports: Counter<"kind" | "outcome">;
  clientErrors: Counter<"kind" | "area" | "outcome">;
  subscriptionActions: Counter<"action">;
  subscriptionsDetect: Histogram<string>;
  goalActions: Counter<"action" | "kind">;
  categorizationAiRequests: Counter<"outcome">;
  categorizationAiDuration: Histogram<string>;
  categorizationSuggestions: Counter<"event">;
  categorizationAuto: Counter<"source" | "event">;
  priceProvider: Counter<"provider" | "outcome">;
  logoRequests: Counter<"source" | "outcome">;
  fundamentalsRequests: Counter<"kind" | "outcome">;
  fxProvider: Counter<"provider" | "outcome">;
  priceInstruments: Counter<"outcome">;
  gcCleanup: Counter<"action" | "mode">;
  gcRelease: Counter<"trigger" | "outcome">;
  gcConnect: Counter<"kind" | "outcome">;
  inactiveAccounts: Counter<"action" | "mode">;
  consentNotices: Counter<"kind" | "outcome">;
  startEvents: Counter<"event">;
  publicDemoEvents: Counter<"event" | "language" | "country">;
  notificationEmails: Counter<"kind" | "outcome">;
  notificationDigestSections: Counter<"section" | "outcome">;
  notificationUnsubscribes: Counter<"kind" | "source">;
}

function createState(): MetricsState {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: `${METRIC_PREFIX}process_` });
  const state = { registry, deps: {} } as MetricsState;
  const r = [registry];
  for (const kind of ["pending", "overdue", "failed", "emailPending"] as const) {
    new Gauge({ name: `${METRIC_PREFIX}personal_csv_${kind}`, help: `Personal CSV jobs: ${kind}`, registers: r,
      async collect() { const read = state.deps.personalImports; if (!read) return; this.set((await read())[kind]); },
    });
  }

  state.httpRequests = new Counter({
    name: `${METRIC_PREFIX}http_requests_total`,
    help: "Richieste HTTP alle route API per nome statico di route, metodo e classe di status.",
    labelNames: ["route", "method", "status_class"],
    registers: r,
  });
  state.httpDuration = new Histogram({
    name: `${METRIC_PREFIX}http_request_duration_seconds`,
    help: "Durata delle richieste HTTP alle route API.",
    labelNames: ["route", "method"],
    buckets: DURATION_BUCKETS_SECONDS,
    registers: r,
  });
  state.syncTotal = new Counter({
    name: `${METRIC_PREFIX}gocardless_sync_total`,
    help: "Sync GoCardless di un conto per origine ed esito.",
    labelNames: ["trigger", "outcome"],
    registers: r,
  });
  state.syncDuration = new Histogram({
    name: `${METRIC_PREFIX}gocardless_sync_duration_seconds`,
    help: "Durata del sync GoCardless di un conto.",
    labelNames: ["trigger"],
    buckets: DURATION_BUCKETS_SECONDS,
    registers: r,
  });
  state.gcApi = new Counter({
    name: `${METRIC_PREFIX}gocardless_api_requests_total`,
    help: "Chiamate all'API GoCardless per endpoint (template) e classe di status.",
    labelNames: ["endpoint", "status_class"],
    registers: r,
  });
  state.imported = new Counter({
    name: `${METRIC_PREFIX}transactions_imported_total`,
    help: "Transazioni importate da GoCardless, divise per categorizzate automaticamente o no.",
    labelNames: ["categorized"],
    registers: r,
  });
  state.merchantNames = new Counter({
    name: `${METRIC_PREFIX}transaction_names_total`,
    help: "Transazioni valutate a ogni sync (finestra rolling inclusa) per origine del nome leggibile (counterparty, alias, pattern, raw, fallback).",
    labelNames: ["source"],
    registers: r,
  });
  state.cronRuns = new Counter({
    name: `${METRIC_PREFIX}cron_runs_total`,
    help: "Esecuzioni dei cron per nome ed esito (contatore per pod).",
    labelNames: ["cron", "outcome"],
    registers: r,
  });
  state.authEvents = new Counter({
    name: `${METRIC_PREFIX}auth_events_total`,
    help: "Eventi di autenticazione (invio magic link, accessi, rate limit).",
    labelNames: ["event"],
    registers: r,
  });

  state.supportReports = new Counter({
    name: `${METRIC_PREFIX}support_reports_total`,
    help: "Segnalazioni di supporto inviate dagli utenti per tipo ed esito (sent, failed, rate_limited).",
    labelNames: ["kind", "outcome"],
    registers: r,
  });

  state.clientErrors = new Counter({
    name: `${METRIC_PREFIX}client_errors_total`,
    help: "Errori del browser (pagine che si rompono) per tipo (sezione, globale), area dell'app ed esito (reported, rate_limited).",
    labelNames: ["kind", "area", "outcome"],
    registers: r,
  });

  state.subscriptionActions = new Counter({
    name: `${METRIC_PREFIX}subscription_actions_total`,
    help: "Scelte degli utenti sugli abbonamenti (confermato, escluso, terminato, ripristinato, aggiunto, modificato, rimosso).",
    labelNames: ["action"],
    registers: r,
  });
  state.goalActions = new Counter({
    name: `${METRIC_PREFIX}goal_actions_total`,
    help: "Azioni degli utenti sugli obiettivi di risparmio (creato, modificato, eliminato, raggiunto, riaperto, riordinato) per tipo di obiettivo.",
    labelNames: ["action", "kind"],
    registers: r,
  });
  state.subscriptionsDetect = new Histogram({
    name: `${METRIC_PREFIX}subscriptions_detect_duration_seconds`,
    help: "Durata del rilevamento degli abbonamenti per richiesta (lettura delle transazioni compresa).",
    buckets: DURATION_BUCKETS_SECONDS,
    registers: r,
  });

  state.categorizationAiRequests = new Counter({
    name: `${METRIC_PREFIX}categorization_ai_requests_total`,
    help: "Richieste al modello per le categorie, per esito (ok, error): un lotto di esercenti è una richiesta.",
    labelNames: ["outcome"],
    registers: r,
  });
  state.categorizationAiDuration = new Histogram({
    name: `${METRIC_PREFIX}categorization_ai_request_duration_seconds`,
    help: "Durata di una richiesta al modello per le categorie.",
    buckets: DURATION_BUCKETS_SECONDS,
    registers: r,
  });
  state.categorizationSuggestions = new Counter({
    name: `${METRIC_PREFIX}categorization_suggestions_total`,
    help: "Proposte di categoria per esercente: salvate, scartate dal filtro privacy, confermate o corrette dall'utente.",
    labelNames: ["event"],
    registers: r,
  });
  state.categorizationAuto = new Counter({
    name: `${METRIC_PREFIX}categorization_auto_total`,
    help: "Movimenti categorizzati da soli (regole, proposte sicure dal 90% e categorie della banca negli import), poi corretti dall'utente, ricategorizzati con «Ricategorizza» e riportati indietro con l'annulla, per origine.",
    labelNames: ["source", "event"],
    registers: r,
  });

  state.priceProvider = new Counter({
    name: `${METRIC_PREFIX}price_provider_requests_total`,
    help: "Tentativi sulle fonti di prezzi di mercato per fonte ed esito (success, empty, error, skipped...).",
    labelNames: ["provider", "outcome"],
    registers: r,
  });

  state.logoRequests = new Counter({
    name: `${METRIC_PREFIX}logo_requests_total`,
    help: "Richieste al servizio di loghi (strumenti ed esercenti) non servite dalla cache, per origine (issuer, isin, merchant, merchant_search = ricerca per nome) ed esito (hit, miss, error, skipped).",
    labelNames: ["source", "outcome"],
    registers: r,
  });

  state.fundamentalsRequests = new Counter({
    name: `${METRIC_PREFIX}fundamentals_requests_total`,
    help: "Richieste a Yahoo per numeri chiave e bilanci dei titoli non servite dalla cache, per tipo (snapshot, statements) ed esito (ok, empty, error).",
    labelNames: ["kind", "outcome"],
    registers: r,
  });

  state.fxProvider = new Counter({
    name: `${METRIC_PREFIX}fx_provider_requests_total`,
    help: "Tentativi sulle fonti dei cambi (ecb, frankfurter) per fonte ed esito (success, empty, error).",
    labelNames: ["provider", "outcome"],
    registers: r,
  });
  state.priceInstruments = new Counter({
    name: `${METRIC_PREFIX}price_update_instruments_total`,
    help: "Strumenti posseduti per esito dell'aggiornamento giornaliero dei prezzi (updated, fallback, failed).",
    labelNames: ["outcome"],
    registers: r,
  });
  state.gcCleanup = new Counter({
    name: `${METRIC_PREFIX}gocardless_cleanup_total`,
    help: "Requisition/agreement GoCardless trovate dalla pulizia per tipo di azione e modalità (dry-run o execute).",
    labelNames: ["action", "mode"],
    registers: r,
  });
  state.gcRelease = new Counter({
    name: `${METRIC_PREFIX}gocardless_releases_total`,
    help: "Connessioni GoCardless liberate subito (requisition eliminata) per motivo (conto scollegato, rinnovo) ed esito.",
    labelNames: ["trigger", "outcome"],
    registers: r,
  });
  state.gcConnect = new Counter({
    name: `${METRIC_PREFIX}gocardless_connect_attempts_total`,
    help: "Richieste di collegamento bancario per tipo (nuova banca o rinnovo) ed esito (avviata, bloccata da un limite, rifiutata da GoCardless, fallita).",
    labelNames: ["kind", "outcome"],
    registers: r,
  });
  state.inactiveAccounts = new Counter({
    name: `${METRIC_PREFIX}inactive_accounts_total`,
    help: "Account inattivi per azione del cron (warned, deleted, returned, exempt, capped, failed) e modalità (dry-run o execute).",
    labelNames: ["action", "mode"],
    registers: r,
  });
  state.startEvents = new Counter({
    name: `${METRIC_PREFIX}start_events_total`,
    help: "First-steps events: sample data started or cleared, checklist closed, reopened or completed, focus changed.",
    labelNames: ["event"],
    registers: r,
  });
  state.publicDemoEvents = new Counter({
    name: `${METRIC_PREFIX}public_demo_events_total`,
    help: "Demo pubblica: sessioni aperte, demo non disponibile, scritture bloccate e ricostruzioni dei dati, per lingua e paese.",
    labelNames: ["event", "language", "country"],
    registers: r,
  });
  state.consentNotices = new Counter({
    name: `${METRIC_PREFIX}gocardless_consent_notices_total`,
    help: "Email di avviso sul consenso bancario (in scadenza o scaduto) per esito dell'invio.",
    labelNames: ["kind", "outcome"],
    registers: r,
  });
  state.notificationEmails = new Counter({
    name: `${METRIC_PREFIX}notification_emails_total`,
    help: "Email di riepilogo e avvisi (budget, scadenze) per tipo ed esito dell'invio.",
    labelNames: ["kind", "outcome"],
    registers: r,
  });
  state.notificationDigestSections = new Counter({
    name: `${METRIC_PREFIX}notification_digest_sections_total`,
    help: "Sezioni facoltative del riepilogo (investimenti) per esito: inclusa, assente o fallita.",
    labelNames: ["section", "outcome"],
    registers: r,
  });
  state.notificationUnsubscribes = new Counter({
    name: `${METRIC_PREFIX}notification_unsubscribes_total`,
    help: "Disiscrizioni dalle email di riepilogo e avvisi, per tipo (o all) e provenienza.",
    labelNames: ["kind", "source"],
    registers: r,
  });

  new Gauge({
    name: `${METRIC_PREFIX}build_info`,
    help: "Versione e commit dell'app in esecuzione su questo pod (valore sempre 1).",
    labelNames: ["version", "commit"],
    registers: r,
  }).set({ version: APP_BUILD_INFO.version, commit: APP_BUILD_INFO.commit || "unknown" }, 1);

  new Gauge({
    name: `${METRIC_PREFIX}dependency_up`,
    help: "1 se la dipendenza risponde entro il timeout di readiness, 0 altrimenti.",
    labelNames: ["dependency"],
    registers: r,
    async collect() {
      this.reset();
      const read = state.deps.dependencies;
      if (!read) return;
      try {
        const result = await read();
        for (const [dependency, up] of Object.entries(result)) this.set({ dependency }, up ? 1 : 0);
      } catch {
        // assenza del dato per questo scrape
      }
    },
  });

  new Gauge({
    name: `${METRIC_PREFIX}cron_last_success_timestamp_seconds`,
    help: "Epoch dell'ultima esecuzione riuscita del cron (letto da Redis, uguale su tutti i pod).",
    labelNames: ["cron"],
    registers: r,
    async collect() {
      this.reset();
      const read = state.deps.cronLastSuccess;
      if (!read) return;
      try {
        const result = await read();
        for (const [cron, ts] of Object.entries(result)) if (typeof ts === "number") this.set({ cron }, ts);
      } catch {
        // assenza del dato per questo scrape
      }
    },
  });

  // Una gauge con etichetta `state` invece di due gauge senza etichette: prom-client emette sempre 0
  // per una gauge senza etichette anche dopo reset(), e qui vogliamo l'assenza del dato se Redis è giù.
  new Gauge({
    name: `${METRIC_PREFIX}sync_jobs`,
    help: "Job di sync in corso (state=active) o con heartbeat scaduto (state=stale), letti da Redis.",
    labelNames: ["state"],
    registers: r,
    async collect() {
      this.reset();
      const read = state.deps.syncJobs;
      if (!read) return;
      try {
        const { active, stale } = await read();
        this.set({ state: "active" }, active);
        this.set({ state: "stale" }, stale);
      } catch {
        // assenza del dato per questo scrape
      }
    },
  });

  new Gauge({
    name: `${METRIC_PREFIX}gocardless_capacity`,
    help: "Posti dei collegamenti GoCardless: live (requisition vive), recent (consensi negli ultimi 31 giorni), used (il maggiore), limit_global, limit_provider, users_over_limit.",
    labelNames: ["measure"],
    registers: r,
    async collect() {
      this.reset();
      const read = state.deps.gocardlessCapacity;
      if (!read) return;
      try {
        for (const [measure, n] of Object.entries(await read())) this.set({ measure }, n);
      } catch {
        // assenza del dato per questo scrape
      }
    },
  });

  const usageGauge = (
    name: string,
    help: string,
    label: string,
    pick: (u: UsageSnapshot) => Record<string, number>
  ) =>
    new Gauge({
      name: `${METRIC_PREFIX}${name}`,
      help,
      labelNames: [label],
      registers: r,
      async collect() {
        this.reset();
        const read = state.deps.usage;
        if (!read) return;
        try {
          for (const [value, n] of Object.entries(pick(await read()))) this.set({ [label]: value }, n);
        } catch {
          // assenza del dato per questo scrape
        }
      },
    });
  usageGauge("users", "Utenti per stato: registered (tutti), onboarded (onboarding finito), deactivated (in attesa di eliminazione).", "state", (u) => u.users);
  usageGauge("users_new", "Utenti registrati nella finestra indicata (7d, 30d).", "window", (u) => u.newUsers);
  usageGauge("users_active", "Utenti con una sessione attiva nella finestra indicata (24h, 7d, 30d).", "window", (u) => u.activeUsers);
  usageGauge("users_with_feature", "Utenti con almeno un dato per funzione (conti, banca, movimenti, budget, regole, investimenti, debiti, previdenza, abbonamenti confermati, obiettivi di risparmio).", "feature", (u) => u.usersWithFeature);
  usageGauge("users_activation", "Utenti per passo dei primi passi fatto (conto, import, investimento, obiettivo), checklist completa o chiusa, e con dati d'esempio attivi.", "step", (u) => u.activation);
  usageGauge("records", "Righe totali per tipo di dato (conti, movimenti, operazioni di investimento, debiti, fotografie della previdenza).", "kind", (u) => u.records);

  return state;
}

const globalForMetrics = globalThis as unknown as { __bbMetrics?: MetricsState };

/** Stato delle metriche, singleton su globalThis (sopravvive all'HMR in sviluppo). */
function metrics(): MetricsState {
  globalForMetrics.__bbMetrics ??= createState();
  return globalForMetrics.__bbMetrics;
}

/** Registry Prometheus dell'app (usato da `/api/metrics`). */
export function getMetricsRegistry(): Registry {
  return metrics().registry;
}

/** Collega le letture delle gauge asincrone (chiamato dalla route `/api/metrics`). */
export function configureAsyncGauges(deps: AsyncGaugeDeps): void {
  metrics().deps = deps;
}

/** Solo per i test: ricrea da zero registry e metriche. */
export function resetMetricsForTests(): void {
  globalForMetrics.__bbMetrics = createState();
}

/** Classe di status HTTP ("2xx".."5xx") usata come etichetta. */
export function statusClass(status: number): string {
  if (status < 100 || status > 599) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

/** Nome di route non statico (id, numeri lunghi, path con "/"): esploderebbe la cardinalità. */
const DYNAMIC_ROUTE_NAME = /[0-9a-f]{8}-|\/|\d{3,}/i;

/** Verifica che un nome di route sia statico. Lancia in sviluppo/test; in produzione restituisce false. */
export function assertStaticRouteName(route: string): boolean {
  if (!DYNAMIC_ROUTE_NAME.test(route)) return true;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`Nome di route non statico per le metriche: "${route}"`);
  }
  return false;
}

/** Registra una richiesta HTTP a una route API (nome statico, es. "transactions.list"). */
export function recordHttpRequest(route: string, method: string, status: number, durationMs: number): void {
  const safeRoute = assertStaticRouteName(route) ? route : "invalid";
  const m = metrics();
  m.httpRequests.inc({ route: safeRoute, method, status_class: statusClass(status) });
  m.httpDuration.observe({ route: safeRoute, method }, durationMs / 1000);
}

/** Registra l'esito del sync GoCardless di un conto. */
export function recordGoCardlessSync(trigger: SyncTrigger, outcome: SyncOutcome, durationMs: number): void {
  const m = metrics();
  m.syncTotal.inc({ trigger, outcome });
  m.syncDuration.observe({ trigger }, durationMs / 1000);
}

/** Registra una chiamata all'API GoCardless (status 0 = errore di rete). */
export function recordGoCardlessApiRequest(endpoint: GoCardlessEndpoint, status: number): void {
  metrics().gcApi.inc({ endpoint, status_class: status === 0 ? "network_error" : statusClass(status) });
}

/** Registra quante transazioni importate sono state categorizzate automaticamente e quante no. */
export function recordTransactionsImported(categorized: number, uncategorized: number): void {
  const m = metrics();
  if (categorized > 0) m.imported.inc({ categorized: "true" }, categorized);
  if (uncategorized > 0) m.imported.inc({ categorized: "false" }, uncategorized);
}

/** Registra quante transazioni importate hanno ottenuto il nome leggibile da una certa fonte (enum chiuso). */
export function recordMerchantNames(source: MerchantNameSource, count: number): void {
  if (count > 0) metrics().merchantNames.inc({ source }, count);
}

/** Registra l'esecuzione di un cron (il "quando" affidabile è nell'heartbeat su Redis). */
export function recordCronRunMetric(cron: CronName, outcome: CronOutcome): void {
  metrics().cronRuns.inc({ cron, outcome });
}

/** Registra un evento di autenticazione. */
export function recordAuthEvent(event: AuthEvent): void {
  metrics().authEvents.inc({ event });
}

/** Registra l'esito di una segnalazione di supporto. */
export function recordSupportReport(kind: SupportReportKind, outcome: SupportReportOutcome): void {
  metrics().supportReports.inc({ kind, outcome });
}

/** Registra un errore del browser ricevuto da `POST /api/client-errors`. */
export function recordClientError(kind: ClientErrorKind, area: ClientErrorArea, outcome: ClientErrorOutcome): void {
  metrics().clientErrors.inc({ kind, area, outcome });
}

/** Registra una scelta dell'utente sugli abbonamenti. */
export function recordSubscriptionAction(action: SubscriptionAction): void {
  metrics().subscriptionActions.inc({ action });
}

/** Registra un'azione su un obiettivo di risparmio; `kind` è il tipo di obiettivo (enum chiuso) o `all` per il riordino. */
export function recordGoalAction(action: GoalAction, kind: string): void {
  metrics().goalActions.inc({ action, kind });
}

/** Registra la durata di un rilevamento degli abbonamenti. */
export function recordSubscriptionsDetect(durationMs: number): void {
  metrics().subscriptionsDetect.observe(durationMs / 1000);
}

/** Eventi sulle proposte di categoria (enum chiuso). */
export type CategorizationSuggestionEvent = "stored" | "blocked" | "confirmed" | "corrected";

/** Registra l'esito e la durata di una richiesta al modello per le categorie. */
export function recordCategorizationAiRequest(outcome: "ok" | "error", durationMs: number): void {
  const m = metrics();
  m.categorizationAiRequests.inc({ outcome });
  m.categorizationAiDuration.observe(durationMs / 1000);
}

/** Origin of a category applied without the user (closed enum, like `AUTOMATIC_CATEGORY_SOURCES`). */
export type AutoCategorySource = "regola" | "storico" | "assistente" | "banca";

/** Registra `count` movimenti categorizzati da soli per origine. */
export function recordCategorizationAutoApplied(source: AutoCategorySource, count: number): void {
  if (count > 0) metrics().categorizationAuto.inc({ source, event: "applied" }, count);
}

/** Registra `count` movimenti categorizzati da soli che l'utente ha poi spostato in un'altra categoria. */
export function recordCategorizationAutoCorrected(source: AutoCategorySource, count: number): void {
  if (count > 0) metrics().categorizationAuto.inc({ source, event: "corrected" }, count);
}

/** Registra `count` movimenti già categorizzati spostati da «Ricategorizza», per origine della nuova categoria. */
export function recordCategorizationRecategorized(source: AutoCategorySource, count: number): void {
  if (count > 0) metrics().categorizationAuto.inc({ source, event: "recategorized" }, count);
}

/** Registra `count` movimenti riportati com'erano dall'annulla di «Ricategorizza», per origine che avevano ricevuto. */
export function recordCategorizationRecategorizeUndone(source: AutoCategorySource, count: number): void {
  if (count > 0) metrics().categorizationAuto.inc({ source, event: "recategorize_undone" }, count);
}

/** Registra `count` proposte di categoria per un evento (salvate, bloccate dal filtro, confermate, corrette). */
export function recordCategorizationSuggestions(event: CategorizationSuggestionEvent, count: number): void {
  if (count > 0) metrics().categorizationSuggestions.inc({ event }, count);
}

/** Registra un tentativo su una fonte di prezzi (anche le fonti saltate, per vedere quanto si usano le riserve). */
export function recordPriceProviderRequest(provider: ProviderId, outcome: ProviderOutcome): void {
  metrics().priceProvider.inc({ provider, outcome });
}

/** Origine ed esito di una richiesta al servizio di loghi. */
export type LogoSourceKind = "issuer" | "isin" | "merchant" | "merchant_search";
/** `skipped`: ricerca per nome non fatta perché il budget del giorno è finito. */
export type LogoRequestOutcome = "hit" | "miss" | "error" | "skipped";

/** Registra una richiesta al servizio di loghi che non è stata servita dalla cache. */
export function recordLogoRequest(source: LogoSourceKind, outcome: LogoRequestOutcome): void {
  metrics().logoRequests.inc({ source, outcome });
}

/** Tipo ed esito di una richiesta di dati fondamentali (numeri chiave o bilanci) di un titolo. */
export type FundamentalsKind = "snapshot" | "statements";
export type FundamentalsOutcome = "ok" | "empty" | "error";

/** Registra una richiesta di dati fondamentali a Yahoo non servita dalla cache. */
export function recordFundamentalsRequest(kind: FundamentalsKind, outcome: FundamentalsOutcome): void {
  metrics().fundamentalsRequests.inc({ kind, outcome });
}

/** Esito di un tentativo su una fonte dei cambi. */
export type FxOutcome = "success" | "empty" | "error";
/** Esito dell'aggiornamento giornaliero dei prezzi di uno strumento. */
export type PriceInstrumentOutcome = "updated" | "fallback" | "failed";

/** Registra un tentativo su una fonte dei cambi. */
export function recordFxProviderRequest(provider: FxProviderId, outcome: FxOutcome): void {
  metrics().fxProvider.inc({ provider, outcome });
}

/** Registra quanti strumenti il giro dei prezzi ha aggiornato, aggiornato da una riserva o non è riuscito ad aggiornare. */
export function recordPriceInstruments(outcome: PriceInstrumentOutcome, count: number): void {
  if (count > 0) metrics().priceInstruments.inc({ outcome }, count);
}

/** Registra `count` elementi su cui la pulizia GoCardless ha deciso (dry-run) o agito (execute) per tipo di azione. */
export function recordGoCardlessCleanup(action: CleanupAction, mode: CleanupMode, count = 1): void {
  if (count > 0) metrics().gcCleanup.inc({ action, mode }, count);
}

/** Registra una connessione GoCardless liberata subito (o il tentativo fallito, che resta alla pulizia giornaliera). */
export function recordGoCardlessRelease(trigger: GoCardlessReleaseTrigger, outcome: GoCardlessReleaseOutcome): void {
  metrics().gcRelease.inc({ trigger, outcome });
}

/** Registra l'esito di una richiesta di collegamento bancario. */
export function recordGoCardlessConnect(kind: "new" | "renewal", outcome: GoCardlessConnectOutcome): void {
  metrics().gcConnect.inc({ kind, outcome });
}

/** Registra `count` account su cui il cron degli inattivi ha deciso (dry-run) o agito (execute) per tipo di azione. */
export function recordInactiveAccounts(action: InactivityAction, mode: InactivityMode, count = 1): void {
  if (count > 0) metrics().inactiveAccounts.inc({ action, mode }, count);
}

/** Registra l'esito di una email di riepilogo o di avviso. */
export function recordNotificationEmail(kind: NotificationEmailKind, outcome: NotificationEmailOutcome): void {
  metrics().notificationEmails.inc({ kind, outcome });
}

/** Registra se una sezione facoltativa del riepilogo è entrata nell'email. */
export function recordNotificationDigestSection(section: NotificationDigestSection, outcome: NotificationDigestSectionOutcome): void {
  metrics().notificationDigestSections.inc({ section, outcome });
}

/** Registra una disiscrizione (`kind` = tipo di email o `all`). */
export function recordNotificationUnsubscribe(kind: NotificationEmailKind | "all", source: NotificationUnsubscribeSource): void {
  metrics().notificationUnsubscribes.inc({ kind, source });
}

/** Registra l'invio di un avviso email sul consenso bancario. */
export function recordConsentNotice(kind: ConsentNoticeKind, outcome: ConsentNoticeOutcome): void {
  metrics().consentNotices.inc({ kind, outcome });
}

/** Registra un evento dei primi passi (demo avviata/azzerata, checklist chiusa/riaperta/completata). */
export function recordStartEvent(event: StartEvent): void {
  metrics().startEvents.inc({ event });
}

/** Public demo events; `language` (it/en/de) and `country` (IT/DE) are the demo's profile, both closed enums. */
export function recordPublicDemoEvent(event: PublicDemoEvent, language: "it" | "en" | "de", country: "IT" | "DE"): void {
  metrics().publicDemoEvents.inc({ event, language, country });
}
