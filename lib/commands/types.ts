/** A sentence typed in «Cerca» turned into something to add: what it is and the values found in it. */

export const COMMAND_KINDS = ["spesa", "entrata", "acquisto", "vendita", "dividendo"] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

export const COMMAND_LANGUAGES = ["it", "en", "de"] as const;
export type CommandLanguage = (typeof COMMAND_LANGUAGES)[number];

/** Currencies a sentence can name. */
export const COMMAND_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type CommandCurrency = (typeof COMMAND_CURRENCIES)[number];

/** Who understood the sentence: the rules in the browser, or the model after «Chiedi all'AI». */
export type CommandSource = "regole" | "ai";

export interface CommandDraft {
  kind: CommandKind;
  /** Money of a movement or a dividend; for a purchase or sale the total, when written instead of a price. */
  amount: number | null;
  /** Shares or units bought or sold. */
  quantity: number | null;
  /** Price of one share or unit. */
  price: number | null;
  /** Currency written next to a number («€», «dollari», «$»), or null when none was written. */
  currency: CommandCurrency | null;
  /** ISO date (YYYY-MM-DD); today when the sentence names none. */
  date: string;
  /** What it is about, as written: the security of an operation, the description of a movement. */
  subject: string;
  /** Language the sentence was written in (the rules); for the AI the user's app language. */
  language: CommandLanguage;
  source: CommandSource;
  /** True when no verb was found and the kind is a guess (an amount and a name: most likely a spending). */
  guessed: boolean;
}

/** Values a draft still needs before its form can be saved, in the order the preview lists them. */
export type CommandMissing = "importo" | "titolo" | "quantita" | "descrizione";

export function missingFields(draft: CommandDraft): CommandMissing[] {
  const missing: CommandMissing[] = [];
  const trade = draft.kind === "acquisto" || draft.kind === "vendita";
  if (trade || draft.kind === "dividendo") {
    if (draft.subject === "") missing.push("titolo");
  } else if (draft.subject === "") missing.push("descrizione");
  if (trade) {
    if (draft.quantity === null && draft.amount === null) missing.push("quantita");
  } else if (draft.amount === null) missing.push("importo");
  return missing;
}

/** Upper bound for any amount, quantity or price read from a sentence (anything above is a typo or an abuse). */
export const COMMAND_MAX_VALUE = 10_000_000;
/** Longest sentence the interpreter and the model accept. */
export const COMMAND_MAX_LENGTH = 160;
