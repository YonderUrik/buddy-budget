/**
 * Tetto dei collegamenti bancari GoCardless (piano gratuito: 50). Regole pure, senza DB né rete:
 * quante banche può collegare un utente, quanti consensi può avviare al mese e quando i posti globali sono finiti.
 * Il conteggio vero (con il lock contro i collegamenti simultanei) è in `capacity-store.ts`.
 */

import { isSelfHosted, parseFlag } from "@/lib/instance/config";

/** Finestra dei consensi "recenti": 31 giorni contengono sempre il mese di calendario in corso, qualunque sia il conteggio di GoCardless. */
export const ATTEMPT_WINDOW_DAYS = 31;

export interface CapacityLimits {
  /** Banche diverse collegate per utente. */
  perUser: number;
  /** Consensi che un utente può avviare nella finestra (nuovi, rinnovi e tentativi non conclusi). */
  attemptsPerUser: number;
  /** Posti per nuove banche: raggiunto questo numero nessuno collega una banca nuova. */
  global: number;
  /** Limite del piano GoCardless: i rinnovi usano la riserva tra `global` e questo, poi si ferma anche loro. */
  provider: number;
  /**
   * Whether new banks can be connected at all (`BANK_CONNECTIONS_OPEN`). When false only renewals of a bank already
   * linked go through: the hosted version keeps it off until a bank provider for everyone is in place.
   */
  newConnectionsOpen: boolean;
}

export const DEFAULT_CAPACITY_LIMITS: CapacityLimits = { perUser: 1, attemptsPerUser: 3, global: 40, provider: 50, newConnectionsOpen: true };

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Reads the limits from the environment; a missing or invalid value falls back to the default and `provider` never goes
 * below `global`. `BANK_CONNECTIONS_OPEN` unset means closed on the hosted version and open on a self-hosted install
 * (which brings its own GoCardless keys).
 */
export function parseCapacityLimits(env: Record<string, string | undefined>): CapacityLimits {
  const global = positiveInt(env.GOCARDLESS_MAX_CONNECTIONS, DEFAULT_CAPACITY_LIMITS.global);
  return {
    newConnectionsOpen: parseFlag(env.BANK_CONNECTIONS_OPEN) ?? isSelfHosted(env),
    perUser: positiveInt(env.GOCARDLESS_MAX_CONNECTIONS_PER_USER, DEFAULT_CAPACITY_LIMITS.perUser),
    attemptsPerUser: positiveInt(env.GOCARDLESS_MAX_ATTEMPTS_PER_USER, DEFAULT_CAPACITY_LIMITS.attemptsPerUser),
    global,
    provider: Math.max(global, positiveInt(env.GOCARDLESS_PROVIDER_LIMIT, DEFAULT_CAPACITY_LIMITS.provider)),
  };
}

export interface CapacityUsage {
  /** Requisition ancora vive su GoCardless (righe con `requisition_id`). */
  live: number;
  /** Consensi avviati nella finestra, compresi quelli già eliminati. */
  recent: number;
}

/** Posti occupati: il maggiore tra connessioni vive e consensi recenti, perché non è documentato quale dei due conti GoCardless. */
export function usedSlots(usage: CapacityUsage): number {
  return Math.max(usage.live, usage.recent);
}

export interface UserCapacityState {
  /** Banche (institution id) per cui l'utente ha almeno un conto collegato. */
  linkedInstitutionIds: string[];
  /** Consensi avviati dall'utente nella finestra. */
  recentAttempts: number;
}

export type CapacityBlockReason = "paused" | "user_limit" | "user_attempts" | "global_limit" | "provider_limit";
export type ConnectionKind = "new" | "renewal";

export type CapacityDecision =
  | { allowed: true; kind: ConnectionKind }
  | { allowed: false; kind: ConnectionKind; reason: CapacityBlockReason };

/**
 * Decide se l'utente può avviare un consenso per `institutionId`. Una banca già collegata è un rinnovo:
 * non conta nel limite per utente e può usare la riserva fino al limite del piano. Senza `institutionId`
 * risponde per una banca nuova (è ciò che mostra il pulsante «Collega la tua banca»).
 */
export function decideCapacity(
  user: UserCapacityState,
  usage: CapacityUsage,
  limits: CapacityLimits,
  institutionId?: string
): CapacityDecision {
  const kind: ConnectionKind = institutionId && user.linkedInstitutionIds.includes(institutionId) ? "renewal" : "new";
  if (kind === "new" && !limits.newConnectionsOpen) return { allowed: false, kind, reason: "paused" };
  const used = usedSlots(usage);
  if (used >= limits.provider) return { allowed: false, kind, reason: "provider_limit" };
  if (kind === "new" && used >= limits.global) return { allowed: false, kind, reason: "global_limit" };
  if (kind === "new" && new Set(user.linkedInstitutionIds).size >= limits.perUser) return { allowed: false, kind, reason: "user_limit" };
  if (user.recentAttempts >= limits.attemptsPerUser) return { allowed: false, kind, reason: "user_attempts" };
  return { allowed: true, kind };
}

/** Messaggio per l'utente quando il collegamento è bloccato (stesso testo dalla route e dall'interfaccia). */
export const CAPACITY_BLOCK_MESSAGES: Record<CapacityBlockReason, string> = {
  paused: "Il collegamento automatico alla banca arriva presto. Intanto puoi tenere il conto a mano o importare un file.",
  user_limit: "Per ora puoi collegare una sola banca. Gli altri conti puoi tenerli a mano o importarli da un file.",
  user_attempts: "Hai avviato troppi collegamenti questo mese. Riprova più avanti, oppure tieni il conto a mano o importa un file.",
  global_limit: "I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file.",
  provider_limit: "I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file.",
};
