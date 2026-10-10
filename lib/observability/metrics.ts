import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { APP_BUILD_INFO } from "@/lib/app-version";
import type { ProviderId } from "@/lib/db/schema/investments";
import type { FxProviderId, ProviderOutcome } from "@/lib/market-data/types";
import type { MerchantNameSource } from "@/lib/categorization/merchant-name";

/** Prefisso comune di tutte le metriche applicative. */
export const METRIC_PREFIX = "buddybudget_";

/** Bucket (secondi) degli istogrammi di durata: da 50ms a 5 minuti (maxDuration dei job). */
export const DURATION_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

export type SyncTrigger = "manual" | "cron" | "finalize";
export type SyncOutcome = "synced" | "limited" | "expired" | "error";
export type CronName = "gocardless_sync" | "net_worth_snapshot" | "market_prices" | "account_deletion" | "gocardless_maintenance";
export type CronOutcome = "success" | "error";
export type AuthEvent = "magic_link_sent" | "magic_link_failed" | "sign_in" | "rate_limited";
export type SupportReportKind = "problema" | "domanda" | "idea";
export type SupportReportOutcome = "sent" | "failed" | "rate_limited";
export type DependencyName = "postgres" | "redis";

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
export type StartEvent = "demo_started" | "demo_cleared" | "checklist_dismissed" | "checklist_reopened" | "checklist_completed";
export type UsageFeature = "accounts" | "bank_connection" | "transactions" | "budgets" | "rules" | "investments" | "debts" | "pension";
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
  | "skipped_linked"
  | "capped"
  | "failed";
/** Avvisi di consenso bancario (scadenza vicina o scaduto) per esito dell'invio email. */
export type ConsentNoticeKind = "expiring" | "expired";
export type ConsentNoticeOutcome = "sent" | "failed";

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
  priceProvider: Counter<"provider" | "outcome">;
  logoRequests: Counter<"source" | "outcome">;
  fxProvider: Counter<"provider" | "outcome">;
  priceInstruments: Counter<"outcome">;
  gcCleanup: Counter<"action" | "mode">;
  consentNotices: Counter<"kind" | "outcome">;
  startEvents: Counter<"event">;
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

  state.priceProvider = new Counter({
    name: `${METRIC_PREFIX}price_provider_requests_total`,
    help: "Tentativi sulle fonti di prezzi di mercato per fonte ed esito (success, empty, error, skipped...).",
    labelNames: ["provider", "outcome"],
    registers: r,
  });

  state.logoRequests = new Counter({
    name: `${METRIC_PREFIX}logo_requests_total`,
    help: "Richieste al servizio di loghi degli strumenti non servite dalla cache, per origine (issuer, isin) ed esito (hit, miss, error).",
    labelNames: ["source", "outcome"],
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
  state.startEvents = new Counter({
    name: `${METRIC_PREFIX}start_events_total`,
    help: "Eventi dei primi passi: dati d'esempio avviati o azzerati, checklist chiusa, riaperta o completata.",
    labelNames: ["event"],
    registers: r,
  });
  state.consentNotices = new Counter({
    name: `${METRIC_PREFIX}gocardless_consent_notices_total`,
    help: "Email di avviso sul consenso bancario (in scadenza o scaduto) per esito dell'invio.",
    labelNames: ["kind", "outcome"],
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
  usageGauge("users_with_feature", "Utenti con almeno un dato per funzione (conti, banca, movimenti, budget, regole, investimenti, debiti, previdenza).", "feature", (u) => u.usersWithFeature);
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

/** Registra un tentativo su una fonte di prezzi (anche le fonti saltate, per vedere quanto si usano le riserve). */
export function recordPriceProviderRequest(provider: ProviderId, outcome: ProviderOutcome): void {
  metrics().priceProvider.inc({ provider, outcome });
}

/** Origine ed esito di una richiesta al servizio di loghi. */
export type LogoSourceKind = "issuer" | "isin";
export type LogoRequestOutcome = "hit" | "miss" | "error";

/** Registra una richiesta al servizio di loghi che non è stata servita dalla cache. */
export function recordLogoRequest(source: LogoSourceKind, outcome: LogoRequestOutcome): void {
  metrics().logoRequests.inc({ source, outcome });
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

/** Registra l'invio di un avviso email sul consenso bancario. */
export function recordConsentNotice(kind: ConsentNoticeKind, outcome: ConsentNoticeOutcome): void {
  metrics().consentNotices.inc({ kind, outcome });
}

/** Registra un evento dei primi passi (demo avviata/azzerata, checklist chiusa/riaperta/completata). */
export function recordStartEvent(event: StartEvent): void {
  metrics().startEvents.inc({ event });
}
