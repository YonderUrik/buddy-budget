import { z } from "zod";
import { TARGET_SUM_TOLERANCE } from "@/lib/investments/allocation";
import { MANUAL_AREA_KEYS, MANUAL_SECTOR_KEYS } from "@/lib/investments/exposure-keys";
import {
  COUPON_FREQUENCIES,
  INSTRUMENT_TYPES,
  TAX_REGIMES,
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
    .transform((v) => (v === "" ? null : v))
    // .optional() dopo .transform(): prima renderebbe la chiave obbligatoria nel tipo inferito (quirk di Zod).
    .optional(),
});

function checkTypeFields(
  data: { type: InvestmentTransactionType; quantity: number; price: number; grossAmount?: number | null },
  ctx: z.RefinementCtx
): void {
  if (POSITION_TYPES.has(data.type)) {
    if (!(data.quantity > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantità non valida" });
    if (!(data.price > 0)) ctx.addIssue({ code: "custom", path: ["price"], message: "Prezzo non valido" });
  }
  if (data.type === "split" && !(data.quantity > 0)) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "Rapporto dello split non valido" });
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

/** Impostazioni del portafoglio: `null` toglie il benchmark; si manda solo ciò che cambia. */
export const updatePortfolioSchema = z
  .object({ benchmarkInstrumentId: z.string().uuid().nullable().optional(), taxRegime: z.enum(TAX_REGIMES).optional() })
  .refine((data) => data.benchmarkInstrumentId !== undefined || data.taxRegime !== undefined, "Nessun campo da aggiornare");
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

/** Strumenti massimi nell'allocazione obiettivo. */
export const MAX_TARGETS = 30;

/**
 * Allocazione obiettivo per strumento: pesi tra 0 e 1 che sommano a 1 (100%), strumenti tutti diversi.
 * Una lista vuota toglie l'obiettivo.
 */
export const updateTargetsSchema = z.object({
  targets: z
    .array(z.object({ instrumentId: z.string().uuid(), weight: z.number().gt(0).max(1) }))
    .max(MAX_TARGETS, `Al massimo ${MAX_TARGETS} strumenti`)
    .refine((targets) => new Set(targets.map((t) => t.instrumentId)).size === targets.length, "Uno strumento compare due volte")
    .refine(
      (targets) => targets.length === 0 || Math.abs(targets.reduce((s, t) => s + t.weight, 0) - 1) <= TARGET_SUM_TOLERANCE,
      "I pesi devono sommare a 100%"
    ),
});
export type UpdateTargetsInput = z.infer<typeof updateTargetsSchema>;

/** Tolleranza sulla somma dei pesi di una ripartizione manuale (arrotondamenti dei campi percentuali). */
const BREAKDOWN_SUM_TOLERANCE = 0.0001;

function breakdownWeights<K extends string>(keys: readonly [K, ...K[]]) {
  return z
    .partialRecord(z.enum(keys), z.number().gt(0).max(1))
    .refine((weights) => Object.keys(weights).length > 0, "Inserisci almeno una percentuale")
    .refine(
      (weights) => Object.values(weights).reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0) <= 1 + BREAKDOWN_SUM_TOLERANCE,
      "Le percentuali superano il 100%"
    )
    .nullable();
}

/** Correzione manuale di settore e area di uno strumento: null = torna all'automatico per quella dimensione. */
export const updateBreakdownSchema = z.object({
  sectors: breakdownWeights(MANUAL_SECTOR_KEYS),
  areas: breakdownWeights(MANUAL_AREA_KEYS),
});
export type UpdateBreakdownInput = z.infer<typeof updateBreakdownSchema>;

/** Tasso cedolare annuo massimo accettato (sopra è quasi certamente un errore di battitura). */
export const MAX_COUPON_RATE = 0.3;

/**
 * Impostazioni fiscali e cedole di uno strumento, per utente: null = automatico. Le cedole vanno inserite tutte e tre
 * insieme (tasso, frequenza, scadenza) o nessuna.
 */
export const updateInstrumentSettingsSchema = z
  .object({
    taxRate: z.enum(TAX_RATES).nullable(),
    taxHarmonized: z.boolean().nullable(),
    couponRate: z.number().gt(0).max(MAX_COUPON_RATE).nullable(),
    couponFrequency: z
      .number()
      .int()
      .refine((v) => (COUPON_FREQUENCIES as readonly number[]).includes(v), "Frequenza non valida")
      .nullable(),
    maturityDate: dateKey.nullable(),
  })
  .refine(
    (d) => [d.couponRate, d.couponFrequency, d.maturityDate].every((v) => v === null) || [d.couponRate, d.couponFrequency, d.maturityDate].every((v) => v !== null),
    { message: "Per le cedole servono tasso, frequenza e scadenza", path: ["couponRate"] }
  );
export type UpdateInstrumentSettingsInput = z.infer<typeof updateInstrumentSettingsSchema>;

/** Primo anno accettato per una minusvalenza pregressa (più vecchia è comunque scaduta da tempo). */
export const MIN_CARRYFORWARD_YEAR = 2000;

/** Minusvalenza pregressa inserita a mano. L'anno futuro si controlla nella route (serve "oggi"). */
export const createTaxCarryforwardSchema = z.object({
  year: z.number().int().min(MIN_CARRYFORWARD_YEAR),
  amount: z.number().positive().max(100_000_000),
  note: z
    .string()
    .trim()
    .max(INVESTMENT_NOTE_MAX_LENGTH)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
});
export type CreateTaxCarryforwardInput = z.infer<typeof createTaxCarryforwardSchema>;

/** Proposte massime ignorate in una richiesta. */
export const MAX_DISMISSED_PER_REQUEST = 500;

const dismissedItem = z.object({ instrumentId: z.string().uuid(), date: dateKey });

/** Proposte "da registrare" da ignorare (o da ripristinare), una o più. */
export const dismissDividendSchema = z.object({ items: z.array(dismissedItem).min(1).max(MAX_DISMISSED_PER_REQUEST) });
export type DismissDividendInput = z.infer<typeof dismissDividendSchema>;
