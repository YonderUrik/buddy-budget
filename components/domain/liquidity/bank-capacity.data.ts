import type { CapacityBlockReason } from "@/lib/gocardless/capacity";

/** Testi della scelta «Collega la tua banca» quando non è disponibile: etichetta breve e frase che indica le alternative. */
export const BANK_UNAVAILABLE_COPY: Record<CapacityBlockReason, { badge: string; description: string }> = {
  // Shown by `BankComingSoon`, with «Tienimi aggiornato», rather than as a disabled choice.
  paused: {
    badge: "In arrivo",
    description: "Saldi e movimenti che arrivano da soli dalla banca. Intanto usa un conto manuale o importa l'estratto conto.",
  },
  global_limit: {
    badge: "In arrivo",
    description: "I posti per il collegamento automatico sono finiti, ne stiamo aggiungendo altri. Intanto usa un conto manuale o importa l'estratto conto.",
  },
  provider_limit: {
    badge: "In arrivo",
    description: "I posti per il collegamento automatico sono finiti, ne stiamo aggiungendo altri. Intanto usa un conto manuale o importa l'estratto conto.",
  },
  user_limit: {
    badge: "Una per persona",
    description: "Per ora si collega una sola banca per persona. Per gli altri conti usa un conto manuale o importa l'estratto conto.",
  },
  user_attempts: {
    badge: "Più avanti",
    description: "Hai avviato troppi collegamenti questo mese, riprova più avanti. Intanto usa un conto manuale o importa l'estratto conto.",
  },
};
