import { z } from "zod";
import { SUBSCRIPTION_CADENCES } from "@/lib/calc/subscriptions";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/schema/subscriptions";

/** Longest name a user can type for a subscription. */
export const SUBSCRIPTION_NAME_MAX = 80;
const name = z.string().trim().min(1, "Dai un nome all'abbonamento").max(SUBSCRIPTION_NAME_MAX, "Il nome è troppo lungo");
/**
 * Name of a detected subscription: the raw bank description of its last charge, which is often longer than a typed
 * name. It is a snapshot the user never typed, so it is shortened instead of rejecting the decision.
 */
const detectedName = z.string().trim().min(1).transform((value) => value.slice(0, SUBSCRIPTION_NAME_MAX).trimEnd());
const amount = z.number().positive("L'importo deve essere maggiore di zero").max(100_000);
const cadence = z.enum(SUBSCRIPTION_CADENCES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

/**
 * Decision on a detected subscription (confirm, exclude, ended): keyed by `key`, with a snapshot of what the user saw.
 * The key must match the detected one exactly, so it is neither trimmed nor shortened; its length follows the bank
 * description it comes from.
 */
export const decideSubscriptionSchema = z.object({
  origin: z.literal("rilevato"),
  key: z.string().min(1).max(1000),
  status: z.enum(SUBSCRIPTION_STATUSES),
  name: detectedName,
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
