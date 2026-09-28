import { z } from "zod";
import {
  INSTRUMENT_TYPES,
  INVESTMENT_TRANSACTION_TYPES,
  PLAN_FREQUENCIES,
  PRICE_UNITS,
  type InvestmentTransactionType,
} from "@/lib/db/schema/investments";

/** Lunghezza massima della nota di un'operazione (come per le transazioni). */
export const INVESTMENT_NOTE_MAX_LENGTH = 500;
/** Il giorno del PAC si ferma al 28 per esistere in tutti i mesi. */
export const PLAN_MAX_DAY_OF_MONTH = 28;
/** Aliquote italiane sui redditi finanziari: ordinaria e titoli di Stato. */
export const TAX_RATES = ["0.26", "0.125"] as const;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Valuta non valida");

/** Verifica un ISIN: formato e cifra di controllo (algoritmo di Luhn sulle cifre espanse). */
export function isValidIsin(value: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value)) return false;
  const digits = [...value.slice(0, 11)].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(value[11]);
}

const isin = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidIsin, "ISIN non valido");

const taxFields = {
  taxRate: z.enum(TAX_RATES).optional(),
  taxHarmonized: z.boolean().nullable().optional(),
};

/**
 * Creazione di uno strumento. `yahoo`: scelto dalla ricerca (valuta e borsa le rilegge il server);
 * `coingecko`: crypto; `isin`: solo ISIN, prezzi da Borsa Italiana (tipicamente BTP); `manuale`: prezzi a mano.
 */
export const createInstrumentSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("yahoo"),
    yahooSymbol: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(200),
    type: z.enum(INSTRUMENT_TYPES),
    isin: isin.optional(),
    ...taxFields,
  }),
  z.object({
    source: z.literal("coingecko"),
    coingeckoId: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    currency: currencyCode,
  }),
  z.object({
    source: z.literal("isin"),
    isin,
    name: z.string().trim().min(1).max(200),
    type: z.enum(INSTRUMENT_TYPES),
    currency: currencyCode,
    ...taxFields,
  }),
  z.object({
    source: z.literal("manuale"),
    name: z.string().trim().min(1).max(200),
    type: z.enum(INSTRUMENT_TYPES),
    currency: currencyCode,
    priceUnit: z.enum(PRICE_UNITS).optional(),
    isin: isin.optional(),
    ...taxFields,
  }),
]);

export type CreateInstrumentInput = z.infer<typeof createInstrumentSchema>;

/** Rinomina di uno strumento: l'ISIN non si cambia (decisione in functional-spec). */
export const updateInstrumentSchema = z.object({ name: z.string().trim().min(1).max(200) });

const POSITION_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["acquisto", "vendita", "rimborso"]);
const INCOME_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["dividendo", "cedola"]);

/** Campi di un'operazione; i vincoli che dipendono dal tipo sono nel `superRefine` sotto. */
const transactionFields = z.object({
  portfolioId: z.string().uuid().optional(),
  instrumentId: z.string().uuid(),
  type: z.enum(INVESTMENT_TRANSACTION_TYPES),
  date: dateKey,
  quantity: z.number().nonnegative().default(0),
  price: z.number().nonnegative().default(0),
  grossAmount: z.number().nonnegative().nullable().optional(),
  fxRate: z.number().positive().optional(),
  fees: z.number().nonnegative().default(0),
  taxes: z.number().nonnegative().default(0),
  note: z
    .string()
    .trim()
    .max(INVESTMENT_NOTE_MAX_LENGTH, "La nota non può superare 500 caratteri")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

function checkTypeFields(
  data: { type: InvestmentTransactionType; quantity: number; price: number; grossAmount?: number | null },
  ctx: z.RefinementCtx
): void {
  if (POSITION_TYPES.has(data.type)) {
    if (!(data.quantity > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantità non valida" });
    if (!(data.price > 0)) ctx.addIssue({ code: "custom", path: ["price"], message: "Prezzo non valido" });
  }
  if (INCOME_TYPES.has(data.type) && !((data.grossAmount ?? 0) > 0)) {
    ctx.addIssue({ code: "custom", path: ["grossAmount"], message: "Importo non valido" });
  }
}

/** Nuova operazione. La data futura si controlla nella route (serve "oggi"). */
export const createInvestmentTransactionSchema = transactionFields.superRefine(checkTypeFields);
export type CreateInvestmentTransactionInput = z.infer<typeof createInvestmentTransactionSchema>;

/** Modifica di un'operazione: si rimanda l'operazione intera (i vincoli dipendono dal tipo). */
export const updateInvestmentTransactionSchema = transactionFields
  .omit({ portfolioId: true, instrumentId: true })
  .superRefine(checkTypeFields);
export type UpdateInvestmentTransactionInput = z.infer<typeof updateInvestmentTransactionSchema>;

export const createPlanSchema = z.object({
  portfolioId: z.string().uuid().optional(),
  instrumentId: z.string().uuid(),
  amount: z.number().positive(),
  frequency: z.enum(PLAN_FREQUENCIES).default("mensile"),
  dayOfMonth: z.number().int().min(1).max(PLAN_MAX_DAY_OF_MONTH),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z
  .object({
    amount: z.number().positive().optional(),
    frequency: z.enum(PLAN_FREQUENCIES).optional(),
    dayOfMonth: z.number().int().min(1).max(PLAN_MAX_DAY_OF_MONTH).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nessun campo da aggiornare" });
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const manualPriceSchema = z.object({ date: dateKey, close: z.number().positive() });
export type ManualPriceInput = z.infer<typeof manualPriceSchema>;
