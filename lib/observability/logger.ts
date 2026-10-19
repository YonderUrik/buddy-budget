import { APP_BUILD_INFO } from "@/lib/app-version";
import { redactText } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Nome del servizio scritto in ogni riga di log (filtro principale in Loki). */
export const LOG_SERVICE_NAME = "buddy-budget";

/**
 * Campi ammessi in una riga di log. Tipo CHIUSO di proposito: niente oggetti arbitrari che possano
 * portarsi dietro email, importi, descrizioni o nomi. `user` è sempre l'hash di `hashUserId`.
 */
export interface LogFields {
  requestId?: string;
  route?: string;
  /** Instance setup at boot (hosted or self-hosted, sign-in methods, email transport): flags only, never values. */
  instance?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  user?: string;
  accountId?: string;
  jobId?: string;
  connectionId?: string;
  cron?: string;
  phase?: string;
  trigger?: string;
  /** Tipo di un'operazione di investimento (enum chiuso: acquisto, vendita...). */
  operationType?: string;
  outcome?: string;
  /** Interface language of a public demo account (closed enum it/en/de): never a user's own preference. */
  language?: string;
  /** Product country of an account or public demo account (closed enum IT/DE/OTHER). */
  country?: string;
  /** Tipo di una segnalazione di supporto (enum chiuso `ReportKind`) e codice di riferimento `SUP-XXXXXX` (non personale). */
  reportKind?: string;
  /** Da dove parte una segnalazione al supporto (pagina, pulsante, errore). */
  reportSource?: string;
  /** Operazione fallita da cui parte una segnalazione (enum `REPORT_ERROR_AREAS`). */
  reportArea?: string;
  /** Errori del browser: area dell'app (enum chiuso `CLIENT_ERROR_AREAS`) e digest di Next che lega l'errore ai log del server. */
  clientArea?: string;
  errorDigest?: string;
  reference?: string;
  /** Id di una requisition GoCardless (non personale, serve solo con le nostre chiavi): per decidere a mano cosa eliminare. */
  requisitionId?: string;
  /** Età in giorni di un elemento (es. una requisition sconosciuta). */
  ageDays?: number;
  /** Host di un URL di ritorno (es. `localhost`), mai l'URL completo. */
  host?: string;
  withContext?: boolean;
  reason?: string;
  /** Input field a validation rejected (the schema key, never its value). */
  field?: string;
  inserted?: number;
  deleted?: number;
  /** Esiti di un import in blocco (conteggi di righe): nuove, aggiornate, saltate perché già presenti, rifiutate. */
  created?: number;
  updated?: number;
  skipped?: number;
  rejected?: number;
  /** Bank categories in an imported file: rows that carried one, and how they mapped (counts only, never the labels). */
  bankCategories?: number;
  bankLearned?: number;
  bankByName?: number;
  bankByDictionary?: number;
  bankUnmapped?: number;
  categorized?: number;
  uncategorized?: number;
  processed?: number;
  total?: number;
  count?: number;
  /** Abbonamenti: scelta dell'utente (enum chiuso `SubscriptionAction`) e conteggi per stato nel rilevamento. */
  action?: string;
  detected?: number;
  confirmed?: number;
  enabled?: boolean;
  corrected?: number;
  pending?: number;
  stopped?: number;
  /** Origine di una categoria applicata da sola (enum chiuso `AUTOMATIC_CATEGORY_SOURCES`: regola, storico, assistente). */
  categorySource?: string;
  /** Come è stato ricavato il nome leggibile di una transazione (enum chiuso `MerchantNameSource`). */
  nameSource?: string;
  /** Fonte di prezzi di mercato (id statico). */
  provider?: string;
  /** Simbolo di uno strumento comune a tutti gli utenti: mai insieme a quantità o importi dell'utente. */
  symbol?: string;
  /** Billing: plan after a change (`free`/`pro`), Stripe subscription status, interval (`month`/`year`), webhook event type,
   * grant source and plan area of a locked request (all closed enums, never ids or amounts). */
  plan?: string;
  billingStatus?: string;
  planInterval?: string;
  stripeEventType?: string;
  grantSource?: string;
  proArea?: string;
  /** Versione dei documenti legali (data, `LEGAL_VERSION`): non è un dato personale. */
  legalVersion?: string;
  /** Sessioni e token di verifica scaduti eliminati dal cron di conservazione (conteggi). */
  sessionsPurged?: number;
  verificationsPurged?: number;
  /** Tipo di email di riepilogo/avviso (`digest`, `budget`, `deadlines`, `test`) o ambito di una disiscrizione. */
  kind?: string;
  /** Giorni senza accessi di un account inattivo (conteggio, non dato personale). */
  inactiveDays?: number;
  error?: unknown;
}

/** Logger strutturato: una riga JSON per evento. `event` segue lo schema `dominio.oggetto.esito`. */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Logger figlio che aggiunge `fields` a ogni riga (es. requestId, route, user). */
  child(fields: LogFields): Logger;
}

export type LogWriter = (line: string, level: LogLevel) => void;

export interface CreateLoggerOptions {
  level?: LogLevel;
  write?: LogWriter;
  base?: LogFields;
}

interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  /** Primo livello di `cause` (es. l'errore Postgres dentro un DrizzleQueryError), senza stack. */
  cause?: { name?: string; message: string };
}

/** Serializza un errore redigendo messaggio e stack; lo stack solo a livello `error`. */
export function serializeError(error: unknown, withStack: boolean): SerializedError {
  if (error instanceof Error) {
    const out: SerializedError = { name: error.name, message: redactText(error.message) };
    if (withStack && error.stack) {
      out.stack = redactText(error.stack.split("\n").slice(0, MAX_STACK_LINES).join("\n"), 4000);
    }
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined && cause !== error) {
      out.cause =
        cause instanceof Error
          ? { name: cause.name, message: redactText(cause.message) }
          : { message: redactText(String(cause)) };
    }
    return out;
  }
  return { message: redactText(String(error)) };
}

/** Righe di stack conservate: oltre sono quasi sempre frame di framework, inutili e costosi in Loki. */
export const MAX_STACK_LINES = 12;

const defaultWrite: LogWriter = (line, level) => {
  if (level === "warn" || level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

function resolveDefaultLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL;
  if (fromEnv === "debug" || fromEnv === "info" || fromEnv === "warn" || fromEnv === "error") return fromEnv;
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

/** Crea un logger. In produzione si usa l'istanza `logger`; opzioni utili nei test (writer finto). */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const minLevel = options.level ?? resolveDefaultLevel();
  const write = options.write ?? defaultWrite;
  const base = options.base ?? {};

  function emit(level: LogLevel, event: string, fields: LogFields = {}) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const { error, ...rest } = { ...base, ...fields };
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      event,
      service: LOG_SERVICE_NAME,
      version: APP_BUILD_INFO.version,
      commit: APP_BUILD_INFO.commit || undefined,
      ...rest,
    };
    if (error !== undefined) record.error = serializeError(error, level === "error");
    let line: string;
    try {
      line = JSON.stringify(record);
    } catch {
      line = JSON.stringify({ ts: record.ts, level, event, service: LOG_SERVICE_NAME, reason: "unserializable_fields" });
    }
    try {
      write(line, level);
    } catch {
      // Il logging non deve mai far fallire il chiamante.
    }
  }

  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (fields) => createLogger({ level: minLevel, write, base: { ...base, ...fields } }),
  };
}

/** Logger dell'app (livello da `LOG_LEVEL`, default `info`, `debug` in sviluppo). */
export const logger: Logger = createLogger();
