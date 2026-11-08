/**
 * Finds the help articles a typed question is about, in the browser and without AI: «come importo un csv», «how do I
 * hide amounts», «wie lösche ich mein Konto». Words are compared accent- and case-insensitively against the Italian
 * question, its translation and the article's keywords, give or take an ending («importo», «importare»).
 */

import { isCountryPathAvailable } from "@/lib/localization/config";
import { foldText } from "@/lib/search/normalize";
import { HELP_ARTICLES, helpArticle, type HelpArticle } from "./articles";

/** Most articles shown for one question. */
export const HELP_MAX_ARTICLES = 3;
/** Least score for an article to be shown: one word only it has, or two shared with a few other articles (`articleScore`). */
const HELP_MIN_SCORE = 0.75;

/** Words that open a «how do I / what is» question in the three languages (folded, apostrophes as spaces). */
const HELP_OPENERS = [
  "come", "posso", "perche", "dove", "cos e", "cosa e", "cosa significa", "cosa vuol dire", "cosa fa", "cosa vede", "chi vede", "si puo", "c e", "aiuto",
  "how", "can i", "why", "where", "what is", "what does", "what can", "who sees", "is there", "help",
  "wie", "kann ich", "warum", "wo", "was ist", "was bedeutet", "was sieht", "was macht", "wer sieht", "gibt es", "hilfe",
];
/** Openers that ask how the app works and never about a figure («perché…», «come faccio…»), unlike a bare «come» («come sono andate le spese?»). */
const HOW_TO_OPENERS = [
  "perche", "come faccio", "come posso", "come si", "posso", "cosa significa", "cosa vuol dire", "si puo",
  "why", "how do i", "how can i", "how to", "can i", "what does",
  "warum", "wie kann ich", "kann ich", "was bedeutet",
];
/** Questions about the user's figures, answered by the data questions instead («how much did I spend»). */
const DATA_OPENERS = ["how much", "how many", "wie viel", "wieviel", "wie oft", "how often"];

/** Little words that say nothing about the topic, and «movimenti», which every article is about. */
const STOP_WORDS = new Set([
  "come", "posso", "perche", "dove", "cosa", "cos", "che", "chi", "il", "lo", "la", "le", "gli", "un", "una", "uno", "di", "da", "del", "della", "dei", "delle", "al", "alla", "ai", "in", "su", "per", "con", "non", "mi", "mio", "mia", "miei", "mie", "si", "puo", "faccio", "fare", "devo", "voglio", "nell", "dell", "all", "nelle", "negli", "nei", "sulle", "sui", "alcuni", "alcune", "qualche", "tutti", "tutte", "movimento", "movimenti", "sono", "ho", "e", "ed", "o", "a",
  "how", "can", "why", "where", "what", "is", "the", "a", "an", "do", "does", "my", "to", "of", "in", "on", "for", "it", "there", "with", "some", "all", "not", "transaction", "transactions",
  "wie", "kann", "ich", "warum", "wo", "was", "ist", "der", "die", "das", "ein", "eine", "mein", "meine", "zu", "von", "im", "mit", "es", "gibt", "einige", "alle", "nicht", "umsatz", "umsatze",
]);

/** The question folded, apostrophes and punctuation as spaces, padded with one space on each side. */
const padded = (text: string) => ` ${foldText(text).replace(/['’]/g, " ").replace(/[?!.,;:]/g, " ").replace(/\s+/g, " ").trim()} `;

/** Whether `text` asks how to do something in the app or what something is, rather than about the user's figures. */
export function isHelpQuestion(text: string): boolean {
  const folded = padded(text);
  if (DATA_OPENERS.some((opener) => folded.startsWith(` ${opener} `))) return false;
  return HELP_OPENERS.some((opener) => folded.startsWith(` ${opener} `));
}

/** Whether `text` can only be a help question, so the rules must not read it as a total («perché alcune spese non contano?»). */
export function isHowToQuestion(text: string): boolean {
  const folded = padded(text);
  return HOW_TO_OPENERS.some((opener) => folded.startsWith(` ${opener} `));
}

/** The topic words of a question: folded, without little words and very short ones. */
function topicWords(text: string): string[] {
  return foldText(text)
    .replace(/['’]/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/** The same word give or take an ending: all but the last two letters of the shorter one shared, and at least four («importo», «importare»; never «importo», «imposto»). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const stem = Math.max(4, Math.min(a.length, b.length) - 2);
  return a.length >= stem && b.length >= stem && a.slice(0, stem) === b.slice(0, stem);
}

/** Whether an article's own words (question in both languages, keywords) are visible to a user of `country`. */
export function isHelpArticleAvailable(article: HelpArticle, country: string): boolean {
  return !article.href || isCountryPathAvailable(country, article.href.split("?")[0]);
}

/** An article's own words: its Italian and translated question and its keywords. */
function ownWords(article: HelpArticle, translate: (key: string) => string): string[] {
  return [...new Set([...topicWords(article.question), ...topicWords(translate(article.question)), ...article.keywords.flatMap((k) => topicWords(k))])];
}

/**
 * How much of the question the article covers: each topic word it shares counts less the more articles share it
 * («movimenti» is everywhere, «csv» in one), and a keyword phrase found whole counts one more.
 */
function articleScore(own: string[], article: HelpArticle, words: string[], spread: Map<string, number>): number {
  let score = 0;
  for (const word of words) if (own.some((w) => sameWord(w, word))) score += 1 / Math.sqrt(spread.get(word) ?? 1);
  const folded = foldText(words.join(" "));
  for (const keyword of article.keywords) if (keyword.includes(" ") && folded.includes(foldText(keyword))) score += 1;
  return score;
}

/** The articles that answer `text`, best first (at most `HELP_MAX_ARTICLES`); empty when none covers its words. */
export function matchHelp(text: string, country: string, translate: (key: string) => string): HelpArticle[] {
  const words = topicWords(text);
  if (words.length === 0) return [];
  const articles = HELP_ARTICLES.filter((article) => isHelpArticleAvailable(article, country)).map((article) => ({ article, own: ownWords(article, translate) }));
  const spread = new Map(words.map((word) => [word, articles.filter((a) => a.own.some((w) => sameWord(w, word))).length]));
  const scored = articles
    .map(({ article, own }) => ({ article, score: articleScore(own, article, words, spread) }))
    .filter((entry) => entry.score >= HELP_MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  // A weaker match than half the best is noise («importo» in «come importo un mutuo» does not make imports an answer).
  const best = scored[0]?.score ?? 0;
  return scored.filter((entry) => entry.score * 2 >= best).slice(0, HELP_MAX_ARTICLES).map((entry) => entry.article);
}

/** Known, available ids in the order given, without repeats (the model's answer, a cached one). */
export function cleanHelpIds(ids: readonly string[], country: string): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const id of ids) {
    const article = helpArticle(id);
    if (!article || seen.has(id) || !isHelpArticleAvailable(article, country)) continue;
    seen.add(id);
    clean.push(id);
  }
  return clean.slice(0, HELP_MAX_ARTICLES);
}
