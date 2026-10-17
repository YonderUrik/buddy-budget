"use client";

import { useSyncExternalStore } from "react";

/**
 * True when the page runs inside the native app shell (Capacitor injects `window.Capacitor` before the page scripts).
 * Mirrors `nativePlatform()` from `lib/native` (PR #404): switch to it once that lands.
 */
function insideNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}

const subscribe = () => () => {};

/**
 * Whether to show the «Offrimi un caffè» link. Hidden inside the native app: App Store and Google Play reviewers treat
 * an external tip link to the developer as a payment outside in-app purchase (App Store guideline 3.1.1) and reject the
 * build. Hidden during server rendering too, so the native app never flashes it.
 */
export function useShowDonationLink(): boolean {
  return useSyncExternalStore(subscribe, () => !insideNativeApp(), () => false);
}
