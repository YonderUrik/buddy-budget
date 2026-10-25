/**
 * Rule-based reading of a sentence typed in «Cerca», in Italian, English and German whatever the app language:
 * «comprato 3 Apple a 50 € oggi», «sold 10 VWCE at 110 yesterday», «gestern 12 € bei Rewe bezahlt». It finds a verb, the
 * numbers (amount, quantity, price), a date and what is left as the subject. Pure and synchronous: it runs at every
 * keystroke in the browser, offline too, and never sends the sentence anywhere. What it cannot read goes to the AI only
 * when the user asks («Chiedi all'AI»).
 */

import { parseDataQuestion } from "./question";
import { COMMAND_MAX_LENGTH, COMMAND_MAX_VALUE, type CommandCurrency, type CommandDraft, type CommandKind, type CommandLanguage } from "./types";
import { fold, MONTHS } from "./words";

interface Token {
  raw: string;
  folded: string;
  used: boolean;
}


/** Verbs and nouns that say what the sentence is, per language (folded, no accents). */
const VERBS: Record<CommandLanguage, Record<CommandKind, string[]>> = {
  it: {
    acquisto: ["comprato", "comprate", "comprata", "compro", "comprati", "acquistato", "acquistate", "acquistati", "acquisto", "comprare", "compra"],
    vendita: ["venduto", "vendute", "venduta", "venduti", "vendo", "vendita", "vendere"],
    dividendo: ["dividendo", "dividendi", "cedola", "cedole"],
    spesa: ["speso", "spesi", "pagato", "pagata", "pagati", "pago", "spesa", "uscita"],
    entrata: ["ricevuto", "ricevuti", "incassato", "incassati", "entrata", "stipendio", "rimborso", "rimborsato", "guadagnato"],
  },
  en: {
    acquisto: ["bought", "buy", "purchased", "purchase"],
    vendita: ["sold", "sell", "sale"],
    dividendo: ["dividend", "dividends", "coupon"],
    spesa: ["spent", "paid", "pay", "spend", "expense"],
    entrata: ["received", "earned", "got", "income", "salary", "refund", "refunded"],
  },
  de: {
    acquisto: ["gekauft", "kaufe", "kauf", "kaufen"],
    vendita: ["verkauft", "verkaufe", "verkauf", "verkaufen"],
    dividendo: ["dividende", "dividenden", "ausschuttung", "kupon"],
    spesa: ["ausgegeben", "bezahlt", "gezahlt", "zahle", "ausgabe"],
    entrata: ["erhalten", "bekommen", "gehalt", "einnahme", "erstattung", "verdient"],
  },
};

/** Nouns that are also a good description of the movement («Stipendio 2.300» → «Stipendio»). */
const DESCRIPTIVE_NOUNS = new Set(["stipendio", "rimborso", "salary", "refund", "gehalt", "erstattung"]);

/** Helpers around the verb that carry no meaning («ho comprato», «I bought», «ich habe gekauft»). */
const FILLERS = new Set([
  "ho", "ha", "hai", "abbiamo", "ho'", "oggi'", "io", "mi", "e",
  "i", "have", "has", "just", "we", "and",
  "ich", "habe", "hab", "haben", "wir", "und",
]);

/** Little words trimmed from the ends of the subject («da Esselunga» → «Esselunga»). */
const EDGE_WORDS = new Set([
  "di", "del", "della", "dello", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "da", "dal", "dallo", "dalla", "dai", "dall'",
  "per", "su", "sul", "sulla", "in", "nel", "nella", "con", "un", "una", "uno", "un'", "il", "lo", "la", "gli", "le", "l'", "a", "ad", "x",
  "of", "the", "an", "at", "from", "for", "on", "to", "with", "my",
  "von", "vom", "bei", "beim", "im", "fur", "der", "die", "das", "den", "dem", "ein", "eine", "einen", "zu", "zum", "zur", "mit", "am", "an",
]);

/** First words of a question («quanto ho speso a ottobre?»): a question is a search, never something to add. */
const QUESTION_WORDS = new Set([
  "quanto", "quanta", "quanti", "quante", "quando", "dove", "cosa", "perche", "quale", "quali", "qual", "chi",
  "how", "what", "when", "where", "which", "why", "who",
  "wie", "wieviel", "wo", "was", "wann", "welche", "welcher", "welches", "warum", "wer",
]);

/** Words that turn a weekday into the one of last week («lunedì scorso», «last monday», «letzten Montag»). */
const LAST_WORDS = new Set(["scorso", "scorsa", "last", "letzten", "letzter", "letzte", "vergangenen"]);

/** Units after a quantity («3 azioni», «10 shares», «5 Stück»). */
const UNITS = new Set(["azioni", "azione", "quote", "quota", "titoli", "pezzi", "pz", "shares", "share", "units", "unit", "stuck", "stk", "aktien", "aktie", "anteile", "anteil"]);
/** Words that make the next number a price per unit («a 50», «at 50», «@ 50», «zu 50»). */
const PRICE_MARKERS = new Set(["a", "at", "@", "zu", "je", "each", "cad", "cadauna", "ognuna"]);
/** Words that make the next number a total («per 150», «for 150», «für 150»). */
const TOTAL_MARKERS = new Set(["per", "for", "fur", "totale", "total", "insgesamt"]);
/** Currency words next to a number, folded. */
const CURRENCY_WORDS: Record<string, CommandCurrency> = {
  "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR",
  "$": "USD", usd: "USD", dollari: "USD", dollaro: "USD", dollars: "USD", dollar: "USD", dollar_: "USD",
  "£": "GBP", gbp: "GBP", sterline: "GBP", pounds: "GBP", pfund: "GBP",
  chf: "CHF", franchi: "CHF", franken: "CHF",
};
const CURRENCY = new Set(Object.keys(CURRENCY_WORDS));

const RELATIVE_DAYS: Array<[words: string[], daysAgo: number]> = [
  [["l'", "altro", "ieri"], 2],
  [["altroieri"], 2],
  [["day", "before", "yesterday"], 2],
  [["vorgestern"], 2],
  [["ieri"], 1],
  [["yesterday"], 1],
  [["gestern"], 1],
  [["oggi"], 0],
  [["stamattina"], 0],
  [["stasera"], 0],
  [["today"], 0],
  [["tonight"], 0],
  [["heute"], 0],
];

const WEEKDAYS: string[][] = [
  ["domenica", "sunday", "sonntag"],
  ["lunedi", "monday", "montag"],
  ["martedi", "tuesday", "dienstag"],
  ["mercoledi", "wednesday", "mittwoch"],
  ["giovedi", "thursday", "donnerstag"],
  ["venerdi", "friday", "freitag"],
  ["sabato", "saturday", "samstag"],
];

const monthIndex = (word: string) => MONTHS.findIndex((names) => names.includes(word.replace(/\.$/, "")));

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysBefore = (today: Date, days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);

/** A real calendar date not in the future (a day/month without year that would be ahead means last year). */
function calendarDate(today: Date, day: number, month: number, year: number | null): string | null {
  const y = year === null ? today.getFullYear() : year < 100 ? 2000 + year : year;
  let date = new Date(y, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  if (year === null && date > today) date = new Date(y - 1, month, day);
  return isoDate(date);
}

/** Splits the sentence into words, with «€», «@» and apostrophes as separate pieces («€50» → «€ 50», «dall'Esselunga» → «dall' Esselunga»). */
function tokenize(text: string): Token[] {
  const spaced = text
    .replace(/[’`]/g, "'")
    .replace(/(\p{L})'(?=\p{L})/gu, "$1' ")
    .replace(/([€@$£])/g, " $1 ")
    .replace(/(\d)(eur|euro)\b/gi, "$1 $2")
    .replace(/[!?;]+/g, " ");
  return (spaced.match(/\S+/g) ?? []).map((raw) => {
    const trimmed = raw.replace(/^[,(]+|[,)]+$/g, "").replace(/(?<!\d)\.$/, "");
    return { raw: trimmed, folded: fold(trimmed), used: false };
  }).filter((token) => token.raw !== "");
}

/**
 * A number in a sentence of `language`: «45,90» and «1.200» in Italian and German, «45.90» and «1,200» in English. A
 * lone separator followed by three digits is read as thousands, otherwise as decimals.
 */
export function readNumber(word: string, language: CommandLanguage): number | null {
  if (!/^\d[\d.,']*$/.test(word)) return null;
  const clean = word.replace(/'/g, "");
  let normalized: string;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    normalized = clean.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = clean.split(sep);
    const thousands = parts.length > 2 || (parts[parts.length - 1].length === 3 && (language === "en" ? sep === "," : sep === "."));
    normalized = thousands ? parts.join("") : clean.replace(sep, ".");
  } else normalized = clean;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value < COMMAND_MAX_VALUE ? value : null;
}

/** Finds the date words, marks them used and returns the ISO date (today when there are none). */
function takeDate(tokens: Token[], today: Date): string {
  for (const [words, daysAgo] of RELATIVE_DAYS) {
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((word, k) => tokens[i + k].folded === word && !tokens[i + k].used)) {
        words.forEach((_, k) => (tokens[i + k].used = true));
        return isoDate(daysBefore(today, daysAgo));
      }
    }
  }
  for (const token of tokens) {
    if (token.used) continue;
    const weekday = WEEKDAYS.findIndex((names) => names.includes(token.folded));
    if (weekday >= 0) {
      token.used = true;
      const index = tokens.indexOf(token);
      const last = [tokens[index - 1], tokens[index + 1]].find((near) => near && !near.used && LAST_WORDS.has(near.folded));
      if (last) last.used = true;
      const daysAgo = (today.getDay() - weekday + 7) % 7;
      return isoDate(daysBefore(today, daysAgo === 0 && last ? 7 : daysAgo));
    }
    const iso = token.folded.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const date = calendarDate(today, Number(iso[3]), Number(iso[2]) - 1, Number(iso[1]));
      if (date) {
        token.used = true;
        return date;
      }
    }
    const numeric = token.folded.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?\.?$/);
    if (numeric && (token.folded.includes("/") || token.folded.split(".").filter(Boolean).length >= 2 && token.folded.endsWith(".") || numeric[3])) {
      const date = calendarDate(today, Number(numeric[1]), Number(numeric[2]) - 1, numeric[3] ? Number(numeric[3]) : null);
      if (date) {
        token.used = true;
        return date;
      }
    }
  }
  // «12 ottobre», «12. Oktober», «october 12», with an optional year after.
  for (let i = 0; i < tokens.length; i++) {
    const month = monthIndex(tokens[i].folded);
    if (month < 0 || tokens[i].used) continue;
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    const dayBefore = before && !before.used ? before.folded.match(/^(\d{1,2})\.?$/) : null;
    const dayAfter = after && !after.used ? after.folded.match(/^(\d{1,2})(st|nd|rd|th)?,?$/) : null;
    const dayToken = dayBefore ? before : dayAfter ? after : null;
    const day = dayBefore ? Number(dayBefore[1]) : dayAfter ? Number(dayAfter[1]) : null;
    if (day === null || !dayToken) continue;
    const yearToken = tokens[dayBefore ? i + 1 : i + 2];
    const year = yearToken && /^\d{4}$/.test(yearToken.folded) ? Number(yearToken.folded) : null;
    const date = calendarDate(today, day, month, year);
    if (!date) continue;
    tokens[i].used = true;
    dayToken.used = true;
    if (year !== null) yearToken.used = true;
    return date;
  }
  return isoDate(today);
}

/**
 * The first verb or noun of any language, with its kind and language. Every other word of the same kind is used up too
 * («Gehalt 2.300 € erhalten», «ricevuto lo stipendio»), and a descriptive noun among them names the movement.
 */
function takeVerb(tokens: Token[]): { kind: CommandKind; language: CommandLanguage; noun: string | null } | null {
  for (const token of tokens) {
    for (const language of ["it", "en", "de"] as const) {
      for (const [kind, words] of Object.entries(VERBS[language]) as Array<[CommandKind, string[]]>) {
        if (!words.includes(token.folded)) continue;
        const sameKind = tokens.filter((other) => !other.used && (["it", "en", "de"] as const).some((l) => VERBS[l][kind].includes(other.folded)));
        for (const other of sameKind) other.used = true;
        return { kind, language, noun: sameKind.find((other) => DESCRIPTIVE_NOUNS.has(other.folded))?.raw ?? null };
      }
    }
  }
  return null;
}

/** A question («quanto ho speso a ottobre?», «soldi spesi su Serenis nel 2026», «saldo Fineco»): searched or answered, never read as something to add. */
export function isQuestion(text: string): boolean {
  if (text.includes("?") || parseDataQuestion(text) !== null) return true;
  const first = text.trim().split(/\s+/)[0] ?? "";
  return QUESTION_WORDS.has(fold(first));
}

/** Guesses the language of a sentence without a verb from its little words (Italian by default). */
function guessLanguage(tokens: Token[]): CommandLanguage {
  const score = { it: 0, en: 0, de: 0 } as Record<CommandLanguage, number>;
  const hints: Record<CommandLanguage, string[]> = { it: ["da", "al", "alla", "per", "di", "ieri", "oggi"], en: ["at", "the", "for", "from", "yesterday", "today"], de: ["bei", "im", "fur", "von", "gestern", "heute"] };
  for (const token of tokens) for (const language of ["it", "en", "de"] as const) if (hints[language].includes(token.folded)) score[language] += 1;
  return (["en", "de"] as const).find((language) => score[language] > score.it && score[language] >= score[language === "en" ? "de" : "en"]) ?? "it";
}

/** Reads `text` (at most `COMMAND_MAX_LENGTH` characters) into a draft, or null when it does not look like something to add. */
export function parseCommand(text: string, today = new Date()): CommandDraft | null {
  if (text.length > COMMAND_MAX_LENGTH || isQuestion(text)) return null;
  const tokens = tokenize(text);
  if (tokens.length < 2) return null;
  const verb = takeVerb(tokens);
  const language = verb?.language ?? guessLanguage(tokens);
  const date = takeDate(tokens, today);
  const trade = verb?.kind === "acquisto" || verb?.kind === "vendita";

  let amount: number | null = null;
  let quantity: number | null = null;
  let price: number | null = null;
  let sawCurrency = false;
  let currency: CommandCurrency | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.used) continue;
    const value = readNumber(token.folded, language);
    if (value === null) continue;
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    const currencyAround = (before && CURRENCY.has(before.folded)) || (after && CURRENCY.has(after.folded));
    if (currencyAround) sawCurrency = true;
    token.used = true;
    for (const near of [before, after]) {
      if (near && CURRENCY.has(near.folded)) {
        near.used = true;
        currency ??= CURRENCY_WORDS[near.folded];
      }
    }
    if (trade) {
      const marker = before?.folded;
      const currencyFirst = marker !== undefined && CURRENCY.has(marker);
      const markerBefore = currencyFirst ? tokens[i - 2]?.folded : marker;
      if (markerBefore && PRICE_MARKERS.has(markerBefore) && price === null) {
        price = value;
        (currencyFirst ? tokens[i - 2] : before).used = true;
      } else if (markerBefore && TOTAL_MARKERS.has(markerBefore) && amount === null) {
        amount = value;
        (currencyFirst ? tokens[i - 2] : before).used = true;
      } else if (after && UNITS.has(after.folded)) {
        quantity = value;
        after.used = true;
      } else if (!currencyAround && quantity === null) quantity = value;
      else if (price === null) price = value;
    } else if (amount === null) amount = value;
  }
  if (!verb && !(amount !== null && sawCurrency)) return null;

  for (const token of tokens) if (!token.used && (FILLERS.has(token.folded) || CURRENCY.has(token.folded) || (trade && UNITS.has(token.folded)))) token.used = true;
  const rest = tokens.filter((token) => !token.used);
  while (rest.length > 0 && EDGE_WORDS.has(rest[0].folded)) rest.shift();
  while (rest.length > 0 && EDGE_WORDS.has(rest[rest.length - 1].folded)) rest.pop();
  let subject = rest.map((token) => token.raw).join(" ").replace(/' /g, "'").trim();
  if (subject === "" && verb?.noun) subject = verb.noun.charAt(0).toLocaleUpperCase() + verb.noun.slice(1);
  // «bonifico da Marco» → «Bonifico da Marco», while a name written with its own capitals («iPhone», «eBay») stays as it is.
  const firstWord = subject.split(" ")[0];
  if (firstWord !== "" && firstWord === firstWord.toLocaleLowerCase()) subject = subject.charAt(0).toLocaleUpperCase() + subject.slice(1);

  return { kind: verb?.kind ?? "spesa", amount, quantity, price, currency, date, subject: subject.slice(0, 60), language, source: "regole", guessed: verb === null };
}
