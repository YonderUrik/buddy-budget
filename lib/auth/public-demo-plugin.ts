import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import * as z from "zod";
import { LANGUAGES, PRODUCT_COUNTRIES, isSupportedProfile } from "@/lib/localization/config";
import { recordPublicDemoEvent, requestLogger } from "@/lib/observability";
import {
  PUBLIC_DEMO_BLOCKED_AUTH_PATHS,
  PUBLIC_DEMO_READ_ONLY_CODE,
  PUBLIC_DEMO_READ_ONLY_MESSAGE,
  PUBLIC_DEMO_SESSION_HOURS,
  isPublicDemoEnabled,
  isPublicDemoUserId,
  publicDemoSessionProfile,
  publicDemoUserId,
} from "@/lib/public-demo/config";
import { translate } from "@/lib/localization/messages";

export type PublicDemoSessionReader = (headers: Headers) => Promise<{
  user: { id: string; language?: string | null; productCountry?: string | null };
} | null>;

/**
 * better-auth plugin of the public demo: `POST /public-demo/sign-in` opens a short session on the demo account of a
 * language (no email, no password), and a before-hook keeps demo sessions away from the endpoints that would change
 * or delete the shared account. Writes to the app's own API are blocked in `proxy.ts`.
 */
export function publicDemo(readSession: PublicDemoSessionReader) {
  return {
    id: "public-demo",
    endpoints: {
      signInPublicDemo: createAuthEndpoint(
        "/public-demo/sign-in",
        { method: "POST", body: z.object({ language: z.enum(LANGUAGES), productCountry: z.enum(PRODUCT_COUNTRIES) }) },
        async (ctx) => {
          const { language, productCountry } = ctx.body;
          const log = requestLogger();
          if (!isSupportedProfile(productCountry, language)) throw new APIError("BAD_REQUEST", { message: "demo_profile_unsupported" });
          const profile = { productCountry, language };
          if (!isPublicDemoEnabled()) {
            recordPublicDemoEvent("unavailable", language, productCountry);
            throw new APIError("NOT_FOUND", { message: "demo_disabled" });
          }
          // Never replace a real user's session: signing out first is their choice.
          const existing = await readSession(ctx.headers ?? ctx.request?.headers ?? new Headers());
          if (existing && !isPublicDemoUserId(existing.user.id)) throw new APIError("CONFLICT", { message: "already_signed_in" });
          const user = await ctx.context.internalAdapter.findUserById(publicDemoUserId(profile));
          if (!user) {
            recordPublicDemoEvent("unavailable", language, productCountry);
            log.warn("demo.session.unavailable", { language, country: productCountry, reason: "not_seeded" });
            throw new APIError("NOT_FOUND", { message: "demo_unavailable" });
          }
          const session = await ctx.context.internalAdapter.createSession(user.id, true, {
            expiresAt: new Date(Date.now() + PUBLIC_DEMO_SESSION_HOURS * 3600_000),
          });
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "session_not_created" });
          await setSessionCookie(ctx, { session, user }, true);
          recordPublicDemoEvent("session_started", language, productCountry);
          log.info("demo.session.started", { language, country: productCountry });
          return ctx.json({ ok: true, language, productCountry });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            // Before-hooks do not see header changes returned by other before-hooks. Re-enter getSession's
            // full pipeline so the bearer plugin authenticates the token before applying the demo guard.
            const session = await readSession(ctx.headers ?? ctx.request?.headers ?? new Headers());
            if (session && isPublicDemoUserId(session.user.id)) {
              const { language, productCountry } = publicDemoSessionProfile(session.user as { language?: string | null; productCountry?: string | null });
              recordPublicDemoEvent("write_blocked", language, productCountry);
              throw new APIError("FORBIDDEN", { code: PUBLIC_DEMO_READ_ONLY_CODE, message: translate(language, PUBLIC_DEMO_READ_ONLY_MESSAGE) });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
