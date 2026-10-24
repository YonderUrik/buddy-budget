import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { commandModel, interpretWithModel } from "@/lib/commands/ai";
import { cacheInterpretation, cachedInterpretation, checkSentence, consumeCommandQuota } from "@/lib/commands/guard";
import { COMMAND_LANGUAGES, COMMAND_MAX_LENGTH } from "@/lib/commands/types";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { isPublicDemoUserId } from "@/lib/public-demo/config";

/** One short model call (8 s timeout) answered in the request: an exception to the job standard, like «Chiedi all'AI» on a transaction. */
export const maxDuration = 20;

const bodySchema = z.object({
  sentence: z.string().max(COMMAND_MAX_LENGTH * 2),
  language: z.enum(COMMAND_LANGUAGES),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** The browser's today, if it is within a day of the server's (time zones); the server's otherwise. */
function trustedToday(claimed: string): string {
  const server = new Date();
  const diff = Math.abs(new Date(`${claimed}T12:00:00Z`).getTime() - server.getTime());
  return diff <= 36 * 3_600_000 ? claimed : server.toISOString().slice(0, 10);
}

/**
 * POST /api/commands/interpret — «Chiedi all'AI» in «Cerca»: a sentence the rules could not read becomes a draft to
 * add. Answers `{ status }`: ok (with `draft`), none (not something to add), invalid, disabled (no AI consent),
 * unavailable (public demo, no key or model), limited, failed. It never writes: the draft only fills a form.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  bindRequestUser(userId);
  const log = requestLogger();
  const done = (status: string, extra: Record<string, unknown> = {}) => {
    log.info("commands.ai.interpreted", { outcome: status });
    return Response.json({ status, ...extra });
  };

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return done("invalid");
  const sentence = parsed.data.sentence.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (checkSentence(sentence)) return done("invalid");
  // The shared demo account is open to anyone: no paid calls from there.
  if (isPublicDemoUserId(userId)) return done("unavailable");

  const [user] = await db.select({ consentAt: authUser.aiCategorizationConsentAt }).from(authUser).where(eq(authUser.id, userId));
  if (!user?.consentAt) return done("disabled");
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = commandModel();
  if (!apiKey || !model) return done("unavailable");

  const today = trustedToday(parsed.data.today);
  const cached = await cachedInterpretation(userId, sentence, today);
  if (cached !== undefined) return cached ? done("ok", { draft: cached }) : done("none");
  if (!(await consumeCommandQuota(userId))) return done("limited");

  try {
    const draft = await interpretWithModel(sentence, { apiKey, model, language: parsed.data.language, today });
    await cacheInterpretation(userId, sentence, today, draft);
    return draft ? done("ok", { draft }) : done("none");
  } catch (error) {
    log.warn("commands.ai.failed", { error });
    return done("failed");
  }
}

export const POST = withRoute("commands.interpret", handlePost);
