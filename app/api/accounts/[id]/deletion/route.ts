import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { AccountDeletionError, previewAccountDeletion } from "@/lib/liquidity/account-deletion.server";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** What deleting the account removes (cash movements, operations, portfolios, imports) and the token to confirm it with. */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "account_not_found", "Conto non trovato");
  try {
    return Response.json(await previewAccountDeletion(session.user.id, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccountDeletionError) return apiError(404, "account_not_found", error.message);
    throw error;
  }
}

export const GET = withRoute("accounts.deletion_preview", handleGet);
