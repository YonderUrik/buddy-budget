import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { requestLogger, withRoute } from "@/lib/observability";

const updateSchema = z.object({ enabled: z.boolean() });

/** Stato del consenso alle proposte dell'assistente; `available` dice se il servizio è configurato sul server. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const [row] = await db.select({ consentAt: authUser.aiCategorizationConsentAt }).from(authUser).where(eq(authUser.id, session.user.id));
  return Response.json({ enabled: Boolean(row?.consentAt), available: Boolean(process.env.OPENROUTER_API_KEY?.trim()) });
}

/** Attiva o revoca il consenso. Revocare ferma subito nuove richieste; le proposte già salvate restano da confermare. */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  await db
    .update(authUser)
    .set({ aiCategorizationConsentAt: parsed.data.enabled ? new Date() : null })
    .where(eq(authUser.id, session.user.id));
  requestLogger().info("categorization.ai.consent.updated", { enabled: parsed.data.enabled });
  return Response.json({ enabled: parsed.data.enabled, available: Boolean(process.env.OPENROUTER_API_KEY?.trim()) });
}

export const GET = withRoute("user.ai_categorization.get", handleGet);
export const PATCH = withRoute("user.ai_categorization.update", handlePatch);
