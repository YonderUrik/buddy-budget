"use client";

import { usePersistedFlag } from "./use-persisted-flag";

/** Chiave di localStorage: la scelta vale per Panoramica e barra laterale. */
export const PENSION_IN_NET_WORTH_KEY = "bb:net-worth-include-pension";

/**
 * Se la previdenza conta nel patrimonio netto: i soldi del fondo sono tuoi ma non subito disponibili, quindi
 * l'utente può escluderli dal totale (restano visibili, in grigio). Di default sono inclusi.
 */
export function usePensionInNetWorth(): [boolean, (value: boolean) => void] {
  return usePersistedFlag(PENSION_IN_NET_WORTH_KEY, true);
}
