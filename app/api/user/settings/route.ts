import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { recentLoginExpiresAt } from "@/lib/account/recent-login";
import { listLinkedProviders } from "@/lib/account/sessions";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { resolveHomePage } from "@/lib/account/home-pages";
import { updateUserSettingsSchema } from "@/lib/validation/user-settings";
import { withRoute } from "@/lib/observability";

/** Profilo e preferenze dell'utente per la pagina Impostazioni, con metodi di accesso e scadenza dell'accesso recente. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const { user } = session;
  const providers = await listLinkedProviders(user.id);
  return Response.json({
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    currency: user.currency,
    homePage: resolveHomePage(user.homePage),
    hideAmounts: user.hideAmounts === true,
    createdAt: new Date(user.createdAt).toISOString(),
    googleLinked: providers.includes("google"),
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
  await db
    .update(authUser)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(authUser.id, session.user.id));
  return new Response(null, { status: 204 });
}

export const GET = withRoute("user.settings.get", handleGet);
export const PATCH = withRoute("user.settings.update", handlePatch);
