import { z } from "zod";
import { INSTRUMENT_TYPES, INVESTMENT_TRANSACTION_TYPES } from "@/lib/db/schema/investments";
import { createInstrumentSchema, INVESTMENT_NOTE_MAX_LENGTH } from "./investments";

/** Strumenti distinti al massimo per richiesta di abbinamento (ognuno può costare una ricerca sulle fonti). */
export const IMPORT_MAX_IDENTITIES = 50;
/** Operazioni al massimo per import: oltre, meglio dividere il file. */
export const IMPORT_MAX_OPERATIONS = 5000;

const key = z.string().min(1).max(250);

/** Richiesta di abbinamento: gli strumenti distinti trovati nel file. */
export const resolveImportSchema = z.object({
  identities: z
    .array(
      z.object({
        key,
        symbol: z.string().trim().max(40).nullable(),
        isin: z.string().trim().max(12).nullable(),
        name: z.string().trim().max(200).nullable(),
        currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
        symbolIsYahoo: z.boolean(),
        type: z.enum(INSTRUMENT_TYPES).optional(),
      })
    )
    .min(1)
    .max(IMPORT_MAX_IDENTITIES, `Al massimo ${IMPORT_MAX_IDENTITIES} strumenti per file`),
});
export type ResolveImportInput = z.infer<typeof resolveImportSchema>;

/**
 * Vincoli per tipo, come nel form ma con un'eccezione: un acquisto può avere prezzo zero (quote ricevute gratis,
 * es. staking, che Yahoo esporta così). Vendite e rimborsi a prezzo zero restano un errore.
 */
function checkImportedOperation(
  op: { type: string; quantity: number; price: number; grossAmount: number | null },
  ctx: z.RefinementCtx
): void {
  if (op.type === "rettifica") {
    if (op.grossAmount === null || op.price !== 0) ctx.addIssue({ code: "custom", message: "Rettifica di capitale non valida" });
    return;
  }
  const income = op.type === "dividendo" || op.type === "cedola";
  if (income && !(op.grossAmount !== null && op.grossAmount > 0)) ctx.addIssue({ code: "custom", message: "Importo non valido" });
  if (!income && !(op.quantity > 0)) ctx.addIssue({ code: "custom", message: "Quantità non valida" });
  if (!income && op.type !== "acquisto" && !(op.price > 0)) ctx.addIssue({ code: "custom", message: "Prezzo non valido" });
}

/** Import: a ogni chiave di strumento corrisponde uno strumento già esistente o da creare. */
export const runImportSchema = z.object({
  dryRun: z.boolean(),
  /** CSV originale: il server ricalcola le operazioni e riconcilia il rendiconto. */
  statementCsv: z.string().max(5 * 1024 * 1024).optional(),
  /** Formato del file (solo per l'evento di prodotto). */
  preset: z.string().max(40).nullable().optional(),
  instruments: z
    .array(z.union([z.object({ key, instrumentId: z.string().uuid() }), z.object({ key, create: createInstrumentSchema })]))
    .min(1)
    .max(IMPORT_MAX_IDENTITIES),
  operations: z
    .array(
      z.object({
        key,
        line: z.number().int().positive(),
        type: z.enum(INVESTMENT_TRANSACTION_TYPES),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        quantity: z.number().nonnegative(),
        price: z.number().nonnegative(),
        grossAmount: z.number().finite().nullable(),
        /** Se presente, tutti gli importi (anche costi) sono nella valuta sorgente dello strumento. */
        sourceCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
        fees: z.number().nonnegative(),
        taxes: z.number().nonnegative(),
        note: z.string().max(INVESTMENT_NOTE_MAX_LENGTH).nullable(),
      })
      .superRefine(checkImportedOperation)
    )
    .min(1, "Nessuna operazione da importare")
    .max(IMPORT_MAX_OPERATIONS, `Al massimo ${IMPORT_MAX_OPERATIONS} operazioni per import`),
});
export type RunImportInput = z.infer<typeof runImportSchema>;
