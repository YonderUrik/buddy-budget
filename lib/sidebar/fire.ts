import "server-only";
import { loadAnalyticsSnapshot } from "@/lib/analitiche/snapshot";
import { toSidebarFire } from "./fire-summary";
import type { SidebarFire } from "./types";

/**
 * Avanzamento verso il numero FIRE per la sidebar: stessi dati e stesse ipotesi di Analitiche, così le due cifre
 * coincidono. È la query più pesante della sidebar: il client la chiede solo se il modulo è acceso e la tiene in cache.
 */
export async function loadSidebarFire(userId: string): Promise<SidebarFire> {
  const { plan, currency } = await loadAnalyticsSnapshot(userId);
  return toSidebarFire(plan, currency);
}
