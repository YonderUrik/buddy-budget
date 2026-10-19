/**
 * Maps the category a bank writes in its own export («Ristorazione», «Food & Groceries», «Lebensmittel») to one of
 * the user's categories, without AI: first what the user taught by correcting earlier imports, then a category with
 * the same name, then a dictionary of common bank labels pointing at our default categories. Pure: no database, so the
 * importer, tests and self-hosted installs without an AI key all use the same logic.
 */
import { DEFAULT_CATEGORIES, OPTIONAL_DEFAULT_CATEGORIES } from "@/lib/categories/defaults";
import type { CategoryType } from "@/lib/categories/groups";
import { LANGUAGES } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { isDirectionCompatible } from "./match-rule";

/** Longest bank label kept on a transaction: real labels are a few words, anything longer is not a category. */
export const BANK_CATEGORY_MAX_LENGTH = 100;

/** Corrections the user must make for the same bank label before later imports follow them. */
export const MIN_LEARNED_CORRECTIONS = 2;

/** One of the user's categories, as the mapper needs it. */
export interface BankCategoryTarget {
  id: string;
  name: string;
  type: CategoryType;
  defaultKey: string | null;
  isFallback: boolean;
}

/** How a bank label was matched: learned from corrections, same name, or the dictionary. */
export type BankCategoryMatchKind = "learned" | "name" | "dictionary";

export interface BankCategoryMatch {
  categoryId: string;
  kind: BankCategoryMatchKind;
}

/** Lower case, no diacritics, punctuation to spaces, single spaces: «Bar & Ristoranti» → «bar ristoranti». */
export function normalizeBankCategory(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Cleans a label read from a file: trimmed, single spaces, null when empty or too long to be a category. */
export function cleanBankCategory(label: string | null | undefined): string | null {
  const cleaned = (label ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > BANK_CATEGORY_MAX_LENGTH || !/\p{L}/u.test(cleaned)) return null;
  return cleaned;
}

/** Light stem so plurals meet: «carburanti» and «carburante», «restaurants» and «restaurant». */
function stem(word: string): string {
  return word.length > 4 ? word.replace(/[aeios]$/, "") : word;
}

function stemmed(normalized: string): string {
  return normalized.split(" ").map(stem).join(" ");
}

/** The label and, for «Casa > Bollette» style labels, each level from the most specific one. */
function candidates(label: string): string[] {
  const parts = label.split(/\s*(?:>|›|»|\/|\||\s-\s|:)\s*/).map((part) => part.trim()).filter(Boolean);
  return [...new Set([label, ...parts.reverse()].map(normalizeBankCategory).filter(Boolean))];
}

/** Labels that say nothing about the category: they never map and fall back to the usual flow. */
const GENERIC_LABELS = new Set(
  [
    "altro", "altri", "altre", "altre spese", "altre uscite", "spese varie", "varie", "generico", "generiche", "generale", "non categorizzato",
    "non categorizzata", "da categorizzare", "senza categoria", "uscite", "spese", "pagamenti", "bonifici", "bonifico", "trasferimenti",
    "other", "others", "general", "miscellaneous", "misc", "uncategorized", "uncategorised", "expenses", "payments", "transfers", "transfer", "services",
    "sonstiges", "sonstige", "allgemein", "unkategorisiert", "ausgaben", "zahlungen", "uberweisungen", "uberweisung",
  ].map(normalizeBankCategory)
);

/**
 * Bank labels for each default category, in Italian, English and German. A term matches at the start of a word; a
 * term ending in `$` matches only the whole word («bar$» is not «barbiere»). Order matters: the first entry whose
 * category exists and fits the amount's direction wins, so more specific entries come first.
 */
const DICTIONARY: readonly (readonly [string, readonly string[]])[] = [
  ["contanti", ["prelev", "contant", "bancomat$", "atm$", "cash$", "bargeld", "geldautomat"]],
  ["affitto", ["affitt", "mutu", "condomin", "rent$", "mortgage", "miete", "hypothek", "wohnen$"]],
  ["bollette", ["utenz", "bollett", "luce$", "gas$", "energia", "elettric", "acqua$", "telefon", "internet", "cellular", "utilit", "phone", "energy", "strom$", "nebenkosten", "handy$"]],
  ["spesa", ["aliment", "supermercat", "spesa$", "spesa alimentare", "grocer", "supermarket", "lebensmittel", "supermarkt"]],
  ["ristoranti", ["ristor", "bar$", "bars$", "caff", "pizzer", "restaurant", "gastronom", "eating out", "takeaway", "lieferdienst"]],
  ["trasporti", ["trasport", "carburant", "benzin", "mobilita", "auto$", "pedagg", "parchegg", "taxi", "transport", "fuel", "car$", "parking", "toll$", "tolls$", "mobilitat", "tanken", "kraftstoff", "verkehr"]],
  ["salute", ["salut", "sanit", "farmac", "medic", "health", "pharm", "drugstore", "apothek", "gesundheit", "arzt", "dentist", "zahnarzt"]],
  ["assicurazioni", ["assicuraz", "insuranc", "versicherung"]],
  ["rate", ["prestit", "finanziament", "rate$", "rata$", "loan", "kredit", "darlehen", "ratenzahlung"]],
  ["abbonamenti", ["abbonament", "streaming", "subscription", "abo$", "abos$", "abonnement"]],
  ["benessere", ["sport", "palestr", "benessere", "cura della persona", "cura persona", "bellezza", "parrucch", "wellness", "fitness", "beauty", "personal care", "korperpflege"]],
  ["svago", ["svago", "tempo libero", "intrattenim", "divertim", "leisure", "entertainment", "freizeit", "unterhaltung", "hobby", "cultura", "spettacol", "cinema", "kino", "libri$"]],
  ["viaggi", ["viagg", "vacanz", "hotel", "travel", "holiday", "reise", "urlaub"]],
  ["shopping", ["shopping", "abbigliam", "acquisti", "elettronic", "cloth", "fashion", "electronic", "kleidung", "bekleidung", "elektronik", "einkauf"]],
  ["tasse", ["tasse$", "impost", "tribut", "bollo", "f24$", "tax$", "taxes$", "steuer", "multe$", "fines$", "abgaben"]],
  ["casa", ["casa$", "arred", "household", "haushalt", "home$", "furniture", "mobili$", "giardin", "fai da te", "baumarkt", "garten"]],
  ["regali", ["regal", "donaz", "benefic", "gift", "donation", "charity", "geschenk", "spende"]],
  ["risparmio", ["rispar", "savings", "sparen$", "sparplan"]],
  ["investimenti", ["investim", "investment", "invest$", "wertpapier", "trading$", "depot$"]],
  ["figli", ["figli", "scuol", "istruz", "educat", "school", "bildung", "kinder", "schule"]],
  ["animali", ["animal", "pet$", "pets$", "veterinar", "tier"]],
  ["pensione", ["previdenz", "fondo pension", "pension fund", "altersvorsorge"]],
  ["stipendio", ["stipend", "salar", "retribuz", "paga$", "pension", "wage", "gehalt", "lohn$", "rente$"]],
  ["interessi", ["interess", "dividend", "cedol", "interest", "zinsen", "zins$"]],
  ["rimborsi", ["rimbors", "refund", "erstattung", "ruckerstattung", "storno"]],
  ["lavoro-autonomo", ["lavoro autonomo", "fattur", "freelanc", "self employ", "selbststandig"]],
  ["altre-entrate", ["entrat", "income", "einnahmen", "einkommen"]],
];

const COMPILED_DICTIONARY = DICTIONARY.map(([key, terms]) => [
  key,
  terms.map((term) => {
    const whole = term.endsWith("$");
    const body = normalizeBankCategory(whole ? term.slice(0, -1) : term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^| )${body}${whole ? "(?: |$)" : ""}`);
  }),
] as const);

const ALL_DEFAULTS = [...DEFAULT_CATEGORIES, ...OPTIONAL_DEFAULT_CATEGORIES];

/** Default key of a category: the stored one, or for older rows a default name in any supported language. */
function defaultKeyOf(category: BankCategoryTarget): string | null {
  if (category.defaultKey) return category.defaultKey;
  return ALL_DEFAULTS.find((entry) => LANGUAGES.some((language) => translate(language, entry.name) === category.name))?.key ?? null;
}

/** The category's name in every language, plus each part of a «Ristoranti & Bar» name, normalised and stemmed. */
function nameVariants(category: BankCategoryTarget): Set<string> {
  const names = new Set([category.name, ...LANGUAGES.map((language) => translate(language, category.name))]);
  const variants = new Set<string>();
  for (const name of names) {
    variants.add(stemmed(normalizeBankCategory(name)));
    for (const part of name.split(/\s*(?:&|\+|\/|,|\be\b|\band\b|\bund\b)\s*/i)) {
      const normalized = normalizeBankCategory(part);
      if (normalized) variants.add(stemmed(normalized));
    }
  }
  return variants;
}

/** Categories a bank label may land on: not the fallback, not transfers (they change what counts), right direction. */
function eligible(categories: readonly BankCategoryTarget[], amount: number): BankCategoryTarget[] {
  return categories.filter((category) => !category.isFallback && category.type !== "trasferimento" && isDirectionCompatible(category.type, amount > 0, false));
}

/** Prepared mapper for one user: build once per import, then call `map` for each row. */
export interface BankCategoryMapper {
  map(label: string | null | undefined, amount: number): BankCategoryMatch | null;
}

/**
 * Builds the mapper for one user. `learned` maps a normalised bank label to the category the user moved such rows to
 * (see `learnFromCorrections`); it wins over everything else when the category still exists and fits the direction.
 */
export function buildBankCategoryMapper(categories: readonly BankCategoryTarget[], learned: ReadonlyMap<string, string> = new Map()): BankCategoryMapper {
  const variants = new Map(categories.map((category) => [category.id, nameVariants(category)]));
  const keys = new Map(categories.map((category) => [category.id, defaultKeyOf(category)]));
  return {
    map(label, amount) {
      const cleaned = cleanBankCategory(label);
      if (!cleaned || amount === 0) return null;
      const options = eligible(categories, amount);
      const learnedId = learned.get(normalizeBankCategory(cleaned));
      if (learnedId && options.some((category) => category.id === learnedId)) return { categoryId: learnedId, kind: "learned" };
      for (const candidate of candidates(cleaned)) {
        if (GENERIC_LABELS.has(candidate)) continue;
        const target = stemmed(candidate);
        const byName = options.filter((category) => variants.get(category.id)?.has(target));
        if (byName.length === 1) return { categoryId: byName[0].id, kind: "name" };
        for (const [key, patterns] of COMPILED_DICTIONARY) {
          if (!patterns.some((pattern) => pattern.test(candidate))) continue;
          const match = options.find((category) => keys.get(category.id) === key);
          if (match) return { categoryId: match.id, kind: "dictionary" };
        }
      }
      return null;
    },
  };
}

/** A transaction the user categorised by hand that carried a bank label. */
export interface BankCategoryCorrection {
  bankCategory: string;
  categoryId: string;
}

/**
 * What the user taught: for each normalised bank label, the category most of their own choices point to, when at
 * least `MIN_LEARNED_CORRECTIONS` agree and it is the clear winner (a tie teaches nothing).
 */
export function learnFromCorrections(corrections: readonly BankCategoryCorrection[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const { bankCategory, categoryId } of corrections) {
    const cleaned = cleanBankCategory(bankCategory);
    if (!cleaned) continue;
    const label = normalizeBankCategory(cleaned);
    const byCategory = counts.get(label) ?? new Map<string, number>();
    byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + 1);
    counts.set(label, byCategory);
  }
  const learned = new Map<string, string>();
  for (const [label, byCategory] of counts) {
    const ranked = [...byCategory].sort((a, b) => b[1] - a[1]);
    const [best, second] = ranked;
    if (best[1] >= MIN_LEARNED_CORRECTIONS && (!second || best[1] > second[1])) learned.set(label, best[0]);
  }
  return learned;
}
