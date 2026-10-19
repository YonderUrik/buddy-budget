import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { classifyWithJev } from "@/lib/llm/jev";
import { logger, recordCategorizationAiRequest, type Logger } from "@/lib/observability";
import { merchantKey } from "../merchant-key";
import { prepareMerchantForModel } from "../privacy-filter";
import { countExampleRows, pickExamples } from "./groups";
import type { SingleSuggestion } from "./single-suggestion";
import { categorizationModel } from "./suggest-for-user";

/** Recent categorised transactions the examples are picked from (same window as the batch run). */
const MAX_EXAMPLE_SOURCE_ROWS = 5000;

/**
 * Asks the model which category fits one transaction, like the batch run does for a merchant: only the cleaned
 * merchant name, the MCC and the direction leave the server, with the user's categories, instructions and examples.
 * The examples leave out the same merchant, so the answer is a second opinion and not the user's own choice echoed
 * back. Nothing is written: the user decides whether to use the answer. Null when the transaction is not the user's.
 */
export async function suggestCategoryForTransaction(
  userId: string,
  transactionId: string,
  options: { log?: Logger; fetchImpl?: typeof fetch; consumeQuota?: () => Promise<boolean> } = {}
): Promise<SingleSuggestion | null> {
  const log = options.log ?? logger;
  const [transaction] = await db
    .select({ description: transactions.description, rawDescription: transactions.rawDescription, mcc: transactions.merchantCategoryCode, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  if (!transaction) return null;

  const [user] = await db
    .select({ consentAt: authUser.aiCategorizationConsentAt, instructions: authUser.aiCategorizationInstructions })
    .from(authUser)
    .where(eq(authUser.id, userId));
  if (!user?.consentAt) return { status: "disabled" };
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return { status: "no_key" };

  const prepared = prepareMerchantForModel(transaction.rawDescription ?? transaction.description);
  if (prepared.blocked) return { status: "blocked", reason: prepared.blocked };
  if (options.consumeQuota && !(await options.consumeQuota())) return { status: "limited" };

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallback = userCategories.find((category) => category.isFallback);
  const choices = userCategories.filter((category) => !category.isFallback && category.type !== "trasferimento");
  if (choices.length === 0) return { status: "failed" };

  const key = merchantKey(transaction.description);
  const categorizedRows = await db
    .select({ description: transactions.description, rawDescription: transactions.rawDescription, categoryId: transactions.categoryId })
    .from(transactions)
    .where(fallback ? and(eq(transactions.userId, userId), ne(transactions.categoryId, fallback.id)) : eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(MAX_EXAMPLE_SOURCE_ROWS);
  // Filtered in memory: descriptions can be encrypted in the database.
  const otherMerchants = categorizedRows.filter((row) => merchantKey(row.description) !== key);
  const examples = pickExamples(countExampleRows(otherMerchants), new Map(choices.map((category) => [category.id, category.name])));

  const startedAt = Date.now();
  try {
    const { decisions } = await classifyWithJev(
      {
        merchants: [{ id: "0", name: prepared.name, mcc: transaction.mcc, isIncome: Number(transaction.amount) > 0 }],
        categories: choices.map((category) => ({ name: category.name, type: category.type, ...(category.description ? { description: category.description } : {}) })),
        examples,
        model: categorizationModel(),
        instructions: user.instructions,
      },
      { apiKey, fetchImpl: options.fetchImpl }
    );
    recordCategorizationAiRequest("ok", Date.now() - startedAt);
    const decision = decisions[0];
    const category = decision ? choices.find((candidate) => candidate.name === decision.categoryName) : undefined;
    if (!decision || !category) return { status: "failed" };
    return { status: "ok", categoryId: category.id, confidence: Math.min(1, Math.max(0, decision.confidence)) };
  } catch (error) {
    recordCategorizationAiRequest("error", Date.now() - startedAt);
    log.warn("categorization.ai.single.failed", { error });
    return { status: "failed" };
  }
}
