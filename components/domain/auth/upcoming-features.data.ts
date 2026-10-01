/**
 * Funzionalità in arrivo mostrate nel pannello del login. Nomi e descrizioni vengono dal catalogo condiviso
 * (`lib/features`, lo stesso della landing): qui si aggiunge solo l'icona. Quando una schermata viene implementata
 * si cambia lo stato nel catalogo e si toglie l'icona da `UPCOMING_ICONS`.
 */

import { BarChart3, Target, Umbrella, type LucideIcon } from "lucide-react";

import { featuresByStatus } from "@/lib/features";

export interface UpcomingFeature {
  name: string;
  description: string;
  icon: LucideIcon;
}

/** Icona di ogni funzionalità `soon`, per id del catalogo. */
const UPCOMING_ICONS: Record<string, LucideIcon> = {
  pensione: Umbrella,
  pianifica: Target,
  analitiche: BarChart3,
};

/** Il pannello mostra le funzionalità `soon` che sono una schermata (hanno `appPath`), non quelle trasversali. */
export const UPCOMING_FEATURES: UpcomingFeature[] = featuresByStatus("soon")
  .filter((feature) => feature.appPath)
  .map((feature) => ({
  name: feature.name,
  description: feature.description,
  icon: UPCOMING_ICONS[feature.id] ?? Target,
}));

/** Tempo di permanenza di ciascuna funzionalità nel ticker, in millisecondi. */
export const UPCOMING_FEATURE_INTERVAL_MS = 6000;
