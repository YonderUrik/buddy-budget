import { NextRequest } from "next/server";
import { and, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";
import { bindRequestUser, withRoute } from "@/lib/observability";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ["uscita", "entrata", "tutte"] as const;
type TypeParam = (typeof VALID_TYPES)[number];

/** GET /api/transactions?from&to&type — ritorna le transazioni dell'utente autenticato nel periodo indicato, filtrate per direzione (default "uscita", retrocompatibile). */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "from e to sono obbligatori (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to devono avere formato YYYY-MM-DD" }, { status: 400 });
  }

  const typeParam = (url.searchParams.get("type") ?? "uscita") as TypeParam;
  if (!VALID_TYPES.includes(typeParam)) {
    return Response.json({ error: "type deve essere uno tra uscita, entrata, tutte" }, { status: 400 });
  }

  const directionCondition =
    typeParam === "uscita" ? lt(transactions.amount, "0") : typeParam === "entrata" ? gt(transactions.amount, "0") : undefined;

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, from),
        lte(transactions.date, to),
        ...(directionCondition ? [directionCondition] : [])
      )
    )
    .orderBy(desc(transactions.date));

  return Response.json(rows);
}

/** POST /api/transactions — crea una transazione manuale; il segno salvato è derivato dal type della categoria scelta (entrata → positivo, gruppi di spesa → negato). */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, session.user.id)));
  if (!account) {
    return Response.json({ error: "Conto non valido" }, { status: 400 });
  }
  if (account.source === "auto") {
    return Response.json(
      { error: "Non è possibile aggiungere una spesa manuale a un conto collegato automaticamente" },
      { status: 400 }
    );
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return Response.json({ error: "Categoria non valida" }, { status: 400 });
  }

  const signedAmount = category.type === "entrata" ? parsed.data.amount : -parsed.data.amount;

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: signedAmount.toFixed(2),
      date: parsed.data.date,
      source: "manuale",
    })
    .returning();

  return Response.json(transaction, { status: 201 });
}

export const GET = withRoute("transactions.list", handleGet);
export const POST = withRoute("transactions.create", handlePost);
