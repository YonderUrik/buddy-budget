import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { transactions } from "@/lib/db/schema/transactions";
import { JEV_BATCH_SIZE, JEV_DEFAULT_MODEL, classifyWithJev, type JevMerchant } from "@/lib/llm/jev";
import { logger, recordCategorizationAiRequest, recordCategorizationSuggestions, type Logger } from "@/lib/observability";
import { groupForModel, pickExamples, type MerchantGroup } from "./groups";

/** Versione del prompt e dello stato inviato: va incrementata a ogni modifica che può cambiare le risposte. */
export const AI_PROMPT_VERSION = 1;
/** Tetto di esercenti nuovi per esecuzione: argine alla spesa dopo un import molto grande. */
export const MAX_GROUPS_PER_RUN = 120;
/** Tetto per la richiesta manuale («Categorizza con l'AI»): l'utente la chiede apposta per tutto l'arretrato. */
export const MAX_GROUPS_MANUAL_RUN = 600;
/** Tempo massimo di una richiesta manuale, dentro il `maxDuration` della route (300 s). */
export const MANUAL_RUN_BUDGET_MS = 240_000;

export type SuggestOutcome = "disabled" | "no_key" | "nothing_to_do" | "done" | "failed";

export interface SuggestResult {
  outcome: SuggestOutcome;
  stored: number;
  blocked: number;
}

/** Modello usato per le categorie: configurabile, con Jev come predefinito. */
export function categorizationModel(): string {
  return process.env.CATEGORIZATION_MODEL?.trim() || JEV_DEFAULT_MODEL;
}

/**
 * Propone una categoria per ogni esercente ancora da categorizzare che non ha già una proposta, usando Jev.
 * Parte solo se l'utente ha acconsentito e c'è la chiave OpenRouter; qualunque errore del modello termina l'esecuzione
 * senza lanciare (le transazioni restano «Da categorizzare» e si riprova alla prossima occasione). Non scrive mai
 * categorie sulle transazioni: le proposte sono salvate a parte e l'utente le conferma in Categorizza.
 */
export async function suggestCategoriesForUser(
  userId: string,
  options: { log?: Logger; fetchImpl?: typeof fetch; maxGroups?: number; budgetMs?: number } = {}
): Promise<SuggestResult> {
  const log = options.log ?? logger;
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const result: SuggestResult = { outcome: "nothing_to_do", stored: 0, blocked: 0 };

  const [user] = await db
    .select({ consentAt: authUser.aiCategorizationConsentAt })
    .from(authUser)
    .where(eq(authUser.id, userId));
  if (!user?.consentAt) return { ...result, outcome: "disabled" };
  if (!apiKey) return { ...result, outcome: "no_key" };

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallback = userCategories.find((category) => category.isFallback);
  if (!fallback) return result;
  const options_ = userCategories.filter((category) => !category.isFallback);
  if (options_.length === 0) return result;

  const pending = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      rawDescription: transactions.rawDescription,
      mcc: transactions.merchantCategoryCode,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, fallback.id)));
  if (pending.length === 0) return result;

  const known = await db
    .select({ key: categorizationSuggestions.merchantKey, direction: categorizationSuggestions.direction })
    .from(categorizationSuggestions)
    .where(eq(categorizationSuggestions.userId, userId));
  const knownKeys = new Set(known.map((row) => `${row.key}::${row.direction}`));

  const groups = groupForModel(pending.map((row) => ({ ...row, amount: Number(row.amount) })));
  const fresh = groups.filter((group) => !knownKeys.has(`${group.merchantKey}::${group.direction}`));
  const sendable = fresh.filter((group) => !group.blocked).slice(0, options.maxGroups ?? MAX_GROUPS_PER_RUN);
  result.blocked = fresh.length - fresh.filter((group) => !group.blocked).length;
  recordCategorizationSuggestions("blocked", result.blocked);
  if (sendable.length === 0) return result;

  const exampleRows = await db
    .select({
      description: transactions.description,
      rawDescription: transactions.rawDescription,
      categoryId: transactions.categoryId,
      count: count(),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), ne(transactions.categoryId, fallback.id)))
    .groupBy(transactions.description, transactions.rawDescription, transactions.categoryId)
    .orderBy(sql`count(*) desc`)
    .limit(400);
  const nameById = new Map(options_.map((category) => [category.id, category.name]));
  const examples = pickExamples(exampleRows, nameById);
  const jevCategories = options_.map((category) => ({ name: category.name, type: category.type }));
  const idByName = new Map(options_.map((category) => [category.name, category.id]));
  const model = categorizationModel();
  const deadline = options.budgetMs ? Date.now() + options.budgetMs : Infinity;

  for (let start = 0; start < sendable.length; start += JEV_BATCH_SIZE) {
    if (Date.now() > deadline) break;
    const batch: MerchantGroup[] = sendable.slice(start, start + JEV_BATCH_SIZE);
    const merchants: JevMerchant[] = batch.map((group, index) => ({
      id: String(index),
      name: group.sendName,
      mcc: group.mcc,
      isIncome: group.direction === "entrata",
    }));

    const startedAt = Date.now();
    let decisions;
    try {
      ({ decisions } = await classifyWithJev(
        { merchants, categories: jevCategories, examples, model },
        { apiKey, fetchImpl: options.fetchImpl }
      ));
      recordCategorizationAiRequest("ok", Date.now() - startedAt);
    } catch (error) {
      recordCategorizationAiRequest("error", Date.now() - startedAt);
      log.warn("categorization.ai.request.failed", { error, count: batch.length });
      return { ...result, outcome: result.stored > 0 ? "done" : "failed" };
    }

    const rows = decisions.flatMap((decision) => {
      const group = batch[Number(decision.id)];
      const categoryId = idByName.get(decision.categoryName);
      if (!group || !categoryId) return [];
      return [
        {
          userId,
          merchantKey: group.merchantKey,
          direction: group.direction,
          categoryId,
          confidence: Math.min(1, Math.max(0, decision.confidence)).toFixed(4),
          model,
          promptVersion: AI_PROMPT_VERSION,
        },
      ];
    });
    if (rows.length > 0) {
      const inserted = await db
        .insert(categorizationSuggestions)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: categorizationSuggestions.id });
      result.stored += inserted.length;
    }
  }

  recordCategorizationSuggestions("stored", result.stored);
  log.info("categorization.ai.suggested", { count: result.stored, rejected: result.blocked, total: sendable.length });
  return { ...result, outcome: "done" };
}

/** Come sopra, ma non lancia mai: per i punti d'ingresso (sync, import) dove un guasto non deve toccare il lavoro principale. */
export async function suggestCategoriesSafely(
  userId: string,
  log: Logger = logger,
  options: { maxGroups?: number; budgetMs?: number } = {}
): Promise<void> {
  try {
    await suggestCategoriesForUser(userId, { log, ...options });
  } catch (error) {
    log.error("categorization.ai.run.failed", { error });
  }
}

/** Passa lo stato di una proposta a confermata o corretta quando l'utente categorizza l'esercente. */
export async function recordSuggestionDecisions(
  userId: string,
  decisions: { merchantKey: string; direction: "entrata" | "uscita"; categoryId: string }[]
): Promise<{ confirmed: number; corrected: number }> {
  let confirmed = 0;
  let corrected = 0;
  const now = new Date();
  for (const decision of decisions) {
    const [existing] = await db
      .select()
      .from(categorizationSuggestions)
      .where(
        and(
          eq(categorizationSuggestions.userId, userId),
          eq(categorizationSuggestions.merchantKey, decision.merchantKey),
          eq(categorizationSuggestions.direction, decision.direction),
          inArray(categorizationSuggestions.status, ["in_attesa"])
        )
      );
    if (!existing) continue;
    const same = existing.categoryId === decision.categoryId;
    await db
      .update(categorizationSuggestions)
      .set(
        same
          ? { status: "confermata", resolvedAt: now }
          : { status: "corretta", categoryId: decision.categoryId, source: "utente", confidence: "1.0000", resolvedAt: now }
      )
      .where(eq(categorizationSuggestions.id, existing.id));
    if (same) confirmed += 1;
    else corrected += 1;
  }
  recordCategorizationSuggestions("confirmed", confirmed);
  recordCategorizationSuggestions("corrected", corrected);
  return { confirmed, corrected };
}
