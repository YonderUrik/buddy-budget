import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { resolveProfile } from "@/lib/localization/config";
import { buildWhatsNew } from "@/lib/views";

/** Most dismissed ids read from the query (the list only grows by a few entries a month). */
const MAX_DISMISSED = 100;

/**
 * GET /api/whats-new?dismissed=id1,id2 — the «Novità» entries for the user's country and language (gaps.md G14): the
 * recent ones and `current`, the one the Overview card shows. Dismissals stay on the device, as on the web
 * (`bb:whats-new-dismissed`): pass them in `dismissed`. Entries released before the user's sign-up are left out (web #444). Entries carry web `href`s for the app to map to its routes.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { productCountry, language } = resolveProfile(session.user);
  const dismissed = (request.nextUrl.searchParams.get("dismissed") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_DISMISSED);
  const since = session.user.createdAt ? new Date(session.user.createdAt) : undefined;
  return Response.json(buildWhatsNew({ language, productCountry, dismissed, now: new Date(), since }));
}

export const GET = withRoute("whats_new.get", handleGet);
