import { NextRequest } from "next/server";
import { countUserData } from "@/lib/account/lifecycle";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { withRoute } from "@/lib/observability";

/** Quanti dati possiede l'utente (solo conteggi), mostrato prima di esportare, resettare o eliminare. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  return Response.json(await countUserData(session.user.id));
}

export const GET = withRoute("user.data_summary", handleGet);
