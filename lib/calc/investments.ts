import type {
  InstrumentType,
  InvestmentTransactionType,
  PriceUnit,
  ProviderId,
} from "@/lib/db/schema/investments";
import { parseDateOnly, startOfDay } from "./expenses";
import { convertAmount, findLastOnOrBefore, type FxTable } from "./fx";
import { addDays, getNetWorthPeriodRange, toDateKey, type NetWorthPeriod } from "./net-worth";

/** Sotto questa soglia una quantità è considerata zero (arrotondamenti su quote frazionarie). */
export const QUANTITY_EPSILON = 1e-9;

/** Operazioni che aumentano o riducono le quote; le altre sono proventi. */
const BUY_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["acquisto"]);
const SELL_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["vendita", "rimborso"]);

/** Nello stesso giorno gli acquisti si applicano prima delle vendite (vendere quanto comprato in giornata è lecito). */
const SAME_DAY_ORDER: Record<InvestmentTransactionType, number> = {
  acquisto: 0,
  dividendo: 1,
  cedola: 1,
  vendita: 2,
  rimborso: 2,
};

/** Strumento come serve ai calcoli. */
export interface InstrumentInput {
  id: string;
  name: string;
  type: InstrumentType;
  currency: string;
  priceUnit: PriceUnit;
}

/** Operazione come arriva dall'API (numeric serializzati come stringa). */
export interface InvestmentTransactionInput {
  id: string;
  instrumentId: string;
  type: InvestmentTransactionType;
  date: string;
  quantity: string;
  price: string;
  /** Cambio valuta strumento → valuta utente alla data dell'operazione. */
  fxRate: string;
  fees: string;
  taxes: string;
  grossAmount: string | null;
}

/** Prezzo di chiusura automatico (dalle fonti di mercato). */
export interface PriceInput {
  instrumentId: string;
  date: string;
  close: string;
  source: ProviderId;
}

/** Prezzo inserito a mano dall'utente. */
export interface ManualPriceInput {
  instrumentId: string;
  date: string;
  close: string;
}

/** Da dove viene un prezzo: una fonte automatica, l'utente, o il prezzo dell'ultima operazione (ripiego). */
export type PriceOrigin = ProviderId | "manuale" | "operazione";

export interface ResolvedPrice {
  date: string;
  close: number;
  origin: PriceOrigin;
}

/** Prezzi per strumento ordinati per data, già risolte le precedenze nello stesso giorno. */
export type PriceIndex = Map<string, ResolvedPrice[]>;

/** Precedenza nello stesso giorno: il manuale vince sull'automatico, che vince sul prezzo di un'operazione. */
const ORIGIN_PRIORITY: Record<"manuale" | "auto" | "operazione", number> = { manuale: 3, auto: 2, operazione: 1 };

function originRank(origin: PriceOrigin): number {
  if (origin === "manuale") return ORIGIN_PRIORITY.manuale;
  if (origin === "operazione") return ORIGIN_PRIORITY.operazione;
  return ORIGIN_PRIORITY.auto;
}

/** Moltiplicatore del prezzo: 1 per le quote, 1/100 per le obbligazioni quotate in percentuale del nominale. */
export function priceMultiplier(unit: PriceUnit): number {
  return unit === "percentuale_nominale" ? 0.01 : 1;
}

/** Ordina le operazioni per data e, nello stesso giorno, acquisti prima delle vendite. */
export function sortTransactions<T extends Pick<InvestmentTransactionInput, "date" | "type">>(transactions: T[]): T[] {
  return [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || SAME_DAY_ORDER[a.type] - SAME_DAY_ORDER[b.type]
  );
}

/**
 * Indice dei prezzi per strumento. I prezzi delle operazioni sono un ripiego: evitano un valore vuoto
 * subito dopo un acquisto, prima che arrivi il primo prezzo di mercato.
 */
export function buildPriceIndex(
  prices: PriceInput[],
  manualPrices: ManualPriceInput[],
  transactions: InvestmentTransactionInput[] = []
): PriceIndex {
  const byInstrument = new Map<string, Map<string, ResolvedPrice>>();
  const add = (instrumentId: string, candidate: ResolvedPrice) => {
    if (!Number.isFinite(candidate.close) || candidate.close <= 0) return;
    const dates = byInstrument.get(instrumentId) ?? new Map<string, ResolvedPrice>();
    const current = dates.get(candidate.date);
    if (!current || originRank(candidate.origin) >= originRank(current.origin)) dates.set(candidate.date, candidate);
    byInstrument.set(instrumentId, dates);
  };
  for (const t of transactions) {
    if (BUY_TYPES.has(t.type) || SELL_TYPES.has(t.type)) {
      add(t.instrumentId, { date: t.date, close: Number(t.price), origin: "operazione" });
    }
  }
  for (const p of prices) add(p.instrumentId, { date: p.date, close: Number(p.close), origin: p.source });
  for (const p of manualPrices) add(p.instrumentId, { date: p.date, close: Number(p.close), origin: "manuale" });

  const index: PriceIndex = new Map();
  for (const [instrumentId, dates] of byInstrument) {
    index.set(instrumentId, [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return index;
}

/** Ultimo prezzo dello strumento alla data (inclusa), o null. */
export function resolvePrice(index: PriceIndex, instrumentId: string, dateKey: string): ResolvedPrice | null {
  const prices = index.get(instrumentId);
  return prices ? findLastOnOrBefore(prices, dateKey) : null;
}

/** Stato di una posizione dopo aver applicato le operazioni fino a una data. Importi in valuta utente. */
export interface Position {
  instrumentId: string;
  quantity: number;
  /** Costo di carico residuo (costo medio ponderato × quote), commissioni di acquisto incluse. */
  costBasis: number;
  /** Prezzo medio di carico nella stessa unità del prezzo di mercato (per quota o % del nominale). */
  averagePrice: number | null;
  realizedGain: number;
  /** Dividendi e cedole netti incassati. */
  income: number;
  /** Denaro messo (acquisti) meno denaro rientrato (vendite, rimborsi). */
  investedNet: number;
  /** Somma dei costi di tutti gli acquisti, anche di quote poi vendute. */
  totalBought: number;
  firstDate: string;
}

function emptyPosition(instrumentId: string, date: string): Position {
  return {
    instrumentId,
    quantity: 0,
    costBasis: 0,
    averagePrice: null,
    realizedGain: 0,
    income: 0,
    investedNet: 0,
    totalBought: 0,
    firstDate: date,
  };
}

function applyTransaction(position: Position, t: InvestmentTransactionInput, multiplier: number): void {
  const quantity = Number(t.quantity);
  const price = Number(t.price);
  const fx = Number(t.fxRate) || 1;
  const fees = Number(t.fees) || 0;
  const taxes = Number(t.taxes) || 0;

  if (BUY_TYPES.has(t.type)) {
    const cost = quantity * price * multiplier * fx + fees;
    position.quantity += quantity;
    position.costBasis += cost;
    position.investedNet += cost;
    position.totalBought += cost;
  } else if (SELL_TYPES.has(t.type)) {
    const sold = Math.min(quantity, position.quantity);
    const averageCost = position.quantity > QUANTITY_EPSILON ? position.costBasis / position.quantity : 0;
    const proceeds = quantity * price * multiplier * fx - fees - taxes;
    position.realizedGain += proceeds - averageCost * sold;
    position.costBasis -= averageCost * sold;
    position.quantity -= sold;
    position.investedNet -= proceeds;
  } else {
    const gross = Number(t.grossAmount ?? 0);
    position.income += gross * fx - taxes - fees;
  }

  if (Math.abs(position.quantity) < QUANTITY_EPSILON) {
    position.quantity = 0;
    position.costBasis = 0;
  }
}

/** Posizioni per strumento applicando le operazioni fino a `asOfKey` inclusa, con costo medio ponderato. */
export function computePositions(
  transactions: InvestmentTransactionInput[],
  instruments: InstrumentInput[],
  asOfKey: string
): Map<string, Position> {
  const multiplierById = new Map(instruments.map((i) => [i.id, priceMultiplier(i.priceUnit)]));
  const positions = new Map<string, Position>();
  for (const t of sortTransactions(transactions)) {
    if (t.date > asOfKey) break;
    const position = positions.get(t.instrumentId) ?? emptyPosition(t.instrumentId, t.date);
    applyTransaction(position, t, multiplierById.get(t.instrumentId) ?? 1);
    positions.set(t.instrumentId, position);
  }
  for (const position of positions.values()) {
    const multiplier = multiplierById.get(position.instrumentId) ?? 1;
    position.averagePrice = position.quantity > 0 ? position.costBasis / (position.quantity * multiplier) : null;
  }
  return positions;
}

/**
 * Prima operazione che porterebbe le quote di uno strumento sotto zero (vendita o rimborso oltre il posseduto),
 * o null. Va chiamata sull'elenco finale: dopo un inserimento, una modifica o una cancellazione.
 */
export function findOversoldTransaction<T extends InvestmentTransactionInput>(transactions: T[]): T | null {
  const quantities = new Map<string, number>();
  for (const t of sortTransactions(transactions)) {
    const current = quantities.get(t.instrumentId) ?? 0;
    const quantity = Number(t.quantity);
    if (BUY_TYPES.has(t.type)) {
      quantities.set(t.instrumentId, current + quantity);
    } else if (SELL_TYPES.has(t.type)) {
      const next = current - quantity;
      if (next < -QUANTITY_EPSILON) return t;
      quantities.set(t.instrumentId, next);
    }
  }
  return null;
}

/** Valore di una quantità di strumento in valuta utente alla data; null senza prezzo o senza cambio. */
function valueAt(
  instrument: InstrumentInput,
  quantity: number,
  close: number,
  userCurrency: string,
  dateKey: string,
  fx: FxTable
): number | null {
  const local = quantity * close * priceMultiplier(instrument.priceUnit);
  return convertAmount(fx, local, instrument.currency, userCurrency, dateKey);
}

/** Riga della tabella posizioni: dati pronti per la UI. */
export interface PositionRow {
  instrument: InstrumentInput;
  quantity: number;
  averagePrice: number | null;
  costBasis: number;
  lastPrice: ResolvedPrice | null;
  value: number | null;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
  /** Quota sul valore totale del portafoglio (0-1), null se lo strumento non ha un valore. */
  weight: number | null;
}

/** Riepilogo del portafoglio a oggi. Importi in valuta utente. */
export interface PortfolioSummary {
  totalValue: number;
  /** Variazione rispetto alla chiusura precedente, sulle sole posizioni che hanno entrambi i prezzi. */
  dayChange: number | null;
  dayChangePct: number | null;
  unrealizedGain: number;
  realizedGain: number;
  income: number;
  totalGain: number;
  /** Guadagno totale sul totale degli acquisti di sempre. */
  totalGainPct: number | null;
  investedNet: number;
  costBasis: number;
  /** Strumenti posseduti senza prezzo o senza cambio: esclusi dal valore totale. */
  unpricedCount: number;
  rows: PositionRow[];
}

/** Riepilogo e righe delle posizioni aperte a `todayKey`. */
export function computePortfolioSummary(params: {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  todayKey: string;
}): PortfolioSummary {
  const { transactions, instruments, priceIndex, fx, userCurrency, todayKey } = params;
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const positions = computePositions(transactions, instruments, todayKey);

  let totalValue = 0;
  let previousValue = 0;
  let dayBase = 0;
  let unrealizedGain = 0;
  let realizedGain = 0;
  let income = 0;
  let investedNet = 0;
  let costBasis = 0;
  let totalBought = 0;
  let unpricedCount = 0;
  const rows: PositionRow[] = [];

  for (const position of positions.values()) {
    realizedGain += position.realizedGain;
    income += position.income;
    investedNet += position.investedNet;
    totalBought += position.totalBought;
    const instrument = instrumentById.get(position.instrumentId);
    if (!instrument || position.quantity <= 0) continue;

    costBasis += position.costBasis;
    const lastPrice = resolvePrice(priceIndex, instrument.id, todayKey);
    const value = lastPrice ? valueAt(instrument, position.quantity, lastPrice.close, userCurrency, todayKey, fx) : null;
    if (value === null) {
      unpricedCount += 1;
    } else {
      totalValue += value;
      unrealizedGain += value - position.costBasis;
      const previous = lastPrice
        ? resolvePrice(priceIndex, instrument.id, toDateKey(addDays(parseDateOnly(lastPrice.date), -1)))
        : null;
      const previousPositionValue = previous
        ? valueAt(instrument, position.quantity, previous.close, userCurrency, todayKey, fx)
        : null;
      if (previousPositionValue !== null) {
        dayBase += value;
        previousValue += previousPositionValue;
      }
    }
    rows.push({
      instrument,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      costBasis: position.costBasis,
      lastPrice,
      value,
      unrealizedGain: value === null ? null : value - position.costBasis,
      unrealizedGainPct: value === null || position.costBasis === 0 ? null : (value - position.costBasis) / position.costBasis,
      weight: null,
    });
  }

  for (const row of rows) {
    row.weight = row.value !== null && totalValue > 0 ? row.value / totalValue : null;
  }
  rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  const dayChange = previousValue > 0 ? dayBase - previousValue : null;
  const totalGain = unrealizedGain + realizedGain + income;
  return {
    totalValue,
    dayChange,
    dayChangePct: dayChange !== null && previousValue > 0 ? dayChange / previousValue : null,
    unrealizedGain,
    realizedGain,
    income,
    totalGain,
    totalGainPct: totalBought > 0 ? totalGain / totalBought : null,
    investedNet,
    costBasis,
    unpricedCount,
    rows,
  };
}

/** Valore del portafoglio e investito netto a fine giornata. */
export interface PortfolioDailyPoint {
  date: string;
  value: number;
  invested: number;
}

/**
 * Valore e investito netto giorno per giorno da `fromKey` a `toKey` inclusi. Le quote si aggiornano con le
 * operazioni del giorno; il prezzo è l'ultimo disponibile. Gli strumenti senza prezzo o cambio non contano.
 */
export function computeDailyPortfolioValues(params: {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  fromKey: string;
  toKey: string;
}): PortfolioDailyPoint[] {
  const { transactions, instruments, priceIndex, fx, userCurrency, fromKey, toKey } = params;
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const sorted = sortTransactions(transactions);
  const positions = new Map<string, Position>();
  let cursorIndex = 0;
  const points: PortfolioDailyPoint[] = [];

  for (let day = parseDateOnly(fromKey); toDateKey(day) <= toKey; day = addDays(day, 1)) {
    const key = toDateKey(day);
    while (cursorIndex < sorted.length && sorted[cursorIndex].date <= key) {
      const t = sorted[cursorIndex];
      const position = positions.get(t.instrumentId) ?? emptyPosition(t.instrumentId, t.date);
      const instrument = instrumentById.get(t.instrumentId);
      applyTransaction(position, t, instrument ? priceMultiplier(instrument.priceUnit) : 1);
      positions.set(t.instrumentId, position);
      cursorIndex += 1;
    }
    let value = 0;
    let invested = 0;
    for (const position of positions.values()) {
      invested += position.investedNet;
      const instrument = instrumentById.get(position.instrumentId);
      if (!instrument || position.quantity <= 0) continue;
      const price = resolvePrice(priceIndex, instrument.id, key);
      const positionValue = price ? valueAt(instrument, position.quantity, price.close, userCurrency, key, fx) : null;
      if (positionValue !== null) value += positionValue;
    }
    points.push({ date: key, value, invested });
  }
  return points;
}

/** Punto del grafico valore vs investito. */
export interface PortfolioSeriesPoint extends PortfolioDailyPoint {
  label: string;
}

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" });

/**
 * Serie del grafico nel periodo, con la stessa granularità del patrimonio netto: giornaliera per 1mese/3mesi,
 * un punto per fine mese per 1anno/max. `max` parte dalla prima operazione.
 */
export function buildPortfolioSeries(params: {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  period: NetWorthPeriod;
  today: Date;
}): PortfolioSeriesPoint[] {
  const { transactions, period, today } = params;
  if (transactions.length === 0) return [];
  const firstDate = sortTransactions(transactions)[0].date;
  const range = getNetWorthPeriodRange(period, today, firstDate);
  const todayKey = toDateKey(startOfDay(today));
  const fromKey = toDateKey(range.from) < firstDate ? firstDate : toDateKey(range.from);
  const daily = computeDailyPortfolioValues({ ...params, fromKey, toKey: todayKey });

  if (period === "1mese" || period === "3mesi") {
    return daily.map((p) => ({ ...p, label: DAY_LABEL_FORMAT.format(parseDateOnly(p.date)) }));
  }
  const monthly: PortfolioSeriesPoint[] = [];
  for (const p of daily) {
    const point = { ...p, label: MONTH_LABEL_FORMAT.format(parseDateOnly(p.date)) };
    const previous = monthly[monthly.length - 1];
    if (previous && previous.date.slice(0, 7) === p.date.slice(0, 7)) {
      monthly[monthly.length - 1] = point;
    } else {
      monthly.push(point);
    }
  }
  return monthly;
}

/** Fetta della composizione del portafoglio. */
export interface CompositionSlice {
  key: string;
  value: number;
  /** Quota sul totale (0-1). */
  share: number;
}

/** Composizione del valore per tipo di strumento o per valuta, dalla fetta più grande. */
export function computeComposition(rows: PositionRow[], by: "type" | "currency"): CompositionSlice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.value === null || row.value <= 0) continue;
    const key = by === "type" ? row.instrument.type : row.instrument.currency;
    totals.set(key, (totals.get(key) ?? 0) + row.value);
  }
  const total = [...totals.values()].reduce((sum, v) => sum + v, 0);
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value, share: total > 0 ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}
