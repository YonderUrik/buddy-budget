import { looksLikeTradeRepublic } from "./trade-republic";
import { looksLikeDegiro } from "./degiro";
import { parseCsv } from "./csv";
import { detectPreset } from "./presets";

/** Sorgente di un file di import scelta dall'utente (o riconosciuta dal contenuto). */
export type ImportProviderId = "interactive-brokers" | "degiro" | "yahoo-portfolio" | "trade-republic" | "generic";

/** Scheda di un provider nel primo passo dell'import. */
export interface ImportProviderInfo {
  id: ImportProviderId;
  name: string;
  /** Sigla del badge neutro, usata finché non c'è un logo con licenza (`logoSrc`). */
  initials: string;
  /** Una riga su cosa si carica. */
  tagline: string;
  /** Come ottenere il file dal provider. */
  howTo: string;
  /** Percorso di un logo in `public/`, solo se ne abbiamo il permesso d'uso. */
  logoSrc?: string;
}

export const IMPORT_PROVIDERS: ImportProviderInfo[] = [
  { id: "trade-republic", name: "Trade Republic", initials: "TR", tagline: "Investimenti e pagamenti con carta", howTo: "Carica Transaction export.csv con lo storico completo del conto principale: investimenti, carta, bonifici, interessi e bonus. Il saldo è calcolato dai movimenti partendo da zero; il file non contiene un saldo certificato né il numero del conto. Usa questa fonte per un solo conto Trade Republic e aggiorna sempre con lo storico completo." },
  { id: "degiro", name: "DEGIRO", initials: "DG", tagline: "Estratto conto Account.csv", howTo: "Da DEGIRO esporta l'estratto conto completo in CSV, in italiano. Include movimenti, commissioni e cambi. Il file non contiene una valutazione del portafoglio né il numero del conto: usa questa fonte per un solo conto DEGIRO." },
  {
    id: "interactive-brokers",
    name: "Interactive Brokers",
    initials: "IB",
    // Simbolo fornito dal proprietario del progetto; il marchio resta di Interactive Brokers, usato solo per indicare la fonte del file.
    logoSrc: "/import-providers/interactive-brokers.svg",
    tagline: "Activity Statement in CSV",
    howTo:
      "Nel portale: Rendiconti → Rendiconti di attività (Activity Statement) → Annuale o Personalizzato → formato CSV. Il file deve essere in inglese.",
  },
  {
    id: "yahoo-portfolio",
    name: "Yahoo Finance",
    initials: "YF",
    // Wordmark da SVG Logos (CC0 sulla raccolta; il marchio resta di Yahoo, usato solo per indicare la fonte del file).
    logoSrc: "/import-providers/yahoo.svg",
    tagline: "Export del portafoglio",
    howTo: "Su Yahoo Finance apri il portafoglio → Altro (⋯) → Esporta portafoglio, e carica il CSV scaricato.",
  },
  {
    id: "generic",
    name: "Altro CSV",
    initials: "CSV",
    tagline: "Broker o modello BuddyBudget",
    howTo:
      "Carica un CSV qualsiasi: al passo successivo indichi quale colonna è la data, il prezzo e così via. Puoi anche scaricare il modello da compilare.",
  },
];

/** Scheda di un provider per id. */
export function getImportProvider(id: ImportProviderId): ImportProviderInfo {
  return IMPORT_PROVIDERS.find((p) => p.id === id)!;
}

/** Un Activity Statement di Interactive Brokers inizia con la sezione `Statement` e il nome del broker. */
export function looksLikeInteractiveBrokers(text: string): boolean {
  const head = text.replace(/^﻿/, "").slice(0, 2000);
  return /^"?Statement"?,"?Header"?,/.test(head) && /Interactive Brokers/i.test(head);
}

/** Formato riconosciuto dal contenuto del file: broker conosciuto, export Yahoo, oppure null (CSV generico). */
export function detectImportProvider(text: string): Exclude<ImportProviderId, "generic"> | null {
  if (looksLikeTradeRepublic(text)) return "trade-republic";
  if (looksLikeDegiro(text)) return "degiro";
  if (looksLikeInteractiveBrokers(text)) return "interactive-brokers";
  try {
    return detectPreset(parseCsv(text).headers)?.id === "yahoo-portfolio" ? "yahoo-portfolio" : null;
  } catch {
    return null;
  }
}

/** Messaggio per un file che non corrisponde al provider scelto, o null se va bene. */
export function providerMismatchMessage(chosen: ImportProviderId, detected: ImportProviderId | null): string | null {
  if (chosen === "generic" || detected === chosen) return null;
  const name = getImportProvider(chosen).name;
  const other = detected
    ? ` Sembra invece un file di ${getImportProvider(detected).name}: scegli quella scheda.`
    : " Scegli un altro provider oppure «Altro CSV».";
  return `Questo file non sembra un export di ${name}.${other}`;
}
