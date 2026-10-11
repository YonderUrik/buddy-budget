/**
 * Bilanci di un'azienda (conto economico, stato patrimoniale, flussi di cassa) letti dall'endpoint
 * `fundamentals-timeseries` di Yahoo: esercizi annuali più gli ultimi 12 mesi. Qui ci sono solo tipi e il parser
 * puro; la chiamata di rete sta in `providers/yahoo.ts`, la cache in `fundamentals.ts`.
 */

/** Voci di bilancio usate dall'app, con il nome che hanno su Yahoo (senza il prefisso del periodo). */
export const STATEMENT_FIELDS = {
  revenue: "TotalRevenue",
  grossProfit: "GrossProfit",
  operatingIncome: "OperatingIncome",
  ebitda: "EBITDA",
  netIncome: "NetIncomeCommonStockholders",
  dilutedEps: "DilutedEPS",
  dilutedShares: "DilutedAverageShares",
  interestExpense: "InterestExpense",
  operatingCashFlow: "OperatingCashFlow",
  capex: "CapitalExpenditure",
  freeCashFlow: "FreeCashFlow",
  dividendsPaid: "CashDividendsPaid",
  equity: "StockholdersEquity",
  totalDebt: "TotalDebt",
  cash: "CashAndCashEquivalents",
  totalAssets: "TotalAssets",
  currentAssets: "CurrentAssets",
  currentLiabilities: "CurrentLiabilities",
  sharesOutstanding: "OrdinarySharesNumber",
} as const;

export type StatementField = keyof typeof STATEMENT_FIELDS;

/** Voci dello stato patrimoniale: sono fotografie a una data, quindi non hanno la versione "ultimi 12 mesi". */
export const BALANCE_FIELDS: readonly StatementField[] = [
  "equity",
  "totalDebt",
  "cash",
  "totalAssets",
  "currentAssets",
  "currentLiabilities",
  "sharesOutstanding",
];

/** Un periodo di bilancio: data di chiusura (YYYY-MM-DD) e le voci disponibili. */
export interface StatementPeriod {
  end: string;
  values: Partial<Record<StatementField, number>>;
}

/** Bilanci di un'azienda: esercizi annuali in ordine crescente e, se ci sono, gli ultimi 12 mesi. */
export interface CompanyStatements {
  /** Valuta di bilancio dichiarata da Yahoo (può differire da quella di quotazione). */
  currency: string | null;
  annual: StatementPeriod[];
  /** Conto economico e cassa degli ultimi 4 trimestri, con lo stato patrimoniale dell'ultimo trimestre. */
  trailing: StatementPeriod | null;
}

/** Esercizi annuali chiesti a Yahoo: ne dà di solito 4-5. */
export const STATEMENT_YEARS = 6;

/** Tipi da chiedere all'endpoint: annuali per tutto, trailing per conto economico e cassa, trimestrali per lo stato patrimoniale. */
export function statementTypes(): string[] {
  const types: string[] = [];
  for (const [field, name] of Object.entries(STATEMENT_FIELDS) as [StatementField, string][]) {
    types.push(`annual${name}`);
    types.push(BALANCE_FIELDS.includes(field) ? `quarterly${name}` : `trailing${name}`);
  }
  return types;
}

interface YahooTimeseriesPoint {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
}

/** Risposta dell'endpoint: un risultato per tipo, con i punti sotto una chiave uguale al nome del tipo. */
export interface YahooTimeseriesResponse {
  timeseries?: {
    result?: ({ meta?: { type?: string[] } } & Record<string, unknown>)[] | null;
  };
}

const FIELD_BY_NAME = new Map<string, StatementField>(
  (Object.entries(STATEMENT_FIELDS) as [StatementField, string][]).map(([field, name]) => [name, field])
);

function splitType(type: string): { period: "annual" | "trailing" | "quarterly"; field: StatementField } | null {
  const match = /^(annual|trailing|quarterly)(.+)$/.exec(type);
  if (!match) return null;
  const field = FIELD_BY_NAME.get(match[2]);
  return field ? { period: match[1] as "annual" | "trailing" | "quarterly", field } : null;
}

/** Converte la risposta in bilanci dell'app. Null se non c'è nessun esercizio annuale con dei numeri. */
export function parseYahooStatements(body: YahooTimeseriesResponse): CompanyStatements | null {
  const annual = new Map<string, StatementPeriod>();
  const latestTrailing = new Map<StatementField, { end: string; value: number }>();
  const latestQuarter = new Map<StatementField, { end: string; value: number }>();
  let currency: string | null = null;

  for (const result of body.timeseries?.result ?? []) {
    const type = result.meta?.type?.[0];
    const parsed = type ? splitType(type) : null;
    const points = parsed ? (result[type!] as (YahooTimeseriesPoint | null)[] | undefined) : undefined;
    if (!parsed || !Array.isArray(points)) continue;
    for (const point of points) {
      const value = point?.reportedValue?.raw;
      const end = point?.asOfDate;
      if (typeof value !== "number" || !Number.isFinite(value) || !end) continue;
      currency ??= point?.currencyCode ?? null;
      if (parsed.period === "annual") {
        const period = annual.get(end) ?? { end, values: {} };
        period.values[parsed.field] = value;
        annual.set(end, period);
      } else {
        const latest = parsed.period === "trailing" ? latestTrailing : latestQuarter;
        const previous = latest.get(parsed.field);
        if (!previous || end > previous.end) latest.set(parsed.field, { end, value });
      }
    }
  }

  const years = [...annual.values()]
    .filter((p) => Object.keys(p.values).length > 0)
    .sort((a, b) => (a.end < b.end ? -1 : 1))
    .slice(-STATEMENT_YEARS);
  if (years.length === 0) return null;

  let trailingPeriod: StatementPeriod | null = null;
  const trailingEnd = [...latestTrailing.values()].reduce((max, p) => (p.end > max ? p.end : max), "");
  if (trailingEnd !== "") {
    const values: Partial<Record<StatementField, number>> = {};
    // Solo le voci aggiornate all'ultimo trimestre: una voce ferma a un periodo più vecchio non si mescola.
    for (const [field, point] of latestTrailing) if (point.end === trailingEnd) values[field] = point.value;
    for (const [field, point] of latestQuarter) values[field] = point.value;
    // Senza un trimestre recente lo stato patrimoniale degli ultimi 12 mesi è quello dell'ultimo esercizio.
    const lastYear = years[years.length - 1];
    for (const field of BALANCE_FIELDS) {
      if (values[field] === undefined && lastYear.values[field] !== undefined) values[field] = lastYear.values[field];
    }
    trailingPeriod = { end: trailingEnd, values };
  }
  return { currency, annual: years, trailing: trailingPeriod };
}
