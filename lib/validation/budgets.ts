import { z } from "zod";

export const upsertBudgetSchema = z.object({
  monthlyAmount: z.number().min(0),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
