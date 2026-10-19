"use client";

/** Mounted once in the app layout: keeps the visit alive so «Dall'ultima visita» knows when the user was last here. */

import { useVisitHeartbeat } from "@/lib/queries/welcome";

export function VisitHeartbeat() {
  useVisitHeartbeat();
  return null;
}
