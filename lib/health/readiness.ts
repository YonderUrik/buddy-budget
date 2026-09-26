export type CheckStatus = "ok" | "error";

export interface ReadinessResult {
  ready: boolean;
  checks: Record<string, CheckStatus>;
}

/** Una probe risolve se la dipendenza risponde, rigetta (o non risolve) altrimenti. */
export type ReadinessProbe = () => Promise<unknown>;

/** Oltre questo tempo una dipendenza è considerata giù (ioredis altrimenti ritenta a lungo in silenzio). */
export const READINESS_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Esegue le probe in parallelo, ciascuna col suo timeout; pronto solo se tutte rispondono. */
export async function checkReadiness(
  probes: Record<string, ReadinessProbe>,
  timeoutMs: number = READINESS_TIMEOUT_MS
): Promise<ReadinessResult> {
  const entries = await Promise.all(
    Object.entries(probes).map(async ([name, probe]): Promise<[string, CheckStatus]> => {
      try {
        // Promise.resolve().then(probe) trasforma anche un throw sincrono in un rigetto.
        await withTimeout(Promise.resolve().then(probe), timeoutMs);
        return [name, "ok"];
      } catch {
        return [name, "error"];
      }
    })
  );
  return {
    ready: entries.every(([, status]) => status === "ok"),
    checks: Object.fromEntries(entries),
  };
}
