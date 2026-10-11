import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { bindRequestUser, recordStartEvent, requestLogger, withRoute } from "@/lib/observability";
import { clearDemo, startDemo } from "@/lib/start/demo";

export const maxDuration = 30;

const START_ERRORS = {
  has_data: { error: "Hai già dei conti: i dati d'esempio sono per chi parte da zero.", status: 409 },
  already_active: { error: "I dati d'esempio sono già attivi.", status: 409 },
  no_categories: { error: "Completa prima la configurazione iniziale.", status: 409 },
} as const;

/** Crea i dati d'esempio (solo se l'utente non ha ancora conti). */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const result = await startDemo(session.user.id);
  if (!result.ok) {
    requestLogger().info("onboarding.demo.rejected", { reason: result.reason });
    const { error, status } = START_ERRORS[result.reason];
    return Response.json({ error }, { status });
  }
  recordStartEvent("demo_started");
  requestLogger().info("onboarding.demo.started", { count: result.transactions });
  return Response.json({ accounts: result.accounts, transactions: result.transactions }, { status: 201 });
}

/** Azzera i dati d'esempio in un colpo solo. */
async function handleDelete(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const removed = await clearDemo(session.user.id);
  if (removed > 0) {
    recordStartEvent("demo_cleared");
    requestLogger().info("onboarding.demo.cleared", { deleted: removed });
  }
  return new Response(null, { status: 204 });
}

export const POST = withRoute("start.demo.start", handlePost);
export const DELETE = withRoute("start.demo.clear", handleDelete);
