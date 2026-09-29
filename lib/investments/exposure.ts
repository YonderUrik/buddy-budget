/**
 * Esposizione per settore e area geografica (look-through): per ogni strumento si sceglie una fonte per dimensione
 * (manuale → tipo → Yahoo → stima dall'indice → paese dell'ISIN), poi si somma pesando per il valore delle posizioni.
 * Tutto puro: riceve profili e correzioni già caricati.
 */

import type { InstrumentType, ProfileAssetMix, ProfileHolding } from "@/lib/db/schema/investments";
import {
  AREA_LABELS,
  EQUITY_SECTOR_KEYS,
  SECTOR_LABELS,
  UNCLASSIFIED,
  areaForCountry,
  countryFromIsin,
  isAreaKey,
  isSectorKey,
  type AreaKey,
  type SectorKey,
} from "./exposure-keys";
import { matchIndexProfile, type IndexProfileMatch } from "./index-profiles";

/** Sotto questa soglia un peso è considerato zero (resti di arrotondamento delle fonti). */
const WEIGHT_EPSILON = 1e-6;
/** Un fondo con meno di metà in azioni si descrive dal mix di attività anche senza settori. */
const MOSTLY_NON_EQUITY = 0.5;

/** Da dove viene la ripartizione di una dimensione. */
export type ExposureSource = "manuale" | "tipo" | "yahoo" | "stima_indice" | "isin" | "nessuno";

export const EXPOSURE_SOURCE_LABELS: Record<ExposureSource, string> = {
  manuale: "Inserita da te",
  tipo: "Dal tipo di strumento",
  yahoo: "Yahoo Finance",
  stima_indice: "Stima dall'indice",
  isin: "Dal paese dell'ISIN",
  nessuno: "Nessun dato",
};

/** Strumento come serve al calcolo. */
export interface ExposureInstrument {
  id: string;
  name: string;
  type: InstrumentType;
  isin: string | null;
}

/** Profilo dalle fonti (sottoinsieme di `instrument_profiles`). */
export interface ExposureProfile {
  instrumentId: string;
  symbol: string | null;
  sectors: Record<string, number> | null;
  assetMix: ProfileAssetMix | null;
  holdings: ProfileHolding[] | null;
  sector: string | null;
  country: string | null;
}

/** Correzione manuale dell'utente: null = si usa l'automatico. */
export interface ManualBreakdown {
  instrumentId: string;
  sectors: Record<string, number> | null;
  areas: Record<string, number> | null;
}

/** Ripartizione di uno strumento: ogni dimensione somma a 1 (il resto è "non classificato"). */
export interface InstrumentExposure {
  instrumentId: string;
  sectors: Partial<Record<SectorKey, number>>;
  sectorSource: ExposureSource;
  areas: Partial<Record<AreaKey, number>>;
  areaSource: ExposureSource;
  indexProfile: IndexProfileMatch | null;
}

/**
 * Pesi validi che sommano a 1: scarta chiavi sconosciute e valori non positivi, riscala se la somma supera 1
 * (arrotondamenti delle fonti) e mette il resto in "non classificato".
 */
export function completeWeights<K extends string>(
  weights: Record<string, number | null | undefined>,
  isKey: (key: string) => key is K
): Partial<Record<K | typeof UNCLASSIFIED, number>> {
  const clean: Partial<Record<K | typeof UNCLASSIFIED, number>> = {};
  let sum = 0;
  for (const [key, raw] of Object.entries(weights)) {
    const value = Number(raw);
    if (!isKey(key) || key === UNCLASSIFIED || !Number.isFinite(value) || value <= WEIGHT_EPSILON) continue;
    clean[key] = (clean[key] ?? 0) + value;
    sum += value;
  }
  if (sum > 1) {
    for (const key of Object.keys(clean) as K[]) clean[key] = (clean[key] ?? 0) / sum;
  } else if (1 - sum > WEIGHT_EPSILON) {
    clean[UNCLASSIFIED] = 1 - sum;
  }
  return clean;
}

function positive(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Settori di un ETF/fondo da Yahoo: la parte azionaria per settore, il resto per tipo di attività. Null se non basta. */
function fundSectorsFromProfile(profile: ExposureProfile): Record<string, number> | null {
  const sectors = profile.sectors ? completeWeights(profile.sectors, isEquitySector) : {};
  const hasSectors = Object.keys(sectors).some((k) => k !== UNCLASSIFIED);
  const mix = profile.assetMix;
  const stock = mix && typeof mix.stock === "number" && Number.isFinite(mix.stock) ? Math.max(0, Math.min(1, mix.stock)) : null;
  if (!hasSectors && (stock === null || stock >= MOSTLY_NON_EQUITY)) return null;
  const equityShare = stock ?? 1;
  const result: Record<string, number> = {};
  if (hasSectors) {
    const equitySum = Object.entries(sectors).reduce((s, [k, v]) => (k === UNCLASSIFIED ? s : s + (v ?? 0)), 0);
    for (const [key, value] of Object.entries(sectors)) {
      if (key !== UNCLASSIFIED && equitySum > 0) result[key] = ((value ?? 0) / equitySum) * equityShare;
    }
  }
  result.obbligazioni = positive(mix?.bond);
  result.liquidita = positive(mix?.cash);
  result.altro = positive(mix?.other);
  return result;
}

function isEquitySector(key: string): key is (typeof EQUITY_SECTOR_KEYS)[number] {
  return (EQUITY_SECTOR_KEYS as readonly string[]).includes(key);
}

function resolveSectors(
  instrument: ExposureInstrument,
  profile: ExposureProfile | null,
  manual: ManualBreakdown | null,
  index: IndexProfileMatch | null
): { weights: Record<string, number>; source: ExposureSource } {
  if (manual?.sectors) return { weights: manual.sectors, source: "manuale" };
  if (instrument.type === "crypto") return { weights: { crypto: 1 }, source: "tipo" };
  if (instrument.type === "etc") return { weights: { materie_prime: 1 }, source: "tipo" };
  if (instrument.type === "obbligazione") return { weights: { obbligazioni: 1 }, source: "tipo" };
  if (profile) {
    if (instrument.type === "azione") {
      if (profile.sector && isSectorKey(profile.sector)) return { weights: { [profile.sector]: 1 }, source: "yahoo" };
    } else {
      const fund = fundSectorsFromProfile(profile);
      if (fund) return { weights: fund, source: "yahoo" };
    }
  }
  if (index?.useSectors && index.profile.sectors) return { weights: index.profile.sectors, source: "stima_indice" };
  return { weights: {}, source: "nessuno" };
}

function resolveAreas(
  instrument: ExposureInstrument,
  profile: ExposureProfile | null,
  manual: ManualBreakdown | null,
  index: IndexProfileMatch | null
): { weights: Record<string, number>; source: ExposureSource } {
  if (manual?.areas) return { weights: manual.areas, source: "manuale" };
  if (instrument.type === "crypto" || instrument.type === "etc") return { weights: { nessuna: 1 }, source: "tipo" };
  if (instrument.type === "azione") {
    const fromProfile = areaForCountry(profile?.country);
    if (fromProfile) return { weights: { [fromProfile]: 1 }, source: "yahoo" };
  }
  if (instrument.type === "azione" || instrument.type === "obbligazione") {
    // Per ETF e fondi l'ISIN dice solo dove è domiciliato il fondo (IE, LU), non dove investe.
    const fromIsin = areaForCountry(countryFromIsin(instrument.isin));
    if (fromIsin) return { weights: { [fromIsin]: 1 }, source: "isin" };
  }
  if (index) return { weights: index.profile.areas, source: "stima_indice" };
  return { weights: {}, source: "nessuno" };
}

/** Ripartizione per settore e area di uno strumento, con la fonte usata per ciascuna. */
export function resolveInstrumentExposure(
  instrument: ExposureInstrument,
  profile: ExposureProfile | null,
  manual: ManualBreakdown | null
): InstrumentExposure {
  const index = instrument.type === "etf" || instrument.type === "fondo" ? matchIndexProfile(instrument.name) : null;
  const sectors = resolveSectors(instrument, profile, manual, index);
  const areas = resolveAreas(instrument, profile, manual, index);
  return {
    instrumentId: instrument.id,
    sectors: completeWeights(sectors.weights, isSectorKey),
    sectorSource: sectors.source,
    areas: completeWeights(areas.weights, isAreaKey),
    areaSource: areas.source,
    indexProfile: index,
  };
}

/** Fetta della ripartizione (stessa forma della composizione per tipo/valuta). */
export interface ExposureSlice {
  key: string;
  value: number;
  share: number;
}

/** Ripartizione del portafoglio in una dimensione. */
export interface ExposureBreakdown {
  /** Dalla fetta più grande; "non classificato" sempre in fondo. */
  slices: ExposureSlice[];
  /** Quota del valore con una classificazione (0-1). */
  classifiedShare: number;
}

/** Somma le ripartizioni degli strumenti pesate per il valore delle posizioni. */
export function aggregateExposure(
  positions: { instrumentId: string; value: number }[],
  exposures: Map<string, InstrumentExposure>,
  dimension: "sectors" | "areas"
): ExposureBreakdown {
  const totals = new Map<string, number>();
  let total = 0;
  for (const { instrumentId, value } of positions) {
    if (!(value > 0)) continue;
    total += value;
    const weights = exposures.get(instrumentId)?.[dimension] ?? { [UNCLASSIFIED]: 1 };
    for (const [key, weight] of Object.entries(weights)) totals.set(key, (totals.get(key) ?? 0) + value * (weight ?? 0));
  }
  const slices = [...totals.entries()]
    .filter(([, value]) => value > total * WEIGHT_EPSILON)
    .map(([key, value]) => ({ key, value, share: total > 0 ? value / total : 0 }))
    .sort((a, b) => (a.key === UNCLASSIFIED ? 1 : b.key === UNCLASSIFIED ? -1 : b.value - a.value));
  const unclassified = slices.find((s) => s.key === UNCLASSIFIED)?.share ?? 0;
  return { slices, classifiedShare: total > 0 ? 1 - unclassified : 0 };
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Frase sui settori: il settore azionario prevalente, se pesa almeno il 10%. */
export function sectorInsight(breakdown: ExposureBreakdown): string | null {
  const top = breakdown.slices.find((s) => isEquitySector(s.key));
  if (!top || top.share < 0.1) return null;
  const label = SECTOR_LABELS[top.key as SectorKey].toLowerCase();
  return `Il settore che pesa di più è ${label} (${pct(top.share)} del portafoglio).`;
}

/** Frase sulle aree: area prevalente e quota in Italia, se c'è. */
export function areaInsight(breakdown: ExposureBreakdown): string | null {
  const classified = breakdown.slices.filter((s) => s.key !== UNCLASSIFIED && s.key !== "nessuna");
  const top = classified[0];
  if (!top) return null;
  const italy = breakdown.slices.find((s) => s.key === "italia");
  const main = `${pct(top.share)} in ${AREA_LABELS[top.key as AreaKey]}`;
  if (italy && top.key !== "italia" && italy.share >= 0.05) return `${main}, ${pct(italy.share)} in Italia.`;
  return `${main}.`;
}
