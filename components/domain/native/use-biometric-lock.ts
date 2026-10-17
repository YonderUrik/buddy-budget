"use client";

import * as React from "react";
import { track } from "@/lib/analytics";
import { useNativePlatform } from "@/lib/hooks/use-native-platform";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { BIOMETRIC_GRACE_MS, BIOMETRIC_LOCK_KEY, verifyWithBiometrics } from "@/lib/native";

export type BiometricLockState = "open" | "covered" | "locked";

export interface BiometricLock {
  state: BiometricLockState;
  /** A Face ID / fingerprint prompt is on screen. */
  verifying: boolean;
  /** Asks Face ID / fingerprint again (button on the lock screen). */
  unlock: () => void;
}

/** Lock choice of this phone (Impostazioni → «Questo telefono»): off by default. */
export function useBiometricLockChoice(): [boolean, (enabled: boolean) => void] {
  return usePersistedFlag(BIOMETRIC_LOCK_KEY, false);
}

/**
 * State of the Face ID / fingerprint lock in the phone app. With the lock on, the screen is locked at a cold start and
 * when the app comes back after more than `BIOMETRIC_GRACE_MS` in the background; while in the background it is
 * covered, so the app switcher preview shows no amounts. In a browser it is always `open`.
 */
export function useBiometricLock(texts: { reason: string; cancel: string }): BiometricLock {
  const native = useNativePlatform();
  const [enabled] = useBiometricLockChoice();
  const [state, setState] = React.useState<BiometricLockState>("open");
  const [verifying, setVerifying] = React.useState(false);
  const verifyingRef = React.useRef(false);
  const { reason, cancel } = texts;
  const active = Boolean(native) && enabled;

  const unlock = React.useCallback(() => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    void verifyWithBiometrics({ reason, cancel }).then((verified) => {
      verifyingRef.current = false;
      setVerifying(false);
      if (verified) {
        setState("open");
        track("biometric_unlocked");
      }
    });
  }, [reason, cancel]);

  const lockNow = React.useCallback(() => {
    setState("locked");
    unlock();
  }, [unlock]);

  // Cold start: lock before the first screen is readable. Only once per launch: turning the lock on in the settings
  // (already confirmed with Face ID there) does not lock the screen straight away.
  const coldStartChecked = React.useRef(false);
  React.useEffect(() => {
    if (!native || coldStartChecked.current) return;
    coldStartChecked.current = true;
    // Deferred to a microtask: the lock is a reaction to the app launching, not state derived from props.
    if (enabled) queueMicrotask(lockNow);
  }, [native, enabled, lockNow]);

  React.useEffect(() => {
    if (!active) return;
    let pausedAt: number | null = null;
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    void import("@capacitor/app").then(({ App }) => {
      handles.push(
        App.addListener("pause", () => {
          pausedAt = Date.now();
          setState((current) => (current === "open" ? "covered" : current));
        })
      );
      handles.push(
        App.addListener("resume", () => {
          const away = pausedAt === null ? 0 : Date.now() - pausedAt;
          pausedAt = null;
          if (away <= BIOMETRIC_GRACE_MS) {
            setState((current) => (current === "covered" ? "open" : current));
            return;
          }
          lockNow();
        })
      );
    });
    return () => handles.forEach((handle) => void handle.then((h) => h.remove()));
  }, [active, lockNow]);

  return { state: active ? state : "open", verifying, unlock };
}
