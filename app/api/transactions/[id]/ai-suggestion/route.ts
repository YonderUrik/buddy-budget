import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { suggestCategoryForTransaction } from "@/lib/categorization/ai/suggest-one";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { redis } from "@/lib/redis/client";

/** One model call with a 30 s timeout: short enough to answer in the request (exception to the job standard). */
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Questions per user in the window: each one is a paid model call. */
export const SINGLE_SUGGESTION_LIMIT = 30;
const SINGLE_SUGGESTION_WINDOW_SECONDS = 60 * 60;

/** Counts the question in the user's hourly window; lets it through when Redis does not answer. */
async function consumeSingleSuggestionQuota(userId: string): Promise<boolean> {
  const key = `categorization:single:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, SINGLE_SUGGESTION_WINDOW_SECONDS);
    return count <= SINGLE_SUGGESTION_LIMIT;
  } catch {
    return true;
  }
}

/**
 * POST /api/transactions/[id]/ai-suggestion — «Chiedi all'AI» from a transaction's detail: which category the model
 * would give it. Answers `{ status }` (ok with `categoryId` and `confidence`, disabled, no_key, blocked, limited,
 * failed) and writes nothing; 404 when the transaction does not exist or belongs to someone else.
 */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  bindRequestUser(userId);

  const { id } = await params;
  const result = UUID.test(id) ? await suggestCategoryForTransaction(userId, id, { log: requestLogger(), consumeQuota: () => consumeSingleSuggestionQuota(userId) }) : null;
  if (!result) return new Response(null, { status: 404 });
  requestLogger().info(result.status === "ok" ? "categorization.ai.single.suggested" : "categorization.ai.single.skipped", { outcome: result.status });
  return Response.json(result);
}

export const POST = withRoute("transactions.ai_suggestion", handlePost);
