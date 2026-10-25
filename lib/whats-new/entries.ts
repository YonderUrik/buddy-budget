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
    id: "cerca-ovunque",
    date: "2026-10-25",
    title: "Cerca, da ovunque",
    summary:
      "Trovi un movimento, un conto, un titolo o un'impostazione da qualsiasi pagina: ⌘K sul computer, tiri giù la pagina sul telefono. Scrivi «pagato 12 € al bar ieri» e si apre il modulo già compilato.",
    href: "/panoramica?cerca=",
    ctaLabel: "Prova «Cerca»",
  },
  {
    id: "aggiungi-da-ovunque",
    date: "2026-10-24",
    title: "Aggiungi, da ovunque",
    summary:
      "Un solo pulsante per aggiungere un movimento, un conto, un'operazione, un mutuo o un obiettivo: il + nella barra in basso sul telefono, «Aggiungi» in cima al menu sul computer. Il modulo si apre sopra la pagina in cui sei.",
    href: "/panoramica?aggiungi=1",
    ctaLabel: "Prova «Aggiungi»",
  },
  {
    id: "budget-del-mese",
    date: "2026-10-22",
    title: "Budget del mese",
    summary:
      "Nuova scheda Budget in Liquidità: quanto puoi ancora spendere e dove arriva il mese, con budget già proposti dai tuoi movimenti. Per le spese saltuarie quello che non spendi resta per i mesi dopo.",
    href: "/liquidita/budget",
    ctaLabel: "Apri i budget",
  },
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
