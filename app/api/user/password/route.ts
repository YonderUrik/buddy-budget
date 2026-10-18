import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { readJson, recentLoginRequired, sessionOrUnauthorized } from "@/lib/account/route-session";
import { listLinkedProviders } from "@/lib/account/sessions";
import { authMethods } from "@/lib/instance/config";
import { requestLogger, withRoute } from "@/lib/observability";

const bodySchema = z.object({ newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH) });

/**
 * Adds a password to an account that signs in only with the emailed link or Google. Needs a recent sign-in, like the
 * other sensitive actions: a stolen session must not be able to add a lasting way in. Changing an existing password
 * goes through better-auth's `/change-password`, which asks for the current one.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  if (!authMethods().password) return Response.json({ error: "Su questa installazione l'accesso con password è spento." }, { status: 404 });
  const reauth = recentLoginRequired(session);
  if (reauth) return reauth;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "La password deve avere almeno 10 caratteri." }, { status: 400 });
  if ((await listLinkedProviders(session.user.id)).includes("credential")) {
    return Response.json({ error: "Hai già una password: cambiala con quella attuale." }, { status: 409 });
  }
  await auth.api.setPassword({ body: { newPassword: parsed.data.newPassword }, headers: request.headers });
  requestLogger().info("auth.password.set");
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.password_set", handlePost);
