/** Store minimale su cui gira la logica di rate limit — Redis in produzione, una Map nei test. */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function rateLimitKey(externalAccountId: string, endpoint: string): string {
  return `gocardless:ratelimit:${endpoint}:${externalAccountId}`;
}

/** Salva le chiamate rimaste per un conto/endpoint, lette dagli header di risposta GoCardless. */
export async function recordRateLimit(
  store: RateLimitStore,
  externalAccountId: string,
  endpoint: string,
  remaining: number,
  resetSeconds: number
): Promise<void> {
  await store.set(rateLimitKey(externalAccountId, endpoint), String(remaining), Math.max(1, resetSeconds));
}

/** True se non restano chiamate per quel conto/endpoint; nessuna voce registrata = via libera. */
export async function isRateLimited(
  store: RateLimitStore,
  externalAccountId: string,
  endpoint: string
): Promise<boolean> {
  const value = await store.get(rateLimitKey(externalAccountId, endpoint));
  if (value === null) return false;
  return Number(value) <= 0;
}
