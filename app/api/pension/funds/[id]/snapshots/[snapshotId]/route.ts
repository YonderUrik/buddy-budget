import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pensionSnapshots } from "@/lib/db/schema/pension";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

type Params = { params: Promise<{ id: string; snapshotId: string }> };

/** Elimina una fotografia di un fondo dell'utente. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id, snapshotId } = await params;
  const deleted = await db
    .delete(pensionSnapshots)
    .where(and(eq(pensionSnapshots.id, snapshotId), eq(pensionSnapshots.fundId, id), eq(pensionSnapshots.userId, session.user.id)))
    .returning({ id: pensionSnapshots.id });
  if (deleted.length === 0) return Response.json({ error: "Fotografia non trovata" }, { status: 404 });
  requestLogger().info("pension.snapshot.deleted");
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("pension.snapshots.delete", handleDelete);
