import { z } from "zod";
import { RULE_MATCH_TYPES } from "@/lib/db/schema/categorization-rules";

/**
 * Batch di applicazione categorizzazione: ogni gruppo condivide categoria, quota esclusa e
 * merchant, e opzionalmente crea/aggiorna la regola `appresa` corrispondente.
 */
export const applyCategorizationSchema = z.object({
  groups: z
    .array(
      z.object({
        transactionIds: z.array(z.uuid()).min(1),
        categoryId: z.uuid(),
        // Quota esclusa come frazione dell'importo (0-1), applicata a ogni transazione del gruppo.
        excludedPercentage: z.number().min(0).max(1).default(0),
        createRule: z.boolean().default(true),
        merchantKey: z.string().trim().min(1),
      })
    )
    .min(1),
});
export type ApplyCategorizationInput = z.infer<typeof applyCategorizationSchema>;

export const createRuleSchema = z.object({
  matchType: z.enum(RULE_MATCH_TYPES),
  pattern: z.string().trim().min(1),
  categoryId: z.uuid(),
  splitPercentage: z.number().min(0).max(1).nullable().optional(),
  /** Se esiste già una regola con stesso tipo e pattern, le dà la categoria nuova invece di rifiutare (409). */
  replaceExisting: z.boolean().optional(),
});
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
  .object({
    matchType: z.enum(RULE_MATCH_TYPES).optional(),
    pattern: z.string().trim().min(1).optional(),
    categoryId: z.uuid().optional(),
    splitPercentage: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nessun campo da aggiornare" });
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

/** «Ricategorizza»: tutto (con o senza i movimenti più vecchi) o i passati di una regola; `groupKeys` = gruppi scelti. */
export const recategorizeApplySchema = z
  .object({
    scope: z.enum(["tutto", "regola"]),
    includeLegacy: z.boolean().default(false),
    ruleId: z.uuid().optional(),
    groupKeys: z.array(z.string().min(1).max(2000)).max(5000).optional(),
  })
  .refine((value) => value.scope !== "regola" || value.ruleId !== undefined, { message: "Manca la regola", path: ["ruleId"] });
export type RecategorizeApplyInput = z.infer<typeof recategorizeApplySchema>;

export const recategorizeUndoSchema = z.object({ runId: z.uuid() });
