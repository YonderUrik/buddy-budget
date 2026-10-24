/** Shapes shared by the search API and the palette. */

export const SEARCH_GROUP_IDS = ["movimenti", "conti", "titoli", "categorie", "abbonamenti", "debiti", "obiettivi", "pensione", "pagine", "azioni"] as const;
export type SearchGroupId = (typeof SEARCH_GROUP_IDS)[number];

export type SearchIcon =
  | "movimento"
  | "conto"
  | "titolo"
  | "categoria"
  | "abbonamento"
  | "debito"
  | "obiettivo"
  | "pensione"
  | "pagina"
  | "impostazione"
  | "azione";

export interface SearchHit {
  /** Stable key in the list (`group:id`). */
  key: string;
  group: SearchGroupId;
  icon: SearchIcon;
  title: string;
  /** Second line: date and account of a movement, ISIN of a security, the page a setting lives in. */
  subtitle?: string;
  /** Movements: date of the newest one (ISO), how many share its description, and its account; the palette writes the line. */
  date?: string;
  count?: number;
  account?: string;
  /** Amount shown on the right (signed, in the user's currency), for movements, accounts, positions. */
  amount?: number;
  href?: string;
  /** Opens «Aggiungi» on that form instead of going to a page. */
  quickAdd?: string;
  /** Logo of the merchant or broker, when known. */
  logoUrl?: string | null;
  /** 3 best, 1 weakest: orders the groups and picks the top hit. */
  score: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  /** Movements matched but not returned (only the latest are). */
  moreMovements: number;
  /** Server time spent, for the logs and the prototype measurements. */
  tookMs: number;
}
