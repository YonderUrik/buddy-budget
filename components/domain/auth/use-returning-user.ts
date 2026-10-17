"use client";

/** The account remembered on this device for «Rientra in BuddyBudget», read after hydration, with a way to forget it. */

import * as React from "react";
import { RETURNING_USER_STORAGE_KEY, forgetReturningUser, parseReturningUser, type ReturningUser } from "@/lib/auth/returning-user";

function subscribe(onChange: () => void) {
  // Other tabs (sign-in, «Non sei tu?») update this one too.
  const handler = (event: StorageEvent) => {
    if (event.key === null || event.key === RETURNING_USER_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(RETURNING_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** On the server and during hydration nothing is remembered, so the markup matches the full form. */
const getServerSnapshot = () => null;

export interface ReturningUserState {
  user: ReturningUser | null;
  /** Forgets the account on this device and falls back to the full form. */
  forget: () => void;
}

export function useReturningUser(): ReturningUserState {
  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [forgotten, setForgotten] = React.useState(false);
  const user = React.useMemo(() => (forgotten ? null : parseReturningUser(raw)), [forgotten, raw]);
  const forget = React.useCallback(() => {
    forgetReturningUser();
    setForgotten(true);
  }, []);
  return { user, forget };
}
