/**
 * Fingerprint of the data a user's reconstructed history comes from (investments: operations, prices, FX; cash:
 * accounts and transactions): if it has not changed since the last reconstruction nothing is recomputed. Losing it
 * only costs one extra recomputation. Used by both histories, each with its own key.
 */
export interface InvestmentHistoryStateStore {
  get(userId: string): Promise<string | null>;
  set(userId: string, fingerprint: string): Promise<void>;
}

/** Store in memoria, per test e script. */
export function createMemoryHistoryStateStore(): InvestmentHistoryStateStore {
  const values = new Map<string, string>();
  return {
    async get(userId) {
      return values.get(userId) ?? null;
    },
    async set(userId, fingerprint) {
      values.set(userId, fingerprint);
    },
  };
}
