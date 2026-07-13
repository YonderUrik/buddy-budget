import { z } from "zod";

export const createConnectionSchema = z.object({
  institutionId: z.string().trim().min(1),
  institutionName: z.string().trim().min(1),
  transactionTotalDays: z.number().int().positive(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const finalizeSelectionSchema = z.object({
  selections: z
    .array(
      z.object({
        externalAccountId: z.string().trim().min(1),
        name: z.string().trim().min(1),
        type: z.string().trim().min(1),
        mode: z.enum(["new", "existing"]),
        existingAccountId: z.string().uuid().optional(),
      })
    )
    .min(1),
});

export type FinalizeSelectionInput = z.infer<typeof finalizeSelectionSchema>;
