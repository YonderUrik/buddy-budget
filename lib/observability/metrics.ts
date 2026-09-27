import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { APP_BUILD_INFO } from "@/lib/app-version";

/** Prefisso comune di tutte le metriche applicative. */
export const METRIC_PREFIX = "buddybudget_";

/** Bucket (secondi) degli istogrammi di durata: da 50ms a 5 minuti (maxDuration dei job). */
export const DURATION_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

export type SyncTrigger = "manual" | "cron" | "finalize";
export type SyncOutcome = "synced" | "limited" | "expired" | "error";
export type CronName = "gocardless_sync" | "net_worth_snapshot";
export type CronOutcome = "success" | "error";
export type AuthEvent = "magic_link_sent" | "magic_link_failed" | "sign_in" | "rate_limited";
export type DependencyName = "postgres" | "redis";

/** Template statici degli endpoint GoCardless (mai il path reale: contiene id di conto). */
export type GoCardlessEndpoint =
  | "token.new"
  | "agreements.create"
  | "institutions.list"
  | "requisitions.create"
  | "requisitions.get"
  | "accounts.details"
  | "accounts.balances"
  | "accounts.transactions";

export const CRON_NAMES: readonly CronName[] = ["gocardless_sync", "net_worth_snapshot"];

/**
 * Letture fatte al momento dello scrape (gauge "asincrone"). Se una lettura lancia, la gauge
 * non emette campioni per quello scrape: meglio l'assenza del dato (gestibile con `absent()`)
 * di un valore inventato.
 */
export interface AsyncGaugeDeps {
  dependencies?: () => Promise<Record<DependencyName, boolean>>;
  cronLastSuccess?: () => Promise<Partial<Record<CronName, number | null>>>;
  syncJobs?: () => Promise<{ active: number; stale: number }>;
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
  cronRuns: Counter<"cron" | "outcome">;
  authEvents: Counter<"event">;
}

function createState(): MetricsState {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: `${METRIC_PREFIX}process_` });
  const state = { registry, deps: {} } as MetricsState;
  const r = [registry];

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

/** Registra l'esecuzione di un cron (il "quando" affidabile è nell'heartbeat su Redis). */
export function recordCronRunMetric(cron: CronName, outcome: CronOutcome): void {
  metrics().cronRuns.inc({ cron, outcome });
}

/** Registra un evento di autenticazione. */
export function recordAuthEvent(event: AuthEvent): void {
  metrics().authEvents.inc({ event });
}
