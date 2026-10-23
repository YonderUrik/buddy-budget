import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadAccountsSharedWithMe, loadMySharedAccountGroups } from "@/lib/households/data";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** For Conti: others' accounts shown to the viewer, and the groups each of the viewer's accounts is shown to. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const [withMe, mine] = await Promise.all([loadAccountsSharedWithMe(session.user.id), loadMySharedAccountGroups(session.user.id)]);
  return Response.json({ withMe, mine });
}

export const GET = withRoute("households.shared_accounts", handleGet);
