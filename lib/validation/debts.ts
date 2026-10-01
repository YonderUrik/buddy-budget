import { z } from "zod";
import {
  CREDIT_LINE_ALERT_TYPES,
  CREDIT_LINE_DAY_COUNTS,
  CREDIT_LINE_FREQUENCIES,
  DEBT_EARLY_EFFECTS,
  DEBT_START_MODES,
} from "@/lib/db/schema/debts";

/** Lunghezza massima del nome di un debito e delle etichette delle spese. */
export const DEBT_NAME_MAX_LENGTH = 80;
/** Lunghezza massima della nota di un evento. */
export const DEBT_NOTE_MAX_LENGTH = 500;
/** Massimo di spese accessorie per debito. */
export const DEBT_MAX_COSTS = 10;
/** Durata massima di un finanziamento in rate (50 anni di rate mensili). */
export const DEBT_MAX_INSTALLMENTS = 600;
/** Tasso annuo massimo accettato (in %): oltre non descrive un finanziamento vero. */
export const DEBT_MAX_ANNUAL_RATE = 100;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const money = z.number().finite().nonnegative().max(1e9);
const positiveMoney = z.number().finite().positive().max(1e9);
const annualRate = z.number().finite().min(0, "Tasso non valido").max(DEBT_MAX_ANNUAL_RATE, "Tasso non valido");

const costSchema = z.object({
  label: z.string().trim().min(1, "Etichetta mancante").max(DEBT_NAME_MAX_LENGTH),
  amount: money,
  kind: z.enum(["una_tantum", "per_rata"]),
});

/** Crea un finanziamento: i dati contrattuali (nuovo/origine) o la fotografia di oggi (residuo, rate rimanenti, prossima scadenza). */
export const createDebtSchema = z
  .object({
    name: z.string().trim().min(1, "Il nome è obbligatorio").max(DEBT_NAME_MAX_LENGTH),
    startMode: z.enum(DEBT_START_MODES),
    principal: positiveMoney,
    annualRate,
    installments: z.number().int().min(1).max(DEBT_MAX_INSTALLMENTS),
    firstInstallmentDate: dateKey,
    installment: positiveMoney.optional(),
    anchorDate: dateKey.optional(),
    costs: z.array(costSchema).max(DEBT_MAX_COSTS).default([]),
  })
  .refine((v) => v.startMode !== "fotografia" || v.anchorDate !== undefined, {
    message: "Per la fotografia di oggi serve la data della fotografia",
    path: ["anchorDate"],
  });
export type CreateDebtInput = z.input<typeof createDebtSchema>;

/** Lunghezza massima dell'etichetta dell'indice di una linea di credito. */
export const CREDIT_LINE_INDEX_LABEL_MAX_LENGTH = 40;
/** Spread massimo accettato (punti percentuali). */
export const CREDIT_LINE_MAX_SPREAD = 50;

const alertThreshold = z.object({ type: z.enum(CREDIT_LINE_ALERT_TYPES), value: positiveMoney }).refine((v) => v.type !== "percent" || v.value <= 1000, {
  message: "Soglia non valida",
});

/** Regole di una linea di credito decise dall'utente: tasso (indice + spread), addebito degli interessi, soglia di allerta. */
const creditLineRules = {
  creditLimit: positiveMoney,
  spread: z.number().finite().min(0, "Spread non valido").max(CREDIT_LINE_MAX_SPREAD, "Spread non valido"),
  indexLabel: z.string().trim().max(CREDIT_LINE_INDEX_LABEL_MAX_LENGTH).optional(),
  interestFrequency: z.enum(CREDIT_LINE_FREQUENCIES),
  dayCount: z.enum(CREDIT_LINE_DAY_COUNTS),
  capitalizeInterest: z.boolean(),
  alertThreshold: alertThreshold.nullable().optional(),
};

/** Crea una linea di credito (credit Lombard, fido): fido, utilizzo iniziale, tasso e regole di addebito. */
export const createCreditLineSchema = z
  .object({
  kind: z.literal("credit_line"),
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(DEBT_NAME_MAX_LENGTH),
  /** Utilizzato alla data di apertura (o di inizio del tracciamento). */
  initialUsed: money,
  /** Valore iniziale dell'indice (per un tasso fisso, il tasso stesso). */
  indexRate: annualRate,
  openDate: dateKey,
  costs: z.array(costSchema).max(DEBT_MAX_COSTS).default([]),
  ...creditLineRules,
}).refine((v) => v.initialUsed <= v.creditLimit, { message: "L'utilizzato iniziale supera il fido", path: ["initialUsed"] });
export type CreateCreditLineInput = z.input<typeof createCreditLineSchema>;

/**
 * Si modificano nome, spese e, per una linea di credito, le sue regole (fido, spread, addebito, soglia): cambiare le
 * condizioni di un finanziamento riscriverebbe la storia, per quello ci sono gli eventi.
 */
export const updateDebtSchema = z
  .object({
    name: z.string().trim().min(1).max(DEBT_NAME_MAX_LENGTH).optional(),
    costs: z.array(costSchema).max(DEBT_MAX_COSTS).optional(),
    creditLimit: creditLineRules.creditLimit.optional(),
    spread: creditLineRules.spread.optional(),
    indexLabel: creditLineRules.indexLabel,
    interestFrequency: creditLineRules.interestFrequency.optional(),
    dayCount: creditLineRules.dayCount.optional(),
    capitalizeInterest: creditLineRules.capitalizeInterest.optional(),
    alertThreshold: creditLineRules.alertThreshold,
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), { message: "Nessuna modifica" });
export type UpdateDebtInput = z.input<typeof updateDebtSchema>;

const note = z.string().trim().max(DEBT_NOTE_MAX_LENGTH).optional();

export const createDebtEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("payment"),
    installmentNumber: z.number().int().min(1).max(DEBT_MAX_INSTALLMENTS),
    date: dateKey,
    amount: positiveMoney,
    transactionId: z.string().uuid().optional(),
    note,
  }),
  z.object({ type: z.literal("rate_change"), date: dateKey, rate: annualRate, note }),
  z.object({ type: z.literal("balance_correction"), date: dateKey, amount: money, note }),
  z.object({ type: z.literal("draw"), date: dateKey, amount: positiveMoney, note }),
  z.object({ type: z.literal("repay"), date: dateKey, amount: positiveMoney, note }),
  z.object({ type: z.literal("interest_charged"), date: dateKey, amount: money, note }),
  z.object({
    type: z.literal("early_repayment"),
    date: dateKey,
    amount: positiveMoney,
    penalty: money.default(0),
    effect: z.enum(DEBT_EARLY_EFFECTS),
    note,
  }),
]);
export type CreateDebtEventInput = z.input<typeof createDebtEventSchema>;
