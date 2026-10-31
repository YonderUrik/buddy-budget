import type { ResolveDeps } from "@/lib/investments/import/resolve";

/** How long a background import waits on a throttled source: OpenFIGI without a key allows 25 requests a minute. */
export const PATIENT_ATTEMPTS = 5;
export const PATIENT_WAIT_MS = 15_000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Market searches for an import that runs in the background: a source that is throttled or down is asked again a
 * few times before the answer counts. Without this, every security after the 25th of a big statement became a
 * manual one with no prices (2026-10-31): a temporary refusal turned into a permanent result nobody sees.
 * Interactive search in the app keeps the plain, immediate searches.
 */
export function patientSearches(deps: Required<Pick<ResolveDeps, "searchByIsin">> & ResolveDeps, options: { attempts?: number; waitMs?: number; sleep?: (ms: number) => Promise<void> } = {}): ResolveDeps {
  const attempts = options.attempts ?? PATIENT_ATTEMPTS;
  const waitMs = options.waitMs ?? PATIENT_WAIT_MS;
  const sleep = options.sleep ?? wait;
  async function retry<T>(call: () => Promise<T>, unavailable: (value: T) => boolean): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        const value = await call();
        if (!unavailable(value) || attempt >= attempts) return value;
      } catch (error) {
        if (attempt >= attempts) throw error;
      }
      await sleep(waitMs * attempt);
    }
  }
  return {
    searchMarket: (query) => retry(() => deps.searchMarket(query), () => false),
    searchCrypto: (query) => retry(() => deps.searchCrypto(query), () => false),
    searchByIsin: (isin, currency, exchange) => retry(() => deps.searchByIsin(isin, currency, exchange), (found) => found.status === "unavailable"),
  };
}
