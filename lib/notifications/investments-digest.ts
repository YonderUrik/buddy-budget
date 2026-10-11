import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex } from "@/lib/calc/investments";
import type { InvestmentData } from "@/lib/investments/data";
import { computePeriodGain } from "@/lib/investments/period-gain";
import { toTransactionInputs } from "@/lib/investments/view";

/** La parte «Investimenti» del riepilogo: le stesse cifre della scheda Portafoglio, ristrette al periodo del riepilogo. */
export interface InvestmentDigest {
  /** Valore del portafoglio a fine periodo. */
  endValue: number;
  /** Guadagno del periodo al netto di acquisti e vendite, dividendi e cedole inclusi. */
  gain: number;
  /** Rendimento del periodo a parità di versamenti (TWR), null se non c'era niente investito. */
  twr: number | null;
  /** Dividendi e cedole incassati nel periodo. */
  income: number;
  /** Acquisti meno vendite nel periodo: positivo = soldi messi, negativo = soldi ritirati. */
  netContributions: number;
}

/**
 * Riassume il portafoglio nel periodo `[from, to]` (date ISO) con `computePeriodGain`, lo stesso motore della pagina
 * Investimenti. Null se l'utente non ha operazioni o se nel periodo il portafoglio era vuoto. Pura, per i test.
 */
export function buildInvestmentDigest(data: InvestmentData, range: { from: string; to: string }, now: Date): InvestmentDigest | null {
  if (data.transactions.length === 0) return null;
  const transactions = toTransactionInputs(data);
  const gain = computePeriodGain({
    transactions,
    instruments: data.instruments,
    priceIndex: buildPriceIndex(data.prices, data.manualPrices, transactions),
    fx: buildFxTable(data.fxRates),
    userCurrency: data.currency,
    period: "1mese",
    today: now,
    range,
  });
  if (!gain || (gain.startValue === 0 && gain.endValue === 0 && gain.netContributions === 0)) return null;
  return { endValue: gain.endValue, gain: gain.gain, twr: gain.twr, income: gain.income, netContributions: gain.netContributions };
}
