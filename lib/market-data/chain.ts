import type { ProviderBudgetStore } from "./budget";
import { ProviderBlockedError, ProviderRateLimitedError } from "./errors";
import type {
  ChainInstrument,
  DailyClose,
  PriceProvider,
  ProviderContext,
  ProviderId,
  ProviderOutcome,
  SkipReason,
} from "./types";

/** Errori consecutivi dopo i quali una fonte si salta per il resto dell'esecuzione. */
export const CIRCUIT_BREAKER_THRESHOLD = 3;
/** Scostamento oltre il quale una chiusura da una fonte diversa dalla precedente viene segnalata come sospetta. */
export const SUSPECT_CHANGE_RATIO = 0.2;

/**
 * Stato condiviso tra tutti gli strumenti di una stessa esecuzione (un giro del cron, un recupero storico):
 * interruttore per fonte e orario dell'ultima chiamata per rispettare le pause.
 */
export interface ChainRunState {
  consecutiveFailures: Map<ProviderId, number>;
  open: Set<ProviderId>;
  lastCallAt: Map<ProviderId, number>;
}

/** Stato vuoto per una nuova esecuzione. */
export function createChainRunState(): ChainRunState {
  return { consecutiveFailures: new Map(), open: new Set(), lastCallAt: new Map() };
}

/** Un tentativo su una fonte, per metriche e log. */
export interface ChainAttempt {
  provider: ProviderId;
  outcome: ProviderOutcome;
  reason?: SkipReason;
}

export interface ChainResult {
  /** Chiusure valide della prima fonte che ha risposto bene, ordinate per data; vuoto se tutte hanno fallito. */
  closes: DailyClose[];
  source: ProviderId | null;
  attempts: ChainAttempt[];
  /** Vero se la nuova chiusura si scosta molto dalla precedente e arriva da un'altra fonte. */
  suspect: boolean;
}

export interface RunChainParams {
  instrument: ChainInstrument;
  /** Simbolo dello strumento per ciascuna fonte; una fonte senza simbolo si salta. */
  symbols: Partial<Record<ProviderId, string>>;
  from: string;
  to: string;
  /** `backfill` usa solo fonti senza limiti di storico. */
  purpose: "daily" | "backfill";
  chain: readonly ProviderId[];
  providers: Partial<Record<ProviderId, PriceProvider>>;
  ctx: ProviderContext;
  state: ChainRunState;
  budget: ProviderBudgetStore;
  /** Ultima chiusura già salvata, per il controllo di plausibilità. */
  lastClose?: { close: number; source: string } | null;
  dayKey: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function skipReason(params: RunChainParams, provider: PriceProvider | undefined, id: ProviderId): SkipReason | null {
  if (!provider) return "no_symbol";
  if (provider.requiredKeyEnv && !params.ctx.env[provider.requiredKeyEnv]) return "no_key";
  if (!params.symbols[id]) return "no_symbol";
  if (params.state.open.has(id)) return "circuit_open";
  if (params.purpose === "backfill" && provider.maxHistory === "limited") return "limited_history";
  return null;
}

function recordFailure(state: ChainRunState, id: ProviderId, openNow = false): void {
  const failures = (state.consecutiveFailures.get(id) ?? 0) + 1;
  state.consecutiveFailures.set(id, failures);
  if (openNow || failures >= CIRCUIT_BREAKER_THRESHOLD) state.open.add(id);
}

function isSuspect(params: RunChainParams, closes: DailyClose[], source: ProviderId): boolean {
  const last = params.lastClose;
  if (!last || last.source === source || params.instrument.type === "crypto" || last.close <= 0) return false;
  const latest = closes[closes.length - 1].close;
  return Math.abs(latest / last.close - 1) > SUSPECT_CHANGE_RATIO;
}

/**
 * Chiede le chiusure alle fonti in ordine e restituisce la prima risposta valida (spec investimenti, sezione 2.1):
 * almeno una chiusura positiva nel periodo e nella valuta dello strumento. Salta le fonti senza chiave, senza
 * simbolo, con l'interruttore aperto, a budget esaurito o, per il recupero storico, con storico limitato.
 */
export async function runChain(params: RunChainParams): Promise<ChainResult> {
  const now = params.now ?? Date.now;
  const sleep = params.sleep ?? defaultSleep;
  const attempts: ChainAttempt[] = [];

  for (const id of params.chain) {
    const provider = params.providers[id];
    const reason = skipReason(params, provider, id);
    if (reason || !provider) {
      attempts.push({ provider: id, outcome: "skipped", reason: reason ?? "no_symbol" });
      continue;
    }
    if (provider.dailyBudget !== undefined && !(await params.budget.tryConsume(id, provider.dailyBudget, params.dayKey))) {
      attempts.push({ provider: id, outcome: "skipped", reason: "budget_exhausted" });
      continue;
    }

    const wait = (params.state.lastCallAt.get(id) ?? 0) + provider.minDelayMs - now();
    if (wait > 0) await sleep(wait);
    params.state.lastCallAt.set(id, now());

    let raw: DailyClose[];
    try {
      raw = await provider.fetchDailyCloses(params.symbols[id]!, params.from, params.to, params.ctx);
    } catch (error) {
      if (error instanceof ProviderBlockedError) {
        recordFailure(params.state, id, true);
        attempts.push({ provider: id, outcome: "blocked" });
      } else if (error instanceof ProviderRateLimitedError) {
        recordFailure(params.state, id);
        attempts.push({ provider: id, outcome: "rate_limited" });
      } else {
        recordFailure(params.state, id);
        attempts.push({ provider: id, outcome: "error" });
      }
      continue;
    }

    const inRange = raw
      .filter((c) => Number.isFinite(c.close) && c.close > 0 && c.date >= params.from && c.date <= params.to)
      .sort((a, b) => a.date.localeCompare(b.date));
    // La fonte ha risposto: anche "vuoto" o "valuta sbagliata" non sono guasti della fonte.
    params.state.consecutiveFailures.set(id, 0);
    if (inRange.length === 0) {
      attempts.push({ provider: id, outcome: "empty" });
      continue;
    }
    const expected = params.instrument.currency.toUpperCase();
    if (inRange.some((c) => c.currency !== null && c.currency.toUpperCase() !== expected)) {
      attempts.push({ provider: id, outcome: "currency_mismatch" });
      continue;
    }

    attempts.push({ provider: id, outcome: "success" });
    return { closes: inRange, source: id, attempts, suspect: isSuspect(params, inRange, id) };
  }

  return { closes: [], source: null, attempts, suspect: false };
}
