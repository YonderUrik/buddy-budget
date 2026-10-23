import { z } from "zod";
import { HOUSEHOLD_NAME_MAX } from "@/lib/households/constants";

const name = z.string().trim().min(1, "Dai un nome al gruppo").max(HOUSEHOLD_NAME_MAX, "Il nome è troppo lungo");

/** What a member shows the group. */
export const sharingSchema = z.object({
  sharesNetWorth: z.boolean(),
  accountIds: z.array(z.uuid()).max(50),
});

export const createHouseholdSchema = z.object({ name, sharing: sharingSchema });
export const updateHouseholdSchema = z.object({ name: name.optional(), sharing: sharingSchema.optional() });
export const createInviteSchema = z.object({ email: z.email("Email non valida").max(254).nullable().optional() });
export const acceptInviteSchema = z.object({ sharing: sharingSchema });
/** `rule`: «set» = the merchant's next expenses follow this choice, «clear» = drop the merchant's rule, «keep» = leave it. */
export const transactionChoiceSchema = z.object({ householdId: z.uuid().nullable(), rule: z.enum(["set", "clear", "keep"]).default("keep") });
