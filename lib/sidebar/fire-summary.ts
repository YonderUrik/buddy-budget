import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { SidebarFire } from "./types";

/** Ritaglia dal piano di Analitiche le sole cifre che servono alla sidebar. Pura. */
export function toSidebarFire(plan: AnalyticsPlan, currency: string): SidebarFire {
  return { currency, wealth: plan.wealth, target: plan.target, progress: plan.progress, yearsToFire: plan.yearsToFire };
}
