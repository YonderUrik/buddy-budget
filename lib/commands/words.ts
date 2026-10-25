/** Word helpers shared by the sentence rules (`parse.ts`) and the question rules (`question.ts`). */

/** Lower case without accents, for comparing words typed in any of the three languages. */
export const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it");

/** Month names and abbreviations in Italian, English and German, folded; index 0 is January. */
export const MONTHS: string[][] = [
  ["gennaio", "gen", "january", "jan", "januar"],
  ["febbraio", "feb", "february", "februar"],
  ["marzo", "mar", "march", "marz"],
  ["aprile", "apr", "april"],
  ["maggio", "mag", "may", "mai"],
  ["giugno", "giu", "june", "jun", "juni"],
  ["luglio", "lug", "july", "jul", "juli"],
  ["agosto", "ago", "august", "aug"],
  ["settembre", "set", "september", "sep", "sept"],
  ["ottobre", "ott", "october", "oct", "oktober", "okt"],
  ["novembre", "nov", "november"],
  ["dicembre", "dic", "december", "dec", "dezember", "dez"],
];
