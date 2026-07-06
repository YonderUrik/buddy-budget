import { z } from "zod";

/** Opzioni proposte per il tipo di conto nella select; l'utente può comunque digitarne uno libero. */
export const ACCOUNT_TYPE_OPTIONS = [
  "Conto corrente",
  "Conto risparmio",
  "Conto deposito",
  "Contanti",
] as const;

export const ACCOUNT_COLORS = [
  "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
] as const;
export type AccountColor = (typeof ACCOUNT_COLORS)[number];

export const ACCOUNT_ICONS = [
  "wallet", "credit-card", "banknote", "building-2", "piggy-bank",
  "trending-up", "home", "car", "plane", "shopping-cart", "briefcase",
  "dollar-sign", "bitcoin", "landmark", "coins", "receipt", "package",
  "gift", "heart", "star", "zap", "coffee", "shopping-bag", "user",
  "globe", "smartphone", "watch", "graduation-cap", "flame", "music",
] as const;
export type AccountIcon = (typeof ACCOUNT_ICONS)[number];

/** Converte una stringa importo (virgola o punto come separatore decimale) in numero, o null se non valida. */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  balance: z.number(),
  color: z.enum(ACCOUNT_COLORS).optional(),
  icon: z.enum(ACCOUNT_ICONS).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    balance: z.number().optional(),
    color: z.enum(ACCOUNT_COLORS).optional(),
    icon: z.enum(ACCOUNT_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
