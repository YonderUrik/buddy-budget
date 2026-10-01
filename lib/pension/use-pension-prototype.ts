"use client";

/**
 * Stato del prototipo di Pensione: fotografie e profilo salvati nel browser (localStorage), con dati d'esempio al
 * primo avvio. Sostituito dalla persistenza su DB + TanStack Query se il prototipo va in produzione.
 */

import * as React from "react";
import { sortSnapshots, type PensionSnapshot } from "@/lib/calc/pension";
import { buildDemoSnapshots, DEMO_PROFILE, type PensionProfile } from "./demo-data";

const STORAGE_KEY = "bb:pension-prototype:v1";
const CHANGE_EVENT = "bb:pension-prototype-change";

interface StoredState {
  profile: PensionProfile;
  snapshots: PensionSnapshot[];
  isDemo: boolean;
}

const demoState = (): StoredState => ({ profile: DEMO_PROFILE, snapshots: buildDemoSnapshots(), isDemo: true });

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(next: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Salvataggio facoltativo nel prototipo.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface PensionPrototype extends StoredState {
  addSnapshot: (snapshot: Omit<PensionSnapshot, "id">) => void;
  removeSnapshot: (id: string) => void;
  setProfile: (profile: PensionProfile) => void;
  /** Svuota i dati d'esempio per inserire i propri. */
  startEmpty: () => void;
  resetDemo: () => void;
}

export function usePensionPrototype(): PensionPrototype {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null);
  const state = React.useMemo<StoredState>(() => {
    if (raw) {
      try {
        return JSON.parse(raw) as StoredState;
      } catch {
        // Contenuto non valido: si riparte dai dati d'esempio.
      }
    }
    return demoState();
  }, [raw]);

  return {
    ...state,
    addSnapshot: (snapshot) =>
      write({ ...state, isDemo: false, snapshots: sortSnapshots([...state.snapshots, { ...snapshot, id: crypto.randomUUID() }]) }),
    removeSnapshot: (id) => write({ ...state, snapshots: state.snapshots.filter((s) => s.id !== id) }),
    setProfile: (profile) => write({ ...state, profile }),
    startEmpty: () => write({ ...state, isDemo: false, snapshots: [] }),
    resetDemo: () => write(demoState()),
  };
}
