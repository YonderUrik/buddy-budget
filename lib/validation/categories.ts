import { z } from "zod";
import { SWATCH_COLORS, type SwatchColor } from "./shared-colors";

export const CATEGORY_COLORS = SWATCH_COLORS;
export type CategoryColor = SwatchColor;

export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shirt", "scissors", "gift", "briefcase", "wrench",
  "package", "help-circle",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["fissa", "variabile"]),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(["fissa", "variabile"]).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
