import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { households } from "@/lib/db/schema/households";
import { sendEmail } from "@/lib/email/send";
import { inviteEmailContent } from "@/lib/households/email";
import { createInvite, householdErrorResponse } from "@/lib/households/server";
import { inviteUrl } from "@/lib/households/tokens";
import { resolveProfile } from "@/lib/localization/config";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { createInviteSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string }> };

/**
 * New invitation for the group. With an email the app sends it; without, the screen copies the link (WhatsApp).
 * Answers the link either way, so the inviter can also share it by hand.
 */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();
  const parsed = createInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const householdId = (await params).id;
  const email = parsed.data.email?.trim().toLowerCase() || null;
  let token: string;
  try {
    ({ token } = await createInvite(session.user.id, householdId, email));
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    log.info("household.invite.rejected", { reason: (error as { code: string }).code });
    return response;
  }
  const url = inviteUrl(token);
  let emailed = false;
  if (email) {
    const [group] = await db.select({ name: households.name }).from(households).where(eq(households.id, householdId));
    const content = inviteEmailContent({
      inviterName: session.user.name.split(" ")[0] || session.user.name,
      householdName: group?.name ?? "",
      url,
      appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
      language: resolveProfile(session.user).language,
    });
    const result = await sendEmail({ to: email, ...content });
    emailed = result.ok;
    if (!result.ok) log.warn("household.invite.email_failed", { reason: result.reason });
  }
  recordHouseholdAction("invite_sent");
  log.info("household.invite.created", { outcome: email ? (emailed ? "emailed" : "email_failed") : "link" });
  return Response.json({ url, emailed }, { status: 201 });
}

export const POST = withRoute("households.invite", handlePost);
