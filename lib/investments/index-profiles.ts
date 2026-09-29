/**
 * Stime di area geografica e settore dei pochi indici azionari più diffusi, riconosciuti dal nome dello strumento.
 * Servono perché Yahoo non dà la ripartizione per area degli ETF. Valori approssimati al 2025-2026, arrotondati:
 * sono una stima indicativa (la UI lo dice), non la composizione ufficiale del giorno.
 */

import type { AreaKey, SectorKey } from "./exposure-keys";

export type IndexProfileId =
  | "all_world"
  | "world"
  | "sp500"
  | "nasdaq100"
  | "emerging"
  | "europe"
  | "japan"
  | "ftse_mib";

export interface IndexProfile {
  id: IndexProfileId;
  /** Nome leggibile dell'indice. */
  label: string;
  /** Riconosce il nome dello strumento. */
  pattern: RegExp;
  areas: Partial<Record<AreaKey, number>>;
  /** Settori dell'indice; assenti se la stima non è abbastanza affidabile. */
  sectors?: Partial<Record<SectorKey, number>>;
  /**
   * Indice "ampio" a capitalizzazione: dentro un'area possiede in pratica le stesse aziende degli altri indici ampi,
   * quindi la sovrapposizione tra due indici ampi si stima dalle aree. Il Nasdaq-100 non lo è.
   */
  broad: boolean;
}

/** Ordine: dal più specifico al più generico (il primo che corrisponde vince). */
export const INDEX_PROFILES: readonly IndexProfile[] = [
  {
    id: "all_world",
    label: "FTSE All-World / MSCI ACWI",
    pattern: /ftse all[- ]?world|msci acwi|all[- ]country world/i,
    areas: { nord_america: 0.66, europa: 0.135, giappone: 0.055, pacifico: 0.03, emergenti: 0.12 },
    sectors: {
      tecnologia: 0.26,
      finanza: 0.17,
      salute: 0.095,
      industria: 0.105,
      consumi_ciclici: 0.105,
      comunicazioni: 0.085,
      consumi_difensivi: 0.058,
      energia: 0.04,
      materiali: 0.037,
      servizi_pubblici: 0.027,
      immobiliare: 0.018,
    },
    broad: true,
  },
  {
    id: "emerging",
    label: "MSCI Emerging Markets",
    pattern: /emerging markets|msci em\b|\bem imi\b|ftse emerging/i,
    areas: { emergenti: 1 },
    sectors: {
      tecnologia: 0.24,
      finanza: 0.23,
      consumi_ciclici: 0.13,
      comunicazioni: 0.1,
      industria: 0.07,
      materiali: 0.06,
      energia: 0.045,
      consumi_difensivi: 0.045,
      salute: 0.035,
      servizi_pubblici: 0.027,
      immobiliare: 0.018,
    },
    broad: true,
  },
  {
    id: "world",
    label: "MSCI World",
    pattern: /msci world|ftse developed world|ftse developed(?! europe)/i,
    areas: { nord_america: 0.76, europa: 0.15, giappone: 0.055, pacifico: 0.035 },
    sectors: {
      tecnologia: 0.275,
      finanza: 0.16,
      salute: 0.1,
      industria: 0.11,
      consumi_ciclici: 0.1,
      comunicazioni: 0.08,
      consumi_difensivi: 0.06,
      energia: 0.035,
      materiali: 0.035,
      servizi_pubblici: 0.026,
      immobiliare: 0.019,
    },
    broad: true,
  },
  {
    id: "nasdaq100",
    label: "Nasdaq-100",
    pattern: /nasdaq[- ]?100/i,
    areas: { nord_america: 1 },
    sectors: {
      tecnologia: 0.52,
      comunicazioni: 0.16,
      consumi_ciclici: 0.13,
      salute: 0.06,
      consumi_difensivi: 0.05,
      industria: 0.045,
      servizi_pubblici: 0.013,
      materiali: 0.012,
      finanza: 0.005,
      energia: 0.005,
    },
    broad: false,
  },
  {
    id: "sp500",
    label: "S&P 500",
    pattern: /s&p ?500|msci usa\b|ftse usa\b/i,
    areas: { nord_america: 1 },
    sectors: {
      tecnologia: 0.335,
      finanza: 0.13,
      salute: 0.1,
      consumi_ciclici: 0.105,
      comunicazioni: 0.095,
      industria: 0.085,
      consumi_difensivi: 0.055,
      energia: 0.03,
      servizi_pubblici: 0.025,
      immobiliare: 0.02,
      materiali: 0.02,
    },
    broad: true,
  },
  {
    id: "europe",
    label: "Europa (STOXX 600 / MSCI Europe)",
    pattern: /stoxx europe 600|stoxx 600|msci europe|ftse developed europe|msci emu|euro stoxx/i,
    areas: { europa: 1 },
    sectors: {
      finanza: 0.23,
      industria: 0.17,
      salute: 0.14,
      consumi_difensivi: 0.09,
      consumi_ciclici: 0.09,
      tecnologia: 0.08,
      materiali: 0.055,
      energia: 0.045,
      servizi_pubblici: 0.045,
      comunicazioni: 0.04,
      immobiliare: 0.015,
    },
    broad: true,
  },
  {
    id: "japan",
    label: "Giappone (MSCI Japan / TOPIX)",
    pattern: /msci japan|topix|nikkei/i,
    areas: { giappone: 1 },
    broad: true,
  },
  {
    id: "ftse_mib",
    label: "FTSE MIB",
    pattern: /ftse mib\b/i,
    areas: { italia: 1 },
    broad: true,
  },
];

/** ETF settoriali o tematici: le aree e i settori dell'indice generico sarebbero sbagliati. */
const SECTOR_THEME_PATTERN =
  /information technology|\btech(nology)?\b|health ?care|financials|\benergy\b|utilities|consumer (discretionary|staples)|industrials|materials|real estate|reit|semiconductor|clean|water|robotics|\bai\b|artificial intelligence|cyber|defen[cs]e|gold|bond|treasury|govt|government|aggregate|corporate/i;

/** ETF "fattoriali": aree simili all'indice generico, settori no. */
const FACTOR_PATTERN = /small ?cap|mid ?cap|momentum|value|quality|min(imum)? vol|dividend|high yield|equal weight/i;

/** Esito del riconoscimento: il profilo e se valgono anche i settori. */
export interface IndexProfileMatch {
  profile: IndexProfile;
  /** false per gli ETF fattoriali: si usano solo le aree. */
  useSectors: boolean;
  /** false per gli ETF fattoriali: la sovrapposizione stimata dalle aree non vale. */
  broad: boolean;
}

/** Profilo dell'indice replicato riconosciuto dal nome, o null (anche per gli ETF settoriali/tematici). */
export function matchIndexProfile(name: string): IndexProfileMatch | null {
  if (SECTOR_THEME_PATTERN.test(name)) return null;
  const profile = INDEX_PROFILES.find((p) => p.pattern.test(name));
  if (!profile) return null;
  const factor = FACTOR_PATTERN.test(name);
  return { profile, useSectors: !factor && profile.sectors !== undefined, broad: profile.broad && !factor };
}
