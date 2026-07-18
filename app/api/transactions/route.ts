import { NextRequest } from "next/server";
import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/transactions?from&to — ritorna le spese (amount < 0) dell'utente autenticato nel periodo indicato. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "from e to sono obbligatori (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to devono avere formato YYYY-MM-DD" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        lt(transactions.amount, "0"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .orderBy(desc(transactions.date));

  return Response.json(rows);
}

/** POST /api/transactions — crea una spesa manuale (l'importo positivo inserito viene negato prima del salvataggio). */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

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

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: (-parsed.data.amount).toFixed(2),
      date: parsed.data.date,
      source: "manuale",
    })
    .returning();

  return Response.json(transaction, { status: 201 });
}
