import { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { isValidExcludedAmount, transactions } from "@/lib/db/schema/transactions";
import { updateTransactionSchema } from "@/lib/validation/transactions";
import { countAutoCorrections } from "@/lib/categorization/auto-corrections";
import { isAutomaticCategorySource } from "@/lib/categorization/category-source";
import { bindRequestUser, recordCategorizationAutoCorrected, requestLogger, withRoute } from "@/lib/observability";
import { loadTransactionDetail } from "@/lib/transactions/load-detail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recupera una transazione solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedTransaction(userId: string, transactionId: string) {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return transaction ?? null;
}

/**
 * GET /api/transactions/[id] — the detail of one of the user's transactions: the row with its merchant logo, account,
 * origin (bank, file import, broker statement, sample data or typed by hand), the rule that set its category and the
 * same merchant over the last year. 404 when it does not exist or belongs to someone else.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const detail = UUID.test(id) ? await loadTransactionDetail(session.user.id, id) : null;
  if (!detail) {
    requestLogger().info("transactions.detail.not_found");
    return new Response(null, { status: 404 });
  }
  requestLogger().info("transactions.detail.loaded", { outcome: detail.origin.kind });
  return Response.json(detail);
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
    return apiError(404, "transaction_not_found", "Movimento non trovato");
  }

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (transaction.source === "auto" && MANUAL_ONLY_FIELDS.some((field) => field in parsed.data)) {
    return apiError(403, "linked_transaction_field_locked", 'Per una transazione automatica sono modificabili solo categoria e "Dividi"');
  }

  let resolvedCategory: typeof categories.$inferSelect | null = null;
  if (parsed.data.categoryId !== undefined) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
    if (!category) {
      return apiError(400, "invalid_category", "Categoria non valida");
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
      return apiError(400, "category_direction_mismatch", "La categoria scelta non è compatibile con la direzione della transazione");
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
      return apiError(400, "invalid_excluded_amount", "Quota esclusa non valida");
    }
  }

  // Cambiare categoria a mano la rende una scelta dell'utente (esce da «Messe dall'app»); tornare a «Da categorizzare» la azzera.
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
    return apiError(404, "transaction_not_found", "Movimento non trovato");
  }

  if (transaction.source === "auto") {
    return apiError(400, "linked_transaction_not_deletable", "Una transazione automatica non può essere eliminata");
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response(null, { status: 204 });
}

export const GET = withRoute("transactions.detail", handleGet);
export const PATCH = withRoute("transactions.update", handlePatch);
export const DELETE = withRoute("transactions.delete", handleDelete);
