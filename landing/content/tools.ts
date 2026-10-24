/** I calcolatori aperti a tutti (`/strumenti`): gli stessi motori dell'app, senza account. Stime a scopo informativo. */
import type { RuleNeed } from "@/lib/visitor-country";
import { CONTENT_PATHS } from "./seo-pages";

export type ToolId = "zainetto" | "ammortamento" | "obiettivo";

export interface Tool {
  id: ToolId;
  name: string;
  /** Una riga: a quale domanda risponde. */
  text: string;
  href: string;
  /** Hidden from the lists for visitors whose country lacks these rules; the page stays reachable by link. */
  needs?: RuleNeed;
}

export const TOOLS: readonly Tool[] = [
  { id: "zainetto", name: "Zainetto fiscale", text: "Quante perdite puoi ancora scalare e quante tasse paghi su un guadagno.", href: CONTENT_PATHS.zainetto, needs: "taxes" },
  { id: "ammortamento", name: "Piano di ammortamento", text: "Rata, interessi totali e quanto risparmi se rimborsi una parte in anticipo.", href: CONTENT_PATHS.ammortamento },
  { id: "obiettivo", name: "Obiettivo di risparmio", text: "Quanto ci metti ad arrivare a una cifra, con quello che metti da parte ogni mese.", href: CONTENT_PATHS.obiettivo },
];

/** Testi dell'elenco dei calcolatori (`/strumenti`). */
export const TOOLS_PAGE = {
  title: "Calcolatori gratuiti: zainetto fiscale, rata e risparmio",
  description: "Tre calcolatori gratis e senza account: imposta su una plusvalenza con lo zainetto fiscale, rata di un mutuo, tempo per un obiettivo di risparmio.",
  h1: "Calcolatori",
  lead: "Gli stessi motori dell'app, aperti a tutti e senza account. Sono stime a scopo informativo, con le fonti ufficiali in fondo a ogni pagina.",
} as const;

/** Testi del calcolatore «Obiettivo di risparmio». */
export const OBIETTIVO_PAGE = {
  title: "Calcolatore obiettivo di risparmio: quanto tempo ci vuole",
  description: "Calcola in quanti mesi arrivi a una cifra con quello che hai e che metti da parte ogni mese, e quanto ti serve al mese per arrivarci entro una data.",
  h1: "Calcolatore dell'obiettivo di risparmio",
  lead: "Una cifra da raggiungere, quello che hai già e quanto metti da parte ogni mese: vedi in quanto tempo ci arrivi, e quanto servirebbe al mese per farcela entro una data.",
} as const;
