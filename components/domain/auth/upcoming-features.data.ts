/**
 * Funzionalità in arrivo mostrate nella scheda «In arrivo» del foglio di accesso. Nomi e descrizioni vengono dal
 * catalogo condiviso (`lib/features`, lo stesso della landing): quando una schermata viene implementata basta
 * cambiarne lo stato nel catalogo.
 */

import { featuresByStatus } from "@/lib/features";

export interface UpcomingFeature {
  name: string;
  description: string;
}

/** Solo le funzionalità `soon` che sono una schermata (hanno `appPath`), non quelle trasversali. */
export const UPCOMING_FEATURES: UpcomingFeature[] = featuresByStatus("soon")
  .filter((feature) => feature.appPath)
  .map((feature) => ({ name: feature.name, description: feature.description }));
