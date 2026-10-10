import 'server-only';

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { authUser, authSession, authAccount, authVerification } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { recordAuthEvent, requestLogger } from "@/lib/observability";
import { magicLinkEmailContent } from "./emails";
import { logMagicLink } from "./magic-link-log";
import { MAGIC_LINK_EXPIRES_MINUTES, SESSION_EXPIRES_IN_DAYS, SESSION_UPDATE_AGE_DAYS } from "./constants";
import { DEFAULT_HOME_PAGE } from "@/lib/account/home-pages";
import { truncateIp } from "@/lib/account/ip-mask";

/** Client Resend creato al primo uso: senza RESEND_API_KEY (self-hosting) il costruttore lancerebbe già all'import. */
function getResend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
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
      sendMagicLink: async ({ email, url }) => {
        const resend = getResend();
        if (!resend) {
          // Self-hosting senza email: il link compare nei log del container (`docker compose logs app`).
          logMagicLink(url);
          recordAuthEvent("magic_link_sent");
          return;
        }
        // Resend non lancia in caso di errore: restituisce `{ error }`. Lo trasformiamo in eccezione
        // così better-auth risponde con errore e la UI non mostra "controlla la tua email" a vuoto.
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          ...magicLinkEmailContent({ url, expiresInMinutes: MAGIC_LINK_EXPIRES_MINUTES, appUrl: new URL(url).origin }),
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
  ],
  socialProviders: googleProvider,
  // Espliciti (sono anche i default di better-auth) perché la pagina Impostazioni li mostra all'utente.
  session: {
    expiresIn: SESSION_EXPIRES_IN_DAYS * 24 * 60 * 60,
    updateAge: SESSION_UPDATE_AGE_DAYS * 24 * 60 * 60,
  },
  account: {
    accountLinking: {
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  user: {
    // `input: false` su tutti i campi: non si impostano da `/api/auth/update-user` (che non li validerebbe),
    // ma solo dalle route dell'app (onboarding, impostazioni, gestione account).
    additionalFields: {
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
        after: async () => {
          recordAuthEvent("sign_in");
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
