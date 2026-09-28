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
  outcome?: string;
  reason?: string;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
  processed?: number;
  total?: number;
  count?: number;
  /** Fonte di prezzi di mercato (id statico). */
  provider?: string;
  /** Simbolo di uno strumento comune a tutti gli utenti: mai insieme a quantità o importi dell'utente. */
  symbol?: string;
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
