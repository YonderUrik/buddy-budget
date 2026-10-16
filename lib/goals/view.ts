import { addMonthsKey, buildGoalsPlan, type FireInput, type GoalPlanRow, type GoalsPlan } from "./plan";
import type { GoalKind } from "./constants";
import type { EssentialSpending } from "./essential";
import type { InstrumentType } from "@/lib/db/schema/investments";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";

/**
 * Vista degli obiettivi: dalle righe salvate (obiettivi e parti di conti e titoli) e dalla fotografia delle Analitiche
 * ricava quanto vale oggi ogni obiettivo, le parti ancora libere e il piano del risparmio. Pura: niente database.
 */

/** Obiettivo come esce dal database, con gli importi già numerici. */
export interface GoalRecord {
  id: string;
  name: string;
  kind: GoalKind;
  target: number;
  targetDate: string | null;
  monthly: number;
  priority: number;
  achievedAt: string | null;
  createdAt: string;
}

/** Parte di un conto o di un titolo assegnata a un obiettivo. */
export interface GoalSourceRecord {
  id: string;
  goalId: string;
  accountId: string | null;
  instrumentId: string | null;
  amount: number;
}

/** Conto disponibile come fonte. */
export interface SourceAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  /** Colore e icona scelti per il conto, per disegnarlo come in Liquidità. */
  color?: AccountColor;
  icon?: AccountIcon;
}

/** Come disegnare una fonte: l'avatar del conto o l'icona (con logo) del titolo. */
export interface SourceLook {
  accountColor: AccountColor | null;
  accountIcon: AccountIcon | null;
  instrumentType: InstrumentType | null;
}

/** Posizione d'investimento disponibile come fonte, con quanto se ne andrebbe in imposte vendendola. */
export interface SourcePosition {
  id: string;
  name: string;
  value: number;
  unrealizedGain: number;
  taxRate: number;
  type?: InstrumentType;
}

export type GoalSourceKind = "account" | "instrument";

export interface GoalSourceView extends SourceLook {
  id: string;
  kind: GoalSourceKind;
  /** Id del conto o del titolo. */
  refId: string;
  name: string;
  /** Importo assegnato dall'utente. */
  amount: number;
  /** Quanto conta oggi: limitato da saldo o valore, e per i titoli al netto dell'imposta stimata sulla vendita. */
  counted: number;
  /** Imposta stimata vendendo la parte assegnata (0 per i conti). */
  tax: number;
  /** Saldo del conto o valore della posizione. */
  total: number;
  /** True se il conto o la posizione non c'è più o vale meno di quanto assegnato. */
  short: boolean;
}

export interface GoalView extends Omit<GoalPlanRow, "id"> {
  id: string;
  name: string;
  kind: GoalKind;
  target: number;
  targetDate: string | null;
  monthly: number;
  priority: number;
  achievedAt: string | null;
  createdAt: string;
  sources: GoalSourceView[];
}

/** Parte libera di un conto o di una posizione: quello che nessun obiettivo ha ancora preso. */
export interface FreeSource extends SourceLook {
  kind: GoalSourceKind;
  id: string;
  name: string;
  total: number;
  free: number;
  /** Solo per i titoli: imposta per euro venduto (plusvalenza / valore × aliquota). */
  taxPerEuro: number;
}

export interface GoalsView {
  currency: string;
  /** Oggi (AAAA-MM-GG) per il server: le date del piano partono da qui. */
  todayKey: string;
  capacity: number | null;
  requested: number;
  allocated: number;
  gap: number;
  goals: GoalView[];
  /** Il traguardo delle Analitiche come ultimo obiettivo; null se mancano spesa o risparmio. */
  fire: {
    target: number;
    wealth: number;
    progress: number;
    /** Anno di arrivo senza obiettivi e con gli obiettivi; null oltre l'orizzonte. */
    baseYear: number | null;
    withGoalsYear: number | null;
  } | null;
  sources: FreeSource[];
  /** Spese del mese (base del fondo di emergenza proposto); null se non ci sono uscite. */
  essentialMonthly: number | null;
  /** Da dove viene `essentialMonthly`: solo le spese dovute o tutte (troppe senza categoria). */
  essentialBasis: EssentialSpending["basis"] | null;
  debtsTotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function taxPerEuro(p: SourcePosition): number {
  return p.value > 0 && p.unrealizedGain > 0 ? (p.unrealizedGain / p.value) * p.taxRate : 0;
}

function lookOf(account: SourceAccount | undefined, position: SourcePosition | undefined): SourceLook {
  return { accountColor: account?.color ?? null, accountIcon: account?.icon ?? null, instrumentType: position?.type ?? null };
}

/** Anno in cui cade il mese `months` dopo oggi. */
function yearAfter(todayKey: string, months: number | null): number | null {
  return months === null ? null : Number(addMonthsKey(todayKey, months).slice(0, 4));
}

/** Costruisce la vista. `goals` va passato in qualunque ordine: si ordina per priorità e data di creazione. */
export function buildGoalsView(input: {
  currency: string;
  todayKey: string;
  goals: GoalRecord[];
  sources: GoalSourceRecord[];
  accounts: SourceAccount[];
  positions: SourcePosition[];
  capacity: number | null;
  fire: FireInput | null;
  essential: EssentialSpending | null;
  debtsTotal: number;
}): GoalsView {
  const ordered = [...input.goals].sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
  const accounts = new Map(input.accounts.map((a) => [a.id, a]));
  const positions = new Map(input.positions.map((p) => [p.id, p]));
  // Quanto resta di ogni conto e posizione: chi sta più in alto nella lista prende per primo.
  const left = new Map<string, number>();
  for (const a of input.accounts) left.set(`account:${a.id}`, Math.max(0, a.balance));
  for (const p of input.positions) left.set(`instrument:${p.id}`, Math.max(0, p.value));

  const sourcesByGoal = new Map<string, GoalSourceRecord[]>();
  for (const s of input.sources) sourcesByGoal.set(s.goalId, [...(sourcesByGoal.get(s.goalId) ?? []), s]);

  const withSources = ordered.map((goal) => {
    const sources: GoalSourceView[] = (sourcesByGoal.get(goal.id) ?? []).map((s) => {
      const kind: GoalSourceKind = s.accountId ? "account" : "instrument";
      const refId = (s.accountId ?? s.instrumentId)!;
      const key = `${kind}:${refId}`;
      const available = left.get(key) ?? 0;
      const gross = Math.min(Math.max(0, s.amount), available);
      left.set(key, available - gross);
      const account = kind === "account" ? accounts.get(refId) : undefined;
      const position = kind === "instrument" ? positions.get(refId) : undefined;
      const tax = position ? round2(gross * taxPerEuro(position)) : 0;
      return {
        id: s.id,
        kind,
        refId,
        name: account?.name ?? position?.name ?? "",
        amount: s.amount,
        counted: round2(gross - tax),
        tax,
        total: account ? account.balance : (position?.value ?? 0),
        short: gross + 0.005 < s.amount,
        ...lookOf(account, position),
      };
    });
    return { goal, sources, current: sources.reduce((sum, s) => sum + s.counted, 0) };
  });

  const plan: GoalsPlan = buildGoalsPlan({
    goals: withSources.map(({ goal, current }) => ({
      id: goal.id,
      kind: goal.kind,
      target: goal.target,
      targetDate: goal.targetDate,
      monthly: goal.monthly,
      current,
      achieved: goal.achievedAt !== null,
    })),
    capacity: input.capacity,
    today: input.todayKey,
    fire: input.fire,
  });

  const goals: GoalView[] = withSources.map(({ goal, sources }, i) => {
    return { ...plan.rows[i], ...goal, sources };
  });

  const free: FreeSource[] = [
    ...input.accounts.map((a) => ({ kind: "account" as const, id: a.id, name: a.name, total: a.balance, free: round2(left.get(`account:${a.id}`) ?? 0), taxPerEuro: 0, ...lookOf(a, undefined) })),
    ...input.positions.map((p) => ({ kind: "instrument" as const, id: p.id, name: p.name, total: p.value, free: round2(left.get(`instrument:${p.id}`) ?? 0), taxPerEuro: taxPerEuro(p), ...lookOf(undefined, p) })),
  ];

  const fire = input.fire && plan.fire
    ? {
        target: input.fire.target,
        wealth: input.fire.wealth,
        progress: input.fire.target > 0 ? input.fire.wealth / input.fire.target : 0,
        baseYear: yearAfter(input.todayKey, plan.fire.baseMonths),
        withGoalsYear: yearAfter(input.todayKey, plan.fire.withGoalsMonths),
      }
    : null;

  return {
    currency: input.currency,
    todayKey: input.todayKey,
    capacity: plan.capacity,
    requested: plan.requested,
    allocated: plan.allocated,
    gap: plan.gap,
    goals,
    fire,
    sources: free,
    essentialMonthly: input.essential ? Math.round(input.essential.monthly) : null,
    essentialBasis: input.essential?.basis ?? null,
    debtsTotal: input.debtsTotal,
  };
}
