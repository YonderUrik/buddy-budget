import "server-only";
import { requestLogger } from "@/lib/observability";
import type { VisitState } from "./visit";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Logs `app.visit.started` with how many days the user was away (one decimal), when a heartbeat started a visit. */
export function logVisitStart(touch: { state: VisitState; newVisit: boolean }, trigger: "heartbeat" | "welcome"): void {
  if (!touch.newVisit) return;
  const { visitSinceAt, visitStartedAt } = touch.state;
  const ageDays = visitSinceAt && visitStartedAt ? Math.round(((visitStartedAt.getTime() - visitSinceAt.getTime()) / DAY_MS) * 10) / 10 : undefined;
  requestLogger().info("app.visit.started", { trigger, ...(ageDays !== undefined ? { ageDays } : { reason: "first_visit" }) });
}
