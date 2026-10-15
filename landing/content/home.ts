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
  lede: "Zainetto fiscale, aliquote, bollo, TFR: regole che un'app pensata per un altro paese non conosce. Qui entrano nei calcoli, come stime per decidere; il conteggio definitivo lo fanno l'intermediario o un professionista.",
  rules: [
    {
      icon: "backpack",
      rule: "Le minusvalenze si usano entro il quarto anno successivo.",
      app: "Tiene lo zainetto fiscale anno per anno e ti dice quanto scade e quando.",
      link: { href: CONTENT_PATHS.zainetto, label: "Calcolatore dello zainetto" },
      source: SOURCES.tuir68,
    },
    {
      icon: "scale",
      rule: "I guadagni sugli ETF armonizzati non si compensano con le perdite.",
      app: "Separa redditi di capitale e redditi diversi, così lo zainetto non promette compensazioni che non esistono.",
      link: { href: CONTENT_PATHS.guidaZainetto, label: "La guida, con esempi" },
      source: SOURCES.quadroRt,
    },
    {
      icon: "landmark-gov",
      rule: "I titoli di Stato pagano il 12,5%, il resto il 26%.",
      app: "Applica l'aliquota giusta a ogni operazione, BTP compresi.",
      source: SOURCES.circolare19e,
    },
    {
      icon: "stamp",
      rule: "Ogni anno si paga l'imposta di bollo sul deposito titoli.",
      app: "La stima sul valore del portafoglio, insieme all'imposta che pagheresti vendendo oggi.",
    },
    {
      icon: "umbrella",
      rule: "Fondo pensione e TFR in azienda hanno tasse diverse.",
      app: "Confronta gli stessi versamenti nei due casi e stima cosa ti resterebbe prelevando oggi.",
    },
    {
      icon: "house",
      rule: "Il mutuo per la casa si può estinguere in anticipo senza penali.",
      app: "Simula l'estinzione parziale: rata più bassa o durata più corta, e quanto risparmi di interessi.",
      link: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore della rata" },
      source: SOURCES.guidaMutuo,
    },
  ] satisfies readonly ItalyRule[],
} as const;
