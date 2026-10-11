import { z } from "zod";
import { DIGEST_FREQUENCIES } from "@/lib/notifications/constants";

/** Corpo di `PATCH /api/user/notifications`: ogni campo è facoltativo, ma serve almeno uno. */
export const updateNotificationPreferencesSchema = z
  .object({
    digestEnabled: z.boolean(),
    digestFrequency: z.enum(DIGEST_FREQUENCIES),
    budgetAlertsEnabled: z.boolean(),
    deadlineAlertsEnabled: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Nessuna preferenza da aggiornare" });

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
