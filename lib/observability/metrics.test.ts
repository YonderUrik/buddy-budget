import { beforeEach, describe, expect, it } from "vitest";
import {
  assertStaticRouteName,
  configureAsyncGauges,
  getMetricsRegistry,
  recordAuthEvent,
  recordCronRunMetric,
  recordGoCardlessApiRequest,
  recordGoCardlessSync,
  recordHttpRequest,
  recordTransactionsImported,
  resetMetricsForTests,
  statusClass,
} from "./metrics";

async function text() {
  return getMetricsRegistry().metrics();
}

describe("metriche applicative", () => {
  beforeEach(() => resetMetricsForTests());

  it("statusClass raggruppa gli status", () => {
    expect(statusClass(200)).toBe("2xx");
    expect(statusClass(429)).toBe("4xx");
    expect(statusClass(503)).toBe("5xx");
    expect(statusClass(42)).toBe("unknown");
  });

  it("registra richieste HTTP con classe di status e durata", async () => {
    recordHttpRequest("transactions.list", "GET", 200, 120);
    recordHttpRequest("transactions.list", "GET", 500, 30);
    const t = await text();
    expect(t).toContain('buddybudget_http_requests_total{route="transactions.list",method="GET",status_class="2xx"} 1');
    expect(t).toContain('buddybudget_http_requests_total{route="transactions.list",method="GET",status_class="5xx"} 1');
    expect(t).toContain('buddybudget_http_request_duration_seconds_count{route="transactions.list",method="GET"} 2');
  });

  it("rifiuta nomi di route dinamici (cardinalità)", () => {
    expect(assertStaticRouteName("gocardless.connections.finalize")).toBe(true);
    expect(() => assertStaticRouteName("/api/transactions/3f2b8c1e-9a4d-4e5f-8a1b-2c3d4e5f6a7b")).toThrow();
    expect(() => assertStaticRouteName("transactions.12345")).toThrow();
    expect(() => recordHttpRequest("transactions/abc", "GET", 200, 1)).toThrow();
  });

  it("registra sync, chiamate API, import, cron e auth", async () => {
    recordGoCardlessSync("cron", "synced", 2000);
    recordGoCardlessApiRequest("accounts.transactions", 429);
    recordGoCardlessApiRequest("token.new", 0);
    recordTransactionsImported(3, 2);
    recordTransactionsImported(0, 0);
    recordCronRunMetric("gocardless_sync", "success");
    recordAuthEvent("magic_link_failed");
    const t = await text();
    expect(t).toContain('buddybudget_gocardless_sync_total{trigger="cron",outcome="synced"} 1');
    expect(t).toContain('buddybudget_gocardless_api_requests_total{endpoint="accounts.transactions",status_class="4xx"} 1');
    expect(t).toContain('buddybudget_gocardless_api_requests_total{endpoint="token.new",status_class="network_error"} 1');
    expect(t).toContain('buddybudget_transactions_imported_total{categorized="true"} 3');
    expect(t).toContain('buddybudget_transactions_imported_total{categorized="false"} 2');
    expect(t).toContain('buddybudget_cron_runs_total{cron="gocardless_sync",outcome="success"} 1');
    expect(t).toContain('buddybudget_auth_events_total{event="magic_link_failed"} 1');
  });

  it("espone build_info e metriche di processo", async () => {
    const t = await text();
    expect(t).toMatch(/buddybudget_build_info\{version="[^"]*",commit="[^"]*"\} 1/);
    expect(t).toContain("buddybudget_process_");
  });

  it("le gauge asincrone leggono le dipendenze al momento dello scrape", async () => {
    configureAsyncGauges({
      dependencies: async () => ({ postgres: true, redis: false }),
      cronLastSuccess: async () => ({ gocardless_sync: 1_790_000_000, net_worth_snapshot: null }),
      syncJobs: async () => ({ active: 2, stale: 1 }),
    });
    const t = await text();
    expect(t).toContain('buddybudget_dependency_up{dependency="postgres"} 1');
    expect(t).toContain('buddybudget_dependency_up{dependency="redis"} 0');
    expect(t).toContain('buddybudget_cron_last_success_timestamp_seconds{cron="gocardless_sync"} 1790000000');
    expect(t).not.toContain('cron="net_worth_snapshot"} ');
    expect(t).toContain('buddybudget_sync_jobs{state="active"} 2');
    expect(t).toContain('buddybudget_sync_jobs{state="stale"} 1');
  });

  it("se una lettura lancia la gauge non emette campioni (niente valori inventati)", async () => {
    const fail = async () => {
      throw new Error("redis giù");
    };
    configureAsyncGauges({ dependencies: fail, cronLastSuccess: fail, syncJobs: fail });
    const t = await text();
    expect(t).not.toMatch(/^buddybudget_dependency_up\{/m);
    expect(t).not.toMatch(/^buddybudget_cron_last_success_timestamp_seconds\{/m);
    expect(t).not.toMatch(/^buddybudget_sync_jobs\{/m);
  });

  it("espone i numeri di utilizzo letti allo scrape", async () => {
    configureAsyncGauges({
      usage: async () => ({
        users: { registered: 12, onboarded: 10, deactivated: 1 },
        newUsers: { "7d": 3, "30d": 9 },
        activeUsers: { "24h": 2, "7d": 6, "30d": 8 },
        usersWithFeature: { accounts: 9, bank_connection: 4, transactions: 8, budgets: 3, rules: 2, investments: 5, debts: 1, pension: 2 },
        records: { accounts: 20, transactions: 4000, investment_operations: 150, debts: 2, pension_snapshots: 12 },
        activation: { conto: 8, import: 5, investimento: 3, obiettivo: 4, completa: 1, chiusa: 2, demo_attiva: 1 },
      }),
    });
    const t = await text();
    expect(t).toContain('buddybudget_users{state="registered"} 12');
    expect(t).toContain('buddybudget_users_new{window="7d"} 3');
    expect(t).toContain('buddybudget_users_active{window="30d"} 8');
    expect(t).toContain('buddybudget_users_with_feature{feature="investments"} 5');
    expect(t).toContain('buddybudget_records{kind="transactions"} 4000');
  });

  it("senza lettura dell'utilizzo le gauge non emettono campioni", async () => {
    configureAsyncGauges({ usage: async () => Promise.reject(new Error("db giù")) });
    expect(await text()).not.toMatch(/^buddybudget_users\{/m);
  });
});
