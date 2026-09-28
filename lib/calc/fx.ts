/** Valuta pivot dei cambi: la BCE pubblica tutto con base EUR. */
export const FX_BASE_CURRENCY = "EUR";

/** Cambio come arriva dall'API: 1 EUR = `perEur` unità di `currency` (numeric serializzato come stringa). */
export interface FxRateInput {
  date: string;
  currency: string;
  perEur: string;
}

interface DatedRate {
  date: string;
  perEur: number;
}

/** Cambi indicizzati per valuta, ordinati per data: si costruisce una volta e si interroga molte volte. */
export type FxTable = Map<string, DatedRate[]>;

/** Costruisce la tabella dei cambi; righe duplicate per la stessa data tengono l'ultima. */
export function buildFxTable(rates: FxRateInput[]): FxTable {
  const byCurrency = new Map<string, Map<string, number>>();
  for (const rate of rates) {
    const perEur = Number(rate.perEur);
    if (!Number.isFinite(perEur) || perEur <= 0) continue;
    const dates = byCurrency.get(rate.currency) ?? new Map<string, number>();
    dates.set(rate.date, perEur);
    byCurrency.set(rate.currency, dates);
  }
  const table: FxTable = new Map();
  for (const [currency, dates] of byCurrency) {
    table.set(
      currency,
      [...dates.entries()].map(([date, perEur]) => ({ date, perEur })).sort((a, b) => a.date.localeCompare(b.date))
    );
  }
  return table;
}

/** Ultimo elemento con `date <= dateKey` in un array ordinato per data, o null. */
export function findLastOnOrBefore<T extends { date: string }>(sorted: T[], dateKey: string): T | null {
  let low = 0;
  let high = sorted.length - 1;
  let found: T | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (sorted[mid].date <= dateKey) {
      found = sorted[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Quante unità di `currency` vale 1 EUR alla data (ultimo cambio disponibile), o null se non ce n'è nessuno. */
export function getPerEur(table: FxTable, currency: string, dateKey: string): number | null {
  if (currency === FX_BASE_CURRENCY) return 1;
  const rates = table.get(currency);
  if (!rates) return null;
  return findLastOnOrBefore(rates, dateKey)?.perEur ?? null;
}

/** Cambio da `from` a `to` alla data (1 `from` = x `to`), passando dall'EUR; null se manca un cambio. */
export function fxRateBetween(table: FxTable, from: string, to: string, dateKey: string): number | null {
  if (from === to) return 1;
  const perFrom = getPerEur(table, from, dateKey);
  const perTo = getPerEur(table, to, dateKey);
  if (perFrom === null || perTo === null) return null;
  return perTo / perFrom;
}

/** Converte un importo tra due valute alla data; null se manca un cambio. */
export function convertAmount(table: FxTable, amount: number, from: string, to: string, dateKey: string): number | null {
  const rate = fxRateBetween(table, from, to, dateKey);
  return rate === null ? null : amount * rate;
}
