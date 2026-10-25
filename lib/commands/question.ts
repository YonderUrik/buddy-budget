/**
 * Questions about the user's own totals typed in «Cerca», read by rules in Italian, English and German whatever the app
 * language: «soldi spesi su Serenis nel 2026», «quanto ho speso a ottobre», «how much did I spend at Amazon last year»,
 * «wie viel habe ich bei Rewe 2026 ausgegeben». The rules find the direction (spent or received), the period (a year or a
 * month; this year when none is named) and what is left as the words to look for. Pure and synchronous like
 * `parseCommand`: the numbers are computed by the server on the user's own movements, never by a model.
 */

import { COMMAND_MAX_LENGTH, type CommandLanguage } from "./types";
import { fold, MONTHS } from "./words";

export type QuestionDirection = "uscite" | "entrate";

/** A calendar year or month, the two periods Movimenti can show. */
export interface QuestionPeriod {
  kind: "anno" | "mese";
  /** First and last day, ISO (YYYY-MM-DD). */
  from: string;
  to: string;
}

export interface TotalQuestion {
  kind: "totale";
  direction: QuestionDirection;
  /** Words to look for in the movements or a category name (folded); empty = every movement of that direction. */
  subject: string;
  period: QuestionPeriod;
  language: CommandLanguage;
}

/** Balance of one account (its name, folded) or of all of them (empty). */
export interface BalanceQuestion {
  kind: "saldo";
  subject: string;
  language: CommandLanguage;
}

/** Net worth today, or on a past day (ISO; only the AI fills it). */
export interface NetWorthQuestion {
  kind: "patrimonio";
  date: string | null;
  language: CommandLanguage;
}

/** Value of the portfolio (empty) or of one security held (its name, folded). */
export interface PortfolioQuestion {
  kind: "portafoglio";
  subject: string;
  language: CommandLanguage;
}

/** The next loan or mortgage instalment. */
export interface InstalmentQuestion {
  kind: "rata";
  language: CommandLanguage;
}

/**
 * Every question «Cerca» can answer from the user's own data. The rules and the AI both produce one of these; only the
 * server turns it into numbers, so the model never sees them.
 */
export type DataQuestion = TotalQuestion | BalanceQuestion | NetWorthQuestion | PortfolioQuestion | InstalmentQuestion;
export const DATA_QUESTION_KINDS = ["totale", "saldo", "patrimonio", "portafoglio", "rata"] as const satisfies readonly DataQuestion["kind"][];

/** Words that say which money the question is about, per language (folded). */
const DIRECTION_WORDS: Record<QuestionDirection, Record<CommandLanguage, string[]>> = {
  uscite: {
    it: ["speso", "spesi", "spese", "spesa", "pagato", "pagata", "pagati", "uscite", "costato", "costati"],
    en: ["spent", "spend", "paid", "pay", "expenses", "spending"],
    de: ["ausgegeben", "bezahlt", "gezahlt", "ausgaben", "gekostet"],
  },
  entrate: {
    it: ["ricevuto", "ricevuti", "incassato", "incassati", "guadagnato", "guadagnati", "entrate"],
    en: ["received", "earned", "income"],
    de: ["erhalten", "bekommen", "verdient", "einnahmen"],
  },
};

/** Words that make a sentence a question about a total rather than something to add («soldi spesi su…»). */
const ASKING_WORDS = new Set([
  "quanto", "quanta", "quanti", "quante", "soldi", "denaro", "totale",
  "how", "what", "money", "total",
  "wie", "wieviel", "was", "geld", "insgesamt", "summe",
]);

/** Little words left out of what to look for. */
const STOP_WORDS = new Set([
  "ho", "hai", "ha", "abbiamo", "io", "mi", "e", "in", "per", "su", "sul", "sulla", "da", "dal", "dalla", "di", "del", "della",
  "dei", "al", "alla", "ai", "a", "ad", "con", "tra", "fra", "nel", "nella", "nell'", "l'", "il", "lo", "la", "le", "gli", "un",
  "un'", "dell'", "all'", "dall'", "sull'", "dello", "degli", "delle", "nello", "negli", "nelle", "allo", "agli", "alle", "dallo",
  "dagli", "dalle", "sullo", "sugli", "sulle", "sui", "nei", "coi",
  "una", "mio", "mia", "miei", "mie", "ci", "sono", "stati", "stato", "euro", "eur", "€",
  "i", "did", "do", "does", "have", "has", "much", "many", "at", "on", "for", "from", "to", "with", "the", "my", "of", "and", "we",
  "dollars", "$",
  "ich", "habe", "hab", "haben", "wir", "viel", "viele", "bei", "beim", "fur", "an", "im", "am", "von", "vom", "zu", "mit", "der",
  "die", "das", "den", "dem", "mein", "meine", "und",
]);

/** Fixed periods, as word sequences; `years`/`months` back from the current one. */
const RELATIVE_PERIODS: Array<{ words: string[]; kind: "anno" | "mese"; back: number }> = [
  { words: ["quest'", "anno"], kind: "anno", back: 0 },
  { words: ["questo", "anno"], kind: "anno", back: 0 },
  { words: ["this", "year"], kind: "anno", back: 0 },
  { words: ["dieses", "jahr"], kind: "anno", back: 0 },
  { words: ["diesem", "jahr"], kind: "anno", back: 0 },
  { words: ["anno", "scorso"], kind: "anno", back: 1 },
  { words: ["last", "year"], kind: "anno", back: 1 },
  { words: ["letztes", "jahr"], kind: "anno", back: 1 },
  { words: ["letzten", "jahr"], kind: "anno", back: 1 },
  { words: ["vergangenes", "jahr"], kind: "anno", back: 1 },
  { words: ["vergangenen", "jahr"], kind: "anno", back: 1 },
  { words: ["questo", "mese"], kind: "mese", back: 0 },
  { words: ["this", "month"], kind: "mese", back: 0 },
  { words: ["diesen", "monat"], kind: "mese", back: 0 },
  { words: ["diesem", "monat"], kind: "mese", back: 0 },
  { words: ["mese", "scorso"], kind: "mese", back: 1 },
  { words: ["last", "month"], kind: "mese", back: 1 },
  { words: ["letzten", "monat"], kind: "mese", back: 1 },
  { words: ["vergangenen", "monat"], kind: "mese", back: 1 },
];

/** Periods of a question (also used for the model's answer, `ai.ts`). */
const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const lastDay = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
export const yearPeriod = (year: number): QuestionPeriod => ({ kind: "anno", from: iso(year, 0, 1), to: iso(year, 11, 31) });
/** `month` from 0 (January). */
export const monthPeriod = (year: number, month: number): QuestionPeriod => ({ kind: "mese", from: iso(year, month, 1), to: iso(year, month, lastDay(year, month)) });
/** Full month names only: short ones («mar», «set», «mai») are ordinary words too. */
const monthOf = (word: string) => MONTHS.findIndex((names) => names.some((name) => name.length >= 4 && name === word));
const isYear = (word: string) => /^(19|20)\d{2}$/.test(word);

/** Folded words of a question, with apostrophes split off («quest'anno» → «quest'», «anno») and punctuation dropped. */
function questionWords(text: string): string[] {
  return fold(text)
    .replace(/[’`]/g, "'")
    .replace(/(\p{L})'(?=\p{L})/gu, "$1' ")
    .replace(/[?!.,;:]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Reads `text` as a question about a total, or null when it is not one (a search, or something to add). */
export function parseTotalQuestion(text: string, today = new Date()): TotalQuestion | null {
  if (text.length > COMMAND_MAX_LENGTH) return null;
  const words = questionWords(text);
  const used = new Array<boolean>(words.length).fill(false);

  let direction: QuestionDirection | null = null;
  let language: CommandLanguage = "it";
  for (let i = 0; i < words.length && direction === null; i++) {
    for (const dir of ["uscite", "entrate"] as const) {
      const found = (["it", "en", "de"] as const).find((l) => DIRECTION_WORDS[dir][l].includes(words[i]));
      if (found) {
        direction = dir;
        language = found;
        used[i] = true;
        break;
      }
    }
  }
  if (direction === null) return null;

  let period: QuestionPeriod | null = null;
  for (const { words: phrase, kind, back } of RELATIVE_PERIODS) {
    const at = words.findIndex((_, i) => phrase.every((word, k) => words[i + k] === word));
    if (at < 0) continue;
    phrase.forEach((_, k) => (used[at + k] = true));
    if (kind === "anno") period = yearPeriod(today.getFullYear() - back);
    else {
      const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
      period = monthPeriod(date.getFullYear(), date.getMonth());
    }
    break;
  }
  if (period === null) {
    const monthAt = words.findIndex((word, i) => !used[i] && monthOf(word) >= 0);
    const yearAt = words.findIndex((word, i) => !used[i] && isYear(word));
    if (monthAt >= 0) {
      const month = monthOf(words[monthAt]);
      const year = yearAt >= 0 ? Number(words[yearAt]) : month > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
      period = monthPeriod(year, month);
      used[monthAt] = true;
      if (yearAt >= 0) used[yearAt] = true;
    } else if (yearAt >= 0) {
      period = yearPeriod(Number(words[yearAt]));
      used[yearAt] = true;
    }
  }

  const asking = text.includes("?") || words.some((word) => ASKING_WORDS.has(word));
  if (!asking && period === null) return null;
  // Any other number makes it something to add («speso 45,90 da Esselunga»), not a question.
  if (words.some((word, i) => !used[i] && /\d/.test(word))) return null;

  const subject = words.filter((word, i) => !used[i] && !STOP_WORDS.has(word) && !ASKING_WORDS.has(word)).join(" ").replace(/'/g, "").trim();
  return { kind: "totale", direction, subject: subject.slice(0, 60), period: period ?? yearPeriod(today.getFullYear()), language };
}

/** Words that name the other questions, per kind (folded); `rate` alone is too ambiguous (interest rate), see below. */
const KEYWORDS: Record<Exclude<DataQuestion["kind"], "totale">, Record<CommandLanguage, string[]>> = {
  patrimonio: { it: ["patrimonio"], en: ["networth"], de: ["vermogen", "nettovermogen", "gesamtvermogen"] },
  rata: { it: ["rata"], en: ["instalment", "installment", "instalments", "installments"], de: [] },
  saldo: { it: ["saldo", "saldi"], en: ["balance"], de: ["kontostand"] },
  portafoglio: { it: ["portafoglio", "investimenti"], en: ["portfolio", "investments"], de: ["depot", "depotwert"] },
};
/** «prossima rata», «next payment»… words that make «rate» / «payment» / «Rate» mean an instalment. */
const NEXT_WORDS = new Set(["prossima", "prossime", "mutuo", "prestito", "next", "upcoming", "nachste", "naechste"]);
/** «quanto vale Apple», «how much is Apple worth», «was ist Apple wert»: the value of a holding. */
const WORTH_WORDS = new Set(["vale", "valgono", "worth", "wert"]);
/** Words that only say «my account» around a balance question. */
const ACCOUNT_WORDS = new Set(["conto", "conti", "account", "accounts", "konto", "konten", "sul", "mio", "miei"]);

/**
 * Reads `text` as a question «Cerca» can answer from the user's data: a total («spese di ottobre»), a balance («saldo
 * Fineco»), the net worth («patrimonio»), the portfolio or a holding («quanto vale Apple»), the next instalment («prossima
 * rata»). Null when it is not one: a search, or something to add.
 */
export function parseDataQuestion(text: string, today = new Date()): DataQuestion | null {
  const total = parseTotalQuestion(text, today);
  if (total) return total;
  if (text.length > COMMAND_MAX_LENGTH) return null;
  const words = questionWords(text).map((word, i, all) => (word === "net" && all[i + 1] === "worth" ? "networth" : word)).filter((word, i, all) => !(word === "worth" && all[i - 1] === "networth"));
  if (words.some((word) => /\d/.test(word))) return null;
  const languageOf = (kind: keyof typeof KEYWORDS, word: string): CommandLanguage => (["it", "en", "de"] as const).find((l) => KEYWORDS[kind][l].includes(word)) ?? "it";
  const rest = (skip: (word: string) => boolean) =>
    words.filter((word) => !skip(word) && !STOP_WORDS.has(word) && !ASKING_WORDS.has(word)).join(" ").replace(/'/g, "").trim().slice(0, 60);

  const netWorth = words.find((word) => KEYWORDS.patrimonio.it.includes(word) || KEYWORDS.patrimonio.en.includes(word) || KEYWORDS.patrimonio.de.includes(word));
  if (netWorth) return { kind: "patrimonio", date: null, language: languageOf("patrimonio", netWorth) };

  const instalment = words.find((word, i) => ["it", "en", "de"].some((l) => KEYWORDS.rata[l as CommandLanguage].includes(word)) || ((word === "rate" || word === "payment") && (NEXT_WORDS.has(words[i - 1]) || NEXT_WORDS.has(words[i + 1]))));
  if (instalment) return { kind: "rata", language: instalment === "payment" ? "en" : instalment === "rate" && words.some((w) => w === "nachste" || w === "naechste") ? "de" : languageOf("rata", instalment) };

  const balance = words.find((word) => ["it", "en", "de"].some((l) => KEYWORDS.saldo[l as CommandLanguage].includes(word)));
  if (balance) return { kind: "saldo", subject: rest((word) => word === balance || ACCOUNT_WORDS.has(word)), language: languageOf("saldo", balance) };

  const portfolio = words.find((word) => ["it", "en", "de"].some((l) => KEYWORDS.portafoglio[l as CommandLanguage].includes(word)));
  if (portfolio) return { kind: "portafoglio", subject: rest((word) => word === portfolio), language: languageOf("portafoglio", portfolio) };
  const worth = words.find((word) => WORTH_WORDS.has(word));
  if (worth && words.some((word) => ASKING_WORDS.has(word))) {
    const subject = rest((word) => WORTH_WORDS.has(word) || word === "is" || word === "ist" || word === "sind");
    if (subject !== "") return { kind: "portafoglio", subject, language: worth === "worth" ? "en" : worth === "wert" ? "de" : "it" };
  }
  return null;
}
