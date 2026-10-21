import { z } from "zod";

export const createConnectionSchema = z.object({
  institutionId: z.string().trim().min(1),
  institutionName: z.string().trim().min(1),
  transactionTotalDays: z.number().int().positive(),
  /**
   * Who completes the consent: `web` (default; GoCardless returns to the web callback, which needs the session cookie)
   * or `native` (the iOS/Android app; GoCardless returns to the public native callback, which hands the browser back to
   * `buddybudget://bank/return`). `ios`/`android` are accepted as aliases of `native`.
   */
  client: z
    .enum(["web", "native", "ios", "android"])
    .optional()
    .transform((client): "web" | "native" => (client === undefined || client === "web" ? "web" : "native")),
});

export type CreateConnectionInput = z.input<typeof createConnectionSchema>;

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
