import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import * as z from "zod";
import { LANGUAGES } from "@/lib/localization/config";
import { recordPublicDemoEvent, requestLogger } from "@/lib/observability";
import {
  PUBLIC_DEMO_BLOCKED_AUTH_PATHS,
  PUBLIC_DEMO_READ_ONLY_CODE,
  PUBLIC_DEMO_READ_ONLY_MESSAGE,
  PUBLIC_DEMO_SESSION_HOURS,
  isPublicDemoEnabled,
  isPublicDemoUserId,
  publicDemoSessionLanguage,
  publicDemoUserId,
} from "@/lib/public-demo/config";
import { translate } from "@/lib/localization/messages";

/**
 * better-auth plugin of the public demo: `POST /public-demo/sign-in` opens a short session on the demo account of a
 * language (no email, no password), and a before-hook keeps demo sessions away from the endpoints that would change
 * or delete the shared account. Writes to the app's own API are blocked in `proxy.ts`.
 */
export function publicDemo() {
  return {
    id: "public-demo",
    endpoints: {
      signInPublicDemo: createAuthEndpoint(
        "/public-demo/sign-in",
        { method: "POST", body: z.object({ language: z.enum(LANGUAGES) }) },
        async (ctx) => {
          const { language } = ctx.body;
          const log = requestLogger();
          if (!isPublicDemoEnabled()) {
            recordPublicDemoEvent("unavailable", language);
            throw new APIError("NOT_FOUND", { message: "demo_disabled" });
          }
          // Never replace a real user's session: signing out first is their choice.
          const existing = await getSessionFromCtx(ctx);
          if (existing && !isPublicDemoUserId(existing.user.id)) throw new APIError("CONFLICT", { message: "already_signed_in" });
          const user = await ctx.context.internalAdapter.findUserById(publicDemoUserId(language));
          if (!user) {
            recordPublicDemoEvent("unavailable", language);
            log.warn("demo.session.unavailable", { language, reason: "not_seeded" });
            throw new APIError("NOT_FOUND", { message: "demo_unavailable" });
          }
          const session = await ctx.context.internalAdapter.createSession(user.id, true, {
            expiresAt: new Date(Date.now() + PUBLIC_DEMO_SESSION_HOURS * 3600_000),
          });
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "session_not_created" });
          await setSessionCookie(ctx, { session, user }, true);
          recordPublicDemoEvent("session_started", language);
          log.info("demo.session.started", { language });
          return ctx.json({ ok: true, language });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (session && isPublicDemoUserId(session.user.id)) {
              const language = publicDemoSessionLanguage(session.user.language as string | undefined);
              recordPublicDemoEvent("write_blocked", language);
              throw new APIError("FORBIDDEN", { code: PUBLIC_DEMO_READ_ONLY_CODE, message: translate(language, PUBLIC_DEMO_READ_ONLY_MESSAGE) });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
