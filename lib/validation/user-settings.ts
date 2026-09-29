import { z } from "zod";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/account/constants";
import { isHomePagePath } from "@/lib/account/home-pages";
import { isSupportedCurrency } from "./currency";

/** Aggiornamento parziale delle impostazioni utente: almeno un campo, ognuno validato contro i valori ammessi. */
export const updateUserSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Il nome non può essere vuoto")
      .max(DISPLAY_NAME_MAX_LENGTH, `Massimo ${DISPLAY_NAME_MAX_LENGTH} caratteri`)
      .optional(),
    currency: z.string().refine(isSupportedCurrency, "Valuta non supportata").optional(),
    homePage: z.string().refine(isHomePagePath, "Pagina non valida").optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Nessuna modifica");

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
