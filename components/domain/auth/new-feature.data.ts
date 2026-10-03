/**
 * Ultima funzionalità rilasciata, annunciata nel pannello del login sopra "In arrivo". Quando ne esce una nuova si
 * sostituisce questa voce (e la si toglie da `upcoming-features.data.ts`, se era lì).
 */

import { Umbrella } from "lucide-react";
import type { UpcomingFeature } from "./upcoming-features.data";

/** Funzionalità appena uscita: come quelle in arrivo, più una frase corta per gli schermi bassi. */
export interface NewFeature extends UpcomingFeature {
  summary: string;
}

export const LATEST_FEATURE: NewFeature = {
  name: "Pensione",
  description: "Il tuo fondo pensione e il TFR: rendimento vero, quanto ti resterebbe prelevando oggi e quanto varrà. Importi lo storico da CSV o Excel.",
  summary: "Il tuo fondo pensione, finalmente chiaro.",
  icon: Umbrella,
};
