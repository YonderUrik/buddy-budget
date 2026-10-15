import { DEFAULT_EMERGENCY_MONTHS, MAX_GOAL_SOURCES, type GoalKind } from "@/lib/goals/constants";
import { monthsBetween } from "@/lib/goals/plan";
import type { FreeSource, GoalView, GoalsView } from "@/lib/goals/view";
import type { GoalPayload } from "@/lib/queries/goals";
import { GOAL_KIND_INFO } from "./goal-kinds";

/** Passi del form, in ordine. */
export const GOAL_FORM_STEPS = ["tipo", "quanto", "fonti", "ritmo", "riepilogo"] as const;
export type GoalFormStep = (typeof GOAL_FORM_STEPS)[number];

/** Bozza del form: tutto quello che l'utente sceglie, prima di salvare. */
export interface GoalDraft {
  kind: GoalKind | null;
  name: string;
  target: number | null;
  /** Mesi di spese coperti (solo fondo di emergenza); null = cifra scritta a mano. */
  emergencyMonths: number | null;
  /** AAAA-MM o null. */
  targetMonth: string | null;
  monthly: number | null;
  /** Parti assegnate per chiave `account:id` / `instrument:id`. */
  sources: Record<string, number>;
  /** Posizione nella lista (0 = per primo). */
  priority: number;
}

/** Chiave di una fonte nella bozza. */
export const sourceKey = (kind: FreeSource["kind"], id: string) => `${kind}:${id}`;

/** Bozza vuota (nuovo obiettivo, in fondo alla lista) o ricavata da un obiettivo esistente. */
export function initialDraft(goal: GoalView | null, goalsCount: number): GoalDraft {
  if (!goal) return { kind: null, name: "", target: null, emergencyMonths: null, targetMonth: null, monthly: null, sources: {}, priority: goalsCount };
  return {
    kind: goal.kind,
    name: goal.name,
    target: goal.target,
    emergencyMonths: null,
    targetMonth: goal.targetDate ? goal.targetDate.slice(0, 7) : null,
    monthly: goal.monthly,
    sources: Object.fromEntries(goal.sources.map((s) => [sourceKey(s.kind, s.refId), s.amount])),
    priority: goal.priority,
  };
}

/** Cambia il tipo: propone il nome del tipo se l'utente non ne ha scritto uno suo, e per l'emergenza i mesi di spese. */
export function withKind(draft: GoalDraft, kind: GoalKind, essentialMonthly: number | null): GoalDraft {
  const previousDefault = draft.kind ? GOAL_KIND_INFO[draft.kind].defaultName : "";
  const name = draft.name.trim() === "" || draft.name === previousDefault ? GOAL_KIND_INFO[kind].defaultName : draft.name;
  if (kind === "emergenza" && essentialMonthly !== null && draft.target === null) {
    return { ...draft, kind, name, emergencyMonths: DEFAULT_EMERGENCY_MONTHS, target: emergencyTarget(essentialMonthly, DEFAULT_EMERGENCY_MONTHS) };
  }
  return { ...draft, kind, name, emergencyMonths: kind === "emergenza" ? draft.emergencyMonths : null };
}

/** Cifra del fondo di emergenza: mesi di spese dovute, arrotondata alle centinaia. */
export function emergencyTarget(essentialMonthly: number, months: number): number {
  return Math.round((essentialMonthly * months) / 100) * 100;
}

/** Fonti che si possono scegliere, con la parte libera vista da questo obiettivo (la sua parte di oggi torna disponibile). */
export function availableSources(view: GoalsView, goal: GoalView | null): FreeSource[] {
  const own = new Map((goal?.sources ?? []).map((s) => [sourceKey(s.kind, s.refId), s.counted + s.tax]));
  return view.sources
    .map((s) => ({ ...s, free: s.free + (own.get(sourceKey(s.kind, s.id)) ?? 0) }))
    .filter((s) => s.total > 0 || own.has(sourceKey(s.kind, s.id)));
}

/** Somma assegnata nella bozza (lordo, prima dell'imposta stimata sui titoli). */
export function assignedTotal(draft: GoalDraft): number {
  return Object.values(draft.sources).reduce((sum, v) => sum + v, 0);
}

/** True se i soldi già assegnati bastano: la quota del mese può restare vuota (vale zero). */
export function isCovered(draft: GoalDraft): boolean {
  return draft.target !== null && draft.target > 0 && assignedTotal(draft) >= draft.target;
}

/** Quota al mese che serve per arrivare in tempo partendo da quanto è già assegnato; null senza data. */
export function requiredMonthly(draft: GoalDraft, todayKey: string): number | null {
  if (!draft.targetMonth || draft.target === null) return null;
  const left = Math.max(0, draft.target - assignedTotal(draft));
  return Math.ceil(left / Math.max(1, monthsBetween(todayKey, draft.targetMonth)));
}

/** True se il passo è completo e si può andare avanti. */
export function canAdvance(step: GoalFormStep, draft: GoalDraft, todayKey: string): boolean {
  switch (step) {
    case "tipo":
      return draft.kind !== null && draft.name.trim().length > 0 && draft.name.trim().length <= 80;
    case "quanto":
      return draft.target !== null && draft.target > 0 && (draft.targetMonth === null || draft.targetMonth > todayKey.slice(0, 7));
    case "fonti":
      return Object.keys(draft.sources).length <= MAX_GOAL_SOURCES && Object.values(draft.sources).every((v) => v > 0);
    case "ritmo":
      return (draft.monthly !== null && draft.monthly >= 0) || isCovered(draft);
    case "riepilogo":
      return true;
  }
}

/** Bozza pronta per l'API. */
export function toPayload(draft: GoalDraft): GoalPayload {
  return {
    name: draft.name.trim(),
    kind: draft.kind!,
    targetAmount: draft.target ?? 0,
    targetDate: draft.targetMonth ? `${draft.targetMonth}-01` : null,
    monthlyAmount: draft.monthly ?? 0,
    priority: draft.priority,
    sources: Object.entries(draft.sources).map(([key, amount]) => {
      const [kind, id] = key.split(":");
      return kind === "account" ? { accountId: id, amount } : { instrumentId: id, amount };
    }),
  };
}
