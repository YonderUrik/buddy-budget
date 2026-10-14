import { localizeStarterCategories } from "@/lib/localization/categories.server";
import { isSupportedProfile, resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { isSupportedCurrency } from "@/lib/validation/currency";
import { isValidLegalAcceptance } from "@/lib/legal";
import { recordLegalAcceptance } from "@/lib/legal/acceptance";
import { saveNotificationPreferences } from "@/lib/notifications/server";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { notificationPreferencesSchema } from "@/lib/validation/notifications";
import { applyCategorySetup } from "@/lib/categories/setup.server";
import { categorySetupSchema } from "@/lib/validation/categories";

/** Completa l'onboarding: salva la valuta principale (solo tra quelle supportate), applica le categorie scelte (se cambiate), le email facoltative scelte, registra l'accettazione di Termini e Privacy e marca l'utente come onboarded. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const currentProfile = resolveProfile(session.user);
  const profileInput = body as { productCountry?: unknown; language?: unknown } | null;
  const productCountry = profileInput?.productCountry ?? currentProfile.productCountry;
  const language = profileInput?.language ?? currentProfile.language;
  if (!isSupportedProfile(productCountry, language)) {
    return Response.json({ error: "Unsupported country and language combination", code: "unsupported_locale" }, { status: 400 });
  }
  const currency = (body as { currency?: unknown } | null)?.currency;
  // Una valuta non ISO valida farebbe lanciare Intl.NumberFormat in ogni pagina che mostra importi.
  if (!isSupportedCurrency(currency)) {
    return Response.json({ error: "Valuta non supportata" }, { status: 400 });
  }

  const legal = (body as { legal?: unknown } | null)?.legal;
  if (!isValidLegalAcceptance(legal)) {
    return Response.json({ error: "Per continuare accetta Termini e Privacy", code: "legal_acceptance_required" }, { status: 400 });
  }

  // Scelta dell'assistente per le categorie: presente solo se il servizio è configurato; il consenso è quello dato in questo passo.
  const aiCategorization = (body as { aiCategorization?: unknown } | null)?.aiCategorization;
  const aiConsent = aiCategorization === true && Boolean(process.env.OPENROUTER_API_KEY?.trim());

  // Email facoltative scelte nel passo «Notifiche»: le stesse preferenze di Impostazioni, salvate solo se valide.
  const notifications = notificationPreferencesSchema.safeParse((body as { notifications?: unknown } | null)?.notifications);

  await db
    .update(authUser)
    .set({ currency, productCountry: productCountry as string, language: language as string, onboardingCompleted: true, ...(typeof aiCategorization === "boolean" ? { aiCategorizationConsentAt: aiConsent ? new Date() : null } : {}) })
    .where(eq(authUser.id, session.user.id));
  await recordLegalAcceptance(session.user.id);
  if (notifications.success) {
    await saveNotificationPreferences(session.user.id, notifications.data);
    const enabled = [notifications.data.digestEnabled, notifications.data.budgetAlertsEnabled, notifications.data.deadlineAlertsEnabled].filter(Boolean).length;
    requestLogger().info("notifications.preferences.updated", { trigger: "onboarding", count: enabled });
  }
  requestLogger().info("legal.terms.accepted", { legalVersion: legal.version, trigger: "onboarding" });
  await applyOnboardingCategories((body as { categories?: unknown } | null)?.categories, session.user.id);

  await localizeStarterCategories(session.user.id, resolveProfile({ productCountry: productCountry as string, language: language as string }));

  return new Response(null, { status: 200 });
}

/**
 * Categorie scelte nel passo «Categorie»: assenti se l'utente non ha cambiato la proposta. Un errore qui non blocca
 * l'onboarding (restano le categorie di default, modificabili in Categorie): si registra e si prosegue.
 */
async function applyOnboardingCategories(raw: unknown, userId: string) {
  if (raw === undefined) return;
  const parsed = categorySetupSchema.safeParse(raw);
  if (!parsed.success) {
    requestLogger().warn("onboarding.categories.skipped", { reason: "invalid" });
    return;
  }
  try {
    const result = await applyCategorySetup(userId, parsed.data);
    if (result.outcome === "applied") {
      requestLogger().info("onboarding.categories.applied", { deleted: result.deleted, updated: result.updated, created: result.created });
    } else if (result.reason === "unchanged") {
      requestLogger().info("onboarding.categories.skipped", { reason: result.reason });
    } else {
      requestLogger().warn("onboarding.categories.skipped", { reason: result.reason });
    }
  } catch (error) {
    requestLogger().error("onboarding.categories.failed", { error });
  }
}

export const POST = withRoute("user.onboarding", handlePost);
