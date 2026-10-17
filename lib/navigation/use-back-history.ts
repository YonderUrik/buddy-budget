"use client";

import * as React from "react";
import { BACK_HISTORY_STORAGE_KEY, parseStoredStack, recordVisit, resolveBackTarget, type BackTarget } from "./back-history";

const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
let stack: readonly string[] | null = null;

/** The stack in memory, loaded from sessionStorage on first use (empty if storage is blocked). */
function current(): readonly string[] {
  if (stack === null) {
    try {
      stack = parseStoredStack(window.sessionStorage.getItem(BACK_HISTORY_STORAGE_KEY));
    } catch {
      stack = [];
    }
  }
  return stack;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Adds a visit to the history (called by the recorder mounted in the app layout). */
export function recordBackHistoryVisit(href: string): void {
  const next = recordVisit(current(), href);
  stack = next;
  try {
    window.sessionStorage.setItem(BACK_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the history lasts until the page is reloaded.
  }
  listeners.forEach((callback) => callback());
}

/**
 * Where the «‹» button of the current screen leads, or `null` for no button. On the server and before hydration only
 * the logical parent is known (main sections: no button).
 */
export function useBackTarget(currentHref: string): BackTarget | null {
  const history = React.useSyncExternalStore(subscribe, current, () => EMPTY);
  return resolveBackTarget(history, currentHref);
}
