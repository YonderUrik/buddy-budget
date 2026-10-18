import { isSupportedProfile, resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { recentLoginExpiresAt } from "@/lib/account/recent-login";
import { listLinkedProviders } from "@/lib/account/sessions";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { resolveHomePage } from "@/lib/account/home-pages";
import { updateUserSettingsSchema } from "@/lib/validation/user-settings";
import { instanceCapabilities } from "@/lib/selfhost";
import { requestLogger, withRoute } from "@/lib/observability";
import { localizeDemo } from "@/lib/start/demo";

/** Profilo e preferenze dell'utente per la pagina Impostazioni, con metodi di accesso e scadenza dell'accesso recente. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const { user } = session;
  const providers = await listLinkedProviders(user.id);
  return Response.json({
    instance: process.env.SELF_HOSTED === "true" ? instanceCapabilities() : null,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    ...resolveProfile(user),
    currency: user.currency,
    homePage: resolveHomePage(user.homePage),
    hideAmounts: user.hideAmounts === true,
    legalAcceptedAt: user.legalAcceptedAt ? new Date(user.legalAcceptedAt).toISOString() : null,
    legalAcceptedVersion: user.legalAcceptedVersion ?? null,
    createdAt: new Date(user.createdAt).toISOString(),
    googleLinked: providers.includes("google"),
    passwordSet: providers.includes("credential"),
    recentLoginUntil: recentLoginExpiresAt(new Date(session.session.createdAt)).toISOString(),
  });
}

/** Aggiorna nome, valuta, pagina iniziale o nascondi importi (solo valori ammessi). */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = updateUserSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const current = resolveProfile(session.user);
  const country = parsed.data.productCountry ?? current.productCountry;
  const language = parsed.data.language ?? current.language;
  if (!isSupportedProfile(country, language)) {
    return Response.json({ error: "Unsupported country and language combination", code: "unsupported_locale" }, { status: 400 });
  }
  await db
    .update(authUser)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(authUser.id, session.user.id));
  if (country !== current.productCountry || language !== current.language) requestLogger().info("user.locale.updated", { country, language });
  // The example data follows the interface language, so it is rewritten when the language changes.
  if (language !== current.language) {
    const localized = await localizeDemo(session.user.id, language);
    if (localized > 0) requestLogger().info("onboarding.demo.localized", { count: localized });
  }
  return new Response(null, { status: 204 });
}

export const GET = withRoute("user.settings.get", handleGet);
export const PATCH = withRoute("user.settings.update", handlePatch);
