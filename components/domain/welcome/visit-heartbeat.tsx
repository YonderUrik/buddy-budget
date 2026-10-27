"use client";

/**
 * Keeps the visit alive for «Dall'ultima visita» (heartbeat on load, on coming back to the foreground and every few
 * minutes). Renders nothing; mounted once in the app layout, outside the section transition so a section change does
 * not restart it.
 */

import { useVisitHeartbeat } from "@/lib/queries/welcome";

export function VisitHeartbeat() {
  useVisitHeartbeat();
  return null;
}
