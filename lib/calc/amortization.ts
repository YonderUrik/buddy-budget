/**
 * Motore di ammortamento di un finanziamento a rata costante (francese), tutto puro.
 *
 * Convenzioni: il tasso è il TAN nominale annuo **in percentuale** (6,5 = 6,5%), la rata è mensile e posticipata,
 * l'interesse di un periodo è residuo × tasso / 12. Gli importi del piano sono arrotondati al centesimo a ogni rata e
 * l'ultima rata chiude il residuo a zero assorbendo la differenza di arrotondamento.
 */

/** Data ISO `YYYY-MM-DD`. */
export type IsoDate = string;

/** Limite superiore del tasso annuo cercato dai solver (in %): oltre non ha senso per un finanziamento. */
export const MAX_SOLVER_ANNUAL_RATE = 100;
/** Precisione della bisezione sul tasso mensile. */
const SOLVER_TOLERANCE = 1e-12;
const SOLVER_MAX_ITERATIONS = 200;

export class AmortizationError extends Error {}

/** Arrotonda al centesimo (con un piccolo margine per i casi tipo 1,005). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthlyRate(annualRate: number): number {
  return annualRate / 1200;
}

function pmtExact(principal: number, annualRate: number, installments: number): number {
  const i = monthlyRate(annualRate);
  if (i === 0) return principal / installments;
  return (principal * i) / (1 - Math.pow(1 + i, -installments));
}

/** Rata costante (arrotondata al centesimo). Con tasso 0 è capitale / numero rate. */
export function installmentAmount(principal: number, annualRate: number, installments: number): number {
  if (!(principal > 0) || !(installments > 0)) throw new AmortizationError("Capitale e numero di rate devono essere positivi");
  return round2(pmtExact(principal, annualRate, installments));
}

// --- Date ---------------------------------------------------------------------------------------------------------

function parseIso(date: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function formatIso(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Aggiunge `months` mesi a `date` tenendo il giorno `anchorDay` (default: quello di `date`) e limitandolo all'ultimo
 * giorno dei mesi corti, senza overflow nel mese successivo (31 gennaio + 1 mese = 28/29 febbraio, poi di nuovo 31).
 */
export function addMonthsClamped(date: IsoDate, months: number, anchorDay?: number): IsoDate {
  const { y, m, d } = parseIso(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return formatIso(ny, nm, Math.min(anchorDay ?? d, daysInMonth(ny, nm)));
}

// --- Piano ---------------------------------------------------------------------------------------------------------

export interface ScheduleRow {
  /** Numero progressivo della rata, da `firstNumber`. */
  number: number;
  dueDate: IsoDate;
  installment: number;
  interest: number;
  capital: number;
  /** Capitale residuo dopo questa rata. */
  residual: number;
}

export interface SegmentScheduleInput {
  /** Scadenza della prima rata del segmento. */
  firstDueDate: IsoDate;
  /** Giorno del mese delle scadenze (default: quello di `firstDueDate`). */
  anchorDay?: number;
  /** Capitale residuo a inizio segmento. */
  principal: number;
  /** TAN annuo in %. */
  annualRate: number;
  /** Numero di rate del segmento. */
  installments: number;
  /** Rata da usare; se assente si calcola. */
  installment?: number;
  /** Numero della prima rata (default 1): i segmenti successivi proseguono la numerazione. */
  firstNumber?: number;
}

/** Piano di un segmento. L'ultima rata chiude il residuo a zero (assorbe gli arrotondamenti). */
export function buildSegmentSchedule(input: SegmentScheduleInput): ScheduleRow[] {
  const { firstDueDate, principal, annualRate, installments } = input;
  if (!Number.isInteger(installments) || installments < 1) throw new AmortizationError("Il numero di rate deve essere un intero positivo");
  if (!(principal > 0)) throw new AmortizationError("Il capitale deve essere positivo");
  const anchorDay = input.anchorDay ?? parseIso(firstDueDate).d;
  const firstNumber = input.firstNumber ?? 1;
  const installment = input.installment ?? installmentAmount(principal, annualRate, installments);
  const rows: ScheduleRow[] = [];
  let residual = round2(principal);
  for (let k = 0; k < installments; k++) {
    const interest = round2((residual * annualRate) / 1200);
    const isLast = k === installments - 1;
    const capital = isLast ? residual : round2(Math.min(installment - interest, residual));
    const paid = isLast ? round2(residual + interest) : installment;
    residual = round2(residual - capital);
    rows.push({
      number: firstNumber + k,
      dueDate: addMonthsClamped(firstDueDate, k, anchorDay),
      installment: paid,
      interest,
      capital,
      residual,
    });
  }
  return rows;
}

// --- Solver ---------------------------------------------------------------------------------------------------------

/** Bisezione su f(x) crescente in [lo, hi]. Restituisce null se la soluzione non è nell'intervallo. */
function bisect(f: (x: number) => number, lo: number, hi: number): number | null {
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < SOLVER_MAX_ITERATIONS && hi - lo > SOLVER_TOLERANCE; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Tasso annuo (%) che, con capitale, rata e numero di rate dati, chiude il finanziamento. */
export function solveAnnualRate(input: { principal: number; installment: number; installments: number }): number {
  const { principal, installment, installments } = input;
  if (!(principal > 0) || !(installment > 0) || !(installments > 0)) throw new AmortizationError("Capitale, rata e numero di rate devono essere positivi");
  if (installment * installments < principal - 0.005) {
    throw new AmortizationError("La rata per il numero di rate non copre nemmeno il capitale: controlla i dati");
  }
  const rate = bisect((r) => pmtExact(principal, r, installments) - installment, 0, MAX_SOLVER_ANNUAL_RATE);
  if (rate === null) throw new AmortizationError("Nessun tasso compatibile con questi dati");
  return rate;
}

/** Margine con cui l'ultima rata può superare quella dichiarata (gli arrotondamenti al centesimo la fanno crescere di poco). */
const LAST_INSTALLMENT_TOLERANCE = 0.01;
/** Oltre questo numero di rate (100 anni) il calcolo si ferma: i dati non descrivono un finanziamento vero. */
const MAX_SOLVER_INSTALLMENTS = 1200;

/**
 * Numero di rate con cui capitale, tasso e rata dati chiudono il finanziamento. Simula il piano con gli arrotondamenti
 * al centesimo e si ferma quando il saldo finale entra in una rata (con un margine dell'1%: una rata arrotondata al
 * centesimo non deve far salire il conto di una rata intera).
 */
export function solveInstallments(input: { principal: number; annualRate: number; installment: number }): number {
  const { principal, annualRate, installment } = input;
  if (!(principal > 0) || !(installment > 0)) throw new AmortizationError("Capitale e rata devono essere positivi");
  if (annualRate > 0 && installment <= (principal * annualRate) / 1200) {
    throw new AmortizationError("La rata non supera gli interessi del primo mese: il debito non si ridurrebbe mai");
  }
  let residual = round2(principal);
  for (let n = 1; n <= MAX_SOLVER_INSTALLMENTS; n++) {
    const interest = round2((residual * annualRate) / 1200);
    if (residual + interest <= installment * (1 + LAST_INSTALLMENT_TOLERANCE)) return n;
    residual = round2(residual + interest - installment);
  }
  throw new AmortizationError("Con questi dati il debito non si chiude in un tempo ragionevole");
}

/** Capitale erogato compatibile con rata, tasso e numero di rate (utile per capire un'offerta). */
export function solvePrincipal(input: { annualRate: number; installment: number; installments: number }): number {
  const { annualRate, installment, installments } = input;
  if (!(installment > 0) || !(installments > 0)) throw new AmortizationError("Rata e numero di rate devono essere positivi");
  const i = monthlyRate(annualRate);
  if (i === 0) return round2(installment * installments);
  return round2((installment * (1 - Math.pow(1 + i, -installments))) / i);
}

export interface AprInput {
  principal: number;
  /** Spese pagate una tantum all'erogazione (istruttoria, ecc.): riducono il netto ricevuto. */
  upfrontCosts: number;
  installment: number;
  /** Spese per ogni rata (assicurazione, incasso rata). */
  recurringCosts: number;
  installments: number;
}

/** TAEG: tasso annuo effettivo (%) dei flussi reali, comprese le spese. */
export function computeApr(input: AprInput): number {
  const { principal, upfrontCosts, installment, recurringCosts, installments } = input;
  const payment = installment + recurringCosts;
  const net = principal - upfrontCosts;
  if (!(net > 0) || !(payment > 0) || !(installments > 0)) throw new AmortizationError("Dati non validi per il calcolo del TAEG");
  if (payment * installments < net) throw new AmortizationError("I pagamenti totali sono inferiori al netto ricevuto: controlla i dati");
  // f(i) = valore attuale delle rate − netto ricevuto, decrescente in i: si cerca lo zero sul tasso mensile.
  const presentValue = (i: number) => (i === 0 ? payment * installments : (payment * (1 - Math.pow(1 + i, -installments))) / i);
  const monthly = bisect((i) => net - presentValue(i), 0, 1);
  if (monthly === null) throw new AmortizationError("Nessun TAEG compatibile con questi dati");
  return (Math.pow(1 + monthly, 12) - 1) * 100;
}

export type LoanInputKey = "principal" | "installment" | "installments" | "annualRate";

export interface LoanInputs {
  principal: number;
  installment: number;
  installments: number;
  annualRate: number;
}

export interface ResolvedLoanInputs extends LoanInputs {
  /** La grandezza calcolata (assente se l'utente le ha fornite tutte e quattro). */
  calculated?: LoanInputKey;
}

/**
 * Se manca esattamente una tra capitale, rata, numero rate e tasso, la calcola dalle altre tre. Con tutte e quattro
 * le restituisce invariate; con due o più mancanti lancia un errore leggibile.
 */
export function resolveMissingLoanInput(partial: Partial<LoanInputs>): ResolvedLoanInputs {
  const keys: LoanInputKey[] = ["principal", "installment", "installments", "annualRate"];
  const missing = keys.filter((k) => partial[k] === undefined || Number.isNaN(partial[k]));
  if (missing.length > 1) throw new AmortizationError("Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso");
  const p = partial as LoanInputs;
  if (missing.length === 0) return { ...p };
  const [key] = missing;
  switch (key) {
    case "annualRate":
      return { ...p, annualRate: solveAnnualRate(p), calculated: key };
    case "installment":
      return { ...p, installment: installmentAmount(p.principal, p.annualRate, p.installments), calculated: key };
    case "installments":
      return { ...p, installments: solveInstallments(p), calculated: key };
    case "principal":
      return { ...p, principal: solvePrincipal(p), calculated: key };
  }
}
