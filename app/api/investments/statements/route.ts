import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Authenticated statement history with broker valuations and cash ledger. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const statements = await db.select({ id: brokerStatements.id, accountKey: brokerStatements.accountKey, portfolioId: brokerStatements.portfolioId, createdAt: brokerStatements.createdAt, statement: brokerStatements.statement }).from(brokerStatements).where(eq(brokerStatements.userId, session.user.id)).orderBy(desc(brokerStatements.to));
  return Response.json({ statements }, { headers: { "Cache-Control": "no-store" } });
}
export const GET = withRoute("investments.statements", handleGet);
