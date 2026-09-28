/**
 * Ultima funzionalità rilasciata, annunciata nel pannello del login sopra "In arrivo". Quando ne esce una nuova si
 * sostituisce questa voce (e la si toglie da `upcoming-features.data.ts`, se era lì).
 */

import { TrendingUp } from "lucide-react";
import type { UpcomingFeature } from "./upcoming-features.data";

/** Funzionalità appena uscita: come quelle in arrivo, più una frase corta per gli schermi bassi. */
export interface NewFeature extends UpcomingFeature {
  summary: string;
}

export const LATEST_FEATURE: NewFeature = {
  name: "Investimenti",
  description: "ETF, azioni, BTP e crypto con i prezzi di chiusura di ogni sera, dentro il tuo patrimonio netto.",
  summary: "Il tuo portafoglio, aggiornato ogni sera.",
  icon: TrendingUp,
};
