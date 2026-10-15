import { GOAL_HORIZON_MONTHS, KEPT_GOAL_KINDS, type GoalKind } from "./constants";

/**
 * Piano del risparmio: il risparmio del mese va agli obiettivi in ordine di priorità, ognuno fino alla quota che
 * l'utente ha scelto; da lì si ricavano la data di arrivo, lo stato e di quanto ogni obiettivo sposta il giorno in cui
 * il patrimonio raggiunge il numero FIRE. Modulo puro: stessi input, stessi numeri.
 */

/** Un obiettivo come entra nel piano, già in ordine di priorità. */
export interface GoalPlanInput {
  id: string;
  kind: GoalKind;
  target: number;
  /** AAAA-MM-GG (si guarda solo il mese); null = nessuna data. */
  targetDate: string | null;
  /** Quota mensile scelta dall'utente. */
  monthly: number;
  /** Valore di oggi delle parti di conti e titoli assegnate. */
  current: number;
  /** Segnato come raggiunto: esce dal piano. */
  achieved: boolean;
}

/** Dati per il confronto con il traguardo delle Analitiche; null se mancano spesa o risparmio. */
export interface FireInput {
  wealth: number;
  annualSavings: number;
  /** Rendimento reale annuo atteso (0,04 = 4%). */
  realReturn: number;
  target: number;
}

/**
 * `raggiunto`: segnato o con i soldi già tutti assegnati. `in_linea`: arriva entro la data. `in_ritardo`: al ritmo di
 * oggi arriva dopo la data. `senza_data`: arriva quando arriva. `fermo`: questo mese non riceve niente.
 */
export type GoalStatus = "raggiunto" | "in_linea" | "in_ritardo" | "senza_data" | "fermo";

export interface GoalPlanRow {
  id: string;
  current: number;
  /** current / target, tra 0 e 1. */
  progress: number;
  remaining: number;
  /** Quanto riceve davvero ogni mese dopo gli obiettivi più in alto. */
  funded: number;
  /** Quota mensile che servirebbe per arrivare entro la data (null senza data o se già raggiunto). */
  required: number | null;
  /** Mese di arrivo (AAAA-MM) al ritmo di `funded`, senza contare la crescita; null se fermo o raggiunto. */
  etaMonth: string | null;
  monthsToGo: number | null;
  status: GoalStatus;
  /** Mesi di cui l'obiettivo sposta il traguardo FIRE (positivo = dopo); null se non calcolabile. */
  fireShiftMonths: number | null;
}

export interface GoalsPlan {
  /** Risparmio medio del mese (dalle Analitiche); null se non si sa. */
  capacity: number | null;
  /** Somma delle quote scelte per gli obiettivi ancora aperti. */
  requested: number;
  /** Somma di quanto ricevono davvero. */
  allocated: number;
  /** Quanto manca ogni mese per dare a tutti la loro quota (0 se basta). */
  gap: number;
  rows: GoalPlanRow[];
  /** Mesi al traguardo FIRE senza obiettivi e con tutti gli obiettivi; null se non calcolabile. */
  fire: { baseMonths: number | null; withGoalsMonths: number | null } | null;
}

/** Mesi interi tra il mese di `from` e quello di `to` (AAAA-MM-GG o AAAA-MM). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

/** Mese (AAAA-MM) che cade `months` mesi dopo quello di `from`. */
export function addMonthsKey(from: string, months: number): string {
  const [y, m] = from.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Mesi perché il patrimonio arrivi a `target`, togliendo le uscite indicate (mese → importo); null oltre l'orizzonte. */
export function monthsToFire(fire: FireInput, withdrawals: ReadonlyMap<number, number> = new Map()): number | null {
  if (fire.wealth >= fire.target && withdrawals.size === 0) return 0;
  const monthlyReturn = Math.pow(1 + fire.realReturn, 1 / 12) - 1;
  const monthlySaving = fire.annualSavings / 12;
  let wealth = fire.wealth;
  for (let month = 1; month <= GOAL_HORIZON_MONTHS; month += 1) {
    wealth = wealth * (1 + monthlyReturn) + monthlySaving - (withdrawals.get(month) ?? 0);
    if (wealth >= fire.target) return month;
  }
  return null;
}

/** Costruisce il piano. `goals` va passato in ordine di priorità; `today` è AAAA-MM-GG. */
export function buildGoalsPlan(input: { goals: GoalPlanInput[]; capacity: number | null; today: string; fire: FireInput | null }): GoalsPlan {
  const { goals, capacity, today, fire } = input;
  let available = capacity === null ? Number.POSITIVE_INFINITY : Math.max(0, capacity);
  let requested = 0;
  let allocated = 0;

  const rows: GoalPlanRow[] = goals.map((goal) => {
    const current = Math.max(0, goal.current);
    const remaining = Math.max(0, goal.target - current);
    const progress = goal.target > 0 ? Math.min(1, current / goal.target) : 1;
    const base = { id: goal.id, current, progress, remaining, fireShiftMonths: null };
    if (goal.achieved || remaining <= 0.005) {
      return { ...base, remaining: 0, funded: 0, required: null, etaMonth: null, monthsToGo: null, status: "raggiunto" as const };
    }
    const wanted = Math.max(0, goal.monthly);
    requested += wanted;
    const funded = Math.min(wanted, available);
    available -= funded;
    allocated += funded;

    const monthsLeft = goal.targetDate ? monthsBetween(today, goal.targetDate) : null;
    const required = monthsLeft === null ? null : remaining / Math.max(1, monthsLeft);
    const monthsToGo = funded > 0.005 ? Math.ceil(remaining / funded - 1e-9) : null;
    const etaMonth = monthsToGo === null ? null : addMonthsKey(today, monthsToGo);
    let status: GoalStatus;
    if (monthsToGo === null) status = "fermo";
    else if (monthsLeft === null) status = "senza_data";
    else status = monthsToGo <= Math.max(0, monthsLeft) ? "in_linea" : "in_ritardo";
    return { ...base, funded, required, etaMonth, monthsToGo, status };
  });

  let fireResult: GoalsPlan["fire"] = null;
  if (fire) {
    const baseMonths = monthsToFire(fire);
    const spending = goals
      .map((goal, i) => ({ goal, row: rows[i] }))
      .filter(({ goal, row }) => row.monthsToGo !== null && !KEPT_GOAL_KINDS.includes(goal.kind));
    const all = new Map<number, number>();
    for (const { goal, row } of spending) all.set(row.monthsToGo!, (all.get(row.monthsToGo!) ?? 0) + goal.target);
    const withGoalsMonths = spending.length > 0 ? monthsToFire(fire, all) : baseMonths;
    fireResult = { baseMonths, withGoalsMonths };
    if (baseMonths !== null) {
      goals.forEach((goal, i) => {
        const row = rows[i];
        if (KEPT_GOAL_KINDS.includes(goal.kind) && row.status !== "raggiunto") row.fireShiftMonths = 0;
        else if (row.monthsToGo !== null) {
          const months = monthsToFire(fire, new Map([[row.monthsToGo, goal.target]]));
          row.fireShiftMonths = months === null ? null : months - baseMonths;
        }
      });
    }
  }

  const gap = capacity === null ? 0 : Math.max(0, requested - Math.max(0, capacity));
  return { capacity, requested, allocated, gap, rows, fire: fireResult };
}
