/** Shapes shared by the search API and the palette. */

import type { QuestionDirection, QuestionPeriod } from "@/lib/commands/question";
import type { Instrument } from "@/lib/db/schema/investments";

export const SEARCH_GROUP_IDS = ["risposte", "movimenti", "conti", "titoli", "categorie", "abbonamenti", "debiti", "obiettivi", "pensione", "pagine", "azioni"] as const;
export type SearchGroupId = (typeof SEARCH_GROUP_IDS)[number];

export type SearchIcon =
  | "totale"
  | "movimento"
  | "conto"
  | "titolo"
  | "categoria"
  | "abbonamento"
  | "debito"
  | "obiettivo"
  | "pensione"
  | "panoramica"
  | "liquidita"
  | "analitiche"
  | "aiuto"
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
  /** One movement: opens its detail over the current page instead of going to a page. */
  movementId?: string;
  /** Opens «Aggiungi» on that form instead of going to a page. */
  quickAdd?: string;
  /** The security itself (public data), so a sentence like «comprato 3 Apple» can open the operation form on it. */
  instrument?: Instrument;
  /** Merchant logo served by our server (movements, subscriptions, answers about a merchant), when one is known. */
  logoPath?: string | null;
  /** An answer to a question about the user's data («Serenis nel 2026», «saldo Fineco»): the palette writes title and line from it, `title` holding only the name it is about (empty for all). */
  answer?: SearchAnswer;
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

/** What an answer row says besides its amount, per kind of question; `source`: read by the rules or by the AI. */
export type SearchAnswer = { source: "regole" | "ai" } & (
  | {
      kind: "totale";
      direction: QuestionDirection;
      period: QuestionPeriod;
      /** Movements summed. */
      count: number;
      /** The name is one of the user's categories (summed by category, any age) rather than words in the movements. */
      category: boolean;
      /** True when part of the period is older than the movements «Cerca» reads (24 months), or the scan hit its cap. */
      partial: boolean;
    }
  | { kind: "saldo"; /** Accounts summed (1 for a named one). */ accounts: number }
  | { kind: "patrimonio"; /** The past day asked about (ISO), null for today. */ date: string | null; /** No history reaches that day: no figure. */ missing: boolean }
  | { kind: "portafoglio"; /** Gain so far (the whole portfolio: total; one holding: not yet realised), null without a price. */ gain: number | null; /** Positions summed (1 for a named one, 0 = nothing held). */ positions: number }
  | { kind: "rata"; /** Day of the next instalment (ISO), null when no loan has one. */ date: string | null; overdue: boolean }
);

export type SearchAnswerKind = SearchAnswer["kind"];
