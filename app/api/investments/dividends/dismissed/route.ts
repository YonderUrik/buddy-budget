import { NextRequest } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userDismissedDividends } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { dismissDividendSchema, type DismissDividendInput } from "@/lib/validation/investments";

type ReadResult = { ok: false; response: Response } | { ok: true; userId: string; input: DismissDividendInput };

async function readInput(request: NextRequest): Promise<ReadResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false, response: new Response(null, { status: 401 }) };
  bindRequestUser(session.user.id);
  const parsed = dismissDividendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { ok: false, response: Response.json({ error: parsed.error.issues[0].message }, { status: 400 }) };
  return { ok: true, userId: session.user.id, input: parsed.data };
}

/** Ignora una o più proposte "dividendo o cedola da registrare": non verranno più proposte. Idempotente. */
async function handlePost(request: NextRequest) {
  const read = await readInput(request);
  if (!read.ok) return read.response;
  const { userId, input } = read;
  for (const instrumentId of new Set(input.items.map((i) => i.instrumentId))) {
    if (!(await findVisibleInstrument(userId, instrumentId))) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  }
  await db
    .insert(userDismissedDividends)
    .values(input.items.map((item) => ({ userId, ...item })))
    .onConflictDoNothing();
  return Response.json(input, { status: 201 });
}

/** Annulla "Ignora": le proposte tornano visibili. */
async function handleDelete(request: NextRequest) {
  const read = await readInput(request);
  if (!read.ok) return read.response;
  const { userId, input } = read;
  const byInstrument = new Map<string, string[]>();
  for (const item of input.items) byInstrument.set(item.instrumentId, [...(byInstrument.get(item.instrumentId) ?? []), item.date]);
  await db
    .delete(userDismissedDividends)
    .where(
      and(
        eq(userDismissedDividends.userId, userId),
        or(
          ...[...byInstrument].map(([instrumentId, dates]) =>
            and(eq(userDismissedDividends.instrumentId, instrumentId), inArray(userDismissedDividends.date, dates))
          )
        )
      )
    );
  return new Response(null, { status: 204 });
}

export const POST = withRoute("dividends.dismiss", handlePost);
export const DELETE = withRoute("dividends.restore", handleDelete);
