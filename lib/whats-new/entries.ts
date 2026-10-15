/**
 * Novità mostrate nel riquadro della Panoramica. Elenco curato a mano: ci va solo ciò che merita una voce (una
 * funzione nuova o cambiata in modo visibile), non ogni release. Le più recenti stanno in cima.
 */

export interface WhatsNewEntry {
  /** Identificativo stabile: ricorda quale novità l'utente ha già chiuso. Mai riusarlo per un'altra voce. */
  id: string;
  /** Data della novità (AAAA-MM-GG): dopo `WHATS_NEW_MAX_AGE_DAYS` la voce smette di comparire. */
  date: string;
  title: string;
  summary: string;
  /** Dove porta il pulsante. */
  href: string;
  ctaLabel: string;
}

/** Giorni dopo i quali una novità non si mostra più, anche se non è stata chiusa. */
export const WHATS_NEW_MAX_AGE_DAYS = 45;

export const WHATS_NEW_ENTRIES: readonly WhatsNewEntry[] = [
  {
    id: "obiettivi-di-risparmio",
    date: "2026-10-15",
    title: "Obiettivi di risparmio",
    summary:
      "Dai un nome ai tuoi risparmi: un viaggio, la casa, un fondo per gli imprevisti. Scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi, se il risparmio basta per tutto e cosa cambia per il traguardo.",
    href: "/analitiche/obiettivi?nuovo=1&da=novita",
    ctaLabel: "Crea un obiettivo",
  },
  {
    id: "categorizza-con-ai",
    date: "2026-10-11",
    title: "Categorizza con l'AI",
    summary:
      "Per ogni esercente l'assistente propone una categoria e tu confermi con un gesto, una carta alla volta. Si attiva in Impostazioni e non applica mai nulla da solo.",
    href: "/categorizza",
    ctaLabel: "Apri Categorizza",
  },
];
