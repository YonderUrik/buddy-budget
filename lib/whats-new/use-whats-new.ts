"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { WHATS_NEW_ENTRIES, type WhatsNewEntry } from "./entries";
import { pickWhatsNew } from "./pick";

/** Chiave del localStorage con gli id delle novità chiuse (per dispositivo). */
export const WHATS_NEW_STORAGE_KEY = "bb:whats-new-dismissed";
const CHANGE_EVENT = "bb:whats-new-changed";

function readRaw(): string {
  try {
    return window.localStorage.getItem(WHATS_NEW_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * La novità da mostrare nel riquadro e il modo di chiuderla. Sul server non c'è nulla da mostrare: la voce compare
 * dopo l'idratazione, prima che arrivino i dati della pagina, quindi non sposta niente. Se il localStorage non è
 * disponibile, la voce torna a comparire a ogni visita finché è recente. Le novità di funzioni non disponibili nel
 * paese dell'utente non compaiono.
 */
export function useWhatsNew(now: Date = new Date()): { entry: WhatsNewEntry | null; dismiss: (id: string) => void } {
  const { productCountry } = useLocalization();
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const entries = WHATS_NEW_ENTRIES.filter((e) => isCountryPathAvailable(productCountry, e.href.split("?")[0]));
  const entry = raw === null ? null : pickWhatsNew(entries, raw.split(",").filter(Boolean), now);

  const dismiss = useCallback((id: string) => {
    try {
      const ids = new Set(readRaw().split(",").filter(Boolean));
      ids.add(id);
      window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, [...ids].join(","));
    } catch {
      // Senza localStorage la voce non si può ricordare chiusa: resta fino alla prossima visita.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { entry, dismiss };
}
