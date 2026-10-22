import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { applyRulesToUncategorized } from "@/lib/categorization/auto-apply";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { apiError, validationError } from "@/lib/http";
import { decodeTransactionCursor, TRANSACTION_PAGE_DEFAULT, TRANSACTION_PAGE_MAX } from "@/lib/liquidity/transactions-list";
import { loadTransactionPage, loadTransactionRows, withTransactionLogos } from "@/lib/liquidity/transactions-list.server";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ["uscita", "entrata", "tutte"] as const;
type TypeParam = (typeof VALID_TYPES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/transactions — two modes.
 * - Legacy (web): `?from&to&type` → array of every transaction in the window, filtered by direction (default
 *   "uscita"), newest first. Each row has `logoPath` (merchant logo as in Categorizza, or null).
 * - Paged (native apps, gaps.md G4): with `limit` (1–200) or `cursor` → `{ items, nextCursor }`, ordered by date then id
 *   descending. `from`/`to` optional, `type` defaults to "tutte", filters `accountId`, `categoryId`, `q` (description or
 *   note) and `uncategorized=1` (fallback category), the same as the Movimenti screen.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const params = new URL(request.url).searchParams;
  const paged = params.has("limit") || params.has("cursor");
  const from = params.get("from");
  const to = params.get("to");
  if (!paged && (!from || !to)) {
    return apiError(400, "invalid_date_range", "from e to sono obbligatori (YYYY-MM-DD)");
  }
  if ((from && !DATE_FORMAT.test(from)) || (to && !DATE_FORMAT.test(to))) {
    return apiError(400, "invalid_date", "from e to devono avere formato YYYY-MM-DD");
  }

  const typeParam = (params.get("type") ?? (paged ? "tutte" : "uscita")) as TypeParam;
  if (!VALID_TYPES.includes(typeParam)) {
    return apiError(400, "invalid_type", "type deve essere uno tra uscita, entrata, tutte");
  }

  if (!paged) {
    const rows = await loadTransactionRows(session.user.id, { from, to, direction: typeParam });
    return Response.json(await withTransactionLogos(rows, session.user.id));
  }

  const limit = params.has("limit") ? Number(params.get("limit")) : TRANSACTION_PAGE_DEFAULT;
  if (!Number.isInteger(limit) || limit < 1 || limit > TRANSACTION_PAGE_MAX) {
    return apiError(400, "validation_failed", `limit deve essere un intero tra 1 e ${TRANSACTION_PAGE_MAX}`, { field: "limit" });
  }
  const rawCursor = params.get("cursor");
  const cursor = rawCursor ? decodeTransactionCursor(rawCursor) : null;
  if (rawCursor && !cursor) return apiError(400, "invalid_cursor", "Cursore non valido");
  const accountId = params.get("accountId");
  const categoryId = params.get("categoryId");
  for (const [field, value] of [["accountId", accountId], ["categoryId", categoryId]] as const) {
    if (value && !UUID.test(value)) return apiError(400, "validation_failed", `${field} non valido`, { field });
  }
  const page = await loadTransactionPage(session.user.id, {
    from,
    to,
    limit,
    cursor,
    direction: typeParam,
    accountId,
    categoryId,
    searchText: params.get("q") ?? "",
    uncategorizedOnly: params.get("uncategorized") === "1",
  });
  return Response.json(page);
}

/**
 * POST /api/transactions — crea una transazione manuale; il segno salvato è derivato dal type della categoria scelta
 * (entrata → positivo, gruppi di spesa → negato). Una categoria scelta è una scelta dell'utente; se resta «Da
 * categorizzare», le regole si applicano subito come per i movimenti della banca.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);
  const demoBlock = await rejectIfDemoActive(session.user.id, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, session.user.id)));
  if (!account) {
    return apiError(400, "invalid_account", "Conto non valido");
  }
  if (account.source === "auto") {
    return apiError(400, "linked_account_read_only", "Non si può aggiungere una spesa manuale a un conto collegato");
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return apiError(400, "invalid_category", "Categoria non valida");
  }

  const signedAmount = (category.type === "entrata" || (category.type === "trasferimento" && parsed.data.direction === "entrata")) ? parsed.data.amount : -parsed.data.amount;

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: signedAmount.toFixed(2),
      excludedAmount: category.type === "trasferimento" ? signedAmount.toFixed(2) : "0",
      date: parsed.data.date,
      source: "manuale",
      ...(category.isFallback ? {} : { categorySource: "utente" as const, categorizedAt: new Date() }),
    })
    .returning();

  if (!category.isFallback) return Response.json(transaction, { status: 201 });
  const applied = await applyRulesToUncategorized(session.user.id, { log: requestLogger() });
  if (applied === 0) return Response.json(transaction, { status: 201 });
  const [categorized] = await db.select().from(transactions).where(eq(transactions.id, transaction.id));
  return Response.json(categorized ?? transaction, { status: 201 });
}

export const GET = withRoute("transactions.list", handleGet);
export const POST = withRoute("transactions.create", handlePost);
