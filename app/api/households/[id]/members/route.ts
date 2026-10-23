import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { inviteMember } from "@/lib/households/invite-mail";
import { addPerson, householdErrorResponse } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { addPersonSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string }> };

/**
 * Adds someone to the group by name: expenses can be split with them at once, also if they never sign up. With an
 * email the app also invites them, so they can take their place with their own account.
 */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();
  const parsed = addPersonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const householdId = (await params).id;
  const email = parsed.data.email?.trim().toLowerCase() || null;
  try {
    const memberId = await addPerson(session.user.id, householdId, parsed.data.name);
    recordHouseholdAction("person_added");
    const invite = email ? await inviteMember(session.user, householdId, memberId, email) : null;
    if (invite) recordHouseholdAction("invite_sent");
    log.info("household.person.added", { outcome: invite ? (invite.emailed ? "emailed" : "email_failed") : "name_only" });
    return Response.json({ id: memberId, url: invite?.url ?? null, emailed: invite?.emailed ?? false }, { status: 201 });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    log.info("household.person.rejected", { reason: (error as { code: string }).code });
    return response;
  }
}

export const POST = withRoute("households.person_add", handlePost);
