import 'server-only';

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP, lastLoginMethod, magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { authUser, authSession, authAccount, authVerification } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { recordAuthEvent, requestLogger } from "@/lib/observability";
import { eq } from "drizzle-orm";
import { magicLinkEmailContent, magicLinkLanguage, signInCodeEmailContent } from "./emails";
import { logMagicLink } from "./magic-link-log";
import { logDevOtp } from "./otp-dev-log";
import {
  MAGIC_LINK_EXPIRES_MINUTES,
  SESSION_EXPIRES_IN_DAYS,
  SESSION_UPDATE_AGE_DAYS,
  SIGN_IN_OTP_EXPIRES_MINUTES,
  SIGN_IN_OTP_LENGTH,
} from "./constants";
import type { Language } from "@/lib/localization/config";
import { getAppUrl } from "@/lib/env";
import { DEFAULT_HOME_PAGE } from "@/lib/account/home-pages";
import { truncateIp } from "@/lib/account/ip-mask";
import { touchLastActive } from "@/lib/account/last-active";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { publicDemo } from "./public-demo-plugin";

/** Client Resend creato al primo uso: senza RESEND_API_KEY (self-hosting) il costruttore lancerebbe già all'import. */
function getResend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

/**
 * Language of a sign-in email (link or code): the account's saved language, or the language of the sign-in page for
 * a new address. A failed lookup only costs the saved language: the email still goes out.
 */
async function signInEmailLanguage(email: string, headers: Headers | null | undefined): Promise<Language> {
  const [user] = await db
    .select({ productCountry: authUser.productCountry, language: authUser.language })
    .from(authUser)
    .where(eq(authUser.email, email.toLowerCase()))
    .limit(1)
    .catch(() => []);
  return magicLinkLanguage({ user, headers });
}

/** Google è attivo solo con entrambe le credenziali; altrimenti resta solo il magic link. */
const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {};

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
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_MINUTES * 60,
      sendMagicLink: async ({ email, url }, ctx) => {
        const resend = getResend();
        if (!resend) {
          // Self-hosting senza email: il link compare nei log del container (`docker compose logs app`).
          logMagicLink(url);
          recordAuthEvent("magic_link_sent");
          return;
        }
        // Resend non lancia in caso di errore: restituisce `{ error }`. Lo trasformiamo in eccezione
        // così better-auth risponde con errore e la UI non mostra "controlla la tua email" a vuoto.
        const language = await signInEmailLanguage(email, ctx?.headers ?? ctx?.request?.headers);
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          ...magicLinkEmailContent({ url, expiresInMinutes: MAGIC_LINK_EXPIRES_MINUTES, appUrl: new URL(url).origin, language }),
        });
        if (error) {
          recordAuthEvent("magic_link_failed");
          // Solo il tipo d'errore di Resend: il messaggio può contenere l'indirizzo email.
          requestLogger().error("auth.magic_link.failed", { reason: error.name });
          throw new Error(`Invio magic link non riuscito (${error.name})`);
        }
        recordAuthEvent("magic_link_sent");
      },
    }),
    // Sign-in with a 6-digit emailed code, for the native apps (no deep link needed, works across devices). Same
    // implicit sign-up as the magic link: an unknown address creates the user (and the category seed hook runs).
    // POST /api/auth/email-otp/send-verification-otp { email, type: "sign-in" } → POST /api/auth/sign-in/email-otp
    // { email, otp } → `token` in the body and in `set-auth-token`. Codes are stored hashed.
    emailOTP({
      otpLength: SIGN_IN_OTP_LENGTH,
      expiresIn: SIGN_IN_OTP_EXPIRES_MINUTES * 60,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        // Only sign-in codes exist here: no password, email verification or email change flows.
        if (type !== "sign-in") return;
        const log = requestLogger();
        const resend = getResend();
        if (!resend) {
          // Development without email: the code goes to the dev log. In production nothing is logged and the code
          // can't be delivered (self-hosters without Resend keep the magic link, which prints its URL).
          if (!logDevOtp(otp, { log })) log.warn("auth.otp.undeliverable", { reason: "email_not_configured" });
          recordAuthEvent("otp_failed");
          return;
        }
        const language = await signInEmailLanguage(email, ctx?.headers ?? ctx?.request?.headers);
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          ...signInCodeEmailContent({
            otp,
            expiresInMinutes: SIGN_IN_OTP_EXPIRES_MINUTES,
            appUrl: getAppUrl(),
            language,
          }),
        });
        if (error) {
          recordAuthEvent("otp_failed");
          // Only Resend's error type: the message can contain the address.
          log.error("auth.otp.failed", { reason: error.name });
          logDevOtp(otp, { log });
          return;
        }
        recordAuthEvent("otp_sent");
        log.info("auth.otp.sent");
      },
    }),
    // Cookie readable by the page (no database field): lets the login page offer the method used last time.
    lastLoginMethod(),
    // Read-only sample accounts anyone can open from the landing (`/demo`), when PUBLIC_DEMO_ENABLED=true.
    publicDemo(),
    // Native apps (no cookie jar): `Authorization: Bearer <session token>` is read as the session cookie by every
    // `getSession` call (API routes and proxy), and sign-in responses carry the token in the `set-auth-token` header.
    // The web keeps using the HttpOnly cookie. Unsigned tokens are accepted (the plugin signs them itself), so the
    // `token` returned by `/magic-link/verify` without a callbackURL works as is.
    bearer(),
  ],
  socialProviders: googleProvider,
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
        /** Semina le categorie di default quando un nuovo utente viene creato via auth. */
        after: async (user) => {
          await db.insert(categories).values(defaultCategoryRows(user.id));
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
