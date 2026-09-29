/**
 * Sovrapposizioni nel portafoglio: ETF che investono nelle stesse aziende e azioni possedute sia direttamente sia
 * dentro un ETF. I dati gratuiti danno solo i primi 10 titoli dei fondi, quindi dove non c'è una stima migliore il
 * risultato è un minimo garantito ("almeno X% in comune").
 */

import type { ProfileHolding } from "@/lib/db/schema/investments";
import type { ExposureInstrument, ExposureProfile, InstrumentExposure } from "./exposure";

/** Sotto questa quota una sovrapposizione tra fondi non si mostra. */
export const MIN_OVERLAP_SHOWN = 0.2;

/** Come è stata stimata la sovrapposizione. */
export type OverlapMethod = "stesso_indice" | "aree_indici" | "primi_titoli";

export interface OverlapInput {
  instrument: ExposureInstrument;
  value: number;
  exposure: InstrumentExposure | null;
  profile: ExposureProfile | null;
}

/** Coppia di fondi con una parte in comune. */
export interface FundOverlap {
  aId: string;
  bId: string;
  /** Quota del portafoglio dei due fondi in comune (0-1). */
  share: number;
  method: OverlapMethod;
}

const FUND_TYPES = new Set(["etf", "fondo"]);
const COMPANY_SUFFIXES = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|sa|spa|nv|ag|se|class [a-c]|cl [a-c]|holdings?|group)\b/g;

/** Nome di un'azienda ridotto all'essenziale per confrontarlo tra fonti diverse. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[,'’()&-]/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ticker senza il suffisso della borsa (`AAPL`, `ENEL.MI` → `ENEL`). */
export function baseTicker(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const base = symbol.toUpperCase().split(".")[0].trim();
  return base === "" ? null : base;
}

function holdingKeys(holding: Pick<ProfileHolding, "symbol" | "name">): string[] {
  const keys: string[] = [];
  const ticker = baseTicker(holding.symbol);
  if (ticker) keys.push(`t:${ticker}`);
  const name = normalizeCompanyName(holding.name);
  if (name) keys.push(`n:${name}`);
  return keys;
}

/** Quota in comune tra due elenchi di titoli: somma dei pesi minimi sui titoli presenti in entrambi. */
export function holdingsOverlap(a: ProfileHolding[], b: ProfileHolding[]): number {
  let total = 0;
  const usedB = new Set<number>();
  for (const holding of a) {
    const keys = holdingKeys(holding);
    const index = b.findIndex((other, i) => !usedB.has(i) && holdingKeys(other).some((k) => keys.includes(k)));
    if (index < 0) continue;
    usedB.add(index);
    total += Math.min(holding.weight, b[index].weight);
  }
  return total;
}

function fundPairOverlap(a: OverlapInput, b: OverlapInput): { share: number; method: OverlapMethod } | null {
  const indexA = a.exposure?.indexProfile ?? null;
  const indexB = b.exposure?.indexProfile ?? null;
  if (indexA && indexB) {
    if (indexA.profile.id === indexB.profile.id && indexA.broad === indexB.broad) return { share: 1, method: "stesso_indice" };
    if (indexA.broad && indexB.broad) {
      let share = 0;
      for (const [area, weight] of Object.entries(indexA.profile.areas)) {
        share += Math.min(weight ?? 0, indexB.profile.areas[area as keyof typeof indexB.profile.areas] ?? 0);
      }
      return { share, method: "aree_indici" };
    }
  }
  const holdingsA = a.profile?.holdings ?? [];
  const holdingsB = b.profile?.holdings ?? [];
  if (holdingsA.length === 0 || holdingsB.length === 0) return null;
  return { share: holdingsOverlap(holdingsA, holdingsB), method: "primi_titoli" };
}

/** Coppie di fondi posseduti con almeno `MIN_OVERLAP_SHOWN` in comune, dalla più sovrapposta. */
export function computeFundOverlaps(inputs: OverlapInput[]): FundOverlap[] {
  const funds = inputs.filter((i) => FUND_TYPES.has(i.instrument.type) && i.value > 0);
  const overlaps: FundOverlap[] = [];
  for (let i = 0; i < funds.length; i += 1) {
    for (let j = i + 1; j < funds.length; j += 1) {
      const result = fundPairOverlap(funds[i], funds[j]);
      if (result && result.share >= MIN_OVERLAP_SHOWN) {
        overlaps.push({ aId: funds[i].instrument.id, bId: funds[j].instrument.id, ...result });
      }
    }
  }
  return overlaps.sort((x, y) => y.share - x.share);
}

/** Azione posseduta direttamente che compare anche tra i primi titoli di uno o più fondi posseduti. */
export interface StockInsideFunds {
  stockId: string;
  directValue: number;
  /** Fondi che la contengono, con il peso (0-1) e il valore posseduto tramite ciascuno (valore del fondo × peso). */
  funds: { fundId: string; weightInFund: number; viaFundValue: number }[];
  /** Esposizione complessiva all'azione: diretta più tramite i fondi. */
  totalValue: number;
}

/** Azioni che possiedi anche attraverso i tuoi ETF, dalla più esposta. */
export function computeStocksInsideFunds(inputs: OverlapInput[]): StockInsideFunds[] {
  const stocks = inputs.filter((i) => i.instrument.type === "azione" && i.value > 0);
  const funds = inputs.filter((i) => FUND_TYPES.has(i.instrument.type) && i.value > 0 && (i.profile?.holdings?.length ?? 0) > 0);
  const found: StockInsideFunds[] = [];
  for (const stock of stocks) {
    const keys = holdingKeys({ symbol: stock.profile?.symbol ?? null, name: stock.instrument.name });
    const inside = funds.flatMap((fund) => {
      const holding = fund.profile?.holdings?.find((h) => holdingKeys(h).some((k) => keys.includes(k)));
      return holding ? [{ fundId: fund.instrument.id, weightInFund: holding.weight, viaFundValue: fund.value * holding.weight }] : [];
    });
    if (inside.length === 0) continue;
    const via = inside.reduce((s, f) => s + f.viaFundValue, 0);
    found.push({ stockId: stock.instrument.id, directValue: stock.value, funds: inside, totalValue: stock.value + via });
  }
  return found.sort((a, b) => b.totalValue - a.totalValue);
}
