import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentTaxCarryforwards } from "@/lib/db/schema/investments";
import { getOrCreateDefaultPortfolio } from "@/lib/investments/data";
import { todayKey } from "@/lib/investments/operations";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createTaxCarryforwardSchema } from "@/lib/validation/investments";

/** Aggiunge una minusvalenza pregressa allo zaino (anno di origine, importo nella valuta dell'utente). */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createTaxCarryforwardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { year, amount, note } = parsed.data;
  if (year > Number(todayKey().slice(0, 4))) return Response.json({ error: "L'anno non può essere futuro" }, { status: 400 });

  const portfolio = await getOrCreateDefaultPortfolio(userId);
  const [created] = await db
    .insert(investmentTaxCarryforwards)
    .values({ userId, portfolioId: portfolio.id, year, amount: amount.toFixed(2), note: note ?? null })
    .returning({
      id: investmentTaxCarryforwards.id,
      year: investmentTaxCarryforwards.year,
      amount: investmentTaxCarryforwards.amount,
      note: investmentTaxCarryforwards.note,
    });
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("tax_carryforwards.create", handlePost);
