import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { inviteMember } from "@/lib/households/invite-mail";
import { householdErrorResponse } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { createInviteSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string; memberId: string }> };

/**
 * Invites someone added by name to take their place with an account. With an email the app sends it; without, the
 * screen shares the link (WhatsApp). Answers the link either way.
 */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();
  const parsed = createInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, memberId } = await params;
  const email = parsed.data.email?.trim().toLowerCase() || null;
  try {
    const { url, emailed } = await inviteMember(session.user, id, memberId, email);
    recordHouseholdAction("invite_sent");
    log.info("household.invite.created", { outcome: email ? (emailed ? "emailed" : "email_failed") : "link" });
    return Response.json({ url, emailed }, { status: 201 });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    log.info("household.invite.rejected", { reason: (error as { code: string }).code });
    return response;
  }
}

export const POST = withRoute("households.invite", handlePost);
