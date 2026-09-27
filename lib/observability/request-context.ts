import { AsyncLocalStorage } from "node:async_hooks";
import { logger, type LogFields, type Logger } from "./logger";
import { hashUserId } from "./user-hash";

interface RequestStore {
  fields: LogFields;
}

const storage = new AsyncLocalStorage<RequestStore>();

/** Esegue `fn` dentro il contesto di una richiesta (usato da `withRoute`). */
export function runWithRequestContext<T>(fields: LogFields, fn: () => T): T {
  return storage.run({ fields: { ...fields } }, fn);
}

/**
 * Logger della richiesta corrente: eredita requestId, route, method e (se associato) user.
 * Fuori da una richiesta restituisce il logger dell'app.
 */
export function requestLogger(): Logger {
  const store = storage.getStore();
  return store ? logger.child(store.fields) : logger;
}

/** Id della richiesta corrente, se esiste. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.fields.requestId;
}

/**
 * Associa l'utente autenticato alla richiesta corrente, in forma pseudonimizzata (`hashUserId`):
 * da qui in poi ogni riga di log della richiesta, incluso l'esito finale, porta `user`.
 */
export function bindRequestUser(userId: string): void {
  const store = storage.getStore();
  if (store) store.fields.user = hashUserId(userId);
}

/** Campi del contesto corrente (per il log finale di `withRoute`). */
export function currentRequestFields(): LogFields {
  return { ...(storage.getStore()?.fields ?? {}) };
}
