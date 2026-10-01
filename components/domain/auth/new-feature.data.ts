/**
 * Ultima funzionalità rilasciata, annunciata nel pannello del login sopra "In arrivo". Quando ne esce una nuova si
 * sostituisce questa voce (e la si toglie da `upcoming-features.data.ts`, se era lì).
 */

import { CreditCard } from "lucide-react";
import type { UpcomingFeature } from "./upcoming-features.data";

/** Funzionalità appena uscita: come quelle in arrivo, più una frase corta per gli schermi bassi. */
export interface NewFeature extends UpcomingFeature {
  summary: string;
}

export const LATEST_FEATURE: NewFeature = {
  name: "Debiti",
  description: "Finanziamenti e mutui rata per rata: quanto paghi di interessi e quando finisci, anche se il debito è già in corso.",
  summary: "I tuoi debiti, rata per rata.",
  icon: CreditCard,
};
