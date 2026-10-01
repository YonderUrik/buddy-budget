/**
 * Linea di credito (credit Lombard, fido): saldo utilizzato, interessi giornalieri e addebiti, tutto calcolato da
 * condizioni iniziali + registro eventi (puro, nessun accesso al database).
 *
 * Il saldo di un giorno è quello dopo tutti gli eventi con data ≤ quel giorno. Gli interessi maturano ogni giorno
 * sul saldo del giorno, al tasso in vigore (indice + spread), con la base scelta dall'utente (360, 365 o giorni
 * effettivi). A ogni scadenza di addebito (fine mese o fine trimestre) si addebita il maturato del periodo: se
 * l'utente ha registrato l'importo reale addebitato dalla banca, vale quello al posto della stima. Con la
 * capitalizzazione l'addebito si somma al saldo dal giorno dopo.
 */

import { round2, type IsoDate } from "./amortization";

export type CreditLineFrequency = "monthly" | "quarterly";
export type CreditLineDayCount = "360" | "365" | "actual";

/** Giorni dopo la scadenza entro cui un addebito reale registrato si considera di quel periodo (la banca addebita dopo). */
export const CHARGE_MATCH_GRACE_DAYS = 10;
/** Oltre questo numero di giorni un tracciamento non si calcola (protegge dai dati sbagliati, ~60 anni). */
export const MAX_TRACKED_DAYS = 22000;

export interface CreditLineFee {
  label: string;
  amount: number;
  /** `una_tantum` all'apertura, `per_rata` a ogni addebito degli interessi. */
  kind: "una_tantum" | "per_rata";
}

export interface CreditLineTerms {
  /** Data da cui si tiene traccia (apertura della linea o inizio del tracciamento). */
  openDate: IsoDate;
  creditLimit: number;
  /** Saldo utilizzato alla data di apertura. */
  initialUsed: number;
  /** Valore iniziale dell'indice in % (per un tasso fisso, il tasso stesso). */
  indexRate: number;
  /** Spread in punti percentuali (0 per un tasso fisso). */
  spread: number;
  frequency: CreditLineFrequency;
  dayCount: CreditLineDayCount;
  capitalize: boolean;
  fees: CreditLineFee[];
}

export type CreditLineEvent =
  | { type: "draw"; date: IsoDate; amount: number }
  | { type: "repay"; date: IsoDate; amount: number }
  /** Nuovo valore dell'indice in %. */
  | { type: "rate_change"; date: IsoDate; rate: number }
  /** Saldo utilizzato reale alla data. */
  | { type: "balance_correction"; date: IsoDate; amount: number }
  /** Interessi realmente addebitati dalla banca. */
  | { type: "interest_charged"; date: IsoDate; amount: number };

export interface CreditLineCharge {
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** Data dell'addebito: quella registrata dall'utente, altrimenti la fine del periodo. */
  date: IsoDate;
  /** Interessi maturati nel periodo secondo il calcolo. */
  estimated: number;
  /** Interessi addebitati: l'importo reale se registrato, altrimenti la stima. */
  charged: number;
  /** True se `charged` è l'importo reale registrato dall'utente. */
  actual: boolean;
  /** Commissioni (spese per addebito) del periodo. */
  fees: number;
}

export interface CreditLineBalancePoint {
  date: IsoDate;
  balance: number;
}

export interface CreditLinePlan {
  /** Saldo utilizzato a oggi (compresi gli interessi capitalizzati). */
  used: number;
  creditLimit: number;
  available: number;
  /** Quota del fido utilizzata (0 senza fido). */
  usageRatio: number;
  /** True se l'utilizzato supera il fido. */
  overLimit: boolean;
  /** Valore dell'indice in vigore a oggi (%). */
  indexRate: number;
  /** Tasso totale in vigore a oggi: indice + spread (%). */
  currentRate: number;
  /** Interessi maturati dall'ultimo addebito a oggi (non ancora addebitati). */
  accruedSinceLastCharge: number;
  /** Inizio del periodo di maturazione in corso. */
  currentPeriodStart: IsoDate;
  /** Prossima scadenza di addebito. */
  nextChargeDate: IsoDate;
  /** Stima degli interessi del periodo in corso, a saldo e tasso di oggi fino alla scadenza. */
  projectedPeriodInterest: number;
  /** Costo di un mese al saldo e al tasso di oggi. */
  monthlyCostAtCurrent: number;
  /** Costo di un anno al saldo e al tasso di oggi. */
  yearlyCostAtCurrent: number;
  /** Interessi già addebitati (reali dove registrati, stimati altrove). */
  interestCharged: number;
  /** Interessi maturati dall'apertura a oggi: addebitati più quelli del periodo in corso. */
  interestToDate: number;
  /** Commissioni pagate fino a oggi (una tantum e per addebito). */
  feesPaid: number;
  /** Saldo medio dall'apertura a oggi. */
  averageUsed: number;
  peakUsed: number;
  /** Addebiti dei periodi conclusi, dal più vecchio. */
  charges: CreditLineCharge[];
  /** Serie a scalini del saldo: apertura, ogni giorno in cui cambia, oggi. */
  balanceSeries: CreditLineBalancePoint[];
}

export class CreditLineError extends Error {}

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(date: IsoDate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parse(date);
  return toIso(Date.UTC(y, m - 1, d + days));
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = parse(from);
  const [ty, tm, td] = parse(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Giorni della base di calcolo per la data (360, 365 o 365/366 effettivi). */
export function dayCountBase(dayCount: CreditLineDayCount, date: IsoDate): number {
  if (dayCount === "360") return 360;
  if (dayCount === "365") return 365;
  return isLeap(parse(date)[0]) ? 366 : 365;
}

/** Ultimo giorno del periodo di addebito che contiene la data. */
export function periodEndFor(date: IsoDate, frequency: CreditLineFrequency): IsoDate {
  const [y, m] = parse(date);
  const endMonth = frequency === "monthly" ? m : Math.ceil(m / 3) * 3;
  return toIso(Date.UTC(y, endMonth, 0));
}

/** Evento nella forma ordinata di applicazione: nello stesso giorno prima indice e correzioni, poi utilizzi e rimborsi. */
const SAME_DAY_ORDER: Record<CreditLineEvent["type"], number> = {
  rate_change: 0,
  balance_correction: 1,
  draw: 2,
  repay: 3,
  interest_charged: 4,
};

function sortEvents(events: CreditLineEvent[]): CreditLineEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || SAME_DAY_ORDER[a.type] - SAME_DAY_ORDER[b.type]);
}

interface Period {
  start: IsoDate;
  end: IsoDate;
}

/** Periodi di addebito conclusi (fine ≤ today) dall'apertura. */
function listClosedPeriods(openDate: IsoDate, today: IsoDate, frequency: CreditLineFrequency): Period[] {
  const periods: Period[] = [];
  let start = openDate;
  for (;;) {
    const end = periodEndFor(start, frequency);
    if (end > today) return periods;
    periods.push({ start, end });
    start = addDays(end, 1);
  }
}

/** Assegna a ogni periodo l'addebito reale registrato (il primo non ancora usato entro la scadenza + tolleranza). */
function matchActualCharges(periods: Period[], events: CreditLineEvent[]): Map<number, { date: IsoDate; amount: number }> {
  const actual = events.filter((e): e is Extract<CreditLineEvent, { type: "interest_charged" }> => e.type === "interest_charged");
  const matched = new Map<number, { date: IsoDate; amount: number }>();
  let next = 0;
  periods.forEach((period, index) => {
    const limit = addDays(period.end, CHARGE_MATCH_GRACE_DAYS);
    if (next < actual.length && actual[next].date <= limit) {
      matched.set(index, { date: actual[next].date, amount: actual[next].amount });
      next += 1;
    }
  });
  return matched;
}

/** Costruisce lo stato della linea di credito a `today` dalle condizioni e dal registro eventi. */
export function buildCreditLinePlan(terms: CreditLineTerms, rawEvents: CreditLineEvent[], today: IsoDate): CreditLinePlan {
  if (daysBetween(terms.openDate, today) > MAX_TRACKED_DAYS) throw new CreditLineError("Periodo di tracciamento troppo lungo");
  const end = today < terms.openDate ? terms.openDate : today;
  const events = sortEvents(rawEvents.filter((e) => e.date <= end));
  const periods = listClosedPeriods(terms.openDate, end, terms.frequency);
  const actualByPeriod = matchActualCharges(periods, events);
  const periodByEnd = new Map(periods.map((p, i) => [p.end, i]));
  const feePerCharge = terms.fees.filter((f) => f.kind === "per_rata").reduce((s, f) => s + f.amount, 0);
  const upfrontFees = terms.fees.filter((f) => f.kind === "una_tantum").reduce((s, f) => s + f.amount, 0);

  let balance = terms.initialUsed;
  let index = terms.indexRate;
  let accrued = 0;
  let periodStart = terms.openDate;
  let capitalizeNext = 0;
  let eventPointer = 0;
  let balanceSum = 0;
  let peak = balance;
  let days = 0;
  let interestCharged = 0;
  let feesPaid = upfrontFees;
  const charges: CreditLineCharge[] = [];
  const balanceSeries: CreditLineBalancePoint[] = [{ date: terms.openDate, balance: round2(balance) }];

  const push = (date: IsoDate) => {
    const rounded = round2(balance);
    const last = balanceSeries[balanceSeries.length - 1];
    if (last.date === date) last.balance = rounded;
    else if (last.balance !== rounded) balanceSeries.push({ date, balance: rounded });
  };

  for (let date = terms.openDate; date <= end; date = addDays(date, 1)) {
    if (capitalizeNext !== 0) {
      balance += capitalizeNext;
      capitalizeNext = 0;
    }
    while (eventPointer < events.length && events[eventPointer].date <= date) {
      const event = events[eventPointer++];
      if (event.type === "rate_change") index = event.rate;
      else if (event.type === "balance_correction") balance = event.amount;
      else if (event.type === "draw") balance += event.amount;
      else if (event.type === "repay") balance = Math.max(0, balance - event.amount);
    }
    push(date);
    const rate = index + terms.spread;
    accrued += (balance * rate) / 100 / dayCountBase(terms.dayCount, date);
    balanceSum += balance;
    peak = Math.max(peak, balance);
    days += 1;

    const periodIndex = periodByEnd.get(date);
    if (periodIndex !== undefined) {
      const estimated = round2(accrued);
      const real = actualByPeriod.get(periodIndex);
      const charged = real ? round2(real.amount) : estimated;
      charges.push({
        periodStart,
        periodEnd: date,
        date: real?.date ?? date,
        estimated,
        charged,
        actual: Boolean(real),
        fees: round2(feePerCharge),
      });
      interestCharged += charged;
      feesPaid += feePerCharge;
      if (terms.capitalize) capitalizeNext = charged;
      accrued = 0;
      periodStart = addDays(date, 1);
    }
  }
  // Un addebito capitalizzato l'ultimo giorno pesa sul saldo di oggi: lo includiamo.
  if (capitalizeNext !== 0) {
    balance += capitalizeNext;
    push(end);
  }

  const used = round2(balance);
  const rateNow = index + terms.spread;
  const baseToday = dayCountBase(terms.dayCount, end);
  const nextChargeDate = periodEndFor(periodStart, terms.frequency);
  const remainingDays = Math.max(0, daysBetween(end, nextChargeDate));
  const dailyNow = (used * rateNow) / 100 / baseToday;
  const accruedRounded = round2(accrued);

  return {
    used,
    creditLimit: terms.creditLimit,
    available: round2(terms.creditLimit - used),
    usageRatio: terms.creditLimit > 0 ? used / terms.creditLimit : 0,
    overLimit: used > terms.creditLimit,
    indexRate: index,
    currentRate: round2Rate(rateNow),
    accruedSinceLastCharge: accruedRounded,
    currentPeriodStart: periodStart,
    nextChargeDate,
    projectedPeriodInterest: round2(accrued + dailyNow * remainingDays),
    monthlyCostAtCurrent: round2((used * rateNow) / 100 / 12),
    yearlyCostAtCurrent: round2((used * rateNow) / 100),
    interestCharged: round2(interestCharged),
    interestToDate: round2(interestCharged + accrued),
    feesPaid: round2(feesPaid),
    averageUsed: days > 0 ? round2(balanceSum / days) : round2(balance),
    peakUsed: round2(peak),
    charges,
    balanceSeries,
  };
}

function round2Rate(rate: number): number {
  return Math.round(rate * 10000) / 10000;
}

/** Saldo utilizzato alla data (ultimo valore noto della serie a scalini; il primo prima dell'apertura). */
export function balanceOn(series: CreditLineBalancePoint[], date: IsoDate): number {
  let value = series[0]?.balance ?? 0;
  for (const point of series) {
    if (point.date > date) break;
    value = point.balance;
  }
  return value;
}

/** True se l'utilizzato supera la soglia dell'utente (percentuale del fido o importo). */
export function isOverAlertThreshold(
  used: number,
  creditLimit: number,
  threshold: { type: "percent" | "amount"; value: number } | null
): boolean {
  if (!threshold) return false;
  const limit = threshold.type === "percent" ? (creditLimit * threshold.value) / 100 : threshold.value;
  return used >= limit && limit > 0;
}
