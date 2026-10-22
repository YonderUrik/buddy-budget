import { z } from "zod";

const MAX_BUDGET = 10_000_000;
const amount = z.number().min(0).max(MAX_BUDGET);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month deve avere formato YYYY-MM");

/** Body of `PUT /api/budgets/[categoryId]`: at least one of the standing amount, rollover or a single-month amount. */
export const upsertBudgetSchema = z
  .object({
    monthlyAmount: amount.optional(),
    rollover: z.boolean().optional(),
    /** Amount of one month only («Cifra diversa solo a dicembre»); `amount: null` goes back to the usual one. */
    singleMonth: z.object({ month, amount: amount.nullable() }).optional(),
  })
  .refine((v) => v.monthlyAmount !== undefined || v.rollover !== undefined || v.singleMonth !== undefined, { message: "Nessuna modifica" });

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;

/** Body of `POST /api/budgets/accept-proposals`: the proposals the user kept, possibly with a changed amount. */
export const acceptProposalsSchema = z.object({
  items: z
    .array(z.object({
        categoryId: z.string().uuid(),
        amount: amount.positive(),
        rollover: z.boolean(),
        /** The user changed the proposed amount (only counted in the product event). */
        changed: z.boolean().optional(),
      }))
    .min(1)
    .max(200),
});

export type AcceptProposalsInput = z.infer<typeof acceptProposalsSchema>;

export const budgetMonthParam = month;
