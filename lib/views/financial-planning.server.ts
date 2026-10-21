import "server-only";
import type { GermanPlan } from "@/lib/financial-planning";
import { buildPlanningResults } from "./financial-planning";
import { loadInvestmentViewData } from "./investments-data.server";

/** Results of `plan` for a user, on all their investment data (the planning screen does not apply the broker filter). */
export async function loadPlanningResults(userId: string, plan: GermanPlan, today: string) {
  const { all } = await loadInvestmentViewData(userId, new Set());
  return buildPlanningResults(plan, all, today);
}
