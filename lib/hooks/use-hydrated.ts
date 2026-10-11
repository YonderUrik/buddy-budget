"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False sul server e durante l'idratazione, true subito dopo. Serve per mostrare dati che il server non conosce (es.
 * il nome dalla sessione letta nel browser) senza che l'HTML del server e il primo render del client divergano.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
