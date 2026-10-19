import 'server-only';

import { localAccessPlugin } from "./local-plugin";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, lastLoginMethod, magicLink } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db/client";
import { authUser, authSession, authAccount, authVerification } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { recordAuthEvent, requestLogger } from "@/lib/observability";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { authMethods } from "@/lib/instance/config";
import { magicLinkEmailContent, magicLinkLanguage, passwordResetEmailContent, signInCodeEmailContent } from "./emails";
import { logMagicLink } from "./magic-link-log";
import { logDevOtp } from "./otp-dev-log";
import { emailOTPWithDeliveryErrors } from "./email-otp-plugin";
import { canCreateAccount, SIGNUPS_CLOSED_CODE } from "./signup-gate";
import {
  MAGIC_LINK_EXPIRES_MINUTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_EXPIRES_MINUTES,
  SESSION_EXPIRES_IN_DAYS,
  SESSION_UPDATE_AGE_DAYS,
  SIGN_IN_OTP_EXPIRES_MINUTES,
  SIGN_IN_OTP_LENGTH,
} from "./constants";
import { getAppUrl } from "@/lib/env";
import { DEFAULT_HOME_PAGE } from "@/lib/account/home-pages";
import { truncateIp } from "@/lib/account/ip-mask";
import { touchLastActive } from "@/lib/account/last-active";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { publicDemo, type PublicDemoSessionReader } from "./public-demo-plugin";

/** Sign-in methods of this instance (password, magic link, Google), from the environment: see lib/instance/config.ts. */
const methods = authMethods();

/** Google is on only with both credentials. */
const googleProvider = methods.google
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
  : {};

/** Refusal for a new account when signups are closed (only the first account of the instance can be created). */
function signupsClosed(): APIError {
  return new APIError("FORBIDDEN", { code: SIGNUPS_CLOSED_CODE, message: "Su questa installazione non si possono creare nuovi account." });
}

/** Saved language of the account with this email, if any (a failed lookup only costs the saved language). */
async function accountByEmail(email: string) {
  const [user] = await db
    .select({ id: authUser.id, productCountry: authUser.productCountry, language: authUser.language })
    .from(authUser)
    .where(eq(authUser.email, email.toLowerCase()))
    .limit(1)
    .catch(() => []);
  return user;
}

// Resolve lazily through the complete auth pipeline, including bearer authentication.
const readPublicDemoSession: PublicDemoSessionReader = (headers) => auth.api.getSession({ headers });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  plugins: [
    localAccessPlugin(),
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_MINUTES * 60,
      sendMagicLink: async ({ email, url }, ctx) => {
        const user = await accountByEmail(email);
        // Closed signups: say so now, instead of a link that would fail when opened.
        if (!user && !(await canCreateAccount())) {
          recordAuthEvent("signup_refused");
          throw signupsClosed();
        }
        if (!methods.emailDelivery) {
          // No email service and password sign-in turned off: the link appears in the container log (`docker compose logs app`).
          logMagicLink(url);
          recordAuthEvent("magic_link_sent");
          return;
        }
        // Written in the account's saved language, or in the language of the sign-in page for a new address.
        const language = magicLinkLanguage({ user, headers: ctx?.headers ?? ctx?.request?.headers });
        const result = await sendEmail({
          to: email,
          ...magicLinkEmailContent({ url, expiresInMinutes: MAGIC_LINK_EXPIRES_MINUTES, appUrl: new URL(url).origin, language }),
        });
        // A failed send becomes an error, so the page never shows "check your email" for nothing.
        if (!result.ok) {
          recordAuthEvent("magic_link_failed");
          // Only the error type: the provider's message can contain the address.
          requestLogger().error("auth.magic_link.failed", { reason: result.reason });
          throw new Error(`Invio magic link non riuscito (${result.reason})`);
        }
        recordAuthEvent("magic_link_sent");
      },
    }),
    // Sign-in with a 6-digit emailed code, for the native apps (no deep link needed, works across devices). Same
    // implicit sign-up as the magic link: an unknown address creates the user (and the category seed hook runs).
    // POST /api/auth/email-otp/send-verification-otp { email, type: "sign-in" } → POST /api/auth/sign-in/email-otp
    // { email, otp } → `token` in the body and in `set-auth-token`. Codes are stored hashed.
    emailOTPWithDeliveryErrors({
      otpLength: SIGN_IN_OTP_LENGTH,
      expiresIn: SIGN_IN_OTP_EXPIRES_MINUTES * 60,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        // Only sign-in codes exist here: no password, email verification or email change flows.
        if (type !== "sign-in") return;
        const log = requestLogger();
        const user = await accountByEmail(email);
        // Closed signups: an unknown address gets no code, as with the magic link.
        if (!user && !(await canCreateAccount())) {
          recordAuthEvent("signup_refused");
          throw signupsClosed();
        }
        const language = magicLinkLanguage({ user, headers: ctx?.headers ?? ctx?.request?.headers });
        const result = await sendEmail({
          to: email,
          ...signInCodeEmailContent({
            otp,
            expiresInMinutes: SIGN_IN_OTP_EXPIRES_MINUTES,
            appUrl: getAppUrl(),
            language,
          }),
        });
        if (!result.ok) {
          recordAuthEvent("otp_failed");
          // Development can use a code from the log. Without that fallback, fail the request so the app can
          // report the delivery problem. Only the error type: the provider's message can contain the address.
          if (result.reason === "email_not_configured") {
            log.warn("auth.otp.undeliverable", { reason: result.reason });
          } else {
            log.error("auth.otp.failed", { reason: result.reason });
          }
          if (!logDevOtp(otp, { log })) throw new APIError("SERVICE_UNAVAILABLE", {
            code: "OTP_DELIVERY_FAILED",
            message: "Non è stato possibile inviare il codice. Riprova più tardi.",
          });
          return;
        }
        recordAuthEvent("otp_sent");
        log.info("auth.otp.sent");
      },
    }),
    // Cookie readable by the page (no database field): lets the login page offer the method used last time.
    lastLoginMethod(),
    // Read-only sample accounts anyone can open from the landing (`/demo`), when PUBLIC_DEMO_ENABLED=true.
    publicDemo(readPublicDemoSession),
    // Native apps (no cookie jar): `Authorization: Bearer <session token>` is read as the session cookie by every
    // `getSession` call (API routes and proxy), and sign-in responses carry the token in the `set-auth-token` header.
    // The web keeps using the HttpOnly cookie. Unsigned tokens are accepted (the plugin signs them itself), so the
    // `token` returned by `/magic-link/verify` without a callbackURL works as is.
    bearer(),
  ],
  socialProviders: googleProvider,
  // Email and password: on for self-hosted installs (no email service needed), off on the hosted version.
  emailAndPassword: {
    enabled: methods.password,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // There may be no email service to verify the address: whoever runs the instance decides who signs up.
    requireEmailVerification: false,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_MINUTES * 60,
    revokeSessionsOnPasswordReset: true,
    // Without an email service the reset is done by whoever runs the instance (`pnpm auth:reset-password`).
    ...(methods.emailDelivery
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }, request?: Request) => {
            const account = await accountByEmail(user.email);
            const language = magicLinkLanguage({ user: account, headers: request?.headers });
            const result = await sendEmail({
              to: user.email,
              ...passwordResetEmailContent({ url, expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES, appUrl: new URL(url).origin, language }),
            });
            if (!result.ok) {
              recordAuthEvent("password_reset_failed");
              requestLogger().error("auth.password_reset.failed", { reason: result.reason });
              throw new Error(`Invio email non riuscito (${result.reason})`);
            }
            recordAuthEvent("password_reset_sent");
          },
          onPasswordReset: async () => {
            recordAuthEvent("password_reset_completed");
            requestLogger().info("auth.password_reset.completed");
          },
        }
      : {}),
  },
  // Espliciti (sono anche i default di better-auth) perché la pagina Impostazioni li mostra all'utente.
  session: {
    expiresIn: SESSION_EXPIRES_IN_DAYS * 24 * 60 * 60,
    updateAge: SESSION_UPDATE_AGE_DAYS * 24 * 60 * 60,
  },
  account: {
    // Token di Google cifrati con BETTER_AUTH_SECRET; quelli già salvati in chiaro restano leggibili (better-auth li riconosce).
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  user: {
    // `input: false` su tutti i campi: non si impostano da `/api/auth/update-user` (che non li validerebbe),
    // ma solo dalle route dell'app (onboarding, impostazioni, gestione account).
    additionalFields: {
      productCountry: { type: "string", defaultValue: "IT", required: false, input: false },
      language: { type: "string", defaultValue: "it", required: false, input: false },
      currency: {
        type: "string",
        defaultValue: "EUR",
        required: false,
        input: false,
      },
      onboardingCompleted: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
      homePage: {
        type: "string",
        defaultValue: DEFAULT_HOME_PAGE,
        required: false,
        input: false,
      },
      hideAmounts: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
      deletionScheduledAt: {
        type: "date",
        required: false,
        input: false,
      },
      legalAcceptedAt: {
        type: "date",
        required: false,
        input: false,
      },
      legalAcceptedVersion: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        /** Salva l'IP troncato (minimizzazione): serve solo a riconoscere da dove arriva un accesso, non a identificare un dispositivo. */
        before: async (session) => ({ data: { ...session, ipAddress: truncateIp(session.ipAddress) } }),
        /** Ogni sessione creata è un accesso riuscito (magic link o Google): solo un contatore, nessun dato utente. */
        after: async (session) => {
          // Demo visits are counted by the public demo metric, not as sign-ins or activity of a real account.
          if (isPublicDemoUserId(session.userId)) return;
          recordAuthEvent("sign_in");
          await touchLastActive(session.userId);
        },
      },
      update: {
        /** Il rinnovo di una sessione (al più una volta al giorno di utilizzo) è un segno di attività: serve al cron degli account inattivi. */
        after: async (session) => {
          if (session?.userId && !isPublicDemoUserId(session.userId)) await touchLastActive(session.userId);
        },
      },
    },
    user: {
      create: {
        /** Every new account, whatever the method (password, link, Google), passes here: closed signups stop it. */
        before: async (user) => {
          if (!(await canCreateAccount())) {
            recordAuthEvent("signup_refused");
            requestLogger().warn("auth.signup.refused");
            throw signupsClosed();
          }
          return { data: user };
        },
        /** Semina le categorie di default quando un nuovo utente viene creato via auth. */
        after: async (user) => {
          await db.insert(categories).values(defaultCategoryRows(user.id));
        },
      },
    },
  },
});

export { initializeLocalOwner } from "./local-owner";

export type Session = typeof auth.$Infer.Session;
