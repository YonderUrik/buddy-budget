"use client";

import * as React from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics/opt-out";

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

const read = () => isAnalyticsOptedOut(typeof window === "undefined" ? undefined : window.localStorage);

/**
 * Preferenza "non misurare le mie visite" (Umami), ricordata in localStorage su questo dispositivo. Sul server vale
 * false; se lo storage è bloccato la scelta non si ricorda e `set` ritorna false.
 */
export function useAnalyticsOptOut(): [boolean, (optedOut: boolean) => boolean] {
  const optedOut = React.useSyncExternalStore(subscribe, read, () => false);
  const set = React.useCallback((next: boolean) => {
    const saved = setAnalyticsOptOut(window.localStorage, next);
    listeners.forEach((callback) => callback());
    return saved;
  }, []);
  return [optedOut, set];
}
