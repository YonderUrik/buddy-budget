/**
 * Tetto dei collegamenti bancari (piano gratuito GoCardless: 50; Enable Banking si paga a volume). Regole pure, senza DB né rete:
 * quante banche può collegare un utente, quanti consensi può avviare al mese e quando i posti globali sono finiti.
 * Il conteggio vero (con il lock contro i collegamenti simultanei) è in `capacity-store.ts`.
 */

/** Finestra dei consensi "recenti": 31 giorni contengono sempre il mese di calendario in corso, qualunque sia il conteggio del fornitore. */
export const ATTEMPT_WINDOW_DAYS = 31;

export interface CapacityLimits {
  /** Banche diverse collegate per utente. */
  perUser: number;
  /** Consensi che un utente può avviare nella finestra (nuovi, rinnovi e tentativi non conclusi). */
  attemptsPerUser: number;
  /** Posti per nuove banche: raggiunto questo numero nessuno collega una banca nuova. */
  global: number;
  /** Limite del piano del fornitore: i rinnovi usano la riserva tra `global` e questo, poi si fermano anche loro. */
  provider: number;
}

export const DEFAULT_CAPACITY_LIMITS: CapacityLimits = { perUser: 1, attemptsPerUser: 3, global: 40, provider: 50 };

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/** `BANK_<nome>`, altrimenti il vecchio `GOCARDLESS_<nome>` (così il Deployment attuale continua a valere). */
function limitEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[`BANK_${name}`];
  return value === undefined || value.trim() === "" ? env[`GOCARDLESS_${name}`] : value;
}

/** Legge i limiti dalle variabili d'ambiente; un valore assente o non valido torna al default. `provider` non scende mai sotto `global`. */
export function parseCapacityLimits(env: Record<string, string | undefined>): CapacityLimits {
  const global = positiveInt(limitEnv(env, "MAX_CONNECTIONS"), DEFAULT_CAPACITY_LIMITS.global);
  return {
    perUser: positiveInt(limitEnv(env, "MAX_CONNECTIONS_PER_USER"), DEFAULT_CAPACITY_LIMITS.perUser),
    attemptsPerUser: positiveInt(limitEnv(env, "MAX_ATTEMPTS_PER_USER"), DEFAULT_CAPACITY_LIMITS.attemptsPerUser),
    global,
    provider: Math.max(global, positiveInt(limitEnv(env, "PROVIDER_LIMIT"), DEFAULT_CAPACITY_LIMITS.provider)),
  };
}

export interface CapacityUsage {
  /** Consensi ancora vivi presso il fornitore (righe con `requisition_id`). */
  live: number;
  /** Consensi avviati nella finestra, compresi quelli già eliminati. */
  recent: number;
}

/** Posti occupati: il maggiore tra connessioni vive e consensi recenti, perché non è documentato quale dei due conti il fornitore. */
export function usedSlots(usage: CapacityUsage): number {
  return Math.max(usage.live, usage.recent);
}

export interface UserCapacityState {
  /** Banche (institution id) per cui l'utente ha almeno un conto collegato con il fornitore in uso. */
  linkedInstitutionIds: string[];
  /** Consensi avviati dall'utente nella finestra. */
  recentAttempts: number;
}

export type CapacityBlockReason = "user_limit" | "user_attempts" | "global_limit" | "provider_limit";
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
  const used = usedSlots(usage);
  if (used >= limits.provider) return { allowed: false, kind, reason: "provider_limit" };
  if (kind === "new" && used >= limits.global) return { allowed: false, kind, reason: "global_limit" };
  if (kind === "new" && new Set(user.linkedInstitutionIds).size >= limits.perUser) return { allowed: false, kind, reason: "user_limit" };
  if (user.recentAttempts >= limits.attemptsPerUser) return { allowed: false, kind, reason: "user_attempts" };
  return { allowed: true, kind };
}

/** Messaggio per l'utente quando il collegamento è bloccato (stesso testo dalla route e dall'interfaccia). */
export const CAPACITY_BLOCK_MESSAGES: Record<CapacityBlockReason, string> = {
  user_limit: "Per ora puoi collegare una sola banca. Gli altri conti puoi tenerli a mano o importarli da un file.",
  user_attempts: "Hai avviato troppi collegamenti questo mese. Riprova più avanti, oppure tieni il conto a mano o importa un file.",
  global_limit: "I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file.",
  provider_limit: "I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file.",
};
