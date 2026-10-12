import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { applyRecategorize, lastUndoableRun, previewRecategorize } from "@/lib/categorization/recategorize";
import type {
  RecategorizeApplyResponse,
  RecategorizePreviewResponse,
  RecategorizeScope,
} from "@/lib/categorization/recategorize-plan";
import { requestLogger, withRoute } from "@/lib/observability";
import { recategorizeApplySchema } from "@/lib/validation/categorization-rules";

/** Ambito dalla query: `?scope=regola&ruleId=…` oppure `tutto` (con `legacy=1` per includere i movimenti più vecchi). */
function scopeFromQuery(params: URLSearchParams): RecategorizeScope | null {
  if (params.get("scope") === "regola") {
    const ruleId = params.get("ruleId");
    return ruleId && /^[0-9a-f-]{36}$/i.test(ruleId) ? { kind: "regola", ruleId } : null;
  }
  return { kind: "tutto", includeLegacy: params.get("legacy") === "1" };
}

/**
 * GET /api/transactions/recategorize — anteprima di «Ricategorizza»: i movimenti già categorizzati da soli (e, se
 * chiesto, quelli più vecchi) la cui categoria cambierebbe con le regole e le proposte sicure di oggi, raggruppati per
 * esercente. Non scrive nulla e non chiama l'assistente.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const scope = scopeFromQuery(request.nextUrl.searchParams);
  if (!scope) return Response.json({ error: "Regola non valida" }, { status: 400 });

  const preview = await previewRecategorize(userId, scope);
  const groups = await withMerchantLogos(
    preview.plan.groups,
    (group) => ({
      label: group.label,
      texts: group.transactionIds.flatMap((id) => {
        const row = preview.rowsById.get(id);
        return row ? [row.description, row.rawDescription] : [];
      }),
      isExpense: group.totalAmount < 0,
    }),
    userId
  );
  const lastRun = await lastUndoableRun(userId);
  requestLogger().info("categorization.recategorize.previewed", { kind: scope.kind, count: preview.plan.changes, total: groups.length });

  const body: RecategorizePreviewResponse = {
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      fromCategoryId: group.fromCategoryId,
      toCategoryId: group.toCategoryId,
      source: group.source,
      confidence: group.confidence,
      count: group.transactionIds.length,
      legacyCount: group.legacyCount,
      firstDate: group.firstDate,
      lastDate: group.lastDate,
      totalAmount: group.totalAmount,
      logoPath: group.logoPath,
    })),
    changes: preview.plan.changes,
    legacyChanges: preview.plan.legacyChanges,
    legacyAvailable: preview.legacyAvailable,
    autoApply: preview.autoApply,
    lastRun: lastRun ? { id: lastRun.id, changed: lastRun.changed, createdAt: lastRun.createdAt.toISOString() } : null,
  };
  return Response.json(body);
}

/**
 * POST /api/transactions/recategorize — applica «Ricategorizza» ai gruppi scelti (o a tutti), ricalcolando il piano sui
 * dati di adesso. Sincrona: solo letture e scritture sul DB, niente chiamate esterne (deroga allo standard dei job in
 * background annotata nella decisione del 2026-10-12). Si annulla con `/undo`.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = recategorizeApplySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { scope: kind, includeLegacy, ruleId, groupKeys } = parsed.data;
  const scope: RecategorizeScope = kind === "regola" ? { kind, ruleId: ruleId! } : { kind, includeLegacy };
  const log = requestLogger();

  try {
    const result = await applyRecategorize(session.user.id, scope, groupKeys ?? null);
    log.info("categorization.recategorize.applied", { kind, count: result.changed, total: result.groups });
    const body: RecategorizeApplyResponse = { runId: result.runId, changed: result.changed, groups: result.groups };
    return Response.json(body);
  } catch (error) {
    log.error("categorization.recategorize.failed", { kind, error });
    return Response.json({ error: "Non è stato possibile ricategorizzare. Riprova." }, { status: 500 });
  }
}

export const GET = withRoute("transactions.recategorize_preview", handleGet);
export const POST = withRoute("transactions.recategorize_apply", handlePost);
