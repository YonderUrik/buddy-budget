import { z } from "zod";
import { SUBSCRIPTION_CADENCES } from "@/lib/calc/subscriptions";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/schema/subscriptions";

const name = z.string().trim().min(1, "Dai un nome all'abbonamento").max(80, "Il nome è troppo lungo");
const amount = z.number().positive("L'importo deve essere maggiore di zero").max(100_000);
const cadence = z.enum(SUBSCRIPTION_CADENCES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

/** Scelta su un abbonamento rilevato (conferma, esclusione, terminato): nasce da `key`, con l'istantanea di ciò che l'utente ha visto. */
export const decideSubscriptionSchema = z.object({
  origin: z.literal("rilevato"),
  key: z.string().trim().min(1).max(200),
  status: z.enum(SUBSCRIPTION_STATUSES),
  name,
  amount,
  cadence,
  categoryId: z.uuid().nullable().optional(),
});

/** Abbonamento aggiunto a mano: la data è quella del prossimo addebito. */
export const createManualSubscriptionSchema = z.object({
  origin: z.literal("manuale"),
  name,
  amount,
  cadence,
  nextDate: isoDate,
  categoryId: z.uuid().nullable().optional(),
});

export const createSubscriptionSchema = z.discriminatedUnion("origin", [decideSubscriptionSchema, createManualSubscriptionSchema]);
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = z
  .object({
    status: z.enum(SUBSCRIPTION_STATUSES),
    name,
    amount,
    cadence,
    nextDate: isoDate,
    categoryId: z.uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nessuna modifica");
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
