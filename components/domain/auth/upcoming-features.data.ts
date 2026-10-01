/**
 * Funzionalità in arrivo mostrate nel pannello del login. Descrizioni allineate a `docs/functional-spec.md`
 * (sezioni 5-9): quando una di queste schermate viene implementata, va rimossa da qui.
 */

import { BarChart3, Target, Umbrella, type LucideIcon } from "lucide-react";

export interface UpcomingFeature {
  name: string;
  description: string;
  icon: LucideIcon;
}

export const UPCOMING_FEATURES: UpcomingFeature[] = [
  {
    name: "Pensione",
    description: "Il tuo fondo pensione e una stima di quanto varrà.",
    icon: Umbrella,
  },
  {
    name: "Pianifica",
    description: "Simula un cambio di lavoro, una casa o un figlio e vedi l'effetto sul patrimonio.",
    icon: Target,
  },
  {
    name: "Analitiche",
    description: "Autonomia finanziaria, tasso di risparmio reale e radar degli abbonamenti.",
    icon: BarChart3,
  },
];

/** Tempo di permanenza di ciascuna funzionalità nel ticker, in millisecondi. */
export const UPCOMING_FEATURE_INTERVAL_MS = 6000;
