import "server-only";
import { client } from "@/lib/db/client";
import type { UsageSnapshot } from "./metrics";

/** Durata della cache in memoria: lo scrape è ogni pochi secondi, i conteggi non cambiano così in fretta. */
export const USAGE_CACHE_TTL_MS = 60_000;

interface UsageRow {
  registered: number;
  onboarded: number;
  deactivated: number;
  new_7d: number;
  new_30d: number;
  active_24h: number;
  active_7d: number;
  active_30d: number;
  f_accounts: number;
  f_bank_connection: number;
  f_transactions: number;
  f_budgets: number;
  f_rules: number;
  f_investments: number;
  f_debts: number;
  f_pension: number;
  r_accounts: number;
  r_transactions: number;
  r_investment_operations: number;
  r_debts: number;
  r_pension_snapshots: number;
  a_conto: number;
  a_import: number;
  a_investimento: number;
  a_obiettivo: number;
  a_completa: number;
  a_chiusa: number;
  a_demo: number;
}

let cache: { at: number; value: UsageSnapshot } | null = null;

/**
 * Conteggi aggregati di utilizzo (utenti, nuovi, attivi, funzioni usate) in una sola query.
 * "Attivo" = ha una sessione aggiornata nella finestra (better-auth aggiorna `updated_at` al più una volta al giorno,
 * quindi la finestra 24h è approssimata). Solo numeri, mai identificativi.
 */
export async function readUsageSnapshot(now = Date.now()): Promise<UsageSnapshot> {
  if (cache && now - cache.at < USAGE_CACHE_TTL_MS) return cache.value;
  const [row] = await client<UsageRow[]>`
    select
      (select count(*)::int from auth_user) as registered,
      (select count(*)::int from auth_user where onboarding_completed) as onboarded,
      (select count(*)::int from auth_user where deletion_scheduled_at is not null) as deactivated,
      (select count(*)::int from auth_user where created_at > now() - interval '7 days') as new_7d,
      (select count(*)::int from auth_user where created_at > now() - interval '30 days') as new_30d,
      (select count(distinct user_id)::int from auth_session where updated_at > now() - interval '24 hours') as active_24h,
      (select count(distinct user_id)::int from auth_session where updated_at > now() - interval '7 days') as active_7d,
      (select count(distinct user_id)::int from auth_session where updated_at > now() - interval '30 days') as active_30d,
      (select count(distinct user_id)::int from accounts where not is_demo) as f_accounts,
      (select count(distinct user_id)::int from bank_connections where status = 'linked') as f_bank_connection,
      (select count(distinct t.user_id)::int from transactions t join accounts a on a.id = t.account_id where not a.is_demo) as f_transactions,
      (select count(distinct user_id)::int from budgets) as f_budgets,
      (select count(distinct user_id)::int from categorization_rules) as f_rules,
      (select count(distinct user_id)::int from investment_transactions) as f_investments,
      (select count(distinct user_id)::int from debts) as f_debts,
      (select count(distinct user_id)::int from pension_funds) as f_pension,
      (select count(*)::int from accounts where not is_demo) as r_accounts,
      (select count(*)::int from transactions t join accounts a on a.id = t.account_id where not a.is_demo) as r_transactions,
      (select count(*)::int from investment_transactions) as r_investment_operations,
      (select count(*)::int from debts) as r_debts,
      (select count(*)::int from pension_snapshots) as r_pension_snapshots,
      (select count(distinct user_id)::int from accounts where not is_demo) as a_conto,
      (select count(distinct t.user_id)::int from transactions t join accounts a on a.id = t.account_id where t.source = 'auto' and not a.is_demo) as a_import,
      (select count(distinct user_id)::int from investment_transactions) as a_investimento,
      (select count(distinct u) ::int from (
        select user_id as u from budgets
        union select user_id from analytics_assumptions where data <> '{}'::jsonb
      ) g) as a_obiettivo,
      (select count(*)::int from auth_user where start_checklist_completed_at is not null) as a_completa,
      (select count(*)::int from auth_user where start_checklist_dismissed_at is not null) as a_chiusa,
      (select count(distinct user_id)::int from accounts where is_demo) as a_demo
  `;
  const value: UsageSnapshot = {
    users: { registered: row.registered, onboarded: row.onboarded, deactivated: row.deactivated },
    newUsers: { "7d": row.new_7d, "30d": row.new_30d },
    activeUsers: { "24h": row.active_24h, "7d": row.active_7d, "30d": row.active_30d },
    usersWithFeature: {
      accounts: row.f_accounts,
      bank_connection: row.f_bank_connection,
      transactions: row.f_transactions,
      budgets: row.f_budgets,
      rules: row.f_rules,
      investments: row.f_investments,
      debts: row.f_debts,
      pension: row.f_pension,
    },
    records: {
      accounts: row.r_accounts,
      transactions: row.r_transactions,
      investment_operations: row.r_investment_operations,
      debts: row.r_debts,
      pension_snapshots: row.r_pension_snapshots,
    },
    activation: {
      conto: row.a_conto,
      import: row.a_import,
      investimento: row.a_investimento,
      obiettivo: row.a_obiettivo,
      completa: row.a_completa,
      chiusa: row.a_chiusa,
      demo_attiva: row.a_demo,
    },
  };
  cache = { at: now, value };
  return value;
}
