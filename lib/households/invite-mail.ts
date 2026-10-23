import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { households } from "@/lib/db/schema/households";
import { sendEmail } from "@/lib/email/send";
import { resolveProfile } from "@/lib/localization/config";
import { requestLogger } from "@/lib/observability";
import { inviteEmailContent } from "./email";
import { createInvite } from "./server";
import { inviteUrl } from "./tokens";

/** The inviter as the session gives them. */
interface Inviter {
  id: string;
  name: string;
  language?: string | null;
  productCountry?: string | null;
}

/**
 * Creates the invitation of someone added by name and, with an email, sends it in the inviter's language. Answers the
 * link either way, so the screen can also share it by hand. Refusals come up as `HouseholdError`.
 */
export async function inviteMember(inviter: Inviter, householdId: string, memberId: string, email: string | null): Promise<{ url: string; emailed: boolean }> {
  const { token } = await createInvite(inviter.id, householdId, memberId, email);
  const url = inviteUrl(token);
  if (!email) return { url, emailed: false };
  const [group] = await db.select({ name: households.name }).from(households).where(eq(households.id, householdId));
  const content = inviteEmailContent({
    inviterName: inviter.name.split(" ")[0] || inviter.name,
    householdName: group?.name ?? "",
    url,
    appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
    language: resolveProfile(inviter).language,
  });
  const result = await sendEmail({ to: email, ...content });
  if (!result.ok) requestLogger().warn("household.invite.email_failed", { reason: result.reason });
  return { url, emailed: result.ok };
}
