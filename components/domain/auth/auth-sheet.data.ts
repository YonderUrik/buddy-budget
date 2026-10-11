/**
 * Schede del foglio delle pagine di accesso: cosa c'è nell'app, le ultime novità e cosa arriva. Novità e «In arrivo»
 * vengono dal catalogo condiviso (`lib/features`, lo stesso della landing), così non vanno aggiornate a mano.
 */

import { featuresByStatus } from "@/lib/features";
import { LANDING_URL } from "@/lib/legal";
import { LOGIN_AREAS } from "./login-areas.data";
import { UPCOMING_FEATURES } from "./upcoming-features.data";

export type AuthSheetTabId = "dentro" | "novita" | "in-arrivo";

export interface AuthSheetRow {
  name: string;
  text: string;
  badge?: "Nuovo" | "In arrivo";
}

export interface AuthSheetTab {
  id: AuthSheetTabId;
  /** Nome della scheda in basso, come i fogli di una cartella di lavoro. */
  label: string;
  columns: readonly [string, string];
  rows: readonly AuthSheetRow[];
  caption?: string;
  link?: { href: string; label: string };
}

/** Quante novità mostrare: le prime del catalogo, che è in ordine di area. */
const MAX_NEW_FEATURES = 4;

/** Schede del foglio; «In arrivo» c'è solo se il catalogo ha schermate pianificate. */
export function buildAuthSheetTabs(): AuthSheetTab[] {
  const tabs: AuthSheetTab[] = [
    {
      id: "dentro",
      label: "Cosa c'è dentro",
      columns: ["Area", "Cosa fa"],
      rows: LOGIN_AREAS.map((a) => ({ name: a.name, text: a.description })),
      caption: "I dati restano tuoi: la banca si collega in sola lettura (PSD2).",
    },
    {
      id: "novita",
      label: "Novità",
      columns: ["Novità", "Cosa fa"],
      rows: featuresByStatus("new").slice(0, MAX_NEW_FEATURES).map((f) => ({ name: f.name, text: f.description, badge: "Nuovo" })),
      link: { href: `${LANDING_URL}/funzioni`, label: "Tutte le funzioni" },
    },
  ];
  if (UPCOMING_FEATURES.length > 0) {
    tabs.push({
      id: "in-arrivo",
      label: "In arrivo",
      columns: ["In arrivo", "Cosa farà"],
      rows: UPCOMING_FEATURES.map((f) => ({ name: f.name, text: f.description, badge: "In arrivo" })),
    });
  }
  return tabs;
}
