import { addDaysIso } from "@/lib/debts/dates";
import { GOAL_DEADLINE_LEAD_DAYS } from "@/lib/goals/constants";
import type { GoalStatus } from "@/lib/goals/plan";
import type { GoalView, GoalsView } from "@/lib/goals/view";
import { GOAL_REMINDER_MAX_DAY } from "./constants";
import { romeDate } from "./dates";

/**
 * Promemoria sugli obiettivi di risparmio: cosa dire oggi a un utente con la vista dei suoi obiettivi. Puro: niente
 * database né invio, le chiavi servono alla deduplica del registro delle email.
 */

/** Riga di un obiettivo come serve alle email: niente id, solo ciò che si legge. */
export interface GoalEmailRow {
  name: string;
  current: number;
  target: number;
  status: GoalStatus;
  /** AAAA-MM o null. */
  etaMonth: string | null;
  targetDate: string | null;
  required: number | null;
  funded: number;
}

export type GoalAlert =
  | { type: "raggiunto"; itemKey: string; goal: GoalEmailRow }
  | { type: "scadenza"; itemKey: string; goal: GoalEmailRow };

export interface GoalNotice {
  alerts: GoalAlert[];
  /** Promemoria del mese con tutti gli obiettivi aperti; null se oggi non tocca o è già partito. */
  reminder: { itemKey: string; goals: GoalEmailRow[]; capacity: number | null; gap: number } | null;
  /** Tutte le chiavi da segnare se l'email parte. */
  keys: string[];
}

function toRow(goal: GoalView): GoalEmailRow {
  return {
    name: goal.name,
    current: goal.current,
    target: goal.target,
    status: goal.status,
    etaMonth: goal.etaMonth,
    targetDate: goal.targetDate,
    required: goal.required,
    funded: goal.funded,
  };
}

/** Chiave del promemoria di un mese. */
export function goalReminderKey(year: number, month: number): string {
  return `goals:reminder:${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Avvisi del giorno: un obiettivo che ha tutti i soldi ma non è ancora segnato come raggiunto, un obiettivo con la data
 * entro `GOAL_DEADLINE_LEAD_DAYS` giorni che non ci arriva, e nei primi giorni del mese il promemoria con tutti.
 */
export function findGoalNotice(input: { view: GoalsView; alreadySent: ReadonlySet<string>; now: Date }): GoalNotice {
  const { view, alreadySent, now } = input;
  const today = romeDate(now);
  const limit = addDaysIso(today.iso, GOAL_DEADLINE_LEAD_DAYS);
  const alerts: GoalAlert[] = [];
  for (const goal of view.goals) {
    if (goal.achievedAt) continue;
    if (goal.status === "raggiunto") {
      const itemKey = `goal:${goal.id}:raggiunto`;
      if (!alreadySent.has(itemKey)) alerts.push({ type: "raggiunto", itemKey, goal: toRow(goal) });
      continue;
    }
    if (goal.targetDate && goal.targetDate >= today.iso.slice(0, 7) + "-01" && goal.targetDate <= limit && goal.status !== "in_linea") {
      const itemKey = `goal:${goal.id}:scadenza:${goal.targetDate}`;
      if (!alreadySent.has(itemKey)) alerts.push({ type: "scadenza", itemKey, goal: toRow(goal) });
    }
  }
  const open = view.goals.filter((g) => !g.achievedAt && g.status !== "raggiunto");
  const reminderKey = goalReminderKey(today.year, today.month);
  const reminder =
    today.day <= GOAL_REMINDER_MAX_DAY && open.length > 0 && !alreadySent.has(reminderKey)
      ? { itemKey: reminderKey, goals: open.map(toRow), capacity: view.capacity, gap: view.gap }
      : null;
  return { alerts, reminder, keys: [...alerts.map((a) => a.itemKey), ...(reminder ? [reminder.itemKey] : [])] };
}

/** Riassunto degli obiettivi per il riepilogo periodico; null senza obiettivi aperti. */
export interface GoalsDigest {
  open: number;
  late: number;
  /** Quello più vicino alla meta. */
  nearest: { name: string; current: number; target: number } | null;
}

/** Riassunto per il riepilogo periodico. Puro. */
export function buildGoalsDigest(view: GoalsView): GoalsDigest | null {
  const open = view.goals.filter((g) => !g.achievedAt && g.status !== "raggiunto");
  if (open.length === 0) return null;
  const nearest = [...open].sort((a, b) => b.progress - a.progress)[0];
  return {
    open: open.length,
    late: open.filter((g) => g.status === "in_ritardo").length,
    nearest: nearest ? { name: nearest.name, current: nearest.current, target: nearest.target } : null,
  };
}
