/**
 * Impronta dei dati da cui si ricostruisce lo storico "investimenti" di un utente (operazioni, prezzi, cambi): se
 * non è cambiata dall'ultima ricostruzione non si ricalcola nulla. Perderla costa solo un ricalcolo in più.
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
