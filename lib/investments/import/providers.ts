import { looksLikeTradeRepublic } from "./trade-republic";
import { looksLikeDegiro } from "./degiro";
import { looksLikeFineco } from "./fineco";
import { parseCsv } from "./csv";
import { detectPreset } from "./presets";

/** Sorgente di un file di import scelta dall'utente (o riconosciuta dal contenuto). */
export type ImportProviderId = "interactive-brokers" | "degiro" | "yahoo-portfolio" | "trade-republic" | "fineco" | "generic";

/** Scheda di un provider nel primo passo dell'import. */
export interface ImportProviderInfo {
  id: ImportProviderId;
  name: string;
  /** Sigla del badge neutro, usata finché non c'è un logo con licenza (`logoSrc`). */
  initials: string;
  /** Una riga su cosa si carica. */
  tagline: string;
  /** Passi numerati per ottenere il file dal provider (mostrati dopo aver scelto la scheda). */
  exportSteps: string[];
  /** Cosa importiamo e cosa no, in una o due frasi. */
  note: string;
  /** Nome del file che ci si aspetta di caricare, se il provider ne usa uno fisso. */
  fileLabel?: string;
  /** Percorso di un logo in `public/`, solo se ne abbiamo il permesso d'uso. */
  logoSrc?: string;
}

export const IMPORT_PROVIDERS: ImportProviderInfo[] = [
  {
    id: "trade-republic",
    name: "Trade Republic",
    initials: "TR",
    logoSrc: "/import-providers/trade-republic.svg",
    tagline: "Investimenti e pagamenti con carta",
    fileLabel: "Transaction export.csv",
    exportSteps: [
      "Scarica da Trade Republic l'esportazione delle transazioni: il file si chiama «Transaction export.csv».",
      "Scegli lo storico completo del conto principale, non solo l'ultimo periodo.",
      "Caricalo qui sotto così com'è, senza aprirlo e risalvarlo con Excel.",
    ],
    note: "Importo investimenti, pagamenti con carta, bonifici, interessi e bonus. Il saldo è calcolato dai movimenti partendo da zero: il file non contiene un saldo certificato né il numero del conto. Usa questa fonte per un solo conto Trade Republic e aggiorna sempre con lo storico completo.",
  },
  {
    id: "degiro",
    name: "DEGIRO",
    initials: "DG",
    logoSrc: "/import-providers/degiro.svg",
    tagline: "Estratto conto Account.csv",
    fileLabel: "Account.csv",
    exportSteps: [
      "Accedi a DEGIRO dal sito, con la lingua impostata su italiano.",
      "Apri Attività → Estratto conto e scegli il periodo più ampio possibile.",
      "Premi Esporta, scegli CSV e carica qui il file «Account.csv».",
    ],
    note: "Include movimenti, commissioni e cambi. Il file non contiene una valutazione del portafoglio né il numero del conto: usa questa fonte per un solo conto DEGIRO.",
  },
  {
    id: "fineco",
    name: "Fineco",
    initials: "FB",
    // Logo fornito dal proprietario del progetto; il marchio resta di FinecoBank, usato solo per indicare la fonte del file.
    logoSrc: "/import-providers/fineco.png",
    tagline: "Movimenti Dossier Titoli (Excel)",
    fileLabel: "File Excel (.xlsx)",
    exportSteps: [
      "In FinecoX apri il dossier titoli e vai su Movimenti.",
      "Cerca il periodo che ti serve ed esporta in Excel (.xlsx).",
      "Carica qui il file Excel scaricato.",
    ],
    note: "Importo acquisti, vendite e, se presenti, dividendi e cedole. Il file non ha il saldo né le posizioni, quindi la liquidità non cambia. Uso «Data operazione», non la data valuta.",
  },
  {
    id: "interactive-brokers",
    name: "Interactive Brokers",
    initials: "IB",
    // Simbolo fornito dal proprietario del progetto; il marchio resta di Interactive Brokers, usato solo per indicare la fonte del file.
    logoSrc: "/import-providers/interactive-brokers.svg",
    tagline: "Activity Statement in CSV",
    fileLabel: "Activity Statement (.csv)",
    exportSteps: [
      "Nel portale apri Rendiconti → Rendiconti di attività (Activity Statement).",
      "Scegli Annuale o Personalizzato, con il periodo che ti serve.",
      "Come formato scegli CSV e come lingua inglese, poi carica il file qui.",
    ],
    note: "Puoi caricare più rendiconti insieme: li ordino per conto e periodo e salto quelli già importati.",
  },
  {
    id: "yahoo-portfolio",
    name: "Yahoo Finance",
    initials: "YF",
    // Wordmark da SVG Logos (CC0 sulla raccolta; il marchio resta di Yahoo, usato solo per indicare la fonte del file).
    logoSrc: "/import-providers/yahoo.svg",
    tagline: "Export del portafoglio",
    fileLabel: "File CSV",
    exportSteps: [
      "Su Yahoo Finance apri il tuo portafoglio.",
      "Premi Altro (⋯) → Esporta portafoglio.",
      "Carica qui il CSV scaricato.",
    ],
    note: "I simboli di Yahoo sono già quelli delle quotazioni, quindi gli strumenti si abbinano da soli. Controlla l'anteprima prima di confermare.",
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
  if (looksLikeFineco(text)) return "fineco";
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
