import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { recordSupportReport, requestLogger, withRoute } from "@/lib/observability";
import { newReportReference, reportInputSchema } from "@/lib/support";
import { consumeReportQuota, sendSupportReport } from "@/lib/support/send";

/**
 * Riceve una segnalazione dall'utente (problema, domanda, idea) e la gira alla casella di supporto con il suo
 * indirizzo come reply-to. Risponde con un codice di riferimento; nei log non finiscono testo né email.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;

  const parsed = reportInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Segnalazione non valida." }, { status: 400 });
  }
  const log = requestLogger();
  if (!(await consumeReportQuota(session.user.id))) {
    recordSupportReport(parsed.data.kind, "rate_limited");
    log.warn("support.report.rate_limited", { reportKind: parsed.data.kind });
    return Response.json({ error: "Hai già inviato diverse segnalazioni: riprova tra un po'." }, { status: 429 });
  }

  const reference = newReportReference();
  const result = await sendSupportReport({
    reference,
    input: parsed.data,
    userEmail: session.user.email,
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) {
    recordSupportReport(parsed.data.kind, "failed");
    log.error("support.report.failed", { reportKind: parsed.data.kind, reason: result.reason, reference });
    return Response.json({ error: "Non siamo riusciti a inviare la segnalazione. Riprova o scrivi a supporto@buddybudget.io." }, { status: 502 });
  }
  recordSupportReport(parsed.data.kind, "sent");
  log.info("support.report.sent", { reportKind: parsed.data.kind, reference, withContext: parsed.data.context !== undefined });
  return Response.json({ reference }, { status: 201 });
}

export const POST = withRoute("support.report", handlePost);
