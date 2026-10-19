import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { ACCESS_CODE_MAX_LENGTH, resolvePlan, type AccessCodeRejection } from "@/lib/billing";
import { consumeRedeemAttempt, planForUser, readBillingStatus, redeemAccessCode } from "@/lib/billing/server";
import { recordBillingAction, requestLogger, withRoute } from "@/lib/observability";

const REJECTIONS: Record<AccessCodeRejection, string> = {
  invalid: "Questo codice non esiste. Controlla di averlo scritto bene.",
  expired: "Questo codice è scaduto.",
  used_up: "Questo codice è già stato usato da tutte le persone previste.",
  already_redeemed: "Hai già usato questo codice.",
};

/** Redeems an access code (`{ code }`): free Pro for the code's days, or for good. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  if (!planForUser(session.user).enforced) return Response.json({ error: "Su questo account è già tutto sbloccato." }, { status: 409 });
  const body = (await readJson(request)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code || code.length > ACCESS_CODE_MAX_LENGTH) return Response.json({ error: REJECTIONS.invalid }, { status: 400 });
  if (!(await consumeRedeemAttempt(session.user.id))) {
    recordBillingAction("code_redeemed", "rejected");
    requestLogger().warn("billing.code.rejected", { reason: "rate_limited" });
    return Response.json({ error: "Troppi tentativi: riprova tra un'ora." }, { status: 429 });
  }
  const result = await redeemAccessCode(session.user.id, code);
  if (!result.ok) {
    recordBillingAction("code_redeemed", "rejected");
    requestLogger().info("billing.code.rejected", { reason: result.reason });
    return Response.json({ error: REJECTIONS[result.reason], code: result.reason }, { status: 400 });
  }
  recordBillingAction("code_redeemed", "ok");
  requestLogger().info("billing.code.redeemed", { grantSource: "code", reason: result.endsAt ? "timed" : "for_good" });
  const plan = resolvePlan({ proUntil: result.entitlement.proUntil, proSource: result.entitlement.source }, true);
  return Response.json({ ...(await readBillingStatus(session.user.id, plan)), forGood: result.endsAt === null });
}

export const POST = withRoute("billing.redeem", handlePost);
