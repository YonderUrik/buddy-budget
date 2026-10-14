import { after, NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { autoApplyCategoriesSafely } from "@/lib/categorization/auto-apply";
import { db } from "@/lib/db/client";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { authUser } from "@/lib/db/schema/auth";
import { requestLogger, withRoute } from "@/lib/observability";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  instructions: z.string().trim().max(2000).optional(),
  autoApply: z.boolean().optional(),
}).refine((data) => data.enabled !== undefined || data.instructions !== undefined || data.autoApply !== undefined);

/**
 * Stato del consenso alle proposte dell'assistente; `available` dice se il servizio è configurato sul server.
 * `autoApply`: le proposte sicure (dal 90%) si applicano da sole; vale anche senza assistente (scelte passate).
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const [row] = await db
    .select({ consentAt: authUser.aiCategorizationConsentAt, instructions: authUser.aiCategorizationInstructions, autoApply: authUser.categorizationAutoApply })
    .from(authUser)
    .where(eq(authUser.id, session.user.id));
  return Response.json({
    enabled: Boolean(row?.consentAt),
    instructions: row?.instructions ?? "",
    available: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    autoApply: row?.autoApply ?? false,
  });
}

/**
 * Attiva o revoca il consenso, salva le istruzioni o accende/spegne l'applicazione automatica. Revocare il consenso ferma
 * subito nuove richieste e le proposte dell'assistente già salvate non si applicano più da sole (restano da confermare).
 * Accendere l'applicazione automatica la esegue subito sui movimenti in attesa.
 */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  await db.transaction(async (tx) => {
    const [previous] = await tx.select().from(authUser).where(eq(authUser.id, session.user.id)).for("update");
    await tx.update(authUser).set({
      ...(parsed.data.enabled !== undefined ? { aiCategorizationConsentAt: parsed.data.enabled ? new Date() : null } : {}),
      ...(parsed.data.instructions !== undefined ? { aiCategorizationInstructions: parsed.data.instructions } : {}),
      ...(parsed.data.autoApply !== undefined ? { categorizationAutoApply: parsed.data.autoApply } : {}),
    }).where(eq(authUser.id, session.user.id));
    if (parsed.data.instructions !== undefined && previous?.aiCategorizationInstructions !== parsed.data.instructions) {
      await tx.delete(categorizationSuggestions).where(and(
        eq(categorizationSuggestions.userId, session.user.id), eq(categorizationSuggestions.status, "in_attesa")
      ));
    }
  });
  if (parsed.data.enabled !== undefined) requestLogger().info("categorization.ai.consent.updated", { enabled: parsed.data.enabled });
  if (parsed.data.instructions !== undefined) requestLogger().info("categorization.ai.instructions.updated");
  if (parsed.data.autoApply !== undefined) {
    const log = requestLogger();
    log.info("categorization.auto.setting.updated", { enabled: parsed.data.autoApply });
    const userId = session.user.id;
    if (parsed.data.autoApply) after(() => autoApplyCategoriesSafely(userId, log));
  }
  return handleGet(request);
}

export const GET = withRoute("user.ai_categorization.get", handleGet);
export const PATCH = withRoute("user.ai_categorization.update", handlePatch);
