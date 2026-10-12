import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { isValidExcludedAmount, transactions } from "@/lib/db/schema/transactions";
import { updateTransactionSchema } from "@/lib/validation/transactions";
import { countAutoCorrections } from "@/lib/categorization/auto-corrections";
import { isAutomaticCategorySource } from "@/lib/categorization/category-source";
import { bindRequestUser, recordCategorizationAutoCorrected, requestLogger, withRoute } from "@/lib/observability";

/** Recupera una transazione solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedTransaction(userId: string, transactionId: string) {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return transaction ?? null;
}

const MANUAL_ONLY_FIELDS = ["description", "amount", "date"] as const;

/**
 * Aggiorna una transazione del proprio utente; 404 se non propria. Per una transazione "auto" sono
 * modificabili solo categoria ed excludedAmount ("Dividi"): un tentativo di cambiare descrizione,
 * importo o data risponde 403.
 */
async function handlePatch(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (transaction.source === "auto" && MANUAL_ONLY_FIELDS.some((field) => field in parsed.data)) {
    return Response.json(
      { error: 'Per una transazione automatica sono modificabili solo categoria e "Dividi"' },
      { status: 403 }
    );
  }

  let resolvedCategory: typeof categories.$inferSelect | null = null;
  if (parsed.data.categoryId !== undefined) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
    if (!category) {
      return Response.json({ error: "Categoria non valida" }, { status: 400 });
    }
    resolvedCategory = category;
  }

  const [currentCategory] = await db.select().from(categories).where(
    and(eq(categories.id, transaction.categoryId), eq(categories.userId, session.user.id))
  );
  const isTransfer = (resolvedCategory ?? currentCategory)?.type === "trasferimento";
  const wasTransfer = currentCategory?.type === "trasferimento";

  const currentIsIncome = Number(transaction.amount) > 0;

  // Se si cambia categoria senza toccare l'importo, la nuova categoria deve avere una direzione
  // compatibile con il segno già salvato (a meno che sia la categoria fallback, che non ha una
  // direzione propria e può accogliere transazioni di entrambi i segni).
  if (resolvedCategory && parsed.data.amount === undefined && !resolvedCategory.isFallback && !isTransfer) {
    const newCategoryIsIncome = resolvedCategory.type === "entrata";
    if (newCategoryIsIncome !== currentIsIncome) {
      return Response.json(
        { error: "La categoria scelta non è compatibile con la direzione della transazione" },
        { status: 400 }
      );
    }
  }

  // Direzione da usare per il segno del nuovo importo: quella della categoria appena assegnata
  // (se non fallback), altrimenti quella già in vigore sulla transazione.
  const signIsIncome =
    resolvedCategory && !resolvedCategory.isFallback && !isTransfer ? resolvedCategory.type === "entrata" : currentIsIncome;

  const newAmount =
    parsed.data.amount !== undefined
      ? signIsIncome
        ? parsed.data.amount
        : -parsed.data.amount
      : Number(transaction.amount);
  let newExcludedAmount: number | undefined;
  if (parsed.data.excludedAmount !== undefined) {
    const magnitude = Math.abs(parsed.data.excludedAmount);
    newExcludedAmount = newAmount >= 0 ? magnitude : -magnitude;
  }

  // Un giroconto è sempre escluso per intero; ricategorizzandolo torna a contare normalmente.
  if (isTransfer) newExcludedAmount = newAmount;
  else if (wasTransfer && parsed.data.excludedAmount === undefined) newExcludedAmount = 0;

  // Se amount e/o excludedAmount cambiano, rivalida l'invariante |excludedAmount| ≤ |amount| contro
  // l'importo che risulterà DOPO l'update: l'excludedAmount appena inviato se presente in questa stessa
  // PATCH, altrimenti quello già salvato sulla transazione (che altrimenti resterebbe non ricontrollato
  // se si modifica solo amount — vedi finding di review finale).
  if (parsed.data.amount !== undefined || parsed.data.excludedAmount !== undefined) {
    const excludedAmountToValidate =
      newExcludedAmount !== undefined ? newExcludedAmount : Number(transaction.excludedAmount);
    if (!isValidExcludedAmount(newAmount, excludedAmountToValidate)) {
      return Response.json({ error: "Quota esclusa non valida" }, { status: 400 });
    }
  }

  // Cambiare categoria a mano la rende una scelta dell'utente (esce da «Fatte da sole»); tornare a «Da categorizzare» la azzera.
  const now = new Date();
  const categoryChanged = resolvedCategory !== null && resolvedCategory.id !== transaction.categoryId;
  // Anche cambiare a mano la quota esclusa («Dividi») di una categoria messa da sola la rende una scelta dell'utente:
  // «Ricategorizza» non deve rifarla.
  const splitByHand =
    !categoryChanged &&
    parsed.data.excludedAmount !== undefined &&
    newExcludedAmount !== Number(transaction.excludedAmount) &&
    isAutomaticCategorySource(transaction.categorySource);
  const origin = categoryChanged
    ? resolvedCategory!.isFallback
      ? { categorySource: null, categoryConfidence: null, categorizedAt: null }
      : { categorySource: "utente" as const, categoryConfidence: null, categorizedAt: now }
    : splitByHand
      ? { categorySource: "utente" as const, categoryConfidence: null, categorizedAt: now }
      : {};

  const { amount, excludedAmount, ...rest } = parsed.data;
  const [updated] = await db
    .update(transactions)
    .set({
      ...rest,
      ...origin,
      ...(amount !== undefined ? { amount: newAmount.toFixed(2) } : {}),
      ...(newExcludedAmount !== undefined ? { excludedAmount: newExcludedAmount.toFixed(2) } : {}),
      updatedAt: now,
    })
    .where(eq(transactions.id, id))
    .returning();

  if (categoryChanged) {
    for (const [source, count] of countAutoCorrections([{ before: transaction, categoryId: resolvedCategory!.id }])) {
      recordCategorizationAutoCorrected(source, count);
      requestLogger().info("categorization.auto.corrected", { categorySource: source, count });
    }
  }

  return Response.json(updated);
}

/** Elimina una transazione manuale del proprio utente; 404 se non propria, 400 se auto. */
async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  if (transaction.source === "auto") {
    return Response.json({ error: "Una transazione automatica non può essere eliminata" }, { status: 400 });
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("transactions.update", handlePatch);
export const DELETE = withRoute("transactions.delete", handleDelete);
