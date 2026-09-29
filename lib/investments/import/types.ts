import type { Instrument, InstrumentType } from "@/lib/db/schema/investments";
import type { CreateInstrumentInput } from "@/lib/validation/investments";
import type { PlannedRow } from "./plan";

/**
 * Abbinamento di uno strumento del file. `known`: già nel catalogo, si usa quello. `proposal`: trovato sulle fonti,
 * si crea all'import; `guess` quando la scelta non è certa (più quotazioni, ricerca per nome) e va controllata.
 * `none`: l'utente lo sceglie a mano (`unavailable` se la fonte non ha risposto, non perché non esiste).
 */
export type ImportMatch =
  | { kind: "known"; instrument: Instrument }
  | { kind: "proposal"; input: CreateInstrumentInput; label: string; detail: string; type: InstrumentType; confidence: "exact" | "guess" }
  | { kind: "none"; reason: "not_found" | "unavailable" };

/** Esito: righe con il loro stato e, se non è una prova, quante operazioni e strumenti nuovi sono stati salvati. */
export interface ImportResult {
  rows: PlannedRow[];
  counts: { new: number; duplicate: number; error: number };
  /** Errore che riguarda tutto l'import (uno strumento non trovato o non creabile). */
  error?: string;
  inserted: number;
  instrumentsCreated: number;
}

