import { after, NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { readGenerationJob, startGenerationJob } from "@/lib/categorization/ai/generation-store";
import { runGeneration } from "@/lib/categorization/ai/run-generation";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 300;

/** Latest manual run for this user; completion is reported even when no suggestions were stored. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  return Response.json({ job: await readGenerationJob(session.user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** Starts background classification, or reuses the user's live run across tabs and app replicas. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  if (!process.env.OPENROUTER_API_KEY?.trim()) return Response.json({ status: "no_key" });
  const [user] = await db.select({ consentAt: authUser.aiCategorizationConsentAt }).from(authUser).where(eq(authUser.id, userId));
  if (!user?.consentAt) return Response.json({ status: "disabled" });

  const { job, created } = await startGenerationJob(userId);
  const log = requestLogger();
  if (created) after(() => runGeneration(userId, job, log));
  log.info("categorization.ai.generate.requested", { jobId: job.id });
  return Response.json({ status: "started", jobId: job.id, job });
}

export const GET = withRoute("transactions.categorize_suggestions_generate_status", handleGet);
export const POST = withRoute("transactions.categorize_suggestions_generate", handlePost);
