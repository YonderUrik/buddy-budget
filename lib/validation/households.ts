import { z } from "zod";
import { HOUSEHOLD_NAME_MAX, MAX_HOUSEHOLD_MEMBERS } from "@/lib/households/constants";

const name = z.string().trim().min(1, "Dai un nome al gruppo").max(HOUSEHOLD_NAME_MAX, "Il nome è troppo lungo");

/** What a member shows the group. */
export const sharingSchema = z.object({
  sharesNetWorth: z.boolean(),
  accountIds: z.array(z.uuid()).max(50),
});

export const createHouseholdSchema = z.object({ name, sharing: sharingSchema });
export const updateHouseholdSchema = z.object({ name: name.optional(), sharing: sharingSchema.optional() });
const email = z.email("Email non valida").max(254);
const personName = z.string().trim().min(1, "Scrivi il nome").max(HOUSEHOLD_NAME_MAX, "Il nome è troppo lungo");
/** Who an expense is for (member ids); null = everyone in the group. */
const forMemberIds = z.array(z.uuid()).min(1, "Scegli almeno una persona").max(MAX_HOUSEHOLD_MEMBERS).nullable();

export const createInviteSchema = z.object({ email: email.nullable().optional() });
/** Someone added by name; with an email the app also sends the invitation. */
export const addPersonSchema = z.object({ name: personName, email: z.union([email, z.literal("")]).nullable().optional() });
/** An expense written in the group. */
export const groupExpenseSchema = z.object({
  description: z.string().trim().min(1, "Scrivi cos'è").max(120, "La descrizione è troppo lunga"),
  amount: z.number().positive("L'importo deve essere più di zero").max(1_000_000),
  date: z.iso.date("Data non valida"),
  paidByMemberId: z.uuid(),
  forMemberIds,
  categoryId: z.uuid().nullable(),
});
export const acceptInviteSchema = z.object({ sharing: sharingSchema });
/** `rule`: «set» = the merchant's next expenses follow this choice, «clear» = drop the merchant's rule, «keep» = leave it. */
export const transactionChoiceSchema = z.object({
  householdId: z.uuid().nullable(),
  forMemberIds: forMemberIds.optional().default(null),
  rule: z.enum(["set", "clear", "keep"]).default("keep"),
});
