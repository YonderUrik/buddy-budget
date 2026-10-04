import { convertAmount, type FxTable } from "@/lib/calc/fx";
import {
  priceMultiplier,
  QUANTITY_EPSILON,
  resolvePrice,
  sortTransactions,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PriceIndex,
} from "@/lib/calc/investments";

/**
 * Storico delle operazioni raggruppato per mese, con quanto ha reso ciascuna.
 *
 * Il guadagno di un acquisto segue lo stesso costo medio ponderato delle posizioni: ogni vendita riduce in proporzione
 * tutti gli acquisti ancora aperti, quindi la somma dei guadagni degli acquisti è il guadagno non realizzato, quella
 * delle vendite il realizzato, e il totale coincide con il guadagno complessivo del portafoglio (niente doppi conteggi).
 */

/** Esito di una singola operazione, in valuta utente. */
export interface OperationInsight<T extends InvestmentTransactionInput = InvestmentTransactionInput> {
  transaction: T;
  /** Costo dell'acquisto, commissioni incluse (0 per le altre operazioni). */
  paid: number;
  /** Denaro rientrato: incasso netto di vendite e rimborsi, provento netto di dividendi e cedole. */
  received: number;
  /** Quote di un acquisto ancora in portafoglio (le vendite successive le riducono in proporzione). */
  remainingQuantity: number;
  /** Valore di oggi delle quote ancora in portafoglio (solo acquisti), null senza prezzo o cambio. */
  currentValue: number | null;
  /**
   * Acquisto: valore di oggi meno costo delle quote rimaste. Vendita e rimborso: guadagno realizzato.
   * Dividendo e cedola: provento netto. Null per un acquisto senza prezzo o già del tutto venduto.
   */
  gain: number | null;
  /** Guadagno sul costo di riferimento (null per i proventi, che non hanno un costo). */
  gainPct: number | null;
  /** Costo su cui si misura il guadagno: costo delle quote rimaste o costo medio delle quote vendute. */
  gainBase: number;
}

/** Totali di un insieme di operazioni, in valuta utente. */
export interface OperationTotals {
  /** Operazioni, split compresi. */
  count: number;
  /** Totale acquistato, commissioni incluse. */
  bought: number;
  /** Incassato netto da vendite e rimborsi. */
  sold: number;
  /** Dividendi e cedole netti. */
  income: number;
  gain: number;
  gainPct: number | null;
  /** Acquisti ancora aperti senza prezzo o cambio: esclusi dal guadagno. */
  unpricedCount: number;
}

export interface OperationMonthGroup<T extends InvestmentTransactionInput = InvestmentTransactionInput> {
  /** `YYYY-MM`. */
  key: string;
  year: number;
  /** Es. "Settembre 2026". */
  label: string;
  /** Dalla più recente. */
  operations: OperationInsight<T>[];
  totals: OperationTotals;
}

const BUY_TYPES = new Set(["acquisto"]);
const SELL_TYPES = new Set(["vendita", "rimborso"]);

const MONTH_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

/** "settembre 2026" → "Settembre 2026". */
export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const label = MONTH_FORMAT.format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Esito di ogni operazione, nell'ordine cronologico di applicazione. */
export function computeOperationInsights<T extends InvestmentTransactionInput>(params: {
  transactions: T[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  todayKey: string;
}): OperationInsight<T>[] {
  const { transactions, instruments, priceIndex, fx, userCurrency, todayKey } = params;
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const state = new Map<string, { quantity: number; costBasis: number; openBuys: OperationInsight<T>[] }>();
  const insights: OperationInsight<T>[] = [];
  // Quote comprate × split successivi: la base su cui misurare quante quote di un acquisto restano.
  const splitAdjustedQuantity = new Map<OperationInsight<T>, number>();

  for (const t of sortTransactions(transactions)) {
    const multiplier = priceMultiplier(instrumentById.get(t.instrumentId)?.priceUnit ?? "unita");
    const position = state.get(t.instrumentId) ?? { quantity: 0, costBasis: 0, openBuys: [] };
    state.set(t.instrumentId, position);
    const quantity = Number(t.quantity);
    const price = Number(t.price);
    const fxRate = Number(t.fxRate) || 1;
    const fees = Number(t.fees) || 0;
    const taxes = Number(t.taxes) || 0;
    const insight: OperationInsight<T> = {
      transaction: t,
      paid: 0,
      received: 0,
      remainingQuantity: 0,
      currentValue: null,
      gain: null,
      gainPct: null,
      gainBase: 0,
    };

    if (BUY_TYPES.has(t.type)) {
      insight.paid = quantity * price * multiplier * fxRate + fees;
      insight.remainingQuantity = quantity;
      position.quantity += quantity;
      position.costBasis += insight.paid;
      position.openBuys.push(insight);
      splitAdjustedQuantity.set(insight, quantity);
    } else if (t.type === "rettifica") {
      position.quantity += quantity;
      position.costBasis += Number(t.grossAmount ?? 0) * fxRate;
    } else if (t.type === "split") {
      if (quantity > 0) {
        position.quantity *= quantity;
        for (const buy of position.openBuys) {
          buy.remainingQuantity *= quantity;
          splitAdjustedQuantity.set(buy, (splitAdjustedQuantity.get(buy) ?? 0) * quantity);
        }
      }
    } else if (SELL_TYPES.has(t.type)) {
      const sold = Math.min(quantity, position.quantity);
      const averageCost = position.quantity > QUANTITY_EPSILON ? position.costBasis / position.quantity : 0;
      insight.received = quantity * price * multiplier * fxRate - fees - taxes;
      insight.gainBase = averageCost * sold;
      insight.gain = insight.received - insight.gainBase;
      insight.gainPct = insight.gainBase > 0 ? insight.gain / insight.gainBase : null;
      // Costo medio ponderato: la vendita riduce in proporzione ogni acquisto ancora aperto.
      const keep = position.quantity > QUANTITY_EPSILON ? 1 - sold / position.quantity : 0;
      for (const buy of position.openBuys) buy.remainingQuantity *= keep;
      position.costBasis -= insight.gainBase;
      position.quantity -= sold;
      if (Math.abs(position.quantity) < QUANTITY_EPSILON) {
        position.quantity = 0;
        position.costBasis = 0;
        for (const buy of position.openBuys) buy.remainingQuantity = 0;
        position.openBuys = [];
      }
    } else {
      insight.received = Number(t.grossAmount ?? 0) * fxRate - taxes - fees;
      insight.gain = insight.received;
    }
    insights.push(insight);
  }

  for (const insight of insights) {
    const t = insight.transaction;
    if (!BUY_TYPES.has(t.type) || insight.remainingQuantity <= QUANTITY_EPSILON) continue;
    const instrument = instrumentById.get(t.instrumentId);
    const last = resolvePrice(priceIndex, t.instrumentId, todayKey);
    if (!instrument || !last) continue;
    const local = insight.remainingQuantity * last.close * priceMultiplier(instrument.priceUnit);
    const value = convertAmount(fx, local, instrument.currency, userCurrency, todayKey);
    if (value === null) continue;
    const base = splitAdjustedQuantity.get(insight) ?? Number(t.quantity);
    insight.gainBase = insight.paid * (insight.remainingQuantity / base);
    insight.currentValue = value;
    insight.gain = value - insight.gainBase;
    insight.gainPct = insight.gainBase > 0 ? insight.gain / insight.gainBase : null;
  }
  return insights;
}

/** Somma gli esiti di un insieme di operazioni. */
export function sumOperationTotals(insights: OperationInsight[]): OperationTotals {
  let bought = 0;
  let sold = 0;
  let income = 0;
  let gain = 0;
  let gainBase = 0;
  let unpricedCount = 0;
  for (const insight of insights) {
    const type = insight.transaction.type;
    if (type === "split" || type === "rettifica") continue;
    if (BUY_TYPES.has(type)) bought += insight.paid;
    else if (SELL_TYPES.has(type)) sold += insight.received;
    else income += insight.received;
    if (insight.gain !== null) {
      gain += insight.gain;
      gainBase += insight.gainBase;
    } else if (BUY_TYPES.has(type) && insight.remainingQuantity > QUANTITY_EPSILON) {
      unpricedCount += 1;
    }
  }
  return {
    count: insights.length,
    bought,
    sold,
    income,
    gain,
    gainPct: gainBase > 0 ? gain / gainBase : null,
    unpricedCount,
  };
}

/** Raggruppa per mese, dal più recente; dentro il mese le operazioni vanno dalla più recente. */
export function groupOperationsByMonth<T extends InvestmentTransactionInput>(
  insights: OperationInsight<T>[]
): OperationMonthGroup<T>[] {
  const byMonth = new Map<string, OperationInsight<T>[]>();
  for (const insight of insights) {
    const key = insight.transaction.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), insight]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, operations]) => ({
      key,
      year: Number(key.slice(0, 4)),
      label: formatMonthLabel(key),
      // Le operazioni arrivano in ordine cronologico: invertirle mantiene l'ordine nello stesso giorno.
      operations: [...operations].reverse(),
      totals: sumOperationTotals(operations),
    }));
}

/** Anni con almeno un'operazione, dal più recente. */
export function operationYears(months: OperationMonthGroup[]): number[] {
  return [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);
}
