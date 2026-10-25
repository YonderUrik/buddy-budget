import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { isLocalMode, isLocalRequest, LOCAL_ENTRY_PATH, LOCAL_OWNER_ID } from "@/lib/selfhost";
import { hashUserId, logger } from "@/lib/observability";
import { safeRedirectPath } from "./constants";

/** Issue a normal signed session for the single local owner; no request can choose an account. */
export function localAccessPlugin() {
  return {
    id: "selfhost-local",
    endpoints: {
      selfhostLocal: createAuthEndpoint("/selfhost-local", { method: "GET", requireHeaders: true }, async ctx => {
        if (!isLocalMode() || !ctx.request || !isLocalRequest(ctx.request)) throw new APIError("FORBIDDEN");
        const user = await ctx.context.internalAdapter.findUserById(LOCAL_OWNER_ID);
        if (!user) throw new APIError("SERVICE_UNAVAILABLE", { message: "The local account is not ready. Restart BuddyBudget." });
        const existing = await ctx.context.internalAdapter.findSession(await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret) || "");
        if (!existing || existing.session.expiresAt <= new Date() || existing.user.id !== LOCAL_OWNER_ID) {
          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR");
          await setSessionCookie(ctx, { session, user });
          logger.info("selfhost.local_session.created", { user: hashUserId(user.id) });
        }
        ctx.setHeader("Cache-Control", "no-store");
        const target = new URL(safeRedirectPath(new URL(ctx.request.url).searchParams.get("redirect")), process.env.APP_URL!);
        const app = new URL(process.env.APP_URL!);
        throw ctx.redirect(target.origin === app.origin && !target.pathname.startsWith(LOCAL_ENTRY_PATH) && !target.pathname.startsWith("/api/") ? target.href : app.href);
      }),
    },
  };
}
