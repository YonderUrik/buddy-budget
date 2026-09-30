"use client";

import * as React from "react";

const listeners = new Set<() => void>();

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Flag booleano ricordato in localStorage (es. sezione aperta, valori nascosti). Sul server e finché non si idrata vale
 * `defaultValue`; se localStorage non è disponibile il flag funziona solo finché la pagina resta aperta.
 * Più componenti con la stessa chiave restano allineati.
 */
export function usePersistedFlag(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const value = React.useSyncExternalStore(
    subscribe,
    () => read(key, defaultValue),
    () => defaultValue
  );
  const set = React.useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Storage bloccato: il valore non si ricorda, la UI resta comunque coerente fino al ricaricamento.
      }
      listeners.forEach((callback) => callback());
    },
    [key]
  );
  return [value, set];
}
