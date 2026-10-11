import { z } from "zod";
import { SWATCH_COLORS, type SwatchColor } from "./shared-colors";
import { CATEGORY_TYPES } from "@/lib/categories/groups";

export const CATEGORY_COLORS = SWATCH_COLORS;
export type CategoryColor = SwatchColor;

export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shield", "shirt", "scissors", "gift", "briefcase", "wrench",
  "package", "help-circle", "shopping-bag", "smile", "alert-triangle",
  "wallet", "credit-card", "piggy-bank", "banknote", "landmark", "receipt",
  "trending-up", "coins", "flame", "sofa", "hammer", "paintbrush",
  "laptop", "headphones", "camera", "printer", "train-front", "ship",
  "map-pin", "luggage", "coffee", "pizza", "wine", "cake", "pill",
  "activity", "glasses", "book-open", "palette", "bike", "calculator",
  "watch",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** Lunghezza massima della descrizione di una categoria («Supermercato, alimentari, casalinghi»). */
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 120;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(CATEGORY_TYPES),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
  description: z.string().trim().max(CATEGORY_DESCRIPTION_MAX_LENGTH).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(CATEGORY_TYPES).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
    /** Stringa vuota = togli la descrizione. */
    description: z
      .string()
      .trim()
      .max(CATEGORY_DESCRIPTION_MAX_LENGTH)
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/** Scelte del passo «Categorie» dell'onboarding (vedi `lib/categories/setup.ts`). */
export const categorySetupSchema = z
  .array(
    z.object({
      key: z.string().max(40).nullable(),
      name: z.string().max(80),
      type: z.enum(CATEGORY_TYPES),
      enabled: z.boolean(),
    })
  )
  .max(100);
