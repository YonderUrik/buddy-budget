/**
 * Regole italiane già calcolate (home «Sei domande», `llms.txt`) e i nomi delle icone usate nelle sezioni. Nati con la
 * landing del 2026-10-09. Solo fatti verificabili nel prodotto: niente numeri di utenti, recensioni o promesse.
 */
import { CONTENT_PATHS, SOURCES, type Source } from "./seo-pages";

/** Icone disponibili per le sezioni (stessa libreria dell'app: lucide). Il componente traduce il nome in icona. */
export type HomeIcon =
  | "gift" | "server" | "landmark" | "download" | "code"
  | "link" | "dashboard" | "calculator"
  | "backpack" | "scale" | "stamp" | "landmark-gov" | "umbrella" | "house"
  | "wallet" | "trending" | "card" | "user" | "shield" | "pie"
  | "key" | "eye" | "ban" | "sliders" | "file-text" | "database" | "pencil" | "chart"
  | "candles" | "layers" | "bitcoin" | "car" | "spreadsheet";

export interface ItalyRule {
  icon: HomeIcon;
  /** La regola, come la trovi scritta nelle guide. */
  rule: string;
  /** Cosa fa BuddyBudget con quella regola. */
  app: string;
  link?: { href: string; label: string };
  source?: Source;
}

/** Regole fiscali e bancarie italiane già calcolate dall'app. Le fonti sono le stesse delle pagine guida (`SOURCES`). */
export const ITALY = {
  kicker: "Fatto per l'Italia",
  title: "Le regole italiane, già nei conti.",
  lede: "Perdite da scalare, aliquote, bollo, TFR: cose che un'app fatta per un altro paese non conosce. Qui sono già nei conti, come stime per decidere.",
  rules: [
    {
      icon: "backpack",
      rule: "Le perdite si possono scalare dai guadagni per quattro anni.",
      app: "Tiene il conto delle perdite anno per anno (lo «zainetto fiscale») e ti dice quanto scade e quando.",
      link: { href: CONTENT_PATHS.zainetto, label: "Calcolatore dello zainetto" },
      source: SOURCES.tuir68,
    },
    {
      icon: "scale",
      rule: "I guadagni degli ETF non si possono compensare con le perdite.",
      app: "Tiene separati i due tipi di guadagno, così non ti promette sconti che non esistono.",
      link: { href: CONTENT_PATHS.guidaZainetto, label: "La guida, con esempi" },
      source: SOURCES.quadroRt,
    },
    {
      icon: "landmark-gov",
      rule: "I titoli di Stato pagano il 12,5%, il resto il 26%.",
      app: "Applica la tassa giusta a ogni operazione, BTP compresi.",
      source: SOURCES.circolare19e,
    },
    {
      icon: "stamp",
      rule: "Ogni anno si paga l'imposta di bollo sul deposito titoli.",
      app: "La stima sul valore del portafoglio, insieme alle tasse se vendessi oggi.",
    },
    {
      icon: "umbrella",
      rule: "Fondo pensione e TFR in azienda hanno tasse diverse.",
      app: "Confronta gli stessi versamenti nei due casi e stima quanto ti resterebbe prelevando oggi.",
    },
    {
      icon: "house",
      rule: "Il mutuo per la casa si può chiudere in anticipo senza penali.",
      app: "Prova a rimborsare una parte: rata più bassa o durata più corta, e quanto risparmi di interessi.",
      link: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore della rata" },
      source: SOURCES.guidaMutuo,
    },
  ] satisfies readonly ItalyRule[],
} as const;
