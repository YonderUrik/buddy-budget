import type { Account } from "@/lib/db/schema/accounts";

export interface AccountsKpiResult {
  totalLiquidity: number;
  linkedAccountsCount: number;
}

/** Calcola i KPI aggregati (liquidità totale, conteggio conti) a partire dalla lista conti. */
export function computeAccountsKpi(accounts: Account[]): AccountsKpiResult {
  const totalLiquidity = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  return { totalLiquidity, linkedAccountsCount: accounts.length };
}
