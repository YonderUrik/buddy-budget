import { z } from "zod";

/** Opzioni proposte per il tipo di conto nella select; l'utente può comunque digitarne uno libero. */
export const ACCOUNT_TYPE_OPTIONS = [
  "Conto corrente",
  "Conto risparmio",
  "Conto deposito",
  "Contanti",
] as const;

/** Converte una stringa importo (virgola o punto come separatore decimale) in numero, o null se non valida. */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  institution: z.string().trim().optional(),
  type: z.string().trim().min(1),
  balance: z.number(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    institution: z.string().trim().optional(),
    type: z.string().trim().min(1).optional(),
    balance: z.number().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
