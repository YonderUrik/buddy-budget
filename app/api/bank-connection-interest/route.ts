import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { resolveProfile } from "@/lib/localization/config";
import { registerBankInterest, withdrawBankInterest } from "@/lib/gocardless/interest";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** «Tienimi aggiornato»: records that this person wants to be told when new bank connections open (idempotent). */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const { created } = await registerBankInterest(session.user.id, resolveProfile(session.user).productCountry);
  requestLogger().info("bank.interest.registered", { outcome: created ? "created" : "already" });
  return Response.json({ interested: true }, { status: created ? 201 : 200 });
}

/** «Non avvisarmi più»: withdraws the request. */
async function handleDelete(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const { removed } = await withdrawBankInterest(session.user.id);
  requestLogger().info("bank.interest.withdrawn", { outcome: removed ? "removed" : "absent" });
  return Response.json({ interested: false });
}

export const POST = withRoute("bank_interest.register", handlePost);
export const DELETE = withRoute("bank_interest.withdraw", handleDelete);
