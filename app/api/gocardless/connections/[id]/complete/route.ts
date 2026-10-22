import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { GoCardlessError } from "@/lib/gocardless/client";
import { completeConnection } from "@/lib/gocardless/complete";
import { apiError } from "@/lib/http";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/**
 * Finalizes the consent step for an authenticated client (R6 of the mobile spec): the native apps call it after the
 * system browser hands back `buddybudget://bank/return?ref=<id>`, since the native callback never touches state.
 * Answers the accounts to select (same shape as `GET …/accounts`); the app then calls `POST …/finalize`.
 * Idempotent: calling it again on a linked connection answers the same accounts and keeps the consent expiry.
 */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();

  const { id } = await params;
  try {
    const result = await completeConnection(session.user.id, id);
    switch (result.kind) {
      case "not_found":
        return apiError(404, "bank_connection_not_found", "Collegamento con la banca non trovato");
      case "pending":
        log.info("gocardless.connection.complete_pending", { connectionId: id, reason: result.requisitionStatus });
        return apiError(409, "bank_consent_pending", "Il consenso con la banca non è ancora completo", { requisitionStatus: result.requisitionStatus });
      case "failed":
        log.info("gocardless.connection.complete_failed", { connectionId: id, reason: result.requisitionStatus });
        return apiError(422, "bank_consent_failed", "La banca non ha confermato il consenso", { requisitionStatus: result.requisitionStatus });
      case "linked":
        log.info("gocardless.connection.completed", { connectionId: id, count: result.accounts.externalAccounts.length });
        return Response.json({
          connectionId: result.connection.id,
          status: "linked",
          institutionId: result.connection.institutionId,
          institutionName: result.connection.institutionName,
          consentExpiresAt: result.connection.consentExpiresAt?.toISOString() ?? null,
          ...result.accounts,
        });
    }
  } catch (error) {
    if (error instanceof GoCardlessError) {
      log.warn("gocardless.connection.complete_unavailable", { connectionId: id, error });
      return apiError(502, "bank_unavailable", "Banca non raggiungibile, riprova tra poco");
    }
    throw error;
  }
}

export const POST = withRoute("gocardless.connections.complete", handlePost);
