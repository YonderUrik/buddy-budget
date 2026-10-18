"use client";

/**
 * Which first steps this device has already seen done, so a step that becomes done is announced once: a «done, next»
 * toast anywhere in the app and a «Fatto: …» line on the next step in Panoramica. Device-local (localStorage) on
 * purpose: it only decides what to say, never what is done (that comes from `GET /api/start`).
 */

import { useSyncExternalStore } from "react";
import { START_STEP_IDS, type StartStepId } from "./steps";

/** Steps already seen done on this device. Missing key = first visit: everything done so far counts as seen. */
export const START_SEEN_STORAGE_KEY = "bb:start-seen-done";
/** Steps done during this browser session and not yet acknowledged in Panoramica. */
const RECENT_STORAGE_KEY = "bb:start-recent-done";
const CHANGE_EVENT = "bb:start-progress-changed";

const isStep = (id: string): id is StartStepId => (START_STEP_IDS as readonly string[]).includes(id);
const parse = (raw: string | null): StartStepId[] => (raw ?? "").split(",").filter(isStep);

function read(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(storage: "local" | "session", key: string, ids: readonly StartStepId[]): void {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, ids.join(","));
  } catch {
    // Without storage the acknowledgement may repeat on the next visit: harmless.
  }
}

/** Steps seen done on this device, or `null` on the very first visit. */
export function readSeenSteps(): StartStepId[] | null {
  const raw = read("local", START_SEEN_STORAGE_KEY);
  return raw === null ? null : parse(raw);
}

export function writeSeenSteps(ids: readonly StartStepId[]): void {
  write("local", START_SEEN_STORAGE_KEY, ids);
}

/** Adds steps to the «not yet acknowledged in Panoramica» list. */
export function addRecentSteps(ids: readonly StartStepId[]): void {
  if (ids.length === 0) return;
  const current = parse(read("session", RECENT_STORAGE_KEY));
  write("session", RECENT_STORAGE_KEY, [...new Set([...current, ...ids])]);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Empties that list (Panoramica has shown it). */
export function clearRecentSteps(): void {
  write("session", RECENT_STORAGE_KEY, []);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Steps done recently and not yet acknowledged in Panoramica (empty on the server). */
export function useRecentSteps(): StartStepId[] {
  const raw = useSyncExternalStore(subscribe, () => read("session", RECENT_STORAGE_KEY) ?? "", () => "");
  return parse(raw);
}
