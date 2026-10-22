import "server-only";
import { loadAnalyticsDigest } from "@/lib/analitiche/digest";
import type { SidebarFire } from "./types";

/**
 * Avanzamento verso il numero FIRE per la sidebar: stessi dati e stesse ipotesi di Analitiche, così le due cifre
 * coincidono. Comes from the cached Analytics digest, shared with the Goals view.
 */
export async function loadSidebarFire(userId: string): Promise<SidebarFire> {
  return (await loadAnalyticsDigest(userId)).sidebarFire;
}
