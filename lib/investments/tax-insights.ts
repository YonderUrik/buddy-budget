import type { PositionRow } from "@/lib/calc/investments";
import { isFund, toBaseEquivalent, type LossEntry, type TaxInstrument } from "@/lib/calc/taxes";

/** Posizione aperta con il suo effetto fiscale se venduta oggi. Importi in valuta utente. */
export interface TaxOpportunityRow {
  instrumentId: string;
  /** Guadagno o perdita non realizzata (nominale). */
  unrealized: number;
  /** In base 26%: quanto zaino userebbe (guadagno) o genererebbe (perdita). */
  equivalent: number;
}

/** Suggerimenti fiscali sulle posizioni aperte. */
export interface TaxOpportunities {
  /** Zaino (base 26%, non crypto) che scade al 31/12 dell'anno in corso. */
  expiringThisYear: number;
  /** Guadagni non realizzati che lo zaino può compensare: azioni, obbligazioni, ETC (non ETF né crypto). */
  compensableGains: TaxOpportunityRow[];
  compensableTotal: number;
  /** Posizioni in perdita (non crypto): vendendole la minusvalenza entrerebbe nello zaino. */
  losses: TaxOpportunityRow[];
  lossesTotal: number;
}

/** Guadagni compensabili e perdite latenti delle posizioni aperte, dal più grande. */
export function computeTaxOpportunities(
  rows: Pick<PositionRow, "instrument" | "unrealizedGain">[],
  instruments: TaxInstrument[],
  losses: LossEntry[],
  currentYear: number
): TaxOpportunities {
  const byId = new Map(instruments.map((i) => [i.id, i]));
  const compensableGains: TaxOpportunityRow[] = [];
  const latentLosses: TaxOpportunityRow[] = [];
  for (const row of rows) {
    const instrument = byId.get(row.instrument.id);
    if (!instrument || row.unrealizedGain === null || instrument.type === "crypto") continue;
    const equivalent = toBaseEquivalent(row.unrealizedGain, instrument.taxRate);
    const entry = { instrumentId: instrument.id, unrealized: row.unrealizedGain, equivalent };
    if (row.unrealizedGain > 0 && !isFund(instrument.type)) compensableGains.push(entry);
    else if (row.unrealizedGain < 0) latentLosses.push({ ...entry, equivalent: -equivalent });
  }
  compensableGains.sort((a, b) => b.equivalent - a.equivalent);
  latentLosses.sort((a, b) => b.equivalent - a.equivalent);
  return {
    expiringThisYear: losses.filter((l) => !l.crypto && l.expiresYear === currentYear).reduce((s, l) => s + l.remaining, 0),
    compensableGains,
    compensableTotal: compensableGains.reduce((s, r) => s + r.equivalent, 0),
    losses: latentLosses,
    lossesTotal: latentLosses.reduce((s, r) => s + r.equivalent, 0),
  };
}
