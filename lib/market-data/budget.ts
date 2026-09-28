import type { ProviderId } from "./types";

/** Contatore giornaliero delle chiamate alle fonti a quota (Alpha Vantage & co.). */
export interface ProviderBudgetStore {
  /** Consuma una chiamata del budget di oggi; false se il budget è esaurito. */
  tryConsume(provider: ProviderId, dailyLimit: number, dayKey: string): Promise<boolean>;
}

/** Budget in memoria: per test e script. In produzione si usa quello su Redis (condiviso tra pod). */
export function createMemoryBudgetStore(): ProviderBudgetStore {
  const counts = new Map<string, number>();
  return {
    async tryConsume(provider, dailyLimit, dayKey) {
      const key = `${provider}:${dayKey}`;
      const used = counts.get(key) ?? 0;
      if (used >= dailyLimit) return false;
      counts.set(key, used + 1);
      return true;
    },
  };
}
