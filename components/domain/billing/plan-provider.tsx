"use client";

import * as React from "react";
import { OPEN_PLAN, type PlanView } from "@/lib/billing";

const PlanContext = React.createContext<PlanView>(OPEN_PLAN);

/** Plan of the signed-in account, resolved on the server by the app layout (no request from the browser). */
export function PlanProvider({ plan, children }: { plan: PlanView; children: React.ReactNode }) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

/** Plan of the signed-in account; everything open outside the app layout. */
export function usePlan(): PlanView {
  return React.useContext(PlanContext);
}
