import { z } from "zod";

export { parseAmount } from "./accounts";

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    amount: z.number().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").optional(),
    excludedAmount: z.number().min(0).optional(),
    note: z
      .string()
      .trim()
      .max(500, "La nota non può superare 500 caratteri")
      .nullable()
      .transform((val) => (val === "" ? null : val))
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
